import { ApiClientError, apiRequest } from "@/lib/api-client"
import { getBackendBaseUrl } from "@/lib/config"

import {
  clearTokens,
  readAccessToken,
  readRefreshToken,
  writeTokens,
} from "./storage"
import type {
  AuthPayload,
  BootstrapResult,
  FallbackPayload,
  GoogleStartResult,
  MePayload,
  RefreshPayload,
} from "./types"

const backendBaseUrl = getBackendBaseUrl()

export async function signup(email: string, password: string): Promise<AuthPayload> {
  const payload = await apiRequest<AuthPayload>(backendBaseUrl, "/auth/signup", {
    method: "POST",
    body: { email, password },
  })
  writeTokens(payload)
  return payload
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const payload = await apiRequest<AuthPayload>(backendBaseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
  })
  writeTokens(payload)
  return payload
}

export async function signout(): Promise<void> {
  const refreshToken = readRefreshToken()
  if (refreshToken) {
    try {
      await apiRequest<undefined>(backendBaseUrl, "/auth/logout", {
        method: "POST",
        body: { refreshToken },
      })
    } catch {
      // Always clear local session even if backend logout fails.
    }
  }
  clearTokens()
}

export const logout = signout

export async function bootstrapSession(): Promise<BootstrapResult> {
  const accessToken = readAccessToken()
  const refreshToken = readRefreshToken()

  if (!accessToken || !refreshToken) {
    return { status: "unauthenticated" }
  }

  try {
    const me = await getMe(accessToken)
    return { status: "authenticated", user: me.user }
  } catch (error: unknown) {
    const authError =
      error instanceof ApiClientError ? error : new ApiClientError("Unknown", 500, null)
    if (authError.status !== 401) {
      clearTokens()
      return { status: "unauthenticated" }
    }

    try {
      const refreshed = await refresh(refreshToken)
      const me = await getMe(refreshed.accessToken)
      return { status: "authenticated", user: me.user }
    } catch {
      clearTokens()
      return { status: "unauthenticated" }
    }
  }
}

export async function startGoogle(): Promise<GoogleStartResult> {
  try {
    const payload = await apiRequest<{ authUrl: string }>(
      backendBaseUrl,
      "/auth/google/start",
    )
    return { kind: "redirect", authUrl: payload.authUrl }
  } catch (error: unknown) {
    const authError =
      error instanceof ApiClientError ? error : new ApiClientError("Unknown", 500, null)
    if (authError.status === 503) {
      const fallback = authError.data as FallbackPayload
      if (fallback?.fallback === "email_password") {
        return {
          kind: "fallback",
          fallback: "email_password",
          reason: fallback.reason,
        }
      }
    }
    throw error
  }
}

async function refresh(refreshToken: string): Promise<RefreshPayload> {
  const payload = await apiRequest<RefreshPayload>(backendBaseUrl, "/auth/refresh", {
    method: "POST",
    body: { refreshToken },
  })
  writeTokens(payload)
  return payload
}

async function getMe(accessToken: string): Promise<MePayload> {
  return apiRequest<MePayload>(backendBaseUrl, "/auth/me", {
    token: accessToken,
  })
}
