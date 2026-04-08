import { test as base, expect } from "@playwright/test"

/**
 * Real-stack Playwright fixtures.
 *
 * account (worker-scoped):
 *   Creates a real user account via the API before tests run, sets first_name
 *   so the user skips /setup, and deletes it after. Worker-scoped means one
 *   account per Playwright worker — no cross-worker state bleed.
 *
 * Usage:
 *   import { test, loginAs } from "./fixtures"
 *   test("my test", async ({ page, account }) => {
 *     await loginAs(page, account)
 *     ...
 *   })
 */

type Account = {
    email: string
    password: string
    userId: string
    accessToken: string
}

type WorkerFixtures = {
    account: Account
}

export const test = base.extend<Record<string, never>, WorkerFixtures>({
    account: [
        async ({ playwright }, use, workerInfo) => {
            const apiBase = process.env.API_URL ?? "http://localhost:8000"
            const internalToken =
                process.env.INTERNAL_TOKEN ?? "test-internal-token"

            const api = await playwright.request.newContext({
                baseURL: apiBase,
            })

            const email = `e2e-${workerInfo.workerIndex}-${Date.now()}@test.invalid`
            const password = "Test@12345!"

            // Create real account via the auth API
            const signupResp = await api.post("/auth/signup", {
                data: { email, password },
            })
            expect(
                signupResp.status(),
                `Signup failed for ${email}: ${await signupResp.text()}`
            ).toBe(201)

            const signupBody = await signupResp.json()
            const userId: string = signupBody.user?.id
            const accessToken: string = signupBody.accessToken

            expect(userId, "signup response missing user.id").toBeTruthy()

            // Set first_name so the user skips /setup on first login
            await api.patch("/auth/me", {
                data: { first_name: "E2E", last_name: "Test" },
                headers: { Authorization: `Bearer ${accessToken}` },
            })

            await use({ email, password, userId, accessToken })

            // Teardown: delete the test user (cascade removes all related data)
            await api.delete(`/internal/users/${userId}`, {
                headers: { "X-Internal-Token": internalToken },
            })
            await api.dispose()
        },
        { scope: "worker" },
    ],
})

export { expect } from "@playwright/test"

/**
 * Helper: drive the browser through the login form with real account credentials.
 * Waits for redirect away from /login.
 */
export async function loginAs(
    page: import("@playwright/test").Page,
    account: Account
): Promise<void> {
    await page.goto("/login")
    await page.getByLabel("Email").fill(account.email)
    await page.getByLabel("Password").fill(account.password)
    await page.getByRole("button", { name: "Accedi" }).click()
    // Wait for redirect away from /login (to /onboarding, /chat, /setup, etc.)
    await page.waitForURL((url) => !url.pathname.includes("/login"), {
        timeout: 15_000,
    })
}
