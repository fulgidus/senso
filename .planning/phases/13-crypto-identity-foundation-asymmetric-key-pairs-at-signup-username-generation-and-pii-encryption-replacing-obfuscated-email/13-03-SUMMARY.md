---
plan: 13-03
phase: 13-crypto-identity-foundation
status: complete
completed: 2026-04-03
commit: 318bca3
duration: ~15 min
---

# Summary: 13-03 — PII replacement + frontend types + avatar utilities

## What Was Built

**`api/app/api/admin.py`** — PII removal complete:
- `_obfuscate_email()` function deleted
- `MerchantMapAdminDTO.contributing_user_obfuscated` → `contributing_user_username`
- `list_merchant_map()` handler: `_obfuscate_email(user.email)` → `user.username`
- Admin merchant map no longer exposes any email-derived data

**`senso/src/features/auth/types.ts`** — User type extended:
- `username?: string | null` — pseudonymous identity (`$adj-noun-N` or `!admin`)
- `publicKeyB64?: string | null` — X25519 public key (base64)
- `signingKeyB64?: string | null` — Ed25519 verify key (base64)

**`senso/src/lib/user-avatar.ts`** — utilities updated:
- `stripUsernamePrefix(username)` — strips `$` or `!` prefix for display
- `getInitials()` — new fallback chain: firstName+lastName → firstName → username[0] (stripped) → email[0] → "U"
- `getDisplayName()` — new fallback chain: firstName → stripUsernamePrefix(username) → "Utente"

**`senso/src/components/AppShell.tsx`** — user menu display updated:
- Imports `stripUsernamePrefix` from user-avatar
- Both `{user.email}` occurrences in user menu replaced with `{user.username ? stripUsernamePrefix(user.username) : user.email}`
- Users with a username now see `witty-otter-42` (not email) in the nav

**`api/uv.lock`** — PyNaCl 1.6.2 added to lock file so it's baked into the container image.

## Verification

```
Backend: contributing_user_username in MerchantMapAdminDTO.model_fields ✓
Frontend: pnpm build exits 0 ✓ (chunk warning is pre-existing, unrelated to Phase 13)
```

## Files Modified

- `api/app/api/admin.py` — _obfuscate_email deleted, field renamed, handler updated
- `senso/src/features/auth/types.ts` — 3 new optional User fields
- `senso/src/lib/user-avatar.ts` — stripUsernamePrefix, updated getInitials + getDisplayName
- `senso/src/components/AppShell.tsx` — username display in user menu
- `api/uv.lock` — PyNaCl 1.6.2 pinned
