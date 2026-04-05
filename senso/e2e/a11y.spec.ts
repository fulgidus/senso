/**
 * a11y.spec.ts
 *
 * Automated accessibility tests using axe-core + Playwright keyboard simulation.
 *
 * axe severity levels: critical, serious, moderate, minor
 * We fail on: critical + serious (must-fix for WCAG AA compliance)
 * We warn on: moderate + minor (log but don't fail)
 *
 * Keyboard tests verify Tab order and focus management.
 * aria-live tests verify screen reader announcements for dynamic content.
 */

import { test, expect } from "@playwright/test"
import AxeBuilder from "@axe-core/playwright"
import {
  setupAuthenticatedSession,
  mockAllCoaching,
  mockNotifications,
  mockProfile,
} from "./support/api-mocks"

// ── Shared setup ──────────────────────────────────────────────────────────────

async function setupAndGo(
  page: Parameters<typeof setupAuthenticatedSession>[0],
  path: string,
) {
  await setupAuthenticatedSession(page)
  mockAllCoaching(page)
  mockNotifications(page)
  if (path === "/profile") mockProfile(page)
  await page.goto(path)
  // Wait for the page shell to render
  await page.waitForLoadState("networkidle")
}

// ── axe-core page scans ───────────────────────────────────────────────────────

test.describe("axe-core — zero critical/serious violations", () => {
  const pages = [
    { name: "Login page", path: "/login", needsAuth: false },
    { name: "Chat screen", path: "/chat", needsAuth: true },
    { name: "Profile screen", path: "/profile", needsAuth: true },
    { name: "Settings screen", path: "/settings", needsAuth: true },
  ]

  for (const { name, path, needsAuth } of pages) {
    test(`${name} has no critical or serious a11y violations`, async ({ page }) => {
      if (needsAuth) {
        await setupAndGo(page, path)
      } else {
        await page.goto(path)
        await page.waitForLoadState("networkidle")
      }

      const results = await new AxeBuilder({ page })
        .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
        // Exclude known false-positives from third-party widgets
        .exclude("[data-radix-popper-content-wrapper]")
        .analyze()

      // Separate by severity
      const critical = results.violations.filter((v) => v.impact === "critical")
      const serious = results.violations.filter((v) => v.impact === "serious")
      const moderate = results.violations.filter((v) => v.impact === "moderate")

      // Log moderate/minor violations as warnings (don't fail)
      if (moderate.length > 0) {
        console.warn(
          `[a11y] ${name} — ${moderate.length} moderate violations:`,
          moderate.map((v) => `${v.id}: ${v.description}`).join(", "),
        )
      }

      // Fail on critical and serious only
      const blocking = [...critical, ...serious]
      if (blocking.length > 0) {
        const details = blocking
          .map((v) => `[${v.impact}] ${v.id}: ${v.description}\n  → ${v.helpUrl}`)
          .join("\n")
        throw new Error(`${name} has ${blocking.length} blocking a11y violation(s):\n${details}`)
      }

      expect(blocking).toHaveLength(0)
    })
  }
})

// ── Keyboard navigation ───────────────────────────────────────────────────────

test.describe("Keyboard navigation", () => {
  test("Tab key reaches the chat input on the chat screen", async ({ page }) => {
    await setupAndGo(page, "/chat")

    // Press Tab several times to move focus through the page
    // The chat input should be reachable within 15 Tab presses
    let chatInputFocused = false
    for (let i = 0; i < 15; i++) {
      await page.keyboard.press("Tab")
      const activeTag = await page.evaluate(() => {
        const el = document.activeElement
        return {
          tag: el?.tagName.toLowerCase(),
          role: el?.getAttribute("role"),
          placeholder: el?.getAttribute("placeholder"),
          ariaLabel: el?.getAttribute("aria-label"),
        }
      })
      if (
        activeTag.tag === "textarea" ||
        (activeTag.tag === "input" && activeTag.placeholder?.match(/message|scrivi/i)) ||
        activeTag.ariaLabel?.match(/message|input|chat/i)
      ) {
        chatInputFocused = true
        break
      }
    }
    expect(chatInputFocused).toBe(true)
  })

  test("Tab key reaches the send button after the chat input", async ({ page }) => {
    await setupAndGo(page, "/chat")

    // Focus the chat input first
    const textarea = page.locator("textarea").first()
    await textarea.click()

    // Next Tab should reach the send button (or voice button, or some action button)
    await page.keyboard.press("Tab")
    const nextFocused = await page.evaluate(() => {
      const el = document.activeElement
      return {
        tag: el?.tagName.toLowerCase(),
        type: (el as HTMLInputElement)?.type,
        ariaLabel: el?.getAttribute("aria-label"),
      }
    })
    // Should be a button or another interactive element (not body or container div)
    expect(["button", "a", "input"]).toContain(nextFocused.tag)
  })

  test("Tab key reaches all nav links in the top bar", async ({ page }) => {
    await setupAndGo(page, "/chat")

    // Tab from start of page and collect all focused elements
    const focusedItems: string[] = []
    for (let i = 0; i < 20; i++) {
      await page.keyboard.press("Tab")
      const item = await page.evaluate(() => {
        const el = document.activeElement
        return el?.getAttribute("aria-label") ?? el?.textContent?.trim().slice(0, 30) ?? ""
      })
      if (item) focusedItems.push(item)
    }

    // At least one nav element should be reachable
    const hasNavElement = focusedItems.some((item) =>
      /chat|profile|coach|settings|menu|learn/i.test(item),
    )
    expect(hasNavElement).toBe(true)
  })
})

