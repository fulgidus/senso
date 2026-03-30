import { useEffect, useState } from "react"
import { Navigate } from "react-router-dom"
import { useTranslation } from "react-i18next"
import { useAuthContext } from "@/features/auth/AuthContext"
import { getProfileStatus } from "@/lib/profile-api"
import { readAccessToken } from "@/features/auth/storage"

/**
 * "/" resolver — redirect-only, no UI of its own.
 *
 * Logic gates, evaluated in order:
 *   1. !user.firstName         → /setup
 *   2. profileStatus !== "complete" → /onboarding
 *   3. otherwise               → /chat
 *
 * Auth check is already handled at the AppRoutes level (unauthenticated
 * users never reach this component).
 */
export function RootResolver() {
  const { user } = useAuthContext()
  const token = readAccessToken()
  const { t } = useTranslation()
  const [target, setTarget] = useState<string | null>(null)

  useEffect(() => {
    // Gate 1: setup not done
    if (!user.firstName) {
      setTarget("/setup")
      return
    }

    // Gate 2: check profile status
    if (!token) {
      setTarget("/onboarding")
      return
    }

    void getProfileStatus(token)
      .then((data) => {
        if (data.status === "complete") {
          setTarget("/chat")
        } else {
          setTarget("/onboarding")
        }
      })
      .catch(() => {
        // On error, fall through to onboarding (safe default)
        setTarget("/onboarding")
      })
  }, [user.firstName, token])

  if (!target) {
    // Brief loading while we check profile status
    return (
      <main className="flex min-h-screen items-center justify-center">
        <p className="text-sm text-muted-foreground">{t("app.loading")}</p>
      </main>
    )
  }

  return <Navigate to={target} replace />
}
