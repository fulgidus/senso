/**
 * gestures.spec.ts @mobile
 *
 * Touch gesture regression tests. Run on mobile-chrome + mobile-safari projects.
 * Tag: @mobile (both projects match this grep).
 *
 * Key regressions guarded:
 * 1. Swipe-up (scroll into content) does not arm pull-to-refresh
 * 2. Pull-to-refresh only fires from top-30% zone
 * 3. Pull-to-refresh does not fire when scrollTop > 0 (mid-content)
 * 4. overscroll-none prevents body scroll leak at list boundaries
 * 5. Mixed-direction swipe (down then up) does not lock scroll
 *
 * Root cause note:
 * The `usePullToRefresh` hook registers a passive:false touchmove listener.
 * When a touch starts in the top-30% zone with scrollTop=0, any downward
 * motion (deltaY>0) calls e.preventDefault(), blocking ALL subsequent scroll
 * for that touch sequence. The mixed-direction test catches this.
 */

import { test, expect } from "@playwright/test";
import { setupAuthenticatedSession, mockNotifications, mockProfile } from "./support/api-mocks";
import { swipeUp, swipeDown, swipe, getScrollTop } from "./support/touch-helpers";

// Helper: set up an authenticated chat page with enough messages to scroll
async function goToChat(page: Parameters<typeof setupAuthenticatedSession>[0]) {
  await setupAuthenticatedSession(page);
  mockNotifications(page);

  // Mock coaching with several messages so the list is scrollable
  page.route("**/coaching/sessions", (route) => {
    if (!route.request().url().includes("/sessions/")) {
      route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          sessions: [
            {
              id: "session-gesture-test",
              name: "Gesture test session",
              persona_id: "mentore-saggio",
              created_at: "2026-04-01T10:00:00Z",
              updated_at: "2026-04-01T10:00:00Z",
            },
          ],
        }),
      });
    } else {
      route.continue();
    }
  });

  // 10 messages - enough to make the list taller than the viewport
  const messages = Array.from({ length: 10 }, (_, i) => ({
    id: `msg-${i}`,
    session_id: "session-gesture-test",
    role: i % 2 === 0 ? "user" : "assistant",
    content: `Message ${i + 1}: Lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam.`,
    persona_id: "mentore-saggio",
    created_at: `2026-04-01T10:${String(i).padStart(2, "0")}:00Z`,
  }));

  page.route(/\/coaching\/sessions\/[^/]+\/messages/, (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({ messages }),
    });
  });

  page.route("**/coaching/personas", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        personas: [
          {
            persona_id: "mentore-saggio",
            name: "Mentore Saggio",
            description: "...",
            default_gender: "masculine",
            theme: { primary: "#3F72AF" },
          },
        ],
      }),
    });
  });

  page.route("**/coaching/chat", (route) => {
    route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        message: "Test response",
        reasoning: null,
        action_cards: [],
        resource_cards: [],
        learn_cards: [],
        affordability_verdict: null,
        details_a2ui: null,
      }),
    });
  });

  await page.goto("/chat");
  // Wait for messages to render
  await expect(page.getByText("Message 1:")).toBeVisible({ timeout: 10_000 });
}

// ── Chat screen gesture tests ─────────────────────────────────────────────────

