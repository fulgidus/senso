---
phase: 11-file-management-admin-inspector-connectors-ui-debug-controls
verified: 2026-04-01T12:00:00Z
status: passed
score: 18/18 must-haves verified
re_verification: false
gaps: []
human_verification:
  - test: "Files tab renders file list with retry/delete/inspect buttons"
    expected: "Uploading a file, then visiting Profile → Files tab should show the file with correct status badge, retry (if failed), delete, and inspect (admin only) buttons"
    why_human: "Requires live browser session with a logged-in user and uploaded document"
  - test: "Admin inspector drawer opens and shows pipeline trace"
    expected: "Clicking Inspect on a file row should open the full-screen drawer with all 5 sections (metadata, extracted doc, payload JSON tree, transactions, pipeline trace)"
    why_human: "Requires admin user + uploaded document with completed ingestion trace"
  - test: "/debug screen executes restart-ingestion and shows result"
    expected: "Visiting /debug as a tester/admin user, clicking 'Riavvia pipeline' should call the backend and display {restarted: N}"
    why_human: "Requires live backend + authenticated tester/admin session"
  - test: "Non-tester user visiting /debug is redirected to /"
    expected: "Logging in as a regular user and navigating to /debug should immediately redirect to /"
    why_human: "Route is conditionally rendered; the redirect is via wildcard fallback — requires live browser test to confirm"
---

# Phase 11: File Management, Admin Inspector, Connectors UI & Debug Controls — Verification Report

**Phase Goal:** Users can manage their uploaded files (retry/delete) from their profile; admins can inspect the full ingestion pipeline state for any upload; a Connectors tab shows upcoming bank integrations; tester/admin users have a /debug screen with ingestion restart, coaching purge, and full data reset controls.
**Verified:** 2026-04-01T12:00:00Z
**Status:** ✅ passed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Users table has a role column (user/tester/moderator/admin, default user) | ✓ VERIFIED | `models.py:123` `role: str = Column(String(16), nullable=False, default="user")` |
| 2 | require_admin uses role == admin OR is_admin (compat) | ✓ VERIFIED | `admin.py:34` `if not user_row or (user_row.role != "admin" and not user_row.is_admin)` |
| 3 | require_tester allows role in [tester, admin] OR is_admin | ✓ VERIFIED | `admin.py:41–55` require_tester dependency present with correct logic |
| 4 | Starting admins get role=admin on signup | ✓ VERIFIED | `auth_service.py:58` `role="admin" if is_admin else "user"` |
| 5 | UserDTO and frontend User type expose role field | ✓ VERIFIED | `schemas/auth.py:14` `role: str = "user"`; `types.ts:9` `role?: string` |
| 6 | ingestion_traces table and IngestionTrace ORM model exist | ✓ VERIFIED | `models.py:763` class IngestionTrace; Round 16 migration in `session.py:351` |
| 7 | Each major ingestion step writes a trace row (5 instrumentation points) | ✓ VERIFIED | `ingestion_service.py:124–198` — 5 _record_trace calls at start, ocr_extraction, module_match, llm_call, persistence |
| 8 | Admin endpoint GET /admin/ingestion/uploads/{id}/trace returns ordered trace steps | ✓ VERIFIED | `admin.py:276–297` endpoint requires admin, queries IngestionTrace ordered by step_order |
| 9 | ProfileScreen has a Files tab (4th tab) | ✓ VERIFIED | `ProfileScreen.tsx:302–309` activeTab===files button; tab type includes "files" |
| 10 | Files tab lists uploads with status badge, retry, delete, inspect (admin only) | ✓ VERIFIED | `FilesTab.tsx` (190 lines) — all 4 per-row actions wired to ingestionFilesApi |
| 11 | Admin users see Inspect button; clicking opens AdminInspectorDrawer | ✓ VERIFIED | `ProfileScreen.tsx:332` `isAdmin={!!_user.isAdmin || _user.role === "admin"}`; `FilesTab.tsx` calls `onInspect`; `AdminInspectorDrawer.tsx` (423 lines) renders 5 collapsible sections |
| 12 | ProfileScreen has a Connectors tab (5th tab) showing 6 placeholder bank cards | ✓ VERIFIED | `ProfileScreen.tsx:312–319`; `ConnectorsTab.tsx:5–10` — Intesa Sanpaolo, UniCredit, Fineco, ING Italia, N26, Revolut with `connectors.comingSoon` badge |
| 13 | Backend debug endpoints exist: restart-ingestion, purge-coaching, nuke — all require require_tester | ✓ VERIFIED | `debug.py:17–98` — 3 endpoints with `Depends(require_tester)`; registered in `main.py:110` |
| 14 | /debug route renders DebugScreen for tester/admin; others hit wildcard redirect to / | ✓ VERIFIED | `App.tsx:201–204` conditional route + wildcard `<Navigate to="/" replace />` |
| 15 | SettingsScreen shows developer tools link only for tester/admin users | ✓ VERIFIED | `SettingsScreen.tsx:373` `{(user.role === "tester" || user.role === "admin" || user.isAdmin) && ...}` with link to /debug |
| 16 | All new user-facing strings use i18n keys in it.json and en.json | ✓ VERIFIED | `it.json` has: files (14 keys), inspector (13 keys), connectors (5 keys), debug (14 keys), settings.devTools* (3 keys); `en.json` mirrors all |
| 17 | DebugScreen calls correct backend endpoints with auth token | ✓ VERIFIED | `DebugScreen.tsx:22,49,69,91` — callDebug helper uses `readAccessToken()`, paths: /debug/restart-ingestion, /debug/purge-coaching, /debug/nuke |
| 18 | Tracing is purely additive — _record_trace never raises | ✓ VERIFIED | `ingestion_service.py:215–247` _record_trace wraps all in try/except, swallows + logs exceptions |

