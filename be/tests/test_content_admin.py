"""Integration tests for admin content CRUD API endpoints."""

import re
import pytest
from fastapi.testclient import TestClient

from app.db.models import ContentItem, User
from app.db.session import SessionLocal
from app.core.security import hash_password
from slugify import slugify

_UUID_RE = re.compile(
    r"^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$", re.IGNORECASE
)


# ── Helpers ─────────────────────────────────────────────────────────────────


def _register_and_login(client: TestClient, email: str = "admin@example.com") -> str:
    """Register a user and login, return access token."""
    client.post("/auth/signup", json={"email": email, "password": "Test1234!"})
    resp = client.post("/auth/login", json={"email": email, "password": "Test1234!"})
    assert resp.status_code == 200, f"Login failed: {resp.json()}"
    return resp.json()["accessToken"]


def _make_admin(email: str = "admin@example.com") -> None:
    """Promote a user to admin by directly updating the DB."""
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.email == email).first()
        if user:
            user.is_admin = True
            db.commit()
    finally:
        db.close()


def _admin_headers(client: TestClient, email: str = "admin@example.com") -> dict:
    """Register, login, promote to admin, return Authorization headers."""
    token = _register_and_login(client, email)
    _make_admin(email)
    return {"authorization": f"Bearer {token}"}


def _seed_item(
    item_id: str = "it-test-article",
    locale: str = "it",
    content_type: str = "article",
    published: bool = True,
) -> None:
    """Seed a single content item directly into DB."""
    db = SessionLocal()
    try:
        title = f"Test {content_type}"
        item = ContentItem(
            id=item_id,
            slug=slugify(item_id) or item_id,
            locale=locale,
            type=content_type,
            title=title,
            summary=f"Summary for {item_id}",
            topics=["test"],
            metadata_={"url": "https://example.com"},
            is_published=published,
        )
        db.add(item)
        db.commit()
    finally:
        db.close()


# ── Tests ──────────────────────────────────────────────────────────────────


def test_list_items_returns_seeded_content(client):
    headers = _admin_headers(client)
    _seed_item("it-test-1", locale="it", content_type="article")
    _seed_item("it-test-2", locale="it", content_type="video")

    resp = client.get("/admin/content/items", headers=headers)
    assert resp.status_code == 200
    data = resp.json()
    items = data["items"]
    assert len(items) >= 2
    ids = [i["id"] for i in items]
    assert "it-test-1" in ids
    assert "it-test-2" in ids


def test_list_items_filter_by_type(client):
    headers = _admin_headers(client)
    _seed_item("it-art-1", content_type="article")
    _seed_item("it-vid-1", content_type="video")

    resp = client.get("/admin/content/items?type=article", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(i["type"] == "article" for i in items)


def test_list_items_filter_by_locale(client):
    headers = _admin_headers(client)
    _seed_item("it-item-1", locale="it")
    _seed_item("en-item-1", locale="en")

    resp = client.get("/admin/content/items?locale=it", headers=headers)
    assert resp.status_code == 200
    items = resp.json()["items"]
    assert all(i["locale"] == "it" for i in items)


def test_create_item(client):
    headers = _admin_headers(client)
    body = {
        "slug": "nuovo-articolo",
        "locale": "it",
        "type": "article",
        "title": "Nuovo articolo",
        "summary": "Un riassunto",
        "topics": ["test", "nuovo"],
        "metadata": {"url": "https://example.com/clear", "estimated_read_minutes": 3},
    }
    resp = client.post("/admin/content/items", headers=headers, json=body)
    assert resp.status_code == 201
    data = resp.json()
    assert _UUID_RE.match(data["id"]), f"Expected UUID id, got: {data['id']}"
    assert data["slug"] == "nuovo-articolo"
    assert data["locale"] == "it"
    assert data["type"] == "article"
    assert data["title"] == "Nuovo articolo"
    assert data["metadata"]["url"] == "https://example.com/clear"


def test_create_duplicate_slug_409(client):
    headers = _admin_headers(client)
    _seed_item("existing-item")
    body = {
        "slug": "existing-item",  # same slug as seeded item → 409
        "locale": "it",
        "type": "article",
        "title": "Duplicate slug",
    }
    resp = client.post("/admin/content/items", headers=headers, json=body)
    assert resp.status_code == 409


def test_get_item_by_id(client):
    headers = _admin_headers(client)
    _seed_item("it-get-me")
    resp = client.get("/admin/content/items/it-get-me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["id"] == "it-get-me"


def test_get_item_not_found_404(client):
    headers = _admin_headers(client)
    resp = client.get("/admin/content/items/nonexistent", headers=headers)
    assert resp.status_code == 404


def test_update_item(client):
    headers = _admin_headers(client)
    _seed_item("it-update-me")
    body = {"title": "Updated Title", "topics": ["updated"]}
    resp = client.put("/admin/content/items/it-update-me", headers=headers, json=body)
    assert resp.status_code == 200
    data = resp.json()
    assert data["title"] == "Updated Title"
    assert data["topics"] == ["updated"]


def test_delete_item(client):
    headers = _admin_headers(client)
    _seed_item("it-delete-me")
    resp = client.delete("/admin/content/items/it-delete-me", headers=headers)
    assert resp.status_code == 200
    assert resp.json()["deleted"] is True
    # Confirm it's gone
    resp2 = client.get("/admin/content/items/it-delete-me", headers=headers)
    assert resp2.status_code == 404


def test_delete_item_not_found_404(client):
    headers = _admin_headers(client)
    resp = client.delete("/admin/content/items/nonexistent", headers=headers)
    assert resp.status_code == 404


def test_non_admin_forbidden(client):
    """A non-admin user should get 403 on admin content endpoints."""
    token = _register_and_login(client, "user@example.com")
    headers = {"authorization": f"Bearer {token}"}
    resp = client.get("/admin/content/items", headers=headers)
    assert resp.status_code == 403
