import { useState, useRef, useEffect, useCallback, useMemo } from "react"
import { useTranslation } from "react-i18next"
import { useLocaleFormat } from "@/hooks/useLocaleFormat"
import { useHapticFeedback } from "@/hooks/useHapticFeedback"
import { Button } from "@/components/ui/button"
import { SHOW_REASONING, LLM_DEBUG } from "@/lib/config"
import { A2UISurface } from "@/components/A2UISurface"
import { useAuthContext } from "@/features/auth/AuthContext"
import { useTheme } from "@/components/theme-provider"
import { UserAvatar } from "@/components/UserAvatar"
import {
    sendMessage,
    sendMessageStream,
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
    type ContentCard,
    type InteractiveCard,
    type TransactionEvidence,
    type GoalProgress,
    type AffordabilityVerdict,
    type DebugPayload,
    type Persona,
    type SessionSummary,
    type SessionMessage,
} from "./coachingApi"
import { MessageCircle, PenLine, Trash2, Plus, X, Check, Mic, Square, Volume2, Loader2, ExternalLink, ChevronDown, RotateCcw, ShieldCheck, ShieldOff, Bell, BookOpen, BarChart3, Settings as SettingsIcon, Brain, Scale, Calendar, Search, Lightbulb, Presentation } from "lucide-react"
import { useTTS, type TTSConfig } from "./useTTS"
import { useVoiceMode } from "./useVoiceMode"
import { VoiceModeBar } from "./VoiceModeBar"
import { MarpSlideViewer } from "./MarpSlideViewer"


interface ChatScreenProps {
    onNavigateBack: () => void
    locale?: "it" | "en"
    /** If set, pre-fills the input with a contextual message about this content slug. */
    initialTopic?: string
    /** If set, load this specific session on mount instead of auto-restoring the last one. */
    sessionId?: string
    /** Called when a new session is created (first message sent from /chat/new).
     *  The route wrapper uses this to replace the URL to /chat/{id}. */
    onSessionCreated?: (id: string) => void
    /** When true, always start a fresh conversation even if prior sessions exist.
     *  Used by the /chat/new route to prevent auto-restore. */
    forceNew?: boolean
}

interface DisplayMessage {
    role: "user" | "assistant"
    content: string
    response?: CoachingResponse
    isWelcome?: boolean
    isStreaming?: boolean
    personaId?: string | null
    showPersonaCue?: boolean
    status?: "sent" | "failed"
}

type RestoreToastState = {
    visible: boolean
    text: string
}

type PersonaThemeMode = {
    avatar_bg: string
    bubble_bg: string
    bubble_border: string
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

// ── Phase 21: New rendering components ────────────────────────────────────────

const TOOL_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
    search_user_transactions: Search,
    get_user_profile: BarChart3,
    search_content: BookOpen,
    get_user_preferences: SettingsIcon,
    recall_past_insights: Brain,
    search_regional_knowledge: Scale,
    get_timeline_events: Calendar,
    _grouped: Loader2,
}

function ToolUsagePill({ toolName }: { toolName: string }) {
    const { t } = useTranslation()
    const IconComponent = TOOL_ICONS[toolName] ?? Search
    const label = t(`coaching.toolUsage.${toolName}`, toolName)

    return (
        <div className="flex justify-start px-4 py-0.5">
            <div className="inline-flex items-center gap-2 px-2 py-1 rounded-full">
                <IconComponent className="h-4 w-4 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">{label}</span>
            </div>
        </div>
    )
}

