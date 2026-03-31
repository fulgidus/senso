# Phase 10 Research: Transparency & Security

**Phase:** 10
**Date:** 2026-03-31
**Status:** Complete

---

## Summary

Research covers four technical domains: `StringEncryptedType`/AesGcmEngine API, wrapped-key PBKDF2 architecture, LLM no-retention headers (OpenAI + OpenRouter), and the About page static content pattern.

---

## 1. sqlalchemy-utils StringEncryptedType + AesGcmEngine

### Key Findings

- `EncryptedType` is **deprecated since 0.36.6** — use `StringEncryptedType` instead.
- `sqlalchemy-utils` is **NOT** in `api/pyproject.toml` — must be added as a dependency.
- `cryptography` library (already a transitive dep via other packages, but should be explicit) is required.

### Correct Import + Usage

```python
from sqlalchemy_utils import StringEncryptedType
from sqlalchemy_utils.types.encrypted.encrypted_type import AesGcmEngine

# T2 — server-wide key (static callable or string)
description = Column(StringEncryptedType(String(1024), lambda: get_settings().encryption_key, AesGcmEngine))

# T1/T3 — per-user key (callable injected at query time via column_property)
raw_text = Column(StringEncryptedType(Text, _get_user_key, AesGcmEngine))
```

### Critical Constraint: Per-User Keys with SQLAlchemy ORM

`StringEncryptedType` accepts a **callable** for `key`. However, this callable is **not request-scoped** — it is called at column processing time without FastAPI context.

**Recommended approach for T1/T3:** Use a **module-level context variable** (Python `contextvars.ContextVar`) to hold the unwrapped user key for the duration of a request:

```python
# api/app/db/crypto.py
from contextvars import ContextVar
_user_key_ctx: ContextVar[bytes | None] = ContextVar("user_key", default=None)

def set_user_key(key: bytes) -> None:
    _user_key_ctx.set(key)

def get_user_key() -> bytes:
    k = _user_key_ctx.get()
    if k is None:
        raise RuntimeError("User encryption key not set in request context")
    return k
```

Then `StringEncryptedType(Text, get_user_key, AesGcmEngine)` will call `get_user_key()` transparently at encrypt/decrypt time. FastAPI middleware sets it after login unwraps the user key.

**Alternative (simpler for MVP):** Encrypt/decrypt T1/T3 fields **manually** using `cryptography.hazmat` AES-GCM, bypassing `StringEncryptedType` entirely for those columns. Store ciphertext as base64 `Text`. This gives full control without context-var complexity. **Recommended approach given hackathon constraints.**

### AesGcmEngine Storage Format

```
base64(iv_12_bytes + tag_16_bytes + ciphertext_N_bytes)
```
Random IV per encrypt call. No search possible on encrypted columns (acceptable — no searches on T1/T3 fields).

### sqlalchemy-utils JSON column support

`StringEncryptedType(JSONType, key, AesGcmEngine)` — encrypts JSON columns (for `insight_cards`, `income_summary`, etc.). The `JSONType` is also from `sqlalchemy_utils`.

### Dependencies to Add

```toml
# api/pyproject.toml
"sqlalchemy-utils>=0.41.2",
"cryptography>=42.0.0",
```

---

## 2. Wrapped-Key Architecture (PBKDF2)

### Recommended Parameters (OWASP 2024)

```python
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.backends import default_backend
import os, base64

# Key derivation from password
salt = os.urandom(32)  # 32-byte random salt stored in users.pbkdf2_salt
kdf = PBKDF2HMAC(
    algorithm=hashes.SHA256(),
    length=32,
    salt=salt,
    iterations=600_000,  # OWASP 2024 minimum for SHA-256
    backend=default_backend(),
)
derived_key = kdf.derive(password.encode())
```

### Wrapping the User Data Key

