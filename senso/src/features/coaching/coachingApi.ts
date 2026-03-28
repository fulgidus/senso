import { apiRequest, ApiClientError } from "@/lib/api-client"
import { readAccessToken } from "@/features/auth/storage"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

// ── Types ─────────────────────────────────────────────────────────────────────

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

export interface LLMCallTrace {
  provider_attempted: string[]
  provider_errors: string[]
  provider_used: string
  model_used: string
  tokens: {
    prompt: number | null
    completion: number | null
    total: number | null
  }
  latency_ms: number | null
}

export interface DebugPayload {
  system_prompt: string
  context_block: string
  full_prompt: string
  raw_llm_response: string
  model_used: string
  schema_valid: boolean
  profile_snapshot: Record<string, unknown>
  call_trace?: LLMCallTrace
}

export interface CoachingResponse {
  session_id: string
  message: string
  reasoning_used: ReasoningStep[]
  action_cards: ActionCard[]
  resource_cards: ResourceCard[]
  learn_cards: LearnCard[]
  details_a2ui?: string | null
  debug?: DebugPayload
}

export interface SessionSummary {
  id: string
  name: string
  created_at: string
  updated_at: string
  message_count: number
  last_message_preview: string | null
  locale: string
  persona_id: string
}

export interface SessionMessage {
  role: "user" | "assistant"
  content: string
  created_at: string | null
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

// ── Helpers ───────────────────────────────────────────────────────────────────

function requireToken(): string {
  const token = readAccessToken()
  if (!token) throw new CoachingApiError("unauthenticated", "No access token found")
  return token
}

function wrapError(err: unknown): never {
  if (err instanceof ApiClientError) {
    const detail = (err.data as { code?: string; message?: string } | null) ?? {}
    if (detail.code) throw new CoachingApiError(detail.code, detail.message ?? err.message, err.status)
    if (err.status === 401) throw new CoachingApiError("unauthenticated", err.message, 401)
    if (err.status === 422) throw new CoachingApiError("profile_required", err.message, 422)
    if (err.status === 400) throw new CoachingApiError("input_rejected", err.message, 400)
    if (err.status === 502) throw new CoachingApiError("llm_error", err.message, 502)
    throw new CoachingApiError("network_error", err.message, err.status)
  }
  throw new CoachingApiError("network_error", "Network request failed")
}

// ── Chat ──────────────────────────────────────────────────────────────────────

export async function sendMessage(
  message: string,
  locale: "it" | "en" = "it",
  personaId: string = "mentore-saggio",
  sessionId?: string,
): Promise<CoachingResponse> {
  const token = requireToken()
  try {
    return await apiRequest<CoachingResponse>(API_BASE, "/coaching/chat", {
      method: "POST",
      token,
      body: { message, session_id: sessionId ?? null, locale, persona_id: personaId },
    })
  } catch (err) {
    wrapError(err)
  }
}

export async function getWelcomeMessage(locale: "it" | "en" = "it"): Promise<string> {
  const token = requireToken()
  try {
    const resp = await apiRequest<{ message: string }>(
      API_BASE,
      `/coaching/welcome?locale=${locale}`,
      { token },
    )
    return resp.message
  } catch (err) {
    wrapError(err)
  }
}

// ── Sessions ──────────────────────────────────────────────────────────────────

export async function listSessions(): Promise<SessionSummary[]> {
  const token = requireToken()
  try {
    return await apiRequest<SessionSummary[]>(API_BASE, "/coaching/sessions", { token })
  } catch (err) {
    wrapError(err)
  }
}

export async function getSessionMessages(sessionId: string): Promise<SessionMessage[]> {
  const token = requireToken()
  try {
    return await apiRequest<SessionMessage[]>(
      API_BASE,
      `/coaching/sessions/${sessionId}/messages`,
      { token },
    )
  } catch (err) {
    wrapError(err)
  }
}

export async function renameSession(sessionId: string, name: string): Promise<SessionSummary> {
  const token = requireToken()
  try {
    return await apiRequest<SessionSummary>(API_BASE, `/coaching/sessions/${sessionId}`, {
      method: "PATCH",
      token,
      body: { name },
    })
  } catch (err) {
    wrapError(err)
  }
}

export async function deleteSession(sessionId: string): Promise<void> {
  const token = requireToken()
  try {
    await apiRequest<void>(API_BASE, `/coaching/sessions/${sessionId}`, {
      method: "DELETE",
      token,
    })
  } catch (err) {
    wrapError(err)
  }
}

export async function generateConversationName(firstUserMessage: string): Promise<string> {
  const token = requireToken()
  try {
    const resp = await apiRequest<{ name: string }>(API_BASE, "/coaching/name-conversation", {
      method: "POST",
      token,
      body: { message: firstUserMessage },
    })
    return resp.name?.trim() ?? ""
  } catch {
    return ""
  }
}

// ── Personas ──────────────────────────────────────────────────────────────────

export async function getPersonas(): Promise<Persona[]> {
  const token = requireToken()
  try {
    return await apiRequest<Persona[]>(API_BASE, "/coaching/personas", { token })
  } catch (err) {
    wrapError(err)
  }
}
