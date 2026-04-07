import { useCallback, useEffect, useState } from "react"
import {
    AlertTriangle,
    Clock,
    CreditCard,
    List,
    MapPin,
    ShoppingCart,
    Star,
    TrendingUp,
} from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import {
    addTimelineContext,
    dismissTimelineEvent,
    getTimeline,
    type TimelineEventDTO,
} from "@/lib/profile-api"

const EVENT_TYPE_ICONS: Record<string, React.ElementType> = {
    income_shift: TrendingUp,
    major_purchase: ShoppingCart,
    subscription_accumulation: List,
    extraordinary_income: Star,
    relocation: MapPin,
    debt_change: CreditCard,
}

function getEventIcon(eventType: string): React.ElementType {
    return EVENT_TYPE_ICONS[eventType] ?? Clock
}

const DISMISS_REASONS = [
    { value: "false_assumption", labelKey: "timeline.dismissReasonFalseAssumption" },
    { value: "clerical_error", labelKey: "timeline.dismissReasonClericalError" },
    { value: "outdated", labelKey: "timeline.dismissReasonOutdated" },
    { value: "duplicate", labelKey: "timeline.dismissReasonDuplicate" },
    { value: "other", labelKey: "timeline.dismissReasonOther" },
]

type CardInteractionState = {
    mode: "none" | "dismiss" | "context"
    dismissReason: string
    dismissDetail: string
    contextText: string
    saving: boolean
    saveError: string | null
}

function TimelineEventCard({
    event,
    token,
    onDismissed,
    onContextSaved,
}: {
    event: TimelineEventDTO
    token: string
    onDismissed: (id: string) => void
    onContextSaved: (id: string) => void
}) {
    const { t } = useTranslation()
    const [state, setState] = useState<CardInteractionState>({
        mode: "none",
        dismissReason: "",
        dismissDetail: "",
        contextText: "",
        saving: false,
        saveError: null,
    })

    const Icon = getEventIcon(event.event_type)

    const handleDismiss = useCallback(async () => {
        if (!state.dismissReason) return
        setState((s) => ({ ...s, saving: true, saveError: null }))
        try {
            await dismissTimelineEvent(
                token,
                event.id,
                state.dismissReason,
                state.dismissReason === "other" ? state.dismissDetail : undefined,
            )
            onDismissed(event.id)
        } catch {
            setState((s) => ({ ...s, saving: false, saveError: t("timeline.errorSave") }))
        }
    }, [token, event.id, state.dismissReason, state.dismissDetail, t, onDismissed])

    const handleSaveContext = useCallback(async () => {
        if (!state.contextText.trim()) return
        setState((s) => ({ ...s, saving: true, saveError: null }))
        try {
            await addTimelineContext(token, event.id, state.contextText)
            onContextSaved(event.id)
        } catch {
            setState((s) => ({ ...s, saving: false, saveError: t("timeline.errorSave") }))
        }
    }, [token, event.id, state.contextText, t, onContextSaved])

    const isDismissed = event.is_user_dismissed

    return (
        <div
            className={`rounded-2xl border border-border bg-card p-5 transition-opacity ${isDismissed ? "opacity-50" : ""
                }`}
        >
            {/* Header row */}
            <div className="mb-3 flex items-start gap-3">
                <Icon className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap mb-1">
                        <span className="rounded-full bg-secondary px-2 py-1 text-sm text-muted-foreground">
                            {event.event_date}
                        </span>
                    </div>
                    <p className={`text-base font-semibold text-foreground ${isDismissed ? "line-through" : ""}`}>
                        {event.title}
                    </p>
                </div>
            </div>

            {/* Description */}
            {event.description && (
                <p className="mb-3 text-sm text-muted-foreground">{event.description}</p>
            )}

            {/* Distilled user context */}
            {event.user_context_distilled && (
                <p className="mb-3 text-sm italic text-muted-foreground">
                    {event.user_context_distilled}
                </p>
            )}

            {/* Error message */}
            {state.saveError && (
                <p className="mb-2 text-sm text-destructive">{state.saveError}</p>
            )}

            {/* Context form */}
            {state.mode === "context" && (
                <div className="mb-3">
                    <textarea
                        autoFocus
                        value={state.contextText}
                        onChange={(e) => setState((s) => ({ ...s, contextText: e.target.value }))}
                        placeholder={t("timeline.addContextPlaceholder")}
                        rows={3}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                    />
                    <div className="mt-2 flex gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            disabled={state.saving || !state.contextText.trim()}
                            onClick={() => void handleSaveContext()}
                        >
                            {state.saving ? "..." : t("timeline.saveContext")}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setState((s) => ({ ...s, mode: "none", saveError: null }))}
                        >
                            {t("admin.content.cancelBtn")}
                        </Button>
                    </div>
                </div>
            )}

            {/* Dismiss form */}
            {state.mode === "dismiss" && (
                <div className="mb-3">
                    <p className="mb-2 text-sm text-muted-foreground">{t("timeline.dismissReasonLabel")}</p>
                    <select
                        value={state.dismissReason}
                        onChange={(e) => setState((s) => ({ ...s, dismissReason: e.target.value }))}
                        className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="" disabled>
                            -
                        </option>
                        {DISMISS_REASONS.map((r) => (
                            <option key={r.value} value={r.value}>
                                {t(r.labelKey)}
                            </option>
                        ))}
                    </select>
                    {state.dismissReason === "other" && (
                        <textarea
                            value={state.dismissDetail}
                            onChange={(e) => setState((s) => ({ ...s, dismissDetail: e.target.value }))}
                            placeholder={t("timeline.addContextPlaceholder")}
                            rows={2}
                            maxLength={200}
                            className="mt-2 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary resize-none"
                        />
                    )}
                    <div className="mt-2 flex gap-2">
                        <Button
                            variant="default"
                            size="sm"
                            disabled={state.saving || !state.dismissReason}
                            onClick={() => void handleDismiss()}
                        >
                            {state.saving ? "..." : t("questionnaire.finish")}
                        </Button>
                        <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setState((s) => ({ ...s, mode: "none", saveError: null }))}
                        >
                            {t("admin.content.cancelBtn")}
                        </Button>
                    </div>
                </div>
            )}

            {/* Action buttons */}
            {state.mode === "none" && !isDismissed && (
                <div className="mt-3 flex gap-2">
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-primary text-sm"
                        onClick={() =>
                            setState((s) => ({
                                ...s,
                                mode: "context",
                                contextText: "",
                                saveError: null,
                            }))
                        }
                    >
                        {event.user_context_distilled
                            ? t("timeline.editContext")
                            : t("timeline.addContextPlaceholder").replace("...", "").trim()}
                    </Button>
                    <Button
                        variant="ghost"
                        size="sm"
                        className="text-muted-foreground text-sm"
                        onClick={() =>
                            setState((s) => ({
                                ...s,
                                mode: "dismiss",
                                dismissReason: "",
                                dismissDetail: "",
                                saveError: null,
                            }))
                        }
                    >
                        {t("timeline.dismissEvent")}
                    </Button>
                </div>
            )}
        </div>
    )
}

