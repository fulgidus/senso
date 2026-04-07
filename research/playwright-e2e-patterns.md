# Research: Playwright E2E Patterns (2024-2026)

> Playwright version baseline: **v1.44+** (May 2024) through current **v1.51+** (2025).  
> All API signatures are verified against official Playwright docs and the upstream `deviceDescriptorsSource.json`.

---

## Summary

Playwright's recommended patterns have consolidated around **Project Dependencies** (not `globalSetup`), **worker-scoped fixtures** for shared state like user accounts, and dedicated LLM mock servers (either aimock for JS/TS or a FastAPI subprocess fixture). Mobile emulation uses the `devices` registry with `hasTouch: true` automatically routing pointer events as touch events; keyboard simulation requires manual viewport-shrink workarounds since there is no native virtual keyboard API.

---

## Part 1 - Real Stack E2E Tests Against Docker Compose

### 1.1 Override File Pattern

Use a separate `docker-compose.test.yml` that extends the base compose file, adding test-specific services (seeder, stub LLM, test DB) without modifying production config.

```bash
# Launch test stack
docker compose -f docker-compose.yml -f docker-compose.test.yml up -d

# Run tests
npx playwright test

# Tear down
docker compose -f docker-compose.yml -f docker-compose.test.yml down -v
```

```yaml
# docker-compose.test.yml  (override, not standalone)
services:
  db:
    # Override: use a throwaway test database
    environment:
      POSTGRES_DB: senso_test
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U test -d senso_test"]
      interval: 3s
      timeout: 5s
      retries: 10
      start_period: 10s

  api:
    environment:
      DATABASE_URL: postgresql+asyncpg://test:test@db:5432/senso_test
      OPENAI_BASE_URL: http://llm-stub:4010/v1   # point at stub
    depends_on:
      db:
        condition: service_healthy
      llm-stub:
        condition: service_healthy

  llm-stub:
    image: ghcr.io/copilotkit/aimock:latest
    ports:
      - "4010:4010"
    volumes:
      - ./tests/fixtures/llm:/fixtures
    command: ["-p", "4010", "-f", "/fixtures"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4010/health"]
      interval: 3s
      timeout: 5s
      retries: 5

  db-seeder:
    build: ./tests/seeder
    environment:
      DATABASE_URL: postgresql://test:test@db:5432/senso_test
    depends_on:
      db:
        condition: service_healthy
      api:
        condition: service_healthy    # wait for migrations to run
    restart: on-failure               # retry if API hasn't migrated yet
```

**Key rules:**
- `condition: service_healthy` requires a `healthcheck:` block in the target service (Docker Compose 2.1+).
- `service_completed_successfully` is for one-shot init containers (migrations, seeders).
- Remove `version:` key for Docker Compose v2 plugin (it's deprecated).

---

### 1.2 Healthcheck Patterns by Service

```yaml
# PostgreSQL
healthcheck:
  test: ["CMD-SHELL", "pg_isready -U ${POSTGRES_USER} -d ${POSTGRES_DB}"]
  interval: 3s
  timeout: 5s
  retries: 10
  start_period: 10s   # grace period before first check

# Redis
healthcheck:
  test: ["CMD", "redis-cli", "ping"]
  interval: 3s
  timeout: 3s
  retries: 5

# FastAPI app (requires /health or /healthz endpoint)
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:8000/health"]
  interval: 5s
  timeout: 5s
  retries: 10
  start_period: 15s

# Qdrant vector DB
healthcheck:
  test: ["CMD", "curl", "-f", "http://localhost:6333/healthz"]
  interval: 5s
  timeout: 5s
  retries: 5
  start_period: 10s
```

---

### 1.3 Playwright globalSetup - Project Dependencies (Recommended, v1.31+)

The **Project Dependencies** pattern is Playwright's recommended approach as of v1.31. It shows up in HTML reports, supports traces, and works with fixtures - none of which work with `globalSetup:` config option.

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: process.env.BASE_URL ?? 'http://localhost:3000',
  },
  projects: [
    // 1. Setup project - runs first, waits for Docker services
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
      teardown: 'teardown',         // linked teardown
    },
    // 2. Teardown project - runs after all tests complete
    {
      name: 'teardown',
      testMatch: /global\.teardown\.ts/,
    },
    // 3. Test projects depend on 'setup'
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 14'] },
      dependencies: ['setup'],
    },
  ],
});
```

```ts
// tests/global.setup.ts
import { test as setup, expect } from '@playwright/test';

