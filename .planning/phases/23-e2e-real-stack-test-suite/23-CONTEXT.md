---
phase: "23"
slug: e2e-real-stack-test-suite
created: "2026-04-06"
status: ready-to-execute
---

# Phase 23 Context — E2E Real Stack Test Suite

## Why This Phase Exists

All existing Playwright tests mock the API via `page.route()`. Zero tests exercise
the real running stack. This means:
- The backend and frontend can be independently broken with no test catching it
- Ingestion pipeline, LLM tool calls, profile enrichment, TTS — none are tested E2E
- The hackathon demo could fail due to integration gaps not caught by mocked tests

## What Real E2E Means

Tests run against `docker compose up` (full stack: frontend + api + postgres + qdrant).
No `page.route()` mocks. A real user account is created, real documents uploaded, real
coach conversations happen. LLM calls may be gated behind a test API key or a stubbed
LLM backend that returns valid fixture responses.

## LLM Strategy for E2E

Option A — **Real LLM** (integration tests, costs money): Use `GEMINI_API_KEY` from env.
Only used in CI when key is available; tests skip gracefully otherwise.

Option B — **LLM stub server** (deterministic, free): A tiny FastAPI stub at
`http://localhost:9000` that accepts the same request format and returns pre-baked valid
responses. Tests always pass in CI.

**Decision**: Use Option B for core flow tests + Option A for optional "live LLM" tests
tagged `@live-llm`. Both tagged separately in CI.

## What This Phase Does

### 23-01: Real stack test infrastructure
- `docker-compose.test.yml` (or override): postgres with fresh DB + api + frontend +
  llm-stub server + seeded test user
- `senso/e2e/support/real-stack-fixtures.ts`: `realAuthedPage` fixture that creates a
  real user account via API (not localStorage injection)
- LLM stub server: `api/tests/llm_stub_server.py` — FastAPI app that returns
  valid coaching responses for known prompts
- Test account cleanup: `DELETE FROM users WHERE email LIKE '%e2e-test%'` after each suite

### 23-02: Full user journey E2E
- Register → confirm email (or skip if email not required) → login
- Upload a bank statement (Fineco XLSX fixture) → poll until status = "completed"
- Check profile screen: income range populated, transactions visible
- Ask coach: "Ho abbastanza risparmi?" → response received, no 500 errors
- Upload payslip → profile shows verified income source
- Upload utility bill → fixed_expenses populated

### 23-03: Coach tool call E2E
- With real stack (LLM stub returns tool-calling response):
  - Stub returns `get_user_profile` tool call → executor fetches real DB data → response includes real numbers
  - Stub returns `search_italy_rules` tool call → executor searches real index → response contains rule
- Assert: response `resource_cards` URLs are real catalog entries (not invented)

### 23-04: Error path E2E
- Expired token: set token TTL to 1s, wait 2s, make request → redirected to login
- Bad file upload: upload a .exe → rejected with `code: "unsupported_file_type"`
- LLM timeout: stub returns 60s delay → frontend shows timeout error gracefully (not spinner forever)
- Network offline: Playwright `context.setOffline(true)` → app shows offline indicator

### 23-05: Mobile E2E happy path
- Same full journey as 23-02 but on `devices['iPhone 14']` Playwright project
- Key assertions: input visible after keyboard open, cards render without overflow,
  voice button accessible (tap target ≥44px)

## Scope

**In scope:**
- `api/tests/llm_stub_server.py` — LLM stub (FastAPI)
- `docker-compose.test.yml` — test stack override
- `senso/e2e/real-stack/` — new directory for real stack specs
- `senso/e2e/support/real-stack-fixtures.ts` — real account fixture

**Not in scope:**
- Visual regression screenshots
- Load testing / performance benchmarks
- iOS Safari on real device (Playwright webkit approximates)
- Full accessibility audit (covered in existing mock-based a11y.spec.ts)
