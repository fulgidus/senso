---
phase: 01-runtime-account-foundation
plan: 01
subsystem: auth
tags: [fastapi, jwt, bcrypt, oauth, pytest]
requires:
  - phase: none
    provides: greenfield backend auth foundation
provides:
  - FastAPI auth endpoints for signup, login, refresh, me, logout, and Google OAuth start/callback
  - JWT access token + rotating refresh token lifecycle with 7-day rolling policy
  - Automated endpoint tests covering AUTH-01/AUTH-02/AUTH-03 behavior
affects: [phase-02-financial-input-ingestion, frontend-auth-integration]
tech-stack:
  added: [fastapi, pydantic, sqlalchemy, bcrypt, pyjwt, pytest, httpx]
  patterns: [fastapi-owned-auth, refresh-token-rotation, fallback-safe-oauth]
key-files:
  created:
    - api/app/api/auth.py
    - api/app/services/auth_service.py
    - api/app/core/security.py
    - api/tests/test_auth_endpoints.py
  modified:
    - api/app/main.py
    - api/app/core/config.py
    - api/pyproject.toml
    - api/tests/conftest.py
key-decisions:
  - "Auth/session source of truth stays in FastAPI with no Supabase-owned auth flow in Phase 1."
  - "Access tokens use 15-minute TTL while refresh tokens rotate single-use with 7-day rolling renewal."
patterns-established:
  - "Router + service split: endpoint transport logic in api/auth.py, token/session policy in auth_service.py"
  - "Deterministic degraded mode for OAuth: explicit { fallback: email_password, reason: google_unavailable } payload"
requirements-completed: [AUTH-01, AUTH-02, AUTH-03]
duration: 6min
completed: 2026-03-23
---

# Phase 1 Plan 1: Runtime Account Foundation Summary

**FastAPI-native authentication shipped with bcrypt credentials, JWT refresh rotation, and Google OAuth fallback-safe contracts backed by executable endpoint tests.**

## Performance

- **Duration:** 6 min
- **Started:** 2026-03-23T22:52:00Z
- **Completed:** 2026-03-23T22:58:28Z
- **Tasks:** 3
- **Files modified:** 14

## Accomplishments
- Added backend auth DTO contracts and complete RED/GREEN pytest coverage for auth endpoints.
- Implemented FastAPI auth service with password hashing, token mint/verify, refresh-session persistence, token revocation, and `/auth/me` identity resolution.
- Implemented Google OAuth start/callback routes with deterministic fallback behavior so email/password auth remains usable when provider config/exchange is unavailable.

## Task Commits

Each task was committed atomically:

1. **Task 1: Create auth contracts and Wave 0 backend test scaffold** - `52450eb` (test)
2. **Task 2: Implement email auth + JWT rotation + persistence services** - `a44b076` (feat)
3. **Task 3: Implement Google OAuth endpoints with fallback-safe behavior** - `a8e9990` (feat)

## Files Created/Modified
- `api/pyproject.toml` - Python project/test dependencies and pytest configuration
- `api/app/main.py` - FastAPI application factory and auth router registration
- `api/app/schemas/auth.py` - Auth request/response DTOs
- `api/app/core/config.py` - Runtime auth and OAuth settings
- `api/app/core/security.py` - Password hashing and JWT helpers
- `api/app/db/models.py` - User and refresh session models
- `api/app/db/session.py` - In-memory persistence layer for users and refresh sessions
- `api/app/services/auth_service.py` - Auth business logic, token lifecycle, and OAuth behavior
- `api/app/api/auth.py` - FastAPI auth routes and fallback payload handling
- `api/tests/conftest.py` - Shared TestClient fixture for backend tests
- `api/tests/test_auth_endpoints.py` - Auth endpoint tests for signup/login/refresh/me/logout/google

## Decisions Made
- FastAPI remains the single owner of authentication and session logic per phase constraints.
- Refresh token rotation was implemented as single-use revocation with new `jti` issuance at every successful refresh.
- OAuth degraded-mode payload was made deterministic to simplify frontend fallback routing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Python test tooling unavailable in host environment**
- **Found during:** Task 1
- **Issue:** `pytest` not installed and system Python rejected global package install (PEP 668 managed env).
- **Fix:** Created local virtual environment `.venv` and installed required test/runtime packages there.
- **Files modified:** (environment/runtime only, no tracked source files)
- **Verification:** `.venv/bin/pytest api/tests/test_auth_endpoints.py -q` executed successfully in RED and GREEN stages.
- **Committed in:** N/A (runtime setup only)

**2. [Rule 3 - Blocking] Test import path prevented app startup in pytest**
- **Found during:** Task 1
- **Issue:** `ModuleNotFoundError: No module named 'app'` blocked test execution.
- **Fix:** Added deterministic `sys.path` bootstrap in `api/tests/conftest.py`.
- **Files modified:** `api/tests/conftest.py`
- **Verification:** Test runner moved from import error to expected RED route failures.
- **Committed in:** `52450eb`

**3. [Rule 2 - Missing Critical] Default JWT secret strength below recommended minimum**
- **Found during:** Task 2
- **Issue:** PyJWT emitted insecure key length warnings for HS256 default secret.
- **Fix:** Increased fallback `JWT_SECRET` default to a 32+ byte development-safe value.
- **Files modified:** `api/app/core/config.py`
- **Verification:** Re-ran test suite with warnings eliminated.
- **Committed in:** `a44b076`

**4. [Rule 1 - Bug] Google auth URL parameters were not percent-encoded**
- **Found during:** Task 3
- **Issue:** Redirect URI and scope formatting risked malformed provider URLs.
- **Fix:** Switched URL construction to `urllib.parse.urlencode` and added configured-provider test.
- **Files modified:** `api/app/services/auth_service.py`, `api/tests/test_auth_endpoints.py`
- **Verification:** `test_google_start_returns_auth_url_when_provider_configured` passes.
- **Committed in:** `a8e9990`

---

**Total deviations:** 4 auto-fixed (1 bug, 1 missing critical, 2 blocking)
**Impact on plan:** All deviations were correctness/security/runtime unblockers; no scope creep beyond plan intent.

## Auth Gates
None.

## Issues Encountered
- None beyond the auto-fixed execution blockers above.

## User Setup Required
None - no external service configuration required for these tests.

## Next Phase Readiness
- Backend auth contracts and token lifecycle are stable for frontend integration work in 01-02.
- Google OAuth exchange currently returns deterministic fallback in degraded mode; provider-token exchange wiring can be completed once secrets/integration are available.

## Self-Check: PASSED

- FOUND: `.planning/phases/01-runtime-account-foundation/01-runtime-account-foundation-01-SUMMARY.md`
- FOUND commits: `52450eb`, `a44b076`, `a8e9990`
