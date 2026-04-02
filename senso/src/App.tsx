import { BrowserRouter, Routes, Route, Navigate, useNavigate, useLocation } from "react-router-dom"
import { useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { useAuth } from "@/features/auth/useAuth"
import { AuthContext } from "@/features/auth/AuthContext"
import { AppShell, PublicShell } from "@/components/AppShell"
import { ErrorBoundary } from "@/components/ErrorBoundary"
import { ProfileScreen } from "@/features/profile/ProfileScreen"
import { UncategorizedScreen } from "@/features/profile/UncategorizedScreen"
import { SettingsScreen } from "@/features/settings/SettingsScreen"
import { ContentBrowsePage } from "@/features/content/ContentBrowsePage"
import { ContentDetailPage } from "@/features/content/ContentDetailPage"
import { ContentAdminPage } from "@/features/admin/ContentAdminPage"
import { MerchantMapAdminPage } from "@/features/admin/MerchantMapAdminPage"
import { ModerationQueuePage } from "@/features/admin/ModerationQueuePage"
import { readAccessToken } from "@/features/auth/storage"
import type { User } from "@/features/auth/types"
import { AboutPage } from "@/features/about/AboutPage"
import { DebugScreen } from "@/features/debug/DebugScreen"

// Route modules
import { LoginPage } from "@/routes/LoginPage"
import { RootResolver } from "@/routes/RootResolver"
import { SetupPage } from "@/routes/SetupPage"
import { OnboardingRoutes } from "@/routes/OnboardingRoutes"
import { ChatRoutes } from "@/routes/ChatRoutes"
import { ProtectedRoute } from "@/components/ProtectedRoute"

// ── Toast notification (renders from location state) ─────────────────────────

function LocationToast() {
  const location = useLocation()
  const [toast, setToast] = useState<string | null>(null)

  useEffect(() => {
    const state = location.state as { toast?: string } | null
    if (state?.toast) {
      setToast(state.toast)
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

// ── Loading screen (reused for auth bootstrap) ──────────────────────────────

function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
    </main>
  )
}

// ── Learn routes (shared sub-router for /learn/*) ────────────────────────────

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

// ── Profile page (thin wrapper providing navigation callbacks) ───────────────

function ProfilePage({ user }: { user: User }) {
  const token = readAccessToken()
  const navigate = useNavigate()
  if (!token) return null
  return (
    <ProfileScreen
      user={user}
      token={token}
      onAddDocuments={() => navigate("/onboarding/upload")}
      onNavigateToChat={() => navigate("/chat")}
      onNoProfile={() => navigate("/", { replace: true })}
      onRetrigger={() => navigate("/onboarding/processing#start")}
    />
  )
}

// ── Root router ──────────────────────────────────────────────────────────────
//
// Four states, checked top-to-bottom:
//   1. /learn/* while unauthenticated → public shell
//   2. Auth not initialized yet → loading spinner
//   3. /login → <LoginPage /> (works for both auth states)
//   4. Not authenticated → redirect to /login#{currentPath}
//   5. Authenticated → app shell + route table using new route modules
//

function AppRoutes() {
  const auth = useAuth()
  const location = useLocation()

  const isLearnRoute = location.pathname === "/learn" || location.pathname.startsWith("/learn/")
  const isAboutRoute = location.pathname === "/about"
  const isLoginRoute = location.pathname === "/login"

  // ── State 1: Public /learn — no auth needed ──
  if (isLearnRoute && (!auth.initialized || !auth.isAuthenticated || !auth.user)) {
    return (
      <PublicShell>
        <LocationToast />
        <Routes>
          <Route path="/learn/*" element={<LearnRoutes />} />
          <Route path="*" element={<Navigate to="/learn" replace />} />
        </Routes>
      </PublicShell>
    )
  }

  // ── State 1b: Public /about — no auth needed ──
  if (isAboutRoute && (!auth.initialized || !auth.isAuthenticated || !auth.user)) {
    return (
      <PublicShell>
        <LocationToast />
        <Routes>
          <Route path="/about" element={<AboutPage />} />
          <Route path="*" element={<Navigate to="/about" replace />} />
        </Routes>
      </PublicShell>
    )
  }

  // ── State 2: Auth still bootstrapping (non-learn, non-login routes) ──
  if (!auth.initialized) return <LoadingScreen />

  // ── State 3: /login route — show login page regardless of auth state ──
  // LoginPage handles the redirect-on-auth internally.
  if (isLoginRoute) {
    return <LoginPage auth={auth} />
  }

  // ── State 4: Not authenticated → redirect to /login#{currentPath} ──
  if (!auth.isAuthenticated || !auth.user) {
    const returnUrl = location.pathname + location.search + location.hash
    const hash = returnUrl !== "/" ? `#${returnUrl}` : ""
    return <Navigate to={`/login${hash}`} replace />
  }

  // ── State 5: Authenticated — route table using new route modules ──
  const user = auth.user
  return (
    <AuthContext.Provider value={{ user, signOut: auth.signOut, updateUser: auth.updateUser }}>
      <AppShell>
        <LocationToast />
        <Routes>
          <Route path="/" element={<RootResolver />} />
          <Route path="/setup" element={<SetupPage />} />
          <Route path="/onboarding/*" element={<OnboardingRoutes />} />
          <Route path="/chat/*" element={<ErrorBoundary><ChatRoutes /></ErrorBoundary>} />
          <Route path="/profile" element={<ErrorBoundary><ProfilePage user={user} /></ErrorBoundary>} />
          <Route path="/profile/uncategorized" element={<ErrorBoundary><UncategorizedScreen /></ErrorBoundary>} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/learn/*" element={<LearnRoutes />} />
          {user.isAdmin && (
            <Route
              path="/admin/content"
              element={
                <ProtectedRoute adminOnly>
                  <ContentAdminPage />
                </ProtectedRoute>
              }
            />
          )}
          {user.isAdmin && (
            <Route
              path="/admin/merchant-map"
              element={
                <ProtectedRoute adminOnly>
                  <MerchantMapAdminPage />
                </ProtectedRoute>
              }
            />
          )}
          {user.isAdmin && (
            <Route
              path="/admin/moderation"
              element={
                <ProtectedRoute adminOnly>
                  <ModerationQueuePage />
                </ProtectedRoute>
              }
            />
          )}
          <Route path="/about" element={<AboutPage />} />
          {(user.isAdmin || user.role === "tester" || user.role === "admin") && (
            <Route path="/debug" element={<DebugScreen />} />
          )}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AppShell>
    </AuthContext.Provider>
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
