/**
 * nav-drawer.spec.ts
 *
 * Tests for the AppShell mobile sidebar drawer.
 * Desktop tests: click hamburger.
 * @mobile tests: same but on mobile viewport where hamburger is always shown.
 */

import { test, expect } from "./support/fixtures"

test.describe("Nav drawer - open / close", () => {
    test.beforeEach(async ({ authedPage: page }) => {
        await page.goto("/chat")
        // Wait for AppShell to mount
        await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible({
            timeout: 10_000,
        })
    })

    test("hamburger button opens the drawer", async ({ authedPage: page }) => {
        await page.getByRole("button", { name: /open menu/i }).click()

        // After opening, the drawer becomes visible
        // Look for aria-modal element or navigation that appears
        await expect(
            page.locator('[aria-modal="true"]').or(page.getByRole("navigation").first())
        ).toBeVisible({ timeout: 5_000 })
    })

    test("close button inside drawer closes it", async ({ authedPage: page }) => {
        await page.getByRole("button", { name: /open menu/i }).click()

        // Wait for drawer open animation
        await page.waitForTimeout(200)

        // Close button is rendered inside the drawer
        const closeBtn = page.getByRole("button", { name: /close menu/i })
            .or(page.getByLabel("Close menu"))
            .or(page.locator('[aria-modal="true"] button[aria-label]').first())
        await expect(closeBtn).toBeVisible({ timeout: 5_000 })
        await closeBtn.click()

        // Drawer should be gone / off-screen
        await page.waitForTimeout(300)  // transition duration
        // The overlay (black backdrop) should not be visible
        await expect(
            page.locator(".fixed.inset-0.bg-black\\/40")
        ).not.toBeVisible()
    })

    test("clicking the backdrop overlay closes the drawer", async ({ authedPage: page }) => {
        await page.getByRole("button", { name: /open menu/i }).click()
        await page.waitForTimeout(200)

        // Click the overlay (the backdrop div, not the sidebar itself)
        const overlay = page.locator(".fixed.inset-0.bg-black\\/40, .fixed.inset-0.backdrop-blur-sm")
            .first()
        await expect(overlay).toBeVisible({ timeout: 5_000 })

        // Click at far right of screen (where the overlay is, not the sidebar)
        const viewport = page.viewportSize() ?? { width: 1280, height: 800 }
        await page.mouse.click(viewport.width - 50, viewport.height / 2)

        await page.waitForTimeout(300)
        await expect(overlay).not.toBeVisible()
    })

    test("pressing Escape closes the drawer", async ({ authedPage: page }) => {
        await page.getByRole("button", { name: /open menu/i }).click()
        await page.waitForTimeout(200)

        const overlay = page.locator(".fixed.inset-0.bg-black\\/40").first()
        await expect(overlay).toBeVisible({ timeout: 5_000 })

        await page.keyboard.press("Escape")
        await page.waitForTimeout(300)

        await expect(overlay).not.toBeVisible()
    })

    test("clicking a nav link inside the drawer closes it", async ({ authedPage: page }) => {
        await page.getByRole("button", { name: /open menu/i }).click()
        await page.waitForTimeout(200)

        const overlay = page.locator(".fixed.inset-0.bg-black\\/40").first()
        await expect(overlay).toBeVisible({ timeout: 5_000 })

        // Click the Profile nav link inside the drawer
        const profileLink = page.locator('[aria-modal="true"] a[href="/profile"]')
            .or(page.getByRole("link", { name: /profile/i }).first())
        await profileLink.click()

        await page.waitForTimeout(300)
        // Overlay gone → drawer closed
        await expect(overlay).not.toBeVisible()
        // Navigated to profile
        await expect(page).toHaveURL(/\/profile/, { timeout: 5_000 })
    })
})

test.describe("Nav drawer - focus trap (a11y)", () => {
    test("Tab key cycles focus within the open drawer", async ({ authedPage: page }) => {
        await page.goto("/chat")
        await expect(page.getByRole("button", { name: /open menu/i })).toBeVisible({
            timeout: 10_000,
        })

        await page.getByRole("button", { name: /open menu/i }).click()
        await page.waitForTimeout(300)

        // Tab through elements and verify focus stays inside the sidebar
        await page.keyboard.press("Tab")
        await page.keyboard.press("Tab")
        await page.keyboard.press("Tab")

        // Check that focus is on an element INSIDE the drawer
        const focusedElement = await page.evaluate(() => {
            const el = document.activeElement
            if (!el) return null
            let node: Element | null = el
            while (node) {
                if (
                    node.getAttribute("aria-modal") === "true" ||
                    node.classList.contains("translate-x-0") ||
                    node.getAttribute("role") === "dialog"
                ) {
                    return "inside-drawer"
                }
                node = node.parentElement
            }
            return "outside-drawer"
        })

        // Focus should remain inside the drawer
        expect(focusedElement).toBe("inside-drawer")
    })

    test("drawer has aria-modal and accessible role", async ({ authedPage: page }) => {
        await page.goto("/chat")
        await page.getByRole("button", { name: /open menu/i }).click()
        await page.waitForTimeout(200)

        // The drawer should have aria-modal="true" when open
        const drawerWithModal = page.locator('[aria-modal="true"]')
        const count = await drawerWithModal.count()
        expect(count).toBeGreaterThan(0)
    })

    test("hamburger has accessible label @mobile", async ({ authedPage: page }) => {
        await page.goto("/chat")
        // The hamburger button must have an accessible name
        const hamburger = page.getByRole("button", { name: /open menu|menu/i })
        await expect(hamburger).toBeVisible({ timeout: 10_000 })
        // aria-label should be present
        const label = await hamburger.getAttribute("aria-label")
        expect(label).toBeTruthy()
    })
})