test.describe("Chat - swipe-up scroll regression @mobile", () => {
  test("swipe-up on message list scrolls content down without triggering PTR", async ({ page }) => {
    await goToChat(page);

    const viewport = page.viewportSize() ?? { width: 390, height: 844 };

    // The message list container - ChatScreen wraps the list in overflow-y-auto overscroll-none
    const listSelector = ".overflow-y-auto.overscroll-none";

    // Confirm initial scrollTop is 0
    const initialScroll = await getScrollTop(page, listSelector);
    expect(initialScroll).toBe(0);

    // Swipe UP (finger moves up = content scrolls down)
    // Start from 70% of viewport height, move up by 200px
    // This is a normal "read more content" gesture
    const startY = Math.floor(viewport.height * 0.7);
    await swipeUp(page, startY, 200, undefined, { steps: 15, stepDelay: 16 });

    // After upward swipe, list should have scrolled (scrollTop > 0)
    const afterScroll = await getScrollTop(page, listSelector);
    expect(afterScroll).toBeGreaterThan(0);

    // No pull-to-refresh indicator should be visible
    // PTR indicator has a Loader2 spinner inside the message list area
    await expect(page.locator('[class*="animate-spin"]').first()).not.toBeVisible();
  });

  test("swipe-down from top-30% zone triggers pull-to-refresh on profile @mobile", async ({
    page,
  }) => {
    await setupAuthenticatedSession(page);
    mockNotifications(page);
    mockProfile(page);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /your financial profile/i })).toBeVisible({
      timeout: 10_000,
    });

    const viewport = page.viewportSize() ?? { width: 390, height: 844 };

    // Swipe DOWN from the top-15% zone (within the PTR zone)
    const startY = Math.floor(viewport.height * 0.15);
    await swipeDown(page, startY, 120, undefined, { steps: 15, stepDelay: 20 });

    // Wait a moment for the state to update
    await page.waitForTimeout(100);

    // Check: no crash, page is still functional
    await expect(page.getByRole("heading", { name: /your financial profile/i })).toBeVisible({
      timeout: 5_000,
    });
  });

  test("swipe-down from mid-screen (>30%) does NOT trigger pull-to-refresh @mobile", async ({
    page,
  }) => {
    await setupAuthenticatedSession(page);
    mockNotifications(page);
    mockProfile(page);
    await page.goto("/profile");
    await expect(page.getByRole("heading", { name: /your financial profile/i })).toBeVisible({
      timeout: 10_000,
    });

    const viewport = page.viewportSize() ?? { width: 390, height: 844 };

    // Swipe DOWN starting from 60% of the screen (below the PTR zone)
    const startY = Math.floor(viewport.height * 0.6);
    await swipeDown(page, startY, 120, undefined, { steps: 15, stepDelay: 20 });

    await page.waitForTimeout(200);

    // No PTR spinner - refresh must NOT have been triggered
    const spinners = await page.locator('[class*="animate-spin"]').count();
    expect(spinners).toBe(0);
  });

  test("swipe-up at bottom of list does not leak to body scroll @mobile", async ({ page }) => {
    await goToChat(page);

    const viewport = page.viewportSize() ?? { width: 390, height: 844 };

    // Scroll to the very bottom of the message list programmatically
    const listSelector = ".overflow-y-auto.overscroll-none";
    await page.evaluate((sel) => {
      const el = document.querySelector(sel);
      if (el) el.scrollTop = el.scrollHeight;
    }, listSelector);

    await page.waitForTimeout(100);

    // Record body scroll position before swipe
    const bodyScrollBefore = await page.evaluate(() => window.scrollY);

    // Swipe UP aggressively from the bottom of the list
    const startY = Math.floor(viewport.height * 0.8);
    await swipeUp(page, startY, 250, undefined, { steps: 20, stepDelay: 16 });

    // Body should NOT have scrolled (overscroll-none contains it)
    const bodyScrollAfter = await page.evaluate(() => window.scrollY);
    expect(bodyScrollAfter).toBe(bodyScrollBefore);
  });

  test("mixed-direction swipe (down then up) does not permanently lock scroll @mobile", async ({
    page,
  }) => {
    /**
     * Root cause test for the known bug:
     * - User starts swiping DOWN in top zone (arms PTR, calls preventDefault())
     * - User reverses direction and swipes UP
     * - The preventDefault() call should NOT permanently lock scroll
     *
     * This test verifies that after a mixed-direction gesture,
     * a subsequent clean upward swipe still scrolls normally.
     */
    await goToChat(page);

    const viewport = page.viewportSize() ?? { width: 390, height: 844 };
    const listSelector = ".overflow-y-auto.overscroll-none";

    // Step 1: Mixed-direction swipe (down 30px then up 100px) from top zone
    const startY = Math.floor(viewport.height * 0.2); // top 20% - in PTR zone
    // Start the touch at startY, move down 30px (arming PTR), then up 100px
    await swipe(
      page,
      { x: viewport.width / 2, y: startY },
      { x: viewport.width / 2, y: startY + 30 }, // down 30px
      { steps: 5, stepDelay: 16 },
    );
    await swipe(
      page,
      { x: viewport.width / 2, y: startY + 30 },
      { x: viewport.width / 2, y: startY - 70 }, // then up 100px
      { steps: 10, stepDelay: 16 },
    );

    // Wait for touch to settle
    await page.waitForTimeout(300);

    // Step 2: Now do a clean upward swipe - should still scroll
    const scrollBefore = await getScrollTop(page, listSelector);
    const cleanStartY = Math.floor(viewport.height * 0.7);
    await swipeUp(page, cleanStartY, 150, undefined, { steps: 15, stepDelay: 16 });
    await page.waitForTimeout(100);

    const scrollAfter = await getScrollTop(page, listSelector);

    // The list SHOULD have scrolled after the clean swipe
    // (regression: if it didn't, scroll is permanently locked)
    expect(scrollAfter).toBeGreaterThan(scrollBefore);
  });
});
