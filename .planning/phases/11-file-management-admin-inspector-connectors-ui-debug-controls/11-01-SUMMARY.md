---
phase: 11-file-management-admin-inspector-connectors-ui-debug-controls
plan: 01
subsystem: auth
tags: [rbac, role, fastapi, sqlalchemy, typescript]

# Dependency graph
requires:
  - phase: 01-runtime-and-account-foundation
    provides: User model, auth endpoints, UserDTO, require_admin
  - phase: 10-transparency-and-security-with-about-page-encryption-at-rest-and-llm-no-data-retention
    provides: strict_privacy_mode column, Round 13-14 migrations
provides:
  - role column in users table (VARCHAR(16), default 'user')
  - Round 15 migration adding role column with backfill for existing admins
  - require_tester dependency in admin.py
  - UserDTO.role field
  - Frontend User type role field
  - Frontend parseUser() role mapping
affects:
  - 11-02-PLAN (admin inspector uses role for Inspect button visibility)
  - 11-03-PLAN (debug controls use require_tester)
  - 11-04-PLAN (file management may use role checks)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "RBAC via role column (user/tester/moderator/admin) with is_admin compat fallback"
    - "require_admin checks role=='admin' OR is_admin for backward compatibility"
    - "require_tester checks role in ('tester','admin') OR is_admin"

key-files:
  created: []
  modified:
    - api/app/db/models.py
    - api/app/db/session.py
    - api/app/api/admin.py
    - api/app/schemas/auth.py
    - api/app/services/auth_service.py
    - senso/src/features/auth/session.ts
    - senso/src/features/auth/types.ts

key-decisions:
  - "role column added alongside is_admin Boolean (not replacing it) for backward compat - existing code using is_admin=True continues to work"
  - "require_admin uses role=='admin' OR is_admin check - both signals count until full migration"
  - "require_tester: role in (tester, admin) OR is_admin - admins can access tester features"
  - "Round 15 backfill: UPDATE users SET role='admin' WHERE is_admin=TRUE - promotes existing admins on startup"

patterns-established:
  - "RBAC: role column is source of truth; is_admin is legacy compat column"
  - "All UserDTO constructions include role=user.role or 'user'"

requirements-completed: [FILE-01, RBAC-01]

# Metrics
duration: 3min
completed: 2026-03-31
---

# Phase 11 Plan 01: RBAC Role Column Summary

**Lightweight RBAC via `role` VARCHAR column on users table with Round 15 migration, `require_tester` dependency, and full UserDTO/frontend propagation**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-31T16:29:29Z
- **Completed:** 2026-03-31T16:32:52Z
- **Tasks:** 2
- **Files modified:** 7

## Accomplishments

- Added `role: str = Column(String(16), nullable=False, default="user")` to User model, supporting values: user/tester/moderator/admin
- Added Round 15 DB migration: idempotent ALTER TABLE + backfill UPDATE for existing admins
- Updated `require_admin` to check `role == "admin"` OR `is_admin` (backward compat)
- Added new `require_tester` dependency: `role in ("tester", "admin")` OR `is_admin`
- Updated `UserDTO` with `role: str = "user"` field
- Updated all auth service UserDTO constructions (signup, get_current_user, _issue_auth_response, update_me)
- Added `role?: string` to frontend `User` type and wired in `parseUser()` in session.ts

## Task Commits

Each task was committed atomically:

1. **Task 1: Add role column to User model and DB migration** - `e43a3a5` (feat)
2. **Task 2: Update auth service, UserDTO, require_admin, add require_tester, update frontend User type** - `f1f4bb8` (feat)

**Plan metadata:** (docs commit to follow)

## Files Created/Modified

- `api/app/db/models.py` - Added `role` column to User model (String(16), default="user")
- `api/app/db/session.py` - Added Round 15 migration + backfill; fixed `_seed_default_users` to set role
- `api/app/api/admin.py` - Updated `require_admin` to use role, added `require_tester` dependency
- `api/app/schemas/auth.py` - Added `role: str = "user"` to UserDTO
- `api/app/services/auth_service.py` - All UserDTO constructions include role; signup sets role="admin" for starting_admins
- `senso/src/features/auth/session.ts` - Added role to RawUser type and parseUser() mapping
- `senso/src/features/auth/types.ts` - Added `role?: string` to User type

## Decisions Made

- **Keep is_admin column**: Role column added alongside existing `is_admin` Boolean. The compat fallback (`OR is_admin`) in require_admin/require_tester ensures no breakage for existing admin users.
- **Round 15 backfill**: `UPDATE users SET role = 'admin' WHERE is_admin = TRUE AND (role = 'user' OR role IS NULL)` - runs at startup to promote pre-existing admins.
- **role="admin" for starting_admins on signup**: The auth service signup explicitly sets `role="admin"` when `is_admin` is True, ensuring new admin signups get the role column set correctly.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed `_seed_default_users` to set role for seeded admin users**
- **Found during:** Task 2 (auth service updates)
- **Issue:** `_seed_default_users` in session.py creates User objects without `role`. Starting admin seeds would get the ORM default ("user") rather than "admin", inconsistent with signup behavior.
- **Fix:** Added `role="admin" if is_admin else "user"` to User constructor in `_seed_default_users`
- **Files modified:** api/app/db/session.py
- **Verification:** Matches pattern established in auth_service.py signup
- **Committed in:** f1f4bb8 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 bug)
**Impact on plan:** Fix ensures seed users get proper role; no scope creep.

## Issues Encountered

None - Docker CLI unavailable in executor environment; compose verification deferred per existing STATE.md blocker.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- RBAC foundation complete: role column, require_tester dep, UserDTO, frontend type all wired
- Ready for Plan 02 (admin inspector Inspect button visibility using user.role)
- Ready for Plan 03 (debug controls using require_tester)
- Existing admin users promoted via Round 15 backfill on next startup

---
*Phase: 11-file-management-admin-inspector-connectors-ui-debug-controls*
*Completed: 2026-03-31*
