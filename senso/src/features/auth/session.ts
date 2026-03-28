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
  User,
} from "./types"

const backendBaseUrl = getBackendBaseUrl()

export async function signup(email: string, password: string): Promise<AuthPayload> {
  const raw = await apiRequest<{ user: { id: string; email: string; first_name?: string | null; last_name?: string | null }; accessToken: string; refreshToken: string; expiresIn: number }>(backendBaseUrl, "/auth/signup", {
    method: "POST",
    body: { email, password },
  })
  const payload: AuthPayload = {
    user: { id: raw.user.id, email: raw.user.email, firstName: raw.user.first_name ?? null, lastName: raw.user.last_name ?? null },
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresIn: raw.expiresIn,
  }
  writeTokens(payload)
  return payload
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const raw = await apiRequest<{ user: { id: string; email: string; first_name?: string | null; last_name?: string | null }; accessToken: string; refreshToken: string; expiresIn: number }>(backendBaseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
  })
  const payload: AuthPayload = {
    user: { id: raw.user.id, email: raw.user.email, firstName: raw.user.first_name ?? null, lastName: raw.user.last_name ?? null },
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresIn: raw.expiresIn,
  }
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

export async function updateMe(
  accessToken: string,
  data: { firstName?: string | null; lastName?: string | null },
): Promise<User> {
  const raw = await apiRequest<{ id: string; email: string; first_name?: string | null; last_name?: string | null }>(
    backendBaseUrl,
    "/auth/me",
    {
      method: "PATCH",
      token: accessToken,
      body: { first_name: data.firstName, last_name: data.lastName },
    },
  )
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.first_name ?? null,
    lastName: raw.last_name ?? null,
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
  const raw = await apiRequest<{ user: { id: string; email: string; first_name?: string | null; last_name?: string | null } }>(backendBaseUrl, "/auth/me", {
    token: accessToken,
  })
  return {
    user: {
      id: raw.user.id,
      email: raw.user.email,
      firstName: raw.user.first_name ?? null,
      lastName: raw.user.last_name ?? null,
    },
  }
}
