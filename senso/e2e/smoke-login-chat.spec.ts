/**
 * smoke-login-chat.spec.ts
 *
 * Smoke test #1 — Login → coaching chat → voice-toggle visible.
 *
 * Scenario:
 *  1. User arrives at /login.
 *  2. Fills email + password and clicks "Log in".
 *  3. After successful auth, is redirected to the chat screen.
 *  4. The voice-mode toggle button (Mic icon) is visible in the toolbar.
 *
 * All backend calls are mocked via Playwright route interception so the test
 * runs without a live FastAPI instance.
 */

import { test, expect } from "@playwright/test"
import {
  mockAuthLogin,
  mockAuthMe,
  mockAuthRefresh,
  mockAllCoaching,
  mockNotifications,
} from "./support/api-mocks"

test.describe("Smoke — Login → Chat → Voice toggle", () => {
  test.beforeEach(async ({ page }) => {
    // Register mocks BEFORE any navigation so route handlers are active
    mockAuthMe(page)
    mockAuthLogin(page)
    mockAuthRefresh(page)
    mockAllCoaching(page)
    mockNotifications(page)
  })

  test("user can log in and sees voice-mode button in chat", async ({ page }) => {
    // ── Step 1: navigate to /login ───────────────────────────────────────────
    await page.goto("/login")

    // The login form should be visible
    await expect(page.getByRole("heading", { name: "Welcome back" })).toBeVisible()

    // ── Step 2: fill credentials ─────────────────────────────────────────────
    await page.getByLabel("Email").fill("e2e@senso.test")
    await page.getByLabel("Password").fill("password123")

    // ── Step 3: submit and wait for redirect to chat ──────────────────────────
    await page.getByRole("button", { name: "Log in" }).click()

    // After login the router should navigate away from /login.
    // The RootResolver will land on /chat (the default for an authenticated user).
    await page.waitForURL(/\/(chat|$)/, { timeout: 10_000 })

    // ── Step 4: voice toggle is present ──────────────────────────────────────
    // The button is rendered by ChatScreen when voice mode is available.
    // It carries aria-label="Voice mode" (coaching.voiceModeActivate key).
    const voiceBtn = page.getByRole("button", { name: "Voice mode" })
    await expect(voiceBtn).toBeVisible({ timeout: 8_000 })
  })

  test("already-authenticated user is redirected to chat automatically", async ({ page }) => {
    // Inject tokens before page load so bootstrapSession() succeeds immediately
    await page.addInitScript((tokens) => {
      localStorage.setItem("senso.auth.access_token", tokens.access)
      localStorage.setItem("senso.auth.refresh_token", tokens.refresh)
    }, { access: "fake-access-token-e2e", refresh: "fake-refresh-token-e2e" })

    await page.goto("/login")

    // Should be redirected away from /login
    await page.waitForURL(/\/(chat|$)/, { timeout: 10_000 })
    await expect(page).not.toHaveURL(/\/login/)
  })

  test("invalid credentials shows error message", async ({ page }) => {
    // Override the login mock to return 401 for this test
    page.route("**/auth/login", (route) => {
      route.fulfill({
        status: 401,
        contentType: "application/json",
        body: JSON.stringify({ detail: "Invalid credentials" }),
      })
    })

    await page.goto("/login")

    await page.getByLabel("Email").fill("wrong@senso.test")
    await page.getByLabel("Password").fill("wrongpassword")
    await page.getByRole("button", { name: "Log in" }).click()

    // Error message should appear within the form
    await expect(
      page.getByText(/wrong email or password/i)
    ).toBeVisible({ timeout: 6_000 })

    // URL should NOT have changed away from /login
    expect(page.url()).toContain("/login")
  })
})
