---
phase: "23"
slug: e2e-real-stack-test-suite
status: draft
nyquist_compliant: false
created: "2026-04-06"
---

# Phase 23 — Validation Strategy

## Test Commands

```bash
# Start test stack
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d

# Run real stack E2E
cd senso && npx playwright test e2e/real-stack/ --project=chromium

# Run real stack mobile
cd senso && npx playwright test e2e/real-stack/ --project=mobile-chrome

# Live LLM tests (optional, requires GEMINI_API_KEY)
cd senso && npx playwright test e2e/real-stack/ --grep @live-llm
```

## Per-Plan Test Map

| Plan | Spec | What it guards |
|---|---|---|
| 23-01 | infrastructure | Docker test stack starts clean; real account creates successfully |
| 23-02 | `real-stack/journey.spec.ts` | Full upload → profile → coach round trip |
| 23-03 | `real-stack/tool-calls.spec.ts` | Coach tool calls use real DB data |
| 23-04 | `real-stack/error-paths.spec.ts` | Token expiry, bad file, LLM timeout, offline |
| 23-05 | `real-stack/mobile-journey.spec.ts` | Full journey on iPhone 14 viewport |

## Acceptance Gate

- `journey.spec.ts` completes full user journey with 0 failures on real stack
- `error-paths.spec.ts` all pass (graceful degradation verified)
- `mobile-journey.spec.ts` all pass on `mobile-chrome` project
- Test cleanup runs: no orphan `e2e-test-*` users in DB after suite
- CI: real stack tests run in separate CI job with Docker Compose available
