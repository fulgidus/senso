import { test as setup, expect } from "@playwright/test"

/**
 * Global setup for the real-stack Playwright project.
 *
 * Runs before any real-stack specs. Polls the API health endpoint until the
 * full Docker Compose stack (postgres → api → frontend) is ready, then resets
 * the DB to a clean state so every test run starts fresh.
 *
 * Uses Playwright Project Dependencies (v1.31+) instead of globalSetup config:
 * - Appears in HTML report
 * - Supports traces and screenshots
 * - Works with fixtures
 */
setup("wait for stack and reset DB", async ({ request }) => {
    const apiBase = process.env.API_URL ?? "http://localhost:8000"
    const internalToken = process.env.INTERNAL_TOKEN ?? "test-internal-token"

    // Poll until the API is actually responding (healthcheck passes before
    // migrations finish, so we poll rather than relying on healthcheck alone)
    await expect(async () => {
        const resp = await request.get(`${apiBase}/health`)
        expect(resp.status()).toBe(200)
    }).toPass({ intervals: [2_000, 3_000, 5_000], timeout: 60_000 })

    // Reset DB to a clean state before the test suite
    const resetResp = await request.post(`${apiBase}/internal/db/reset`, {
        headers: { "X-Internal-Token": internalToken },
    })
    expect(
        resetResp.status(),
        "DB reset failed - is ALLOW_TEST_RESET=true and INTERNAL_TOKEN set?"
    ).toBe(200)
})