setup('wait for services and seed DB', async ({ request }) => {
  // 1. Poll until API is ready (Docker Compose healthcheck may still
  //    be passing before migrations finish running)
  await expect(async () => {
    const resp = await request.get('/health');
    expect(resp.status()).toBe(200);
  }).toPass({
    intervals: [2_000, 3_000, 5_000],
    timeout: 60_000,
  });

  // 2. Seed test database via API endpoint or direct HTTP call
  const seed = await request.post('/internal/seed', {
    data: { scenario: 'e2e_base' },
  });
  expect(seed.ok()).toBeTruthy();
});
```

```ts
// tests/global.teardown.ts
import { test as teardown } from '@playwright/test';

teardown('clean up test data', async ({ request }) => {
  await request.post('/internal/reset');
});
```

> **Alternative (legacy) `globalSetup` config option** - still works for CI where you just need to poll a URL before tests run, but it doesn't appear in HTML reports and doesn't support fixtures.

```ts
// global-setup.ts (legacy approach, Playwright ≥ v1.0)
import { chromium, type FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  // Wait for API to be healthy by polling
  const baseURL = config.projects[0].use.baseURL!;
  const maxAttempts = 30;
  for (let i = 0; i < maxAttempts; i++) {
    try {
      const resp = await fetch(`${baseURL}/health`);
      if (resp.ok) break;
    } catch {
      if (i === maxAttempts - 1) throw new Error('API never became healthy');
      await new Promise(r => setTimeout(r, 2000));
    }
  }

  // Optionally login and save session
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.goto(baseURL);
  await page.getByLabel('Email').fill(process.env.TEST_USER_EMAIL!);
  await page.getByLabel('Password').fill(process.env.TEST_USER_PASSWORD!);
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.context().storageState({ path: '.auth/user.json' });
  await browser.close();
}

export default globalSetup;
```

---

### 1.4 Database Reset Between Test Suites

**Pattern A - Truncate via API (preferred for app-controlled schemas):**

```ts
// tests/global.setup.ts - truncate before each run
setup('reset database', async ({ request }) => {
  const resp = await request.post('/internal/db/reset', {
    headers: { 'X-Internal-Token': process.env.INTERNAL_TOKEN! },
  });
  expect(resp.ok()).toBeTruthy();
  
  // Then seed base fixtures
  await request.post('/internal/db/seed', {
    data: { fixtures: ['users', 'content_catalog'] },
  });
});
```

**Pattern B - Per-test isolation with worker-unique data:**

```ts
// tests/fixtures.ts
export const test = base.extend<{ testId: string }, { workerId: string }>({
  workerId: [async ({}, use, workerInfo) => {
    await use(`worker-${workerInfo.workerIndex}`);
  }, { scope: 'worker' }],

  testId: async ({}, use, testInfo) => {
    // Unique ID per test - prefix all created records with this
    await use(`test-${testInfo.testId.slice(0, 8)}`);
  },
});
```

**Pattern C - Raw SQL truncate in globalSetup (fastest):**

```python
# For FastAPI/Python backend: expose a /internal/reset endpoint
# api/app/routers/internal.py  (guarded by env flag, never in production)

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import text
from app.database import get_db

router = APIRouter(prefix="/internal")

@router.post("/db/reset")
async def reset_database(db: AsyncSession = Depends(get_db)):
    if not settings.ALLOW_TEST_RESET:
        raise HTTPException(403, "Not allowed")
    
    # Truncate in dependency order, reset sequences
    await db.execute(text("""
        TRUNCATE TABLE
            coaching_sessions,
            uploaded_documents,
            user_profiles,
            users
        RESTART IDENTITY CASCADE
    """))
    await db.commit()
    return {"status": "reset"}
