# Phase 27: Admin username enforcement — Research

**Date:** 2026-04-10
**Status:** RESEARCH COMPLETE

---

## Summary

This phase has two independent workstreams that can execute in parallel:

1. **Backend**: fix admin signup to generate `$adj-noun-N` username; DB migration to backfill existing admins; strengthen `claim-handle` validation.
2. **Frontend**: add blocking `AdminHandleGateModal` in `AppShell` + i18n keys + fix existing i18n bug in Settings.

All implementation decisions are well-defined in CONTEXT.md. Code paths are confirmed by codebase inspection below.

---

## Codebase Investigation

### Frontend — AppShell.tsx

- `export function AppShell({ children }: AppShellProps)` starts at **line 299**.
- Return statement at **line 400** renders `<div className="flex min-h-screen flex-col bg-background">`.
- **No admin gate logic exists**. The only `user.isAdmin` check (line 525) is inside the sidebar nav to show an admin submenu — it does not block the shell.
- **Gate insertion point**: immediately before the `return (...)` at line 400. If `user.isAdmin && !user.adminHandle`, render `<AdminHandleGateModal />` and return early.
- `useAuthContext()` at line 307 already destructures `user` and `signOut` — `updateUser` is also available from AuthContext, just needs to be destructured.

### Frontend — AuthContext.tsx

- `updateUser: (updated: Partial<User>) => void` is typed in `AuthContextValue`.
- Calling `updateUser({ adminHandle: savedHandle })` after a successful claim dismisses the gate without page reload.
- **No changes needed** to AuthContext itself.

### Frontend — types.ts / session.ts

- `User.adminHandle?: string | null` already exists (Phase 14).
- `RawUser.admin_handle?: string | null` already mapped via `parseUser()` to `adminHandle`.
- **No type changes needed**.

### Frontend — SettingsScreen.tsx (source of truth for modal logic)

The existing handle claim flow at lines 155–185 is the exact pattern to reuse:

```tsx
const [handleInput, setHandleInput] = useState(user.adminHandle?.replace(/^!/, "") ?? "")
const [handleSaving, setHandleSaving] = useState(false)
const [handleError, setHandleError] = useState<string | null>(null)
const [handleSuccess, setHandleSuccess] = useState(false)

const handleClaimHandle = useCallback(async () => {
    const raw = handleInput.trim().replace(/^!/, "")
    if (!raw) return
    const token = readAccessToken()
    if (!token) return
    setHandleSaving(true)
    setHandleError(null)
    setHandleSuccess(false)
    try {
        const res = await apiRequest<{ admin_handle: string }>(getBackendBaseUrl(), "/admin/claim-handle", {
            method: "POST",
            token,
            body: { adminHandle: `!${raw}` },
        })
        updateUser({ adminHandle: res.admin_handle })
        setHandleSuccess(true)
    } catch {
        setHandleError(t("settings.handleError"))  // ← BUG: key is "settings.adminHandleError"
    } finally {
        setHandleSaving(false)
    }
}, [handleInput, t, updateUser])
```

Input element already restricts to `[a-z0-9-]` via `onChange` regex and has `maxLength={32}`.

**Bug**: `t("settings.handleError")` at line 180 — the actual i18n key is `settings.adminHandleError` (exists in both `it.json` and `en.json`). Must be fixed in SettingsScreen.tsx.

### Frontend — RecoveryPhraseInterstitial.tsx (reference for blocking overlay)

The existing full-screen blocking interstitial uses `fixed inset-0 z-50` overlay pattern. The admin gate modal can follow this same approach.

### Backend — api/app/api/admin.py

Current `ClaimHandleRequest` (lines 343–347):
```python
class ClaimHandleRequest(BaseModel):
    handle: str = Field(min_length=2, description="Admin handle, must start with !")
    model_config = ConfigDict(populate_by_name=True)
```

The endpoint (line 353) checks:
1. `handle.startswith("!")` — raises 422 if not
2. Uniqueness against `admin_handle` column — raises 409 if taken
3. No format validation beyond the `!` prefix check and `min_length=2`

**Required changes (D-12)**:
- Change `Field(min_length=2)` to `Field(min_length=4)` (covers `!` + 3 chars min)
- Add `@field_validator("handle")` enforcing:
  - Must start with `!`
  - After stripping `!`: lowercase alphanum+hyphens only (`^[a-z0-9-]+$`)
  - After stripping `!`: length 3–30 chars
  - Reject reserved handles: `!admin`, `!sistema`, `!senso`

