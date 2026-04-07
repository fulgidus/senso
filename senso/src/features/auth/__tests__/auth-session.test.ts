import { beforeEach, describe, expect, it, vi } from "vite-plus/test";

vi.mock("@/lib/config", () => ({
    getBackendBaseUrl: () => "http://localhost:8000",
}));

import {
    bootstrapSession,
    makeOnUnauthorized,
    startGoogle,
    updateMe,
} from "@/features/auth/session";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { readAccessToken, readRefreshToken } from "@/features/auth/storage";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Build a minimal fetch Response with a JSON body. */
function jsonResponse(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), {
        status,
        headers: { "content-type": "application/json" },
    });
}

/** Build a 204 No-Content response (no body). */
function noContentResponse(): Response {
    return new Response(null, { status: 204 });
}

// ---------------------------------------------------------------------------
// Suite: apiRequest - 401 auto-refresh logic (api-client.ts:44-51)
// ---------------------------------------------------------------------------

describe("apiRequest - 401 auto-refresh logic", () => {
    beforeEach(() => {
        vi.restoreAllMocks();
    });

    // ── 1. Happy path ─────────────────────────────────────────────────────────
    it("returns parsed JSON on a 200 response without invoking onUnauthorized", async () => {
        const onUnauthorized = vi.fn<() => Promise<string | null>>();
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ hello: "world" }));

        const result = await apiRequest<{ hello: string }>("http://localhost:8000", "/api/data", {
            token: "good-token",
            onUnauthorized,
        });

        expect(result).toEqual({ hello: "world" });
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    // ── 2. Core scenario: 401 → refresh → retry succeeds ──────────────────────
    it("on 401, calls onUnauthorized, then retries the original request with the new token", async () => {
        const onUnauthorized = vi.fn<() => Promise<string | null>>().mockResolvedValue("new-token-xyz");
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            // First call: 401 with expired token
            .mockResolvedValueOnce(jsonResponse({ detail: "token expired" }, 401))
            // Second call: successful retry with new token
            .mockResolvedValueOnce(jsonResponse({ id: "u1", value: 42 }));

        const result = await apiRequest<{ id: string; value: number }>(
            "http://localhost:8000",
            "/api/protected",
            { token: "expired-token", onUnauthorized },
        );

        // onUnauthorized was invoked exactly once to obtain a fresh token
        expect(onUnauthorized).toHaveBeenCalledTimes(1);
        // fetch was called exactly twice: original + retry
        expect(fetchMock).toHaveBeenCalledTimes(2);
        // The retry must use the NEW token in the Authorization header
        expect(fetchMock).toHaveBeenNthCalledWith(
            2,
            "http://localhost:8000/api/protected",
            expect.objectContaining({
                headers: expect.objectContaining({
                    authorization: "Bearer new-token-xyz",
                }),
            }),
        );
        // Final result comes from the successful retry
        expect(result).toEqual({ id: "u1", value: 42 });
    });

    // ── 3. 401 + onUnauthorized returns null → throw, do NOT retry ────────────
    it("on 401 where onUnauthorized returns null, throws ApiClientError without a second fetch call", async () => {
        const onUnauthorized = vi.fn<() => Promise<string | null>>().mockResolvedValue(null);
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(jsonResponse({ detail: "unauthorized" }, 401));

        await expect(
            apiRequest("http://localhost:8000", "/api/protected", { token: "bad-token", onUnauthorized }),
        ).rejects.toMatchObject({
            status: 401,
            message: "Request failed",
        });

        expect(onUnauthorized).toHaveBeenCalledTimes(1);
        // No retry: fetch called only once
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    // ── 4. 401 with no onUnauthorized callback → throw immediately ────────────
    it("on 401 without an onUnauthorized callback, throws ApiClientError immediately", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            jsonResponse({ detail: "unauthorized" }, 401),
        );

        await expect(
            apiRequest("http://localhost:8000", "/api/protected", { token: "bad-token" }),
        ).rejects.toMatchObject({ status: 401 });
    });

    // ── 5. Infinite-loop guard: _isRetry=true suppresses the second refresh ───
    it("does NOT call onUnauthorized a second time when _isRetry is already true", async () => {
        const onUnauthorized = vi.fn<() => Promise<string | null>>().mockResolvedValue("another-token");
        vi.spyOn(globalThis, "fetch").mockResolvedValue(jsonResponse({ detail: "still 401" }, 401));

        await expect(
            apiRequest("http://localhost:8000", "/api/protected", {
                token: "some-token",
                onUnauthorized,
                _isRetry: true, // simulate we are already in the retry branch
            }),
        ).rejects.toMatchObject({ status: 401 });

        // The guard must prevent any refresh attempt
        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    // ── 6. Non-401 errors are thrown without touching onUnauthorized ──────────
    it("throws ApiClientError for non-401 errors and never calls onUnauthorized", async () => {
        const onUnauthorized = vi.fn<() => Promise<string | null>>();
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ detail: "not found" }, 404));

        await expect(
            apiRequest("http://localhost:8000", "/api/missing", { onUnauthorized }),
        ).rejects.toMatchObject({ status: 404 });

        expect(onUnauthorized).not.toHaveBeenCalled();
    });

    // ── 7. 204 No Content: body is never parsed ───────────────────────────────
    it("returns undefined for 204 No Content responses without calling response.json()", async () => {
        const response = noContentResponse();
        const jsonSpy = vi.spyOn(response, "json");
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(response);

        const result = await apiRequest("http://localhost:8000", "/api/delete");

        expect(result).toBeUndefined();
        expect(jsonSpy).not.toHaveBeenCalled();
    });

    // ── 8. ApiClientError carries status + data for caller inspection ─────────
    it("throws ApiClientError that exposes status code and parsed body", async () => {
        const errorBody = { detail: "forbidden", code: "E_FORBIDDEN" };
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse(errorBody, 403));

        let caught: unknown;
        try {
            await apiRequest("http://localhost:8000", "/api/admin");
        } catch (e) {
            caught = e;
        }

        expect(caught).toBeInstanceOf(ApiClientError);
        const err = caught as ApiClientError;
        expect(err.status).toBe(403);
        expect(err.data).toEqual(errorBody);
        expect(err.message).toBe("Request failed");
    });
});

