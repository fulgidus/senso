# Phase 23: E2E Real Stack Test Suite — Research

**Researched:** 2026-04-06
**Domain:** Playwright real-stack E2E, Docker Compose test infrastructure, LLM stub server, mobile emulation
**Confidence:** HIGH (verified against Playwright v1.44+ official docs and deviceDescriptors)

---

## Summary

Playwright's recommended pattern (since v1.31) for real-stack tests is **Project Dependencies** (not `globalSetup` config). It has better reporting, supports traces, and works with fixtures. Docker Compose test overrides use `condition: service_healthy` to wait for real service readiness. LLM stubbing is best done with a minimal FastAPI server started as a Docker Compose service (Option B) since the backend calls LLM via Python SDK.

**Primary recommendation:** Use Project Dependencies for setup/teardown, Docker Compose test override with healthchecks, and a FastAPI LLM stub that implements the Gemini/OpenAI response contract. Create real user accounts via real API endpoints (not localStorage injection).

---

## Standard Stack

### Core
| Library/Tool | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Playwright | 1.44+ | E2E test runner + browser automation | Already in project (phases 16) |
| Docker Compose | 2.x | Test stack orchestration | Already in project |
| pytest | Latest | Backend unit/integration tests | Already in project |
| FastAPI | 0.135.2 | LLM stub server | Same as main backend — no new dep |

---

## Docker Compose Test Override Pattern

### docker-compose.test.yml structure

```yaml
# docker-compose.test.yml — overrides only what differs for tests
services:
  db:
    environment:
      POSTGRES_DB: senso_test  # separate test DB
    healthcheck:  # MUST redeclare full block — partial override silently drops test: field
      test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d senso_test"]
      interval: 3s
      timeout: 5s
      retries: 10
      start_period: 10s

  api:
    environment:
      DATABASE_URL: "postgresql://${POSTGRES_USER}:${POSTGRES_PASSWORD}@db:5432/senso_test"
      LLM_BASE_URL: "http://llm-stub:4010"  # redirect LLM calls to stub
      ALLOW_TEST_RESET: "true"              # enable /internal/db/reset endpoint
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
      interval: 5s
      retries: 10
      start_period: 15s
    depends_on:
      db:
        condition: service_healthy
      llm-stub:
        condition: service_healthy

  llm-stub:
    build:
      context: api/tests
      dockerfile: Dockerfile.llm-stub
    ports: ["4010:4010"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4010/health"]
      interval: 3s
      retries: 5
      start_period: 5s

  frontend:
    depends_on:
      api:
        condition: service_healthy
```

> ⚠️ **Docker Compose bug #10188**: Partial `healthcheck` override (e.g., only `interval:`) silently drops the `test:` field. **Always redeclare the full healthcheck block** in override files.

### Run command

```bash
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d
npx playwright test --project=real-stack
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

---

## Playwright Project Dependencies (Recommended since v1.31)

Better than `globalSetup` config: shows in HTML reports, supports traces, works with fixtures.

```ts
// playwright.config.ts
export default defineConfig({
  projects: [
    {
      name: 'real-stack-setup',
      testMatch: /real-stack\/global\.setup\.ts/,
      teardown: 'real-stack-teardown',
    },
    {
      name: 'real-stack-teardown',
      testMatch: /real-stack\/global\.teardown\.ts/,
    },
    {
      name: 'real-stack',
      testDir: './e2e/real-stack',
      use: { baseURL: process.env.FRONTEND_URL || 'http://localhost:5173' },
      dependencies: ['real-stack-setup'],
    },
    {
      name: 'real-stack-mobile',
      testDir: './e2e/real-stack',
      use: {
        ...devices['iPhone 14'],
        baseURL: process.env.FRONTEND_URL || 'http://localhost:5173',
      },
      dependencies: ['real-stack-setup'],
    },
  ],
});
```

### global.setup.ts — wait for services + seed

```ts
import { test as setup, expect } from '@playwright/test';

setup('wait for stack and seed DB', async ({ request }) => {
  // Poll until API is actually ready (healthcheck passes before migrations finish)
  await expect(async () => {
    const resp = await request.get('/health');
    expect(resp.status()).toBe(200);
  }).toPass({ intervals: [2_000, 3_000, 5_000], timeout: 60_000 });

  // Reset DB to clean state
  await request.post('/internal/db/reset', {
    headers: { 'X-Internal-Token': process.env.INTERNAL_TOKEN! },
  });
});
```

---

## Real User Auth Fixture (No localStorage Injection)

```ts
// e2e/real-stack/fixtures.ts
import { test as base, expect, APIRequestContext } from '@playwright/test';

type WorkerFixtures = { account: { email: string; password: string; userId: string } };

export const test = base.extend<{}, WorkerFixtures>({
  account: [async ({ playwright }, use, workerInfo) => {
    const api = await playwright.request.newContext({
      baseURL: process.env.API_URL || 'http://localhost:8000',
    });

    const email = `e2e-${workerInfo.workerIndex}-${Date.now()}@test.invalid`;
    const password = 'Test@12345!';

    const regResp = await api.post('/api/auth/register', {
      data: { email, password, locale: 'it' },
    });
    expect(regResp.ok()).toBeTruthy();
    const { user_id } = await regResp.json();

    await use({ email, password, userId: user_id });

    // Teardown — runs even on failure
    await api.delete(`/internal/users/${user_id}`, {
      headers: { 'X-Internal-Token': process.env.INTERNAL_TOKEN! },
    });
    await api.dispose();
  }, { scope: 'worker' }], // one account per worker, not per test
});
```

---

## FastAPI LLM Stub Server

The backend calls LLMs via Python SDK → stub must be a Python server that matches Gemini/OpenAI API contract.

```python
# api/tests/llm_stub_server.py
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse
import json

