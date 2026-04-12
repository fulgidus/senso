"""Tests for api/app/db/crypto.py wrapped-key helpers."""

import base64
import os
import pytest
from app.db.crypto import (
    derive_key_from_password,
    generate_user_data_key,
    wrap_user_key,
    unwrap_user_key,
    server_wrap_user_key,
)


def test_generate_user_data_key_length():
    key = generate_user_data_key()
    assert len(key) == 32


def test_wrap_unwrap_roundtrip():
    user_data_key = generate_user_data_key()
    salt = os.urandom(32)
    derived = derive_key_from_password("correct-password", salt)
    wrapped = wrap_user_key(user_data_key, derived)
    # Should be valid base64
    raw = base64.b64decode(wrapped)
    assert len(raw) == 12 + 32 + 16  # nonce + key + GCM tag
    # Unwrap with correct key
    recovered = unwrap_user_key(wrapped, derived)
    assert recovered == user_data_key


def test_unwrap_wrong_key_raises():
    from cryptography.exceptions import InvalidTag

    user_data_key = generate_user_data_key()
    salt = os.urandom(32)
    derived = derive_key_from_password("correct-password", salt)
    wrapped = wrap_user_key(user_data_key, derived)
    wrong_derived = derive_key_from_password("wrong-password", salt)
    with pytest.raises(InvalidTag):
        unwrap_user_key(wrapped, wrong_derived)


def test_server_wrap_returns_b64_strings(monkeypatch):
    monkeypatch.setenv("ENCRYPTION_KEY", "x" * 32)
    monkeypatch.setenv("JWT_SECRET", "test-jwt-secret-for-testing-only!")
    enc_key, salt_b64 = server_wrap_user_key("test-user-id-123")
    # Both should be decodable base64
    assert len(base64.b64decode(enc_key)) == 60  # 12+32+16
    assert len(base64.b64decode(salt_b64)) == 32
