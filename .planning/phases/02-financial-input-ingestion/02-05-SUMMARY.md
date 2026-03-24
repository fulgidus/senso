---
phase: 02-financial-input-ingestion
plan: 05
subsystem: ui
tags: [react, typescript, tailwind, ingestion, upload, hooks]

# Dependency graph
requires:
  - phase: 02-financial-input-ingestion
    provides: FastAPI ingestion API endpoints (upload, list, confirm, retry, report, delete, extracted)
provides:
  - TypeScript types for UploadStatus, ExtractedDocument, Transaction, LineItem
  - API client functions for all 8 ingestion endpoints
  - useIngestion hook with polling, upload, confirm, retry, report, remove, getExtracted
  - IngestionScreen: full upload-to-confirm UI
  - UploadZone: drag-drop + file picker
  - FileList: 4-column table with {NEW} badge, Confirm/Confirm all, Inspect/Retry/Report/Remove
  - InspectModal: type-aware rendered (transactions table vs key-value cards)
  - RetryDialog: hint textarea with guardrail note
  - AuthedHome: delegating to IngestionScreen
affects: [03-financial-profile-coaching, 04-voice-coaching, 05-demo-hardening]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Feature module pattern: types.ts + api.ts + hook.ts + components in features/ingestion/"
    - "Polling via window.setTimeout with max-attempts guard (POLL_MAX_ATTEMPTS=40)"
    - "ExtractedDocument uses snake_case field names to match FastAPI model_dump(mode='json') output"

key-files:
  created:
    - senso/src/features/ingestion/types.ts
    - senso/src/features/ingestion/api.ts
    - senso/src/features/ingestion/useIngestion.ts
    - senso/src/features/ingestion/IngestionScreen.tsx
    - senso/src/features/ingestion/UploadZone.tsx
    - senso/src/features/ingestion/FileList.tsx
    - senso/src/features/ingestion/InspectModal.tsx
    - senso/src/features/ingestion/RetryDialog.tsx
  modified:
    - senso/src/features/auth/AuthedHome.tsx

key-decisions:
  - "ExtractedDocument TypeScript interface uses snake_case not camelCase — API returns payload_json via model_dump(mode='json') which preserves Python snake_case"
  - "IngestionScreen reads accessToken via readAccessToken() from storage module rather than getStoredTokens() (which doesn't exist)"
  - "UploadZone's Choose file button has pointer-events-none to avoid double-click (whole div is clickable)"
  - "FileList Confirm all button only renders when at least one successful extraction exists"

patterns-established:
  - "Feature module layout: types.ts → api.ts → hook.ts → components all colocated in src/features/{name}/"
  - "Polling pattern: window.setTimeout with Map<id,timer> ref, max-attempts guard, silent retry on error"

requirements-completed:
  - INGT-01
  - INGT-02
  - INGT-03

# Metrics
duration: 3min
completed: 2026-03-24
---

# Phase 2 Plan 05: Ingestion UI — Frontend Review Screen Summary

**Complete ingestion UI with drag-drop upload zone, 4-column file list table ({NEW} badge, Confirm all, Inspect/Retry/Report/Remove actions), type-aware Inspect modal (transactions vs key-value), and RetryDialog with hint — all wired to FastAPI ingestion API via polling hook.**

## Performance

- **Duration:** 3 min
- **Started:** 2026-03-24T22:33:03Z
- **Completed:** 2026-03-24T22:36:49Z
- **Tasks:** 2/3 (checkpoint at Task 3 awaiting human verification)
- **Files modified:** 9

## Accomplishments
- TypeScript types matching actual API snake_case payload_json output
- All 8 ingestion API client functions with proper error handling
- useIngestion hook with real-time polling (1.5s interval, 40 attempt limit), all CRUD operations
- IngestionScreen with upload zone + file list in sectioned layout
- FileList table with all D-34/35/36/37/38 decisions honored:
  - 4 columns: File, Type, Extraction Method, Actions
  - `{NEW}` amber/yellow pill badge for generated modules
  - Green checkmark ✓ for confirmed files
  - Correct action button set per status (Inspect, Retry, Confirm, Report, Remove)
  - Confirm all / All confirmed state
