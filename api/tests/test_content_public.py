"""Tests for public (no auth) content API endpoints."""

import pytest

from app.db.models import ContentItem
from app.db.session import SessionLocal
from slugify import slugify
import app.content.search as search_module


# ── Helpers ─────────────────────────────────────────────────────────────────


# A realistic corpus for BM25 (5 IT + 2 EN avoids negative IDF for discriminative terms)
_IT_ITEMS = [
    {
        "id": "it-budget-guida",
        "locale": "it",
        "type": "article",
        "title": "Come fare un budget",
        "summary": "Guida pratica al budget familiare e risparmio mensile",
        "topics": ["budget", "risparmio"],
    },
    {
        "id": "it-fondo-emergenza",
        "locale": "it",
        "type": "article",
        "title": "Il fondo di emergenza",
        "summary": "Perche avere un fondo di emergenza finanziaria",
        "topics": ["fondo emergenza"],
    },
    {
        "id": "it-video-mutuo",
        "locale": "it",
        "type": "video",
        "title": "Mutuo casa guida completa",
        "summary": "Come scegliere il mutuo giusto per la prima casa",
        "topics": ["mutuo", "casa"],
    },
    {
        "id": "it-slide-etf",
        "locale": "it",
        "type": "slide_deck",
        "title": "ETF investire semplice",
        "summary": "Introduzione agli ETF per principianti",
        "topics": ["ETF", "investimento"],
    },
    {
        "id": "it-partner-fineco",
        "locale": "it",
        "type": "partner_offer",
        "title": "Conto Fineco zero canone",
        "summary": "Conto corrente e investimento integrato",
        "topics": ["conto corrente"],
    },
]

_EN_ITEMS = [
    {
        "id": "en-budget-basics",
        "locale": "en",
        "type": "article",
        "title": "How to build a budget",
        "summary": "A practical guide to budgeting your monthly income",
        "topics": ["budget", "savings"],
    },
    {
        "id": "en-emergency-fund",
        "locale": "en",
        "type": "article",
        "title": "Emergency fund guide",
        "summary": "Why you need an emergency fund and how to build one",
        "topics": ["emergency fund"],
    },
]


def _seed_items(items: list[dict]) -> None:
    """Seed content items into the DB."""
    db = SessionLocal()
    try:
        for entry in items:
            item_id = entry["id"]
            item = ContentItem(
                id=item_id,
                slug=entry.get("slug") or slugify(item_id) or item_id,
                locale=entry.get("locale", "it"),
                type=entry.get("type", "article"),
                title=entry.get("title", "Test"),
                summary=entry.get("summary", ""),
                topics=entry.get("topics", []),
                metadata_=entry.get("metadata", {}),
                is_published=entry.get("is_published", True),
            )
            db.add(item)
        db.commit()
    finally:
        db.close()


def _reset_search_index() -> None:
    """Reset the singleton index so tests get a fresh index."""
    search_module._index = None


# ── Tests ──────────────────────────────────────────────────────────────────


def test_list_public_items_no_auth_required(client):
    """GET /content/items returns 200 without any auth header."""
    _reset_search_index()
    _seed_items(_IT_ITEMS)
    resp = client.get("/content/items?locale=it")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 5
    _reset_search_index()


def test_list_public_items_filters_by_locale(client):
    """locale filter returns only items of that locale."""
    _reset_search_index()
    _seed_items(_IT_ITEMS + _EN_ITEMS)
    resp = client.get("/content/items?locale=en")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert all(item["locale"] == "en" for item in data["items"])
    _reset_search_index()


def test_list_public_items_filters_by_type(client):
    """type filter returns only items of that type."""
    _reset_search_index()
    _seed_items(_IT_ITEMS)
    resp = client.get("/content/items?locale=it&type=video")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 1
    assert data["items"][0]["type"] == "video"
    _reset_search_index()


def test_list_public_items_pagination(client):
    """page and page_size params work."""
    _reset_search_index()
    _seed_items(_IT_ITEMS)
    resp = client.get("/content/items?locale=it&page=1&page_size=2")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data["items"]) == 2
    assert data["total"] == 5
    assert data["page"] == 1
    assert data["page_size"] == 2
    assert data["total_pages"] == 3

    resp2 = client.get("/content/items?locale=it&page=2&page_size=2")
    data2 = resp2.json()
    assert len(data2["items"]) == 2

    # Third page should have just 1
    resp3 = client.get("/content/items?locale=it&page=3&page_size=2")
    data3 = resp3.json()
    assert len(data3["items"]) == 1

    # Pages should not overlap
    ids_p1 = {item["id"] for item in data["items"]}
    ids_p2 = {item["id"] for item in data2["items"]}
    assert ids_p1.isdisjoint(ids_p2)
    _reset_search_index()


def test_list_public_items_hides_unpublished(client):
    """Unpublished items are not returned in public list."""
    _reset_search_index()
    _seed_items(_IT_ITEMS)
    _seed_items(
        [
            {
                "id": "it-hidden-article",
                "locale": "it",
                "type": "article",
                "title": "Hidden article",
                "summary": "Should not appear",
                "topics": [],
                "is_published": False,
            }
        ]
    )
    resp = client.get("/content/items?locale=it")
    assert resp.status_code == 200
    data = resp.json()
    ids = [item["id"] for item in data["items"]]
    assert "it-hidden-article" not in ids
    _reset_search_index()


def test_get_public_item_by_id(client):
    """GET /content/items/{id} returns correct item."""
    _reset_search_index()
    _seed_items(_IT_ITEMS)
    resp = client.get("/content/items/it-budget-guida")
    assert resp.status_code == 200
    data = resp.json()
    assert data["id"] == "it-budget-guida"
    assert data["title"] == "Come fare un budget"
    _reset_search_index()


def test_get_public_item_unpublished_404(client):
    """Unpublished item returns 404 on public endpoint."""
    _reset_search_index()
    _seed_items(
        [
            {
                "id": "it-hidden-item",
                "locale": "it",
                "type": "article",
                "title": "Hidden",
                "summary": "Not visible",
                "topics": [],
                "is_published": False,
            }
        ]
    )
    resp = client.get("/content/items/it-hidden-item")
    assert resp.status_code == 404
    _reset_search_index()


def test_get_public_item_not_found_404(client):
    """Nonexistent item returns 404."""
    resp = client.get("/content/items/nonexistent-id")
    assert resp.status_code == 404


def test_search_public_content(client):
    """GET /content/search returns BM25 results for a query."""
    _reset_search_index()
    _seed_items(_IT_ITEMS)
    resp = client.get("/content/search?q=budget&locale=it")
    assert resp.status_code == 200
    data = resp.json()
    assert len(data) > 0
    assert any(item["id"] == "it-budget-guida" for item in data)
    assert all("score" in item for item in data)
    _reset_search_index()


def test_search_requires_query(client):
    """GET /content/search without q returns 422."""
    resp = client.get("/content/search?locale=it")
    assert resp.status_code == 422
