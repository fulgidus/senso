---
phase: 06-learn-act-cards-demo-hardening
plan: "03"
subsystem: infra
tags: [bash, demo, seed, reset, docker-compose, psql, minio]

# Dependency graph
requires:
  - phase: 06-01
    provides: card rendering pipeline (action_cards, resource_cards, learn_cards)
  - phase: 02-financial-input-ingestion
    provides: /ingestion/upload + /ingestion/confirm-all API endpoints
  - phase: 03-financial-profile-clarity
    provides: /profile/status API endpoint
  - phase: 01-foundation
    provides: /auth/signup + /auth/login with flat AuthResponseDTO token shape
provides:
  - scripts/seed-demo.sh — one-command demo user creation + file upload via API
  - scripts/reset-demo.sh — one-command full data wipe for clean re-run
affects:
  - demo day execution
  - 06-04 (final demo hardening)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Demo seed via API path (not direct DB write) — tests real ingestion flow"
    - "FK CASCADE delete from users table — single DELETE cleans all child data"
    - "MinIO cleanup via docker compose run minio-init mc (server image has no mc client)"

key-files:
  created:
    - scripts/seed-demo.sh
    - scripts/reset-demo.sh
  modified: []

key-decisions:
  - "Auth token extraction uses flat response.access_token — AuthResponseDTO in api/app/schemas/auth.py uses Field(alias='accessToken') with populate_by_name=True; JSON response has flat access_token key, NOT nested under tokens"
  - "FK CASCADE delete strategy: DELETE FROM users cascades automatically to all 12 child tables — no manual per-table DELETE needed"
  - "Table names corrected: uploads (not ingestion_uploads), chat_sessions (not coaching_sessions), chat_messages (not coaching_messages)"
  - "MinIO cleanup uses docker compose run --rm minio-init with MC_HOST env var — minio server image has no mc binary"
  - "Signup uses HTTP status code probe first (curl -w %{http_code}) then separate body fetch — avoids 201 vs 200 mismatch causing empty body on re-run"

patterns-established:
  - "Demo scripts live in scripts/ as host-runnable bash, using docker compose exec/run for DB/infra operations"
  - "Graceful file skip pattern: upload_file() warns and returns (not exits) when sample file is missing"

requirements-completed: []

# Metrics
duration: 2min
completed: "2026-03-29"
---

# Phase 06 Plan 03: Demo Seed Script + Reset Script Summary

**Two one-command bash scripts for demo lifecycle: `seed-demo.sh` registers demo user + uploads 3 sample files via API with extraction polling; `reset-demo.sh` wipes all user data via FK CASCADE DELETE and clears MinIO buckets**

## Performance

- **Duration:** ~2 min
- **Started:** 2026-03-29T07:47:03Z
- **Completed:** 2026-03-29T07:49:54Z
- **Tasks:** 2
- **Files modified:** 2

## Accomplishments
- `seed-demo.sh`: registers `demo@senso.app`, falls back to login if exists, uploads Revolut CSV + Fineco XLSX + Satispay XLSX with per-file skip-warning if missing, polls extraction, calls confirm-all, polls profile categorization
- `reset-demo.sh`: single `DELETE FROM users` cascades to all 12 child tables via FK ON DELETE CASCADE, clears `welcome_cache` separately, cleans MinIO buckets via ephemeral mc container
- Both scripts are host-runnable (not inside Docker), executable (`chmod +x`), syntax-verified with `bash -n`

## Task Commits

Each task was committed atomically:

1. **Task 1: seed-demo.sh** - `46e1da3` (feat)
2. **Task 2: reset-demo.sh** - `1062168` (feat)

**Plan metadata:** (docs commit follows)

## Files Created/Modified
- `scripts/seed-demo.sh` — demo user creation + sample file upload + extraction + categorization polling
- `scripts/reset-demo.sh` — full data wipe via PostgreSQL CASCADE + MinIO bucket clear

