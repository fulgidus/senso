/**
 * api-mocks.ts - Reusable Playwright route interceptors for the FastAPI backend.
 *
 * Every mock function accepts a `Page` and registers `page.route()` handlers
 * that intercept real network calls to `http://localhost:8000/*`.
 *
 * Design decisions:
 *  - Responses are minimal but structurally correct (match what the real API returns).
 *  - Auth mocks inject localStorage tokens directly instead of going through
 *    the UI login form in every test (faster, more stable).
 *  - The coaching/chat mocks return enough data for the UI to render without
 *    crashing; heavy optional fields (reasoning, cards, etc.) are omitted.
 */

import type { Page, Route } from "@playwright/test"

// ── Shared fixtures ───────────────────────────────────────────────────────────

export const FAKE_USER = {
    id: "test-user-1",
    email: "e2e@senso.test",
    first_name: "E2E",
    last_name: "Tester",
    is_admin: true,
    role: "admin",
    voice_gender: "indifferent",
    voice_auto_listen: false,
    default_persona_id: "mentore-saggio",
    strict_privacy_mode: false,
}

export const FAKE_TOKENS = {
    accessToken: "fake-access-token-e2e",
    refreshToken: "fake-refresh-token-e2e",
    expiresIn: 900,
}

/**
 * Inject fake auth tokens into localStorage so the app thinks the user is
 * already logged in. Call this BEFORE navigating to any protected route.
 */
export async function injectAuthTokens(page: Page): Promise<void> {
    await page.addInitScript((tokens) => {
        localStorage.setItem("senso.auth.access_token", tokens.accessToken)
        localStorage.setItem("senso.auth.refresh_token", tokens.refreshToken)
    }, FAKE_TOKENS)
}

// ── Auth endpoints ────────────────────────────────────────────────────────────

/** Mock GET /auth/me - used by bootstrapSession on every page load */
export function mockAuthMe(page: Page): void {
    page.route("**/auth/me", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ user: FAKE_USER }),
        })
    })
}

/** Mock POST /auth/login */
export function mockAuthLogin(page: Page): void {
    page.route("**/auth/login", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ user: FAKE_USER, ...FAKE_TOKENS }),
        })
    })
}

/** Mock POST /auth/refresh */
export function mockAuthRefresh(page: Page): void {
    page.route("**/auth/refresh", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(FAKE_TOKENS),
        })
    })
}

// ── Coaching endpoints ────────────────────────────────────────────────────────

export const FAKE_PERSONA = {
    id: "mentore-saggio",
    name: "Wise Mentor",
    avatar_initials: "WM",
    avatar_bg_light: "#4f46e5",
    avatar_bg_dark: "#818cf8",
    voice_id: null,
    gender: "neutral",
}

export const FAKE_SESSION = {
    id: "session-abc-123",
    name: "E2E test session",
    persona_id: "mentore-saggio",
    created_at: "2026-04-01T10:00:00Z",
    updated_at: "2026-04-01T10:00:00Z",
}

export const FAKE_WELCOME_MESSAGE = {
    message: "Hello! I'm your financial coach. How can I help you today?",
    reasoning: null,
    action_cards: [],
    resource_cards: [],
    learn_cards: [],
    affordability: null,
    debug: null,
}

/** Mock GET /coaching/personas */
export function mockCoachingPersonas(page: Page): void {
    page.route("**/coaching/personas", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ personas: [FAKE_PERSONA] }),
        })
    })
}

/** Mock GET /coaching/sessions */
export function mockCoachingSessions(page: Page): void {
    page.route("**/coaching/sessions", (route: Route) => {
        const url = route.request().url()
        // sessions list
        if (!url.includes("/sessions/")) {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ sessions: [FAKE_SESSION] }),
            })
        } else {
            route.continue()
        }
    })
}

/** Mock GET /coaching/sessions/:id/messages */
export function mockSessionMessages(page: Page): void {
    page.route(/\/coaching\/sessions\/[^/]+\/messages/, (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ messages: [] }),
        })
    })
}

/** Mock GET /coaching/welcome */
export function mockCoachingWelcome(page: Page): void {
    page.route("**/coaching/welcome", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify(FAKE_WELCOME_MESSAGE),
        })
    })
}

/** Mock POST /coaching/sessions (create new session) */
export function mockCreateSession(page: Page): void {
    page.route((url) => url.pathname.includes("/coaching/sessions") && !url.pathname.includes("/messages"), (route: Route) => {
        if (route.request().method() === "POST") {
            route.fulfill({
                status: 201,
                contentType: "application/json",
                body: JSON.stringify({ session: FAKE_SESSION }),
            })
        } else {
            route.continue()
        }
    })
}

