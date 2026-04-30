def test_register_success(client):
    resp = client.post("/api/auth/register", json={
        "username": "newuser",
        "email": "new@test.com",
        "password": "secret123",
    })
    assert resp.status_code == 200
    data = resp.json()
    assert "access_token" in data
    assert "refresh_token" in data


def test_register_duplicate_username(client):
    payload = {"username": "dup", "email": "a@a.com", "password": "pass"}
    client.post("/api/auth/register", json=payload)
    resp = client.post("/api/auth/register", json={**payload, "email": "b@b.com"})
    assert resp.status_code == 400


def test_register_duplicate_email(client):
    client.post("/api/auth/register", json={"username": "u1", "email": "same@a.com", "password": "pass"})
    resp = client.post("/api/auth/register", json={"username": "u2", "email": "same@a.com", "password": "pass"})
    assert resp.status_code == 400


def test_login_success(client):
    client.post("/api/auth/register", json={"username": "lu", "email": "lu@t.com", "password": "pw"})
    resp = client.post("/api/auth/token", data={"username": "lu", "password": "pw"})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_login_wrong_password(client):
    client.post("/api/auth/register", json={"username": "lu2", "email": "lu2@t.com", "password": "correct"})
    resp = client.post("/api/auth/token", data={"username": "lu2", "password": "wrong"})
    assert resp.status_code == 401


def test_me_authenticated(client, user_token):
    access, _ = user_token
    resp = client.get("/api/auth/me", headers={"Authorization": f"Bearer {access}"})
    assert resp.status_code == 200
    assert resp.json()["username"] == "regular_user"


def test_me_unauthenticated(client):
    resp = client.get("/api/auth/me")
    assert resp.status_code == 401


def test_refresh_token(client, user_token):
    _, refresh = user_token
    resp = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 200
    assert "access_token" in resp.json()


def test_refresh_token_reuse_rejected(client, user_token):
    _, refresh = user_token
    client.post("/api/auth/refresh", json={"refresh_token": refresh})
    resp = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert resp.status_code == 401


def test_logout(client, user_token):
    access, refresh = user_token
    resp = client.post(
        "/api/auth/logout",
        json={"refresh_token": refresh},
        headers={"Authorization": f"Bearer {access}"},
    )
    assert resp.status_code == 200
    # after logout refresh token must be revoked
    resp2 = client.post("/api/auth/refresh", json={"refresh_token": refresh})
    assert resp2.status_code == 401