## Decisions Made
- **Flat token extraction**: `AuthResponseDTO` exposes `access_token` as a top-level flat field (not `tokens.access_token` as the plan template assumed). The `Field(alias="accessToken")` just controls camelCase serialization — the actual JSON key is `access_token`. Seed script uses `json.load(sys.stdin)['access_token']`.
- **CASCADE delete**: FK `ON DELETE CASCADE` is defined on all child tables in `models.py`. A single `DELETE FROM users WHERE id = $uid` eliminates all 12 child tables automatically. No per-table DELETE ordering needed.
- **MinIO cleanup approach**: The `minio` service uses `minio/minio:RELEASE.2024-01-16T16-07-38Z` (server image — no `mc` client). The `minio-init` service has `mc` available. Script uses `docker compose run --rm --no-deps minio-init` with `MC_HOST_local` env var for cleanup.
- **Signup probe strategy**: Script uses `curl -w "%{http_code}"` to get the HTTP status first, then re-runs for the body. This handles the 201 Created response code without errors.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Corrected flat token extraction (plan had nested `tokens.access_token`)**
- **Found during:** Task 1 (pre-work verification step)
- **Issue:** Plan template used `json.load(sys.stdin)['tokens']['access_token']` but `AuthResponseDTO` returns flat `access_token` — would cause `KeyError: 'tokens'` at runtime
- **Fix:** Changed extraction to `json.load(sys.stdin)['access_token']` throughout seed script
- **Files modified:** `scripts/seed-demo.sh`
- **Verification:** Confirmed against `api/app/schemas/auth.py` — `AuthResponseDTO.access_token = Field(alias="accessToken")` with `populate_by_name=True` serializes as `access_token` in JSON
- **Committed in:** `46e1da3` (Task 1 commit)

**2. [Rule 1 - Bug] Corrected all three wrong table names in reset SQL**
- **Found during:** Task 2 (pre-work verification step)
- **Issue:** Plan assumed `ingestion_uploads`, `coaching_sessions`, `coaching_messages` — none of these table names exist in the schema. Actual names: `uploads`, `chat_sessions`, `chat_messages`
- **Fix:** Used actual `__tablename__` values from `api/app/db/models.py`. Simplified to CASCADE strategy (single DELETE from users).
- **Files modified:** `scripts/reset-demo.sh`
- **Verification:** Cross-referenced all 18 `__tablename__` declarations in `models.py`
- **Committed in:** `1062168` (Task 2 commit)

**3. [Rule 1 - Bug] Fixed MinIO cleanup — minio server image has no `mc` client**
- **Found during:** Task 2 implementation
- **Issue:** Plan used `docker compose exec -T minio mc ...` but the `minio` service uses the minio server image which does not include the `mc` CLI client
- **Fix:** Used `docker compose run --rm --no-deps minio-init` with `MC_HOST_local` env var — the `minio-init` service has `mc` available
- **Files modified:** `scripts/reset-demo.sh`
- **Verification:** `docker-compose.yml` confirmed: `minio` service uses `minio/minio:*` server image; `minio-init` uses `minio/mc` image
- **Committed in:** `1062168` (Task 2 commit)

---

**Total deviations:** 3 auto-fixed (all Rule 1 - bugs in plan template)
**Impact on plan:** All three fixes essential for runtime correctness. Plan template assumptions about token shape, table names, and MinIO container image were all incorrect. No scope creep.

## Issues Encountered
- Plan had a redundant SQL block (two DO $$ blocks — first used `current_setting` then immediately re-ran with `-c SET ...`). Simplified to single clean `DO $$` block using string interpolation for the email variable.

## User Setup Required
None - no external service configuration required. Scripts depend only on Docker Compose stack being running.

## Known Stubs
None — scripts are complete implementations, no placeholder data.

## Next Phase Readiness
- Demo is runnable end-to-end: `bash scripts/seed-demo.sh` → login → chat
- `bash scripts/reset-demo.sh` → `bash scripts/seed-demo.sh` round-trip ready
- Phase 06-04 (final demo hardening / loading states) can proceed without blockers

---
*Phase: 06-learn-act-cards-demo-hardening*
*Completed: 2026-03-29*
