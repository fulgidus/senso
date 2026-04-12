"""
Cryptographic helpers for Phase 10 wrapped-key architecture.

Key model:
  - Each user has a random 32-byte `user_data_key` (AES-256).
  - The data key is stored wrapped: encrypted with a derived key.
  - Password users: derived key = PBKDF2(password, random_salt, 600_000 iter, SHA-256).
  - OAuth/no-password users: derived key = PBKDF2(jwt_secret + user_id, random_salt, 600_000 iter, SHA-256).
  - The wrapped key is stored as base64(nonce_12 + ciphertext_32 + tag_16) in users.encrypted_user_key.
  - The salt is stored as base64(salt_32) in users.pbkdf2_salt.

T2 column encryption (server-wide key) is handled separately via StringEncryptedType
in models.py (Plan 03). This module handles T1/T3 per-user key management only.
"""

from __future__ import annotations

import base64
import os

from cryptography.hazmat.backends import default_backend
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC


def generate_user_data_key() -> bytes:
    """Generate a fresh 256-bit (32-byte) random user data key."""
    return os.urandom(32)


def derive_key_from_password(password: str, salt_bytes: bytes) -> bytes:
    """Derive a 256-bit AES key from a password using PBKDF2-SHA256.

    Parameters:
        password: The user's plaintext password (or jwt_secret+user_id for OAuth).
        salt_bytes: 32 random bytes stored in users.pbkdf2_salt.

    Returns:
        32-byte derived key suitable for AES-GCM wrapping.
    """
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt_bytes,
        iterations=600_000,  # OWASP 2024 minimum for SHA-256
        backend=default_backend(),
    )
    return kdf.derive(password.encode("utf-8"))


def wrap_user_key(user_data_key: bytes, derived_key: bytes) -> str:
    """Encrypt a user data key with a derived key using AES-256-GCM.

    Parameters:
        user_data_key: 32-byte random key to protect.
        derived_key: 32-byte key from derive_key_from_password().

    Returns:
        base64-encoded string: nonce(12) + aesgcm.encrypt(nonce, user_data_key, None)
        (The AESGCM ciphertext includes the 16-byte GCM tag at the end, so total = 12+32+16=60 bytes → ~80 chars b64.)
    """
    aesgcm = AESGCM(derived_key)
    nonce = os.urandom(12)
    ct = aesgcm.encrypt(nonce, user_data_key, None)
    return base64.b64encode(nonce + ct).decode("ascii")


def unwrap_user_key(encrypted_key_b64: str, derived_key: bytes) -> bytes:
    """Decrypt a wrapped user data key.

    Parameters:
        encrypted_key_b64: Value from users.encrypted_user_key.
        derived_key: 32-byte key from derive_key_from_password().

    Returns:
        The original 32-byte user data key.

    Raises:
        cryptography.exceptions.InvalidTag: If the derived key is wrong.
    """
    raw = base64.b64decode(encrypted_key_b64)
    nonce, ct = raw[:12], raw[12:]
    aesgcm = AESGCM(derived_key)
    return aesgcm.decrypt(nonce, ct, None)


def server_wrap_user_key(
    user_id: str,
) -> tuple[str, str]:
    """Generate and wrap a user data key using the server-held secret (OAuth / no-password users).

    Parameters:
        user_id: The user's UUID string (combined with jwt_secret as wrapping material).

    Returns:
        (encrypted_key_b64, salt_b64): Values to store in users.encrypted_user_key and users.pbkdf2_salt.

    Note:
        Import get_settings() lazily inside the function to avoid circular imports at module load.
    """
    from app.core.config import get_settings  # noqa: PLC0415

    settings = get_settings()
    password_material = settings.jwt_secret + user_id
    salt = os.urandom(32)
    derived = derive_key_from_password(password_material, salt)
    user_data_key = generate_user_data_key()
    encrypted_key_b64 = wrap_user_key(user_data_key, derived)
    salt_b64 = base64.b64encode(salt).decode("ascii")
    return encrypted_key_b64, salt_b64
