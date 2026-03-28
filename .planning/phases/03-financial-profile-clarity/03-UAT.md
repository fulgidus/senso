---
status: gaps_identified
phase: 03-financial-profile-clarity
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-03-25T00:00:00Z
updated: 2026-03-27T23:00:00Z
---

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server process. Clear ephemeral state (SQLite DB file if using local, temp files). Start the FastAPI backend from scratch (e.g. `uv run uvicorn app.main:app --reload`). Server boots without errors, any DB migrations or table creation completes, and GET /docs or GET /profile/status (with a valid token) returns a live response without 500 errors.
result: issue
reported: "error: Failed to spawn: `uvicorn` - Caused by: No such file or directory. Also ImportError: email-validator not installed."
severity: blocker
fix_applied: "Added uvicorn[standard]>=0.30.0 and pydantic[email]>=2.9.0 to api/pyproject.toml. Also added python-multipart and minio (was boto3) to api/Dockerfile. Server now starts cleanly."

### 2. Categorization API - Profile Status Endpoint
expected: After authenticating (POST /auth/login), call GET /profile/status. When no categorization job exists yet, it returns a response indicating "not_started" or equivalent. The endpoint should return 200 (not 404 or 500).
result: pass

### 3. Confirm-All Endpoint Triggers Categorization
expected: After uploading at least one document (confirmed uploads exist from Phase 2), call POST /ingestion/confirm-all. Response should contain `{"confirmed_count": N, "categorization_status": "queued"}` (or similar with queued/started status). A subsequent GET /profile/status should return a non-"not_started" status.
result: pass

### 4. Categorization Completes and Profile Is Available
expected: Wait for (or mock) categorization to complete. GET /profile should return a full profile with income summary, spending categories, and insight cards. The profile data should reflect the uploaded transaction data - not empty.
result: pass

### 5. Processing Screen - Live Polling Animation
expected: Sign in, upload a file, confirm uploads. App transitions to Processing screen with 4 steps: active step has spinning loader, completed steps have checkmark, pending steps have empty circle. Screen auto-advances to Profile when job completes.
result: pass

### 6. Processing Screen - "Come Back Later" Button
expected: On the ProcessingScreen, clicking "Come back later" navigates back to the ingestion/upload screen (not a crash or blank page).
result: unconfirmed
reported: "Button is visible but user could not confirm navigation behavior."

### 7. Profile Screen - Summary Card
expected: On ProfileScreen, the top SummaryCard shows 3 columns: income (with a source badge label like "Payslip" or "Questionnaire"), monthly expenses, and available margin. If margin is positive, it displays in a blue/primary color. If negative, it displays in red/destructive color.
result: failed
reported: "SummaryCard shows bogus values, no meaningful categorization data. States 'Based on 1 document confirmed 27/03/2026' - user uploaded 2 CSV files."
root_cause: |
  Multiple compounding issues:
  1. Multi-file upload is broken - UploadZone only passes files[0] from both drag-drop and file picker.
     Only one CSV ever reaches the backend regardless of how many files are selected.
  2. xlsx files crash the uploader (see Gap 4).
  3. Without an LLM API key (GEMINI_API_KEY / OPENAI_API_KEY not set), the categorization
     service cannot fall back to LLM for unrecognized transaction descriptions. Minimal CSVs
     with generic descriptions will produce mostly "uncategorized" transactions.

### 8. Profile Screen - Spending Breakdown Chart
expected: The SpendingBreakdown section shows a horizontal bar chart with spending categories (up to 5 + "Other"). Each bar reflects actual proportional spend. Category pills are shown below the chart.
result: failed
root_cause: "Same as Test 7 - profile data is sparse/uncategorized."

### 9. Profile Screen - Insight Cards
expected: The InsightCards section initially shows 3 skeleton/loading cards, then populates with 1-3 real insight cards, each with a lightbulb icon and a short insight text derived from the user's actual transaction data.
result: unable
root_cause: "Blocked by Tests 7/8 data quality failure."

### 10. Onboarding Choice Screen
expected: If a user has no profile yet (no uploads confirmed or no questionnaire done), navigating to the app shows an OnboardingChoiceScreen with two cards: "From your files" and "Answer a few questions". Each card has an icon and tapping either navigates to the correct flow.
result: failed
reported: "No onboarding screen shown. No way to trigger the questionnaire from the UI."
root_cause: |
  AuthedHome.tsx initializes state to "ingestion" unconditionally.
  The useEffect that checks profile status on mount only routes to "processing" or "profile" -
  there is no code path that ever sets screen to "onboarding". The OnboardingChoiceScreen
  component exists and is wired, but is completely unreachable from the UI.

