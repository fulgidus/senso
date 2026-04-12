"""Tests for username_generator.py Phase 13."""
import re
import pytest
from unittest.mock import MagicMock

from app.services.username_generator import (
    generate_username,
    generate_admin_username,
    is_admin_username,
    is_user_username,
    ADJECTIVES,
    NOUNS,
)


def _mock_db_no_collision():
    """Return a mock DB session where no username exists (no collision)."""
    db = MagicMock()
    db.query.return_value.filter.return_value.first.return_value = None
    return db


def test_generate_username_format():
    username = generate_username(_mock_db_no_collision())
    assert re.match(r"^\$[a-z]+-[a-z]+-\d{2,4}$", username), f"Bad format: {username}"


def test_generate_username_dollar_prefix():
    assert generate_username(_mock_db_no_collision()).startswith("$")


def test_generate_username_uniqueness():
    """Probabilistic: 20 independent draws should almost always be unique."""
    usernames = {generate_username(_mock_db_no_collision()) for _ in range(20)}
    assert len(usernames) >= 15  # p(collision) < 1e-6 per pair in 40×40×9990 space


def test_generate_admin_username():
    assert generate_admin_username() == "!admin"


def test_is_admin_username_true():
    assert is_admin_username("!admin") is True
    assert is_admin_username("!moderator") is True


def test_is_admin_username_false():
    assert is_admin_username("$witty-otter-42") is False


def test_is_user_username():
    assert is_user_username("$witty-otter-42") is True
    assert is_user_username("!admin") is False


def test_word_lists_size():
    assert len(ADJECTIVES) >= 20
    assert len(NOUNS) >= 20
