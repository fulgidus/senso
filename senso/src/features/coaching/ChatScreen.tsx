import { useState, useRef, useEffect } from "react"
import { Button } from "@/components/ui/button"
import {
  sendMessage,
  CoachingApiError,
  type CoachingResponse,
  type ReasoningStep,
  type ActionCard,
  type ResourceCard,
  type LearnCard,
} from "./coachingApi"

interface ChatScreenProps {
  onNavigateBack: () => void
  locale?: "it" | "en"
}

interface DisplayMessage {
  role: "user" | "assistant"
  content: string
  response?: CoachingResponse
}

// ──────────────────────────────────────────────
// Sub-components
// ──────────────────────────────────────────────

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

function AssistantBubble({ msg }: { msg: DisplayMessage }) {
  const resp = msg.response
  return (
    <div className="flex flex-col items-start max-w-[85%]">
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm">
        <p className="whitespace-pre-wrap">{msg.content}</p>
        {resp && (
          <>
            <ReasoningCard steps={resp.reasoning_used} />
            {resp.action_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.action_cards.map((c, i) => (
                  <ActionCardStub key={i} card={c} />
                ))}
              </div>
            )}
            {resp.resource_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.resource_cards.map((c, i) => (
                  <ResourceCardStub key={i} card={c} />
                ))}
              </div>
            )}
            {resp.learn_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.learn_cards.map((c, i) => (
                  <LearnCardStub key={i} card={c} />
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}

// ──────────────────────────────────────────────
// Error message map
// ──────────────────────────────────────────────

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

// ──────────────────────────────────────────────
// ChatScreen
// ──────────────────────────────────────────────

export function ChatScreen({ onNavigateBack, locale = "it" }: ChatScreenProps) {
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const listEndRef = useRef<HTMLDivElement>(null)

  // Auto-scroll to bottom on new message
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: "smooth" })
  }, [messages, isLoading])

  const handleSend = async () => {
    const trimmed = inputText.trim()
    if (!trimmed || isLoading) return

    setError(null)
    const userMsg: DisplayMessage = { role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInputText("")
    setIsLoading(true)

    try {
      const response = await sendMessage(trimmed, locale, "mentore-saggio", sessionId)
      // Persist session_id for subsequent messages
      if (response.session_id) {
        setSessionId(response.session_id)
      }
      const assistantMsg: DisplayMessage = {
        role: "assistant",
        content: response.message,
        response,
      }
      setMessages((prev) => [...prev, assistantMsg])
    } catch (err) {
      if (err instanceof CoachingApiError) {
        setError({ code: err.code, message: getErrorMessage(err.code) })
      } else {
        setError({ code: "network_error", message: getErrorMessage("network_error") })
      }
    } finally {
      setIsLoading(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] bg-background">
      {/* Sub-header */}
      <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background">
        <div className="flex-1">
          <h2 className="font-semibold text-sm">Il Mentore Saggio</h2>
          <p className="text-xs text-muted-foreground">Coach finanziario</p>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {messages.length === 0 && !isLoading && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <p className="text-2xl mb-2">🦉</p>
            <p className="font-medium">Ciao! Sono il tuo Mentore Saggio.</p>
            <p className="text-sm mt-1 max-w-xs">
              Chiedimi qualcosa sul tuo budget, sulle tue spese, o se puoi permetterti qualcosa.
            </p>
          </div>
        )}

        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            {msg.role === "user" ? (
              <div className="bg-primary text-primary-foreground rounded-2xl rounded-tr-sm px-4 py-3 text-sm max-w-[85%]">
                <p className="whitespace-pre-wrap">{msg.content}</p>
              </div>
            ) : (
              <AssistantBubble msg={msg} />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex justify-start">
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-muted-foreground">
              <span className="animate-pulse">Il Mentore sta pensando...</span>
            </div>
          </div>
        )}

        <div ref={listEndRef} />
      </div>

      {/* Error message */}
      {error && (
        <div className="px-4 py-2 bg-destructive/10 border-t border-destructive/20">
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
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3">
        <div className="flex gap-2 items-end">
          <textarea
            value={inputText}
            onChange={(e) => setInputText(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            placeholder={locale === "en" ? "Ask your coach..." : "Chiedi al coach..."}
            rows={1}
            className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-32 overflow-y-auto"
            style={{ minHeight: "40px" }}
          />
          <Button
            onClick={() => void handleSend()}
            disabled={isLoading || !inputText.trim()}
            size="sm"
            className="shrink-0"
          >
            {isLoading ? "..." : "Invia"}
          </Button>
        </div>
        <p className="text-xs text-muted-foreground mt-1 text-center">
          Invio con Invio · A scopo educativo · Non è consulenza finanziaria
        </p>
      </div>
    </div>
  )
}
