---
status: pending
phase: "23"
---

# Phase 23 Verification - E2E Real Stack Test Suite

## Must-Haves

| #   | Requirement                                                                        | Status | Evidence |
| --- | ---------------------------------------------------------------------------------- | ------ | -------- |
| 1   | LLM stub server implemented and starts with docker compose                         | ⏳      |          |
| 2   | `realAuthedPage` fixture creates real DB user + session                            | ⏳      |          |
| 3   | Full journey: register → upload bank statement → profile populated → coach answers | ⏳      |          |
| 4   | Payslip upload → `verified_income_sources` populated (real DB)                     | ⏳      |          |
| 5   | Utility upload → `fixed_expenses` populated (real DB)                              | ⏳      |          |
| 6   | Coach tool call → real DB data returned (not stub)                                 | ⏳      |          |
| 7   | Expired token → redirect to login                                                  | ⏳      |          |
| 8   | Bad file upload → `unsupported_file_type` error shown                              | ⏳      |          |
| 9   | LLM timeout → graceful error (not forever spinner)                                 | ⏳      |          |
| 10  | Mobile journey on iPhone 14 viewport passes                                        | ⏳      |          |
| 11  | Test cleanup removes all `e2e-test-*` users after suite                            | ⏳      |          |
