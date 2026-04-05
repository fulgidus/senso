"""
Username generation for Phase 13 crypto-identity foundation.

Format:
  Regular users: `$adjective-noun-NNNN` e.g. `$witty-otter-42`
    - `$` prefix (distinguishes from !admin)
    - lowercase adjective + noun from curated word lists
    - 2-4 random decimal digits (not zero-padded, range 10-9999)
  Admin users: `!admin` (default at signup), `!` prefix, renamable later (Phase 14+)

Collision resolution: re-roll up to 100 times before raising RuntimeError.
"""

from __future__ import annotations

import random

from sqlalchemy.orm import Session

ADJECTIVES: list[str] = [
    "witty", "brave", "calm", "deft", "eager",
    "fair", "glad", "hale", "idle", "keen",
    "lush", "mild", "neat", "odd", "pure",
    "quick", "rich", "sage", "tame", "vast",
    "warm", "bold", "cozy", "deep", "epic",
    "firm", "gold", "hazy", "icy", "jade",
    "kind", "lean", "merry", "noble", "opal",
    "plum", "quiet", "rare", "swift", "zeal",
]

NOUNS: list[str] = [
    "otter", "crane", "dove", "elk", "fox",
    "gecko", "hawk", "ibis", "jay", "kite",
    "lynx", "mink", "newt", "owl", "pika",
    "quail", "rook", "seal", "teal", "vole",
    "wolf", "wren", "yak", "zebu", "bee",
    "carp", "dart", "fern", "gull", "heron",
    "iris", "koi", "lark", "moth", "oryx",
    "pine", "reed", "ruse", "finch", "weasel",
]

_MAX_RETRIES = 100


def generate_username(db: Session) -> str:
    """Generate a unique `$adjective-noun-NNNN` username.

    Queries users table to check for collisions (up to 100 retries).

    Args:
        db: SQLAlchemy Session for uniqueness check.

    Returns:
        Unique username string beginning with `$`.

    Raises:
        RuntimeError: If all retries exhausted (astronomically unlikely with 40×40×9990 space).
    """
    from app.db.models import User  # noqa: PLC0415 — avoid circular at module level

    for _ in range(_MAX_RETRIES):
        adj = random.choice(ADJECTIVES)
        noun = random.choice(NOUNS)
        digits = random.randint(10, 9999)
        candidate = f"${adj}-{noun}-{digits}"
        if db.query(User).filter(User.username == candidate).first() is None:
            return candidate
    raise RuntimeError("Username generator exhausted retries — namespace may be full.")


def generate_admin_username() -> str:
    """Return the default admin username `!admin` (assigned at signup)."""
    return "!admin"


def is_admin_username(username: str) -> bool:
    """Return True if username uses the `!` admin prefix."""
    return username.startswith("!")


def is_user_username(username: str) -> bool:
    """Return True if username uses the `$` regular-user prefix."""
    return username.startswith("$")