```python
# At signup: generate user's data key, wrap it
user_data_key = os.urandom(32)  # 256-bit random key

# Wrap: encrypt user_data_key with derived_key using AES-GCM
from cryptography.hazmat.primitives.ciphers.aead import AESGCM
aesgcm = AESGCM(derived_key)
nonce = os.urandom(12)
wrapped_key = nonce + aesgcm.encrypt(nonce, user_data_key, None)
encrypted_user_key = base64.b64encode(wrapped_key).decode()
# Store: users.encrypted_user_key = encrypted_user_key, users.pbkdf2_salt = base64(salt)

# At login: unwrap
salt_bytes = base64.b64decode(stored_salt)
kdf2 = PBKDF2HMAC(algorithm=hashes.SHA256(), length=32, salt=salt_bytes, iterations=600_000, backend=default_backend())
derived_key2 = kdf2.derive(password.encode())
aesgcm2 = AESGCM(derived_key2)
wrapped = base64.b64decode(stored_encrypted_user_key)
nonce2, ct = wrapped[:12], wrapped[12:]
user_data_key = aesgcm2.decrypt(nonce2, ct, None)  # raises InvalidTag if wrong password
```

### OAuth Users (no password)

For Google OAuth users: wrap with `PBKDF2(server_secret + user_id)` — effectively server-held key. Same interface, falls back gracefully when user has no password.

```python
server_wrapping_material = (settings.jwt_secret + user.id).encode()
```

### Migration of Existing Plaintext Data

**Pattern for `_add_missing_columns()`:**
1. Add new columns (`encrypted_user_key`, `pbkdf2_salt`, `strict_privacy_mode`) with `IF NOT EXISTS`
2. For existing rows without `encrypted_user_key`: generate a fresh data key, wrap with server secret fallback (same as OAuth path), store. This leaves existing **data columns** as plaintext.
3. Plaintext → ciphertext column migration: requires reading each row, encrypting values, writing back. For MVP, **defer the column migration** — new writes will be encrypted; existing plaintext reads should be gracefully handled (detect non-base64 format → return as-is).

---

## 3. LLM No-Retention Headers

### OpenAI

The `openai` Python SDK `OpenAI()` constructor accepts `default_headers: dict[str, str]`.

```python
kwargs_init["default_headers"] = {"openai-beta": "no-store"}
```

This tells OpenAI not to store the request for training/improvement. Documented in OpenAI API policies.

### OpenRouter — ZDR (Zero Data Retention)

**OpenRouter does NOT use HTTP headers for ZDR.** The correct mechanism is a `provider` parameter in the request body:

```python
call_kwargs["extra_body"] = {"provider": {"zdr": True}}
```

Using the OpenAI Python SDK with `base_url="https://openrouter.ai/api/v1"`:
- `client.chat.completions.create(**call_kwargs, extra_body={"provider": {"zdr": True}})` routes only to ZDR-compliant endpoints.
- **Warning:** When `zdr=True`, some models/endpoints may be excluded from the eligible pool. For strict mode only — do not set globally.
- For **standard mode** (best-effort): OpenRouter `default_headers` can include `X-Title` and `HTTP-Referer` (app attribution), but there is no best-effort no-retention header — the `openai-beta: no-store` header does **not** apply to OpenRouter.

### Gemini

Google API Terms of Service for API usage already **exclude API data from model training**. No additional header needed. Document this fact in the About page.

### ElevenLabs

Per ElevenLabs Terms of Service (as of 2026): ElevenLabs may store audio generation requests. Their Business tier DPA includes data retention controls, but the Free/Starter tiers do not provide contractual ZDR guarantees. **Decision: In strict privacy mode, ElevenLabs TTS is disabled.** This matches the D-15 direction in CONTEXT.md.

### Implementation Summary

```python
# Standard mode: inject no-store header for openai provider only
if provider == "openai":
    kwargs_init["default_headers"] = {"openai-beta": "no-store"}

# Strict mode: inject ZDR body param for openrouter
if strict_mode and provider == "openrouter":
    call_kwargs["extra_body"] = {"provider": {"zdr": True}}

# Strict mode: skip openrouter if no ZDR-capable endpoint exists (fail gracefully)
# Strict mode: disable ElevenLabs TTS entirely
```

