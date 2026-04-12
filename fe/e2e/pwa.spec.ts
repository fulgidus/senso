/**
 * pwa.spec.ts
 *
 * PWA / installability checks.
 * Tests that the manifest has required fields and the app is offline-capable.
 *
 * Note: The app currently has NO service worker (vite-plugin-pwa not installed).
 * Tests that SHOULD fail are marked with test.fail() so CI stays green.
 */

import { test, expect } from "@playwright/test";

test.describe("PWA - Web App Manifest", () => {
  test("manifest.webmanifest exists and is valid JSON", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");
    expect(response?.status()).toBe(200);

    const body = await response?.text();
    expect(() => JSON.parse(body ?? "{}")).not.toThrow();
  });

  test("manifest has required installability fields", async ({ page }) => {
    const response = await page.goto("/manifest.webmanifest");
    const manifest = JSON.parse((await response?.text()) ?? "{}");

    // Required by Chrome for install prompt
    expect(manifest.name).toBeTruthy();
    expect(manifest.short_name).toBeTruthy();
    expect(manifest.start_url).toBeTruthy();
    expect(manifest.display).toBe("standalone");

    // Icons
    expect(Array.isArray(manifest.icons)).toBe(true);
    expect(manifest.icons.length).toBeGreaterThan(0);

    const icon = manifest.icons[0];
    expect(icon.src).toBeTruthy();
    expect(icon.sizes).toBeTruthy();
  });

  test("HTML head links to the manifest", async ({ page }) => {
    await page.goto("/");
    const manifestLink = page.locator('link[rel="manifest"]');
    await expect(manifestLink).toBeAttached();
    const href = await manifestLink.getAttribute("href");
    expect(href).toMatch(/manifest/);
  });

  test("theme-color meta tag is set", async ({ page }) => {
    await page.goto("/");
    const themeColor = page.locator('meta[name="theme-color"]');
    await expect(themeColor).toBeAttached();
    const content = await themeColor.getAttribute("content");
    expect(content).toBeTruthy();
  });
});

test.describe("PWA - Service Worker", () => {
  test("service worker is registered", async ({ page }) => {
    // Known gap: no SW registered yet - fails until vite-plugin-pwa is added
    test.fail(true, "No SW registered yet - fails until vite-plugin-pwa is added (known gap)");

    await page.goto("/");
    await page.waitForLoadState("networkidle");

    const swRegistered = await page.evaluate(async () => {
      if (!("serviceWorker" in navigator)) return false;
      const regs = await navigator.serviceWorker.getRegistrations();
      return regs.length > 0;
    });
    expect(swRegistered).toBe(true);
  });
});

test.describe("PWA - Offline", () => {
  test("app shell loads when offline", async ({ page, context }) => {
    // Known gap: no offline caching yet - fails until SW with precache is added
    test.fail(true, "No offline caching yet - fails until SW with precache is added (known gap)");

    // Load the page while online first (to populate any cache)
    await page.goto("/");
    await page.waitForLoadState("networkidle");

    // Go offline
    await context.setOffline(true);

    // Reload - cached shell should serve from SW cache
    const response = await page.reload();
    expect(response?.status()).toBeLessThan(400);

    // The app should still render something (not a browser offline page)
    const title = await page.title();
    expect(title).toMatch(/senso/i);

    await context.setOffline(false);
  });
});