**Score:** 18/18 truths verified

---

### Required Artifacts

| Artifact | Expected | Lines | Status | Evidence |
|----------|----------|-------|--------|----------|
| `api/app/db/models.py` | User.role column + IngestionTrace ORM | — | ✓ VERIFIED | role col at line 123; IngestionTrace at line 763 |
| `api/app/db/session.py` | Round 15 + Round 16 migrations | — | ✓ VERIFIED | Round 15 at line 347, Round 16 at line 351 |
| `api/app/api/admin.py` | require_tester dep + trace endpoint | — | ✓ VERIFIED | require_tester at line 41; endpoint at lines 276–297 |
| `api/app/schemas/auth.py` | UserDTO with role field | — | ✓ VERIFIED | `role: str = "user"` at line 14 |
| `api/app/services/auth_service.py` | Sets role on signup and in all UserDTO constructions | — | ✓ VERIFIED | Lines 58, 119, 176, 214 |
| `api/app/services/ingestion_service.py` | _record_trace + 5 instrumentation points | — | ✓ VERIFIED | _record_trace at 215; 5 calls at 124–198 |
| `api/app/api/debug.py` | 3 protected debug endpoints | 98 | ✓ VERIFIED | restart, purge, nuke — all behind require_tester |
| `senso/src/features/auth/types.ts` | User type with role field | — | ✓ VERIFIED | `role?: string` at line 9 |
| `senso/src/features/auth/session.ts` | parseUser() maps role | — | ✓ VERIFIED | `role: raw.role ?? "user"` at line 43 |
| `senso/src/api/ingestionFilesApi.ts` | 5 exported functions | 115 | ✓ VERIFIED | listUploads, deleteUpload, retryUpload, getExtracted, getTrace all exported |
| `senso/src/features/profile/FilesTab.tsx` | File list with actions (min 80 lines) | 190 | ✓ VERIFIED | All 4 per-row actions wired; status badge; empty+error states |
| `senso/src/features/profile/AdminInspectorDrawer.tsx` | Full-screen inspector (min 120 lines) | 423 | ✓ VERIFIED | 5 sections, recursive JsonTree, per-section copy |
| `senso/src/features/profile/ConnectorsTab.tsx` | Static bank card grid (min 40 lines) | 49 | ✓ VERIFIED | 6 bank cards with comingSoon badge |
| `senso/src/features/debug/DebugScreen.tsx` | 3 debug sections (min 80 lines) | 106 | ✓ VERIFIED | restart, purge, nuke with callDebug helper |
| `senso/src/i18n/locales/it.json` | files + inspector + connectors + debug + settings.devTools keys | — | ✓ VERIFIED | All namespaces present with correct keys |
| `senso/src/i18n/locales/en.json` | Mirror of all Phase 11 i18n keys | — | ✓ VERIFIED | All namespaces present |

---

### Key Link Verification

