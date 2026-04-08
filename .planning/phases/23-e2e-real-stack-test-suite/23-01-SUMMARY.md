---
plan: "23-01"
phase: "23"
status: complete
completed: 2026-04-08
---

# Summary: Plan 23-01 - Real Stack Infrastructure

## What Was Built

Complete E2E test infrastructure enabling Playwright tests to run against the real Docker Compose stack without any page.route() mocks.

## Key Files Created/Modified

### Created
- `docker-compose.test.yml` - Test overlay: senso_test DB, llm-stub service, full healthchecks
- `api/tests/llm_stub_server.py` - FastAPI OpenAI-compat LLM stub, fixture responses by trigger
- `api/tests/Dockerfile.llm-stub` - python:3.12-slim image for stub service
- `api/app/api/internal.py` - POST /internal/db/reset + DELETE /internal/users/{id}
- `senso/e2e/real-stack/global.setup.ts` - Playwright setup: health poll + DB reset
- `senso/e2e/real-stack/global.teardown.ts` - Playwright teardown: defensive cleanup
- `senso/e2e/real-stack/fixtures.ts` - Worker-scoped account fixture
- `.env.e2e.example` - Reference env for E2E runs

### Modified
- `api/app/core/config.py` - allow_test_reset + internal_token fields
- `api/app/core/llm_config.py` - LLM_{PROVIDER}_BASE_URL env var override
- `api/app/main.py` - Mount internal_router
- `senso/playwright.config.ts` - real-stack-setup/teardown/real-stack/real-stack-mobile projects

## Decisions Made

- LLM stub uses OpenAI-compat format (`/v1/chat/completions`) since backend uses openrouter provider
- Stub base_url injected via `LLM_OPENROUTER_BASE_URL` env var override (not config.json change)
- DB reset guarded by both `allow_test_reset` flag AND `X-Internal-Token` header (double guard)
- Worker-scoped fixtures (not test-scoped) to minimize account creation/deletion overhead
- Full healthcheck blocks always redeclared (Docker bug #10188: partial override drops test: field)

## Self-Check: PASSED

- [x] docker-compose.test.yml has full healthcheck blocks for all services
- [x] LLM stub implements /health + /v1/chat/completions with valid coaching JSON
- [x] Internal router guarded by allow_test_reset + X-Internal-Token
- [x] Playwright real-stack projects listed in --list output (verified)
- [x] All Python files pass syntax check
- [x] Account fixture is worker-scoped
