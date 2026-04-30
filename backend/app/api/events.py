import math
from fastapi import APIRouter, Depends, HTTPException, Query, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
from datetime import datetime

from app.database import get_db
from app.schemas.schemas import Event, EventCreate, EventUpdate, EventsPage
from app.crud.crud import get_events, get_event, create_event, update_event, moderate_event
from app.api.auth import get_current_active_user, require_permission
from app.services.storage_service import (
    upload_file, get_file_url, delete_file, ALLOWED_TYPES, MAX_FILE_SIZE
)

router = APIRouter()


@router.get("/", response_model=EventsPage)
def read_events(
    page: int = Query(1, ge=1, description="Номер страницы"),
    page_size: int = Query(10, ge=1, le=100, description="Элементов на странице"),
    search: Optional[str] = Query(None, description="Поиск по названию и описанию"),
    category: Optional[str] = Query(None, description="Фильтр по категории"),
    date_from: Optional[datetime] = Query(None, description="Дата от (ISO 8601)"),
    date_to: Optional[datetime] = Query(None, description="Дата до (ISO 8601)"),
    sort_by: str = Query("date", description="Поле сортировки: date, price, title"),
    sort_order: str = Query("asc", description="Направление: asc, desc"),
    status: Optional[str] = Query(None, description="Фильтр по статусу"),
    db: Session = Depends(get_db),
):
    skip = (page - 1) * page_size
    total, events = get_events(
        db,
        skip=skip,
        limit=page_size,
        search=search,
        category=category,
        date_from=date_from,
        date_to=date_to,
        sort_by=sort_by,
        sort_order=sort_order,
        status=status,
    )
    pages = math.ceil(total / page_size) if total > 0 else 0
    return EventsPage(items=events, total=total, page=page, page_size=page_size, pages=pages)


@router.post("/", response_model=Event)
def create_new_event(
    event: EventCreate,
    db: Session = Depends(get_db),
    current_user=Depends(require_permission("events:create")),
):
    return create_event(db=db, event=event, user_id=current_user.id)


@router.get("/{event_id}", response_model=Event)
def read_event(event_id: int, db: Session = Depends(get_db)):
    db_event = get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    return db_event


@router.put("/{event_id}", response_model=Event)
def update_existing_event(
    event_id: int,
    event_update: EventUpdate,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    db_event = get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    user_role = getattr(current_user, "role", "user")
    if db_event.created_by != current_user.id and user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    return update_event(db, event_id=event_id, event_update=event_update)


@router.delete("/{event_id}")
def delete_event(
    event_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    db_event = get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    user_role = getattr(current_user, "role", "user")
    if db_event.created_by != current_user.id and user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=403, detail="Not enough permissions")
    if db_event.poster_url:
        delete_file(db_event.poster_url)
    db.delete(db_event)
    db.commit()
    return {"message": "Event deleted successfully"}


@router.post("/{event_id}/poster", response_model=Event)
async def upload_event_poster(
    event_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    db_event = get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    user_role = getattr(current_user, "role", "user")
    if db_event.created_by != current_user.id and user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if file.content_type not in ALLOWED_TYPES:
        raise HTTPException(status_code=400, detail="Недопустимый тип файла. Разрешены: jpeg, png, webp, gif")

    content = await file.read()
    if len(content) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="Файл слишком большой (максимум 10 МБ)")

    if db_event.poster_url:
        delete_file(db_event.poster_url)

    poster_url = upload_file(content, file.content_type, file.filename)
    db_event.poster_url = poster_url
    db.commit()
    db.refresh(db_event)
    return db_event


@router.delete("/{event_id}/poster", response_model=Event)
def delete_event_poster(
    event_id: int,
    db: Session = Depends(get_db),
    current_user=Depends(get_current_active_user),
):
    db_event = get_event(db, event_id=event_id)
    if db_event is None:
        raise HTTPException(status_code=404, detail="Event not found")
    user_role = getattr(current_user, "role", "user")
    if db_event.created_by != current_user.id and user_role not in {"manager", "admin"}:
        raise HTTPException(status_code=403, detail="Not enough permissions")

    if db_event.poster_url:
        delete_file(db_event.poster_url)
        db_event.poster_url = None
        db.commit()
        db.refresh(db_event)
    return db_event
