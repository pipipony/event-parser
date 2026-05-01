from pydantic import BaseModel
from typing import Optional, List, Dict, Any
from datetime import datetime, date

class UserBase(BaseModel):
    email: str
    username: str

class UserCreate(UserBase):
    password: str

class User(UserBase):
    id: int
    is_active: bool
    is_admin: bool = False
    role: str = "user"
    created_at: datetime

    class Config:
        from_attributes = True

class EventBase(BaseModel):
    title: str
    description: Optional[str] = None
    date: datetime
    time: Optional[str] = None
    location: str
    price: float = 0.0
    category: Optional[str] = None
    max_attendees: Optional[int] = None

class EventCreate(EventBase):
    pass

class EventUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    date: Optional[datetime] = None
    time: Optional[str] = None
    location: Optional[str] = None
    price: Optional[float] = None
    category: Optional[str] = None
    status: Optional[str] = None
    max_attendees: Optional[int] = None

class Event(EventBase):
    id: int
    current_attendees: int = 0
    status: str = "active"
    poster_url: Optional[str] = None
    created_by: int
    created_at: datetime

    class Config:
        from_attributes = True

class EventsPage(BaseModel):
    items: List[Event]
    total: int
    page: int
    page_size: int
    pages: int

class TicketBase(BaseModel):
    event_id: int
    user_id: int

class TicketCreate(TicketBase):
    pass

class Ticket(TicketBase):
    id: int
    qr_code_url: Optional[str] = None
    ticket_number: str
    status: str = "active"
    created_at: datetime
    event: Optional[Event] = None

    class Config:
        from_attributes = True

class Token(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str

class UserRoleUpdate(BaseModel):
    role: str

class RefreshTokenRequest(BaseModel):
    refresh_token: str

class ImageParseRequest(BaseModel):
    image_url: str
    use_llm: Optional[bool] = True

class ParsedEventData(BaseModel):
    title: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    location: Optional[str] = None
    price: Optional[str] = None
    description: Optional[str] = None
    raw_text: Optional[str] = None
    confidence: Optional[str] = None

class ImageParseResponse(BaseModel):
    success: bool
    data: ParsedEventData
    raw_text: Optional[str] = None
    confidence: str
    source: str
    llm_used: bool = False
    corrections: Optional[List[str]] = None
    error: Optional[str] = None

class EventCreateFromImage(BaseModel):
    parsed_data: ParsedEventData
    title: str
    date: datetime
    time: Optional[str] = None
    location: str
    price: float = 0.0
    description: Optional[str] = None
    max_attendees: Optional[int] = None
    category: Optional[str] = None