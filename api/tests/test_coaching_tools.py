"""
Phase 20: Integration tests for coaching tool registration and dispatch.

These tests verify that:
1. All 7 tool definitions are syntactically valid
2. The tool executor dispatches correctly
3. Tool names in the tools list match executor handlers
"""
from __future__ import annotations

import pytest

from app.coaching.service import (
    _SEARCH_CONTENT_TOOL,
    _SEARCH_REGIONAL_KNOWLEDGE_TOOL,
    _GET_TIMELINE_TOOL,
    _GET_USER_PROFILE_TOOL,
    _SEARCH_USER_TRANSACTIONS_TOOL,
    _GET_USER_PREFERENCES_TOOL,
    _RECALL_INSIGHTS_TOOL,
)


# ── Tool registration tests ────────────────────────────────────────────────────

ALL_TOOLS = [
    _SEARCH_CONTENT_TOOL,
    _SEARCH_REGIONAL_KNOWLEDGE_TOOL,
    _GET_TIMELINE_TOOL,
    _GET_USER_PROFILE_TOOL,
    _SEARCH_USER_TRANSACTIONS_TOOL,
    _GET_USER_PREFERENCES_TOOL,
    _RECALL_INSIGHTS_TOOL,
]


@pytest.mark.parametrize("tool", ALL_TOOLS, ids=[t["function"]["name"] for t in ALL_TOOLS])
def test_tool_schema_valid(tool):
    """Each tool definition has the required OpenAI function-calling fields."""
    assert tool["type"] == "function"
    fn = tool["function"]
    assert "name" in fn
    assert "description" in fn
    assert "parameters" in fn
    params = fn["parameters"]
    assert params["type"] == "object"
    assert "additionalProperties" in params
    assert params["additionalProperties"] is False


def test_all_seven_tools_registered():
    """Exactly 7 tools are defined."""
    assert len(ALL_TOOLS) == 7


TOOL_NAMES = {t["function"]["name"] for t in ALL_TOOLS}
EXPECTED_NAMES = {
    "search_content",
    "search_regional_knowledge",
    "get_timeline_events",
    "get_user_profile",
    "search_user_transactions",
    "get_user_preferences",
    "recall_past_insights",
}


def test_expected_tool_names_match():
    """Tool names match the expected set — no renames or missing tools."""
    assert TOOL_NAMES == EXPECTED_NAMES


# ── Tool executor dispatch tests ────────────────────────────────────────────────

def test_get_user_profile_returns_dict_without_user(reset_db):
    """get_user_profile with no user_id returns empty dict."""
    from app.coaching.service import CoachingService
    from app.db.session import SessionLocal
    from unittest.mock import MagicMock

    db = SessionLocal()
    try:
        svc = CoachingService(db=db, llm_client=MagicMock())
        executor = svc._tool_executor(locale="it", nationalities=["IT"], user_id=None)
        result = executor("get_user_profile", {})
        assert result == {}
    finally:
        db.close()


def test_search_user_transactions_returns_list_without_user(reset_db):
    """search_user_transactions with no user_id returns empty list."""
    from app.coaching.service import CoachingService
    from app.db.session import SessionLocal
    from unittest.mock import MagicMock

    db = SessionLocal()
    try:
        svc = CoachingService(db=db, llm_client=MagicMock())
        executor = svc._tool_executor(locale="it", nationalities=["IT"], user_id=None)
        result = executor("search_user_transactions", {"query": "cibo"})
        assert result == []
    finally:
        db.close()


def test_get_user_preferences_returns_defaults_without_user(reset_db):
    """get_user_preferences with no user_id returns empty arrays."""
    from app.coaching.service import CoachingService
    from app.db.session import SessionLocal
    from unittest.mock import MagicMock

    db = SessionLocal()
    try:
        svc = CoachingService(db=db, llm_client=MagicMock())
        executor = svc._tool_executor(locale="it", nationalities=["IT"], user_id=None)
        result = executor("get_user_preferences", {})
        assert result == {"goals": [], "dos": [], "donts": []}
    finally:
        db.close()


def test_recall_past_insights_returns_list_without_user(reset_db):
    """recall_past_insights with no user_id returns empty list."""
    from app.coaching.service import CoachingService
    from app.db.session import SessionLocal
    from unittest.mock import MagicMock

    db = SessionLocal()
    try:
        svc = CoachingService(db=db, llm_client=MagicMock())
        executor = svc._tool_executor(locale="it", nationalities=["IT"], user_id=None)
        result = executor("recall_past_insights", {"topic": "risparmio"})
        assert result == []
    finally:
        db.close()


def test_unknown_tool_raises_valueerror(reset_db):
    """Unknown tool name raises ValueError."""
    from app.coaching.service import CoachingService
    from app.db.session import SessionLocal
    from unittest.mock import MagicMock

    db = SessionLocal()
    try:
        svc = CoachingService(db=db, llm_client=MagicMock())
        executor = svc._tool_executor(locale="it", nationalities=["IT"], user_id=None)
        with pytest.raises(ValueError, match="Unknown tool"):
            executor("nonexistent_tool", {})
    finally:
        db.close()
