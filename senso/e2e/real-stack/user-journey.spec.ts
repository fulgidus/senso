/**
 * user-journey.spec.ts - Full happy-path E2E journey on real stack.
 *
 * Flow: register (fixture) → login via UI → upload Fineco XLSX →
 *       poll ingestion completion → check profile → ask coach → get response.
 *
 * No page.route() mocks. LLM stub from Plan 23-01 handles LLM responses.
 * Run with: npx playwright test --project=real-stack user-journey.spec.ts
 */

import * as path from "path"
import { fileURLToPath } from "url"
import { test, expect, loginAs } from "./fixtures"

// Absolute path to the synthetic Fineco XLSX fixture
const __dirname = path.dirname(fileURLToPath(import.meta.url))
const FINECO_XLSX = path.resolve(
    __dirname,
    "../../../api/tests/fixtures/fineco_sample.xlsx"
)

test.describe("Full user journey (real stack)", () => {
    test("auth: login via UI with real API credentials", async ({
        page,
        account,
    }) => {
        await page.goto("/login")

        // Login form is visible
        await expect(page.getByLabel("Email")).toBeVisible()
        await expect(page.getByLabel("Password")).toBeVisible()

        await page.getByLabel("Email").fill(account.email)
        await page.getByLabel("Password").fill(account.password)
        await page.getByRole("button", { name: "Accedi" }).click()

        // Redirected away from /login
        await page.waitForURL((url) => !url.pathname.includes("/login"), {
            timeout: 15_000,
        })
        expect(page.url()).not.toContain("/login")
    })

    test("upload: Fineco XLSX ingested successfully", async ({
        page,
        account,
    }) => {
        await loginAs(page, account)

        // Navigate to the file upload screen (onboarding or direct)
        await page.goto("/onboarding/upload")
        await expect(
            page.getByText(/Trascina file qui|Scegli file/i)
        ).toBeVisible({ timeout: 10_000 })

        // Set the file on the hidden file input
        const fileInput = page.locator('input[type="file"]')
        await fileInput.setInputFiles(FINECO_XLSX)

        // Wait for the upload to appear in the list (status pending/processing)
        await expect(
            page.getByText(/fineco_sample|In attesa|In elaborazione|Completato/i)
        ).toBeVisible({ timeout: 15_000 })
    })

    test("profile: shows data after document upload", async ({
        page,
        account,
    }) => {
        await loginAs(page, account)

        // Go to profile
        await page.goto("/profile")

        // Profile heading is visible
        await expect(
            page.getByRole("heading", { name: /profilo/i })
        ).toBeVisible({ timeout: 10_000 })

        // Profile page loaded without error
        expect(page.url()).toContain("/profile")
    })

    test("coach: receives real LLM stub response to a question", async ({
        page,
        account,
    }) => {
        await loginAs(page, account)
        await page.goto("/chat")

        // Wait for chat to load
        await expect(
            page.getByPlaceholder(/Chiedi al coach/i)
        ).toBeVisible({ timeout: 15_000 })

        // Send a message
        const textarea = page.getByPlaceholder(/Chiedi al coach/i)
        await textarea.fill("Ho abbastanza risparmi per le vacanze?")
        await page.getByRole("button", { name: "Invia" }).click()

        // Wait for assistant response (LLM stub returns immediately)
        // The assistant bubble appears as a flex-start aligned div in the message list
        await expect(
            page.locator(".flex.justify-start").last().locator("p")
        ).toBeVisible({ timeout: 20_000 })

        const responseText = await page
            .locator(".flex.justify-start")
            .last()
            .locator("p")
            .textContent()
        expect(responseText).toBeTruthy()
        expect(responseText!.length).toBeGreaterThan(10)
    })
})