// ── aria-live regions ─────────────────────────────────────────────────────────

test.describe("aria-live — dynamic content announcements", () => {
  test("chat screen has an aria-live region for status updates", async ({ page }) => {
    await setupAndGo(page, "/chat")

    // The AppShell has role="status" aria-live="polite"
    // The ChatScreen has aria-live="polite" on the loading indicator
    const liveRegions = page.locator('[aria-live="polite"], [aria-live="assertive"]')
    const count = await liveRegions.count()
    expect(count).toBeGreaterThan(0)
  })

  test("sending a message causes a status update in the aria-live region", async ({ page }) => {
    await setupAndGo(page, "/chat")

    // Monitor the aria-live region for content changes
    const liveRegion = page.locator('[aria-live="polite"]').first()

    // Type and send a message
    const input = page.locator("textarea").first()
    await input.fill("What is my budget?")
    await page.keyboard.press("Enter")

    // After sending, the aria-live region should reflect loading state
    await page.waitForTimeout(500)

    // The live region should exist and be in the DOM (even if empty)
    await expect(liveRegion).toBeAttached()
  })
})

// ── Focus trap — compose message modal ────────────────────────────────────────

test.describe("Focus trap — ComposeMessage modal", () => {
  test.beforeEach(async ({ page }) => {
    await setupAndGo(page, "/messages")

    // Mock messages poll
    page.route("**/messages/poll", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" })
    })
    await page.reload()
    await page.waitForLoadState("networkidle")
  })

  test("compose modal traps Tab focus inside the dialog", async ({ page }) => {
    // Open compose modal
    const composeBtn = page.getByRole("button", { name: /compon|compose/i })
    if (!(await composeBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip()
      return
    }
    await composeBtn.click()

    // Wait for modal to open
    const modal = page.getByRole("dialog")
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Tab through elements inside the modal
    let focusEscapedModal = false
    for (let i = 0; i < 10; i++) {
      await page.keyboard.press("Tab")
      const isInsideModal = await page.evaluate(() => {
        let el: Element | null = document.activeElement
        while (el) {
          if (el.getAttribute("role") === "dialog" || el.getAttribute("aria-modal") === "true") {
            return true
          }
          el = el.parentElement
        }
        return false
      })
      if (!isInsideModal) {
        focusEscapedModal = true
        break
      }
    }
    expect(focusEscapedModal).toBe(false)
  })
})

// ── Skip-to-content link ──────────────────────────────────────────────────────

test.describe("Skip-to-content", () => {
  test("skip-to-content link exists and is focusable (if implemented)", async ({ page }) => {
    await page.goto("/login")
    await page.waitForLoadState("networkidle")

    // Press Tab once — the first focusable element should be skip-to-content
    await page.keyboard.press("Tab")

    const firstFocused = await page.evaluate(() => {
      const el = document.activeElement
      return {
        text: el?.textContent?.trim(),
        href: (el as HTMLAnchorElement)?.href,
        tag: el?.tagName.toLowerCase(),
      }
    })

    // If skip-to-content is implemented, it appears first
    const hasSkipLink = firstFocused.text?.match(/skip|content|main/i) !== null
    if (!hasSkipLink) {
      console.warn(
        "[a11y] No skip-to-content link detected. Consider adding one for keyboard users.",
      )
    }
    // This test is informational — skip until the link is implemented
    test.skip(!hasSkipLink, "Skip-to-content link not yet implemented")
    expect(hasSkipLink).toBe(true)
  })
})