```

---

## Part 2 - Playwright Fixtures for Real User Accounts

### 2.1 Worker-Scoped Auth Fixture (API-based, no localStorage injection)

The **worker-scoped** pattern creates one real user per Playwright worker process via your actual API - not via localStorage injection or `page.route()` mocking. This is the pattern recommended in the official Playwright docs.

```ts
// tests/fixtures.ts
import { test as base, type APIRequestContext } from '@playwright/test';
import path from 'path';
import fs from 'fs';

type Account = { email: string; password: string; userId: string };
type WorkerFixtures = { account: Account; authToken: string };
type TestFixtures = { authedPage: import('@playwright/test').Page };

export const test = base.extend<TestFixtures, WorkerFixtures>({

  // ── WORKER SCOPE: one real user per Playwright worker ──────────────────
  account: [async ({ playwright }, use, workerInfo) => {
    // Create a real user via your registration API
    const apiContext = await playwright.request.newContext({
      baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    });

    const email = `e2e-worker-${workerInfo.workerIndex}-${Date.now()}@test.invalid`;
    const password = 'Test@12345!';

    const resp = await apiContext.post('/api/auth/register', {
      data: { email, password, locale: 'it', onboarding_complete: true },
    });

    if (!resp.ok()) {
      throw new Error(`Failed to create test user: ${await resp.text()}`);
    }

    const { user_id: userId } = await resp.json();

    // Hand the account to all tests in this worker
    await use({ email, password, userId });

    // ── TEARDOWN: delete the user after worker finishes ─────────────────
    // Use a service-account token or internal endpoint, not the user's own token
    await apiContext.delete(`/internal/users/${userId}`, {
      headers: { 'X-Internal-Token': process.env.INTERNAL_TOKEN! },
    });
    await apiContext.dispose();
  }, { scope: 'worker' }],

  // ── WORKER SCOPE: JWT token, obtained once per worker ──────────────────
  authToken: [async ({ account, playwright }, use) => {
    const apiContext = await playwright.request.newContext({
      baseURL: process.env.BASE_URL ?? 'http://localhost:8000',
    });

    const resp = await apiContext.post('/api/auth/login', {
      data: { email: account.email, password: account.password },
    });
    const { access_token } = await resp.json();
    await apiContext.dispose();
    await use(access_token);
  }, { scope: 'worker' }],

  // ── TEST SCOPE: authenticated page, per test ───────────────────────────
  authedPage: async ({ page, authToken }, use) => {
    // Inject the real JWT into storage - this is NOT mocking;
    // it's the same token you'd get after a real login
    await page.addInitScript((token: string) => {
      localStorage.setItem('sb-access-token', token); // adjust key to match your app
    }, authToken);

    await use(page);
    // No teardown needed: browser context resets between tests
  },
});

export { expect } from '@playwright/test';
```

**Usage in tests:**

```ts
// tests/coaching.spec.ts
import { test, expect } from './fixtures';

test('user can ask a financial question', async ({ authedPage }) => {
  await authedPage.goto('/chat');
  await authedPage.getByRole('textbox', { name: 'Messaggio' }).fill('Posso comprare questo?');
  await authedPage.getByRole('button', { name: 'Invia' }).click();
  await expect(authedPage.getByTestId('coach-response')).toBeVisible({ timeout: 15_000 });
});

// Access the raw account object when needed
test('user profile shows correct email', async ({ authedPage, account }) => {
  await authedPage.goto('/profile');
  await expect(authedPage.getByText(account.email)).toBeVisible();
});
```

---

### 2.2 storageState Pattern (Speed Optimization, v1.0+)

When login is slow (OAuth, MFA), save state to disk and reuse it. Pair with the Project Dependencies setup.

```ts
// tests/global.setup.ts
import { test as setup, expect } from '@playwright/test';
import path from 'path';

const authFile = path.join(__dirname, '../.auth/user.json');

setup('authenticate', async ({ page, request }) => {
  // Create user via API
  await request.post('/api/auth/register', {
    data: { email: 'e2e@test.invalid', password: 'Test@12345!' },
  });

  // Perform real browser login
  await page.goto('/auth/login');
  await page.getByLabel('Email').fill('e2e@test.invalid');
  await page.getByLabel('Password').fill('Test@12345!');
  await page.getByRole('button', { name: 'Accedi' }).click();

  // Wait for login to complete
  await page.waitForURL('/dashboard');

  // Save cookies + localStorage to file
  await page.context().storageState({ path: authFile });
});
```

```ts
// playwright.config.ts  - use the saved state
{
  name: 'chromium',
  use: {
    ...devices['Desktop Chrome'],
    storageState: '.auth/user.json',   // applied to every test context
  },
  dependencies: ['setup'],
}
```

---

### 2.3 Per-Test Cleanup Fixture

```ts
// tests/fixtures.ts - cleanup registry pattern
type CleanupFn = () => Promise<unknown>;

