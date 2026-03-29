"""
Integration tests for card reliability:
- search_content tool round-trip returns results
- CoachingService fallback injection provides cards when LLM returns empty arrays
- response_format prompt renders without error
"""

import json
import pytest
from unittest.mock import MagicMock
from pathlib import Path

from app.content.search import search_content, get_index


# ── BM25 search tests ─────────────────────────────────────────────────────────


def test_search_content_returns_results_for_budget_query():
    results = search_content("budget risparmio spese", "it", top_k=3)
    assert len(results) >= 1, "BM25 search must return at least one result for 'budget'"
    assert all("id" in r and "title" in r and "type" in r for r in results)


def test_search_content_returns_video_type():
    results = search_content(
        "video educazione finanziaria", "it", top_k=5, content_types=["video"]
    )
    assert any(r["type"] == "video" for r in results), "Should find at least one video"


def test_search_content_returns_partner_offer():
    results = search_content(
        "conto corrente banca", "it", top_k=3, content_types=["partner_offer"]
    )
    assert len(results) >= 1, "Should find at least one partner offer for banking query"


def test_search_content_locale_filter():
    it_results = search_content("risparmio", "it", top_k=10)
    en_results = search_content("savings", "en", top_k=10)
    it_locales = {r["locale"] for r in it_results}
    en_locales = {r["locale"] for r in en_results}
    assert it_locales <= {"it"}, "Italian search must not return English items"
    assert en_locales <= {"en"}, "English search must not return Italian items"


def test_search_content_slide_deck_returns_slide_id():
    results = search_content(
        "prestito tan taeg", "it", top_k=3, content_types=["slide_deck"]
    )
    # slides catalog has id field; check it comes through in results
    for r in results:
        assert "id" in r


# ── Fallback injection tests ──────────────────────────────────────────────────


def _make_coaching_service():
    """Build a CoachingService with a mocked LLM (no real LLM calls)."""
    from unittest.mock import MagicMock
    from app.coaching.service import CoachingService

    mock_db = MagicMock()
    mock_llm = MagicMock()
    return CoachingService(db=mock_db, llm_client=mock_llm)


def test_inject_fallback_cards_adds_resource_card_when_empty():
    svc = _make_coaching_service()
    data = {
        "message": "Con il tuo margine mensile di circa 300 euro potresti permetterti questo acquisto.",
        "reasoning_used": [{"step": "check", "detail": "ok"}],
        "action_cards": [],
        "resource_cards": [],
        "learn_cards": [],
        "affordability_verdict": {"verdict": "yes", "key_figures": []},
    }
    svc._inject_fallback_cards(data, "it")
    assert len(data["resource_cards"]) >= 1, (
        "Fallback must inject at least one resource card"
    )
    rc = data["resource_cards"][0]
    assert "title" in rc and "resource_type" in rc


def test_inject_fallback_cards_adds_action_card_when_empty():
    svc = _make_coaching_service()
    data = {
        "message": "Con il tuo margine mensile di circa 300 euro potresti permetterti questo acquisto.",
        "reasoning_used": [{"step": "check", "detail": "ok"}],
        "action_cards": [],
        "resource_cards": [],
        "learn_cards": [],
        "affordability_verdict": {"verdict": "yes", "key_figures": []},
    }
    svc._inject_fallback_cards(data, "it")
    assert len(data["action_cards"]) >= 1, (
        "Fallback must inject at least one action card"
    )
    ac = data["action_cards"][0]
    assert "title" in ac and "action_type" in ac


def test_inject_fallback_cards_skips_short_messages():
    svc = _make_coaching_service()
    data = {
        "message": "Ciao!",
        "reasoning_used": [],
        "action_cards": [],
        "resource_cards": [],
        "learn_cards": [],
    }
    svc._inject_fallback_cards(data, "it")
    # Short greeting (< 15 chars): no fallback injection
    assert data["action_cards"] == []
    assert data["resource_cards"] == []


