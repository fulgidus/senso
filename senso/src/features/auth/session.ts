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
  VoiceGender,
} from "./types"

const backendBaseUrl = getBackendBaseUrl()

type RawUser = {
  id: string
  email: string
  first_name?: string | null
  last_name?: string | null
  voice_gender?: string | null
  voice_auto_listen?: boolean | null
  default_persona_id?: string | null
}

function parseUser(raw: RawUser): User {
  return {
    id: raw.id,
    email: raw.email,
    firstName: raw.first_name ?? null,
    lastName: raw.last_name ?? null,
    voiceGender: (raw.voice_gender as VoiceGender | null) ?? "indifferent",
    voiceAutoListen: raw.voice_auto_listen ?? false,
    defaultPersonaId: raw.default_persona_id ?? "mentore-saggio",
  }
}

export async function signup(email: string, password: string): Promise<AuthPayload> {
  const raw = await apiRequest<{ user: RawUser; accessToken: string; refreshToken: string; expiresIn: number }>(backendBaseUrl, "/auth/signup", {
    method: "POST",
    body: { email, password },
  })
  const payload: AuthPayload = {
    user: parseUser(raw.user),
    accessToken: raw.accessToken,
    refreshToken: raw.refreshToken,
    expiresIn: raw.expiresIn,
  }
  writeTokens(payload)
  return payload
}

export async function login(email: string, password: string): Promise<AuthPayload> {
  const raw = await apiRequest<{ user: RawUser; accessToken: string; refreshToken: string; expiresIn: number }>(backendBaseUrl, "/auth/login", {
    method: "POST",
    body: { email, password },
  })
  const payload: AuthPayload = {
    user: parseUser(raw.user),
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
  data: {
    firstName?: string | null
    lastName?: string | null
    voiceGender?: VoiceGender | null
    voiceAutoListen?: boolean | null
    defaultPersonaId?: string | null
  },
): Promise<User> {
  const raw = await apiRequest<RawUser>(
    backendBaseUrl,
    "/auth/me",
    {
      method: "PATCH",
      token: accessToken,
      body: {
        first_name: data.firstName,
        last_name: data.lastName,
        voice_gender: data.voiceGender,
        voice_auto_listen: data.voiceAutoListen,
        default_persona_id: data.defaultPersonaId,
      },
    },
  )
  return parseUser(raw)
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
  const raw = await apiRequest<{ user: RawUser }>(backendBaseUrl, "/auth/me", {
    token: accessToken,
  })
  return {
    user: parseUser(raw.user),
  }
}
