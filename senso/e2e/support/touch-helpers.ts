/**
 * touch-helpers.ts - Touch gesture simulation utilities for Playwright.
 *
 * Playwright's touchscreen API dispatches PointerEvents + TouchEvents that
 * the browser (Chromium) processes identically to real touch input.
 *
 * All coordinates are in CSS pixels relative to the viewport.
 */
import type { Page } from "@playwright/test"

export interface SwipeOptions {
    /** Number of intermediate move steps (higher = smoother, default 10) */
    steps?: number
    /** Delay in ms between each step (default 16 ≈ 60fps) */
    stepDelay?: number
}

/**
 * Simulate a touch swipe from (x1,y1) to (x2,y2).
 *
 * Uses page.touchscreen.move() which synthesises real PointerEvents.
 * The browser's scroll and gesture handlers respond identically to real touch.
 */
export async function swipe(
    page: Page,
    from: { x: number; y: number },
    to: { x: number; y: number },
    opts: SwipeOptions = {},
): Promise<void> {
    const { steps = 10, stepDelay = 16 } = opts
    await page.touchscreen.tap(from.x, from.y)
    for (let i = 1; i <= steps; i++) {
        const t = i / steps
        const x = from.x + (to.x - from.x) * t
        const y = from.y + (to.y - from.y) * t
        await page.touchscreen.move(x, y)
        if (stepDelay > 0) await page.waitForTimeout(stepDelay)
    }
}

/**
 * Swipe DOWN (finger moves down = content scrolls up = pull-to-refresh direction).
 * startY is where the finger starts; distance is how far it moves down.
 */
export async function swipeDown(
    page: Page,
    startY: number,
    distance: number,
    centerX?: number,
    opts?: SwipeOptions,
): Promise<void> {
    const viewport = page.viewportSize() ?? { width: 390, height: 844 }
    const x = centerX ?? viewport.width / 2
    await swipe(page, { x, y: startY }, { x, y: startY + distance }, opts)
}

/**
 * Swipe UP (finger moves up = content scrolls down).
 * This is the "scroll down into content" gesture.
 * startY is where the finger starts; distance is how far it moves up.
 */
export async function swipeUp(
    page: Page,
    startY: number,
    distance: number,
    centerX?: number,
    opts?: SwipeOptions,
): Promise<void> {
    const viewport = page.viewportSize() ?? { width: 390, height: 844 }
    const x = centerX ?? viewport.width / 2
    await swipe(page, { x, y: startY }, { x, y: startY - distance }, opts)
}

/**
 * Get the scrollTop of a CSS selector within the page.
 * Returns 0 if element not found.
 */
export async function getScrollTop(page: Page, selector: string): Promise<number> {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel)
        return el ? el.scrollTop : 0
    }, selector)
}

/**
 * Check if an element has a horizontal scrollbar (scrollWidth > clientWidth).
 */
export async function hasHorizontalScroll(
    page: Page,
    selector: string,
): Promise<boolean> {
    return page.evaluate((sel) => {
        const el = document.querySelector(sel)
        if (!el) return false
        return el.scrollWidth > el.clientWidth + 1 // +1 for rounding
    }, selector)
}

/**
 * Get the bounding box height + top padding of an element.
 * Used for tap target size checks.
 */
export async function getTapTargetSize(
    page: Page,
    selector: string,
): Promise<{ width: number; height: number } | null> {
    const box = await page.locator(selector).first().boundingBox()
    if (!box) return null
    return { width: box.width, height: box.height }
}