/** Register all coaching mocks at once */
export function mockAllCoaching(page: Page): void {
    mockCoachingPersonas(page)
    mockCoachingSessions(page)
    mockSessionMessages(page)
    mockCoachingWelcome(page)
    mockCreateSession(page)
}

// ── Profile endpoints ─────────────────────────────────────────────────────────

export const FAKE_PROFILE = {
    has_profile: true,
    status: "ready",
    income_summary: { amount: 3000, currency: "EUR", source: "payslip" },
    monthly_expenses: 1800,
    spending_breakdown: [
        { category: "housing", amount: 900, percentage: 50 },
        { category: "groceries", amount: 450, percentage: 25 },
        { category: "transport", amount: 270, percentage: 15 },
        { category: "subscriptions", amount: 180, percentage: 10 },
    ],
    income_vs_expenses_chart: [
        { month: "2026-03", income: 3000, expenses: 1800 },
    ],
    insights: ["You spend 50% of income on housing, above average."],
    stale: false,
    last_updated: "2026-04-01T10:00:00Z",
    raw_sources: ["payslip"],
}

/** Mock GET /profile */
export function mockProfile(page: Page): void {
    page.route("**/profile", (route: Route) => {
        if (route.request().method() === "GET") {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(FAKE_PROFILE),
            })
        } else {
            route.continue()
        }
    })
}

// ── Admin content endpoints ───────────────────────────────────────────────────

/** Generate `count` fake content items */
export function makeFakeContentItems(count: number) {
    return Array.from({ length: count }, (_, i) => ({
        id: `item-${i + 1}`,
        slug: `test-article-${i + 1}`,
        locale: i % 2 === 0 ? "en" : "it",
        type: "article",
        title: `Test Article ${i + 1}`,
        summary: `Summary for article ${i + 1}`,
        body: `Body of article ${i + 1}`,
        topics: ["finance", "budgeting"],
        metadata: {},
        is_published: i % 3 !== 0,
        localization_group: null,
        reading_time_minutes: 5,
        duration_seconds: null,
        created_at: "2026-03-01T00:00:00Z",
        updated_at: "2026-04-01T00:00:00Z",
    }))
}

/** Mock GET /admin/content/items - returns a configurable number of items */
export function mockAdminContent(page: Page, count = 30): void {
    const items = makeFakeContentItems(count)
    // Intercept the items list endpoint - must be more specific than /admin/content*
    // to avoid swallowing slug-exists, linkable-items, siblings, etc.
    page.route(/\/admin\/content\/items(?:\?|$)/, (route: Route) => {
        if (route.request().method() === "GET") {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ items, total: items.length, page: 1, page_size: 100, total_pages: 1 }),
            })
        } else {
            route.continue()
        }
    })
}

/**
 * Mock all secondary admin/content endpoints so they don't 404:
 * slug-exists, linkable-items, siblings, bulk-publish, bulk-delete.
 */
export function mockAdminContentExtras(page: Page): void {
    // Slug exists check
    page.route(/\/admin\/content\/slug-exists\//, (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ exists: false }),
        })
    })
    // Linkable items search
    page.route(/\/admin\/content\/linkable-items/, (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
        })
    })
    // Siblings
    page.route(/\/admin\/content\/items\/[^/]+\/siblings/, (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
        })
    })
    // Single item CUD (PUT / DELETE on /admin/content/items/:id)
    page.route(/\/admin\/content\/items\/[^/]+$/, (route: Route) => {
        const method = route.request().method()
        if (method === "PUT" || method === "PATCH") {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify(makeFakeContentItems(1)[0]),
            })
        } else if (method === "DELETE") {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({ deleted: true }),
            })
        } else {
            route.continue()
        }
    })
    // Bulk endpoints
    page.route(/\/admin\/content\/bulk-/, (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ updated: 0, groups_affected: 0, deleted: false }),
        })
    })
}

// ── Notification / misc endpoints ─────────────────────────────────────────────

/** Mock GET /notifications/* - return empty list to prevent unhandled 404s */
export function mockNotifications(page: Page): void {
    page.route("**/notifications**", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ notifications: [], total: 0 }),
        })
    })
}

/**
 * Register ALL common mocks (auth + coaching + profile + notifications).
 * Individual tests may override specific routes before calling this helper,
 * since Playwright matches the first registered route that fits the request.
 */
export async function setupAuthenticatedSession(page: Page): Promise<void> {
    await injectAuthTokens(page)
    mockAuthMe(page)
    mockAuthRefresh(page)
    mockNotifications(page)
}

