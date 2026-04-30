import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

from app.database import Base, get_db
from app.main import app

TEST_DB_URL = "sqlite:///./test.db"

engine = create_engine(TEST_DB_URL, connect_args={"check_same_thread": False})
TestingSessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)


def override_get_db():
    db = TestingSessionLocal()
    try:
        yield db
    finally:
        db.close()


@pytest.fixture(scope="function", autouse=True)
def setup_db():
    Base.metadata.create_all(bind=engine)
    yield
    Base.metadata.drop_all(bind=engine)


@pytest.fixture(scope="function")
def client(setup_db):
    app.dependency_overrides[get_db] = override_get_db
    with TestClient(app) as c:
        yield c
    app.dependency_overrides.clear()


@pytest.fixture
def admin_token(client):
    client.post("/api/auth/register", json={
        "username": "admin_test",
        "email": "admin_test@test.com",
        "password": "adminpass123",
    })
    resp = client.post("/api/auth/token", data={
        "username": "admin_test",
        "password": "adminpass123",
    })
    tokens = resp.json()
    # promote to admin directly in db
    db = TestingSessionLocal()
    from app.models.models import User
    user = db.query(User).filter(User.username == "admin_test").first()
    user.role = "admin"
    db.commit()
    db.close()
    return tokens["access_token"], tokens["refresh_token"]


@pytest.fixture
def user_token(client):
    resp = client.post("/api/auth/register", json={
        "username": "regular_user",
        "email": "user@test.com",
        "password": "userpass123",
    })
    tokens = resp.json()
    return tokens["access_token"], tokens["refresh_token"]