// ---------------------------------------------------------------------------
// Suite: makeOnUnauthorized - factory + refresh flow (session.ts:195-222)
// ---------------------------------------------------------------------------

describe("makeOnUnauthorized - token refresh factory", () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    // ── 9. No stored refresh token → null + navigate + clear ─────────────────
    it("returns null, clears tokens, and navigates to /auth when no refresh token is stored", async () => {
        // Ensure no tokens in storage at all
        window.localStorage.clear();

        const navigate = vi.fn();
        const onUnauthorized = makeOnUnauthorized(navigate);

        const result = await onUnauthorized();

        expect(result).toBeNull();
        expect(navigate).toHaveBeenCalledWith("/auth");
        // Tokens should remain absent
        expect(readAccessToken()).toBeNull();
        expect(readRefreshToken()).toBeNull();
    });

    // ── 10. Refresh succeeds → returns new accessToken + persists tokens ──────
    it("calls POST /auth/refresh, persists new tokens to storage, and returns the new access token", async () => {
        window.localStorage.setItem("senso.auth.access_token", "old-access");
        window.localStorage.setItem("senso.auth.refresh_token", "old-refresh");

        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            jsonResponse({
                accessToken: "fresh-access",
                refreshToken: "fresh-refresh",
                expiresIn: 900,
            }),
        );

        const navigate = vi.fn();
        const onUnauthorized = makeOnUnauthorized(navigate);

        const result = await onUnauthorized();

        // Must return the new access token so apiRequest can attach it to the retry
        expect(result).toBe("fresh-access");
        // Navigate must NOT have been called - this was a success path
        expect(navigate).not.toHaveBeenCalled();
        // New tokens must be persisted so subsequent requests work
        expect(readAccessToken()).toBe("fresh-access");
        expect(readRefreshToken()).toBe("fresh-refresh");
        // The refresh endpoint must have been called with the stored refresh token
        expect(fetchMock).toHaveBeenCalledWith(
            "http://localhost:8000/auth/refresh",
            expect.objectContaining({
                method: "POST",
                body: JSON.stringify({ refreshToken: "old-refresh" }),
            }),
        );
    });

    // ── 11. Refresh request fails (e.g. 401 revoked) → null + navigate ────────
    it("returns null, clears tokens, and navigates to /auth when the refresh call itself fails", async () => {
        window.localStorage.setItem("senso.auth.access_token", "stale-access");
        window.localStorage.setItem("senso.auth.refresh_token", "revoked-refresh");

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            jsonResponse({ detail: "refresh token revoked" }, 401),
        );

        const navigate = vi.fn();
        const onUnauthorized = makeOnUnauthorized(navigate);

        const result = await onUnauthorized();

        expect(result).toBeNull();
        expect(navigate).toHaveBeenCalledWith("/auth");
        // Local session must be wiped to force re-login
        expect(readAccessToken()).toBeNull();
        expect(readRefreshToken()).toBeNull();
    });

    // ── 12. navigate is optional - no crash when omitted and refresh fails ─────
    it("does not throw when navigate is omitted and the refresh call fails", async () => {
        window.localStorage.setItem("senso.auth.refresh_token", "bad-refresh");

        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401));

        // No navigate argument
        const onUnauthorized = makeOnUnauthorized();

        await expect(onUnauthorized()).resolves.toBeNull();
        expect(readAccessToken()).toBeNull();
        expect(readRefreshToken()).toBeNull();
    });

    // ── 13. navigate is optional - no crash when omitted and no token stored ──
    it("does not throw when navigate is omitted and no refresh token is in storage", async () => {
        window.localStorage.clear();
        const onUnauthorized = makeOnUnauthorized();
        await expect(onUnauthorized()).resolves.toBeNull();
    });

    // ── 14. End-to-end wiring: apiRequest 401 → makeOnUnauthorized → retry ────
    //
    // This is the most important integration scenario: apiRequest calls the
    // callback produced by makeOnUnauthorized, which calls the refresh endpoint,
    // writes new tokens, and hands the new access token back so apiRequest can
    // retry - all as a single cohesive flow.
    it("end-to-end: 401 on a protected request triggers token refresh and a successful retry", async () => {
        window.localStorage.setItem("senso.auth.access_token", "expired-access");
        window.localStorage.setItem("senso.auth.refresh_token", "valid-refresh");

        const navigate = vi.fn();
        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            // 1st fetch: protected endpoint → 401 (expired token)
            .mockResolvedValueOnce(jsonResponse({ detail: "token expired" }, 401))
            // 2nd fetch: POST /auth/refresh → success
            .mockResolvedValueOnce(
                jsonResponse({
                    accessToken: "rotated-access",
                    refreshToken: "rotated-refresh",
                    expiresIn: 900,
                }),
            )
            // 3rd fetch: retry of protected endpoint with new token → success
            .mockResolvedValueOnce(jsonResponse({ data: "secret stuff" }));

        const result = await apiRequest<{ data: string }>("http://localhost:8000", "/api/protected", {
            token: "expired-access",
            onUnauthorized: makeOnUnauthorized(navigate),
        });

        // Final result is from the successful retry
        expect(result).toEqual({ data: "secret stuff" });
        // navigate was never called - refresh succeeded
        expect(navigate).not.toHaveBeenCalled();
        // fetch was called three times in the right order
        expect(fetchMock).toHaveBeenCalledTimes(3);
        // Retry carries the rotated token
        expect(fetchMock).toHaveBeenNthCalledWith(
            3,
            "http://localhost:8000/api/protected",
            expect.objectContaining({
                headers: expect.objectContaining({
                    authorization: "Bearer rotated-access",
                }),
            }),
        );
        // New tokens have been persisted
        expect(readAccessToken()).toBe("rotated-access");
        expect(readRefreshToken()).toBe("rotated-refresh");
    });

    // ── 15. End-to-end: 401 + failed refresh → throws from apiRequest ─────────
    //
    // Verifies that when the refresh also fails, apiRequest ultimately throws
    // (because onUnauthorized returned null) and the session is cleared.
    it("end-to-end: 401 + failed refresh throws ApiClientError and clears the session", async () => {
        window.localStorage.setItem("senso.auth.access_token", "expired-access");
        window.localStorage.setItem("senso.auth.refresh_token", "expired-refresh");

        const navigate = vi.fn();
        vi.spyOn(globalThis, "fetch")
            // 1st: protected endpoint → 401
            .mockResolvedValueOnce(jsonResponse({ detail: "expired" }, 401))
            // 2nd: refresh endpoint → also 401 (refresh token revoked)
            .mockResolvedValueOnce(jsonResponse({ detail: "refresh revoked" }, 401));

        await expect(
            apiRequest("http://localhost:8000", "/api/protected", {
                token: "expired-access",
                onUnauthorized: makeOnUnauthorized(navigate),
            }),
        ).rejects.toMatchObject({ status: 401 });

        // Session cleared + redirect triggered
        expect(navigate).toHaveBeenCalledWith("/auth");
        expect(readAccessToken()).toBeNull();
        expect(readRefreshToken()).toBeNull();
    });
});

