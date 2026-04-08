---
plan: "23-04"
phase: "23"
status: complete
completed: 2026-04-08
---

# Summary: Plan 23-04 - Error Path E2E (Real Stack)

## What Was Built

5 error-path tests against real stack: expired token redirect, bad file rejection (API + UI), LLM timeout, and offline banner.

## Key Files Created/Modified

- `senso/e2e/real-stack/error-paths.spec.ts` - 5 tests
- `api/tests/llm_stub_server.py` - Added `__SLOW_RESPONSE_TEST__` slow-response trigger (asyncio.sleep 90s)

## Decisions Made

- Token expiry test corrupts BOTH access_token AND refresh_token in localStorage to prevent silent refresh
- Bad upload API test asserts `< 500` (not 400) since file type validation happens at extraction time, not upload time
- Frontend bad upload test checks no uncaught JS errors (the `accept` attribute prevents most bad files)
- LLM timeout test uses 45s wait (API timeout is ~30s for openrouter, plus network overhead)
- Offline banner uses `[role="alert"]` selector matching the OfflineBanner component's `role="alert"` prop

## Self-Check: PASSED

- [x] Slow-response trigger added to stub (asyncio.sleep(90))
- [x] OfflineBanner selector matches actual component: `role="alert"`
- [x] All 5 tests TypeScript-clean and discovered
- [x] Token storage keys match: `senso.auth.access_token`, `senso.auth.refresh_token`
