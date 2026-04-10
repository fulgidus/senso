"""
Phase 27 — Admin username enforcement regression tests.

Tests:
  1. test_admin_signup_username       — Admin signup produces $adj-noun-N, not !admin (D-09)
  2. test_username_backfill           — _add_missing_columns backfills NULL and !admin usernames (D-10)
  3. test_claim_handle_validation     — Format rules + reserved handle rejection via claim-handle (D-12)
  4. test_claim_handle_uniqueness     — 409 on duplicate handle claim (D-12)
"""

import pytest
from fastapi.testclient import TestClient

from app.main import app


# ──────────────────────────────────────────────────────────────────────────────
# Helpers
# ──────────────────────────────────────────────────────────────────────────────

def _signup(client: TestClient, email: str, password: str = "Password123!"):
    return client.post("/auth/signup", json={"email": email, "password": password})


def _login_token(client: TestClient, email: str, password: str = "Password123!") -> str:
    resp = client.post("/auth/login", json={"email": email, "password": password})
    assert resp.status_code == 200, resp.text
    return resp.json()["accessToken"]


# ──────────────────────────────────────────────────────────────────────────────
# 1. Admin signup username (D-09)
# ──────────────────────────────────────────────────────────────────────────────

class TestAdminSignupUsername:
    """Admin signup must produce a $adj-noun-N username, not !admin."""

    def test_admin_signup_username(self, client, monkeypatch):
        """Admin signup yields a $-prefixed username (not !admin)."""
        from app.core.config import get_settings
        settings = get_settings()
        # Use an email that will be treated as admin
        admin_email = next(iter(settings.starting_admins), None)
        if admin_email is None:
            pytest.skip("No STARTING_ADMINS configured in test environment")

        resp = _signup(client, admin_email)
        assert resp.status_code == 201, resp.text
        user = resp.json()["user"]
        username = user.get("username", "")
        assert username.startswith("$"), (
            f"Admin username should start with '$', got: {username!r}"
        )
        assert username != "!admin", (
            "Admin username must not be the legacy !admin value"
        )


# ──────────────────────────────────────────────────────────────────────────────
# 2. Username backfill (D-10)
# ──────────────────────────────────────────────────────────────────────────────

