"""Tests for enrichment cap settings — Phase 21 D-10, D-11."""
import os
import pytest


def test_default_caps():
    """Settings load default cap values without env vars."""
    for key in [
        "COACHING_CAP_CONTENT_CARDS",
        "COACHING_CAP_INTERACTIVE_CARDS",
        "COACHING_CAP_EVIDENCE_ROWS",
        "COACHING_CAP_GOAL_PROGRESS",
        "TOOL_USAGE_GRANULARITY",
    ]:
        os.environ.pop(key, None)

    from app.core.config import get_settings
    s = get_settings()
    assert s.coaching_cap_content_cards == 2
    assert s.coaching_cap_interactive_cards == 1
    assert s.coaching_cap_evidence_rows == 5
    assert s.coaching_cap_goal_progress == 1
    assert s.tool_usage_granularity == "granular"


def test_custom_caps(monkeypatch):
    """Settings respect env var overrides for caps."""
    monkeypatch.setenv("COACHING_CAP_CONTENT_CARDS", "4")
    monkeypatch.setenv("TOOL_USAGE_GRANULARITY", "hidden")
    from app.core.config import get_settings
    s = get_settings()
    assert s.coaching_cap_content_cards == 4
    assert s.tool_usage_granularity == "hidden"
