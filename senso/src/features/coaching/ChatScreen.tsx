import { useState, useRef, useEffect, useCallback } from "react"
import { Button } from "@/components/ui/button"
import { SHOW_REASONING, LLM_DEBUG } from "@/lib/config"
import { useAuthContext } from "@/features/auth/AuthContext"
import { UserAvatar } from "@/components/UserAvatar"
import {
  sendMessage,
  getWelcomeMessage,
  listSessions,
  getSessionMessages,
  renameSession,
  deleteSession,
  generateConversationName,
  CoachingApiError,
  type CoachingResponse,
  type ReasoningStep,
  type ActionCard,
  type ResourceCard,
  type LearnCard,
  type DebugPayload,
  type SessionSummary,
  type SessionMessage,
} from "./coachingApi"
import { MessageCircle, PenLine, Trash2, Plus, X, Check, Mic, Square } from "lucide-react"
import { useVoiceInput } from "./useVoiceInput"

interface ChatScreenProps {
  onNavigateBack: () => void
  locale?: "it" | "en"
}

interface DisplayMessage {
  role: "user" | "assistant"
  content: string
  response?: CoachingResponse
  isWelcome?: boolean
}

// ── Sub-components ────────────────────────────────────────────────────────────

function ReasoningCard({ steps }: { steps: ReasoningStep[] }) {
  const [open, setOpen] = useState(false)
  if (!steps.length) return null
  return (
    <div className="mt-2 text-sm border border-muted rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 text-left font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>Ragionamento usato</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <ul className="px-3 py-2 space-y-1">
          {steps.map((s, i) => (
            <li key={i} className="flex gap-2">
              <span className="font-semibold shrink-0">{s.step}:</span>
              <span className="text-muted-foreground">{s.detail}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ActionCardStub({ card }: { card: ActionCard }) {
  return (
    <div className="border border-border rounded-md px-3 py-2 bg-background text-sm">
      <div className="font-semibold">{card.title}</div>
      <div className="text-muted-foreground mt-0.5">{card.description}</div>
      {card.cta_label && (
        <span className="inline-block mt-1 text-xs font-medium text-primary">
          {card.cta_label} →
        </span>
      )}
    </div>
  )
}

function ResourceCardStub({ card }: { card: ResourceCard }) {
  return (
    <div className="border border-border rounded-md px-3 py-2 bg-background text-sm">
      <div className="font-semibold">{card.title}</div>
      <div className="text-muted-foreground mt-0.5">{card.summary}</div>
      {card.estimated_read_minutes && (
        <span className="text-xs text-muted-foreground mt-1 block">
          {card.estimated_read_minutes} min di lettura
        </span>
      )}
    </div>
  )
}

function LearnCardStub({ card }: { card: LearnCard }) {
  return (
    <div className="border border-blue-200 rounded-md px-3 py-2 bg-blue-50 text-sm">
      <div className="font-semibold text-blue-800">{card.concept}</div>
      <div className="text-blue-700 mt-0.5">{card.plain_explanation}</div>
      {card.example && (
        <div className="text-blue-600 text-xs mt-1 italic">Es: {card.example}</div>
      )}
    </div>
  )
}

function DebugSection({ label, content }: { label: string; content: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border border-yellow-300 rounded-md overflow-hidden text-xs">
      <button
        className="w-full flex items-center justify-between px-2 py-1 bg-yellow-100 text-left font-mono font-semibold text-yellow-800 hover:bg-yellow-200 transition-colors"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{label}</span>
        <span>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <pre className="px-2 py-1 bg-yellow-50 text-yellow-900 whitespace-pre-wrap break-all overflow-x-auto max-h-48 overflow-y-auto">
          {content}
        </pre>
      )}
    </div>
  )
}

function DebugPanel({ debug }: { debug: DebugPayload }) {
  const trace = debug.call_trace
  return (
    <div className="mt-3 space-y-1 border-t-2 border-yellow-400 pt-2">
      <p className="text-xs font-bold text-yellow-700 font-mono">DEBUG — LLM_DEBUG=true</p>
      <div className="text-xs text-yellow-700 font-mono space-y-0.5">
        <div>
          Model: <span className="font-semibold">{debug.model_used}</span>
          {" · "}Schema valid:{" "}
          <span className={debug.schema_valid ? "text-green-700" : "text-red-700"}>
            {String(debug.schema_valid)}
          </span>
        </div>
        {trace && (
          <>
            <div>
              Provider used: <span className="font-semibold">{trace.provider_used}/{trace.model_used}</span>
              {trace.latency_ms != null && (
                <span className="ml-2 text-yellow-600">{trace.latency_ms.toFixed(0)} ms</span>
              )}
            </div>
            {trace.tokens.total != null && (
              <div>
                Tokens:{" "}
                <span className="font-semibold">{trace.tokens.total}</span>
                {" "}(prompt: {trace.tokens.prompt ?? "?"} · completion: {trace.tokens.completion ?? "?"})
              </div>
            )}
            {trace.provider_attempted.length > 1 && (
              <div>
                Attempted:{" "}
                <span className="text-yellow-600">{trace.provider_attempted.join(" → ")}</span>
              </div>
            )}
            {trace.provider_errors.length > 0 && (
              <div className="text-red-600">
                Errors: {trace.provider_errors.join(" | ")}
              </div>
            )}
          </>
        )}
      </div>
      <DebugSection label="System Prompt" content={debug.system_prompt} />
      <DebugSection label="Context Block" content={debug.context_block} />
      <DebugSection label="Full Prompt" content={debug.full_prompt} />
      <DebugSection label="Raw LLM Response" content={debug.raw_llm_response} />
      <DebugSection
        label="Profile Snapshot"
        content={JSON.stringify(debug.profile_snapshot, null, 2)}
      />
      {trace && (
        <DebugSection label="Call Trace" content={JSON.stringify(trace, null, 2)} />
      )}
    </div>
  )
}

function SensoAvatar() {
  return (
    <div className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full bg-secondary text-lg select-none">
      🦉
    </div>
  )
}

function AssistantBubble({ msg }: { msg: DisplayMessage }) {
  const resp = msg.response
  return (
    <div className="flex items-start gap-2 max-w-[90%]">
      <SensoAvatar />
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex-1 min-w-0">
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {resp && (
          <>
            {SHOW_REASONING && <ReasoningCard steps={resp.reasoning_used} />}
            {resp.action_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.action_cards.map((c, i) => <ActionCardStub key={i} card={c} />)}
              </div>
            )}
            {resp.resource_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.resource_cards.map((c, i) => <ResourceCardStub key={i} card={c} />)}
              </div>
            )}
            {resp.learn_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.learn_cards.map((c, i) => <LearnCardStub key={i} card={c} />)}
              </div>
            )}
            {LLM_DEBUG && resp.debug && <DebugPanel debug={resp.debug} />}
          </>
        )}
      </div>
    </div>
  )
}