| From | To | Via | Status | Evidence |
|------|----|-----|--------|----------|
| `auth_service.py` | `models.py` | signup sets `role="admin"` for starting_admins | ✓ WIRED | `auth_service.py:58` |
| `admin.py` | `models.py` | require_admin reads `user_row.role` | ✓ WIRED | `admin.py:34` |
| `admin.py` | `models.py` | queries IngestionTrace by upload_id | ✓ WIRED | `admin.py:292` `db.query(IngestionTrace)` |
| `ingestion_service.py` | `models.py` | _record_trace creates IngestionTrace rows | ✓ WIRED | `ingestion_service.py:232–246` creates and commits IngestionTrace |
| `ProfileScreen.tsx` | `FilesTab.tsx` | renders FilesTab when activeTab === "files" | ✓ WIRED | `ProfileScreen.tsx:329–336` with isAdmin + onInspect props |
| `FilesTab.tsx` | `ingestionFilesApi.ts` | calls listUploads, deleteUpload, retryUpload | ✓ WIRED | `FilesTab.tsx:4,56,73,84` |
| `AdminInspectorDrawer.tsx` | `ingestionFilesApi.ts` | calls getExtracted and getTrace on open | ✓ WIRED | `AdminInspectorDrawer.tsx:5–6,176` Promise.all([getExtracted, getTrace]) |
| `App.tsx` | `DebugScreen.tsx` | Route /debug renders DebugScreen guarded by role | ✓ WIRED | `App.tsx:18,201–202` |
| `SettingsScreen.tsx` | `/debug` | Link rendered for tester/admin users | ✓ WIRED | `SettingsScreen.tsx:373,378` |
| `DebugScreen.tsx` | `/debug/restart-ingestion` | fetch POST via callDebug | ✓ WIRED | `DebugScreen.tsx:22,49` |
| `main.py` | `debug.py` | app.include_router(debug_router) | ✓ WIRED | `main.py:15,110` |