function TransactionEvidenceTable({ evidence }: { evidence: TransactionEvidence }) {
    const { t } = useTranslation()
    const fmt = useLocaleFormat()

    return (
        <div className="mt-3 rounded-lg border border-border overflow-hidden">
            <div className="px-3 py-2 text-xs font-semibold text-muted-foreground">
                {t("coaching.evidence.title")}
            </div>
            <div className="hidden sm:block">
                <table className="w-full">
                    <thead>
                        <tr className="bg-muted text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                            <th className="px-3 py-2 text-left">{t("coaching.evidence.date")}</th>
                            <th className="px-3 py-2 text-left">{t("coaching.evidence.description")}</th>
                            <th className="px-3 py-2 text-right">{t("coaching.evidence.amount")}</th>
                        </tr>
                    </thead>
                    <tbody>
                        {evidence.transactions.map((tx, i) => (
                            <tr key={i} className="border-t border-border">
                                <td className="px-3 py-2 text-sm">{tx.date ?? "—"}</td>
                                <td className="px-3 py-2 text-sm">{tx.description}</td>
                                <td className="px-3 py-2 text-sm font-semibold tabular-nums text-right">
                                    {fmt.currency(tx.amount)}
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <div className="sm:hidden space-y-2 p-2">
                {evidence.transactions.map((tx, i) => (
                    <div key={i} className="bg-card rounded-lg border border-border p-3 space-y-1">
                        <div className="text-sm font-semibold">{tx.description}</div>
                        <div className="flex justify-between text-sm text-muted-foreground">
                            <span>{tx.date ?? "—"}</span>
                            <span className="font-semibold tabular-nums">{fmt.currency(tx.amount)}</span>
                        </div>
                    </div>
                ))}
            </div>
        </div>
    )
}

function GoalProgressBar({ progress }: { progress: GoalProgress }) {
    return (
        <div className="mt-3 rounded-lg border border-border p-3">
            <div className="flex items-center gap-2">
                <span>🎯</span>
                <span className="text-sm font-semibold text-foreground">{progress.goal_name}</span>
            </div>
            <div className="flex items-center gap-2 mt-2">
                <div className="flex-1 bg-muted rounded-full h-2">
                    <div
                        className="bg-primary rounded-full h-2 transition-all"
                        style={{ width: `${Math.min(100, Math.max(0, progress.estimated_pct))}%` }}
                    />
                </div>
                <span className="text-sm font-semibold text-foreground">~{progress.estimated_pct}%</span>
            </div>
            <p className="text-xs text-muted-foreground mt-1">{progress.subtitle}</p>
        </div>
    )
}

function ContentCardStrip({ cards }: { cards: ContentCard[] }) {
    const { t } = useTranslation()
    if (cards.length === 0) return null

    return (
        <div className="mt-3 flex gap-2 overflow-x-auto pb-1 -mx-1 px-1 snap-x snap-mandatory">
            {cards.map((card, i) => (
                <ContentCardItem key={i} card={card} />
            ))}
        </div>
    )
}

function ContentCardItem({ card }: { card: ContentCard }) {
    const { t } = useTranslation()
    const [videoExpanded, setVideoExpanded] = useState(false)
    const typeLabel = t(`coaching.cardType.${card.card_type}`, card.card_type)

    // Video card with expandable player
    if (card.card_type === "video" && card.video_id) {
        return (
            <div className="snap-start shrink-0 w-64 border border-border rounded-lg overflow-hidden bg-card">
                {videoExpanded ? (
                    <div className="aspect-video w-full">
                        <iframe
                            src={`https://www.youtube.com/embed/${card.video_id}?autoplay=1`}
                            title={card.title}
                            allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                            allowFullScreen
                            className="w-full h-full"
                        />
                    </div>
                ) : (
                    <button
                        onClick={() => setVideoExpanded(true)}
                        className="w-full relative aspect-video bg-muted flex items-center justify-center hover:bg-muted/80 transition-colors"
                    >
                        <img
                            src={`https://img.youtube.com/vi/${card.video_id}/mqdefault.jpg`}
                            alt={card.title}
                            className="absolute inset-0 w-full h-full object-cover opacity-80"
                        />
                        <span className="relative z-10 h-10 w-10 rounded-full bg-black/70 flex items-center justify-center">
                            <svg viewBox="0 0 24 24" fill="white" className="h-5 w-5 ml-0.5"><path d="M8 5v14l11-7z" /></svg>
                        </span>
                    </button>
                )}
                <div className="px-3 py-2">
                    <p className="text-sm font-semibold line-clamp-2">{card.title}</p>
                    {card.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{card.summary}</p>}
                </div>
            </div>
        )
    }

    // Slide deck card
    if (card.card_type === "slide_deck" && card.slide_id) {
        return <MarpSlideViewer slideId={card.slide_id} title={card.title} />
    }

    // Learn card (microlearning)
    if (card.card_type === "learn") {
        return (
            <div className="snap-start shrink-0 w-56 border border-primary/30 rounded-lg overflow-hidden bg-primary/5">
                <div className="px-3 py-2 flex items-center gap-1.5 text-xs text-primary bg-primary/10">
                    <Lightbulb className="h-3 w-3" />
                    <span>{typeLabel}</span>
                </div>
                <div className="px-3 py-2">
                    <p className="text-sm font-semibold line-clamp-2">{card.concept ?? card.title}</p>
                    <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{card.plain_explanation ?? card.summary}</p>
                    {card.example && <p className="text-xs text-muted-foreground italic mt-1 line-clamp-2">{card.example}</p>}
                </div>
            </div>
        )
    }

    // Article / partner_offer - clickable cards
    const isClickable = !!card.url
    const inner = (
        <div className={`snap-start shrink-0 w-56 border border-border rounded-lg overflow-hidden bg-card ${isClickable ? "hover:border-primary/30 transition-colors" : ""}`}>
            <div className="px-3 py-2 flex items-center gap-1.5 text-xs text-muted-foreground bg-muted/50">
                <BookOpen className="h-3 w-3" />
                <span>{typeLabel}</span>
            </div>
            <div className="px-3 py-2">
                <p className="text-sm font-semibold line-clamp-2">{card.title}</p>
                {card.summary && <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">{card.summary}</p>}
                {isClickable && (
                    <span className="flex items-center gap-1 text-xs text-primary mt-1">
                        <ExternalLink className="h-3 w-3" /> {t("coaching.readMore")}
                    </span>
                )}
            </div>
        </div>
    )

    if (isClickable) {
        return <a href={card.url!} target="_blank" rel="noopener noreferrer">{inner}</a>
    }
    return inner
}

function InteractiveCardComponent({ card }: { card: InteractiveCard }) {
    const { t } = useTranslation()
    return (
        <div className="mt-3 bg-primary/10 border border-primary/20 rounded-lg p-3 flex items-start gap-3">
            <Bell className="h-5 w-5 text-primary shrink-0 mt-0.5" />
            <div className="flex-1">
                <p className="text-sm font-semibold">{card.title}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.description}</p>
            </div>
            <Button size="sm" variant="outline">
                {card.cta_label ?? t("coaching.reminder.defaultCta")}
            </Button>
        </div>
    )
}

function DetailsToggle({ a2ui }: { a2ui: string }) {
    const [expanded, setExpanded] = useState(false)
    const { t } = useTranslation()

    return (
        <div className="mt-2">
            <button
                onClick={() => setExpanded(!expanded)}
                className="text-sm text-muted-foreground flex items-center gap-1"
            >
                {expanded ? t("coaching.hideDetails") : t("coaching.showDetails")}
                <ChevronDown className={`h-3 w-3 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
            {expanded && (
                <div className="mt-2">
                    <A2UISurface
                        jsonl={a2ui}
                        onAction={(action) => {
                            window.dispatchEvent(new CustomEvent("senso:a2ui-action", { detail: { action } }))
                        }}
                    />
                </div>
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

function RestoreToast({ text }: { text: string }) {
    return (
        <div className="px-4 pt-3" role="status" aria-live="polite">
            <div className="mx-auto w-fit max-w-full rounded-full border border-primary/30 bg-card px-3 py-2 text-xs text-muted-foreground shadow-sm">
                {text}
            </div>
        </div>
    )
}

function PersonaSwitcher({
    personas,
    activePersonaId,
    onSelect,
    onClose,
    resolvedTheme,
}: {
    personas: Persona[]
    activePersonaId: string
    onSelect: (personaId: string) => void
    onClose: () => void
    resolvedTheme: "light" | "dark"
}) {
    const { t } = useTranslation()

    return (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
            <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} aria-hidden />
            <div className="relative z-10 w-full sm:max-w-md rounded-t-2xl sm:rounded-2xl border border-border bg-background shadow-xl max-h-[80vh] overflow-y-auto">
                <div className="flex items-center justify-between px-4 py-3 border-b border-border">
                    <h2 className="text-base font-semibold text-foreground">{t("coaching.personaPickerTitle")}</h2>
                    <button
                        onClick={onClose}
                        className="rounded-md p-1 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
                        aria-label={t("coaching.modalClose")}
                    >
                        <X className="h-4 w-4" />
                    </button>
                </div>
                <div className="p-4 space-y-2">
                    {personas.filter((persona) => persona.available).map((persona) => {
                        const selected = persona.id === activePersonaId
                        const theme = getPersonaTheme(persona, resolvedTheme)
                        return (
                            <button
                                key={persona.id}
                                type="button"
                                onClick={() => {
                                    onSelect(persona.id)
                                    onClose()
                                }}
                                className="w-full min-h-12 rounded-xl border px-3 py-3 text-left transition-colors focus:outline-none focus:ring-2 focus:ring-primary"
                                style={{
                                    borderColor: selected ? theme?.bubble_border ?? "var(--primary)" : undefined,
                                    backgroundColor: selected ? theme?.bubble_bg ?? undefined : undefined,
                                }}
                            >
                                <div className="flex items-start gap-3">
                                    <div
                                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base"
                                        style={{ backgroundColor: theme?.avatar_bg }}
                                    >
                                        {persona.icon}
                                    </div>
                                    <div className="min-w-0 flex-1">
                                        <div className="flex items-center justify-between gap-2">
                                            <span className="text-sm font-medium text-foreground">{persona.name}</span>
                                            {selected && <Check className="h-4 w-4 text-primary shrink-0" />}
                                        </div>
                                        <p className="mt-0.5 text-xs text-muted-foreground">{persona.description}</p>
                                    </div>
                                </div>
                            </button>
                        )
                    })}
                </div>
            </div>
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
    const { canPlay, isPlaying, isGenerating, hasFallenBack, play, stop } = useTTS(ttsConfig)
    if (!canPlay) return null
    const busy = isGenerating || isPlaying
    // hasFallenBack persists once ElevenLabs has failed at least once, or is
    // pre-set on browsers without SpeechRecognition (Firefox/Librewolf).
    // Use it for the badge so it stays visible between plays (usingFallback is
    // only true during active fallback playback).
    const showFallbackBadge = hasFallenBack
    return (
        <div className="relative inline-flex items-center">
            <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-6 w-6 text-muted-foreground hover:text-foreground"
                onClick={() => (busy ? stop() : void play(text, locale))}
                disabled={isGenerating && !isPlaying}
                aria-label={isGenerating ? t("coaching.ttsGenerating") : isPlaying ? t("coaching.ttsPlaying") : t("coaching.ttsPlay")}
                title={
                    showFallbackBadge ? t("coaching.ttsFallbackHint") :
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
            {showFallbackBadge && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-amber-400" aria-hidden="true" />
            )}
        </div>
    )
}

function AssistantBubble({
    msg,
    locale,
    ttsConfig,
    thinkingLabel,
    persona,
    resolvedTheme,
}: {
    msg: DisplayMessage
    locale: "it" | "en"
    ttsConfig: TTSConfig
    thinkingLabel: string
    persona?: Persona
    resolvedTheme: "light" | "dark"
}) {
    const resp = msg.response
    const theme = getPersonaTheme(persona, resolvedTheme)
    return (
        <div className="flex items-start gap-2 max-w-[90%]">
            <div
                className="shrink-0 flex items-center justify-center h-8 w-8 rounded-full text-lg select-none"
                style={{ backgroundColor: theme?.avatar_bg }}
            >
                {persona?.icon ?? "🦉"}
            </div>
            <div
                className="rounded-2xl rounded-tl-sm px-4 py-3 text-sm flex-1 min-w-0 border"
                style={{
                    backgroundColor: theme?.bubble_bg,
                    borderColor: theme?.bubble_border,
                }}
            >
                {msg.showPersonaCue && persona && (
                    <div className="mb-2 flex items-center gap-1.5 text-xs text-muted-foreground">
                        <span>{persona.icon}</span>
                        <span>{persona.name}</span>
                    </div>
                )}
                {msg.isStreaming && !msg.content ? (
                    <div className="flex items-center gap-2 text-muted-foreground" aria-live="polite">
                        <span className="flex gap-1">
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:0ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:150ms]" />
                            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/60 animate-bounce [animation-delay:300ms]" />
                        </span>
                        <span className="text-xs">{thinkingLabel}</span>
                    </div>
                ) : (
                    <p className="whitespace-pre-wrap">{msg.content}</p>
                )}
                {!msg.isStreaming && msg.content && (
                    <div className="flex justify-end mt-1">
                        <VoicePlayButton text={msg.content} locale={locale} ttsConfig={ttsConfig} />
                    </div>
                )}
                {resp && (
                    <div className="animate-in fade-in duration-200 slide-in-from-bottom-1 motion-reduce:animate-none">
                        {/* 1. Affordability verdict (top position) */}
                        {resp.affordability_verdict && (
                            <AffordabilityVerdictCard verdict={resp.affordability_verdict} />
                        )}

                        {/* 2. Reasoning (if debug enabled) */}
                        {SHOW_REASONING && <ReasoningCard steps={resp.reasoning_used} />}

                        {/* 3. Transaction evidence */}
                        {resp.transaction_evidence && resp.transaction_evidence.transactions.length > 0 && (
                            <TransactionEvidenceTable evidence={resp.transaction_evidence} />
                        )}

                        {/* 4. Goal progress */}
                        {resp.goal_progress && (
                            <GoalProgressBar progress={resp.goal_progress} />
                        )}

                        {/* 5. Content cards (horizontal strip) */}
                        {resp.content_cards.length > 0 && (
                            <ContentCardStrip cards={resp.content_cards} />
                        )}

                        {/* 6. Interactive cards (reminder) */}
                        {resp.interactive_cards.length > 0 && (
                            <div className="mt-2 flex flex-col gap-2">
                                {resp.interactive_cards.map((c, i) => (
                                    <InteractiveCardComponent key={i} card={c} />
                                ))}
                            </div>
                        )}

                        {/* 7. Details panel — collapsed toggle */}
                        {resp.details_a2ui && (
                            <DetailsToggle a2ui={resp.details_a2ui} />
                        )}

                        {/* D-05: new_insight NOT rendered — persistence is backend-only */}

                        {LLM_DEBUG && resp.debug && <DebugPanel debug={resp.debug} />}
                    </div>
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
                personaId: m.persona_id ?? null,
            }
        } catch {
            return { role: "assistant", content: m.content, personaId: m.persona_id ?? null }
        }
    }
    return { role: "user", content: m.content }
}

function getResolvedTheme(theme: "light" | "dark" | "system"): "light" | "dark" {
    if (theme === "system") {
        return document.documentElement.classList.contains("dark") ? "dark" : "light"
    }

    return theme
}

function getPersonaTheme(persona: Persona | undefined, theme: "light" | "dark"): PersonaThemeMode | null {
    if (!persona?.theme) return null
    return theme === "dark" ? persona.theme.dark : persona.theme.light
}

function shouldShowPersonaCue(messages: DisplayMessage[], personaId: string | null | undefined): boolean {
    if (!personaId) return false

    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        if (message.role !== "assistant") continue
        return message.personaId !== personaId
    }

    return true
}

function getPersonaCueForIndex(messages: DisplayMessage[], index: number): boolean {
    const current = messages[index]
    if (!current || current.role !== "assistant" || !current.personaId) return false

    for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
        const previous = messages[cursor]
        if (previous.role !== "assistant") continue
        return previous.personaId !== current.personaId
    }

    return true
}

function findLastStreamingAssistantIndex(messages: DisplayMessage[]): number {
    for (let index = messages.length - 1; index >= 0; index -= 1) {
        const message = messages[index]
        if (message.role === "assistant" && message.isStreaming) {
            return index
        }
    }

    return -1
}

// ── Time-of-day greeting ──────────────────────────────────────────────────────

function getGreetingKey(): string {
    const hour = new Date().getHours()
    if (hour < 12) return "coaching.greetingMorning"
    if (hour < 18) return "coaching.greetingAfternoon"
    return "coaching.greetingEvening"
}

// ── ChatScreen ────────────────────────────────────────────────────────────────

export function ChatScreen({ onNavigateBack, locale = "it", initialTopic, sessionId: propSessionId, onSessionCreated, forceNew = false }: ChatScreenProps) {
    const { user } = useAuthContext()
    const { t } = useTranslation()
    const { theme } = useTheme()
    const haptic = useHapticFeedback()

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
    const [showPersonaSwitcher, setShowPersonaSwitcher] = useState(false)
    const [personas, setPersonas] = useState<Persona[]>([])
    const [activePersonaId, setActivePersonaId] = useState(user.defaultPersonaId ?? "mentore-saggio")

    // TTS config (from active persona)
    const DEFAULT_TTS_CONFIG: TTSConfig = { fallback: "browser", browserFallbackEnabled: true }
    const [ttsConfig, setTtsConfig] = useState<TTSConfig>(DEFAULT_TTS_CONFIG)
    const resolvedTheme = useMemo(() => getResolvedTheme(theme), [theme])
    const activePersona = useMemo(
        () => personas.find((persona) => persona.id === activePersonaId) ?? personas[0],
        [personas, activePersonaId],
    )

    // Message state
    const [messages, setMessages] = useState<DisplayMessage[]>([])
    const [inputText, setInputText] = useState("")
    const [isLoading, setIsLoading] = useState(false)
    const [loadingHistory, setLoadingHistory] = useState(true)
    const [welcomeLoading, setWelcomeLoading] = useState(false)
    const [restoreToast, setRestoreToast] = useState<RestoreToastState>({ visible: false, text: "" })
    const [error, setError] = useState<{ code: string; message: string } | null>(null)
    const lastUserMessageRef = useRef<string>("")

    const listEndRef = useRef<HTMLDivElement>(null)
    const listRef = useRef<HTMLDivElement>(null)
    const namingInFlight = useRef(false)
    // Ref to break the circular dep: handleSend → onAssistantMessage ← useVoiceMode → handleSend
    const onAssistantMessageRef = useRef<(text: string) => void>(() => { })
    // Track auto-dismiss timer so it can be cleared on new error
    const errorDismissTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const restoreToastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
    const shouldStickToBottomRef = useRef(true)

    // Simple ref for the message list (scroll tracking only - no pull-to-refresh on chat)
    const mergedListRef = useCallback(
        (el: HTMLDivElement | null) => {
            listRef.current = el
        },
        [],
    )

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

    const showRestoreToast = useCallback((text: string) => {
        if (restoreToastTimerRef.current) {
            clearTimeout(restoreToastTimerRef.current)
        }
        setRestoreToast({ visible: true, text })
        restoreToastTimerRef.current = setTimeout(() => {
            setRestoreToast((prev) => ({ ...prev, visible: false }))
            restoreToastTimerRef.current = null
        }, 2500)
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

    const updateStickiness = useCallback(() => {
        const container = listRef.current
        if (!container) return
        const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight
        shouldStickToBottomRef.current = distanceFromBottom <= 120
    }, [])

    // On mount: load sessions, restore specific session or last, or fetch welcome for empty new session
    useEffect(() => {
        void (async () => {
            // Fetch personas to get TTS config (best-effort; default used on failure)
            try {
                const personas = await getPersonas()
                setPersonas(personas)
                const initialPersonaId = user.defaultPersonaId ?? "mentore-saggio"
                const active = personas.find((p) => p.id === initialPersonaId) ?? personas.find((p) => p.id === "mentore-saggio") ?? personas[0]
                if (active?.id) setActivePersonaId(active.id)
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

            // Route-driven session loading:
            // 1. If propSessionId is given, load that specific session
            // 2. If no propSessionId and sessions exist, restore the last one
            // 3. If no sessions at all, show welcome (new conversation)
            if (propSessionId) {
                const target = list.find((s) => s.id === propSessionId)
                if (target) {
                    setSessionId(target.id)
                    setSessionName(target.name)
                    await loadSessionHistory(target.id)
                    showRestoreToast(t("coaching.restoreToast"))
                } else {
                    // Session not found - treat as new conversation
                    setLoadingHistory(false)
                    setWelcomeLoading(true)
                    try {
                        const msg = await getWelcomeMessage(locale)
                        setMessages([{ role: "assistant", content: msg, isWelcome: true }])
                    } catch {
                        const fallback = t(getGreetingKey())
                        setMessages([{ role: "assistant", content: fallback, isWelcome: true }])
                    } finally {
                        setWelcomeLoading(false)
                    }
                }
            } else if (list.length > 0 && !forceNew) {
                const last = list[0] // newest = index 0 (sorted by updated_at desc)
                setSessionId(last.id)
                setSessionName(last.name)
                await loadSessionHistory(last.id)
                showRestoreToast(t("coaching.restoreToast"))
            } else {
                // No sessions yet - show welcome, session will be created on first send
                setLoadingHistory(false)
                setWelcomeLoading(true)
                try {
                    const msg = await getWelcomeMessage(locale)
                    setMessages([{ role: "assistant", content: msg, isWelcome: true }])
                } catch {
                    const fallback = t(getGreetingKey())
                    setMessages([{ role: "assistant", content: fallback, isWelcome: true }])
                } finally {
                    setWelcomeLoading(false)
                }
            }
        })()
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])

    useEffect(() => {
        const nextPersonaId = user.defaultPersonaId ?? "mentore-saggio"
        if (!sessionId) {
            setActivePersonaId(nextPersonaId)
        }
    }, [user.defaultPersonaId, sessionId])

    // Auto-scroll
    useEffect(() => {
        if (!shouldStickToBottomRef.current) return
        listEndRef.current?.scrollIntoView({ behavior: isLoading ? "auto" : "smooth" })
    }, [messages, isLoading])

    useEffect(() => {
        return () => {
            if (errorDismissTimerRef.current) clearTimeout(errorDismissTimerRef.current)
            if (restoreToastTimerRef.current) clearTimeout(restoreToastTimerRef.current)
        }
    }, [])

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
            const fallback = t(getGreetingKey())
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
        setActivePersonaId(found?.persona_id ?? user.defaultPersonaId ?? "mentore-saggio")
        setError(null)
        await loadSessionHistory(id)
    }, [sessions, loadSessionHistory, user.defaultPersonaId])

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
        haptic.tap()
        const trimmed = (text ?? inputText).trim()
        if (!trimmed || isLoading) return

        setError(null)
        lastUserMessageRef.current = trimmed
        const userMsg: DisplayMessage = { role: "user", content: trimmed }
        const assistantPlaceholder: DisplayMessage = {
            role: "assistant",
            content: "",
            isStreaming: true,
            personaId: activePersonaId,
            showPersonaCue: shouldShowPersonaCue(messages, activePersonaId),
        }
        setMessages((prev) => [...prev, userMsg, assistantPlaceholder])
        setInputText("")
        setIsLoading(true)
        shouldStickToBottomRef.current = true

        const isFirstUserMessage = !sessionId

        // 35s client-side timeout - well below the backend's 60s LLM timeout.
        // If the backend hits its timeout first, we get a 502 error; if the connection
        // hangs (network issue), the frontend recovers and shows a Retry button.
        const timeoutId = setTimeout(() => {
            setIsLoading(false)
            setErrorWithAutoDismiss({ code: "network_error", message: getErrorMessage("network_error", t) })
        }, 35000)

        try {
            let finalResponse: CoachingResponse | null = null

            try {
                finalResponse = await sendMessageStream(trimmed, locale, activePersonaId, sessionId, {
                    onMeta: (meta) => {
                        if (isFirstUserMessage && meta.session_id) {
                            setSessionId(meta.session_id)
                        }
                    },
                    onDelta: (chunk) => {
                        setMessages((prev) => {
                            const next = [...prev]
                            const index = findLastStreamingAssistantIndex(next)
                            if (index === -1) return prev
                            next[index] = {
                                ...next[index],
                                content: `${next[index].content}${chunk}`,
                            }
                            return next
                        })
                    },
                    onFinal: (response) => {
                        finalResponse = response
                        setMessages((prev) => {
                            const next = [...prev]
                            const index = findLastStreamingAssistantIndex(next)
                            if (index === -1) {
                                next.push({ role: "assistant", content: response.message, response })
                                return next
                            }
                            next[index] = {
                                role: "assistant",
                                content: response.message,
                                response,
                                isStreaming: false,
                                personaId: activePersonaId,
                                showPersonaCue: next[index].showPersonaCue,
                            }
                            return next
                        })
                    },
                })
            } catch {
                const fallback = await sendMessage(trimmed, locale, activePersonaId, sessionId)
                finalResponse = fallback
                setMessages((prev) => {
                    const next = [...prev]
                    const index = findLastStreamingAssistantIndex(next)
                    if (index === -1) {
                        next.push({
                            role: "assistant",
                            content: fallback.message,
                            response: fallback,
                            personaId: activePersonaId,
                            showPersonaCue: shouldShowPersonaCue(next, activePersonaId),
                        })
                        return next
                    }
                    next[index] = {
                        role: "assistant",
                        content: fallback.message,
                        response: fallback,
                        isStreaming: false,
                        personaId: activePersonaId,
                        showPersonaCue: next[index].showPersonaCue,
                    }
                    return next
                })
            }

            clearTimeout(timeoutId)
            if (!finalResponse) {
                throw new CoachingApiError("network_error", "Missing response payload")
            }

            const newSessionId = finalResponse.session_id

            // If this was the first message, a new session was created
            if (isFirstUserMessage && newSessionId) {
                setSessionId(newSessionId)
                onSessionCreated?.(newSessionId)
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

            // In voice mode, auto-play TTS for the reply
            onAssistantMessageRef.current(finalResponse.message)
        } catch (err) {
            haptic.error()
            clearTimeout(timeoutId)
            const errorCode = err instanceof CoachingApiError ? err.code : "network_error"
            const isRetryable = errorCode === "llm_error" || errorCode === "network_error"
            // Remove the streaming assistant placeholder AND mark the last user message as failed
            setMessages((prev) => {
                const lastStreamingIndex = findLastStreamingAssistantIndex(prev)
                return prev
                    .filter((_, index) => index !== lastStreamingIndex)
                    .map((msg, index, arr) => {
                        // Find the last user message and mark it failed (for retryable errors)
                        if (isRetryable && msg.role === "user" && index === arr.length - 1) {
                            return { ...msg, status: "failed" as const }
                        }
                        return msg
                    })
            })
            if (!isRetryable) {
                // Non-retryable errors (profile_required, input_rejected, etc.) show banner
                setErrorWithAutoDismiss({ code: errorCode, message: getErrorMessage(errorCode, t) })
            }
        } finally {
            setIsLoading(false)
        }
    }, [inputText, isLoading, sessionId, locale, fetchSessions, setErrorWithAutoDismiss, activePersonaId, messages])

    // B4: Pre-fill input when navigating from /chat/about/:slug
    const initialTopicApplied = useRef(false)
    useEffect(() => {
        if (initialTopic && !initialTopicApplied.current && !loadingHistory) {
            initialTopicApplied.current = true
            // Convert slug to readable text: "budgeting-for-beginners" → "budgeting for beginners"
            const topicText = decodeURIComponent(initialTopic).replace(/-/g, " ")
            setInputText(topicText)
        }
    }, [initialTopic, loadingHistory])

    // Retry a failed user message without duplicating it in the chat
    const handleRetry = useCallback((failedMessageIndex: number) => {
        const failedMsg = messages[failedMessageIndex]
        if (!failedMsg || failedMsg.role !== "user" || failedMsg.status !== "failed") return

        // Clear the failed status on the message, then resend
        setMessages((prev) =>
            prev.map((msg, i) =>
                i === failedMessageIndex ? { ...msg, status: undefined } : msg,
            ),
        )
        // Use handleSend with the message text - but we need to prevent it from
        // adding a new user message. Instead, we reset the failed msg above and
        // manually add the assistant placeholder + trigger the send.
        setError(null)
        lastUserMessageRef.current = failedMsg.content
        const assistantPlaceholder: DisplayMessage = {
            role: "assistant",
            content: "",
            isStreaming: true,
            personaId: activePersonaId,
            showPersonaCue: shouldShowPersonaCue(messages, activePersonaId),
        }
        setMessages((prev) => [...prev, assistantPlaceholder])
        setIsLoading(true)
        shouldStickToBottomRef.current = true

        const timeoutId = setTimeout(() => {
            setIsLoading(false)
            setErrorWithAutoDismiss({ code: "network_error", message: getErrorMessage("network_error", t) })
        }, 35000)

        void (async () => {
            try {
                let finalResponse: CoachingResponse | null = null

                try {
                    finalResponse = await sendMessageStream(failedMsg.content, locale, activePersonaId, sessionId, {
                        onMeta: (meta) => {
                            if (!sessionId && meta.session_id) {
                                setSessionId(meta.session_id)
                            }
                        },
                        onDelta: (chunk) => {
                            setMessages((prev) => {
                                const next = [...prev]
                                const index = findLastStreamingAssistantIndex(next)
                                if (index === -1) return prev
                                next[index] = {
                                    ...next[index],
                                    content: `${next[index].content}${chunk}`,
                                }
                                return next
                            })
                        },
                        onFinal: (response) => {
                            finalResponse = response
                            setMessages((prev) => {
                                const next = [...prev]
                                const index = findLastStreamingAssistantIndex(next)
                                if (index === -1) {
                                    next.push({ role: "assistant", content: response.message, response })
                                    return next
                                }
                                next[index] = {
                                    role: "assistant",
                                    content: response.message,
                                    response,
                                    isStreaming: false,
                                    personaId: activePersonaId,
                                    showPersonaCue: next[index].showPersonaCue,
                                }
                                return next
                            })
                        },
                    })
                } catch {
                    const fallback = await sendMessage(failedMsg.content, locale, activePersonaId, sessionId)
                    finalResponse = fallback
                    setMessages((prev) => {
                        const next = [...prev]
                        const index = findLastStreamingAssistantIndex(next)
                        if (index === -1) {
                            next.push({
                                role: "assistant",
                                content: fallback.message,
                                response: fallback,
                                personaId: activePersonaId,
                                showPersonaCue: shouldShowPersonaCue(next, activePersonaId),
                            })
                            return next
                        }
                        next[index] = {
                            role: "assistant",
                            content: fallback.message,
                            response: fallback,
                            isStreaming: false,
                            personaId: activePersonaId,
                            showPersonaCue: next[index].showPersonaCue,
                        }
                        return next
                    })
                }

                clearTimeout(timeoutId)
                if (!finalResponse) {
                    throw new CoachingApiError("network_error", "Missing response payload")
                }

                const newSessionId = finalResponse.session_id
                if (!sessionId && newSessionId) {
                    setSessionId(newSessionId)
                    const list = await fetchSessions()
                    const created = list.find((s) => s.id === newSessionId)
                    setSessionName(created?.name ?? "")
                }

                onAssistantMessageRef.current(finalResponse.message)
            } catch (retryErr) {
                clearTimeout(timeoutId)
                const errorCode = retryErr instanceof CoachingApiError ? retryErr.code : "network_error"
                const isRetryable = errorCode === "llm_error" || errorCode === "network_error"
                setMessages((prev) => {
                    const lastStreamingIndex = findLastStreamingAssistantIndex(prev)
                    return prev
                        .filter((_, index) => index !== lastStreamingIndex)
                        .map((msg, index, arr) => {
                            if (isRetryable && msg.role === "user" && index === arr.length - 1) {
                                return { ...msg, status: "failed" as const }
                            }
                            return msg
                        })
                })
                if (!isRetryable) {
                    setErrorWithAutoDismiss({ code: errorCode, message: getErrorMessage(errorCode, t) })
                }
            } finally {
                setIsLoading(false)
            }
        })()
    }, [messages, activePersonaId, sessionId, locale, fetchSessions, setErrorWithAutoDismiss, t])

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

    // canPlay mirrors the useTTS logic: show voice controls when TTS is possible.
    // Gating the voice mode toggle on isSttAvailable (STT) would hide it on Firefox/Safari
    // where SpeechRecognition is absent but speechSynthesis still works. VoiceModeBar
    // already handles !isSttAvailable gracefully (disabled mic + "unavailable" hint).
    const canPlay =
        typeof window !== "undefined" &&
        (ttsConfig.browserFallbackEnabled ? "speechSynthesis" in window : true)

    const [sttErrorVisible, setSttErrorVisible] = useState(false)
    const [ttsNoticeDismissed, setTtsNoticeDismissed] = useState(
        () => sessionStorage.getItem("senso:ttsNoticeDismissed") === "true"
    )
    useEffect(() => {
        if (sttError) {
            setSttErrorVisible(true)
            const timer = setTimeout(() => setSttErrorVisible(false), 4000)
            return () => clearTimeout(timer)
        }
    }, [sttError])

    // ── Render ─────────────────────────────────────────────────────────────────

    return (
        <div className="flex flex-col h-[calc(100dvh-3.5rem)] overflow-hidden bg-background">
            {/* Sub-header */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-border bg-background shrink-0">
                <SensoAvatar />
                <div className="flex-1 min-w-0">
                    <h2 className="font-semibold text-sm truncate">
                        {sessionName || t("coaching.newConversation")}
                    </h2>
                    <p className="text-xs text-muted-foreground">{t("coaching.coachTitle")}</p>
                    {user.strictPrivacyMode && (
                        <span
                            aria-label={t("coaching.privacyBadge") + " attiva"}
                            className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary text-xs font-medium px-2 py-1 mt-0.5"
                        >
                            <ShieldCheck className="h-3 w-3" aria-hidden="true" />
                            {t("coaching.privacyBadge")}
                        </span>
                    )}
                </div>
                {activePersona && (
                    <button
                        type="button"
                        onClick={() => setShowPersonaSwitcher(true)}
                        className="flex items-center gap-1.5 rounded-full border border-border bg-background px-3 py-1.5 text-xs font-medium text-foreground hover:bg-accent transition-colors"
                    >
                        <span>{activePersona.icon}</span>
                        <span className="hidden sm:inline">{activePersona.name}</span>
                        <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                )}
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

            {restoreToast.visible && <RestoreToast text={restoreToast.text} />}

            {/* Message list */}
            <div
                ref={mergedListRef}
                className="flex-1 overflow-y-auto px-4 py-4 space-y-4 overscroll-none"
                onScroll={updateStickiness}
            >
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
                            <div className="flex flex-col items-end gap-1 max-w-[90%]">
                                <div className="flex items-end gap-2">
                                    <div className={`rounded-2xl rounded-tr-sm px-4 py-3 text-sm ${msg.status === "failed"
                                            ? "bg-destructive/10 text-destructive border border-destructive/30"
                                            : "bg-primary text-primary-foreground"
                                        }`}>
                                        <p className="whitespace-pre-wrap">{msg.content}</p>
                                    </div>
                                    <UserAvatar user={user} size="sm" className="shrink-0 mb-0.5" />
                                </div>
                                {msg.status === "failed" && (
                                    <button
                                        onClick={() => handleRetry(i)}
                                        disabled={isLoading}
                                        className="flex items-center gap-1 text-xs text-destructive hover:text-destructive/80 transition-colors mr-9 disabled:opacity-50"
                                    >
                                        <RotateCcw className="h-3 w-3" />
                                        {t("coaching.retryLastMessage")}
                                    </button>
                                )}
                            </div>
                        ) : (
                            <AssistantBubble
                                msg={{ ...msg, showPersonaCue: msg.showPersonaCue ?? getPersonaCueForIndex(messages, i) }}
                                locale={locale}
                                ttsConfig={ttsConfig}
                                thinkingLabel={t(`coaching.thinking.${effectiveGender}`, { name: personaName })}
                                persona={personas.find((persona) => persona.id === msg.personaId) ?? activePersona}
                                resolvedTheme={resolvedTheme}
                            />
                        )}
                    </div>
                ))}

                <div ref={listEndRef} />
            </div>

            {/* Error banner - only for non-retryable errors (retryable ones show inline retry on the message) */}
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
                </div>
            )}

            {/* Input area */}
            <div className="sticky bottom-0 bg-background border-t border-border px-4 py-3 shrink-0">
                {user.strictPrivacyMode && !ttsNoticeDismissed && (
                    <div
                        role="alert"
                        className="mb-2 flex items-start gap-2 rounded-lg border border-border bg-muted px-4 py-3 text-sm text-muted-foreground"
                    >
                        <ShieldOff className="h-4 w-4 shrink-0 mt-0.5" aria-hidden="true" />
                        <span className="flex-1">{t("coaching.ttsDisabledStrict")}</span>
                        <button
                            aria-label={t("coaching.modalClose")}
                            onClick={() => {
                                setTtsNoticeDismissed(true)
                                sessionStorage.setItem("senso:ttsNoticeDismissed", "true")
                            }}
                            className="shrink-0 rounded hover:bg-muted-foreground/10 p-0.5"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                )}
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
                            {canPlay && (
                                <Button
                                    type="button"
                                    variant="ghost"
                                    size="icon"
                                    className={isVoiceMode ? "text-primary" : "text-muted-foreground"}
                                    onClick={() => { haptic.tap(); void toggleVoiceMode() }}
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

            {showPersonaSwitcher && (
                <PersonaSwitcher
                    personas={personas}
                    activePersonaId={activePersonaId}
                    resolvedTheme={resolvedTheme}
                    onSelect={(personaId) => {
                        setActivePersonaId(personaId)
                        const selected = personas.find((persona) => persona.id === personaId)
                        if (selected?.tts) {
                            setTtsConfig({
                                fallback: selected.tts.fallback,
                                browserFallbackEnabled: selected.tts.browser_fallback_enabled,
                            })
                        }
                        if (selected?.defaultGender) setPersonaDefaultGender(selected.defaultGender)
                        if (selected?.name) setPersonaName(selected.name)
                    }}
                    onClose={() => setShowPersonaSwitcher(false)}
                />
            )}
        </div>
    )
}
