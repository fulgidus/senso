/**
 * smoke-admin.spec.ts
 *
 * Smoke test #3 - Admin content page loads and paginates.
 *
 * Scenario:
 *  1. Admin user navigates to /admin/content.
 *  2. The page heading and item table are visible.
 *  3. With 30 items (PAGE_SIZE = 25), two pages exist.
 *  4. Clicking "Next →" advances to page 2.
 *  5. Clicking "← Prev" returns to page 1.
 *  6. Non-admin user is redirected away from /admin/content.
 *  7. Filters (locale, type, search) narrow the visible row count.
 *
 * All backend calls are mocked - no live server required.
 */

import { test, expect } from "@playwright/test";
import {
  setupAdminSession,
  mockAdminContent,
  mockAdminContentExtras,
  mockAllCoaching,
  mockNotifications,
  makeFakeContentItems,
  FAKE_USER,
  FAKE_TOKENS,
} from "./support/api-mocks";
import type { Route } from "@playwright/test";

// ── shared beforeEach for admin tests ─────────────────────────────────────────

async function goToAdminContent(page: Parameters<typeof setupAdminSession>[0]) {
  await setupAdminSession(page);
  mockAdminContent(page, 30); // 30 items → 2 pages (PAGE_SIZE = 25)
  mockAdminContentExtras(page);
  mockAllCoaching(page);

  await page.goto("/admin/content");

  // Wait for the page heading to confirm we landed
  await expect(page.getByRole("heading", { name: /content management/i })).toBeVisible({
    timeout: 12_000,
  });
}

// ── Test suite ────────────────────────────────────────────────────────────────