### 11. Questionnaire - Quick Mode (3 Questions)
expected: Choosing "Answer a few questions" shows a step-by-step questionnaire. In quick mode (3 questions): employment type, net income, and currency. Each question shows option pills to select from. Progress shows "Question N of 3". "Next" advances, "Finish" on the last step submits.
result: unable
root_cause: "Blocked by Test 10 - onboarding screen is unreachable."

### 12. Confirm/Correct - Edit and Save Profile
expected: On ProfileScreen, there is a "Confirm/Correct" section at the bottom with editable income and expenses inputs, and a "Save Profile" button. Editing values and clicking "Save Profile" calls POST /profile/confirm and updates the displayed profile.
result: pass
notes: "Section label differs from spec name. Only total income/expenses are editable (not category-level). Functionality works. Needs expansion to category-level editing."

## Summary

total: 12
passed: 5
failed: 4
unconfirmed: 1
unable: 2
issues_fixed: 1

## Gaps

### Gap 1 - Multi-file upload broken (blocker for Tests 7/8/9)
truth: "User can select multiple files at once and all are uploaded in sequence"
status: failed
severity: major
test: 7
root_cause: |
  UploadZone.tsx: <input> lacks `multiple` attribute; onChange only reads files[0].
  handleDrop only reads e.dataTransfer.files[0].
  IngestionScreen.tsx: onFile callback only calls upload(f) for a single file.
fix_plan: |
  1. UploadZone.tsx: add `multiple` to <input>, change onChange to iterate all files,
     change handleDrop to iterate all dropped files, update prop type to onFiles: (files: File[]) => void.
  2. IngestionScreen.tsx: update the onFiles callback to call upload(f) for each file in the array.
  3. Update label text from "Drop a file here" to "Drop files here or click to select".

### Gap 2 - Onboarding screen unreachable (blocker for Tests 10/11)
truth: "First-time users with no profile are routed to OnboardingChoiceScreen"
status: failed
severity: major
test: 10
root_cause: |
  AuthedHome.tsx useEffect only transitions to "processing" or "profile".
  No branch handles data.status === "not_started" - it falls through to the comment
  "else: not_started or failed → stay on ingestion". Onboarding is never triggered.
fix_plan: |
  In AuthedHome.tsx useEffect, add a branch:
    else if (data.status === "not_started") { setScreen("onboarding") }
  This routes first-time users (and users who haven't confirmed any docs) to the
  OnboardingChoiceScreen before they see the empty ingestion view.
  Note: users who have uploads but haven't confirmed yet should stay on ingestion,
  so this branch should only fire when uploads list is also empty (check separately
  or add an uploads_count field to the profile/status response).

### Gap 3 - Profile data quality / LLM fallback not configured
truth: "Profile shows meaningful spending categories derived from real transaction data"
status: failed
severity: major
test: 7
root_cause: |
  No GEMINI_API_KEY or OPENAI_API_KEY is set in .env. The categorization service
  relies on LLM fallback for transaction descriptions that don't match Italian regex rules.
  Without an LLM key, unmatched transactions are labelled "uncategorized", producing a
  profile with no meaningful breakdown.
fix_plan: |
  Option A (preferred): Add a valid GEMINI_API_KEY to .env and restart the API container.
  Option B: Improve the regex ruleset to cover English-language transaction descriptions
  so the demo CSV (which uses English) can be categorized without LLM.
  Option C: Provide a richer Italian-language demo CSV that matches existing rules.

### Gap 4 - xlsx files crash or fail silently
truth: "Uploading an xlsx file succeeds and extracts transactions"
status: failed
severity: minor
test: 7
root_cause: |
  UploadZone.tsx accepts .xlsx in the `accept` attribute and the backend Dockerfile
  has openpyxl installed. However the ingestion_service.py run_adaptive_pipeline
  function has no dedicated xlsx extraction path - it likely falls through to a
  text/binary handler that fails on xlsx binary content.
fix_plan: |
  Investigate run_adaptive_pipeline in api/app/services/ingestion_service.py.
  Add an explicit branch: if file extension is .xlsx or .xls, use openpyxl to
  read the workbook and convert rows to a DataFrame / list of dicts before passing
  to the transaction extractor. Return a graceful error response if openpyxl parse fails.
