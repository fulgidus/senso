import { useState, useRef, useEffect, useCallback } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import { SHOW_REASONING, LLM_DEBUG } from "@/lib/config"
import { A2UISurface } from "@/components/A2UISurface"
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
  getPersonas,
  CoachingApiError,
  type CoachingResponse,
  type ReasoningStep,
  type ActionCard,
  type ResourceCard,
  type LearnCard,
  type AffordabilityVerdict,
  type DebugPayload,
  type SessionSummary,
  type SessionMessage,
} from "./coachingApi"
import { MessageCircle, PenLine, Trash2, Plus, X, Check, Mic, Square, Volume2, Loader2, ExternalLink } from "lucide-react"
import { useTTS, type TTSConfig } from "./useTTS"
import { useVoiceMode } from "./useVoiceMode"
import { VoiceModeBar } from "./VoiceModeBar"
import { MarpSlideViewer } from "./MarpSlideViewer"

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
  const { t } = useTranslation()
  if (!steps.length) return null
  return (
    <div className="mt-2 text-sm border border-muted rounded-md overflow-hidden">
      <button
        className="w-full flex items-center justify-between px-3 py-2 bg-muted/40 text-left font-medium text-muted-foreground hover:bg-muted/60 transition-colors"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        <span>{t("coaching.reasoningLabel")}</span>
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

// ── Action cards ──────────────────────────────────────────────────────────────

function LoanCalculatorCard({ card }: { card: ActionCard }) {
  const { t } = useTranslation()
  const payload = card.payload ?? {}
  const defaultAmount = Number(payload.amount ?? 5000)
  const defaultMonths = Number(payload.months ?? 24)
  const defaultTan = Number(payload.tan ?? 8)

  const [amount, setAmount] = useState(defaultAmount)
  const [months, setMonths] = useState(defaultMonths)
  const [tan, setTan] = useState(defaultTan)

  // French amortization: monthly payment = P * r / (1 - (1+r)^-n)
  const r = tan / 100 / 12
  const monthlyPayment =
    r === 0
      ? amount / months
      : (amount * r) / (1 - Math.pow(1 + r, -months))
  const totalRepayable = monthlyPayment * months
  const totalInterest = totalRepayable - amount

  return (
    <div className="border border-border rounded-xl bg-background overflow-hidden text-sm">
      <div className="px-3 py-2 bg-muted/50 font-semibold text-sm">{card.title}</div>
      <div className="px-3 py-3 space-y-3">
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t("calculator.amount")}</span>
            <span className="font-semibold text-foreground">€{amount.toLocaleString("it-IT")}</span>
          </div>
          <input
            type="range"
            min={500} max={50000} step={500}
            value={amount}
            onChange={(e) => setAmount(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t("calculator.months")}</span>
            <span className="font-semibold text-foreground">{months} mesi</span>
          </div>
          <input
            type="range"
            min={6} max={84} step={6}
            value={months}
            onChange={(e) => setMonths(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <div>
          <div className="flex justify-between text-xs text-muted-foreground mb-1">
            <span>{t("calculator.tan")}</span>
            <span className="font-semibold text-foreground">{tan.toFixed(1)}%</span>
          </div>
          <input
            type="range"
            min={1} max={24} step={0.5}
            value={tan}
            onChange={(e) => setTan(Number(e.target.value))}
            className="w-full accent-primary"
          />
        </div>
        <div className="border-t pt-2 space-y-1">
          <div className="flex justify-between font-semibold">
            <span>{t("calculator.monthlyPayment")}</span>
            <span className="text-primary">€{monthlyPayment.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("calculator.totalInterest")}</span>
            <span>€{totalInterest.toFixed(2)}</span>
          </div>
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>{t("calculator.totalRepayable")}</span>
            <span>€{totalRepayable.toFixed(2)}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function PartnerOfferCard({ card }: { card: ActionCard }) {
  const payload = card.payload ?? {}
  const funnelId = String(payload.funnel_id ?? "")
  const offerType = String(payload.offer_type ?? "")
  const partnerName = String(payload.partner_name ?? card.title)
  const ctaUrl = payload.cta_url ? String(payload.cta_url) : null

  const colorMap: Record<string, string> = {
    conto_corrente: "bg-blue-50 border-blue-200 dark:bg-blue-950/30 dark:border-blue-800",
    prestito: "bg-purple-50 border-purple-200 dark:bg-purple-950/30 dark:border-purple-800",
    investimento: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    assicurazione: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
  }
  const colorClass = colorMap[offerType] ?? "bg-muted/30 border-border"

  return (
    <div className={`border rounded-xl overflow-hidden text-sm ${colorClass}`}>
      <div className="px-3 py-2 flex items-center justify-between">
        <div>
          <div className="font-semibold">{partnerName}</div>
          <div className="text-xs text-muted-foreground mt-0.5">{card.description}</div>
        </div>
        <div className="h-8 w-8 rounded-full bg-background border flex items-center justify-center text-sm font-bold shrink-0 ml-2">
          {partnerName.charAt(0).toUpperCase()}
        </div>
      </div>
      {ctaUrl ? (
        <a
          href={ctaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-between px-3 py-2 bg-background/60 hover:bg-background/80 transition-colors font-medium text-xs text-primary border-t"
          data-funnel-id={funnelId}
        >
          <span>{card.cta_label ?? "Scopri l'offerta"}</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      ) : (
        <div className="px-3 py-2 bg-background/60 text-xs text-muted-foreground border-t">
          {card.cta_label ?? "Scopri l'offerta"}
        </div>
      )}
    </div>
  )
}

function GenericActionCard({ card }: { card: ActionCard }) {
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

function ActionCardRouter({ card }: { card: ActionCard }) {
  if (card.action_type === "calculator") return <LoanCalculatorCard card={card} />
  if (card.action_type === "funnel") return <PartnerOfferCard card={card} />
  return <GenericActionCard card={card} />
}

// ── Resource cards ────────────────────────────────────────────────────────────

function VideoCard({ card }: { card: ResourceCard }) {
  const [expanded, setExpanded] = useState(false)
  const videoId = card.video_id
  if (!videoId) return <ArticleCard card={card} />
  return (
    <div className="border border-border rounded-xl overflow-hidden text-sm bg-background">
      {expanded ? (
        <div className="aspect-video w-full">
          <iframe
            src={`https://www.youtube.com/embed/${videoId}?autoplay=1`}
            title={card.title}
            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
            allowFullScreen
            className="w-full h-full"
          />
        </div>
      ) : (
        <button
          onClick={() => setExpanded(true)}
          className="w-full relative aspect-video bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
          aria-label={`Riproduci: ${card.title}`}
        >
          <img
            src={`https://img.youtube.com/vi/${videoId}/mqdefault.jpg`}
            alt={card.title}
            className="absolute inset-0 w-full h-full object-cover opacity-80"
          />
          <span className="relative z-10 h-12 w-12 rounded-full bg-black/70 flex items-center justify-center">
            <svg viewBox="0 0 24 24" fill="white" className="h-6 w-6 ml-0.5">
              <path d="M8 5v14l11-7z" />
            </svg>
          </span>
        </button>
      )}
      <div className="px-3 py-2">
        <div className="font-semibold">{card.title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{card.summary}</div>
      </div>
    </div>
  )
}

function ArticleCard({ card }: { card: ResourceCard }) {
  const { t } = useTranslation()
  const inner = (
    <div className={`border border-border rounded-md px-3 py-2 bg-background text-sm ${card.url ? "hover:border-primary/50 transition-colors" : ""}`}>
      <div className="font-semibold">{card.title}</div>
      <div className="text-muted-foreground mt-0.5">{card.summary}</div>
      {card.estimated_read_minutes && (
        <span className="text-xs text-muted-foreground mt-1 block">
          {t("coaching.readingMinutes", { minutes: card.estimated_read_minutes })}
        </span>
      )}
      {card.url && (
        <span className="flex items-center gap-1 text-xs text-primary mt-1">
          <ExternalLink className="h-3 w-3" /> {t("coaching.readMore")}
        </span>
      )}
    </div>
  )
  if (card.url) {
    return (
      <a href={card.url} target="_blank" rel="noopener noreferrer">
        {inner}
      </a>
    )
  }
  return inner
}

function ResourceCardRouter({ card }: { card: ResourceCard }) {
  if (card.resource_type === "video") return <VideoCard card={card} />
  if (card.resource_type === "slide_deck" && card.slide_id) {
    return <MarpSlideViewer slideId={card.slide_id} title={card.title} />
  }
  return <ArticleCard card={card} />
}

function LearnCardStub({ card }: { card: LearnCard }) {
  const { t } = useTranslation()
  return (
    <div className="border border-blue-200 rounded-md px-3 py-2 bg-blue-50 text-sm">
      <div className="font-semibold text-blue-800">{card.concept}</div>
      <div className="text-blue-700 mt-0.5">{card.plain_explanation}</div>
      {card.example && (
        <div className="text-blue-600 text-xs mt-1 italic">{t("coaching.examplePrefix")} {card.example}</div>
      )}
    </div>
  )
}

function AffordabilityVerdictCard({ verdict }: { verdict: AffordabilityVerdict }) {
  const { t } = useTranslation()
  const verdictConfig = {
    yes: {
      label: t("coaching.verdictYes"),
      bg: "bg-green-50 dark:bg-green-950/30",
      border: "border-green-300 dark:border-green-700",
      badge: "bg-green-100 dark:bg-green-900 text-green-800 dark:text-green-200",
      icon: "✓",
    },
    no: {
      label: t("coaching.verdictNo"),
      bg: "bg-red-50 dark:bg-red-950/30",
      border: "border-red-300 dark:border-red-700",
      badge: "bg-red-100 dark:bg-red-900 text-red-800 dark:text-red-200",
      icon: "✗",
    },
    conditional: {
      label: t("coaching.verdictConditional"),
      bg: "bg-amber-50 dark:bg-amber-950/30",
      border: "border-amber-300 dark:border-amber-700",
      badge: "bg-amber-100 dark:bg-amber-900 text-amber-800 dark:text-amber-200",
      icon: "~",
    },
  }
  const cfg = verdictConfig[verdict.verdict]
  return (
    <div className={`mt-2 rounded-xl border ${cfg.border} ${cfg.bg} overflow-hidden`}>
      <div className={`px-3 py-2 flex items-center gap-2 ${cfg.badge}`}>
        <span className="font-bold text-base leading-none">{cfg.icon}</span>
        <span className="font-semibold text-sm">{cfg.label}</span>
      </div>
      {verdict.key_figures.length > 0 && (
        <div className="px-3 py-2 space-y-1">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1.5">
            {t("coaching.verdictKeyFigures")}
          </p>
          {verdict.key_figures.map((kf, i) => (
            <div key={i} className="flex justify-between items-baseline gap-2 text-sm">
              <span className="text-muted-foreground">{kf.label}</span>
              <span className="font-semibold tabular-nums">{kf.value}</span>
            </div>
          ))}
        </div>
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
      <p className="text-xs font-bold text-yellow-700 font-mono">DEBUG - LLM_DEBUG=true</p>
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

function VoicePlayButton({
  text,
  locale,
  ttsConfig,
}: {
  text: string
  locale: "it" | "en"
  ttsConfig: TTSConfig
}) {
  const { t } = useTranslation()
  const { canPlay, isPlaying, isGenerating, usingFallback, play, stop } = useTTS(ttsConfig)
  if (!canPlay) return null
  const busy = isGenerating || isPlaying
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      className="h-6 w-6 text-muted-foreground hover:text-foreground"
      onClick={() => (busy ? stop() : void play(text, locale))}
      disabled={isGenerating && !isPlaying}
      aria-label={isGenerating ? t("coaching.ttsGenerating") : isPlaying ? t("coaching.ttsPlaying") : t("coaching.ttsPlay")}
      title={
        usingFallback ? t("coaching.ttsFallbackActive") :
        isGenerating ? t("coaching.ttsGeneratingShort") :
        isPlaying ? t("coaching.ttsPlayingShort") :
        t("coaching.ttsPlayShort")
      }
    >
      {isGenerating ? (
        <Loader2 className="h-3 w-3 animate-spin" />
      ) : isPlaying ? (
        <Square className="h-3 w-3" />
      ) : (
        <Volume2 className="h-3 w-3" />
      )}
    </Button>
  )
}

function AssistantBubble({
  msg,
  locale,
  ttsConfig,
}: {
  msg: DisplayMessage
  locale: "it" | "en"
  ttsConfig: TTSConfig
}) {
  const resp = msg.response
  return (
    <div className="flex items-start gap-2 max-w-[90%]">
      <SensoAvatar />
      <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex-1 min-w-0">
        <p className="whitespace-pre-wrap">{msg.content}</p>
        <div className="flex justify-end mt-1">
          <VoicePlayButton text={msg.content} locale={locale} ttsConfig={ttsConfig} />
        </div>
        {resp && (
          <>
            {SHOW_REASONING && <ReasoningCard steps={resp.reasoning_used} />}
            {resp.action_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.action_cards.map((c, i) => <ActionCardRouter key={i} card={c} />)}
              </div>
            )}
            {resp.resource_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.resource_cards.map((c, i) => <ResourceCardRouter key={i} card={c} />)}
              </div>
            )}
            {resp.learn_cards.length > 0 && (
              <div className="mt-2 flex flex-col gap-2">
                {resp.learn_cards.map((c, i) => <LearnCardStub key={i} card={c} />)}
              </div>
            )}
            {resp.affordability_verdict && (
              <AffordabilityVerdictCard verdict={resp.affordability_verdict} />
            )}
            {resp.details_a2ui && (
              <div className="mt-2">
                <A2UISurface
                  jsonl={resp.details_a2ui}
                  onAction={(action) => {
                    // Dispatch to the page so other components (calculator, funnel) can react
                    window.dispatchEvent(new CustomEvent("senso:a2ui-action", { detail: { action } }))
                  }}
                />
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

function getErrorMessage(code: string, t: (key: string) => string): string {
  const map: Record<string, string> = {
    input_rejected: t("coaching.errorInputRejected"),
    profile_required: t("coaching.errorProfileRequired"),
    llm_error: t("coaching.errorLlm"),
    network_error: t("coaching.errorNetwork"),
    unauthenticated: t("coaching.errorUnauthenticated"),
  }
  return map[code] ?? t("coaching.errorGeneric")
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
  const { t } = useTranslation()
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
          <h2 className="font-semibold text-sm">{t("coaching.modalTitle")}</h2>
          <button
            onClick={onClose}
            className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label={t("coaching.modalClose")}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="overflow-y-auto flex-1">
          {sessions.length === 0 ? (
            <p className="px-4 py-6 text-sm text-muted-foreground text-center">
              {t("coaching.modalEmpty")}
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
                        aria-label={t("coaching.modalSaveName")}
                      >
                        <Check className="h-4 w-4" />
                      </button>
                    ) : (
                      <button
                        onClick={() => startEdit(s)}
                        className="rounded p-1 text-muted-foreground hover:text-foreground hover:bg-accent opacity-0 group-hover:opacity-100 transition-all"
                        aria-label={t("coaching.modalRename")}
                      >
                        <PenLine className="h-4 w-4" />
                      </button>
                    )}
                    <button
                      onClick={() => void handleDelete(s.id)}
                      disabled={busyId === s.id}
                      className="rounded p-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10 opacity-0 group-hover:opacity-100 disabled:opacity-40 transition-all"
                      aria-label={t("coaching.modalDelete")}
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
  const { t } = useTranslation()

  // Resolve which gender key to use for translated strings:
  // user preference wins unless "indifferent", then fall back to persona default.
  const [personaDefaultGender, setPersonaDefaultGender] = useState<"masculine" | "feminine" | "neutral">("masculine")
  const [personaName, setPersonaName] = useState<string>("Mentore Saggio")

  const effectiveGender: "masculine" | "feminine" | "neutral" = (
    user.voiceGender && user.voiceGender !== "indifferent"
      ? user.voiceGender as "masculine" | "feminine" | "neutral"
      : personaDefaultGender
  )

  // Session state
  const [sessionId, setSessionId] = useState<string | undefined>(undefined)
  const [sessionName, setSessionName] = useState<string>("")
  const [sessions, setSessions] = useState<SessionSummary[]>([])
  const [showModal, setShowModal] = useState(false)

  // TTS config (from active persona)
  const DEFAULT_TTS_CONFIG: TTSConfig = { fallback: "browser", browserFallbackEnabled: true }
  const [ttsConfig, setTtsConfig] = useState<TTSConfig>(DEFAULT_TTS_CONFIG)

  // Message state
  const [messages, setMessages] = useState<DisplayMessage[]>([])
  const [inputText, setInputText] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(true)
  const [welcomeLoading, setWelcomeLoading] = useState(false)
  const [error, setError] = useState<{ code: string; message: string } | null>(null)
  const lastUserMessageRef = useRef<string>("")

  const listEndRef = useRef<HTMLDivElement>(null)
  const namingInFlight = useRef(false)
  // Ref to break the circular dep: handleSend → onAssistantMessage ← useVoiceMode → handleSend
  const onAssistantMessageRef = useRef<(text: string) => void>(() => {})
  // Track auto-dismiss timer so it can be cleared on new error
  const errorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Wrapper that auto-dismisses transient errors after 8 seconds.
  // profile_required errors are kept persistent (they have a navigation CTA).
  const setErrorWithAutoDismiss = useCallback((err: { code: string; message: string } | null) => {
    if (errorDismissTimerRef.current) {
      clearTimeout(errorDismissTimerRef.current)
      errorDismissTimerRef.current = null
    }
    setError(err)
    if (err && err.code !== "profile_required") {
      errorDismissTimerRef.current = setTimeout(() => setError(null), 8000)
    }
  }, [])

  // ── Load sessions list + restore last ──────────────────────────────────────

  const fetchSessions = useCallback(async () => {
    try {
      const list = await listSessions()
      setSessions(list)
      return list
    } catch (err) {
      if (err instanceof CoachingApiError) {
        setErrorWithAutoDismiss({ code: err.code, message: getErrorMessage(err.code, t) })
      } else {
        setErrorWithAutoDismiss({ code: "network_error", message: getErrorMessage("network_error", t) })
      }
      return []
    }
  }, [setErrorWithAutoDismiss])

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
      // Fetch personas to get TTS config (best-effort; default used on failure)
      try {
        const personas = await getPersonas()
        const active = personas.find((p) => p.id === "mentore-saggio") ?? personas[0]
        if (active?.tts) {
          setTtsConfig({
            fallback: active.tts.fallback,
            browserFallbackEnabled: active.tts.browser_fallback_enabled,
          })
        }
        if (active?.defaultGender) setPersonaDefaultGender(active.defaultGender)
        if (active?.name) setPersonaName(active.name)
      } catch { /* non-fatal - use DEFAULT_TTS_CONFIG */ }

      const list = await fetchSessions()
      if (list.length > 0) {
        const last = list[0] // newest = index 0 (sorted by updated_at desc)
        setSessionId(last.id)
        setSessionName(last.name)
        await loadSessionHistory(last.id)
      } else {
        // No sessions yet - show welcome, session will be created on first send
        setLoadingHistory(false)
        setWelcomeLoading(true)
        try {
          const msg = await getWelcomeMessage(locale)
          setMessages([{ role: "assistant", content: msg, isWelcome: true }])
        } catch {
          const fallback =
            locale === "en"
              ? t(`coaching.fallbackWelcome.${effectiveGender}`, { name: personaName })
              : t(`coaching.fallbackWelcome.${effectiveGender}`, { name: personaName })
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
          ? t(`coaching.fallbackWelcome.${effectiveGender}`, { name: personaName })
          : t(`coaching.fallbackWelcome.${effectiveGender}`, { name: personaName })
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
    lastUserMessageRef.current = trimmed
    const userMsg: DisplayMessage = { role: "user", content: trimmed }
    setMessages((prev) => [...prev, userMsg])
    setInputText("")
    setIsLoading(true)

    const isFirstUserMessage = !sessionId

    // 35s client-side timeout — well below the backend's 60s LLM timeout.
    // If the backend hits its timeout first, we get a 502 error; if the connection
    // hangs (network issue), the frontend recovers and shows a Retry button.
    const timeoutId = setTimeout(() => {
      setIsLoading(false)
      setErrorWithAutoDismiss({ code: "network_error", message: getErrorMessage("network_error", t) })
    }, 35000)

    try {
      const response = await sendMessage(trimmed, locale, "mentore-saggio", sessionId)
      clearTimeout(timeoutId)
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
      // In voice mode, auto-play TTS for the reply
      onAssistantMessageRef.current(response.message)
    } catch (err) {
      clearTimeout(timeoutId)
      if (err instanceof CoachingApiError) {
        setErrorWithAutoDismiss({ code: err.code, message: getErrorMessage(err.code, t) })
      } else {
        setErrorWithAutoDismiss({ code: "network_error", message: getErrorMessage("network_error", t) })
      }
    } finally {
      setIsLoading(false)
    }
  }, [inputText, isLoading, sessionId, locale, fetchSessions, setErrorWithAutoDismiss])

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      void handleSend()
    }
  }

  // ── Voice mode ──────────────────────────────────────────────────────────────

  const voiceAutoListen = user.voiceAutoListen ?? false

  const {
    isVoiceMode,
    toggleVoiceMode,
    isRecording,
    transcript,
    isSttAvailable,
    sttError,
    isGenerating: voiceIsGenerating,
    isPlaying: voiceIsPlaying,
    isAutoListening,
    stopTTS,
    onMicPointerDown,
    onMicPointerUp,
    onAssistantMessage,
  } = useVoiceMode({
    locale,
    ttsConfig,
    voiceAutoListen,
    onSend: handleSend,
  })
  // Keep ref in sync so handleSend can call it without a circular hook dep
  onAssistantMessageRef.current = onAssistantMessage

  const [sttErrorVisible, setSttErrorVisible] = useState(false)
  useEffect(() => {
    if (sttError) {
      setSttErrorVisible(true)
      const timer = setTimeout(() => setSttErrorVisible(false), 4000)
      return () => clearTimeout(timer)
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
            {sessionName || t("coaching.newConversation")}
          </h2>
          <p className="text-xs text-muted-foreground">{t("coaching.coachTitle")}</p>
        </div>
        {/* Action buttons */}
        <div className="flex items-center gap-1 shrink-0">
          <button
            onClick={() => void handleNewConversation()}
            title={t("coaching.newConversation")}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">{t("coaching.newConversationShort")}</span>
          </button>
          <button
            onClick={() => setShowModal(true)}
            title={t("coaching.history")}
            className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
          >
            <MessageCircle className="h-4 w-4" />
            <span className="hidden sm:inline">{t("coaching.history")}</span>
          </button>
        </div>
      </div>

      {/* Message list */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-4">
        {(loadingHistory || welcomeLoading) && (
          <div className="flex items-start gap-2">
            <SensoAvatar />
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm text-muted-foreground">
              <span className="animate-pulse">{t(`coaching.thinking.${effectiveGender}`, { name: personaName })}</span>
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
              <AssistantBubble msg={msg} locale={locale} ttsConfig={ttsConfig} />
            )}
          </div>
        ))}

        {isLoading && (
          <div className="flex items-start gap-2">
            <SensoAvatar />
            <div className="bg-muted rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex-1 min-w-0 max-w-[90%] space-y-2">
              {/* Thinking label */}
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                  <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                </span>
                <span className="text-xs">{t(`coaching.thinking.${effectiveGender}`, { name: personaName })}</span>
              </div>
              {/* Skeleton lines — simulate response text */}
              <div className="space-y-1.5 pt-1">
                <div className="h-3 bg-muted-foreground/20 rounded animate-pulse w-full" />
                <div className="h-3 bg-muted-foreground/20 rounded animate-pulse w-[85%]" />
                <div className="h-3 bg-muted-foreground/20 rounded animate-pulse w-[70%]" />
              </div>
              {/* Skeleton card placeholder — signals cards are coming */}
              <div className="mt-2 h-16 bg-muted-foreground/10 rounded-xl animate-pulse border border-muted-foreground/10" />
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
              {t("coaching.goToProfile")}
            </button>
          )}
          {(error.code === "llm_error" || error.code === "network_error") && lastUserMessageRef.current && (
            <button
              onClick={() => {
                setError(null)
                void handleSend(lastUserMessageRef.current)
              }}
              className="text-xs text-destructive underline mt-1"
            >
              {t("coaching.retryLastMessage")}
            </button>
          )}
        </div>
      )}

      {/* Input area */}
      <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 shrink-0">
        {isVoiceMode ? (
          <VoiceModeBar
            isRecording={isRecording}
            isGenerating={voiceIsGenerating}
            isPlaying={voiceIsPlaying}
            isAutoListening={isAutoListening}
            transcript={transcript}
            isSttAvailable={isSttAvailable}
            onMicPointerDown={onMicPointerDown}
            onMicPointerUp={onMicPointerUp}
            onStopTTS={stopTTS}
            onExitVoiceMode={() => void toggleVoiceMode()}
            disabled={isLoading || loadingHistory}
          />
        ) : (
          <>
            <div className="flex gap-2 items-end">
              {isSttAvailable && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className={isVoiceMode ? "text-primary" : "text-muted-foreground"}
                  onClick={() => void toggleVoiceMode()}
                  disabled={isLoading}
                  aria-label={t("coaching.voiceModeActivate")}
                  title={t("coaching.voiceModeActivate")}
                >
                  <Mic className="h-4 w-4" />
                </Button>
              )}
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                onKeyDown={handleKeyDown}
                disabled={isLoading || loadingHistory}
                placeholder={t("coaching.placeholder")}
                rows={1}
                className="flex-1 resize-none rounded-xl border border-input bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring disabled:opacity-50 max-h-32 overflow-y-auto"
                style={{ minHeight: "40px" }}
              />
              <Button
                onClick={() => void handleSend()}
                disabled={isLoading || loadingHistory || !inputText.trim()}
                size="sm"
                className="shrink-0"
              >
                {isLoading ? t("coaching.sendingButton") : t("coaching.sendButton")}
              </Button>
            </div>
            {sttErrorVisible && sttError && (
              <p className="text-xs text-red-500 mt-1 px-1">{sttError}</p>
            )}
          </>
        )}
        <p className="text-xs text-muted-foreground mt-1 text-center">
          {t("coaching.disclaimer")}
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