/**
 * Like setupAuthenticatedSession but injects an admin-flagged user.
 * Use this before navigating to /admin/* routes.
 */
export async function setupAdminSession(page: Page): Promise<void> {
    await page.addInitScript((tokens) => {
        localStorage.setItem("senso.auth.access_token", tokens.accessToken)
        localStorage.setItem("senso.auth.refresh_token", tokens.refreshToken)
    }, FAKE_TOKENS)

    // Admin user mock - is_admin: true
    page.route("**/auth/me", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ user: { ...FAKE_USER, is_admin: true } }),
        })
    })
    mockAuthRefresh(page)
    mockNotifications(page)
}

// ── Messages endpoints ────────────────────────────────────────────────────────

/** Mock POST /messages/poll - returns empty inbox (no pending messages) */
export function mockMessages(page: Page): void {
    page.route("**/messages/poll", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify([]),
        })
    })
    // Also mock the public keys endpoint to avoid 404s
    page.route(/\/messages\/users\/.*\/public-keys/, (route: Route) => {
        route.fulfill({ status: 404, body: JSON.stringify({ detail: "Not found" }) })
    })
}

// ── Multi-persona mocks ───────────────────────────────────────────────────────

const FAKE_PERSONAS = [
    {
        persona_id: "mentore-saggio",
        name: "Mentore Saggio",
        description: "Wise financial mentor",
        default_gender: "masculine",
        theme: { primary: "#3F72AF" },
    },
    {
        persona_id: "amico-pratico",
        name: "Amico Pratico",
        description: "Practical friend",
        default_gender: "neutral",
        theme: { primary: "#27AE60" },
    },
    {
        persona_id: "esperto-tecnico",
        name: "Esperto Tecnico",
        description: "Technical expert",
        default_gender: "masculine",
        theme: { primary: "#8E44AD" },
    },
]

/**
 * Mock GET /coaching/personas with multiple coaches.
 * count: how many to return (default: all 3)
 */
export function mockMultiPersonas(page: Page, count = 3): void {
    page.route("**/coaching/personas", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ personas: FAKE_PERSONAS.slice(0, count) }),
        })
    })
}

/**
 * Mock the full coach-switch flow:
 *   PATCH /auth/me (save defaultPersonaId)
 *   POST /coaching/sessions (create new session with new coach)
 *   GET /coaching/sessions/:id/messages (empty new session)
 */
export function mockCoachSwitch(page: Page, newPersonaId: string): void {
    // Save persona preference
    page.route("**/auth/me", (route: Route) => {
        if (route.request().method() === "PATCH") {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    user: { ...FAKE_USER, default_persona_id: newPersonaId },
                }),
            })
        } else {
            route.continue()
        }
    })
    // New session after switch
    page.route("**/coaching/sessions", (route: Route) => {
        if (route.request().method() === "POST") {
            route.fulfill({
                status: 200,
                contentType: "application/json",
                body: JSON.stringify({
                    ...FAKE_SESSION,
                    id: "session-new-coach-456",
                    persona_id: newPersonaId,
                }),
            })
        } else {
            route.continue()
        }
    })
}

// ── Voice endpoint mocks ──────────────────────────────────────────────────────

/**
 * Mock POST /coaching/stt — returns a fake transcript JSON response.
 * Simulates successful server-side STT transcription without a real microphone.
 *
 * @param page - Playwright Page
 * @param transcript - The transcript text to return (default: Italian test phrase)
 */
export function mockCoachingSTT(
    page: Page,
    transcript = "Quanto posso spendere in affitto questo mese?"
): void {
    page.route("**/coaching/stt", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "application/json",
            body: JSON.stringify({ text: transcript }),
        })
    })
}

/**
 * Mock POST /coaching/tts — returns fake audio bytes with audio/mpeg content type.
 * Simulates successful TTS audio generation without a real ElevenLabs key.
 *
 * Pass a real audio buffer for tests that validate Audio element playback;
 * omit for tests that only check UI state changes.
 *
 * @param page - Playwright Page
 * @param audioBuffer - Optional real audio bytes; defaults to minimal fake MP3 bytes
 */
export function mockCoachingTTS(page: Page, audioBuffer?: Buffer): void {
    // Minimal ID3v2 header so the Audio element doesn't reject the blob outright
    const fakeAudio = audioBuffer ?? Buffer.from("ID3\x03\x00\x00\x00\x00\x00\x00")
    page.route("**/coaching/tts", (route: Route) => {
        route.fulfill({
            status: 200,
            contentType: "audio/mpeg",
            body: fakeAudio,
        })
    })
}