export const test = base.extend<{ cleanup: Cleanup }>({
  cleanup: async ({}, use) => {
    const fns = new Map<symbol, CleanupFn>();

    await use({
      add: (fn: CleanupFn) => {
        const key = Symbol();
        fns.set(key, fn);
        return key;
      },
      remove: (key: symbol) => fns.delete(key),
    });

    // Teardown: run ALL registered cleanup functions even if test failed
    await Promise.allSettled(Array.from(fns.values()).map(fn => fn()));
  },
});

// Usage
test('uploads a document', async ({ authedPage, cleanup, request }) => {
  const { document_id } = await (await request.post('/api/documents', {
    multipart: { file: { name: 'statement.pdf', mimeType: 'application/pdf', buffer: pdfBuffer } },
  })).json();

  // Register cleanup immediately - fires even if test fails below this line
  cleanup.add(() => request.delete(`/api/documents/${document_id}`));

  await authedPage.goto(`/documents/${document_id}`);
  await expect(authedPage.getByTestId('ingestion-status')).toHaveText('Completato');
});
```

---

## Part 3 - FastAPI Stub / Mock Server for LLM in Tests

### 3.1 Option A - aimock (Best for Playwright JS/TS, Playwright ≥ v1.31)

[`@copilotkit/aimock`](https://github.com/CopilotKit/mock-openai) is a zero-dependency Node.js mock that implements the **full OpenAI, Anthropic, Gemini, Bedrock, Azure, and Ollama API contracts**, including SSE streaming. It's maintained with daily drift-detection CI against the real APIs.

```bash
npm install -D @copilotkit/aimock
```

**Start in Playwright globalSetup:**

```ts
// tests/llm-setup.ts (used as a setup project)
import { test as setup } from '@playwright/test';
import { LLMock } from '@copilotkit/aimock';

// Store on process for teardown access
let mock: LLMock;

setup('start LLM stub', async ({}) => {
  mock = new LLMock({ port: 4010 });

  // Route by matching message content (substring or regex)
  mock.onMessage('posso comprare', {
    content: JSON.stringify({
      affordability_verdict: 'conditional',
      summary: 'Basandoci sui tuoi dati: puoi permettertelo con attenzione.',
    }),
  });

  // Default fallback response
  mock.onMessage('*', {
    content: '{"affordability_verdict": null, "summary": "Risposta di test."}',
  });

  await mock.start();

  // Expose URL to tests via env
  process.env.LLM_STUB_URL = mock.url;
  console.log(`LLM stub running at ${mock.url}`);
});
```

**Teardown:**

```ts
// tests/llm-teardown.ts
import { test as teardown } from '@playwright/test';
import { LLMock } from '@copilotkit/aimock';

teardown('stop LLM stub', async ({}) => {
  // aimock exposes a static stop if you stored the instance globally,
  // or use the control API:
  await fetch(`${process.env.LLM_STUB_URL}/control/shutdown`, { method: 'POST' });
});
```

**Sequential fixture responses (per-scenario):**

```ts
mock.onMessage('budget mensile', [
  { content: '{"verdict": "yes", "reason": "Hai abbastanza riserve"}' },  // first call
  { content: '{"verdict": "no", "reason": "Limite raggiunto"}' },          // second call
]);
```

**Streaming:**

```ts
mock.onMessage('spiegami', {
  stream: true,
  chunks: ['Certo, ', 'ecco ', 'la spiegazione...'],
  streamingPhysics: { ttft: 100, tps: 20 },  // tokens per second
});
```

---

### 3.2 Option B - Minimal FastAPI Stub (Python-native, pytest conftest)

When the FastAPI backend calls LLM providers directly via `httpx` or `openai` SDK, intercept at the HTTP level with a real FastAPI server started in a subprocess:

```python
# tests/conftest.py
import pytest
import subprocess
import time
import httpx
import os
import socket

