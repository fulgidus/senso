import { test as teardown, expect } from "@playwright/test"

/**
 * Global teardown for the real-stack Playwright project.
 *
 * Runs after all real-stack specs complete (including on failure).
 * Deletes any leftover e2e-*@test.invalid accounts that weren't cleaned up
 * by individual fixture teardowns (defensive cleanup).
 */
teardown("clean up test accounts", async ({ request }) => {
    const apiBase = process.env.API_URL ?? "http://localhost:8000"
    const internalToken = process.env.INTERNAL_TOKEN ?? "test-internal-token"

    // Reset DB as a final safety net - removes any dangling test data
    const resp = await request.post(`${apiBase}/internal/db/reset`, {
        headers: { "X-Internal-Token": internalToken },
    })
    // Log but don't fail teardown if reset itself fails
    if (!resp.ok()) {
        console.warn(
            `[teardown] DB reset returned ${resp.status()} - test data may remain`
        )
    }
})
