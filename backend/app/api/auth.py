from datetime import datetime, timedelta
from typing import Optional, Callable
import uuid
import os
from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from sqlalchemy.orm import Session

from app.database import get_db
from app.crud.crud import (
    get_user_by_username,
    authenticate_user,
    get_user_by_email,
    create_user,
    create_refresh_token_record,
    get_refresh_token_record,
    revoke_refresh_token,
    revoke_all_user_refresh_tokens,
)
from app.schemas.schemas import Token, UserCreate, RefreshTokenRequest

load_dotenv()

SECRET_KEY = os.getenv("JWT_SECRET_KEY", "dev-secret-key-change-me")
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "30"))
REFRESH_TOKEN_EXPIRE_DAYS = int(os.getenv("REFRESH_TOKEN_EXPIRE_DAYS", "14"))

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="api/auth/token")

ROLE_PERMISSIONS = {
    "guest": {"events:read"},
    "user": {"events:read", "events:create", "events:update:own", "events:delete:own", "tickets:create"},
    "manager": {
        "events:read",
        "events:create",
        "events:update:own",
        "events:delete:own",
        "events:moderate",
        "tickets:create",
    },
    "admin": {"*"},
}

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(minutes=15)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def create_refresh_token(data: dict, expires_delta: Optional[timedelta] = None):
    to_encode = data.copy()
    if expires_delta:
        expire = datetime.utcnow() + expires_delta
    else:
        expire = datetime.utcnow() + timedelta(days=REFRESH_TOKEN_EXPIRE_DAYS)
    to_encode.update({"exp": expire, "type": "refresh"})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt, expire

async def get_current_user(token: str = Depends(oauth2_scheme), db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        username: str = payload.get("sub")
        if username is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception
    
    user = get_user_by_username(db, username=username)
    if user is None:
        raise credentials_exception
    return user

async def get_current_active_user(current_user = Depends(get_current_user)):
    if not current_user.is_active:
        raise HTTPException(status_code=400, detail="Inactive user")
    return current_user

def has_permission(user_role: str, permission: str) -> bool:
    role_permissions = ROLE_PERMISSIONS.get(user_role, set())
    return "*" in role_permissions or permission in role_permissions

def require_permission(permission: str) -> Callable:
    async def permission_dependency(current_user=Depends(get_current_active_user)):
        if not has_permission(getattr(current_user, "role", "user"), permission):
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return permission_dependency

def require_admin(current_user=Depends(get_current_active_user)):
    if getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

from fastapi import APIRouter

router = APIRouter()

def issue_token_pair(db: Session, user):
    access_token_expires = timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    access_token = create_access_token(
        data={"sub": user.username, "role": getattr(user, "role", "user")},
        expires_delta=access_token_expires,
    )
    token_jti = str(uuid.uuid4())
    refresh_token, refresh_expires_at = create_refresh_token(
        data={"sub": user.username, "jti": token_jti}
    )
    create_refresh_token_record(db, user.id, token_jti, refresh_expires_at)
    return {"access_token": access_token, "refresh_token": refresh_token, "token_type": "bearer"}

@router.post("/register")
async def register(user: UserCreate, db: Session = Depends(get_db)):
    db_user = get_user_by_username(db, username=user.username)
    if db_user:
        raise HTTPException(status_code=400, detail="Username already registered")
    
    db_user = get_user_by_email(db, email=user.email)
    if db_user:
        raise HTTPException(status_code=400, detail="Email already registered")
    
    user = create_user(db=db, user=user)
    return issue_token_pair(db, user)

@router.post("/token", response_model=Token)
async def login_for_access_token(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    user = authenticate_user(db, form_data.username, form_data.password)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect username or password",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return issue_token_pair(db, user)

@router.post("/refresh", response_model=Token)
async def refresh_access_token(payload: RefreshTokenRequest, db: Session = Depends(get_db)):
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Invalid refresh token",
        headers={"WWW-Authenticate": "Bearer"},
    )
    try:
        decoded = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        username = decoded.get("sub")
        token_jti = decoded.get("jti")
        token_type = decoded.get("type")
        if not username or not token_jti or token_type != "refresh":
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    token_record = get_refresh_token_record(db, token_jti=token_jti)
    if not token_record or token_record.revoked or token_record.expires_at <= datetime.utcnow():
        raise credentials_exception

    user = get_user_by_username(db, username=username)
    if not user or not user.is_active:
        raise credentials_exception

    revoke_refresh_token(db, token_jti=token_jti)
    return issue_token_pair(db, user)

@router.post("/logout")
async def logout(
    payload: RefreshTokenRequest,
    current_user=Depends(get_current_active_user),
    db: Session = Depends(get_db),
):
    try:
        decoded = jwt.decode(payload.refresh_token, SECRET_KEY, algorithms=[ALGORITHM])
        token_jti = decoded.get("jti")
        token_username = decoded.get("sub")
    except JWTError:
        token_jti = None
        token_username = None

    if token_jti and token_username == current_user.username:
        revoke_refresh_token(db, token_jti=token_jti)
    else:
        revoke_all_user_refresh_tokens(db, current_user.id)

    return {"message": "Logged out successfully"}

@router.get("/me")
async def read_current_user(current_user=Depends(get_current_active_user)):
    return current_user