Note: The existing `ClaimHandleRequest.handle` field receives the value with `!` prefix (the frontend sends `!${raw}`). The validator must account for this.

### Backend — api/app/services/auth_service.py

Line 113:
```python
user.username = (
    generate_admin_username() if is_admin else generate_username(self.db)
)
```

`generate_admin_username()` returns the string `"!admin"`. **D-09** requires changing this to `generate_username(self.db)` so admin signups receive `$adj-noun-N` instead.

### Backend — api/app/db/session.py

Current `_add_missing_columns()` runs sequential migration rounds (numbered Round 1–21+).
**D-10** requires a new round (Round 22) that:
1. Finds all users where `username IS NULL` — assigns a unique `$adj-noun-N`
2. Finds all users where `username = '!admin'` — reassigns a unique `$adj-noun-N`

Pattern: use raw SQL `UPDATE users SET username = ... WHERE ...` wrapped in a Python loop for each admin needing a username.

Implementation pattern (follows existing Round 17 convention):
```python
# ── Round 22: Phase 27 - Backfill admin usernames ──────────────────────────
# Inline logic (cannot call generate_username here without a session)
# Must query + update in a loop using engine.connect()
```

The function uses `engine.connect()` for raw SQL. To call `generate_username(db)` we need a session, not just a connection. Solution: use `with SessionLocal() as db_session:` inside the backfill block or generate a unique username using pure SQL random selection with a retry loop.

Simplest approach: Run a Python loop after the SQL migrations block using `SessionLocal()` to backfill admin usernames.

### Backend — api/app/db/models.py

- `User.username` at line 125: `Column(String(64), unique=True, nullable=True, default=None)` — no changes needed
- `User.admin_handle` at line 133: `Column(String(64), unique=True, nullable=True, default=None)` — no changes needed

---

## Validation Architecture

### Unit tests
- `test_claim_handle_validation`: POST `/admin/claim-handle` with invalid handles (too short, uppercase, spaces, reserved `!admin`) → expect 422
- `test_claim_handle_uniqueness`: Claim same handle twice → expect 409
- `test_admin_signup_username`: Admin signup produces `$adj-noun-N` username (not `!admin`)
- `test_username_backfill`: Call `_add_missing_columns()` on a DB with admin users where `username IS NULL` or `username = '!admin'` → all get valid `$adj-noun-N`

### Integration check
- Admin user without `admin_handle` → AppShell renders `AdminHandleGateModal` (not the nav shell)
- After successful claim → `updateUser({ adminHandle })` called → gate dismisses
- Admin user with `admin_handle` → gate absent, app renders normally

---

## Risk Notes

1. **Backfill collision**: `generate_username(db)` does 100 retries before raising. With the small admin user count this is trivial, but the loop must use a live session not the raw connection.
2. **`!admin` existing handles**: If any admin already has `admin_handle = "!admin"`, the reserved-handle validation on the endpoint would block future claims of that value (correct). No existing `admin_handle` values should be touched.
3. **Gate + Settings duplication**: `SettingsScreen.tsx` shows a handle claim form when `!user.adminHandle`. After the gate is in place, an admin can only reach Settings after the gate is dismissed. This is consistent. The Settings form remains as a "view claimed handle" display once the handle is set.
4. **`t("settings.handleError")` bug in SettingsScreen**: Low severity but visible to users. Fix in the same plan as the modal work.

---

## Recommended Plan Split

| Plan | Workstream | Wave | Files |
|------|-----------|------|-------|
| 27-01 | Backend: signup fix + migration + claim-handle validation | 1 | `api/app/services/auth_service.py`, `api/app/db/session.py`, `api/app/api/admin.py` |
| 27-02 | Frontend: AdminHandleGateModal + AppShell gate + i18n + Settings bug fix | 1 | `senso/src/components/AppShell.tsx`, `senso/src/components/AdminHandleGateModal.tsx` (new), `senso/src/i18n/locales/it.json`, `senso/src/i18n/locales/en.json`, `senso/src/features/settings/SettingsScreen.tsx` |

Both plans are independent and can execute in parallel (Wave 1).
