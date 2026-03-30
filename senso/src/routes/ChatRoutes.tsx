import { useEffect, useState } from "react"
import { Routes, Route, Navigate, useNavigate, useParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { ChatScreen } from "@/features/coaching/ChatScreen"
import { getProfile } from "@/lib/profile-api"
import { listSessions } from "@/features/coaching/coachingApi"
import { readAccessToken } from "@/features/auth/storage"

// ── Loading screen ───────────────────────────────────────────────────────────

function LoadingScreen() {
  const { t } = useTranslation()
  return (
    <main className="flex min-h-screen items-center justify-center">
      <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
    </main>
  )
}

// ── Profile-ready gate ───────────────────────────────────────────────────────
// Runs once at the /chat/* level. Checks that the profile is confirmed
// before allowing any chat child route to render.

function useProfileReady(): { ready: boolean; checking: boolean } {
  const token = readAccessToken()
  const navigate = useNavigate()
  const { t } = useTranslation()
  const [state, setState] = useState<"checking" | "ready" | "rejected">("checking")

  useEffect(() => {
    if (!token) {
      setState("rejected")
      return
    }
    let cancelled = false
    getProfile(token)
      .then((profile) => {
        if (cancelled) return
        if (profile?.confirmed) {
          setState("ready")
        } else {
          navigate("/", { replace: true, state: { toast: t("app.profileRequired") } })
          setState("rejected")
        }
      })
      .catch(() => {
        if (cancelled) return
        navigate("/", { replace: true, state: { toast: t("app.profileRequired") } })
        setState("rejected")
      })
    return () => { cancelled = true }
  }, [token, navigate, t])

  return { ready: state === "ready", checking: state === "checking" }
}

// ── Session resolver (index route) ───────────────────────────────────────────
// /chat → sessions.length > 0 → /chat/{lastSessionId}; else → /chat/new

function SessionResolver() {
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    listSessions()
      .then((sessions) => {
        if (sessions.length > 0) {
          // Sessions are sorted by updated_at desc — first is most recent
          setTarget(`/chat/${sessions[0].id}`)
        } else {
          setTarget("/chat/new")
        }
      })
      .catch(() => {
        // On error, go to new chat
        setTarget("/chat/new")
      })
  }, [])

  if (!target) return <LoadingScreen />
  return <Navigate to={target} replace />
}

// ── /chat/new ────────────────────────────────────────────────────────────────

function NewChatPage() {
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"
  const navigate = useNavigate()

  return (
    <ChatScreen
      onNavigateBack={() => history.back()}
      locale={locale}
      onSessionCreated={(id) => navigate(`/chat/${id}`, { replace: true })}
    />
  )
}

// ── /chat/:sessionId ─────────────────────────────────────────────────────────

function SessionChatPage() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"

  if (!sessionId) return <Navigate to="/chat/new" replace />

  return (
    <ChatScreen
      key={sessionId}
      onNavigateBack={() => history.back()}
      locale={locale}
      sessionId={sessionId}
    />
  )
}

// ── /chat/about/:slug ────────────────────────────────────────────────────────

function AboutChatPage() {
  const { slug } = useParams<{ slug: string }>()
  const { i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"
  const navigate = useNavigate()

  return (
    <ChatScreen
      onNavigateBack={() => history.back()}
      locale={locale}
      initialTopic={slug ?? undefined}
      onSessionCreated={(id) => navigate(`/chat/${id}`, { replace: true })}
    />
  )
}

// ── ChatRoutes subrouter ─────────────────────────────────────────────────────

export function ChatRoutes() {
  const { ready, checking } = useProfileReady()

  if (checking) return <LoadingScreen />
  if (!ready) return null // redirect already fired by hook

  return (
    <Routes>
      <Route index element={<SessionResolver />} />
      <Route path="new" element={<NewChatPage />} />
      <Route path="about/:slug" element={<AboutChatPage />} />
      <Route path=":sessionId" element={<SessionChatPage />} />
      <Route path="*" element={<Navigate to="/chat" replace />} />
    </Routes>
  )
}
