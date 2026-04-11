import { useEffect, useCallback, useMemo, useState } from "react"
import { Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthContext } from "@/features/auth/AuthContext"
import { readAccessToken } from "@/features/auth/storage"
import { getProfileStatus, triggerCategorization, createProfileApi } from "@/lib/profile-api"
import { createIngestionApi } from "@/features/ingestion/api"
import { IngestionScreen } from "@/features/ingestion/IngestionScreen"
import { ProcessingScreen } from "@/features/profile/ProcessingScreen"
import { OnboardingChoiceScreen } from "@/features/profile/OnboardingChoiceScreen"
import { QuestionnaireScreen } from "@/features/profile/QuestionnaireScreen"
import { Button } from "@/components/ui/button"

// ── Stale profile modal (shared by resolver + upload confirm) ────────────────

function StaleProfileModal({
    onUpdate,
    onDismiss,
}: {
    onUpdate: () => void
    onDismiss: () => void
}) {
    const { t } = useTranslation()
    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
            <div className="mx-4 w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
                <h3 className="mb-2 text-lg font-semibold text-foreground">
                    {t("profile.staleModal.heading")}
                </h3>
                <p className="mb-6 text-sm text-muted-foreground">
                    {t("profile.staleModal.body")}
                </p>
                <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                    <Button variant="ghost" onClick={onDismiss}>
                        {t("profile.staleModal.later")}
                    </Button>
                    <Button variant="default" onClick={onUpdate}>
                        {t("profile.staleModal.update")}
                    </Button>
                </div>
            </div>
        </div>
    )
}

// ── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
    const { t } = useTranslation()
    return (
        <main className="flex min-h-screen items-center justify-center">
            <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
        </main>
    )
}

// ── Index resolver ───────────────────────────────────────────────────────────
// Redirect-only (except for the stale modal overlay).

function OnboardingResolver() {
    const token = readAccessToken()
    const navigate = useNavigate()
    const [target, setTarget] = useState<string | null>(null)
    const [showStale, setShowStale] = useState(false)

    useEffect(() => {
        if (!token) {
            setTarget("/onboarding/choice")
            return
        }

        void getProfileStatus(token)
            .then((data) => {
                switch (data.status) {
                    case "complete":
                        // Check staleness
                        if (
                            data.currentUploadsFingerprint &&
                            data.currentUploadsFingerprint !== data.uploadsFingerprint
                        ) {
                            setShowStale(true)
                        } else {
                            // Profile complete and not stale → let root resolve to /chat
                            setTarget("/")
                        }
                        break

                    case "queued":
                    case "categorizing":
                    case "generating_insights":
                        setTarget("/onboarding/processing")
                        break

                    case "failed":
                        setTarget("/onboarding/upload")
                        break

                    case "not_started":
                        if (data.currentUploadsFingerprint) {
                            // Uploads exist but not processed → trigger
                            setTarget("/onboarding/processing#start")
                        } else {
                            // No uploads at all
                            setTarget("/onboarding/choice")
                        }
                        break

                    default:
                        setTarget("/onboarding/choice")
                }
            })
            .catch(() => {
                setTarget("/onboarding/choice")
            })
    }, [token])

    if (showStale) {
        return (
            <StaleProfileModal
                onUpdate={() => {
                    setShowStale(false)
                    navigate("/onboarding/processing#start", { replace: true })
                }}
                onDismiss={() => {
                    setShowStale(false)
                    navigate("/chat", { replace: true })
                }}
            />
        )
    }

    if (!target) return <LoadingScreen />
    return <Navigate to={target} replace />
}

// ── /onboarding/choice ───────────────────────────────────────────────────────

function ChoicePage() {
    const { user } = useAuthContext()
    const navigate = useNavigate()

    return (
        <OnboardingChoiceScreen
            user={user}
            onChooseFiles={() => navigate("/onboarding/upload")}
            onChooseQuizThorough={() => navigate("/onboarding/quiz")}
            onChooseQuizQuick={() => navigate("/onboarding/quiz#quick")}
        />
    )
}

// ── /onboarding/upload ───────────────────────────────────────────────────────

function UploadPage() {
    const { user, onUnauthorized } = useAuthContext()
    const token = readAccessToken()
    const navigate = useNavigate()
    const [showStale, setShowStale] = useState(false)
    const ingestionApi = useMemo(() => createIngestionApi(onUnauthorized), [onUnauthorized])
    const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized])

    const handleConfirmAll = useCallback(async () => {
        if (!token) return
        try {
            await ingestionApi.confirmAll(token)
            const statusData = await profileApi.getProfileStatus(token)
            if (
                statusData.status === "complete" &&
                statusData.uploadsFingerprint !== null &&
                statusData.uploadsFingerprint !== statusData.currentUploadsFingerprint
            ) {
                setShowStale(true)
            } else {
                navigate("/onboarding/processing#start", { replace: true })
            }
        } catch { /* stay */ }
    }, [token, navigate, ingestionApi, profileApi])

    return (
        <>
            <IngestionScreen
                user={user}
                onConfirmAll={() => void handleConfirmAll()}
            />
            {showStale && (
                <StaleProfileModal
                    onUpdate={() => {
                        setShowStale(false)
                        navigate("/onboarding/processing#start", { replace: true })
                    }}
                    onDismiss={() => {
                        setShowStale(false)
                        navigate("/chat", { replace: true })
                    }}
                />
            )}
        </>
    )
}

// ── /onboarding/quiz ─────────────────────────────────────────────────────────

function QuizPage() {
    const { user } = useAuthContext()
    const token = readAccessToken()
    const navigate = useNavigate()
    const location = useLocation()

    // #quick → "quick", no hash → "thorough"
    const mode: "quick" | "thorough" = location.hash === "#quick" ? "quick" : "thorough"

    if (!token) return null

    return (
        <QuestionnaireScreen
            user={user}
            token={token}
            mode={mode}
            onComplete={() => navigate("/chat", { replace: true })}
            onBack={() => navigate("/onboarding/choice")}
        />
    )
}

// ── /onboarding/processing ───────────────────────────────────────────────────

function ProcessingPage() {
    const { user } = useAuthContext()
    const token = readAccessToken()
    const navigate = useNavigate()
    const location = useLocation()
    const [triggered, setTriggered] = useState(false)

    // Handle #start: trigger categorization, then clear the hash
    useEffect(() => {
        if (location.hash !== "#start" || !token || triggered) return
        setTriggered(true)

        void triggerCategorization(token)
            .then(() => {
                // Clear hash so refresh won't re-trigger
                navigate("/onboarding/processing", { replace: true })
            })
            .catch(() => {
                // Still clear hash - ProcessingScreen will show the error via polling
                navigate("/onboarding/processing", { replace: true })
            })
    }, [location.hash, token, triggered, navigate])

    if (!token) return null

    return (
        <ProcessingScreen
            user={user}
            token={token}
            onBack={() => navigate("/onboarding/upload")}
            onComplete={() => navigate("/profile", { replace: true })}
        />
    )
}

// ── OnboardingRoutes subrouter ───────────────────────────────────────────────

export function OnboardingRoutes() {
    return (
        <Routes>
            <Route index element={<OnboardingResolver />} />
            <Route path="choice" element={<ChoicePage />} />
            <Route path="upload" element={<UploadPage />} />
            <Route path="quiz" element={<QuizPage />} />
            <Route path="processing" element={<ProcessingPage />} />
            <Route path="*" element={<Navigate to="/onboarding" replace />} />
        </Routes>
    )
}
