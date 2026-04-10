# Phase 27: Admin username enforcement - Context

**Gathered:** 2026-04-10 (updated 2026-04-10)
**Status:** Ready for planning

<domain>
## Phase Boundary

Enforce that admin users must have an `admin_handle` (`!handle`) set before accessing normal app functionality. Pre-Phase-13 admin accounts may have null `username` AND null `admin_handle` columns.

Two-track fix:
1. **username column** — silently auto-assigned (DB migration + signup fix). No user interaction.
2. **admin_handle column** — blocking gate modal the admin must complete before the app shell renders.

The gate must apply on every page load for admin users. Once set, it disappears.

</domain>

<decisions>
## Implementation Decisions

### What triggers the gate
- **D-01:** Gate condition: `user.isAdmin === true && (!user.adminHandle || user.adminHandle === "")`.
- **D-02:** The gate is applied by the frontend — an AuthContext-level check in `AppShell` renders a blocking modal before the app shell when the condition is true.

### Username column (silent fix — no user interaction)
- **D-09:** Fix admin signup: change `generate_admin_username()` call to `generate_username(db)` in `auth_service.py`. New admin signups will receive a `$adj-noun-N` username like regular users.
- **D-10:** DB migration: add logic in `_add_missing_columns()` in `session.py` to auto-assign a unique `$adj-noun-N` username to any existing admin user where `username IS NULL`. Uses `generate_username(db)` for uniqueness.
- **D-11:** No new API endpoint needed for the username column fix — it is purely a backend migration + signup code change.

### admin_handle gate (blocking modal)
- **D-03:** A blocking modal rendered by `AppShell` (not a separate route). Admin cannot dismiss it until `admin_handle` is saved.
- **D-04:** Modal is non-dismissable (no close button, no backdrop click to close). The only exit is successfully saving a valid handle.
- **D-05:** Existing `POST /admin/claim-handle` endpoint is reused to save the handle. No new backend endpoint needed for the gate itself.

### admin_handle format validation
- **D-12:** The handle input in the modal enforces: lowercase alphanumeric characters and hyphens only, minimum 3 characters, maximum 30 characters. Reserved handles (e.g. `!admin`) are rejected. The `!` prefix is added by the frontend (user types without it) or validated by the backend. Validation runs on both frontend (instant feedback) and backend (authoritative).

### Username column semantics (clarified)
- **D-08:** The `username` column stores `$adj-noun-N` for ALL users including admins. It is the public pseudonymous identity used in messaging (`sha256($username)`). `admin_handle` is a separate `!handle` identity column only for admins.
- There is no "username setup modal" — username is always auto-generated, never user-chosen.

### Agent's Discretion
- Exact modal styling and layout
- Whether to show the format hint inline or as a tooltip
- Placement of error messages within the modal
- Whether the existing Settings handle-claim input can be lifted into the modal or rewritten fresh
- Animation/transition for the modal appearing on app load

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Frontend — gate implementation
- `senso/src/components/AppShell.tsx` — where the gate modal renders; admin check at line ~141; look for `user.isAdmin` check
- `senso/src/features/auth/AuthContext.tsx` — `updateUser(partial)` already available; call `updateUser({ adminHandle })` after successful claim
- `senso/src/features/auth/session.ts` — `RawUser` and `User` types; `admin_handle` field at lines ~32 and ~55
- `senso/src/features/auth/types.ts` — `User` type with `adminHandle?: string | null`

### Frontend — existing handle claim UI (reuse or adapt)
- `senso/src/features/settings/SettingsScreen.tsx` — existing `handleClaimHandle()` at line ~161; calls `POST /admin/claim-handle`; calls `updateUser({ adminHandle: res.admin_handle })`

### Backend — username fix
- `api/app/services/auth_service.py` — `signup()` at line ~112; change `generate_admin_username()` to `generate_username(db)` for admin users
- `api/app/services/username_generator.py` — `generate_username(db)` function; reuse for both fix and migration
- `api/app/db/session.py` — `_add_missing_columns()` migration pattern; add username auto-assign here

### Backend — admin_handle claim endpoint (already exists)
- `api/app/api/admin.py` — `POST /admin/claim-handle` at line ~353; validates uniqueness; stores `!`-prefixed handle; add format validation (lowercase alphanum+hyphens, 3-30 chars, reject reserved handles)

### Database
- `api/app/db/models.py` — `User.username` (~line 125, `$adj-noun-N`); `User.admin_handle` (~line 133, `!handle`); both `nullable=True`

</canonical_refs>

<code_context>
## Existing Code Insights

### username vs admin_handle columns
- `username` — `$adj-noun-N` pseudonym; used in messaging hash (`sha256($username)`); auto-generated at signup; never user-chosen; stored in `User.username`
- `admin_handle` — `!handle`; admin-specific identity; user-chosen; stored in `User.admin_handle`; claimable in Settings (POST /admin/claim-handle already exists)

### Existing handle claim flow (Settings)
`SettingsScreen.tsx` already has a working `!handle` claim flow. The gate modal can reuse or closely mirror this logic:
```tsx
const res = await apiRequest<{ admin_handle: string }>(
    getBackendBaseUrl(), "/admin/claim-handle",
    { method: "POST", body: { adminHandle: `!${raw}` } }
)
updateUser({ adminHandle: res.admin_handle })
```

### Gate logic (AppShell)
```tsx
// In AppShell (line ~141 admin section):
if (user.isAdmin && !user.adminHandle) {
    // Render blocking modal — do NOT render app shell content
}
```

### updateUser is already available
`AuthContext.updateUser(partial)` merges partial fields into the user object in memory. After a successful claim, call `updateUser({ adminHandle: savedHandle })` to dismiss the gate without a full page reload.

### No Alembic — use _add_missing_columns()
Per CONVENTIONS.md: schema changes go in `_add_missing_columns()` in `api/app/db/session.py`. The migration to auto-assign usernames should be added there using raw SQL or ORM query.

### Integration Points
- `AppShell.tsx` → adds gate before app content renders
- `auth_service.py` → signup() fix (1-line change)
- `session.py` → _add_missing_columns() migration
- `api/admin.py` → claim-handle validation tightening (format rules)

</code_context>

<specifics>
## Specific Ideas

- Admin sees a modal they cannot close, with a single text field (no `!` prefix visible — frontend adds it), a character count hint, and inline error feedback for invalid/taken handles.
- The `!admin` reserved handle should be explicitly rejected (it was the old default username value; no admin should be able to claim it as their handle identity).

</specifics>

<deferred>
## Deferred Ideas

- Enforcing username gate for regular (non-admin) users — deferred; Phase 13 generates usernames at signup so only edge cases would be affected.
- Renaming an existing admin_handle — deferred; handles are intended to be permanent once claimed.
- Rate-limiting on claim-handle endpoint — deferred to a security hardening phase.

</deferred>

---

*Phase: 27-admin-username-enforcement*
*Context gathered: 2026-04-10 (updated 2026-04-10)*
