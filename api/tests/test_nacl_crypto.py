"""Tests for nacl_crypto.py Phase 13 — key pairs, master-key envelope, private-key encryption."""
import base64
import os
import pytest
import nacl.public
import nacl.signing

from app.db.nacl_crypto import (
    # Key pairs
    generate_x25519_keypair,
    generate_ed25519_keypair,
    generate_admin_signing_keypair,
    public_key_b64,
    private_key_b64,
    verify_key_b64,
    signing_key_b64,
    sign_message,
    verify_signature,
    # Master key + envelope
    generate_nacl_master_key,
    derive_nacl_login_wrap_key,
    wrap_nacl_master_key,
    unwrap_nacl_master_key,
    # Private key encryption
    encrypt_nacl_private_key,
    decrypt_nacl_private_key,
)


# ── X25519 key pair ────────────────────────────────────────────────────────────

def test_x25519_keypair_lengths():
    sk, pk = generate_x25519_keypair()
    assert len(bytes(sk)) == 32
    assert len(bytes(pk)) == 32


def test_x25519_b64_round_trip():
    sk, pk = generate_x25519_keypair()
    pk_b64 = public_key_b64(pk)
    sk_b64 = private_key_b64(sk)
    assert isinstance(pk_b64, str) and " " not in pk_b64 and "\n" not in pk_b64
    assert len(base64.b64decode(pk_b64)) == 32
    assert len(base64.b64decode(sk_b64)) == 32


# ── Ed25519 key pair ───────────────────────────────────────────────────────────

def test_ed25519_keypair_lengths():
    sk, vk = generate_ed25519_keypair()
    assert len(bytes(sk)) == 32
    assert len(bytes(vk)) == 32


def test_ed25519_b64_round_trip():
    sk, vk = generate_ed25519_keypair()
    assert len(base64.b64decode(verify_key_b64(vk))) == 32
    assert len(base64.b64decode(signing_key_b64(sk))) == 32


def test_admin_signing_keypair_alias():
    sk, vk = generate_admin_signing_keypair()
    assert len(bytes(sk)) == 32 and len(bytes(vk)) == 32


# ── Signing / verification ─────────────────────────────────────────────────────

def test_sign_and_verify_roundtrip():
    sk, vk = generate_ed25519_keypair()
    msg = b"senso phase 13 signing test"
    sig_b64 = sign_message(msg, signing_key_b64(sk))
    assert verify_signature(msg, sig_b64, verify_key_b64(vk)) is True


def test_verify_fails_tampered_message():
    sk, vk = generate_ed25519_keypair()
    sig_b64 = sign_message(b"original", signing_key_b64(sk))
    assert verify_signature(b"tampered", sig_b64, verify_key_b64(vk)) is False


def test_verify_fails_wrong_key():
    sk, vk = generate_ed25519_keypair()
    _, wrong_vk = generate_ed25519_keypair()
    sig_b64 = sign_message(b"msg", signing_key_b64(sk))
    assert verify_signature(b"msg", sig_b64, verify_key_b64(wrong_vk)) is False


# ── NaCl master key ────────────────────────────────────────────────────────────

def test_generate_nacl_master_key_length():
    key = generate_nacl_master_key()
    assert isinstance(key, bytes) and len(key) == 32


def test_generate_nacl_master_key_is_random():
    assert generate_nacl_master_key() != generate_nacl_master_key()


# ── Login wrap key derivation ──────────────────────────────────────────────────

def test_derive_nacl_login_wrap_key_length():
    salt = os.urandom(32)
    wk = derive_nacl_login_wrap_key("testpass", salt)
    assert isinstance(wk, bytes) and len(wk) == 32


def test_derive_nacl_login_wrap_key_deterministic():
    salt = os.urandom(32)
    wk1 = derive_nacl_login_wrap_key("pw", salt)
    wk2 = derive_nacl_login_wrap_key("pw", salt)
    assert wk1 == wk2


def test_derive_nacl_login_wrap_key_different_passwords():
    salt = os.urandom(32)
    assert derive_nacl_login_wrap_key("pw1", salt) != derive_nacl_login_wrap_key("pw2", salt)


# ── Master key envelope roundtrip ──────────────────────────────────────────────

def test_wrap_unwrap_master_key_roundtrip():
    master_key = generate_nacl_master_key()
    wrap_key = derive_nacl_login_wrap_key("test_wrap_key", os.urandom(32))
    envelope_b64 = wrap_nacl_master_key(master_key, wrap_key)
    assert isinstance(envelope_b64, str)
    recovered = unwrap_nacl_master_key(envelope_b64, wrap_key)
    assert recovered == master_key


def test_unwrap_fails_wrong_wrap_key():
    master_key = generate_nacl_master_key()
    wrap_key = derive_nacl_login_wrap_key("correct", os.urandom(32))
    wrong_wrap_key = derive_nacl_login_wrap_key("wrong", os.urandom(32))
    envelope_b64 = wrap_nacl_master_key(master_key, wrap_key)
    with pytest.raises(Exception):
        unwrap_nacl_master_key(envelope_b64, wrong_wrap_key)


# ── Private key encryption roundtrip ──────────────────────────────────────────

def test_encrypt_decrypt_private_key_roundtrip():
    master_key = generate_nacl_master_key()
    sk, _ = generate_x25519_keypair()
    raw = bytes(sk)
    encrypted_b64 = encrypt_nacl_private_key(raw, master_key)
    assert isinstance(encrypted_b64, str)
    decrypted = decrypt_nacl_private_key(encrypted_b64, master_key)
    assert decrypted == raw


def test_decrypt_private_key_fails_wrong_master_key():
    master_key = generate_nacl_master_key()
    wrong_master = generate_nacl_master_key()
    sk, _ = generate_x25519_keypair()
    encrypted_b64 = encrypt_nacl_private_key(bytes(sk), master_key)
    with pytest.raises(Exception):
        decrypt_nacl_private_key(encrypted_b64, wrong_master)


def test_full_signup_crypto_flow():
    """Integration: full Phase 13 signup crypto flow — password to recovered private keys."""
    test_pw = "test-signup-ph13"
    nacl_salt = os.urandom(32)

    master_key = generate_nacl_master_key()
    login_wrap_key = derive_nacl_login_wrap_key(test_pw, nacl_salt)
    envelope_b64 = wrap_nacl_master_key(master_key, login_wrap_key)

    x25519_sk, x25519_pk = generate_x25519_keypair()
    ed25519_sk, ed25519_vk = generate_ed25519_keypair()

    enc_x = encrypt_nacl_private_key(bytes(x25519_sk), master_key)
    enc_ed = encrypt_nacl_private_key(bytes(ed25519_sk), master_key)

    # Simulate login: re-derive wrap key, unwrap master, decrypt private keys
    recovered_wrap_key = derive_nacl_login_wrap_key(test_pw, nacl_salt)
    recovered_master = unwrap_nacl_master_key(envelope_b64, recovered_wrap_key)
    recovered_x = decrypt_nacl_private_key(enc_x, recovered_master)
    recovered_ed = decrypt_nacl_private_key(enc_ed, recovered_master)

    assert recovered_x == bytes(x25519_sk)
    assert recovered_ed == bytes(ed25519_sk)
