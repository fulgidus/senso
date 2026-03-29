"""Tests for DB-backed BM25 content search."""

import pytest

from app.content.search import (
    ContentIndex,
    _load_catalog_from_db,
    _load_catalog_from_json,
    rebuild_index,
    search_content,
)
from app.db.models import ContentItem
from app.db.session import SessionLocal
import app.content.search as search_module


# ── Helpers ─────────────────────────────────────────────────────────────────


# A realistic mini-corpus so BM25 IDF scores remain positive
_IT_CORPUS = [
    {
        "id": "it-budget-base",
        "locale": "it",
        "type": "article",
        "title": "Come fare un budget",
        "summary": "Guida al budget familiare e risparmio mensile",
        "topics": ["budget", "risparmio"],
    },
    {
        "id": "it-fondo-emergenza",
        "locale": "it",
        "type": "article",
        "title": "Il fondo di emergenza",
        "summary": "Perche avere un fondo di emergenza per la sicurezza finanziaria",
        "topics": ["fondo emergenza", "risparmio"],
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
        "topics": ["conto corrente", "investimento"],
    },
]

_EN_CORPUS = [
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
        "topics": ["emergency fund", "savings"],
    },
]


def _seed_items(items: list[dict]) -> None:
    """Seed content items into the DB."""
    db = SessionLocal()
    try:
        for entry in items:
            item = ContentItem(
                id=entry["id"],
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


def test_db_backed_search_returns_results(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = search_content("budget", "it")
    assert len(results) > 0
    assert any(r["id"] == "it-budget-base" for r in results)
    _reset_search_index()


def test_unpublished_items_excluded(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    # Add an unpublished item
    _seed_items(
        [
            {
                "id": "it-hidden-budget",
                "locale": "it",
                "type": "article",
                "title": "Budget nascosto segreto",
                "summary": "Articolo nascosto sul budget segreto",
                "topics": ["budget"],
                "is_published": False,
            },
        ]
    )
    results = search_content("nascosto segreto", "it")
    result_ids = [r["id"] for r in results]
    assert "it-hidden-budget" not in result_ids
    _reset_search_index()


def test_rebuild_index_picks_up_new_items(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    # Build index with initial items
    results = search_content("budget", "it")
    assert len(results) > 0

    # Add a new unique item
    _seed_items(
        [
            {
                "id": "it-new-risparmio-unico",
                "locale": "it",
                "type": "article",
                "title": "Articolo completamente unico sul risparmio automatico",
                "summary": "Metodo automatico unico per risparmiare ogni mese senza pensarci",
                "topics": ["risparmio automatico"],
            },
        ]
    )

    # After rebuild, new item should be findable
    rebuild_index()
    results_after = search_content("automatico unico", "it")
    assert len(results_after) > 0
    assert any(r["id"] == "it-new-risparmio-unico" for r in results_after)
    _reset_search_index()


def test_search_filters_by_locale(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS + _EN_CORPUS)
    it_results = search_content("budget", "it")
    en_results = search_content("budget", "en")
    it_ids = [r["id"] for r in it_results]
    en_ids = [r["id"] for r in en_results]
    # Italian results should not contain English items
    assert all(not rid.startswith("en-") for rid in it_ids)
    # English results should not contain Italian items
    assert all(not rid.startswith("it-") for rid in en_ids)
    _reset_search_index()


def test_search_filters_by_content_type(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = search_content("investimento", "it", content_types=["partner_offer"])
    assert all(r["type"] == "partner_offer" for r in results)
    _reset_search_index()


def test_fallback_to_json_when_db_empty(client):
    _reset_search_index()
    # DB is empty after reset_db fixture, so should fall back to JSON
    json_items = _load_catalog_from_json()
    if json_items:
        idx = ContentIndex()
        assert idx.total_items > 0
    _reset_search_index()