// ── Error messages ────────────────────────────────────────────────────────────

const ERROR_MESSAGES: Record<string, string> = {
  input_rejected: "Messaggio non consentito. Prova a riformulare.",
  profile_required: "Completa il profilo finanziario per ricevere coaching personalizzato.",
  llm_error: "Coach temporaneamente non disponibile. Riprova tra poco.",
  network_error: "Errore di connessione. Controlla la rete e riprova.",
  unauthenticated: "Sessione scaduta. Effettua di nuovo il login.",
}

function getErrorMessage(code: string): string {
  return ERROR_MESSAGES[code] ?? "Si è verificato un errore. Riprova."
}

// ── Conversations Modal ───────────────────────────────────────────────────────

interface ConversationsModalProps {
  sessions: SessionSummary[]
  activeSessionId: string | undefined
  onOpen: (id: string) => void
  onRename: (id: string, name: string) => Promise<void>
  onDelete: (id: string) => Promise<void>
  onClose: () => void
}

function ConversationsModal({
  sessions,
  activeSessionId,
  onOpen,
  onRename,
  onDelete,
  onClose,
}: ConversationsModalProps) {
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editValue, setEditValue] = useState("")
  const [busyId, setBusyId] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (editingId && inputRef.current) inputRef.current.focus()
  }, [editingId])

  const startEdit = (s: SessionSummary) => {
    setEditingId(s.id)
    setEditValue(s.name)
  }

  const commitRename = async (id: string) => {
    const trimmed = editValue.trim()
    if (!trimmed) return // no empty names
    setBusyId(id)
    try {
      await onRename(id, trimmed)
    } finally {
      setBusyId(null)
      setEditingId(null)
    }
  }

  const handleDelete = async (id: string) => {
    setBusyId(id)
    try {
      await onDelete(id)
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
        aria-hidden
      />
      {/* Panel */}
      <div className="relative z-10 w-full sm:max-w-md bg-background rounded-t-2xl sm:rounded-2xl border border-border shadow-xl flex flex-col max-h-[80vh]">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border shrink-0">
          <h2 className="font-semibold text-sm">Conversazioni</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Chiudi"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {sessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              Nessuna conversazione
            </p>
          ) : (
            <ul className="divide-y divide-border">
              {sessions.map((s) => (
                <li
                  key={s.id}
                  className={[
                    "flex items-center gap-2 px-4 py-3 group",
                    s.id === activeSessionId ? "bg-primary/5" : "hover:bg-accent/50",
                  ].join(" ")}
                >
                  {editingId === s.id ? (
                    <input
                      ref={inputRef}
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void commitRename(s.id)
                        if (e.key === "Escape") setEditingId(null)
                      }}
                      className="flex-1 text-sm border border-input rounded px-2 py-1 bg-background focus:outline-none focus:ring-2 focus:ring-ring"
                      maxLength={120}
                    />
                  ) : (
                    <button
                      className="flex-1 text-left min-w-0"
                      onClick={() => { onOpen(s.id); onClose() }}
                    >
                      <p className={[
                        "text-sm truncate font-medium",
                        s.id === activeSessionId ? "text-primary" : "text-foreground",
                      ].join(" ")}>
                        {s.name}
                      </p>
                      {s.last_message_preview && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {s.last_message_preview}
                        </p>
                      )}
                    </button>
                  )}

                  <div className="flex items-center gap-1 shrink-0">
                    {editingId === s.id ? (
                      <button
                        onClick={() => void commitRename(s.id)}
                        disabled={!editValue.trim() || busyId === s.id}
                        className="rounded p-1 text-primary hover:bg-primary/10 disabled:opacity-40 transition-colors"
                        aria-label="Salva nome"
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(s)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all"
                        aria-label="Rinomina"
                      >
                        <PenLine className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(s.id)}
                      disabled={busyId === s.id}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"
                      aria-label="Elimina"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  )
}

// ── Helpers ───────────────────────────────────────────────────────────────────

/**
 * Parse a raw SessionMessage (content may be JSON-stringified assistant response
 * or plain user text) into a DisplayMessage.
 */
function parseStoredMessage(m: SessionMessage): DisplayMessage {
  if (m.role === "assistant") {
    try {
      const parsed = JSON.parse(m.content) as CoachingResponse & { message?: string }
      return {
        role: "assistant",
        content: parsed.message ?? m.content,
        response: parsed as CoachingResponse,
      }
    } catch {
      return { role: "assistant", content: m.content }
    }
  }
  return { role: "user", content: m.content }
}

// ── ChatScreen ────────────────────────────────────────────────────────────────

export function ChatScreen({ onNavigateBack, locale = "it" }: ChatScreenProps) {
  const { user } = useAuthContext()

  // Session state
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [sessionName, setSessionName] = useState<string>("")
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [showModal, setShowModal] = useState(false)

  // Message state
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [welcomeLoading, setWelcomeLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)

  const listEndRef = useRef<HTMLDivElement>(null)
  const namingInFlight = useRef(false)

  // ── Load sessions list + restore last ──────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const list = await listSessions()
      setSessions(list)
      return list
    } catch {
      return []
    }
  }, [])

  const loadSessionHistory = useCallback(async (id: string) => {
    setLoadingHistory(true)
    setMessages([])
    try {
      const msgs = await getSessionMessages(id)
      setMessages(msgs.map(parseStoredMessage))
    } catch {
      setMessages([])
    } finally {
      setLoadingHistory(false)
    }
  }, [])

  // On mount: load sessions, restore last or fetch welcome for empty new session
  useEffect(() => {
    void (async () => {
      const list = await fetchSessions()
      if (list.length > 0) {
        const last = list[0] // newest = index 0 (sorted by updated_at desc)
        setSessionId(last.id)
        setSessionName(last.name)
        await loadSessionHistory(last.id)
      } else {
        // No sessions yet — show welcome, session will be created on first send
        setLoadingHistory(false)
        setWelcomeLoading(true)
        try {
          const msg = await getWelcomeMessage(locale)
          setMessages([{ role: "assistant", content: msg, isWelcome: true }])
        } catch {
          const fallback =
            locale === "en"
              ? "Hi! I'm your financial coach. Ask me anything about your budget, spending, or goals."
              : "Ciao! Sono il tuo Mentore Saggio. Chiedimi qualcosa sul tuo budget, le tue spese o i tuoi obiettivi finanziari."
          setMessages([{ role: "assistant", content: fallback, isWelcome: true }])
        } finally {
          setWelcomeLoading(false)
        }
      }
    })()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Auto-scroll
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  // ── New conversation ───────────────────────────────────────────────────────

  const handleNewConversation = useCallback(async () => {
    setSessionId(undefined)
    setSessionName("")
    setMessages([])
    setError(null)
    setWelcomeLoading(true)
    try {
      const msg = await getWelcomeMessage(locale)
      setMessages([{ role: "assistant", content: msg, isWelcome: true }])
    } catch {
      const fallback =
        locale === "en"
          ? "Hi! I'm your financial coach. Ask me anything about your budget, spending, or goals."
          : "Ciao! Sono il tuo Mentore Saggio. Chiedimi qualcosa sul tuo budget, le tue spese o i tuoi obiettivi finanziari."
      setMessages([{ role: "assistant", content: fallback, isWelcome: true }])
    } finally {
      setWelcomeLoading(false)
    }
  }, [locale])

  // ── Open a previous conversation ───────────────────────────────────────────

  const handleOpenSession = useCallback(async (id: string) => {
    const found = sessions.find((s) => s.id === id)
    setSessionId(id)
    setSessionName(found?.name ?? "")
    setError(null)
    await loadSessionHistory(id)
  }, [sessions, loadSessionHistory])

  // ── Rename ─────────────────────────────────────────────────────────────────

  const handleRename = useCallback(async (id: string, name: string) => {
    const updated = await renameSession(id, name)
    setSessions((prev) => prev.map((s) => (s.id === id ? updated : s)))
    if (id === sessionId) setSessionName(updated.name)
  }, [sessionId])

  // ── Delete ─────────────────────────────────────────────────────────────────

  const handleDelete = useCallback(async (id: string) => {
    await deleteSession(id)
    const newList = sessions.filter((s) => s.id !== id)
    setSessions(newList)
    if (id === sessionId) {
      if (newList.length > 0) {
        const next = newList[0]
        setSessionId(next.id)
        setSessionName(next.name)
        await loadSessionHistory(next.id)
      } else {
        await handleNewConversation()
      }
    }
  }, [sessions, sessionId, handleNewConversation, loadSessionHistory])

  // ── Send message ───────────────────────────────────────────────────────────

  const handleSend = useCallback(async (text?: string) => {
    const trimmed = (text ?? inputText).trim()
    if (!trimmed || isLoading) return

    setError(null)
    const userMsg: DisplayMessage = { role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInputText("")
    setIsLoading(true)

    const isFirstUserMessage = !sessionId

    try {
      const response = await sendMessage(trimmed, locale, "mentore-saggio", sessionId)
      const newSessionId = response.session_id

      // If this was the first message, a new session was created
      if (isFirstUserMessage && newSessionId) {
        setSessionId(newSessionId)
        // Refresh sessions list
        const list = await fetchSessions()
        const created = list.find((s) => s.id === newSessionId)
        setSessionName(created?.name ?? "")

        // Auto-name in background (fire-and-forget)
        if (!namingInFlight.current) {
          namingInFlight.current = true
          void generateConversationName(trimmed).then(async (name) => {
            namingInFlight.current = false
            if (name && name.trim()) {
              try {
                const updated = await renameSession(newSessionId, name)
                setSessions((prev) =>
                  prev.map((s) => (s.id === newSessionId ? updated : s)),
                )
                setSessionName(updated.name)
              } catch { /* best-effort */ }
            }
          })
        }
      }

      setMessages((prev) => [
        ...prev,
        { role: "assistant", content: response.message, response },
      ])
    } catch (err) {
      if (err instanceof CoachingApiError) {
        setError({ code: err.code, message: getErrorMessage(err.code) })
      } else {
        setError({ code: "network_error", message: getErrorMessage("network_error") })
      }
    } finally {
      setIsLoading(false)
    }
  }, [inputText, isLoading, sessionId, locale, fetchSessions])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  // ── Voice input ─────────────────────────────────────────────────────────────

  const { isAvailable: isSttAvailable, isRecording, transcript, error: sttError, startRecording, stopRecording } = useVoiceInput({
    locale,
    onFinalTranscript: handleSend,
  })

  const [sttErrorVisible, setSttErrorVisible] = useState(false)
  useEffect(() => {
    if (sttError) {
      setSttErrorVisible(true)
      const t = setTimeout(() => setSttErrorVisible(false), 4000)
      return () => clearTimeout(t)
    }
  }, [sttError])

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="flex flex-col h-full min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Sub-header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background shrink-0">
        <SensoAvatar />
        <div className="flex-1 min-w-0">
          <h2 className="font-semibold text-sm truncate">
            {sessionName || "Il Mentore Saggio"}
          </h2>
          <p className="text-xs text-muted-foreground">Coach finanziario</p>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => void handleNewConversation()}
            title="Nuova conversazione"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Nuova</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            title="Conversazioni precedenti"
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">Storico</span>
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(loadingHistory || welcomeLoading) && (
          <div className="flex items-start gap-2">
            <SensoAvatar />
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-muted-foreground">
              <span className="animate-pulse">Il Mentore sta pensando...</span>
            </div>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="flex items-end gap-2 max-w-[90%]">
                <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm">
                  <p className="whitespace-pre-wrap">{msg.content}</p>
                </div>
                <UserAvatar user={user} size="sm" className="shrink-0 mb-0.5" />
              </div>
            ) : (
              <AssistantBubble msg={msg} />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <SensoAvatar />
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-muted-foreground">
              <span className="animate-pulse">Il Mentore sta pensando...</span>
            </div>
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20 shrink-0">
          <p className="text-sm text-destructive">{error.message}</p>
          {error.code === "profile_required" && (
            <button
              onClick={onNavigateBack}
              className="text-xs text-destructive underline mt-1"
            >
              Vai al profilo
            </button>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 shrink-0">
        <div className="flex gap-2 items-end">
          {isSttAvailable && (
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={isRecording ? "text-red-500 animate-pulse" : "text-muted-foreground"}
              onClick={isRecording ? stopRecording : startRecording}
              disabled={isLoading}
              aria-label={isRecording ? "Ferma registrazione" : "Inizia registrazione vocale"}
            >
              {isRecording ? <Square className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </Button>
          )}
          <textarea
            value={isRecording ? transcript : inputText}
            onChange={(e) => { if (!isRecording) setInputText(e.target.value) }}
            onKeyDown={handleKeyDown}
            disabled={isLoading || loadingHistory || isRecording}
            placeholder={locale === "en" ? "Ask your coach..." : "Chiedi al coach..."}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: "40px" }}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={isLoading || loadingHistory || isRecording || !inputText.trim()}
            size="sm"
            className="shrink-0"
          >
            {isLoading ? "..." : "Invia"}
          </Button>
        </div>
        {sttErrorVisible && sttError && (
          <p className="text-xs text-red-500 mt-1 px-1">{sttError}</p>
        )}
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Invio con Invio · A scopo educativo · Non è consulenza finanziaria
        </p>
      </div>

      {/* Conversations modal */}
      {showModal && (
        <ConversationsModal
          sessions={sessions}
          activeSessionId={sessionId}
          onOpen={(id) => void handleOpenSession(id)}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  )
}