def get_free_port() -> int:
    """Find a free port - avoids hardcoded port conflicts in parallel runs."""
    with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
        s.bind(('', 0))
        return s.getsockname()[1]

@pytest.fixture(scope="session")
def llm_stub_server():
    """Start a minimal FastAPI LLM stub for the test session."""
    port = get_free_port()
    proc = subprocess.Popen(
        ["python", "-m", "uvicorn", "tests.stubs.llm_stub:app",
         "--host", "127.0.0.1", "--port", str(port)],
        env={**os.environ, "STUB_PORT": str(port)},
    )

    # Wait until the stub is accepting connections
    for _ in range(30):
        try:
            resp = httpx.get(f"http://127.0.0.1:{port}/health", timeout=1)
            if resp.status_code == 200:
                break
        except httpx.ConnectError:
            time.sleep(0.5)
    else:
        proc.kill()
        raise RuntimeError("LLM stub server never became healthy")

    yield f"http://127.0.0.1:{port}"

    proc.terminate()
    proc.wait(timeout=5)
```

```python
# tests/stubs/llm_stub.py
"""
Minimal FastAPI server that implements the OpenAI Chat Completions API contract.
Used as a drop-in replacement for OpenAI/Gemini in E2E tests.
"""
from fastapi import FastAPI, Request
from fastapi.responses import JSONResponse, StreamingResponse
import json
import time
import asyncio

app = FastAPI()

# Fixture responses keyed by trigger substring in messages
FIXTURES: dict[str, dict] = {
    "posso comprare": {
        "affordability_verdict": "conditional",
        "summary": "Basandoci sui tuoi dati: reddito 1.200€/mese, spese fisse 800€. Puoi permetterti piccoli acquisti.",
        "resource_cards": [],
        "action_cards": [],
    },
    "default": {
        "affordability_verdict": None,
        "summary": "Risposta di test predefinita.",
        "resource_cards": [],
        "action_cards": [],
    },
}

def _match_fixture(messages: list[dict]) -> dict:
    content = " ".join(m.get("content", "") for m in messages if isinstance(m.get("content"), str)).lower()
    for trigger, response in FIXTURES.items():
        if trigger != "default" and trigger in content:
            return response
    return FIXTURES["default"]

@app.get("/health")
async def health():
    return {"status": "ok"}

# OpenAI-compatible endpoint
@app.post("/v1/chat/completions")
async def chat_completions(request: Request):
    body = await request.json()
    messages = body.get("messages", [])
    fixture = _match_fixture(messages)
    stream = body.get("stream", False)

    response_content = json.dumps(fixture)

    if stream:
        async def sse_generator():
            # Chunk the response to simulate streaming
            chunk = {
                "id": "chatcmpl-test",
                "object": "chat.completion.chunk",
                "created": int(time.time()),
                "model": body.get("model", "gpt-4o-mini"),
                "choices": [{
                    "index": 0,
                    "delta": {"role": "assistant", "content": response_content},
                    "finish_reason": None,
                }],
            }
            yield f"data: {json.dumps(chunk)}\n\n"
            await asyncio.sleep(0.01)
            done_chunk = {**chunk, "choices": [{"index": 0, "delta": {}, "finish_reason": "stop"}]}
            yield f"data: {json.dumps(done_chunk)}\n\n"
            yield "data: [DONE]\n\n"

        return StreamingResponse(sse_generator(), media_type="text/event-stream")

    return JSONResponse({
        "id": "chatcmpl-test",
        "object": "chat.completion",
        "created": int(time.time()),
        "model": body.get("model", "gpt-4o-mini"),
        "choices": [{
            "index": 0,
            "message": {"role": "assistant", "content": response_content},
            "finish_reason": "stop",
        }],
        "usage": {"prompt_tokens": 100, "completion_tokens": 50, "total_tokens": 150},
    })

