from fastapi import FastAPI, Query
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles
from fastapi.responses import PlainTextResponse, JSONResponse
import os
import json
from datetime import datetime
from dotenv import load_dotenv
from sqlalchemy import text

load_dotenv()

from app.database import engine, SessionLocal
from app.models.models import Base, User, Event
from app.crud.crud import get_user_by_username
from passlib.context import CryptContext
from app.api import ai_parser

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

Base.metadata.create_all(bind=engine)

FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000")


def ensure_role_column():
    db = SessionLocal()
    try:
        columns = db.execute(text("PRAGMA table_info(users)")).fetchall()
        column_names = {column[1] for column in columns}
        if "role" not in column_names:
            db.execute(text("ALTER TABLE users ADD COLUMN role VARCHAR DEFAULT 'user' NOT NULL"))
            db.commit()
    finally:
        db.close()


def ensure_poster_url_column():
    db = SessionLocal()
    try:
        columns = db.execute(text("PRAGMA table_info(events)")).fetchall()
        column_names = {column[1] for column in columns}
        if "poster_url" not in column_names:
            db.execute(text("ALTER TABLE events ADD COLUMN poster_url VARCHAR"))
            db.commit()
    finally:
        db.close()


def create_superuser():
    db = SessionLocal()
    try:
        admin_user = get_user_by_username(db, "admin")
        if not admin_user:
            hashed_password = pwd_context.hash("admin")
            admin_user = User(
                username="admin",
                email="admin@afisha.ru",
                hashed_password=hashed_password,
                is_active=True,
                role="admin",
            )
            db.add(admin_user)
            db.commit()
            print("✅ Суперпользователь admin создан")
        else:
            if getattr(admin_user, "role", "user") != "admin":
                admin_user.role = "admin"
                db.commit()
            print("✅ Суперпользователь admin уже существует")
    except Exception as e:
        print(f"❌ Ошибка создания суперпользователя: {e}")
    finally:
        db.close()


ensure_role_column()
ensure_poster_url_column()
create_superuser()

from app.api.auth import router as auth_router
from app.api.users import router as users_router
from app.api.events import router as events_router
from app.api.tickets import router as tickets_router
from app.api.ai_parser import router as ai_parser_router

app = FastAPI(
    title="Event Parser API",
    description="API для парсера афиш и событий с AI модулем",
    version="1.0.0",
    docs_url="/docs",
    redoc_url="/redoc",
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.makedirs("static/qr_codes", exist_ok=True)
os.makedirs("static/posters", exist_ok=True)
app.mount("/static", StaticFiles(directory="static"), name="static")

app.include_router(ai_parser.router, prefix="/api/ai")
app.include_router(auth_router, prefix="/api/auth", tags=["auth"])
app.include_router(users_router, prefix="/api/users", tags=["users"])
app.include_router(events_router, prefix="/api/events", tags=["events"])
app.include_router(tickets_router, prefix="/api/tickets", tags=["tickets"])
app.include_router(ai_parser_router, prefix="/api/ai", tags=["ai"])


@app.get("/")
async def root():
    return {"message": "Event Parser API", "version": "1.0.0"}


@app.get("/health")
async def health_check():
    return {"status": "healthy", "service": "event-parser-backend"}


@app.get("/api/status")
async def api_status():
    return {"status": "API is running"}


# ── SEO ──────────────────────────────────────────────────────────────────────

@app.get("/robots.txt", response_class=PlainTextResponse, include_in_schema=False)
async def robots_txt():
    return (
        "User-agent: *\n"
        "Allow: /\n"
        f"Sitemap: {FRONTEND_URL}/sitemap.xml\n"
        "\n"
        "Disallow: /docs\n"
        "Disallow: /redoc\n"
        "Disallow: /api/auth/\n"
        "Disallow: /admin\n"
        "Disallow: /profile\n"
    )


@app.get("/sitemap.xml", response_class=PlainTextResponse, include_in_schema=False)
async def sitemap_xml():
    db = SessionLocal()
    try:
        events = db.query(Event).filter(Event.status == "approved").all()
        now = datetime.utcnow().strftime("%Y-%m-%d")
        urls = [
            f"""  <url>
    <loc>{FRONTEND_URL}/</loc>
    <lastmod>{now}</lastmod>
    <changefreq>daily</changefreq>
    <priority>1.0</priority>
  </url>""",
        ]
        for event in events:
            mod = event.created_at.strftime("%Y-%m-%d") if event.created_at else now
            urls.append(
                f"""  <url>
    <loc>{FRONTEND_URL}/events/{event.id}</loc>
    <lastmod>{mod}</lastmod>
    <changefreq>weekly</changefreq>
    <priority>0.8</priority>
  </url>"""
            )
        sitemap = (
            '<?xml version="1.0" encoding="UTF-8"?>\n'
            '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n'
            + "\n".join(urls)
            + "\n</urlset>"
        )
        return PlainTextResponse(sitemap, media_type="application/xml")
    finally:
        db.close()


@app.get("/api/events/{event_id}/json-ld")
async def event_json_ld(event_id: int):
    db = SessionLocal()
    try:
        event = db.query(Event).filter(Event.id == event_id).first()
        if not event:
            from fastapi import HTTPException
            raise HTTPException(status_code=404, detail="Event not found")
        ld = {
            "@context": "https://schema.org",
            "@type": "Event",
            "name": event.title,
            "description": event.description or "",
            "startDate": event.date.isoformat() if event.date else None,
            "location": {
                "@type": "Place",
                "name": event.location,
            },
            "offers": {
                "@type": "Offer",
                "price": event.price,
                "priceCurrency": "RUB",
                "availability": (
                    "https://schema.org/InStock"
                    if not event.max_attendees or event.current_attendees < event.max_attendees
                    else "https://schema.org/SoldOut"
                ),
            },
            "organizer": {
                "@type": "Organization",
                "name": "aFISHa",
                "url": FRONTEND_URL,
            },
            "image": event.poster_url or "",
            "url": f"{FRONTEND_URL}/events/{event.id}",
        }
        return JSONResponse(ld)
    finally:
        db.close()


@app.get("/api/weather")
async def get_weather(city: str = Query(..., description="Название города")):
    from app.services.weather_service import get_weather as fetch_weather
    data = fetch_weather(city)
    if data is None:
        return JSONResponse(
            {"error": "Не удалось получить данные о погоде. Проверьте название города."},
            status_code=503,
        )
    return data
