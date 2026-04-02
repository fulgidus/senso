import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import { useNavigate } from "react-router-dom"

import {
  bootstrapSession,
  login,
  logout,
  makeOnUnauthorized,
  signup,
  startGoogle,
} from "@/features/auth/session"
import { ApiClientError } from "@/lib/api-client"
import type { User } from "@/features/auth/types"

type AuthMode = "signup" | "login"

type AuthState = {
  initialized: boolean
  loading: boolean
  mode: AuthMode
  user: User | null
  error: string | null
  googleFallback: string | null
}

const initialState: AuthState = {
  initialized: false,
  loading: false,
  mode: "login",
  user: null,
  error: null,
  googleFallback: null,
}

function loginErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code = (err.data as { code?: string } | null)?.code
    if (err.status === 401 || code === "invalid_credentials") return "auth.errorInvalidCredentials"
    if (err.status === 429) return "auth.errorTooManyAttempts"
    if (err.status >= 500) return "auth.errorServerDown"
  }
  return "auth.errorLoginFailed"
}

function signupErrorKey(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code = (err.data as { code?: string } | null)?.code
    if (err.status === 409 || code === "email_in_use") return "auth.errorEmailInUse"
    if (err.status === 422) return "auth.errorInvalidData"
    if (err.status >= 500) return "auth.errorServerDown"
  }
  return "auth.errorSignupFailed"
}

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState)
  const { t } = useTranslation()
  const navigate = useNavigate()

  const onUnauthorized = useMemo(
    () => makeOnUnauthorized((to) => navigate(to)),
    [navigate],
  )

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      const result = await bootstrapSession()
      if (!isMounted) return
      setState((current) => ({
        ...current,
        initialized: true,
        user: result.status === "authenticated" ? result.user : null,
      }))
    }
    void run()
    return () => { isMounted = false }
  }, [])

  const setMode = useCallback((mode: AuthMode) => {
    setState((current) => ({ ...current, mode, error: null, googleFallback: null }))
  }, [])

  const submit = useCallback(
    async (email: string, password: string) => {
      setState((current) => ({ ...current, loading: true, error: null }))
      try {
        const result =
          state.mode === "signup"
            ? await signup(email, password)
            : await login(email, password)
        setState((current) => ({
          ...current,
          loading: false,
          user: result.user,
          googleFallback: null,
        }))
      } catch (err) {
        const key = state.mode === "signup" ? signupErrorKey(err) : loginErrorKey(err)
        setState((current) => ({ ...current, loading: false, error: t(key) }))
      }
    },
    [state.mode, t],
  )

  const beginGoogle = useCallback(async () => {
    setState((current) => ({ ...current, loading: true, error: null }))
    try {
      const result = await startGoogle()
      if (result.kind === "redirect") {
        window.location.assign(result.authUrl)
        return
      }
      setState((current) => ({
        ...current,
        loading: false,
        googleFallback: t("auth.errorGoogleUnavailable"),
      }))
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: t("auth.errorGoogleFailed"),
      }))
    }
  }, [t])

  const updateUser = useCallback((updated: Partial<User>) => {
    setState((current) => ({
      ...current,
      user: current.user ? { ...current.user, ...updated } : current.user,
    }))
  }, [])

  const signOut = useCallback(async () => {
    const confirmed = window.confirm(t("auth.confirmSignOut"))
    if (!confirmed) return
    await logout()
    setState((current) => ({
      ...current,
      user: null,
      error: null,
      googleFallback: null,
    }))
  }, [t])

  return useMemo(
    () => ({
      ...state,
      setMode,
      submit,
      beginGoogle,
      signOut,
      updateUser,
      onUnauthorized,
      isAuthenticated: Boolean(state.user),
    }),
    [beginGoogle, onUnauthorized, setMode, signOut, updateUser, state, submit],
  )
}
