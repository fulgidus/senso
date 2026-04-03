import { defineConfig, devices } from "@playwright/test"

/**
 * Playwright E2E configuration for S.E.N.S.O. front-end.
 *
 * Strategy:
 *  - Tests run against a local Vite preview server (or dev server).
 *  - All external HTTP calls (FastAPI backend) are intercepted with
 *    `page.route()` mocks inside each test — no real backend required.
 *  - CI uses chromium only; extend to webkit/firefox as a separate job.
 *
 * Usage:
 *   pnpm test:e2e           # headless
 *   pnpm test:e2e --ui      # Playwright UI mode
 *   pnpm test:e2e --headed  # headed Chromium
 */
export default defineConfig({
  testDir: "./e2e",
  /* Maximum time one test can run (ms) */
  timeout: 30_000,
  /* Expect timeout for individual assertions */
  expect: { timeout: 8_000 },
  /* Re-run on first failure (flakiness guard) */
  retries: process.env.CI ? 2 : 0,
  /* Parallelism — keep low so Vite preview isn't hammered */
  workers: process.env.CI ? 2 : 1,
  /* Reporter */
  reporter: [
    ["list"],
    ["html", { open: "never", outputFolder: "playwright-report" }],
  ],

  use: {
    /* Base URL — Vite preview default */
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:4173",
    /* Headless by default */
    headless: true,
    /* Capture traces on first retry */
    trace: "on-first-retry",
    /* Screenshot on failure */
    screenshot: "only-on-failure",
    /* Use en locale so test assertions match en.json strings */
    locale: "en-US",
    /* Viewport */
    viewport: { width: 1280, height: 800 },
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],

  /* Spin up Vite preview before tests — skip if PLAYWRIGHT_BASE_URL is set */
  webServer: process.env.PLAYWRIGHT_BASE_URL
    ? undefined
    : {
        command: "pnpm build && pnpm preview --port 4173",
        port: 4173,
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
        env: {
          VITE_BACKEND_URL: "http://localhost:8000",
        },
      },
})