- InspectModal with type-aware rendering (transactions table for bank_statement, key-value cards for payslip/utility_bill/receipt)
- RetryDialog with hint textarea and guardrail note
- AuthedHome replaced — now renders IngestionScreen

## Task Commits

Each task was committed atomically:

1. **Task 1: Types, API client, useIngestion hook** - `1e8005c` (feat)
2. **Task 2: IngestionScreen, FileList, InspectModal, RetryDialog, wire into AuthedHome** - `5333124` (feat)

_Task 3 is a checkpoint:human-verify awaiting user verification._

## Files Created/Modified
- `senso/src/features/ingestion/types.ts` - UploadStatus, ExtractedDocument (snake_case), Transaction, LineItem types
- `senso/src/features/ingestion/api.ts` - All 8 API functions: uploadFile, listUploads, getUpload, getExtracted, confirmUpload, retryUpload, reportUpload, deleteUpload
- `senso/src/features/ingestion/useIngestion.ts` - Polling hook with upload/confirm/retry/report/remove/getExtracted
- `senso/src/features/ingestion/IngestionScreen.tsx` - Main screen: upload zone + file list + header
- `senso/src/features/ingestion/UploadZone.tsx` - Drag-drop + file picker, accepts CSV/XLSX/PDF/images
- `senso/src/features/ingestion/FileList.tsx` - 4-column table with {NEW} badge, actions, Confirm all
- `senso/src/features/ingestion/InspectModal.tsx` - Type-aware modal: transactions table, key-value cards
- `senso/src/features/ingestion/RetryDialog.tsx` - Hint textarea + guardrail note + Retry/Cancel
- `senso/src/features/auth/AuthedHome.tsx` - Replaced placeholder with IngestionScreen delegation

## Decisions Made
- **snake_case for ExtractedDocument**: The API's `get_extracted` endpoint returns `extracted.payload_json` which is `doc.model_dump(mode="json")`. Python model_dump uses snake_case field names. TypeScript interface updated accordingly (vs the plan's camelCase suggestion).
- **readAccessToken()**: Used `readAccessToken()` from `@/features/auth/storage` instead of `getStoredTokens()` — the actual storage module exports `readAccessToken()` not `getStoredTokens()`.
- **Confirm all visibility**: Only renders when `hasAnySuccess` — better UX than always showing.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Used correct token retrieval function**
- **Found during:** Task 2 (IngestionScreen)
- **Issue:** Plan referenced `getStoredTokens()?.accessToken` but `session.ts` only exports `readAccessToken()` from `storage.ts`; `getStoredTokens` doesn't exist
- **Fix:** Used `readAccessToken()` from `@/features/auth/storage` directly
- **Files modified:** `senso/src/features/ingestion/IngestionScreen.tsx`
- **Verification:** TypeScript compiled without errors
- **Committed in:** 5333124 (Task 2 commit)

**2. [Rule 1 - Bug] Fixed ExtractedDocument field naming (snake_case vs camelCase)**
- **Found during:** Task 1 (types.ts)
- **Issue:** Plan template used camelCase (e.g. `documentType`, `moduleName`) but API returns snake_case from `model_dump(mode="json")`. Using camelCase would cause all field lookups to fail at runtime.
- **Fix:** Used snake_case field names in TypeScript interface to match actual API response
- **Files modified:** `senso/src/features/ingestion/types.ts`, `senso/src/features/ingestion/InspectModal.tsx`
- **Verification:** TypeScript compiled cleanly; InspectModal references matching field names
- **Committed in:** 1e8005c (Task 1 commit)

---

**Total deviations:** 2 auto-fixed (2 bugs)
**Impact on plan:** Both fixes necessary for correct runtime behavior. No scope creep. All plan requirements met.

## Issues Encountered
None during implementation. Checkpoint (Task 3) is blocking for human verification.

## User Setup Required
None - no external service configuration required.

## Next Phase Readiness
- Complete ingestion UI wired to API; ready for human verification
- After checkpoint approval: update SUMMARY and STATE with completion, advance to Phase 3
- Blocker: Human verification of end-to-end flow required (Task 3 checkpoint)

---
*Phase: 02-financial-input-ingestion*
*Completed: 2026-03-24*

## Self-Check: PASSED