test.describe("Smoke - Admin content page", () => {
  // ── 1. Page loads ───────────────────────────────────────────────────────────
  test("admin content page loads with item table", async ({ page }) => {
    await goToAdminContent(page);

    // The subtitle shows the total item count
    await expect(page.getByText(/30 items/i).or(page.getByText(/items in catalog/i))).toBeVisible({
      timeout: 8_000,
    });

    // At least one content row should be visible (first page = 25 rows)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(25, { timeout: 8_000 });
  });

  // ── 2. Pagination: Next ─────────────────────────────────────────────────────
  test("pagination: Next button loads page 2", async ({ page }) => {
    await goToAdminContent(page);

    // Pagination controls should be present (totalPages > 1)
    const nextBtn = page.getByRole("button", { name: /next/i });
    await expect(nextBtn).toBeVisible({ timeout: 8_000 });
    await expect(nextBtn).toBeEnabled();

    // Page info should say "Page 1 of 2"
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible({ timeout: 5_000 });

    // Click Next
    await nextBtn.click();

    // Page info should update to "Page 2 of 2"
    await expect(page.getByText(/page 2 of 2/i)).toBeVisible({ timeout: 5_000 });

    // Page 2 has only 5 rows (30 total - 25 on page 1)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(5, { timeout: 8_000 });

    // Next button should now be disabled on last page
    await expect(nextBtn).toBeDisabled();
  });

  // ── 3. Pagination: Prev ─────────────────────────────────────────────────────
  test("pagination: Prev button returns to page 1", async ({ page }) => {
    await goToAdminContent(page);

    // Navigate to page 2
    const nextBtn = page.getByRole("button", { name: /next/i });
    await nextBtn.click();
    await expect(page.getByText(/page 2 of 2/i)).toBeVisible({ timeout: 5_000 });

    // The Prev button should be enabled now
    const prevBtn = page.getByRole("button", { name: /prev/i });
    await expect(prevBtn).toBeEnabled();
    await prevBtn.click();

    // Should be back to page 1
    await expect(page.getByText(/page 1 of 2/i)).toBeVisible({ timeout: 5_000 });
    await expect(prevBtn).toBeDisabled();

    // Full 25 rows again
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(25, { timeout: 8_000 });
  });

  // ── 4. Pagination absent when ≤ PAGE_SIZE items ─────────────────────────────
  test("pagination controls absent when all items fit on one page", async ({ page }) => {
    await setupAdminSession(page);
    // Only 10 items - no pagination needed
    mockAdminContent(page, 10);
    mockAdminContentExtras(page);
    mockAllCoaching(page);

    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { name: /content management/i })).toBeVisible({
      timeout: 12_000,
    });

    // All 10 rows present
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(10, { timeout: 8_000 });

    // No pagination buttons
    await expect(page.getByRole("button", { name: /next/i })).not.toBeVisible();
    await expect(page.getByRole("button", { name: /prev/i })).not.toBeVisible();
  });

  // ── 5. Search filter narrows rows ──────────────────────────────────────────
  test("search filter narrows the visible rows", async ({ page }) => {
    await goToAdminContent(page);

    // All 25 visible initially (page 1)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(25, { timeout: 8_000 });

    // Type a search query that matches only a few items
    // Our fake items are titled "Test Article 1" through "Test Article 30"
    // Searching "Article 1" will match: 1, 10-19 (but after pagination reset,
    // all matching items from the full set are shown).
    const searchInput = page.getByPlaceholder(/search/i);
    await searchInput.fill("Article 1");

    // After filtering, page resets to 1 and shows fewer rows
    // "Article 1" matches: 1, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19 = 11 items
    await expect(rows).toHaveCount(11, { timeout: 5_000 });

    // Clear search - all rows return
    await searchInput.clear();
    await expect(rows).toHaveCount(25, { timeout: 5_000 });
  });

  // ── 6. Locale filter ────────────────────────────────────────────────────────
  test("locale filter shows only matching items", async ({ page }) => {
    await setupAdminSession(page);
    // Our factory alternates locale: even index → "en", odd → "it"
    // 30 items: 15 "en" (indices 0,2,4,...28) + 15 "it" (indices 1,3,...29)
    // But the mock returns ALL 30 and the component filters client-side only
    // for the search box - locale filter is server-side via API params.
    // So we mock the filtered response directly for this test.
    const enItems = makeFakeContentItems(15).map((it) => ({ ...it, locale: "en" }));
    page.route(/\/admin\/content\/items(?:\?|$)/, (route: Route) => {
      const url = new URL(route.request().url());
      const localeParam = url.searchParams.get("locale");
      if (localeParam === "en") {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({
            items: enItems,
            total: 15,
            page: 1,
            page_size: 100,
            total_pages: 1,
          }),
        });
      } else {
        // Default: all 30
        const all = makeFakeContentItems(30);
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ items: all, total: 30, page: 1, page_size: 100, total_pages: 1 }),
        });
      }
    });
    mockAdminContentExtras(page);
    mockAllCoaching(page);

    await page.goto("/admin/content");
    await expect(page.getByRole("heading", { name: /content management/i })).toBeVisible({
      timeout: 12_000,
    });

    // Initially 25 rows (page 1 of 30)
    const rows = page.locator("table tbody tr");
    await expect(rows).toHaveCount(25, { timeout: 8_000 });

    // Select "EN" from the locale dropdown
    const localeSelect = page.locator("select").filter({ hasText: /all locales/i });
    await localeSelect.selectOption("en");

    // After locale change the API is re-called and returns 15 items (< PAGE_SIZE)
    await expect(rows).toHaveCount(15, { timeout: 8_000 });
  });

  // ── 7. Non-admin user is redirected ────────────────────────────────────────
  test("non-admin user is redirected away from /admin/content", async ({ page }) => {
    // Set up a regular (non-admin) authenticated session
    await page.addInitScript((tokens) => {
      localStorage.setItem("senso.auth.access_token", tokens.accessToken);
      localStorage.setItem("senso.auth.refresh_token", tokens.refreshToken);
    }, FAKE_TOKENS);

    // Mock /auth/me as non-admin user
    page.route("**/auth/me", (route: Route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          user: { ...FAKE_USER, is_admin: false, role: "user" },
        }),
      });
    });
    mockAllCoaching(page);
    mockNotifications(page);

    await page.goto("/admin/content");

    // Should NOT show the content management page
    // ProtectedRoute redirects to "/" → RootResolver → "/chat"
    await page.waitForURL(/\/(chat|$|setup|onboarding)/, { timeout: 10_000 });
    await expect(page.getByRole("heading", { name: /content management/i })).not.toBeVisible();
  });

  // ── 8. "New content" button toggles create form ─────────────────────────────
  test("New content button shows and hides the create form", async ({ page }) => {
    await goToAdminContent(page);

    // Create form should not be visible initially
    await expect(page.getByRole("heading", { name: /create new content/i })).not.toBeVisible();

    // Click New content
    await page.getByRole("button", { name: /newcontent/i }).click();

    // Form heading should appear
    await expect(page.getByRole("heading", { name: /create new content/i })).toBeVisible({
      timeout: 5_000,
    });

    // Click Cancel (button text changes to "Cancel")
    await page
      .getByRole("button", { name: /cancel/i })
      .first()
      .click();

    // Form disappears
    await expect(page.getByRole("heading", { name: /create new content/i })).not.toBeVisible();
  });
});