def test_inject_fallback_cards_skips_when_no_verdict():
    """Conversational responses without affordability_verdict should not get cards."""
    svc = _make_coaching_service()
    data = {
        "message": "Un ETF è un fondo indicizzato negoziato in borsa, simile a un fondo comune.",
        "reasoning_used": [],
        "action_cards": [],
        "resource_cards": [],
        "learn_cards": [],
        # no affordability_verdict key
    }
    svc._inject_fallback_cards(data, "it")
    assert data["action_cards"] == []
    assert data["resource_cards"] == []


def test_inject_fallback_cards_skips_when_already_populated():
    svc = _make_coaching_service()
    existing_resource = {
        "title": "Existing",
        "summary": "ok",
        "resource_type": "article",
        "url": None,
    }
    existing_action = {
        "title": "Calc",
        "description": "desc",
        "action_type": "calculator",
    }
    data = {
        "message": "Con il tuo margine mensile di circa 300 euro potresti permetterti questo acquisto.",
        "reasoning_used": [{"step": "check", "detail": "ok"}],
        "action_cards": [existing_action],
        "resource_cards": [existing_resource],
        "learn_cards": [],
        "affordability_verdict": {"verdict": "yes", "key_figures": []},
    }
    svc._inject_fallback_cards(data, "it")
    assert len(data["resource_cards"]) == 1, "Must not add cards when already populated"
    assert data["resource_cards"][0] == existing_resource


# ── Prompt template renders without error ─────────────────────────────────────


def test_response_format_template_renders():
    from jinja2 import Environment, FileSystemLoader
    import json
    from pathlib import Path

    prompts_dir = Path(__file__).parent.parent / "app" / "coaching" / "prompts"
    schemas_dir = Path(__file__).parent.parent / "app" / "coaching" / "schemas"
    env = Environment(loader=FileSystemLoader(str(prompts_dir)))
    capabilities_path = schemas_dir / "capabilities.schema.json"
    capabilities = json.loads(capabilities_path.read_text())
    a2ui_ref = env.get_template("a2ui_reference.j2").render()
    rendered = env.get_template("response_format.j2").render(
        capabilities_json=json.dumps(capabilities, indent=2),
        a2ui_reference=a2ui_ref,
    )
    assert "search_content" in rendered
    assert "resource_cards" in rendered
    assert "action_cards" in rendered
    assert len(rendered) > 500


# ── Cross-catalog slide ID integrity ─────────────────────────────────────────


def test_slide_ids_in_slide_index():
    """
    All slide IDs in api/app/content/slides.json must have a matching key
    in senso/src/content/slideIndex.ts (cross-catalog integrity check).
    Any mismatch would cause ResourceCardRouter to fall through to ArticleCard.
    """
    import json
    from pathlib import Path
    import re

    slides_json_path = Path(__file__).parent.parent / "app" / "content" / "slides.json"
    slide_index_path = (
        Path(__file__).parent.parent.parent
        / "senso"
        / "src"
        / "content"
        / "slideIndex.ts"
    )

    if not slides_json_path.exists():
        pytest.skip("slides.json not found")
    if not slide_index_path.exists():
        pytest.skip("slideIndex.ts not found")

    slides = json.loads(slides_json_path.read_text())
    slide_index_content = slide_index_path.read_text()

    # Extract all IDs from slides.json
    catalog_ids = {s["id"] for s in slides}

    # Extract all keys from SLIDE_INDEX in slideIndex.ts (e.g., 'it-slide-budget-base': ...)
    index_keys = set(re.findall(r"['\"]([a-z0-9\-]+)['\"]:\s*\w+", slide_index_content))

    missing_in_index = catalog_ids - index_keys
    assert not missing_in_index, (
        f"These slide IDs exist in slides.json but are missing from slideIndex.ts: "
        f"{sorted(missing_in_index)}"
    )
