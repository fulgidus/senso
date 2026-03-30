import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { AuthScreen } from "@/features/auth/AuthScreen"
import { useAuth } from "@/features/auth/useAuth"
import { AuthContext } from "@/features/auth/AuthContext"
import { AppShell, PublicShell } from "@/components/AppShell"
import { IngestionScreen } from "@/features/ingestion/IngestionScreen"
import { ProcessingScreen } from "@/features/profile/ProcessingScreen"
import { ProfileScreen } from "@/features/profile/ProfileScreen"
import { OnboardingChoiceScreen } from "@/features/profile/OnboardingChoiceScreen"
import { QuestionnaireScreen } from "@/features/profile/QuestionnaireScreen"
import { ProfileSetupScreen } from "@/features/profile/ProfileSetupScreen"
import { ChatScreen } from "@/features/coaching/ChatScreen"
import { SettingsScreen } from "@/features/settings/SettingsScreen"
import { ContentBrowsePage } from "@/features/content/ContentBrowsePage"
import { ContentDetailPage } from "@/features/content/ContentDetailPage"
import { ContentAdminPage } from "@/features/admin/ContentAdminPage"
import { getProfileStatus, triggerCategorization } from "@/lib/profile-api"
import { apiRequest } from "@/lib/api-client"
import { readAccessToken } from "@/features/auth/storage"
import { useAuthContext } from "@/features/auth/AuthContext"
import type { User } from "@/features/auth/types"
import { getBackendBaseUrl } from "@/lib/config"
import { Button } from "@/components/ui/button"

const API_BASE = getBackendBaseUrl()

// ── Toast notification (minimal, for B3 redirect) ────────────────────────────

function LocationToast() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (state?.toast) {
      setToast(state.toast)
      // Clear the state so it doesn't re-trigger on back navigation
      window.history.replaceState({}, "")
      const timer = setTimeout(() => setToast(null), 3000)
      return () => clearTimeout(timer)
    }
  }, [location.state])

  if (!toast) return null

  return (
    <div className="fixed bottom-4 left-1/2 z-50 -translate-x-1/2 rounded-lg border border-border bg-card px-4 py-2.5 text-sm text-foreground shadow-lg animate-in fade-in slide-in-from-bottom-2">
      {toast}
    </div>
  )
}

// ── Stale profile modal ──────────────────────────────────────────────────────

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

// ── Ingestion page (handles internal processing/onboarding/questionnaire state) ──

type IngestionPhase = "profile_setup" | "ingestion" | "processing" | "onboarding" | "questionnaire"
type QuestionnaireMode = "quick" | "thorough"

function IngestionPage({ user }: { user: User }) {
  const token = readAccessToken()
  const navigate = useNavigate()
  const { updateUser } = useAuthContext()
  // If user has no first name, start at profile_setup; otherwise check categorization status
  const [phase, setPhase] = useState<IngestionPhase>(
    !user.firstName ? "profile_setup" : "ingestion",
  )
  const [questionnaireMode, setQuestionnaireMode] = useState<QuestionnaireMode>("quick")
  const [showStaleModal, setShowStaleModal] = useState(false)

  useEffect(() => {
    // Only check profile status if we're past the profile_setup phase
    if (!token || phase === "profile_setup") return
    void getProfileStatus(token).then(async (data) => {
      if (["queued", "categorizing", "generating_insights"].includes(data.status)) {
        setPhase("processing")
      } else if (data.status === "not_started") {
        // If confirmed uploads already exist, auto-trigger and go to processing
        if (data.currentUploadsFingerprint) {
          try {
            await triggerCategorization(token)
          } catch { /* best-effort */ }
          setPhase("processing")
        } else {
          setPhase("onboarding")
        }
      } else if (data.status === "complete") {
        void navigate("/chat", { replace: true })
      }
      // failed / other → stay on ingestion
    }).catch(() => { /* stay on ingestion */ })
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, phase === "profile_setup"])

  const handleConfirmAll = useCallback(async () => {
    if (!token) return
    try {
      await apiRequest(API_BASE, "/ingestion/confirm-all", { method: "POST", token })
      // Check if a profile already exists (complete status + fingerprints differ → stale)
      const statusData = await getProfileStatus(token)
      if (
        statusData.status === "complete" &&
        statusData.uploadsFingerprint !== null &&
        statusData.uploadsFingerprint !== statusData.currentUploadsFingerprint
      ) {
        setShowStaleModal(true)
      } else {
        setPhase("processing")
      }
    } catch { /* stay */ }
  }, [token])

  const handleQuestionnaireComplete = useCallback(async () => {
    if (!token) return
    // Questionnaire directly builds the profile - no background job needed.
    // Navigate straight to /chat, same as the file-ingestion path.
    void navigate("/chat", { replace: true })
  }, [token, navigate])

  if (!token) return null

  if (phase === "profile_setup") {
    return (
      <ProfileSetupScreen
        onComplete={(firstName, lastName) => {
          updateUser({ firstName, lastName })
          setPhase("ingestion")
        }}
      />
    )
  }

  if (phase === "processing") {
    return (
      <ProcessingScreen
        user={user}
        token={token}
        onBack={() => setPhase("ingestion")}
        onComplete={() => void navigate("/chat", { replace: true })}
      />
    )
  }
  if (phase === "onboarding") {
    return (
      <OnboardingChoiceScreen
        user={user}
        onChooseFiles={() => setPhase("ingestion")}
        onChooseQuestionnaire={() => { setQuestionnaireMode("quick"); setPhase("questionnaire") }}
        onSignOut={async () => { /* handled by shell */ }}
      />
    )
  }
  if (phase === "questionnaire") {
    return (
      <QuestionnaireScreen
        user={user}
        token={token}
        mode={questionnaireMode}
        onComplete={() => void handleQuestionnaireComplete()}
        onBack={() => setPhase("onboarding")}
      />
    )
  }

  return (
    <>
      <IngestionScreen
        user={user}
        onSignOut={async () => { /* handled by shell */ }}
        onConfirmAll={() => void handleConfirmAll()}
      />
      {showStaleModal && (
        <StaleProfileModal
          onUpdate={() => {
            setShowStaleModal(false)
            setPhase("processing")
          }}
          onDismiss={() => {
            setShowStaleModal(false)
            void navigate("/chat", { replace: true })
          }}
        />
      )}
    </>
  )
}

