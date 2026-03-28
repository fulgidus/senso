import { apiRequest, ApiClientError } from "@/lib/api-client"
import { readAccessToken } from "@/features/auth/storage"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

// ──────────────────────────────────────────────
// Types
// ──────────────────────────────────────────────

export interface ChatMessage {
  role: "user" | "assistant"
  content: string
}

export interface ReasoningStep {
  step: string
  detail: string
}

export interface ActionCard {
  title: string
  description: string
  action_type: string
  cta_label?: string
  payload?: Record<string, unknown>
}

export interface ResourceCard {
  title: string
  summary: string
  resource_type: string
  url?: string
  estimated_read_minutes?: number
}

export interface LearnCard {
  concept: string
  plain_explanation: string
  example?: string
}

export interface CoachingResponse {
  session_id: string
  message: string
  reasoning_used: ReasoningStep[]
  action_cards: ActionCard[]
  resource_cards: ResourceCard[]
  learn_cards: LearnCard[]
}

export interface Persona {
  id: string
  name: string
  description: string
  icon: string
  available: boolean
}

export class CoachingApiError extends Error {
  readonly code: string
  readonly statusCode: number | undefined

  constructor(code: string, message: string, statusCode?: number) {
    super(message)
    this.name = "CoachingApiError"
    this.code = code
    this.statusCode = statusCode
  }
}

// ──────────────────────────────────────────────
// API functions
// ──────────────────────────────────────────────

export async function sendMessage(
  message: string,
  locale: "it" | "en" = "it",
  personaId: string = "mentore-saggio",
  sessionId?: string,
): Promise<CoachingResponse> {
  const token = readAccessToken()
  if (!token) {
    throw new CoachingApiError("unauthenticated", "No access token found")
  }

  try {
    return await apiRequest<CoachingResponse>(API_BASE, "/coaching/chat", {
      method: "POST",
      token,
      body: {
        message,
        session_id: sessionId ?? null,
        locale,
        persona_id: personaId,
      },
    })
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      const detail = (err.data as { code?: string; message?: string } | null) ?? {}
      if (detail.code) {
        throw new CoachingApiError(detail.code, detail.message ?? err.message, err.status)
      }
      if (err.status === 401) throw new CoachingApiError("unauthenticated", err.message, 401)
      if (err.status === 422) throw new CoachingApiError("profile_required", err.message, 422)
      if (err.status === 400) throw new CoachingApiError("input_rejected", err.message, 400)
      if (err.status === 502) throw new CoachingApiError("llm_error", err.message, 502)
      throw new CoachingApiError("network_error", err.message, err.status)
    }
    throw new CoachingApiError("network_error", "Network request failed")
  }
}

export async function getPersonas(): Promise<Persona[]> {
  const token = readAccessToken()
  if (!token) {
    throw new CoachingApiError("unauthenticated", "No access token found")
  }
  try {
    return await apiRequest<Persona[]>(API_BASE, "/coaching/personas", { token })
  } catch (err: unknown) {
    if (err instanceof ApiClientError) {
      throw new CoachingApiError("network_error", err.message, err.status)
    }
    throw new CoachingApiError("network_error", "Network request failed")
  }
}