# Gemini-compatible endpoint (v1beta/generateContent)
@app.post("/v1beta/models/{model}:generateContent")
async def gemini_generate(model: str, request: Request):
    body = await request.json()
    parts = body.get("contents", [{}])
    messages = [{"content": p.get("parts", [{}])[0].get("text", "")} for p in parts]
    fixture = _match_fixture(messages)
    return JSONResponse({
        "candidates": [{
            "content": {
                "parts": [{"text": json.dumps(fixture)}],
                "role": "model",
            },
            "finishReason": "STOP",
        }],
        "usageMetadata": {"promptTokenCount": 100, "candidatesTokenCount": 50},
    })
```

**Wire into FastAPI app under test (conftest or test setup):**

```python
@pytest.fixture(scope="session", autouse=True)
def patch_llm_base_url(llm_stub_server):
    """Redirect all LLM calls to the stub server for the session."""
    monkeypatch = pytest.MonkeyPatch()
    monkeypatch.setenv("OPENAI_BASE_URL", f"{llm_stub_server}/v1")
    monkeypatch.setenv("GEMINI_BASE_URL", f"{llm_stub_server}/v1beta")
    yield
    monkeypatch.undo()
```

---

### 3.3 Using aimock in Docker Compose (Recommended for Full-Stack E2E)

```yaml
# docker-compose.test.yml
services:
  llm-stub:
    image: ghcr.io/copilotkit/aimock:latest
    ports:
      - "4010:4010"
    volumes:
      - ./tests/fixtures/llm:/fixtures:ro
    command: ["-p", "4010", "-f", "/fixtures"]
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:4010/health"]
      interval: 3s
      timeout: 5s
      retries: 5
```

```jsonc
// tests/fixtures/llm/greeting.json  (aimock fixture format)
{
  "request": {
    "url": "/v1/chat/completions",
    "method": "POST",
    "body": { "messages": [{ "content": "posso comprare" }] }
  },
  "response": {
    "status": 200,
    "body": {
      "choices": [{
        "message": {
          "role": "assistant",
          "content": "{\"affordability_verdict\": \"yes\", \"summary\": \"Sì, puoi permettertelo.\"}"
        },
        "finish_reason": "stop"
      }]
    }
  }
}
```

---

### 3.4 Port Management and Test Isolation

```ts
// Avoid port conflicts in parallel Playwright workers
// playwright.config.ts
import { defineConfig } from '@playwright/test';

const BASE_LLM_PORT = 4010;

export default defineConfig({
  workers: 4,
  projects: [{
    name: 'chromium',
    use: {
      // Each worker gets its own stub port via env
      // Set in global setup, workers read from process.env
    },
  }],
});

// In global setup, use a single shared stub (preferred):
// Playwright workers share the same process.env set in globalSetup,
// so one stub on port 4010 is sufficient for all workers.
```

---

## Part 4 - Playwright Mobile Device Emulation

### 4.1 iPhone 14 Device Descriptor (Verified from `deviceDescriptorsSource.json`)

```json
// From: packages/playwright-core/src/server/deviceDescriptorsSource.json
"iPhone 14": {
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
  "screen": { "width": 390, "height": 844 },
  "viewport": { "width": 390, "height": 664 },
  "deviceScaleFactor": 3,
  "isMobile": true,
  "hasTouch": true,
  "defaultBrowserType": "webkit"
}

"iPhone 14 Plus": {
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
  "screen": { "width": 428, "height": 926 },
  "viewport": { "width": 428, "height": 746 },
  "deviceScaleFactor": 3,
  "isMobile": true,
  "hasTouch": true,
  "defaultBrowserType": "webkit"
}

