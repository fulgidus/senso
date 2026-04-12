"""
NaCl / libsodium crypto helpers for Phase 13 crypto-identity foundation.

Key model - multi-envelope architecture:
  Each user has:
    - nacl_master_key: 32-byte random KEK (never stored in plaintext)
    - nacl_pbkdf2_salt: 32-byte random salt for login-envelope PBKDF2
    - nacl_key_login_envelope_b64: AES-GCM(PBKDF2(password, nacl_pbkdf2_salt), nacl_master_key)
    - X25519 key pair:
        public_key_b64                → stored unencrypted (it's public)
        encrypted_x25519_private_b64  → AES-GCM(nacl_master_key, x25519_private_key_bytes)
    - Ed25519 key pair:
        signing_key_b64               → verify key, stored unencrypted (it's public)
        encrypted_ed25519_signing_b64 → AES-GCM(nacl_master_key, ed25519_signing_key_bytes)

  AES-GCM storage format: base64(nonce_12bytes + ciphertext_with_tag)
  - identical to crypto.py pattern.

  Recovery envelopes (word list, passkey) are Phase 14+ scope.

Algorithms:
  - X25519 (curve25519): nacl.public.PrivateKey / PublicKey - DH key agreement
  - Ed25519: nacl.signing.SigningKey / VerifyKey - message signatures
  - AES-256-GCM: envelope and private-key blob encryption (cryptography library)
  - PBKDF2-SHA256, 600_000 iter: login wrap key derivation (matches crypto.py)
"""

from __future__ import annotations

import base64
import os

import nacl.public
import nacl.signing
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


# ── Encoding helpers ──────────────────────────────────────────────────────────

def b64_encode(raw_bytes: bytes) -> str:
    """Base64-encode raw bytes to an ASCII string (no whitespace)."""
    return base64.b64encode(raw_bytes).decode("ascii")


def b64_decode(b64_str: str) -> bytes:
    """Decode a base64 ASCII string to raw bytes."""
    return base64.b64decode(b64_str)


# ── X25519 key pair ───────────────────────────────────────────────────────────

def generate_x25519_keypair() -> tuple[nacl.public.PrivateKey, nacl.public.PublicKey]:
    """Generate a fresh X25519 (curve25519) key pair for Diffie-Hellman.

    Returns:
        (private_key, public_key) - nacl.public objects.
        Serialise with public_key_b64() / private_key_b64().
    """
    private_key = nacl.public.PrivateKey.generate()
    return private_key, private_key.public_key


def public_key_b64(pk: nacl.public.PublicKey) -> str:
    """Serialise an X25519 PublicKey to base64 (32 bytes → 44 chars)."""
    return b64_encode(bytes(pk))


def private_key_b64(sk: nacl.public.PrivateKey) -> str:
    """Serialise an X25519 PrivateKey to base64 (for wrapped-key storage)."""
    return b64_encode(bytes(sk))


# ── Ed25519 key pair ──────────────────────────────────────────────────────────

def generate_ed25519_keypair() -> tuple[nacl.signing.SigningKey, nacl.signing.VerifyKey]:
    """Generate a fresh Ed25519 key pair for message signing.

    Returns:
        (signing_key, verify_key) - nacl.signing objects, both 32 bytes in PyNaCl.
    """
    signing_key = nacl.signing.SigningKey.generate()
    return signing_key, signing_key.verify_key


# Alias for admin code clarity
generate_admin_signing_keypair = generate_ed25519_keypair


def verify_key_b64(vk: nacl.signing.VerifyKey) -> str:
    """Serialise an Ed25519 VerifyKey to base64 (32 bytes → 44 chars)."""
    return b64_encode(bytes(vk))


def signing_key_b64(sk: nacl.signing.SigningKey) -> str:
    """Serialise an Ed25519 SigningKey seed to base64 (for encrypted storage)."""
    return b64_encode(bytes(sk))


# ── Signing / verification ────────────────────────────────────────────────────