class TestUsernameBackfill:
    """_add_missing_columns Round 22 must backfill NULL and !admin usernames."""

    def test_username_backfill_null(self, reset_db):
        """Users with username IS NULL receive a $adj-noun-N after backfill."""
        from app.db.models import User
        from app.db.session import SessionLocal, _add_missing_columns
        from uuid import uuid4

        db = SessionLocal()
        try:
            # Insert a user with username=None directly (bypass normal signup)
            u = User(
                id=str(uuid4()),
                email="backfill-null@test.com",
                password_hash="x",
                is_admin=True,
                role="admin",
                username=None,
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            assert u.username is None

            # Run backfill
            _add_missing_columns()

            db.expire(u)
            db.refresh(u)
            assert u.username is not None
            assert u.username.startswith("$"), (
                f"Backfilled username should start with '$', got: {u.username!r}"
            )
        finally:
            db.close()

    def test_username_backfill_admin_legacy(self, reset_db):
        """Users with username='!admin' receive a new $adj-noun-N after backfill."""
        from app.db.models import User
        from app.db.session import SessionLocal, _add_missing_columns
        from uuid import uuid4

        db = SessionLocal()
        try:
            u = User(
                id=str(uuid4()),
                email="legacy-admin@test.com",
                password_hash="x",
                is_admin=True,
                role="admin",
                username="!admin",
            )
            db.add(u)
            db.commit()
            db.refresh(u)
            assert u.username == "!admin"

            _add_missing_columns()

            db.expire(u)
            db.refresh(u)
            assert u.username != "!admin", (
                "Legacy !admin username must be replaced by backfill"
            )
            assert u.username.startswith("$"), (
                f"Backfilled username should start with '$', got: {u.username!r}"
            )
        finally:
            db.close()


# ──────────────────────────────────────────────────────────────────────────────
# 3. Claim-handle validation (D-12)
# ──────────────────────────────────────────────────────────────────────────────

class TestClaimHandleValidation:
    """POST /admin/claim-handle must reject invalid and reserved handles."""

    def _admin_client_token(self, client: TestClient) -> str:
        """Sign up or login an admin and return the access token."""
        from app.core.config import get_settings
        settings = get_settings()
        admin_email = next(iter(settings.starting_admins), None)
        if admin_email is None:
            pytest.skip("No STARTING_ADMINS configured in test environment")
        resp = _signup(client, admin_email)
        if resp.status_code not in (200, 201):
            # Already exists — just login
            pass
        return _login_token(client, admin_email)

    def test_reserved_handle_admin(self, client):
        """!admin handle must be rejected with 422."""
        token = self._admin_client_token(client)
        resp = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!admin"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for reserved !admin handle, got {resp.status_code}: {resp.text}"
        )

    def test_reserved_handle_sistema(self, client):
        """!sistema handle must be rejected with 422."""
        token = self._admin_client_token(client)
        resp = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!sistema"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for reserved !sistema handle, got {resp.status_code}: {resp.text}"
        )

    def test_uppercase_handle_rejected(self, client):
        """Handles with uppercase letters must be rejected with 422."""
        token = self._admin_client_token(client)
        resp = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!MyHandle"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for uppercase handle, got {resp.status_code}: {resp.text}"
        )

    def test_handle_with_spaces_rejected(self, client):
        """Handles with spaces must be rejected with 422."""
        token = self._admin_client_token(client)
        resp = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!my handle"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for handle with spaces, got {resp.status_code}: {resp.text}"
        )

    def test_too_short_handle_rejected(self, client):
        """Handle body shorter than 3 chars (e.g. !ab) must be rejected with 422."""
        token = self._admin_client_token(client)
        resp = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!ab"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 422, (
            f"Expected 422 for too-short handle, got {resp.status_code}: {resp.text}"
        )

    def test_valid_handle_accepted(self, client):
        """A valid lowercase handle must be accepted with 200."""
        token = self._admin_client_token(client)
        resp = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!valid-handle"},
            headers={"Authorization": f"Bearer {token}"},
        )
        assert resp.status_code == 200, (
            f"Expected 200 for valid handle, got {resp.status_code}: {resp.text}"
        )
        assert resp.json()["adminHandle"] == "!valid-handle"


# ──────────────────────────────────────────────────────────────────────────────
# 4. Claim-handle uniqueness (D-12)
# ──────────────────────────────────────────────────────────────────────────────

class TestClaimHandleUniqueness:
    """Claiming the same handle twice must return 409 on the second attempt."""

    def test_duplicate_handle_returns_409(self, client):
        """Second claim of same handle → 409 Conflict."""
        from app.core.config import get_settings
        settings = get_settings()
        admin_emails = list(settings.starting_admins)
        if len(admin_emails) < 2:
            pytest.skip("Need at least 2 STARTING_ADMINS to test uniqueness")

        # First admin claims the handle
        _signup(client, admin_emails[0])
        token1 = _login_token(client, admin_emails[0])
        resp1 = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!unique-handle"},
            headers={"Authorization": f"Bearer {token1}"},
        )
        assert resp1.status_code == 200, resp1.text

        # Second admin tries to claim same handle
        _signup(client, admin_emails[1])
        token2 = _login_token(client, admin_emails[1])
        resp2 = client.post(
            "/admin/claim-handle",
            json={"adminHandle": "!unique-handle"},
            headers={"Authorization": f"Bearer {token2}"},
        )
        assert resp2.status_code == 409, (
            f"Expected 409 for duplicate handle, got {resp2.status_code}: {resp2.text}"
        )
