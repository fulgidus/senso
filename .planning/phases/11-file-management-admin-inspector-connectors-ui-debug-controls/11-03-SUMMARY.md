---
phase: 11-file-management-admin-inspector-connectors-ui-debug-controls
plan: "03"
subsystem: profile-ui
tags: [files-tab, admin-inspector, ingestion-api, i18n, profile]
dependency_graph:
  requires: [11-01, 11-02]
  provides: [files-tab, admin-inspector-drawer, ingestion-files-api]
  affects: [profile-screen, ingestion-pipeline]
tech_stack:
  added: []
  patterns: [recursive-json-tree, collapsible-sections, copy-to-clipboard, status-badge]
key_files:
  created:
    - senso/src/api/ingestionFilesApi.ts
    - senso/src/features/profile/FilesTab.tsx
    - senso/src/features/profile/AdminInspectorDrawer.tsx
  modified:
    - senso/src/features/profile/ProfileScreen.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
decisions:
  - "document_type shown as '-' in file list; loaded only inside AdminInspectorDrawer on demand (avoids N+1 fetches)"
  - "getTrace returns [] on 403/404 so non-admin users get a graceful empty trace, not an error"
  - "AdminInspectorDrawer fetches extracted + trace in parallel via Promise.all on mount"
metrics:
  duration_minutes: 1103
  completed_date: "2026-04-01"
  tasks_completed: 2
  files_changed: 6
---

# Phase 11 Plan 03: Files Tab & Admin Inspector Summary

**One-liner:** Files tab with retry/delete per upload and full-screen admin pipeline inspector with recursive JSON tree and per-section copy-to-clipboard.

## What Was Built

### Task 1 - `ingestionFilesApi.ts` + `FilesTab.tsx` + i18n keys (commit `9bf9d35`)

**`senso/src/api/ingestionFilesApi.ts`** - 5 exported functions:
- `listUploads(token)` → GET `/ingestion/uploads` → `UploadFile[]`
- `deleteUpload(token, id)` → DELETE `/ingestion/uploads/{id}` → `void`
- `retryUpload(token, id)` → POST `/ingestion/uploads/{id}/retry` → `{upload_id, status}`
- `getExtracted(token, id)` → GET `/ingestion/uploads/{id}/extracted` → `ExtractedDocumentDetail | null` (null on 404)
- `getTrace(token, id)` → GET `/admin/ingestion/uploads/{id}/trace` → `TraceStep[]` ([] on 403/404)

Exported types: `UploadFile`, `ExtractedDocumentDetail`, `TraceStep`.

**`senso/src/features/profile/FilesTab.tsx`** - File list component:
- Props: `{ token, isAdmin, onInspect? }`
- Loads files on mount with loading skeleton
- Status badge: pending/queued=yellow, processing=blue, done=green, failed=red
- Per-row: filename (truncated 40 chars), size (KB/MB), upload date (it-IT locale), document_type ("-" placeholder)
- Action buttons: Retry (failed/pending only), Delete (with confirm dialog), Inspect (admin only)
- Empty state + error state with retry

**i18n keys** added to `it.json` and `en.json` under `"files"` namespace (12 keys each).

### Task 2 - `AdminInspectorDrawer.tsx` + `ProfileScreen.tsx` wiring (commit `b2db8bb`)

**`senso/src/features/profile/AdminInspectorDrawer.tsx`** - Full-screen pipeline inspector:
- Props: `{ uploadId, token, onClose }`
- Fetches `getExtracted` + `getTrace` in parallel on mount
- Loading skeleton while fetching
- 5 collapsible sections (chevron toggle):
  1. **Upload metadata** - id, status, method, source, uploaded_at, size_bytes
  2. **Extracted document** - type, module, confidence (%), raw_text (scrollable), extracted_at
  3. **Payload JSON** - recursive `JsonTree` component (strings=green, numbers=blue, booleans=orange, null=gray; objects/arrays toggle expand/collapse)
  4. **Transactions** - visible when document_type contains "bank_statement"; each row shows date/description/amount/currency/category, expandable to full JSON
  5. **Pipeline trace** - ordered steps with status badge (success=green, error=red, skipped=gray), duration_ms, input/output summaries, expandable raw_input/raw_output
- Copy buttons: per-section "copy JSON" (Clipboard icon) + global "copy all" at top; 1-second "Copied!" flash on click
- `inspector.noExtracted` shown when getExtracted returns null

**i18n keys** added under `"inspector"` namespace (11 keys in both locales).

**`senso/src/features/profile/ProfileScreen.tsx`** - surgical additions only:
- Tab type extended: `"summary" | "charts" | "timeline" | "files"`
- `inspectUploadId` state added
- 4th tab button "I tuoi file" (i18n `files.tabLabel`)
- `FilesTab` rendered when `activeTab === "files"`, with `onInspect={setInspectUploadId}`
- `AdminInspectorDrawer` rendered at bottom when `inspectUploadId` is set

## Verification

```
docker compose run --rm frontend pnpm build
✓ built in 3.27s  (0 TypeScript errors)
```

## Deviations from Plan

None - plan executed exactly as written.

## Known Stubs

- `document_type` column in FilesTab file list always shows `"-"`. This is intentional per plan: the document_type is only loaded inside AdminInspectorDrawer (getExtracted call) to avoid N+1 fetches on list load. No stub removal needed; behavior is by design.

## Self-Check

- [x] `senso/src/api/ingestionFilesApi.ts` - created, committed in `9bf9d35`
- [x] `senso/src/features/profile/FilesTab.tsx` - created, committed in `9bf9d35`
- [x] `senso/src/features/profile/AdminInspectorDrawer.tsx` - created, committed in `b2db8bb`
- [x] `senso/src/features/profile/ProfileScreen.tsx` - modified, committed in `b2db8bb`
- [x] `senso/src/i18n/locales/it.json` - modified, committed in `9bf9d35`
- [x] `senso/src/i18n/locales/en.json` - modified, committed in `9bf9d35`
- [x] Build passes: `✓ built in 3.27s`