app = FastAPI()

# Fixture responses keyed by trigger substring in message content
FIXTURES = {
    "search_italy_rules": {
        "candidates": [{
            "content": {
                "parts": [{"text": json.dumps({
                    "message": "L'IRPEF 2025 ha 3 scaglioni: 23% fino a 28.000€...",
                    "affordability_verdict": None,
                    "resource_cards": [],
                    "action_cards": [],
                    "details_a2ui": None,
                    "new_insight": None,
                })}]
            },
            "finishReason": "STOP"
        }]
    },
    "default": {
        "candidates": [{
            "content": {
                "parts": [{"text": json.dumps({
                    "message": "Stub response: tutto ok.",
                    "affordability_verdict": None,
                    "resource_cards": [],
                    "action_cards": [],
                    "details_a2ui": None,
                    "new_insight": None,
                })}]
            },
            "finishReason": "STOP"
        }]
    }
}

@app.get("/health")
async def health():
    return {"status": "ok"}

@app.post("/v1beta/models/{model}:generateContent")
async def gemini_generate(model: str, request: Request):
    body = await request.json()
    content = json.dumps(body)
    for trigger, fixture in FIXTURES.items():
        if trigger in content:
            return JSONResponse(fixture)
    return JSONResponse(FIXTURES["default"])

@app.post("/v1/chat/completions")
async def openai_completions(request: Request):
    body = await request.json()
    content = json.dumps(body)
    # OpenAI format wrapper
    for trigger, fixture in FIXTURES.items():
        if trigger != "default" and trigger in content:
            return JSONResponse({
                "choices": [{"message": {
                    "content": json.dumps(fixture["candidates"][0]["content"]["parts"][0]["text"])
                }}]
            })
    return JSONResponse({
        "choices": [{"message": {"content": "Stub response."}}]
    })
```

### Dockerfile.llm-stub

```dockerfile
FROM python:3.12-slim
WORKDIR /app
RUN pip install fastapi uvicorn
COPY llm_stub_server.py .
CMD ["uvicorn", "llm_stub_server:app", "--host", "0.0.0.0", "--port", "4010"]
```

---

## FastAPI DB Reset Endpoint (Internal)

```python
# Guarded by ALLOW_TEST_RESET env var — only active in test environments
@router.post("/internal/db/reset")
async def reset_db(
    request: Request,
    db: Session = Depends(get_db),
):
    if not settings.allow_test_reset:
        raise HTTPException(403)
    token = request.headers.get("X-Internal-Token")
    if token != settings.internal_token:
        raise HTTPException(403)
    db.execute(text("""
        TRUNCATE TABLE coaching_sessions, messages, undelivered_messages,
                       transactions, uploads, user_profiles, users
        RESTART IDENTITY CASCADE
    """))
    db.commit()
    return {"status": "reset"}
```

---

## iPhone 14 Emulation (Playwright)

### Exact descriptor (from deviceDescriptorsSource.json)
| Property | Value |
|----------|-------|
| viewport | 390 × 664 (screen minus Safari toolbar) |
| screen | 390 × 844 |
| deviceScaleFactor | 3 |
| isMobile | true |
| hasTouch | true |
| defaultBrowserType | webkit |

### Keyboard open simulation (Playwright has no native keyboard API)

```ts
// Simulate keyboard open by shrinking viewport
await page.setViewportSize({ width: 390, height: 390 }); // ~40% height reduction
await expect(page.getByRole('textbox', { name: 'Scrivi un messaggio' })).toBeInViewport();
await page.setViewportSize({ width: 390, height: 664 }); // restore
```

### Tap target assertion

```ts
const voiceButton = page.getByRole('button', { name: 'Parla' });
const box = await voiceButton.boundingBox();
expect(box!.width).toBeGreaterThanOrEqual(44);
expect(box!.height).toBeGreaterThanOrEqual(44);
```

---

## Common Pitfalls

### Pitfall 1: Healthcheck before migrations complete
**What goes wrong:** API healthcheck passes but DB schema migrations haven't run yet → seeder fails.
**How to avoid:** Use `db-seeder` service with `depends_on: api: condition: service_healthy` + `restart: on-failure`.

### Pitfall 2: Partial healthcheck override drops test
**What goes wrong:** `docker-compose.test.yml` overrides `interval:` only → `test:` field silently removed → container never becomes healthy.
**How to avoid:** Always redeclare the complete `healthcheck:` block in override files.

### Pitfall 3: Shared account across tests causes state bleed
**What goes wrong:** Tests run in parallel, share one account, modify its state, interfere with each other.
**How to avoid:** `{ scope: 'worker' }` gives each Playwright worker its own isolated account.

### Pitfall 4: Asserting SSE streaming intermediate states
**What goes wrong:** Playwright can't assert chunk order for SSE streams — only final DOM state.
**How to avoid:** Assert only final rendered state. For tool calls, assert the tool was called by checking DB state or response content, not SSE stream order.

---

## Sources

- Playwright docs — Project Dependencies: https://playwright.dev/docs/test-global-setup-teardown
- Playwright deviceDescriptorsSource.json — iPhone 14 exact values
- Docker Compose docs — condition: service_healthy: https://docs.docker.com/compose/compose-file/05-services/#condition
- Docker Compose bug #10188: partial healthcheck override

**Research date:** 2026-04-06
**Valid until:** 2026-07-06 (Playwright and Docker Compose patterns are stable)