"iPhone 14 Pro Max": {
  "userAgent": "Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/26.4 Mobile/15E148 Safari/604.1",
  "screen": { "width": 430, "height": 932 },
  "viewport": { "width": 430, "height": 750 },
  "deviceScaleFactor": 3,
  "isMobile": true,
  "hasTouch": true,
  "defaultBrowserType": "webkit"
}
```

> **Note:** The viewport height is less than screen height because it accounts for the Safari toolbar (~180px). Landscape variants swap `viewport.width` and `viewport.height`.

---

### 4.2 playwright.config.ts - Multi-Project Mobile Setup

```ts
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  use: {
    baseURL: 'http://localhost:3000',
    locale: 'it-IT',
  },
  projects: [
    // Setup (must run first)
    { name: 'setup', testMatch: /global\.setup\.ts/, teardown: 'teardown' },
    { name: 'teardown', testMatch: /global\.teardown\.ts/ },

    // Desktop
    {
      name: 'Desktop Chrome',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },

    // iPhone 14 - portrait (default)
    {
      name: 'iPhone 14',
      use: { ...devices['iPhone 14'] },  // webkit, 390×664 viewport, hasTouch: true
      dependencies: ['setup'],
    },

    // iPhone 14 - landscape
    {
      name: 'iPhone 14 landscape',
      use: { ...devices['iPhone 14 landscape'] },
      dependencies: ['setup'],
    },

    // Android
    {
      name: 'Pixel 7',
      use: { ...devices['Pixel 7'] },
      dependencies: ['setup'],
    },
  ],
});
```

---

### 4.3 Touch Events vs Pointer Events

When `hasTouch: true` is set (which it is for all mobile device descriptors), Playwright **automatically routes `page.click()` and `page.tap()` as touch events**, not mouse events.

```ts
// page.tap() - dispatches touchstart + touchend (use for mobile)
await page.tap('#submit-button');

// page.click() - on mobile context with hasTouch: true,
// also dispatches as touch. The two are equivalent in Playwright.
await page.click('#submit-button');

// page.touchscreen.tap(x, y) - low-level touchscreen API
// Use when you need precise coordinates
await page.touchscreen.tap(195, 400);

// Swipe (drag simulation)
// page.touchscreen does NOT have a swipe() method - simulate manually:
await page.touchscreen.tap(195, 600);          // touchstart
await page.mouse.move(195, 300, { steps: 10 }); // drag
// OR use the higher-level drag API:
await page.dragAndDrop('#scroll-area', '#scroll-area', {
  sourcePosition: { x: 195, y: 600 },
  targetPosition: { x: 195, y: 200 },
});
```

**Checking touch capability in a test:**

```ts
test('renders touch-friendly button sizes', async ({ page, isMobile }) => {
  await page.goto('/');
  
  if (isMobile) {
    // Touch targets should be ≥ 44×44px (Apple HIG)
    const btn = page.getByRole('button', { name: 'Invia' });
    const box = await btn.boundingBox();
    expect(box!.width).toBeGreaterThanOrEqual(44);
    expect(box!.height).toBeGreaterThanOrEqual(44);
  }
});
```

---

### 4.4 Viewport Size Assertions

```ts
test('shows mobile layout at 390px width', async ({ page }) => {
  await page.goto('/');

  // Assert current viewport
  const viewport = page.viewportSize();
  expect(viewport?.width).toBe(390);    // iPhone 14 portrait
  expect(viewport?.height).toBe(664);   // after Safari toolbar

  // Assert that hamburger menu is visible (not desktop nav)
  await expect(page.getByTestId('hamburger-menu')).toBeVisible();
  await expect(page.getByTestId('desktop-nav')).toBeHidden();
});

test('responsive grid collapses to single column on mobile', async ({ page }) => {
  await page.goto('/dashboard');
  const grid = page.getByTestId('card-grid');
  
  // Check CSS grid columns by evaluating computed style
  const columns = await grid.evaluate(el =>
    getComputedStyle(el).gridTemplateColumns.split(' ').length
  );
  expect(columns).toBe(1);  // single column on mobile
});

// Override viewport mid-test (useful for resize testing)
test('layout adapts on rotation', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 664 });  // portrait
  await page.goto('/');
  await expect(page.getByTestId('hamburger-menu')).toBeVisible();

  await page.setViewportSize({ width: 750, height: 340 });  // landscape
  // Some apps show full nav in landscape even on mobile
  await expect(page.getByTestId('desktop-nav')).toBeVisible();
});
```

---

### 4.5 Virtual Keyboard / Input Simulation on Mobile

Playwright has **no native virtual keyboard simulation** (it cannot open/close the iOS soft keyboard). The keyboard opening changes the viewport height in real browsers, reducing the visible area. Work around it:

```ts
// Simulate keyboard-open viewport shrink (iOS keyboard ~40% of screen)
test('chat input stays visible above keyboard', async ({ page }) => {
  await page.goto('/chat');

  // Full viewport (keyboard closed)
  await page.setViewportSize({ width: 390, height: 664 });

  // Simulate keyboard open: shrink viewport height
  await page.setViewportSize({ width: 390, height: 390 });  // ~40% reduction

  const input = page.getByRole('textbox', { name: 'Messaggio' });
  await expect(input).toBeInViewport();  // still visible above "keyboard"

  // Type on mobile - same API as desktop
  await input.tap();
  await input.fill('Posso comprare le scarpe?');

  // Simulate keyboard dismiss on submission
  await page.setViewportSize({ width: 390, height: 664 });
  await page.getByRole('button', { name: 'Invia' }).tap();
});

