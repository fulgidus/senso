"""
Envelope migration tests — Phase 15 (task 15-03-01)

Tests for v1 (AES-GCM + PBKDF2) → v2 (secretbox + Argon2id) migration.
"""
import os
from app.db.nacl_crypto import (
    generate_nacl_master_key,
    derive_nacl_login_wrap_key,
    wrap_nacl_master_key,
    encrypt_nacl_private_key,
    detect_envelope_version,
    wrap_nacl_master_key_v2,
    unwrap_nacl_master_key_v2,
    derive_argon2id_wrap_key,
    rewrap_all_envelopes,
    encrypt_nacl_private_key_v2,
    decrypt_nacl_private_key_v2,
)

PASSWORD = "test-password-for-migration"
SALT = os.urandom(32)


def make_v1_envelopes():
    master_key = generate_nacl_master_key()
    v1_wrap_key = derive_nacl_login_wrap_key(PASSWORD, SALT)
    login_env = wrap_nacl_master_key(master_key, v1_wrap_key)
    x25519_env = encrypt_nacl_private_key(os.urandom(32), master_key)
    ed25519_env = encrypt_nacl_private_key(os.urandom(32), master_key)
    return master_key, login_env, x25519_env, ed25519_env


def test_detect_v1_envelope():
    master_key = generate_nacl_master_key()
    v1_wrap_key = derive_nacl_login_wrap_key(PASSWORD, SALT)
    login_env = wrap_nacl_master_key(master_key, v1_wrap_key)
    assert detect_envelope_version(login_env) == "v1"


def test_detect_v2_envelope():
    master_key = generate_nacl_master_key()
    v2_wrap_key = derive_argon2id_wrap_key(PASSWORD, SALT)
    login_env = wrap_nacl_master_key_v2(master_key, v2_wrap_key)
    assert detect_envelope_version(login_env) == "v2"
    assert login_env.startswith("v2:")


def test_v2_wrap_unwrap_roundtrip():
    master_key = generate_nacl_master_key()
    v2_wrap_key = derive_argon2id_wrap_key(PASSWORD, SALT)
    envelope = wrap_nacl_master_key_v2(master_key, v2_wrap_key)
    recovered = unwrap_nacl_master_key_v2(envelope, v2_wrap_key)
    assert recovered == master_key


def test_rewrap_all_envelopes_v1_to_v2():
    original_master, login_env, x25519_env, ed25519_env = make_v1_envelopes()

    result = rewrap_all_envelopes(
        password=PASSWORD,
        nacl_pbkdf2_salt=SALT,
        nacl_key_login_envelope_b64=login_env,
        encrypted_x25519_private_b64=x25519_env,
        encrypted_ed25519_signing_b64=ed25519_env,
        nacl_key_recovery_envelope_b64=None,
        recovery_phrase=None,
    )

    assert result["nacl_key_login_envelope_b64"].startswith("v2:")
    assert result["encrypted_x25519_private_b64"].startswith("v2:")
    assert result["encrypted_ed25519_signing_b64"].startswith("v2:")

    # Verify new envelopes decrypt correctly
    v2_wrap_key = derive_argon2id_wrap_key(PASSWORD, SALT)
    recovered_master = unwrap_nacl_master_key_v2(result["nacl_key_login_envelope_b64"], v2_wrap_key)
    assert recovered_master == original_master