def sign_message(message: bytes, sk_b64: str) -> str:
    """Sign a message with a base64-encoded Ed25519 signing key.

    Returns:
        Base64-encoded detached signature (64 bytes).
    """
    sk = nacl.signing.SigningKey(b64_decode(sk_b64))
    signed = sk.sign(message)
    return b64_encode(signed.signature)


def verify_signature(message: bytes, signature_b64: str, vk_b64: str) -> bool:
    """Verify an Ed25519 detached signature.

    Returns:
        True if valid, False if invalid or malformed.
    """
    try:
        vk = nacl.signing.VerifyKey(b64_decode(vk_b64))
        vk.verify(message, b64_decode(signature_b64))
        return True
    except Exception:
        return False


# ── AES-GCM helpers (internal) ────────────────────────────────────────────────
# Format: base64(nonce_12bytes + ciphertext_with_tag) - identical to crypto.py

def _aesgcm_encrypt(key_32: bytes, plaintext: bytes) -> str:
    """AES-256-GCM encrypt plaintext with a 32-byte key.

    Returns base64(nonce + ciphertext_with_tag).
    """
    nonce = os.urandom(12)
    ct = AESGCM(key_32).encrypt(nonce, plaintext, None)
    return b64_encode(nonce + ct)


def _aesgcm_decrypt(key_32: bytes, blob_b64: str) -> bytes:
    """AES-256-GCM decrypt a base64(nonce + ciphertext_with_tag) blob.

    Raises cryptography.exceptions.InvalidTag if key is wrong or data tampered.
    """
    raw = b64_decode(blob_b64)
    nonce, ct = raw[:12], raw[12:]
    return AESGCM(key_32).decrypt(nonce, ct, None)


# ── NaCl master key ───────────────────────────────────────────────────────────

def generate_nacl_master_key() -> bytes:
    """Generate a random 32-byte NaCl master key (KEK for private key blobs).

    Never stored in plaintext - always wrapped by an envelope key before persisting.
    """
    return os.urandom(32)


# ── Login wrap key derivation ─────────────────────────────────────────────────