// Assert element visibility within the "above keyboard" viewport area
test('send button is not hidden by keyboard', async ({ page }) => {
  await page.goto('/chat');
  await page.setViewportSize({ width: 390, height: 390 });

  const sendButton = page.getByRole('button', { name: 'Invia' });
  const box = await sendButton.boundingBox();

  // Must be fully within the visible (keyboard-free) area
  expect(box!.y + box!.height).toBeLessThanOrEqual(390);
});
```

**`page.keyboard.type()` vs `locator.fill()`:**

```ts
// locator.fill() - fast, recommended for form inputs
await page.getByLabel('Email').fill('user@test.com');

// page.keyboard.type() - dispatches individual key events (use for testing
// character-by-character behavior, autocomplete triggers, etc.)
await page.getByLabel('Cerca').tap();
await page.keyboard.type('scarpe', { delay: 50 });  // simulates typing speed
await page.keyboard.press('Enter');
```

---

## Sources

### Kept
- **Playwright Docs - Global Setup & Teardown** (playwright.dev/docs/test-global-setup-teardown) - authoritative source for Project Dependencies pattern
- **Playwright Docs - Fixtures** (playwright.dev/docs/test-fixtures) - worker-scoped fixture API, `test.extend()`, scope mechanics
- **Playwright Docs - Emulation** (playwright.dev/docs/emulation) - `isMobile`, `hasTouch`, locale, timezone APIs
- **playwright/deviceDescriptorsSource.json** (github.com/microsoft/playwright) - ground truth for iPhone 14 descriptor values
- **Matt Crouch - Playwright Auth Fixtures** (mattcrouch.net, March 2024) - real-world auth fixture pattern
- **Matt Crouch - Cleanup Fixture** (mattcrouch.net, May 2024) - per-test cleanup registry pattern
- **docker.recipes/docs/healthchecks-dependencies** - comprehensive `service_healthy` condition examples
- **denhox.com - healthcheck vs wait-for-it** - practical E2E Docker Compose pattern
- **aimock / @copilotkit/aimock** (github.com/CopilotKit/mock-openai) - LLM stub with drift detection, OpenAI + Gemini + Anthropic contract
- **TestDino - Playwright Mobile Testing Guide** (testdino.com) - touch event routing, isMobile flag, cloud device comparison

### Dropped
- **Speedscale proxymock article** - record-replay tool, good for brownfield but heavyweight for greenfield E2E stub setup
- **openradx/llm_api_server_mock** - only 1 star, Jupyter notebook format, not production-quality
- **Neptune Software - storageState** - basic tutorial, covered by official docs
- **Playwright issue #33202** - feature request thread, not settled API

---

## Gaps

1. **Supabase Auth in Playwright fixtures** - Supabase uses cookie-based sessions (`sb-*` cookies) alongside localStorage. Exact cookie names and PKCE flow simulation in fixtures need project-specific verification against the supabase-js v2 auth schema.

2. **Playwright × aimock streaming validation** - how to assert SSE chunk delivery order in a Playwright test (not just the final rendered output).

3. **iOS keyboard height variance** - the 40% viewport shrink is an approximation. Real Safari on iPhone 14 reduces height by ~291px in portrait mode. The exact value depends on Safari toolbar state and iOS version.

4. **Docker Compose override merging of `healthcheck`** - there is a known bug ([docker/compose #10188](https://github.com/docker/compose/issues/10188)) where partial override of a `healthcheck` block can drop the `test` field. Always redeclare the full `healthcheck` block in override files, not just `interval` or `start_period`.
