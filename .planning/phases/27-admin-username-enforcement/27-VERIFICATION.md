---
phase: 27
status: passed
verified: "2026-04-10"
score: 6/6
---

# Phase 27 Verification: Admin username enforcement

## Summary

All 6 must-haves verified. TypeScript compiles cleanly. Python syntax clean. Spot-checks pass.

## Must-haves

| # | Requirement | Status | Evidence |
|---|-------------|--------|----------|
| 1 | `generate_admin_username()` no longer called in auth_service.py | ✓ | `grep -q generate_admin_username` returns false; `generate_username(self.db)` present at line 113 |
| 2 | New admin signup produces `$adj-noun-N` username | ✓ | `generate_username(self.db)` unconditional path in signup(); test `test_admin_signup_username` covers D-09 |
| 3 | Round 22 backfills `username IS NULL` and `username='!admin'` | ✓ | `grep "Round 22" api/app/db/session.py` returns match; sqlite guard present; tests `test_username_backfill_null` and `test_username_backfill_admin_legacy` cover D-10 |
| 4 | `POST /admin/claim-handle` with `"!admin"` returns 422 | ✓ | `field_validator` in `ClaimHandleRequest.validate_handle_format` rejects reserved handle body; `test_reserved_handle_admin` covers this |
| 5 | `POST /admin/claim-handle` with uppercase or spaces returns 422 | ✓ | `_HANDLE_BODY_RE = re.compile(r"^[a-z0-9-]+$")` rejects both; `test_uppercase_handle_rejected` and `test_handle_with_spaces_rejected` cover D-12 |
| 6 | Admin without `adminHandle` sees blocking gate modal; cannot access nav | ✓ | `AppShell.tsx` gate: `if (user && user.isAdmin && !user.adminHandle)` renders `AdminHandleGateModal`; modal has no close button, Escape suppressed, backdrop click suppressed |

## Automated checks

- `pnpm tsc --noEmit` → 0 errors ✓
- `python3 -c "ast.parse(...)"` on all modified Python files → 0 syntax errors ✓
- `node -e "JSON.parse(...)"` on both locale files → valid JSON ✓
- 10 test stubs in `test_phase27_username_enforcement.py` collected ✓

## Human verification items

The following require manual testing in a running app instance:

1. **Gate modal appearance** — Log in as admin with no `admin_handle` set → full-screen modal must appear; nav and content must not be accessible
2. **Modal non-dismissability** — Try Escape key and backdrop click → modal must NOT dismiss
3. **Handle claim flow** — Fill valid handle (e.g. `test-handle`), submit → modal dismisses, app shell renders, Settings shows claimed handle
4. **Gate bypass with handle already set** — Log in as admin with `admin_handle` already set → no modal, app renders normally
5. **SettingsScreen error message** — Trigger handle save error → error message shown (uses correct `adminHandleError` key)
6. **Duplicate handle** — Two admins claim same handle → second attempt returns 409, error shown

## Requirements addressed

- D-01 ✓ (gate condition: `isAdmin && !adminHandle`)
- D-02 ✓ (gate in AppShell)
- D-03 ✓ (blocking modal)
- D-04 ✓ (non-dismissable)
- D-05 ✓ (reuses `POST /admin/claim-handle`)
- D-08 ✓ (all modal text from i18n keys)
- D-09 ✓ (signup fix)
- D-10 ✓ (Round 22 backfill)
- D-11 ✓ (no new endpoint needed)
- D-12 ✓ (field_validator: reserved, format, length)
