from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.schemas import User, Ticket as TicketSchema, UserRoleUpdate
from app.models.models import Ticket
from app.api.auth import get_current_active_user, require_admin
from app.crud.crud import update_user_role, get_user

router = APIRouter()
ALLOWED_ROLES = {"guest", "user", "manager", "admin"}

@router.get("/me", response_model=User)
def read_users_me(current_user = Depends(get_current_active_user)):
    return current_user

@router.get("/me/tickets", response_model=List[TicketSchema])
def read_own_tickets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    tickets = db.query(Ticket).filter(Ticket.user_id == current_user.id).all()

    for ticket in tickets:
        if ticket.event:
            db.refresh(ticket.event)
    
    return tickets

@router.patch("/{user_id}/role", response_model=User)
def update_role(
    user_id: int,
    payload: UserRoleUpdate,
    db: Session = Depends(get_db),
    _: User = Depends(require_admin),
):
    if payload.role not in ALLOWED_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")

    target_user = get_user(db, user_id)
    if not target_user:
        raise HTTPException(status_code=404, detail="User not found")

    updated_user = update_user_role(db, user_id=user_id, role=payload.role)
    return updated_user