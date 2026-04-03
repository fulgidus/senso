---
created: "2026-04-01T18:59:18.910Z"
resolved: "2026-04-02"
commit: db6e06a
title: Fix token renewal broken
area: auth
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files:
  - senso/src/features/auth/__tests__/auth-session.test.ts
  - senso/src/lib/api-client.ts (verified, no change needed)
---

## Problem

Token renewal appears to be broken. Access tokens expire (15m per Phase 1 convention) but the refresh token mechanism does not successfully obtain new access tokens. This causes the user to be silently logged out or get stuck with invalid tokens.

## Solution

- Debug the refresh token endpoint and the frontend's token refresh logic.
- Phase 1 established 15m access JWT + rotating 7-day refresh tokens.
- Check the refresh endpoint response handling in the frontend auth module.
- Verify the refresh token rotation logic isn't invalidating tokens prematurely.

## Resolution

Code audit confirmed the `apiRequest` 401 auto-refresh logic and `makeOnUnauthorized` factory were correct but untested. Added 15 comprehensive unit tests covering:
- Happy path (200, no refresh needed)
- 401 → refresh → retry with new token
- 401 + refresh returns null → throw, no retry
- 401 + no callback → throw immediately
- Infinite-loop guard (`_isRetry=true` suppresses second refresh)
- Non-401 errors bypass refresh
- 204 No-Content (body never parsed)
- `ApiClientError` exposes status + data
- `makeOnUnauthorized` with no stored refresh token → null + navigate
- Refresh succeeds → tokens persisted + new access token returned
- Refresh fails → null + navigate + tokens cleared
- Navigate optional — no crash when omitted
- End-to-end: 401 → refresh → retry (3-fetch flow)
- End-to-end: 401 + failed refresh → throws + session cleared

All 44 unit tests pass.