---

## 4. About Page Pattern

### Static i18n Content Component

No API call needed. Content sourced from `i18n` locale files. Pattern already established via `/learn` public routes in `App.tsx`.

```tsx
// senso/src/pages/AboutPage.tsx
import { useTranslation } from "react-i18next"

export function AboutPage() {
  const { t } = useTranslation()
  return (
    <PublicShell>
      <div className="max-w-2xl mx-auto py-10 space-y-8">
        <h1 className="text-2xl font-semibold">{t("about.title")}</h1>
        {/* sections from i18n */}
      </div>
    </PublicShell>
  )
}
```

Public route added in `AppRoutes`:
```tsx
const isAboutRoute = location.pathname === "/about" || location.pathname.startsWith("/about")
// Before auth gate:
if (isAboutRoute && (!auth.initialized || !auth.isAuthenticated)) {
  return <PublicShell><AboutPage /></PublicShell>
}
```

Settings > About section: renders `<AboutContent />` component (same content, no shell).

---

## Validation Architecture

The following validation tests should be created as part of implementation:

### Backend Tests

| Test | File | What It Checks |
| ---- | ---- | -------------- |
| T2 encrypt roundtrip | `api/tests/test_encryption.py` | `StringEncryptedType(JSONType, key, AesGcmEngine)` encrypts and decrypts `insight_cards` correctly |
| T1 encrypt roundtrip | `api/tests/test_encryption.py` | Manual AES-GCM encrypt/decrypt for `raw_text` with per-user key |
| PBKDF2 wrap/unwrap | `api/tests/test_crypto.py` | `wrap_user_key(password, salt) → unwrap_user_key(password, salt) == original_key` |
| No-retention header | `api/tests/test_llm_noretention.py` | OpenAI client constructed with `default_headers["openai-beta"] == "no-store"` |
| Strict mode ZDR | `api/tests/test_llm_noretention.py` | `extra_body["provider"]["zdr"] == True` injected for openrouter in strict mode |
| `strict_privacy_mode` schema | `api/tests/test_auth.py` | `PATCH /auth/me` with `strict_privacy_mode=true` persists correctly |
| Column migration idempotent | `api/tests/test_session.py` | `_add_missing_columns()` runs twice without error |

### Frontend Tests

| Test | What It Checks |
| ---- | -------------- |
| `/about` renders without auth | `AboutPage` loads with i18n content, no 401 |
| Privacy toggle in Settings | `strict_privacy_mode` toggle calls `PATCH /auth/me` |

---

## Common Pitfalls

1. **`EncryptedType` is deprecated** — always use `StringEncryptedType` from `sqlalchemy_utils`.
2. **JSON columns need `JSONType`** from `sqlalchemy_utils` as the inner type, not `sa.JSON`.
3. **No header for OpenRouter ZDR** — use `extra_body={"provider": {"zdr": True}}` in `call_kwargs`, not in `kwargs_init`.
4. **`openai-beta: no-store` only applies to OpenAI direct** — OpenRouter ignores this header.
5. **PBKDF2 iterations minimum 600,000** for SHA-256 (OWASP 2024) — not 100,000 (old default).
6. **Don't hold ORM session + DDL on same table** — `_add_missing_columns()` uses raw `engine.connect()` with `sa.text()`, then session-level ORM for data reads. Never mix.
7. **`frozen=True` dataclass** — `Settings` cannot be mutated; `encryption_key` field must be in `get_settings()` factory, not injected post-construction.
8. **`AesGcmEngine` stores as String** — underlying `impl = String`. Column type in Postgres is `TEXT`. Existing `Text` columns stay `Text`, just with new encrypted values written.

---

## Dependencies Summary

```toml
# api/pyproject.toml — new additions
"sqlalchemy-utils>=0.41.2",
"cryptography>=42.0.0",
```

No new frontend dependencies needed (i18next + react-i18next already present).
