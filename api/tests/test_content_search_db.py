"""Tests for DB-backed BM25 content search."""

import pytest

from app.content.search import (
    ContentIndex,
    ParsedQuery,
    _load_catalog_from_db,
    _load_catalog_from_json,
    parse_search_query,
    rebuild_index,
    search_content,
    suggest_content,
    get_all_tags,
)
from app.db.models import ContentItem
from app.db.session import SessionLocal
from slugify import slugify
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


# ── Search syntax parser unit tests ───────────────────────────────────────


def test_parse_tag_keyword():
    parsed = parse_search_query("budget tag:risparmio")
    assert parsed.free_text == "budget"
    assert parsed.tags == ["risparmio"]


def test_parse_multiple_tags():
    parsed = parse_search_query("tag:budget tag:risparmio guida")
    assert parsed.free_text == "guida"
    assert sorted(parsed.tags) == ["budget", "risparmio"]


def test_parse_type_keyword():
    parsed = parse_search_query("mutuo type:video")
    assert parsed.free_text == "mutuo"
    assert parsed.content_types == ["video"]


def test_parse_type_normalizes_dash():
    parsed = parse_search_query("type:slide-deck etf")
    assert parsed.free_text == "etf"
    assert parsed.content_types == ["slide_deck"]


def test_parse_invalid_type_ignored():
    parsed = parse_search_query("type:podcast budget")
    # "podcast" is not a valid type, so type: is stripped but not added
    assert parsed.free_text == "budget"
    assert parsed.content_types == []


def test_parse_date_from():
    parsed = parse_search_query("budget from:2026-01-15")
    assert parsed.free_text == "budget"
    assert parsed.date_from is not None
    assert parsed.date_from.isoformat() == "2026-01-15"
    assert parsed.date_to is None


def test_parse_date_to():
    parsed = parse_search_query("to:2026-03-31 risparmio")
    assert parsed.free_text == "risparmio"
    assert parsed.date_to is not None
    assert parsed.date_to.isoformat() == "2026-03-31"


def test_parse_date_range():
    parsed = parse_search_query("from:2026-01-01 to:2026-06-30 investimento")
    assert parsed.free_text == "investimento"
    assert parsed.date_from is not None
    assert parsed.date_to is not None


def test_parse_quoted_tag():
    parsed = parse_search_query('tag:"fondo emergenza" sicurezza')
    assert parsed.free_text == "sicurezza"
    assert parsed.tags == ["fondo emergenza"]


def test_parse_no_keywords():
    parsed = parse_search_query("come fare un budget familiare")
    assert parsed.free_text == "come fare un budget familiare"
    assert parsed.tags == []
    assert parsed.content_types == []
    assert parsed.date_from is None
    assert parsed.date_to is None


def test_parse_only_keywords_no_free_text():
    parsed = parse_search_query("tag:budget type:article")
    assert parsed.free_text == ""
    assert parsed.tags == ["budget"]
    assert parsed.content_types == ["article"]


def test_parse_bad_date_ignored():
    parsed = parse_search_query("from:not-a-date budget")
    assert parsed.free_text == "budget"
    assert parsed.date_from is None


# ── Search with syntax integration tests ──────────────────────────────────


def test_search_with_tag_filter(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    # "investimento" appears in ETF and Fineco items.  tag:ETF should narrow to ETF only.
    results = search_content("investimento tag:ETF", "it", top_k=10)
    assert len(results) > 0
    # All results must have the ETF topic (case-insensitive match)
    for r in results:
        item_topics = [t.lower() for t in r.get("topics", [])]
        assert "etf" in item_topics
    _reset_search_index()


def test_search_with_type_filter(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = search_content("casa type:video", "it", top_k=10)
    assert len(results) > 0
    assert all(r["type"] == "video" for r in results)
    _reset_search_index()


def test_search_only_structured_filters_no_free_text(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = search_content("tag:risparmio", "it", top_k=10)
    # Should return items matching the tag even without free text
    assert len(results) > 0
    for r in results:
        item_topics = [t.lower() for t in r.get("topics", [])]
        assert "risparmio" in item_topics
    _reset_search_index()


# ── Suggest tests ─────────────────────────────────────────────────────────


def test_suggest_returns_results(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = suggest_content("budget", "it")
    assert len(results) > 0
    assert all("id" in r and "title" in r and "type" in r for r in results)
    _reset_search_index()


def test_suggest_prefix_match(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = suggest_content("Mut", "it")
    assert len(results) > 0
    assert any("mutuo" in r["title"].lower() for r in results)
    _reset_search_index()


def test_suggest_empty_query(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS)
    results = suggest_content("", "it")
    assert results == []
    _reset_search_index()


def test_suggest_respects_locale(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS + _EN_CORPUS)
    results = suggest_content("budget", "en")
    assert len(results) > 0
    # All results should be English items (from EN corpus)
    result_ids = [r["id"] for r in results]
    assert all(rid.startswith("en-") for rid in result_ids)
    _reset_search_index()


# ── Tags tests ────────────────────────────────────────────────────────────


def test_get_all_tags_returns_tags(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS + _EN_CORPUS)
    tags = get_all_tags()
    assert len(tags) > 0
    assert "budget" in tags
    assert "risparmio" in tags
    _reset_search_index()


def test_get_all_tags_filtered_by_locale(client):
    _reset_search_index()
    _seed_items(_IT_CORPUS + _EN_CORPUS)
    it_tags = get_all_tags(locale="it")
    en_tags = get_all_tags(locale="en")
    # "savings" is only in EN corpus
    assert "savings" in en_tags
    assert "savings" not in it_tags
    # "risparmio" is only in IT corpus
    assert "risparmio" in it_tags
    assert "risparmio" not in en_tags
    _reset_search_index()
