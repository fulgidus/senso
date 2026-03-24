import { beforeEach, describe, expect, it, vi } from "vitest"

vi.mock("@/lib/config", () => ({
  getBackendBaseUrl: () => "http://localhost:8000",
}))

import {
  bootstrapSession,
  startGoogle,
} from "@/features/auth/session"
import { readAccessToken, readRefreshToken } from "@/features/auth/storage"

describe("auth session", () => {
  beforeEach(() => {
    window.localStorage.clear()
    vi.restoreAllMocks()
  })

  it("bootstrap reads localStorage token and validates through /auth/me", async () => {
    window.localStorage.setItem("senso.auth.access_token", "access-1")
    window.localStorage.setItem("senso.auth.refresh_token", "refresh-1")

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ user: { id: "u1", email: "u@test.com" } }), {
          status: 200,
          headers: { "content-type": "application/json" },
        }),
      )

    const result = await bootstrapSession()

    expect(result.status).toBe("authenticated")
    if (result.status === "authenticated") {
      expect(result.user.email).toBe("u@test.com")
    }
    expect(fetchMock).toHaveBeenCalledWith("http://localhost:8000/auth/me", {
      method: "GET",
      headers: {
        "content-type": "application/json",
        authorization: "Bearer access-1",
      },
      body: undefined,
    })
  })

  it("expired token triggers refresh, rotates tokens, retries /auth/me", async () => {
    window.localStorage.setItem("senso.auth.access_token", "expired-access")
    window.localStorage.setItem("senso.auth.refresh_token", "refresh-old")

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
      )

    const result = await bootstrapSession()

    expect(result.status).toBe("authenticated")
    if (result.status === "authenticated") {
      expect(result.user.email).toBe("new@test.com")
    }
    expect(readAccessToken()).toBe("new-access")
    expect(readRefreshToken()).toBe("new-refresh")
    expect(fetchMock).toHaveBeenCalledTimes(3)
  })

  it("google start 503 fallback maps to email_password fallback state", async () => {
    vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
      new Response(
        JSON.stringify({ fallback: "email_password", reason: "google_unavailable" }),
        {
          status: 503,
          headers: { "content-type": "application/json" },
        },
      ),
    )

    const result = await startGoogle()

    expect(result).toEqual({
      kind: "fallback",
      fallback: "email_password",
      reason: "google_unavailable",
    })
  })
})
