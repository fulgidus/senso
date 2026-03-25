---
status: testing
phase: 03-financial-profile-clarity
source: [03-01-SUMMARY.md, 03-02-SUMMARY.md, 03-03-SUMMARY.md, 03-04-SUMMARY.md]
started: 2026-03-25T00:00:00Z
updated: 2026-03-25T02:00:00Z
---

## Current Test

number: 5
name: Processing Screen — Live Polling Animation
expected: |
  Navigate to the app in a browser. After triggering confirm-all (or navigating directly to the processing screen in dev), the ProcessingScreen shows 4 steps. The active step shows a spinning loader icon, completed steps show a checkmark, pending steps show an empty circle. The screen automatically advances to ProfileScreen when the job completes.
awaiting: user response

## Tests

### 1. Cold Start Smoke Test
expected: Kill any running server process. Clear ephemeral state (SQLite DB file if using local, temp files). Start the FastAPI backend from scratch (e.g. `uv run uvicorn app.main:app --reload`). Server boots without errors, any DB migrations or table creation completes, and GET /docs or GET /profile/status (with a valid token) returns a live response without 500 errors.
result: issue
reported: "error: Failed to spawn: `uvicorn` — Caused by: No such file or directory. Also ImportError: email-validator not installed."
severity: blocker
fix_applied: "Added uvicorn[standard]>=0.30.0 and pydantic[email]>=2.9.0 to api/pyproject.toml. uv sync installs both. Server now starts cleanly. Commit: c7df858"

### 2. Categorization API — Profile Status Endpoint
expected: After authenticating (POST /auth/login), call GET /profile/status. When no categorization job exists yet, it returns a response indicating "not_started" or equivalent. The endpoint should return 200 (not 404 or 500).
result: pass

### 3. Confirm-All Endpoint Triggers Categorization
expected: After uploading at least one document (confirmed uploads exist from Phase 2), call POST /ingestion/confirm-all. Response should contain `{"confirmed_count": N, "categorization_status": "queued"}` (or similar with queued/started status). A subsequent GET /profile/status should return a non-"not_started" status.
result: pass

### 4. Categorization Completes and Profile Is Available
expected: Wait for (or mock) categorization to complete. GET /profile should return a full profile with income summary, spending categories, and insight cards. The profile data should reflect the uploaded transaction data — not empty.
result: pass

### 5. Processing Screen — Live Polling Animation
expected: Navigate to the app in a browser. After triggering confirm-all (or navigating directly to the processing screen in dev), the ProcessingScreen shows 4 steps. The active step shows a spinning loader icon, completed steps show a checkmark, pending steps show an empty circle. The screen automatically advances to ProfileScreen when the job completes.
result: [pending]

### 6. Processing Screen — "Come Back Later" Button
expected: On the ProcessingScreen, clicking "Come back later" navigates back to the ingestion/upload screen (not a crash or blank page).
result: [pending]

### 7. Profile Screen — Summary Card
expected: On ProfileScreen, the top SummaryCard shows 3 columns: income (with a source badge label like "Payslip" or "Questionnaire"), monthly expenses, and available margin. If margin is positive, it displays in a blue/primary color. If negative, it displays in red/destructive color.
result: [pending]

### 8. Profile Screen — Spending Breakdown Chart
expected: The SpendingBreakdown section shows a horizontal bar chart with spending categories (up to 5 + "Other"). Each bar reflects actual proportional spend. Category pills are shown below the chart.
result: [pending]

### 9. Profile Screen — Insight Cards
expected: The InsightCards section initially shows 3 skeleton/loading cards, then populates with 1-3 real insight cards, each with a lightbulb icon and a short insight text derived from the user's actual transaction data.
result: [pending]

### 10. Onboarding Choice Screen
expected: If a user has no profile yet (no uploads confirmed or no questionnaire done), navigating to the app shows an OnboardingChoiceScreen with two cards: "From your files" and "Answer a few questions". Each card has an icon and tapping either navigates to the correct flow.
result: [pending]

### 11. Questionnaire — Quick Mode (3 Questions)
expected: Choosing "Answer a few questions" shows a step-by-step questionnaire. In quick mode (3 questions): employment type, net income, and currency. Each question shows option pills to select from. Progress shows "Question N of 3". "Next" advances, "Finish" on the last step submits.
result: [pending]

### 12. Confirm/Correct — Edit and Save Profile
expected: On ProfileScreen, there is a "Confirm/Correct" section at the bottom with editable income and expenses inputs, and a "Save Profile" button. Editing values and clicking "Save Profile" calls POST /profile/confirm and updates the displayed profile.
result: [pending]

## Summary

total: 12
passed: 0
issues: 1
pending: 11
skipped: 0
blocked: 0

## Gaps

- truth: "Server starts cleanly from cold start with `uv run uvicorn app.main:app --reload`"
  status: failed
  reason: "User reported: error: Failed to spawn: `uvicorn` — uvicorn and email-validator missing from pyproject.toml"
  severity: blocker
  test: 1
  fix_applied: "Added uvicorn[standard]>=0.30.0 and pydantic[email]>=2.9.0 to pyproject.toml. Commit: c7df858"
