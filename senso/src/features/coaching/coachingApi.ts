import { apiRequest, ApiClientError } from "@/lib/api-client"
import { readAccessToken } from "@/features/auth/storage"
import { getBackendBaseUrl } from "@/lib/config"

const API_BASE = getBackendBaseUrl()

// ── Types ─────────────────────────────────────────────────────────────────────

export interface ReasoningStep {
  step: string
  detail: string
}

export interface ActionCard {
  title: string
  description: string
  action_type: "calculator" | "funnel" | "comparison" | "reminder" | "external_link" | string
  cta_label?: string
  payload?: Record<string, unknown>
}

export interface ResourceCard {
  title: string
  summary: string
  resource_type: string
  url?: string | null
  estimated_read_minutes?: number
  video_id?: string | null
  slide_id?: string | null
}

export interface LearnCard {
  concept: string
  plain_explanation: string
  example?: string
}

export interface AffordabilityKeyFigure {
  label: string
  value: string
}

export interface AffordabilityVerdict {
  verdict: "yes" | "no" | "conditional"
  key_figures: AffordabilityKeyFigure[]
}

export interface NewInsight {
  headline: string
  data_point: string
  educational_framing: string
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
  affordability_verdict?: AffordabilityVerdict | null
  new_insight?: NewInsight | null
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
  persona_id?: string | null
}

export interface PersonaTTSConfig {
  fallback: "browser" | "none"
  browser_fallback_enabled: boolean
}

export interface StreamMetaEvent {
  session_id: string
  persona_id: string
}

export interface StreamCallbacks {
  onMeta?: (meta: StreamMetaEvent) => void
  onDelta?: (chunk: string) => void
  onFinal?: (response: CoachingResponse) => void
}

export interface Persona {
  id: string
  name: string
  description: string
  icon: string
  available: boolean
  tts: PersonaTTSConfig
  defaultGender?: "masculine" | "feminine" | "neutral"
  theme?: {
    light: {
      avatar_bg: string
      bubble_bg: string
      bubble_border: string
    }
    dark: {
      avatar_bg: string
      bubble_bg: string
      bubble_border: string
    }
    label_tone: string
  }
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

function splitSseBlocks(buffer: string): { blocks: string[]; remainder: string } {
  const normalized = buffer.replace(/\r\n/g, "\n")
  const parts = normalized.split("\n\n")
  const remainder = parts.pop() ?? ""
  return { blocks: parts.filter(Boolean), remainder }
}

function parseSseBlock(block: string): { event: string; data: string } | null {
  const lines = block.split("\n")
  let event = "message"
  const dataLines: string[] = []

  for (const line of lines) {
    if (line.startsWith("event:")) {
      event = line.slice(6).trim()
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim())
    }
  }

  if (!dataLines.length) return null
  return { event, data: dataLines.join("\n") }
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

export async function sendMessageStream(
  message: string,
  locale: "it" | "en" = "it",
  personaId: string = "mentore-saggio",
  sessionId?: string,
  callbacks: StreamCallbacks = {},
): Promise<CoachingResponse> {
  const token = requireToken()
  const response = await fetch(`${API_BASE}/coaching/chat/stream`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${token}`,
      accept: "text/event-stream",
    },
    body: JSON.stringify({
      message,
      session_id: sessionId ?? null,
      locale,
      persona_id: personaId,
    }),
  })

  if (!response.ok) {
    try {
      const data = (await response.json()) as unknown
      throw new ApiClientError("Request failed", response.status, data)
    } catch (err) {
      if (err instanceof ApiClientError) wrapError(err)
      throw new CoachingApiError("network_error", "Network request failed", response.status)
    }
  }

  if (!response.body) {
    throw new CoachingApiError("stream_unavailable", "Streaming body unavailable")
  }

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ""
  let finalResponse: CoachingResponse | null = null

  while (true) {
    const { done, value } = await reader.read()
    buffer += decoder.decode(value ?? new Uint8Array(), { stream: !done })

    const { blocks, remainder } = splitSseBlocks(buffer)
    buffer = remainder

    for (const block of blocks) {
      const parsed = parseSseBlock(block)
      if (!parsed) continue

      if (parsed.event === "meta") {
        callbacks.onMeta?.(JSON.parse(parsed.data) as StreamMetaEvent)
      } else if (parsed.event === "delta") {
        const payload = JSON.parse(parsed.data) as { text?: string }
        callbacks.onDelta?.(payload.text ?? "")
      } else if (parsed.event === "final") {
        finalResponse = JSON.parse(parsed.data) as CoachingResponse
        callbacks.onFinal?.(finalResponse)
      } else if (parsed.event === "done" && finalResponse) {
        return finalResponse
      }
    }

    if (done) {
      break
    }
  }

  throw new CoachingApiError("stream_interrupted", "Streaming ended before final payload")
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

// ── TTS ───────────────────────────────────────────────────────────────────────

/**
 * Fetch TTS audio from POST /coaching/tts.
 * Uses native fetch (not apiRequest) because response is binary audio/mpeg.
 * Throws CoachingApiError("tts_unavailable", ..., 503) on failure.
 */
export async function fetchTTSAudio(text: string, locale: "it" | "en" = "it"): Promise<Blob> {
  const token = readAccessToken()
  const resp = await fetch(`${API_BASE}/coaching/tts`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ text, locale }),
  })
  if (!resp.ok) {
    let code = "tts_unavailable"
    try {
      const body = await resp.json()
      code = body?.detail?.code ?? "tts_unavailable"
    } catch {}
    throw new CoachingApiError(code, `TTS failed (${resp.status})`, resp.status)
  }
  return resp.blob()
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
