"""
Cross-language Argon2id KDF interop test — Phase 15 (task 15-01-04)

Verifies that Python argon2-cffi produces identical output to browser argon2-browser
for the same (password, salt, params) inputs.

RFC 9106 Low Memory parameters (identical in both runtimes):
    time_cost    = 3
    memory_cost  = 65536   (64 MiB)
    parallelism  = 4
    hash_len     = 32      (256-bit output)
    type         = Argon2id

HOW TO LOCK THE VECTOR:
1. Run this test: `docker compose run --rm api uv run pytest api/tests/test_kdf_interop.py -s`
2. Copy the printed hex value into EXPECTED_HEX below.
3. Copy the same hex into senso/src/features/messages/__tests__/kdf.test.ts EXPECTED_HEX.
4. Re-run both test suites to confirm they match.
"""

import argon2
import argon2.low_level


# RFC 9106 Low Memory — must match argon2-browser config in kdf.test.ts exactly
TIME_COST = 3
MEMORY_COST = 65536   # kibibytes (64 MiB)
PARALLELISM = 4
HASH_LEN = 32

# Test vector inputs (fixed for determinism)
VECTOR_PASSWORD = b"password"
VECTOR_SALT = b"\x00" * 16   # 16 zero bytes

# Replace LOCK_ME with the printed hex after first run:
EXPECTED_HEX = "00b1eed9bee6dc0641a507717db76b6520ec876ece6cd10925e43875b543575e"


def derive_argon2id(password: bytes, salt: bytes) -> bytes:
    """Derive 32-byte key using Argon2id with RFC 9106 Low Memory params."""
    return argon2.low_level.hash_secret_raw(
        secret=password,
        salt=salt,
        time_cost=TIME_COST,
        memory_cost=MEMORY_COST,
        parallelism=PARALLELISM,
        hash_len=HASH_LEN,
        type=argon2.low_level.Type.ID,
    )


def test_argon2id_derives_32_bytes():
    result = derive_argon2id(VECTOR_PASSWORD, VECTOR_SALT)
    assert len(result) == 32, f"Expected 32 bytes, got {len(result)}"


def test_argon2id_deterministic():
    r1 = derive_argon2id(VECTOR_PASSWORD, VECTOR_SALT)
    r2 = derive_argon2id(VECTOR_PASSWORD, VECTOR_SALT)
    assert r1 == r2, "Argon2id must be deterministic for the same inputs"


def test_argon2id_prints_vector_for_locking(capsys):
    """Print the canonical hex vector to lock in both Python and browser tests."""
    result = derive_argon2id(VECTOR_PASSWORD, VECTOR_SALT)
    hex_val = result.hex()
    print(f"\n[LOCK THIS] Argon2id vector hex: {hex_val}")
    # Once EXPECTED_HEX is set (not LOCK_ME), assert equality:
    if EXPECTED_HEX != "LOCK_ME":
        assert hex_val == EXPECTED_HEX, (
            f"Argon2id vector mismatch!\n"
            f"  Got:      {hex_val}\n"
            f"  Expected: {EXPECTED_HEX}\n"
            "Update EXPECTED_HEX in this file AND in kdf.test.ts"
        )


def test_argon2id_different_passwords_differ():
    r1 = derive_argon2id(b"passwordA", VECTOR_SALT)
    r2 = derive_argon2id(b"passwordB", VECTOR_SALT)
    assert r1 != r2


def test_argon2id_different_salts_differ():
    r1 = derive_argon2id(VECTOR_PASSWORD, b"\x01" * 16)
    r2 = derive_argon2id(VECTOR_PASSWORD, b"\x02" * 16)
    assert r1 != r2
