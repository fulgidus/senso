"""Integration tests — Phase 13 crypto identity fields at signup."""
import base64
import re
import pytest
from fastapi.testclient import TestClient

from app.main import app


@pytest.fixture
def client():
    with TestClient(app) as c:
        yield c


def _signup(client, email: str, pw: str = "test-ph13-pw"):
    return client.post("/auth/signup", json={"email": email, "password": pw})


# ── Username ───────────────────────────────────────────────────────────────────

def test_signup_returns_username(client):
    resp = _signup(client, "p13_user1@example.com")
    assert resp.status_code in (200, 201)
    username = resp.json()["user"]["username"]
    assert username is not None
    assert username.startswith("$"), f"Expected $ prefix, got: {username}"
    assert re.match(r"^\$[a-z]+-[a-z]+-\d+$", username), f"Bad format: {username}"


def test_signup_returns_public_keys(client):
    resp = _signup(client, "p13_user2@example.com")
    assert resp.status_code in (200, 201)
    user = resp.json()["user"]
    pk = user.get("publicKeyB64") or user.get("public_key_b64")
    sk = user.get("signingKeyB64") or user.get("signing_key_b64")
    assert pk is not None and len(pk) > 0, "X25519 public key missing"
    assert sk is not None and len(sk) > 0, "Ed25519 verify key missing"


def test_private_key_blobs_in_dto(client):
    """Phase 15: Encrypted private key blobs ARE returned in UserDTO so the
    client can perform client-side decryption. The blobs are only decryptable
    by the user with their password — safe to return to the authenticated user."""
    resp = _signup(client, "p13_user3@example.com")
    assert resp.status_code in (200, 201)
    user = resp.json()["user"]
    # These fields must now be present (Phase 15 client-side crypto requirement)
    assert user.get("nacl_key_login_envelope_b64") is not None
    assert user.get("encrypted_x25519_private_b64") is not None
    assert user.get("encrypted_ed25519_signing_b64") is not None


def test_login_returns_identity_fields(client):
    email = "p13_login@example.com"
    _signup(client, email)
    resp = client.post("/auth/login", json={"email": email, "password": "test-ph13-pw"})
    assert resp.status_code in (200, 201)
    user = resp.json()["user"]
    assert user["username"] is not None


def test_me_endpoint_returns_username(client):
    email = "p13_me@example.com"
    signup_resp = _signup(client, email)
    token = signup_resp.json()["accessToken"]
    resp = client.get("/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert resp.status_code in (200, 201)
    data = resp.json()
    # /auth/me returns {"user": {...}} or just the UserDTO directly
    user_data = data.get("user", data)
    assert user_data["username"] is not None


# ── DB column verification ─────────────────────────────────────────────────────

def test_all_7_columns_populated_after_signup(client):
    """All 7 Phase 13 DB columns must be non-null after signup."""
    from sqlalchemy.orm import Session
    from app.db.session import SessionLocal
    from app.db.models import User

    resp = _signup(client, "p13_dbcheck@example.com")
    assert resp.status_code in (200, 201)
    user_id = resp.json()["user"]["id"]

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()
        assert user is not None
        assert user.username is not None, "username is None"
        assert user.public_key_b64 is not None, "public_key_b64 is None"
        assert user.signing_key_b64 is not None, "signing_key_b64 is None"
        assert user.nacl_pbkdf2_salt is not None, "nacl_pbkdf2_salt is None"
        assert user.nacl_key_login_envelope_b64 is not None, "nacl_key_login_envelope_b64 is None"
        assert user.encrypted_x25519_private_b64 is not None, "encrypted_x25519_private_b64 is None"
        assert user.encrypted_ed25519_signing_b64 is not None, "encrypted_ed25519_signing_b64 is None"
    finally:
        db.close()


# ── Key recovery roundtrip ─────────────────────────────────────────────────────

def test_private_key_recovery_via_login_envelope(client):
    """Simulate login key recovery: PBKDF2(pw, salt) → unwrap master → decrypt private keys."""
    from sqlalchemy.orm import Session
    from app.db.session import SessionLocal
    from app.db.models import User
    from app.db.nacl_crypto import (
        derive_nacl_login_wrap_key,
        unwrap_nacl_master_key,
        decrypt_nacl_private_key,
    )

    test_pw = "test-ph13-pw"
    resp = _signup(client, "p13_recovery@example.com", pw=test_pw)
    assert resp.status_code in (200, 201)
    user_id = resp.json()["user"]["id"]

    db: Session = SessionLocal()
    try:
        user = db.query(User).filter(User.id == user_id).first()

        nacl_salt = base64.b64decode(user.nacl_pbkdf2_salt)
        wrap_key = derive_nacl_login_wrap_key(test_pw, nacl_salt)
        master_key = unwrap_nacl_master_key(user.nacl_key_login_envelope_b64, wrap_key)

        x25519_sk_bytes = decrypt_nacl_private_key(user.encrypted_x25519_private_b64, master_key)
        ed25519_sk_bytes = decrypt_nacl_private_key(user.encrypted_ed25519_signing_b64, master_key)

        assert len(x25519_sk_bytes) == 32, f"X25519 private key: expected 32 bytes, got {len(x25519_sk_bytes)}"
        assert len(ed25519_sk_bytes) == 32, f"Ed25519 signing key: expected 32 bytes, got {len(ed25519_sk_bytes)}"
    finally:
        db.close()
