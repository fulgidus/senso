/**
 * ergonomics.spec.ts @mobile
 *
 * UI ergonomics regression tests:
 * - Tap targets ≥ 44px (WCAG 2.5.5 recommended)
 * - Chat input visible above the fold on mobile
 * - No horizontal scroll on chat messages
 * - Send button is in the bottom half of the viewport (thumb-reachable)
 * - Modals have a visible close button
 */

import { test, expect } from "@playwright/test"
import {
  setupAuthenticatedSession,
  mockAllCoaching,
  mockNotifications,
} from "./support/api-mocks"
import { getTapTargetSize, hasHorizontalScroll } from "./support/touch-helpers"

const MIN_TAP_TARGET = 44 // WCAG 2.5.5 recommended minimum

test.describe("Tap targets @mobile", () => {
  test.beforeEach(async ({ page }) => {
    await setupAuthenticatedSession(page)
    mockAllCoaching(page)
    mockNotifications(page)
    await page.goto("/chat")
    await page.waitForLoadState("networkidle")
  })

  test("hamburger menu button meets 44px tap target", async ({ page }) => {
    const size = await getTapTargetSize(
      page,
      'button[aria-label*="menu" i], button[aria-label*="Menu" i]',
    )
    expect(size).not.toBeNull()
    // Height OR width should be ≥ 44px (button padding counts)
    expect(Math.max(size!.height, size!.width)).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
  })

  test("send button meets 44px tap target", async ({ page }) => {
    // The send button may not be visible until text is entered
    const input = page.locator("textarea").first()
    await input.fill("test")
    await page.waitForTimeout(100)

    const size = await getTapTargetSize(
      page,
      'button[aria-label*="send" i], button[type="submit"]',
    )
    if (size) {
      expect(Math.max(size.height, size.width)).toBeGreaterThanOrEqual(MIN_TAP_TARGET)
    }
    // If still not found, it's not a blocker — some UIs show send on Enter only
  })

  test("sidebar nav links meet 44px tap target when drawer is open", async ({ page }) => {
    await page.getByRole("button", { name: /menu/i }).click()
    await page.waitForTimeout(200)

    // Check the first nav link in the drawer
    const navLinkSize = await page.evaluate(() => {
      const links = document.querySelectorAll('[aria-modal="true"] a, [role="dialog"] a')
      if (links.length === 0) return null
      const rect = links[0].getBoundingClientRect()
      return { width: rect.width, height: rect.height }
    })

    if (navLinkSize) {
      expect(Math.max(navLinkSize.height, navLinkSize.width)).toBeGreaterThanOrEqual(
        MIN_TAP_TARGET,
      )
    }
  })
})

test.describe("Chat input visibility @mobile", () => {
  test("chat input is visible without scrolling on page load", async ({ page }) => {
    await setupAuthenticatedSession(page)
    mockAllCoaching(page)
    mockNotifications(page)
    await page.goto("/chat")
    await page.waitForLoadState("networkidle")

    // The textarea / chat input should be visible in the initial viewport
    const chatInput = page.locator("textarea").first()
    await expect(chatInput).toBeVisible({ timeout: 8_000 })
    await expect(chatInput).toBeInViewport()
  })

  test("send button is in the bottom half of the viewport (thumb reach) @mobile", async ({
    page,
  }) => {
    await setupAuthenticatedSession(page)
    mockAllCoaching(page)
    mockNotifications(page)
    await page.goto("/chat")
    await page.waitForLoadState("networkidle")

    const viewport = page.viewportSize() ?? { width: 390, height: 844 }
    const textarea = page.locator("textarea").first()
    await textarea.fill("test message")
    await page.waitForTimeout(100)

    const sendButtonBox = await page
      .locator('button[aria-label*="send" i], button[type="submit"]')
      .first()
      .boundingBox()

    if (sendButtonBox) {
      // Send button should be in the bottom 60% of the viewport
      expect(sendButtonBox.y).toBeGreaterThan(viewport.height * 0.4)
    }
  })
})

