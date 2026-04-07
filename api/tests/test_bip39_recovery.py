"""Tests for BIP-39 recovery envelope helpers — Phase 14."""
import os
import pytest

from app.db.nacl_crypto import (
    generate_nacl_master_key,
    generate_bip39_recovery_phrase,
    wrap_nacl_master_key_with_phrase,
    unwrap_nacl_master_key_with_phrase,
)


def test_generate_bip39_phrase_word_count():
    phrase = generate_bip39_recovery_phrase()
    words = phrase.strip().split()
    assert len(words) == 24, f"Expected 24 words, got {len(words)}"


def test_generate_bip39_phrase_is_string():
    phrase = generate_bip39_recovery_phrase()
    assert isinstance(phrase, str)
    assert " " in phrase


def test_generate_bip39_phrase_is_random():
    p1 = generate_bip39_recovery_phrase()
    p2 = generate_bip39_recovery_phrase()
    assert p1 != p2, "Two phrases should differ (entropy check)"


def test_bip39_wrap_unwrap_roundtrip():
    master_key = generate_nacl_master_key()
    phrase = generate_bip39_recovery_phrase()
    salt = os.urandom(32)

    envelope_b64 = wrap_nacl_master_key_with_phrase(master_key, phrase, salt)
    assert isinstance(envelope_b64, str)

    recovered = unwrap_nacl_master_key_with_phrase(envelope_b64, phrase, salt)
    assert recovered == master_key, "Recovered master key must match original"


def test_bip39_unwrap_fails_wrong_phrase():
    master_key = generate_nacl_master_key()
    correct_phrase = generate_bip39_recovery_phrase()
    wrong_phrase = generate_bip39_recovery_phrase()
    salt = os.urandom(32)

    envelope_b64 = wrap_nacl_master_key_with_phrase(master_key, correct_phrase, salt)
    with pytest.raises(Exception):  # InvalidTag from cryptography
        unwrap_nacl_master_key_with_phrase(envelope_b64, wrong_phrase, salt)


def test_bip39_unwrap_fails_wrong_salt():
    master_key = generate_nacl_master_key()
    phrase = generate_bip39_recovery_phrase()
    correct_salt = os.urandom(32)
    wrong_salt = os.urandom(32)

    envelope_b64 = wrap_nacl_master_key_with_phrase(master_key, phrase, correct_salt)
    with pytest.raises(Exception):
        unwrap_nacl_master_key_with_phrase(envelope_b64, phrase, wrong_salt)


def test_bip39_recovery_is_independent_of_login_envelope():
    """Login envelope and recovery envelope wrap the same master key differently."""
    from app.db.nacl_crypto import (
        derive_nacl_login_wrap_key,
        wrap_nacl_master_key,
        unwrap_nacl_master_key,
    )

    password = "user-login-password"
    phrase = generate_bip39_recovery_phrase()
    salt = os.urandom(32)
    master_key = generate_nacl_master_key()

    # Login envelope
    login_wrap_key = derive_nacl_login_wrap_key(password, salt)
    login_envelope = wrap_nacl_master_key(master_key, login_wrap_key)

    # Recovery envelope (same master key, same salt, different input = phrase)
    recovery_envelope = wrap_nacl_master_key_with_phrase(master_key, phrase, salt)

    assert login_envelope != recovery_envelope, "Login and recovery envelopes should differ"

    # Both independently recover the same master key
    recovered_via_login = unwrap_nacl_master_key(login_envelope, login_wrap_key)
    recovered_via_recovery = unwrap_nacl_master_key_with_phrase(recovery_envelope, phrase, salt)

    assert recovered_via_login == master_key
    assert recovered_via_recovery == master_key
