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
import { ProfileSetupScreen } from "@/features/profile/ProfileSetupScreen"
import { ChatScreen } from "@/features/coaching/ChatScreen"
import { SettingsScreen } from "@/features/settings/SettingsScreen"
import { getProfileStatus } from "@/lib/profile-api"
import { apiRequest } from "@/lib/api-client"
import { readAccessToken } from "@/features/auth/storage"
import { useAuthContext } from "@/features/auth/AuthContext"
import type { User } from "@/features/auth/types"

const API_BASE = import.meta.env.VITE_API_URL ?? "http://localhost:8000"

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

  useEffect(() => {
    // Only check profile status if we're past the profile_setup phase
    if (!token || phase === "profile_setup") return
    void getProfileStatus(token).then((data) => {
      if (["queued", "categorizing", "generating_insights"].includes(data.status)) {
        setPhase("processing")
      } else if (data.status === "not_started") {
        setPhase("onboarding")
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
      setPhase("processing")
    } catch { /* stay */ }
  }, [token])

  const handleQuestionnaireComplete = useCallback(async () => {
    if (!token) return
    // Questionnaire directly builds the profile — no background job needed.
    // Navigate straight to /profile without going through ProcessingScreen.
    void navigate("/profile", { replace: true })
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
      onNoProfile={() => void navigate("/", { replace: true })}
    />
  )
}

// ── Protected app wrapper (renders shell + routes only when authenticated) ──

function AuthedRoutes({ user, signOut, updateUser }: { user: User; signOut: () => Promise<void>; updateUser: (updated: Partial<User>) => void }) {
  return (
    <AuthContext.Provider value={{ user, signOut, updateUser }}>
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
      <AuthedRoutes user={auth.user} signOut={auth.signOut} updateUser={auth.updateUser} />
    </BrowserRouter>
  )
}

export default App