---

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|--------------|--------|-------------------|--------|
| `FilesTab.tsx` | `files` state | `listUploads(token)` → GET /ingestion/uploads | Yes — queries DB via existing ingestion endpoints | ✓ FLOWING |
| `AdminInspectorDrawer.tsx` | `extracted` + `traces` | `getExtracted` + `getTrace` in parallel | Yes — GET /ingestion/uploads/{id}/extracted + /admin/ingestion/uploads/{id}/trace query DB | ✓ FLOWING |
| `DebugScreen.tsx` | `results[action]` | `callDebug` → POST /debug/* endpoints | Yes — endpoints query and mutate real DB rows | ✓ FLOWING |
| `ingestion_service.py` (traces) | IngestionTrace rows | `_record_trace` writes from actual pipeline execution | Yes — populated from real OCR/LLM/module output | ✓ FLOWING |

---

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| debug.py router exports `router` | `python3 -c "from api.app.api.debug import router; print(router.prefix)"` | Would print `/debug` | ? SKIP (requires container Python env) |
| ingestionFilesApi exports all 5 functions | `grep "^export async function" senso/src/api/ingestionFilesApi.ts \| wc -l` | 5 | ✓ PASS |
| ProfileScreen includes all 5 tabs | `grep "setActiveTab" ProfileScreen.tsx \| wc -l` | ≥5 distinct values | ✓ PASS |
| it.json parses as valid JSON with all required namespaces | `python3 -c "import json; d=json.load(open('senso/src/i18n/locales/it.json')); assert 'files' in d and 'debug' in d and 'connectors' in d and 'inspector' in d"` | Passes | ✓ PASS |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|----------|
| FILE-01 | 11-01, 11-03 | User file management (retry/delete) + RBAC role foundation | ✓ SATISFIED | FilesTab.tsx with retry/delete actions wired; role column + require_tester in place |
| FILE-02 | 11-02, 11-03 | Admin pipeline inspector with ingestion trace | ✓ SATISFIED | IngestionTrace model + _record_trace + /admin/ingestion/uploads/{id}/trace + AdminInspectorDrawer |
| RBAC-01 | 11-01 | Role-based access control (role column, require_tester, UserDTO) | ✓ SATISFIED | Round 15 migration, require_tester dep, UserDTO.role, frontend User.role |
| CONN-01 | 11-04 | Connectors UI tab placeholder | ✓ SATISFIED | ConnectorsTab with 6 static bank cards + Prossimamente badge + 5th ProfileScreen tab |
| DEBUG-01 | 11-04 | Debug control screen for testers/admins | ✓ SATISFIED | debug.py 3 endpoints + DebugScreen + /debug route guard + SettingsScreen dev link |

> **Note on REQUIREMENTS.md traceability:** The requirement IDs FILE-01, FILE-02, RBAC-01, CONN-01, and DEBUG-01 are referenced in `ROADMAP.md` (Phase 11 section) and all 4 plan frontmatters, but they are **not defined** in `.planning/REQUIREMENTS.md` and they do **not** appear in its traceability table. The REQUIREMENTS.md traceability table ends at Phase 8 (CONT-06) and has no entries for Phases 9–11. This is a documentation gap — the requirement IDs are functional labels in the planning artifacts but have no canonical definition or phase-mapping row in REQUIREMENTS.md. The implementations are solid and fulfill the intent described in ROADMAP.md; the gap is in planning documentation, not in the code.

---

### Anti-Patterns Found

| File | Pattern | Severity | Impact |
|------|---------|----------|--------|
| `ConnectorsTab.tsx` | 6 bank cards are fully static placeholders (no real bank API) | ℹ️ Info | Intentional per plan — designed as "Prossimamente" (coming soon) UI. Not a stub blocking the goal. |
| `FilesTab.tsx` | `document_type` always shows `"-"` in the file list | ℹ️ Info | Intentional per plan decision — loaded only inside AdminInspectorDrawer to avoid N+1 fetches. By-design, not a gap. |
| Route `/debug` | Non-tester redirect via wildcard fallback, not explicit `<Route>` with `<Navigate>` | ⚠️ Warning | Plan specified an explicit redirect route. The wildcard `<Route path="*" element={<Navigate to="/" replace />}>` produces functionally identical behavior. No user-visible difference. |

---

### Human Verification Required

#### 1. Files Tab — File List Rendering

**Test:** Log in as a user who has uploaded at least one document. Navigate to Profile → "I tuoi file" tab.
**Expected:** File list visible with filename, status badge (colored pill), date, size. Retry button visible on failed/pending files. Delete button on all files. No Inspect button for non-admin.
**Why human:** Requires live browser session with uploaded document.

#### 2. Admin Inspector Drawer

**Test:** Log in as an admin user. Navigate to Profile → Files tab. Click "Ispeziona" on any completed file.
**Expected:** Full-screen drawer opens showing: upload metadata, extracted document data, payload JSON tree (collapsible, color-coded), transactions (if bank_statement), pipeline trace steps with timing badges. Each section has a copy-to-clipboard button.
**Why human:** Requires admin session + completed document ingestion.

#### 3. Debug Screen Actions

**Test:** Log in as a tester/admin user. Navigate to /debug (or use Settings → "Apri strumenti sviluppatore"). Try each action.
**Expected:** 
- "Riavvia pipeline" returns `{restarted: N}` 
- "Cancella cronologia" returns `{deleted: N}`
- "Reset totale" — confirm dialog appears, then returns `{nuked: true, user_id: "..."}`
**Why human:** Requires live backend + auth token + existing data to reset.

#### 4. Non-Tester /debug Redirect

**Test:** Log in as a regular user (role="user"). Navigate directly to /debug.
**Expected:** Immediately redirected to / (home screen).
**Why human:** Route conditional rendering + wildcard fallback — requires live browser navigation test.

#### 5. Settings Developer Tools Link Visibility

**Test:** (a) Log in as regular user → Settings screen → confirm no "Strumenti sviluppatore" section. (b) Log in as tester/admin → Settings screen → confirm "Strumenti sviluppatore" section and link to /debug are visible.
**Why human:** Requires two separate user sessions with different roles.

---

### Gaps Summary

**No gaps found.** All 18 must-have truths are verified, all 16 required artifacts are substantive and wired, all 11 key links are confirmed, and data flows from real sources through all dynamic components.

**One documentation gap (not a code gap):** Requirement IDs FILE-01, FILE-02, RBAC-01, CONN-01, DEBUG-01 exist in ROADMAP.md and plan frontmatters but are absent from REQUIREMENTS.md and its traceability table. This does not affect code quality but means REQUIREMENTS.md is out of date with the actual project scope. Recommend adding these IDs to REQUIREMENTS.md with Phase 11 traceability rows.

---

*Verified: 2026-04-01T12:00:00Z*  
*Verifier: gsd-verifier agent*
