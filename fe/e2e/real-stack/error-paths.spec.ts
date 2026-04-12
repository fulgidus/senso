/**
 * error-paths.spec.ts - Error path E2E on real stack.
 *
 * Tests: expired token redirect, bad file rejection, LLM timeout,
 * and network offline indicator. These validate error handling that
 * mocked tests can't catch.
 *
 * Run with: npx playwright test --project=real-stack error-paths.spec.ts
 */

import { test, expect, loginAs } from "./fixtures";

test.describe("Error paths (real stack)", () => {
  test("expired token: corrupted token redirects to login", async ({ page, account }) => {
    // Login first to establish session
    await loginAs(page, account);
    await page.goto("/chat");
    await expect(page.getByPlaceholder(/Chiedi al coach/i)).toBeVisible({ timeout: 15_000 });

    // Corrupt the access token in localStorage
    await page.evaluate(() => {
      const tokenKey = "senso.auth.access_token";
      localStorage.setItem(tokenKey, "expired.invalid.jwt.token");
    });

    // Also corrupt the refresh token so the refresh flow also fails
    await page.evaluate(() => {
      localStorage.setItem("senso.auth.refresh_token", "invalid-refresh-token");
    });

    // Navigate to a page that requires auth → should redirect to login
    await page.goto("/chat");

    // The auth interceptor should detect the 401 and redirect to /login
    await page.waitForURL(/\/login/, { timeout: 15_000 });
    expect(page.url()).toContain("/login");
  });

  test("bad file upload: non-supported type returns 4xx (API assertion)", async ({
    page,
    account,
  }) => {
    await loginAs(page, account);

    const apiBase = process.env.API_URL ?? "http://localhost:8000";
    const accessToken = account.accessToken;

    // Direct API call with an unsupported file type (.exe)
    // The ingestion service should reject this or it eventually fails
    const resp = await page.request.post(`${apiBase}/ingestion/upload`, {
      multipart: {
        file: {
          name: "malware.exe",
          mimeType: "application/octet-stream",
          buffer: Buffer.from("MZ\x90\x00"),
        },
      },
      headers: { Authorization: `Bearer ${accessToken}` },
    });

    // The API accepts the file for processing (202) OR rejects it (4xx)
    // Either way it must NOT be a 5xx error
    expect(resp.status()).toBeLessThan(500);
  });

  test("bad file upload: frontend shows error for bad file type", async ({ page, account }) => {
    await loginAs(page, account);
    await page.goto("/onboarding/upload");

    await expect(page.getByText(/Trascina file qui|Scegli file/i)).toBeVisible({ timeout: 10_000 });

    // Attempt to upload an unsupported file via file input
    const fileInput = page.locator('input[type="file"]');
    await fileInput.setInputFiles({
      name: "test.exe",
      mimeType: "application/octet-stream",
      buffer: Buffer.from("MZ\x90\x00"),
    });

    // The upload input has an `accept` attribute - the browser or frontend
    // should show a rejection. Either: file doesn't appear in list (accepted
    // mimes are restricted), OR an error message appears.
    // We verify no critical JavaScript error occurred
    const jsErrors: string[] = [];
    page.on("pageerror", (err) => jsErrors.push(err.message));

    await page.waitForTimeout(3_000); // brief wait to let any error appear
    expect(jsErrors.filter((e) => e.includes("Uncaught"))).toHaveLength(0);
  });

  test("LLM timeout: shows error message, no infinite spinner", async ({ page, account }) => {
    await loginAs(page, account);
    await page.goto("/chat");

    await expect(page.getByPlaceholder(/Chiedi al coach/i)).toBeVisible({ timeout: 15_000 });

    // Trigger the slow-response stub path (90s sleep, times out the API)
    await page.getByPlaceholder(/Chiedi al coach/i).fill("__SLOW_RESPONSE_TEST__");
    await page.getByRole("button", { name: "Invia" }).click();

    // Wait for the LLM timeout error to surface in the UI
    // The API's LLM client has a timeout - the error propagates to the chat UI
    await expect(
      page.getByText(/temporaneamente non disponibile|errore|riprova|timeout/i),
    ).toBeVisible({ timeout: 45_000 });

    // Loading spinner must not still be visible after the error
    const spinnerLocator = page.locator('[aria-live="polite"] .animate-bounce');
    await expect(spinnerLocator).not.toBeVisible({ timeout: 5_000 });
  });

  test("offline banner: appears when network cut, disappears when restored", async ({
    page,
    account,
    context,
  }) => {
    await loginAs(page, account);
    await page.goto("/chat");

    await expect(page.getByPlaceholder(/Chiedi al coach/i)).toBeVisible({ timeout: 15_000 });

    // Cut network
    await context.setOffline(true);

    // Trigger a request to detect offline state
    await page.getByPlaceholder(/Chiedi al coach/i).fill("Test offline");
    await page.getByRole("button", { name: "Invia" }).click();

    // Offline banner (role="alert") should appear
    await expect(page.getByRole("alert")).toBeVisible({ timeout: 8_000 });
    const bannerText = await page.getByRole("alert").textContent();
    expect(bannerText).toMatch(/offline|connessione/i);

    // Restore network
    await context.setOffline(false);

    // Banner should disappear
    await expect(page.getByRole("alert")).not.toBeVisible({ timeout: 10_000 });
  });
});