// ---------------------------------------------------------------------------
// Suite: Pre-existing session.ts higher-level tests (kept + extended)
// ---------------------------------------------------------------------------

describe("auth session - higher level flows", () => {
    beforeEach(() => {
        window.localStorage.clear();
        vi.restoreAllMocks();
    });

    it("bootstrap reads localStorage token and validates through /auth/me", async () => {
        window.localStorage.setItem("senso.auth.access_token", "access-1");
        window.localStorage.setItem("senso.auth.refresh_token", "refresh-1");

        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(
                JSON.stringify({ user: { id: "u1", email: "u@test.com", default_persona_id: "hartman" } }),
                {
                    status: 200,
                    headers: { "content-type": "application/json" },
                },
            ),
        );

        const result = await bootstrapSession();

        expect(result.status).toBe("authenticated");
        if (result.status === "authenticated") {
            expect(result.user.email).toBe("u@test.com");
            expect(result.user.defaultPersonaId).toBe("hartman");
        }
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/auth/me", {
            method: "GET",
            headers: {
                "content-type": "application/json",
                authorization: "Bearer access-1",
            },
            body: undefined,
        });
    });

    it("expired token triggers refresh, rotates tokens, retries /auth/me", async () => {
        window.localStorage.setItem("senso.auth.access_token", "expired-access");
        window.localStorage.setItem("senso.auth.refresh_token", "refresh-old");

        const fetchMock = vi
            .spyOn(globalThis, "fetch")
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ detail: "expired" }), {
                    status: 401,
                    headers: { "content-type": "application/json" },
                }),
            )
            .mockResolvedValueOnce(
                new Response(
                    JSON.stringify({
                        accessToken: "new-access",
                        refreshToken: "new-refresh",
                        expiresIn: 900,
                    }),
                    {
                        status: 200,
                        headers: { "content-type": "application/json" },
                    },
                ),
            )
            .mockResolvedValueOnce(
                new Response(JSON.stringify({ user: { id: "u2", email: "new@test.com" } }), {
                    status: 200,
                    headers: { "content-type": "application/json" },
                }),
            );

        const result = await bootstrapSession();

        expect(result.status).toBe("authenticated");
        if (result.status === "authenticated") {
            expect(result.user.email).toBe("new@test.com");
        }
        expect(readAccessToken()).toBe("new-access");
        expect(readRefreshToken()).toBe("new-refresh");
        expect(fetchMock).toHaveBeenCalledTimes(3);
    });

    it("google start 503 fallback maps to email_password fallback state", async () => {
        vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(JSON.stringify({ fallback: "email_password", reason: "google_unavailable" }), {
                status: 503,
                headers: { "content-type": "application/json" },
            }),
        );

        const result = await startGoogle();

        expect(result).toEqual({
            kind: "fallback",
            fallback: "email_password",
            reason: "google_unavailable",
        });
    });

    it("updateMe sends default_persona_id and parses it from the response", async () => {
        const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
            new Response(
                JSON.stringify({
                    id: "u1",
                    email: "u@test.com",
                    first_name: "Ada",
                    default_persona_id: "cheerleader",
                }),
                {
                    status: 200,
                    headers: { "content-type": "application/json" },
                },
            ),
        );

        const updated = await updateMe("access-1", {
            defaultPersonaId: "cheerleader",
        });

        expect(updated.defaultPersonaId).toBe("cheerleader");
        expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/auth/me", {
            method: "PATCH",
            headers: {
                "content-type": "application/json",
                authorization: "Bearer access-1",
            },
            body: JSON.stringify({
                first_name: undefined,
                last_name: undefined,
                voice_gender: undefined,
                voice_auto_listen: undefined,
                default_persona_id: "cheerleader",
            }),
        });
    });
});
