from sqlalchemy.orm import Session
from sqlalchemy import or_
import bcrypt
import random
import string
import math
from datetime import datetime
from typing import Optional

from app.models.models import User, Event, Ticket, RefreshToken
from app.schemas.schemas import UserCreate, EventCreate, EventUpdate, TicketCreate

def _hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

def _verify_password(plain: str, hashed: str) -> bool:
    return bcrypt.checkpw(plain.encode(), hashed.encode())

def get_user_by_email(db: Session, email: str):
    return db.query(User).filter(User.email == email).first()

def get_user_by_username(db: Session, username: str):
    return db.query(User).filter(User.username == username).first()

def create_user(db: Session, user: UserCreate):
    hashed_password = _hash_password(user.password)
    db_user = User(
        email=user.email,
        username=user.username,
        hashed_password=hashed_password,
        role="user",
    )
    db.add(db_user)
    db.commit()
    db.refresh(db_user)
    return db_user

def authenticate_user(db: Session, username: str, password: str):
    user = get_user_by_username(db, username)
    if not user:
        return False
    if not _verify_password(password, user.hashed_password):
        return False
    return user

def get_events(
    db: Session,
    skip: int = 0,
    limit: int = 10,
    search: Optional[str] = None,
    category: Optional[str] = None,
    date_from: Optional[datetime] = None,
    date_to: Optional[datetime] = None,
    sort_by: str = "date",
    sort_order: str = "asc",
    status: Optional[str] = None,
):
    query = db.query(Event)
    if search:
        query = query.filter(
            or_(Event.title.ilike(f"%{search}%"), Event.description.ilike(f"%{search}%"))
        )
    if category:
        query = query.filter(Event.category == category)
    if date_from:
        query = query.filter(Event.date >= date_from)
    if date_to:
        query = query.filter(Event.date <= date_to)
    if status:
        query = query.filter(Event.status == status)

    total = query.count()

    allowed_sort = {"date", "price", "title"}
    sort_column = getattr(Event, sort_by if sort_by in allowed_sort else "date")
    query = query.order_by(sort_column.desc() if sort_order == "desc" else sort_column.asc())

    return total, query.offset(skip).limit(limit).all()

def get_event(db: Session, event_id: int):
    return db.query(Event).filter(Event.id == event_id).first()

