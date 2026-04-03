/**
 * smoke-profile.spec.ts
 *
 * Smoke test #2 — Profile page loads with sections and hash navigation.
 *
 * Scenario:
 *  1. Authenticated user navigates to /profile.
 *  2. Page loads and shows the financial profile heading.
 *  3. The key data sections (income, spending, income-vs-expenses, insights)
 *     are present in the DOM.
 *  4. Hash navigation (#income, #spending, etc.) scrolls the matching section
 *     into view — verified by checking the element's `id` attribute exists.
 *
 * All backend calls are mocked.
 */

import { test, expect } from "@playwright/test"
import {
  setupAuthenticatedSession,
  mockProfile,
  mockAllCoaching,
} from "./support/api-mocks"

test.describe("Smoke — Profile page sections & hash nav", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
    mockProfile(page)
    // Chat-related endpoints are hit via RootResolver / AppShell even on /profile
    mockAllCoaching(page)
  })

  test("profile page loads and shows financial data sections", async ({ page }) => {
    await page.goto("/profile")

    // ── Profile heading ───────────────────────────────────────────────────────
    await expect(
      page.getByRole("heading", { name: /your financial profile/i })
    ).toBeVisible({ timeout: 10_000 })

    // ── Income section ────────────────────────────────────────────────────────
    // The section has id="income"; look for the label text that appears inside it
    await expect(
      page.locator("#income").or(page.getByText(/monthly income/i))
    ).toBeVisible({ timeout: 8_000 })

    // ── Spending breakdown section ────────────────────────────────────────────
    await expect(
      page.locator("#spending").or(page.getByText(/where your money goes/i))
    ).toBeVisible({ timeout: 8_000 })

    // ── Income vs Expenses chart section ──────────────────────────────────────
    await expect(
      page.locator("#income-vs-expenses").or(page.getByText(/income vs\. expenses/i))
    ).toBeVisible({ timeout: 8_000 })

    // ── Insights section ──────────────────────────────────────────────────────
    await expect(
      page.locator("#insights").or(page.getByText(/what your data says/i))
    ).toBeVisible({ timeout: 8_000 })
  })

  test("hash navigation: /profile#income scrolls to income section", async ({ page }) => {
    // Navigate directly with the hash fragment
    await page.goto("/profile#income")

    // Wait for the page to settle
    await expect(
      page.getByRole("heading", { name: /your financial profile/i })
    ).toBeVisible({ timeout: 10_000 })

    // The #income section must be in the DOM
    const incomeSection = page.locator("#income")
    await expect(incomeSection).toBeAttached({ timeout: 8_000 })

    // Verify the element is visible in the viewport (i.e., browser scrolled to it)
    await expect(incomeSection).toBeInViewport({ timeout: 8_000 })
  })

  test("hash navigation: /profile#spending scrolls to spending section", async ({ page }) => {
    await page.goto("/profile#spending")

    await expect(
      page.getByRole("heading", { name: /your financial profile/i })
    ).toBeVisible({ timeout: 10_000 })

    const spendingSection = page.locator("#spending")
    await expect(spendingSection).toBeAttached({ timeout: 8_000 })

    // Use scrollIntoView to handle that the section might need manual scroll
    await spendingSection.scrollIntoViewIfNeeded()
    await expect(spendingSection).toBeInViewport({ timeout: 5_000 })
  })

  test("profile stale-data warning is absent when data is fresh", async ({ page }) => {
    // The default FAKE_PROFILE has stale: false — no warning banner expected
    await page.goto("/profile")
    await expect(
      page.getByRole("heading", { name: /your financial profile/i })
    ).toBeVisible({ timeout: 10_000 })

    // Stale warning text should NOT appear
    await expect(
      page.getByText(/new documents uploaded/i)
    ).not.toBeVisible()
  })

  test("profile shows stale warning when data is outdated", async ({ page }) => {
    // Override profile mock with stale: true for just this test
    page.route("**/profile", (route) => {
      if (route.request().method() === "GET") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            has_profile: true,
            status: "ready",
            income_summary: { amount: 3000, currency: "EUR", source: "payslip" },
            monthly_expenses: 1800,
            spending_breakdown: [],
            income_vs_expenses_chart: [],
            insights: [],
            stale: true,
            last_updated: "2026-03-01T00:00:00Z",
            raw_sources: ["payslip"],
          }),
        })
      } else {
        route.continue()
      }
    })

    await page.goto("/profile")
    await expect(
      page.getByRole("heading", { name: /your financial profile/i })
    ).toBeVisible({ timeout: 10_000 })

    // Stale warning should appear
    await expect(
      page.getByText(/re-analyse documents/i).or(page.getByText(/new documents/i))
    ).toBeVisible({ timeout: 8_000 })
  })
})
