import pytest

EVENT_PAYLOAD = {
    "title": "Test Concert",
    "description": "Test description",
    "date": "2026-12-01T20:00:00",
    "location": "Moscow",
    "price": 500.0,
    "category": "Концерт",
    "max_attendees": 50,
}


def auth_header(token):
    return {"Authorization": f"Bearer {token}"}


def test_get_events_empty(client):
    resp = client.get("/api/events/")
    assert resp.status_code == 200
    data = resp.json()
    assert data["items"] == []
    assert data["total"] == 0


def test_create_event_requires_auth(client):
    resp = client.post("/api/events/", json=EVENT_PAYLOAD)
    assert resp.status_code == 401


def test_create_event_as_user(client, user_token):
    access, _ = user_token
    resp = client.post("/api/events/", json=EVENT_PAYLOAD, headers=auth_header(access))
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == EVENT_PAYLOAD["title"]
    assert data["status"] == "pending"


def test_get_events_pagination(client, user_token):
    access, _ = user_token
    for i in range(5):
        client.post("/api/events/", json={**EVENT_PAYLOAD, "title": f"Event {i}"}, headers=auth_header(access))

    resp = client.get("/api/events/?page=1&page_size=3")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 3
    assert data["total"] == 5
    assert data["pages"] == 2


def test_get_events_search(client, user_token):
    access, _ = user_token
    client.post("/api/events/", json={**EVENT_PAYLOAD, "title": "Jazz Night"}, headers=auth_header(access))
    client.post("/api/events/", json={**EVENT_PAYLOAD, "title": "Rock Show"}, headers=auth_header(access))

    resp = client.get("/api/events/?search=Jazz")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert len(items) == 1
    assert items[0]["title"] == "Jazz Night"


def test_get_events_filter_category(client, user_token):
    access, _ = user_token
    client.post("/api/events/", json={**EVENT_PAYLOAD, "category": "Театр"}, headers=auth_header(access))
    client.post("/api/events/", json={**EVENT_PAYLOAD, "category": "Концерт"}, headers=auth_header(access))

    resp = client.get("/api/events/?category=Театр")
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(e["category"] == "Театр" for e in items)


def test_get_events_sort_by_price(client, user_token):
    access, _ = user_token
    client.post("/api/events/", json={**EVENT_PAYLOAD, "price": 1000.0}, headers=auth_header(access))
    client.post("/api/events/", json={**EVENT_PAYLOAD, "price": 200.0}, headers=auth_header(access))
    client.post("/api/events/", json={**EVENT_PAYLOAD, "price": 500.0}, headers=auth_header(access))

    resp = client.get("/api/events/?sort_by=price&sort_order=asc")
    prices = [e["price"] for e in resp.json()["items"]]
    assert prices == sorted(prices)


def test_update_event_owner(client, user_token):
    access, _ = user_token
    create_resp = client.post("/api/events/", json=EVENT_PAYLOAD, headers=auth_header(access))
    event_id = create_resp.json()["id"]

    resp = client.put(f"/api/events/{event_id}", json={"title": "Updated"}, headers=auth_header(access))
    assert resp.status_code == 200
    assert resp.json()["title"] == "Updated"


def test_update_event_forbidden_for_other_user(client, user_token):
    access, _ = user_token
    create_resp = client.post("/api/events/", json=EVENT_PAYLOAD, headers=auth_header(access))
    event_id = create_resp.json()["id"]

    # Register a second user
    client.post("/api/auth/register", json={"username": "other", "email": "o@o.com", "password": "p"})
    login_resp = client.post("/api/auth/token", data={"username": "other", "password": "p"})
    other_token = login_resp.json()["access_token"]

    resp = client.put(f"/api/events/{event_id}", json={"title": "Hack"}, headers=auth_header(other_token))
    assert resp.status_code == 403


def test_delete_event_owner(client, user_token):
    access, _ = user_token
    create_resp = client.post("/api/events/", json=EVENT_PAYLOAD, headers=auth_header(access))
    event_id = create_resp.json()["id"]

    resp = client.delete(f"/api/events/{event_id}", headers=auth_header(access))
    assert resp.status_code == 200

    get_resp = client.get(f"/api/events/{event_id}")
    assert get_resp.status_code == 404


def test_delete_event_forbidden_for_other_user(client, user_token):
    access, _ = user_token
    create_resp = client.post("/api/events/", json=EVENT_PAYLOAD, headers=auth_header(access))
    event_id = create_resp.json()["id"]

    client.post("/api/auth/register", json={"username": "hacker", "email": "h@h.com", "password": "p"})
    login_resp = client.post("/api/auth/token", data={"username": "hacker", "password": "p"})
    hacker_token = login_resp.json()["access_token"]

    resp = client.delete(f"/api/events/{event_id}", headers=auth_header(hacker_token))
    assert resp.status_code == 403


def test_admin_can_delete_any_event(client, user_token, admin_token):
    access, _ = user_token
    create_resp = client.post("/api/events/", json=EVENT_PAYLOAD, headers=auth_header(access))
    event_id = create_resp.json()["id"]

    admin_access, _ = admin_token
    resp = client.delete(f"/api/events/{event_id}", headers=auth_header(admin_access))
    assert resp.status_code == 200


def test_admin_update_role(client, admin_token):
    client.post("/api/auth/register", json={"username": "target", "email": "t@t.com", "password": "p"})
    login_resp = client.post("/api/auth/token", data={"username": "target", "password": "p"})
    user_id_resp = client.get("/api/auth/me", headers=auth_header(login_resp.json()["access_token"]))
    user_id = user_id_resp.json()["id"]

    admin_access, _ = admin_token
    resp = client.patch(
        f"/api/users/{user_id}/role",
        json={"role": "manager"},
        headers=auth_header(admin_access),
    )
    assert resp.status_code == 200
    assert resp.json()["role"] == "manager"


def test_non_admin_cannot_update_role(client, user_token):
    access, _ = user_token
    resp = client.patch("/api/users/1/role", json={"role": "admin"}, headers=auth_header(access))
    assert resp.status_code == 403