def derive_nacl_login_wrap_key(password: str, salt_bytes: bytes) -> bytes:
    """Derive a 32-byte wrap key from password + salt using PBKDF2-SHA256 (600k iter).

    Matches the parameters used in crypto.py derive_key_from_password().
    The salt must be the user's nacl_pbkdf2_salt (separate from Phase 10 pbkdf2_salt).

    Args:
        password: Raw plaintext password string.
        salt_bytes: 32 random bytes (decoded from nacl_pbkdf2_salt column).

    Returns:
        32-byte wrap key for use with wrap_nacl_master_key / unwrap_nacl_master_key.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt_bytes,
        iterations=600_000,
    )
    return kdf.derive(password.encode())


# ── Master key envelope ───────────────────────────────────────────────────────

def wrap_nacl_master_key(master_key: bytes, wrap_key: bytes) -> str:
    """AES-GCM encrypt the nacl_master_key with wrap_key → base64 envelope blob.

    Stored in users.nacl_key_login_envelope_b64.

    Args:
        master_key: 32-byte random master key (from generate_nacl_master_key()).
        wrap_key: 32-byte wrap key (from derive_nacl_login_wrap_key()).

    Returns:
        Base64 envelope string (nonce + ciphertext) - safe to store in DB.
    """
    return _aesgcm_encrypt(wrap_key, master_key)


def unwrap_nacl_master_key(envelope_b64: str, wrap_key: bytes) -> bytes:
    """AES-GCM decrypt the nacl_master_key from its login envelope.

    Args:
        envelope_b64: Value from users.nacl_key_login_envelope_b64.
        wrap_key: 32-byte wrap key (re-derived from PBKDF2(password, nacl_pbkdf2_salt)).

    Returns:
        32-byte nacl_master_key.

    Raises:
        cryptography.exceptions.InvalidTag: If wrap_key is wrong or data is tampered.
    """
    return _aesgcm_decrypt(wrap_key, envelope_b64)


# ── Private key encryption ────────────────────────────────────────────────────

def encrypt_nacl_private_key(private_key_bytes: bytes, master_key: bytes) -> str:
    """AES-GCM encrypt a private key's raw bytes with the nacl_master_key.

    Use for both X25519 private key and Ed25519 signing key seed.
    Stored in users.encrypted_x25519_private_b64 / encrypted_ed25519_signing_b64.

    Args:
        private_key_bytes: Raw key bytes (32 bytes for both PyNaCl key types).
        master_key: 32-byte nacl_master_key.

    Returns:
        Base64 blob (nonce + ciphertext) - safe to store in DB.
    """
    return _aesgcm_encrypt(master_key, private_key_bytes)


def decrypt_nacl_private_key(encrypted_b64: str, master_key: bytes) -> bytes:
    """AES-GCM decrypt a private key blob using the nacl_master_key.

    Args:
        encrypted_b64: Value from users.encrypted_x25519_private_b64 or encrypted_ed25519_signing_b64.
        master_key: 32-byte nacl_master_key (unwrapped from login envelope).

    Returns:
        Raw private key bytes.

    Raises:
        cryptography.exceptions.InvalidTag: If master_key is wrong or data is tampered.
    """
    return _aesgcm_decrypt(master_key, encrypted_b64)


# ── BIP-39 recovery envelope ─────────────────────────────────────────────────


def generate_bip39_recovery_phrase() -> str:
    """Generate a 24-word BIP-39 mnemonic phrase (256 bits entropy).

    The phrase is returned ONCE at signup and NEVER stored in plaintext.
    The client is responsible for saving it.

    Returns:
        Space-separated string of 24 English words from the BIP-39 wordlist.
    """
    from mnemonic import Mnemonic  # noqa: PLC0415

    mnemo = Mnemonic("english")
    return mnemo.generate(strength=256)  # 256 bits → 24 words


def wrap_nacl_master_key_with_phrase(
    master_key: bytes,
    phrase: str,
    nacl_pbkdf2_salt: bytes,
) -> str:
    """Wrap the nacl_master_key using a BIP-39 recovery phrase as the wrap key.

    Uses the same PBKDF2 + AES-GCM pattern as wrap_nacl_master_key() (login envelope),
    but the wrap key is derived from the BIP-39 phrase instead of the user's password.
    The same nacl_pbkdf2_salt is reused (per-user identity salt, not per-envelope).

    Args:
        master_key: 32-byte nacl_master_key to protect.
        phrase: 24-word BIP-39 phrase (space-separated string).
        nacl_pbkdf2_salt: 32-byte salt (decoded from user.nacl_pbkdf2_salt).

    Returns:
        Base64 envelope string (nonce + ciphertext) for nacl_key_recovery_envelope_b64.
    """
    recovery_wrap_key = derive_nacl_login_wrap_key(phrase, nacl_pbkdf2_salt)
    return wrap_nacl_master_key(master_key, recovery_wrap_key)


# ── Argon2id KDF (Phase 15 migration) ─────────────────────────────────────────


def derive_argon2id_wrap_key(password: str, salt_bytes: bytes) -> bytes:
    """Derive a 32-byte wrap key using Argon2id (RFC 9106 Low Memory).

    Replaces derive_nacl_login_wrap_key (PBKDF2) for v2 envelopes.

    Parameters (MUST match browser argon2-browser and test_kdf_interop.py):
        time_cost    = 3
        memory_cost  = 65536  KiB (64 MiB)
        parallelism  = 4
        hash_len     = 32     bytes
        type         = Argon2id

    Args:
        password:   Raw plaintext password string.
        salt_bytes: 32 random bytes (decoded from nacl_pbkdf2_salt column).

    Returns:
        32-byte wrap key for use with wrap_nacl_master_key_v2 / unwrap_nacl_master_key_v2.
    """
    import argon2.low_level  # noqa: PLC0415

    return argon2.low_level.hash_secret_raw(
        secret=password.encode(),
        salt=salt_bytes,
        time_cost=3,
        memory_cost=65536,
        parallelism=4,
        hash_len=32,
        type=argon2.low_level.Type.ID,
    )


# ── libsodium-compatible secretbox envelope (v2 format) ───────────────────────
# Format: "v2:" + base64(nonce_24bytes + ciphertext_with_mac)
# nonce: 24 bytes (crypto_secretbox_NONCEBYTES)
# The "v2:" prefix allows format detection without a separate DB column.
# Compatible with frontend secretbox_open_easy call in crypto.ts.

V2_PREFIX = "v2:"


def _secretbox_encrypt(key_32: bytes, plaintext: bytes) -> str:
    """XSalsa20-Poly1305 secretbox encrypt using PyNaCl.

    Returns "v2:" + base64(nonce_24bytes + ciphertext_with_mac).
    Compatible with libsodium-wrappers crypto_secretbox_open_easy on the frontend.
    """
    import nacl.secret  # noqa: PLC0415
    import nacl.utils   # noqa: PLC0415

    box = nacl.secret.SecretBox(key_32)
    nonce = nacl.utils.random(nacl.secret.SecretBox.NONCE_SIZE)  # 24 bytes
    encrypted = box.encrypt(plaintext, nonce=nonce)
    # encrypted.ciphertext includes the Poly1305 MAC (16 bytes) at the end
    raw = nonce + encrypted.ciphertext
    return V2_PREFIX + b64_encode(raw)


def _secretbox_decrypt(key_32: bytes, blob: str) -> bytes:
    """XSalsa20-Poly1305 secretbox decrypt.

    Args:
        blob: "v2:" + base64(nonce_24bytes + ciphertext_with_mac)

    Raises:
        nacl.exceptions.CryptoError: If key is wrong or data is tampered.
    """
    import nacl.secret  # noqa: PLC0415

    assert blob.startswith(V2_PREFIX), f"Expected v2: prefix, got: {blob[:10]}"
    raw = b64_decode(blob[len(V2_PREFIX):])
    box = nacl.secret.SecretBox(key_32)
    nonce, ct = raw[:24], raw[24:]
    return bytes(box.decrypt(ct, nonce=nonce))


def detect_envelope_version(envelope_b64: str) -> str:
    """Return 'v2' if envelope uses new secretbox format, 'v1' if legacy AES-GCM."""
    return "v2" if envelope_b64.startswith(V2_PREFIX) else "v1"


def wrap_nacl_master_key_v2(master_key: bytes, wrap_key: bytes) -> str:
    """Secretbox-encrypt the nacl_master_key with an Argon2id-derived wrap key.

    Stored in users.nacl_key_login_envelope_b64 after v1->v2 migration.
    Format: "v2:" + base64(nonce_24bytes + ciphertext_with_mac).
    """
    return _secretbox_encrypt(wrap_key, master_key)


def unwrap_nacl_master_key_v2(envelope_b64: str, wrap_key: bytes) -> bytes:
    """Secretbox-decrypt the nacl_master_key from a v2 login envelope.

    Args:
        envelope_b64: Value from users.nacl_key_login_envelope_b64 (starts with "v2:").
        wrap_key: 32-byte Argon2id-derived key.

    Returns:
        32-byte nacl_master_key.

    Raises:
        nacl.exceptions.CryptoError: If wrap_key is wrong or data is tampered.
    """
    return _secretbox_decrypt(wrap_key, envelope_b64)


def encrypt_nacl_private_key_v2(private_key_bytes: bytes, master_key: bytes) -> str:
    """Secretbox-encrypt a private key blob using the nacl_master_key (v2 format).

    Format: "v2:" + base64(nonce_24bytes + ciphertext_with_mac).
    Stored in encrypted_x25519_private_b64 / encrypted_ed25519_signing_b64 after migration.
    """
    return _secretbox_encrypt(master_key, private_key_bytes)


def decrypt_nacl_private_key_v2(encrypted_b64: str, master_key: bytes) -> bytes:
    """Secretbox-decrypt a private key blob (v2 format)."""
    return _secretbox_decrypt(master_key, encrypted_b64)


# ── Migration helper ──────────────────────────────────────────────────────────


def rewrap_all_envelopes(
    password: str,
    nacl_pbkdf2_salt: bytes,
    nacl_key_login_envelope_b64: str,
    encrypted_x25519_private_b64: str,
    encrypted_ed25519_signing_b64: str,
    nacl_key_recovery_envelope_b64: str | None,
    recovery_phrase: str | None,
) -> dict[str, str]:
    """Migrate all user envelopes from v1 (AES-GCM + PBKDF2) to v2 (secretbox + Argon2id).

    Called at login when detect_envelope_version(nacl_key_login_envelope_b64) == "v1".

    Returns a dict of column_name -> new_v2_blob for all affected columns.
    The caller is responsible for persisting these values to the DB.

    Steps:
      1. Derive v1 PBKDF2 wrap key and unwrap login envelope -> nacl_master_key
      2. Decrypt both private key blobs with nacl_master_key
      3. Derive v2 Argon2id wrap key
      4. Re-wrap login envelope with v2 wrap key -> new login envelope
      5. Re-encrypt private key blobs with nacl_master_key (secretbox format)
      6. If recovery envelope present, re-wrap with recovery phrase (v2 format)
    """
    # Step 1: Unwrap v1 login envelope
    v1_wrap_key = derive_nacl_login_wrap_key(password, nacl_pbkdf2_salt)
    master_key = unwrap_nacl_master_key(nacl_key_login_envelope_b64, v1_wrap_key)

    # Step 2: Decrypt private keys (v1 AES-GCM format)
    x25519_bytes = decrypt_nacl_private_key(encrypted_x25519_private_b64, master_key)
    ed25519_bytes = decrypt_nacl_private_key(encrypted_ed25519_signing_b64, master_key)

    # Step 3: Derive v2 Argon2id wrap key
    v2_wrap_key = derive_argon2id_wrap_key(password, nacl_pbkdf2_salt)

    # Step 4: Re-wrap login envelope (v2)
    new_login_envelope = wrap_nacl_master_key_v2(master_key, v2_wrap_key)

    # Step 5: Re-encrypt private key blobs (v2)
    new_x25519_enc = encrypt_nacl_private_key_v2(x25519_bytes, master_key)
    new_ed25519_enc = encrypt_nacl_private_key_v2(ed25519_bytes, master_key)

    result = {
        "nacl_key_login_envelope_b64": new_login_envelope,
        "encrypted_x25519_private_b64": new_x25519_enc,
        "encrypted_ed25519_signing_b64": new_ed25519_enc,
    }

    # Step 6: Re-wrap recovery envelope if present
    if nacl_key_recovery_envelope_b64 and recovery_phrase:
        new_recovery_envelope = wrap_nacl_master_key_v2(
            master_key,
            derive_argon2id_wrap_key(recovery_phrase, nacl_pbkdf2_salt),
        )
        result["nacl_key_recovery_envelope_b64"] = new_recovery_envelope

    return result


def unwrap_nacl_master_key_with_phrase(
    envelope_b64: str,
    phrase: str,
    nacl_pbkdf2_salt: bytes,
) -> bytes:
    """Unwrap the nacl_master_key using a BIP-39 recovery phrase.

    Args:
        envelope_b64: Value from user.nacl_key_recovery_envelope_b64.
        phrase: 24-word BIP-39 phrase (space-separated).
        nacl_pbkdf2_salt: 32-byte salt (decoded from user.nacl_pbkdf2_salt).

    Returns:
        32-byte nacl_master_key.

    Raises:
        cryptography.exceptions.InvalidTag: If phrase/salt is wrong or data tampered.
    """
    recovery_wrap_key = derive_nacl_login_wrap_key(phrase, nacl_pbkdf2_salt)
    return unwrap_nacl_master_key(envelope_b64, recovery_wrap_key)
