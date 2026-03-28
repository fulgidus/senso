import { BrowserRouter, Routes, Route, Navigate, useNavigate } from "react-router-dom"
import { useCallback, useEffect, useState } from "react"
import { AuthScreen } from "@/features/auth/AuthScreen"
import { useAuth } from "@/features/auth/useAuth"
import { AuthContext } from "@/features/auth/AuthContext"
import { AppShell } from "@/components/AppShell"
import { IngestionScreen } from "@/features/ingestion/IngestionScreen"
import { ProcessingScreen } from "@/features/profile/ProcessingScreen"
import { ProfileScreen } from "@/features/profile/ProfileScreen"
import { OnboardingChoiceScreen } from "@/features/profile/OnboardingChoiceScreen"
import { QuestionnaireScreen } from "@/features/profile/QuestionnaireScreen"
import { ChatScreen } from "@/features/coaching/ChatScreen"
import { SettingsScreen } from "@/features/settings/SettingsScreen"
import { getProfileStatus, triggerCategorization } from "@/lib/profile-api"
import { apiRequest } from "@/lib/api-client"
import { readAccessToken } from "@/features/auth/storage"
import type { User } from "@/features/auth/types"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

// ── Ingestion page (handles internal processing/onboarding/questionnaire state) ──

type IngestionPhase = "ingestion" | "processing" | "onboarding" | "questionnaire"
type QuestionnaireMode = "quick" | "thorough"

function IngestionPage({ user }: { user: User }) {
  const token = readAccessToken()
  const navigate = useNavigate()
  const [phase, setPhase] = useState<IngestionPhase>("ingestion")
  const [questionnaireMode, setQuestionnaireMode] = useState<QuestionnaireMode>("quick")

  useEffect(() => {
    if (!token) return
    void getProfileStatus(token).then((data) => {
      if (["queued", "categorizing", "generating_insights"].includes(data.status)) {
        setPhase("processing")
      } else if (data.status === "complete") {
        void navigate("/profile", { replace: true })
      } else if (data.status === "not_started") {
        setPhase("onboarding")
      }
    }).catch(() => { /* stay on ingestion */ })
  }, [token, navigate])

  const handleConfirmAll = useCallback(async () => {
    if (!token) return
    try {
      await apiRequest(API_BASE, "/ingestion/confirm-all", { method: "POST", token })
      setPhase("processing")
    } catch { /* stay */ }
  }, [token])

  const handleQuestionnaireComplete = useCallback(async () => {
    if (!token) return
    try { await triggerCategorization(token) } catch { /* best-effort */ }
    setPhase("processing")
  }, [token])

  if (!token) return null

  if (phase === "processing") {
    return (
      <ProcessingScreen
        user={user}
        token={token}
        onBack={() => setPhase("ingestion")}
        onComplete={() => void navigate("/profile", { replace: true })}
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
    <IngestionScreen
      user={user}
      onSignOut={async () => { /* handled by shell */ }}
      onConfirmAll={() => void handleConfirmAll()}
    />
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
    />
  )
}

// ── Protected app wrapper (renders shell + routes only when authenticated) ──

function AuthedRoutes({ user, signOut }: { user: User; signOut: () => Promise<void> }) {
  return (
    <AuthContext.Provider value={{ user, signOut }}>
      <AppShell>
        <Routes>
          <Route path="/" element={<IngestionPage user={user} />} />
          <Route path="/profile" element={<ProfilePage user={user} />} />
          <Route path="/chat" element={<ChatScreen onNavigateBack={() => history.back()} locale="it" />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthContext.Provider>
  )
}

// ── Root ──

export function App() {
  const auth = useAuth()

  if (!auth.initialized) {
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">Loading session...</p>
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
    <BrowserRouter>
      <AuthedRoutes user={auth.user} signOut={auth.signOut} />
    </BrowserRouter>
  )
}

export default App
