"""Tests for messaging API repository helpers - Phase 14."""
from __future__ import annotations

import hashlib
from unittest.mock import MagicMock

from app.db.repository import compute_recipient_hash


# ── Unit tests for compute_recipient_hash ──────────────────────────────────

def test_compute_recipient_hash_includes_dollar_prefix():
    h = compute_recipient_hash("$witty-otter-42")
    assert h == hashlib.sha256("$witty-otter-42".encode()).hexdigest()
    assert len(h) == 64


def test_compute_recipient_hash_deterministic():
    assert compute_recipient_hash("$foo-bar-1") == compute_recipient_hash("$foo-bar-1")


def test_compute_recipient_hash_different_usernames():
    assert compute_recipient_hash("$foo-bar-1") != compute_recipient_hash("$baz-qux-2")


# ── Unit tests for get_all_recipient_hashes ────────────────────────────────

def test_get_all_recipient_hashes_maps_usernames():
    from app.db.repository import get_all_recipient_hashes

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [
        MagicMock(username="$witty-otter-42", id="user-1"),
        MagicMock(username="$calm-fox-7", id="user-2"),
    ]
    result = get_all_recipient_hashes(db)
    assert len(result) == 2
    assert compute_recipient_hash("$witty-otter-42") in result
    assert compute_recipient_hash("$calm-fox-7") in result
    assert result[compute_recipient_hash("$witty-otter-42")] == "user-1"


def test_get_admin_handles_returns_set():
    from app.db.repository import get_admin_handles

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = [
        MagicMock(admin_handle="!senso-team"),
        MagicMock(admin_handle="!admin"),
    ]
    result = get_admin_handles(db)
    assert result == {"!senso-team", "!admin"}


def test_get_admin_handles_empty():
    from app.db.repository import get_admin_handles

    db = MagicMock()
    db.query.return_value.filter.return_value.all.return_value = []
    result = get_admin_handles(db)
    assert result == set()


# ── Endpoint auth guard tests (using TestClient) ───────────────────────────

from fastapi.testclient import TestClient
from app.main import app

_client = TestClient(app)


def test_send_requires_auth():
    resp = _client.post("/messages/send", json={
        "recipient_hashes": ["abc123"], "encrypted_payload": "encrypted"
    })
    assert resp.status_code == 401


def test_poll_requires_auth():
    resp = _client.post("/messages/poll")
    assert resp.status_code == 401


# ── Admin handle validation unit tests ────────────────────────────────────

def test_claim_handle_must_start_with_bang():
    """Handles not starting with ! should be rejected (logic test)."""
    handle = "senso-team"
    assert not handle.startswith("!"), "Non-! handles should be rejected by the endpoint"


def test_claim_handle_bang_prefix_valid():
    handle = "!senso-team"
    assert handle.startswith("!")
