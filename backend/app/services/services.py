from jose import JWTError, jwt
from datetime import datetime, timedelta
import qrcode
import hashlib

SECRET_KEY = "your-secret-key-here"
ALGORITHM = "HS256"
ACCESS_TOKEN_EXPIRE_MINUTES = 30

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode.update({"exp": expire})
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except JWTError:
        return None

def generate_qr_code(ticket_data: str):
    qr = qrcode.QRCode(version=1, box_size=10, border=4)
    qr.add_data(ticket_data)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    filename = f"qr_{hashlib.md5(ticket_data.encode()).hexdigest()}.png"
    filepath = f"static/qr_codes/{filename}"
    img.save(filepath)
    
    return f"/static/qr_codes/{filename}"