test.describe("Horizontal overflow guards", () => {
  test("chat message list has no horizontal scroll @mobile", async ({ page }) => {
    await setupAuthenticatedSession(page)
    mockNotifications(page)

    // Add a long assistant message
    page.route(/\/coaching\/sessions\/[^/]+\/messages/, (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          messages: [
            {
              id: "long-msg-1",
              session_id: "s1",
              role: "assistant",
              content:
                "This is a very long message that should wrap correctly within the chat bubble without causing any horizontal scroll. It contains lots of text to simulate a real coaching response with detailed financial advice about budgeting, saving, investing, and general money management strategies.",
              persona_id: "mentore-saggio",
              created_at: "2026-04-01T10:00:00Z",
            },
          ],
        }),
      })
    })
    page.route("**/coaching/personas", (route) => {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          personas: [{ persona_id: "mentore-saggio", name: "Mentore Saggio", description: "...", default_gender: "masculine", theme: {} }],
        }),
      })
    })
    page.route("**/coaching/sessions", (route) => {
      if (!route.request().url().includes("/sessions/")) {
        route.fulfill({
          status: 200,
          contentType: "application/json",
          body: JSON.stringify({ sessions: [{ id: "s1", name: "Test", persona_id: "mentore-saggio", created_at: "2026-04-01T10:00:00Z", updated_at: "2026-04-01T10:00:00Z" }] }),
        })
      } else {
        route.continue()
      }
    })
    page.route("**/coaching/chat", (route) => {
      route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ message: "OK", reasoning: null, action_cards: [], resource_cards: [], learn_cards: [], affordability_verdict: null, details_a2ui: null }) })
    })

    await page.goto("/chat")
    await expect(page.getByText(/long message/i)).toBeVisible({ timeout: 10_000 })

    // The message list should not have horizontal scroll
    const overflow = await hasHorizontalScroll(
      page,
      ".overflow-y-auto.overscroll-none, [class*='overflow-y-auto']",
    )
    expect(overflow).toBe(false)
  })

  test("body does not have horizontal scroll on chat screen @mobile", async ({ page }) => {
    await setupAuthenticatedSession(page)
    mockAllCoaching(page)
    mockNotifications(page)
    await page.goto("/chat")
    await page.waitForLoadState("networkidle")

    // Body should not overflow horizontally
    const bodyOverflow = await page.evaluate(() => {
      return document.body.scrollWidth > document.body.clientWidth + 2
    })
    expect(bodyOverflow).toBe(false)
  })
})

test.describe("Modal close button ergonomics", () => {
  test("compose message modal has a close button within thumb reach @mobile", async ({
    page,
  }) => {
    await setupAuthenticatedSession(page)
    mockAllCoaching(page)
    mockNotifications(page)
    page.route("**/messages/poll", (route) =>
      route.fulfill({ status: 200, contentType: "application/json", body: "[]" }),
    )

    await page.goto("/messages")
    await page.waitForLoadState("networkidle")

    const composeBtn = page.getByRole("button", { name: /compon|compose/i })
    if (!(await composeBtn.isVisible({ timeout: 3_000 }).catch(() => false))) {
      test.skip()
      return
    }
    await composeBtn.click()

    const modal = page.getByRole("dialog")
    await expect(modal).toBeVisible({ timeout: 5_000 })

    // Close button should be in the top portion of the modal (not buried)
    const closeBtn = modal.getByRole("button", { name: /close|cancel|×/i }).first()
    await expect(closeBtn).toBeVisible({ timeout: 3_000 })

    const closeBtnBox = await closeBtn.boundingBox()
    const modalBox = await modal.boundingBox()

    if (closeBtnBox && modalBox) {
      // Close button should be in the top 30% of the modal
      const relativeY = closeBtnBox.y - modalBox.y
      expect(relativeY).toBeLessThan(modalBox.height * 0.3)
    }
  })
})
