/**
 * fixtures.ts - Playwright test fixtures for SENSO E2E tests.
 *
 * Usage:
 *   import { test, expect } from "../support/fixtures"
 *
 *   test("my test", async ({ authedPage }) => { ... })
 */
import { test as base, expect, type Page } from "@playwright/test"
import {
    setupAuthenticatedSession,
    mockAllCoaching,
    mockNotifications,
    mockProfile,
} from "./api-mocks"

export type SensoFixtures = {
    /** Authenticated page with all standard mocks applied. */
    authedPage: Page
}

export const test = base.extend<SensoFixtures>({
    authedPage: async ({ page }, use) => {
        await setupAuthenticatedSession(page)
        mockAllCoaching(page)
        mockNotifications(page)
        await use(page)
    },
})

export { expect }