// ── Profile page ──

function ProfilePage({ user }: { user: User }) {
  const token = readAccessToken()
  const navigate = useNavigate()
  if (!token) return null
  return (
    <ProfileScreen
      user={user}
      token={token}
      onAddDocuments={() => void navigate("/")}
      onNavigateToChat={() => void navigate("/chat")}
      onSignOut={async () => { /* handled by shell */ }}
      onNoProfile={() => void navigate("/", { replace: true })}
      onRetrigger={() => void navigate("/")}
    />
  )
}

// ── /chat/about/:slug wrapper — pre-fills topic into ChatScreen ──

function ChatAboutPage() {
  const { slug } = useParams<{ slug: string }>()
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"
  return (
    <ChatScreen
      onNavigateBack={() => history.back()}
      locale={locale}
      initialTopic={slug ?? undefined}
    />
  )
}

// We need useParams here for ChatAboutPage
import { useParams } from "react-router-dom"

// ── Learn routes (shared between public and authed shells) ───────────────────

function LearnRoutes() {
  return (
    <Routes>
      <Route index element={<ContentBrowsePage />} />
      <Route path="q/:query" element={<ContentBrowsePage />} />
      <Route path="t/*" element={<ContentBrowsePage />} />
      <Route path=":slug" element={<ContentDetailPage />} />
    </Routes>
  )
}

// ── Protected app wrapper (renders shell + routes only when authenticated) ──

function AuthedRoutes({ user, signOut, updateUser }: { user: User; signOut: () => Promise<void>; updateUser: (updated: Partial<User>) => void }) {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"
  return (
    <AuthContext.Provider value={{ user, signOut, updateUser }}>
      <AppShell>
        <Routes>
          <Route path="/" element={<IngestionPage user={user} />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          <Route path="/chat" element={<ChatScreen onNavigateBack={() => history.back()} locale={locale} />} />
          <Route path="/chat/about/:slug" element={<ChatAboutPage />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/learn/*" element={<LearnRoutes />} />
          {user.isAdmin && (
            <Route path="/admin/content" element={<ContentAdminPage />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthContext.Provider>
  )
}

// ── Public learn routes (unauthenticated, uses PublicShell) ──

function PublicLearnRoutes() {
  return (
    <PublicShell>
      <LearnRoutes />
    </PublicShell>
  )
}

// ── Root ──

function AppRoutes() {
  const auth = useAuth()
  const { t } = useTranslation()
  const location = useLocation()

  // Public /learn routes — accessible regardless of auth state.
  // If the user IS authenticated, they get the full AppShell (handled inside AuthedRoutes).
  // If NOT authenticated, they get PublicShell.
  if (location.pathname === "/learn" || location.pathname.startsWith("/learn/")) {
    if (auth.initialized && auth.isAuthenticated && auth.user) {
      return (
        <>
          <LocationToast />
          <AuthedRoutes user={auth.user} signOut={auth.signOut} updateUser={auth.updateUser} />
        </>
      )
    }
    return (
      <>
        <LocationToast />
        <PublicLearnRoutes />
      </>
    )
  }

  if (!auth.initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
      </main>
    )
  }

  if (!auth.isAuthenticated || !auth.user) {
    return (
      <AuthScreen
        mode={auth.mode}
        loading={auth.loading}
        error={auth.error}
        googleFallback={auth.googleFallback}
        onModeChange={auth.setMode}
        onSubmit={auth.submit}
        onGoogle={auth.beginGoogle}
      />
    )
  }

  return (
    <>
      <LocationToast />
      <AuthedRoutes user={auth.user} signOut={auth.signOut} updateUser={auth.updateUser} />
    </>
  )
}

export function App() {
  return (
    <BrowserRouter>
      <AppRoutes />
    </BrowserRouter>
  )
}

export default App