type Props = {
    token: string
}

export function TimelineTab({ token }: Props) {
    const { t } = useTranslation()
    const [events, setEvents] = useState<TimelineEventDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)
    const [showDismissed, setShowDismissed] = useState(false)

    const loadTimeline = useCallback(
        (includeDismissed = false) => {
            setLoading(true)
            setError(null)
            void getTimeline(token, includeDismissed)
                .then((data) => setEvents(data))
                .catch(() => setError(t("timeline.errorLoad")))
                .finally(() => setLoading(false))
        },
        [token, t],
    )

    useEffect(() => {
        loadTimeline(showDismissed)
    }, [loadTimeline, showDismissed])

    const handleDismissed = useCallback((id: string) => {
        setEvents((prev) =>
            prev.map((e) => (e.id === id ? { ...e, is_user_dismissed: true } : e)),
        )
    }, [])

    const handleContextSaved = useCallback(
        (_id: string) => {
            // Refresh to get the new distilled context
            loadTimeline(showDismissed)
        },
        [loadTimeline, showDismissed],
    )

    if (loading) {
        return (
            <div className="space-y-3">
                {[...Array(3)].map((_, i) => (
                    <div key={i} className="animate-pulse rounded-2xl bg-muted h-24 mb-3" />
                ))}
            </div>
        )
    }

    if (error) {
        return (
            <div className="flex flex-col items-center gap-4 py-12 text-center">
                <AlertTriangle className="h-10 w-10 text-destructive" />
                <p className="text-sm text-destructive">{error}</p>
                <Button variant="ghost" onClick={() => loadTimeline(showDismissed)}>
                    {t("uncategorized.reloadButton")}
                </Button>
            </div>
        )
    }

    const activeEvents = events.filter((e) => !e.is_user_dismissed)
    const dismissedEvents = events.filter((e) => e.is_user_dismissed)

    if (activeEvents.length === 0 && dismissedEvents.length === 0) {
        return (
            <div className="flex flex-col items-center gap-4 py-16 text-center">
                <Clock className="h-10 w-10 text-muted-foreground" />
                <div>
                    <p className="text-base font-semibold text-foreground">{t("timeline.emptyHeading")}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{t("timeline.emptyBody")}</p>
                </div>
            </div>
        )
    }

    return (
        <div className="space-y-4">
            {/* Active events */}
            {activeEvents.map((event) => (
                <TimelineEventCard
                    key={event.id}
                    event={event}
                    token={token}
                    onDismissed={handleDismissed}
                    onContextSaved={handleContextSaved}
                />
            ))}

            {/* Dismissed events section */}
            {dismissedEvents.length > 0 && (
                <div>
                    {!showDismissed ? (
                        <Button
                            variant="ghost"
                            size="sm"
                            className="text-muted-foreground"
                            onClick={() => setShowDismissed(true)}
                        >
                            {t("timeline.showDismissed", { count: dismissedEvents.length })}
                        </Button>
                    ) : (
                        <div className="space-y-4">
                            {dismissedEvents.map((event) => (
                                <TimelineEventCard
                                    key={event.id}
                                    event={event}
                                    token={token}
                                    onDismissed={handleDismissed}
                                    onContextSaved={handleContextSaved}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    )
}