def create_event(db: Session, event: EventCreate, user_id: int):

    event_data = event.dict()

    if isinstance(event_data.get('date'), str):
        try:
            date_str = event_data['date']
            if 'T' in date_str:
                event_data['date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                event_data['date'] = datetime.strptime(date_str, '%Y-%m-%d')
        except (ValueError, TypeError) as e:
            event_data['date'] = datetime.now()
            print(f"⚠️ Ошибка парсинга даты: {e}, используем текущую дату")

    allowed_fields = {
        'title', 'description', 'date', 'time', 'location', 
        'price', 'category', 'max_attendees'
    }
    filtered_data = {k: v for k, v in event_data.items() if k in allowed_fields}

    print(f"🔧 Создание события пользователем {user_id}")
    print(f"📋 Данные события: {filtered_data}")

    try:
        db_event = Event(
            **filtered_data,
            created_by=user_id,
            status='pending'
        )
        
        db.add(db_event)
        db.commit()
        db.refresh(db_event)
        print(f"✅ Событие успешно создано с ID: {db_event.id}")
        return db_event
    except Exception as e:
        db.rollback()
        print(f"❌ Ошибка при создании события: {e}")
        print(f"📋 Тип ошибки: {type(e).__name__}")
        raise

def update_event(db: Session, event_id: int, event_update: EventUpdate):
    db_event = get_event(db, event_id)
    if not db_event:
        return None

    update_data = event_update.dict(exclude_unset=True)

    if 'date' in update_data and isinstance(update_data['date'], str):
        try:
            date_str = update_data['date']
            if 'T' in date_str:
                update_data['date'] = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            else:
                update_data['date'] = datetime.strptime(date_str, '%Y-%m-%d')
        except (ValueError, TypeError) as e:
            print(f"⚠️ Ошибка парсинга даты при обновлении: {e}")
            del update_data['date']

    for field, value in update_data.items():
        if hasattr(db_event, field):
            setattr(db_event, field, value)
    
    db.commit()
    db.refresh(db_event)
    return db_event

def delete_event(db: Session, event_id: int):
    db_event = get_event(db, event_id)
    if db_event:
        db.delete(db_event)
        db.commit()
        return True
    return False

def moderate_event(db: Session, event_id: int, status: str, moderator_id: int):
    db_event = get_event(db, event_id)
    if not db_event:
        return None
    
    db_event.status = status
    db.commit()
    db.refresh(db_event)
    return db_event

def generate_ticket_number():
    return ''.join(random.choices(string.ascii_uppercase + string.digits, k=10))

def create_ticket(db: Session, ticket: TicketCreate, qr_code_url: str = None):
    event = get_event(db, ticket.event_id)
    if not event:
        return None

    if event.max_attendees and event.current_attendees >= event.max_attendees:
        return None
    
    ticket_number = generate_ticket_number()

    db_ticket = Ticket(
        event_id=ticket.event_id,
        user_id=ticket.user_id,
        ticket_number=ticket_number,
        qr_code_url=qr_code_url or f"/qr_codes/{ticket_number}.png"
    )

    event.current_attendees += 1
    
    db.add(db_ticket)
    db.commit()
    db.refresh(db_ticket)
    return db_ticket

def get_user_tickets(db: Session, user_id: int):
    return db.query(Ticket).filter(Ticket.user_id == user_id).all()

def get_ticket_by_number(db: Session, ticket_number: str):
    return db.query(Ticket).filter(Ticket.ticket_number == ticket_number).first()

def get_ticket(db: Session, ticket_id: int):
    return db.query(Ticket).filter(Ticket.id == ticket_id).first()

def delete_ticket(db: Session, ticket_id: int):
    db_ticket = get_ticket(db, ticket_id)
    if db_ticket:
        event = get_event(db, db_ticket.event_id)
        if event and event.current_attendees > 0:
            event.current_attendees -= 1
        
        db.delete(db_ticket)
        db.commit()
        return True
    return False

def get_all_users(db: Session, skip: int = 0, limit: int = 100):
    return db.query(User).offset(skip).limit(limit).all()

def get_user(db: Session, user_id: int):
    return db.query(User).filter(User.id == user_id).first()

def update_user_admin_status(db: Session, user_id: int, is_admin: bool):
    user = get_user(db, user_id)
    if user:
        user.role = "admin" if is_admin else "user"
        db.commit()
        db.refresh(user)
        return user
    return None

def update_user_role(db: Session, user_id: int, role: str):
    user = get_user(db, user_id)
    if user:
        user.role = role
        db.commit()
        db.refresh(user)
        return user
    return None

def get_all_tickets(db: Session, skip: int = 0, limit: int = 100):
    return db.query(Ticket).offset(skip).limit(limit).all()

def create_refresh_token_record(db: Session, user_id: int, token_jti: str, expires_at: datetime):
    record = RefreshToken(user_id=user_id, token_jti=token_jti, expires_at=expires_at, revoked=False)
    db.add(record)
    db.commit()
    db.refresh(record)
    return record

def get_refresh_token_record(db: Session, token_jti: str):
    return db.query(RefreshToken).filter(RefreshToken.token_jti == token_jti).first()

def revoke_refresh_token(db: Session, token_jti: str):
    record = get_refresh_token_record(db, token_jti=token_jti)
    if not record:
        return None
    record.revoked = True
    db.commit()
    db.refresh(record)
    return record

def revoke_all_user_refresh_tokens(db: Session, user_id: int):
    db.query(RefreshToken).filter(
        RefreshToken.user_id == user_id,
        RefreshToken.revoked == False,
    ).update({"revoked": True}, synchronize_session=False)
    db.commit()