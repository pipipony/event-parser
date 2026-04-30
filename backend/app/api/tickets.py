from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List

from app.database import get_db
from app.schemas.schemas import Ticket, TicketCreate
from app.crud.crud import create_ticket, get_user_tickets
from app.services.services import generate_qr_code
from app.api.auth import get_current_active_user, require_permission

router = APIRouter()

@router.post("/", response_model=Ticket)
def create_new_ticket(
    ticket: TicketCreate,
    db: Session = Depends(get_db),
    current_user = Depends(require_permission("tickets:create"))
):
    """
    POST /api/tickets - Создать билет
    """
    if ticket.user_id != current_user.id and getattr(current_user, "role", "user") != "admin":
        raise HTTPException(status_code=403, detail="Cannot create ticket for another user")
    qr_data = f"event:{ticket.event_id},user:{ticket.user_id}"
    qr_code_url = generate_qr_code(qr_data)
    
    db_ticket = create_ticket(db=db, ticket=ticket, qr_code_url=qr_code_url)
    if db_ticket is None:
        raise HTTPException(status_code=400, detail="No available seats or event not found")
    
    return db_ticket

@router.get("/my-tickets", response_model=List[Ticket])
def get_my_tickets(
    db: Session = Depends(get_db),
    current_user = Depends(get_current_active_user)
):
    """
    GET /api/tickets/my-tickets - Получить билеты текущего пользователя с информацией о событиях
    """
    tickets = get_user_tickets(db, current_user.id)
    
    # Загружаем связанные данные событий
    for ticket in tickets:
        if ticket.event:
            db.refresh(ticket.event)
    
    return tickets