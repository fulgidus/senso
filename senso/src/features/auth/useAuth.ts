import { useCallback, useEffect, useMemo, useState } from "react"

import {
  bootstrapSession,
  login,
  logout,
  signup,
  startGoogle,
} from "@/features/auth/session"
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
  mode: "signup",
  user: null,
  error: null,
  googleFallback: null,
}

export const ERROR_COPY =
  "We couldn’t complete sign-in right now. Try again, or use email and password to continue."

export function useAuth() {
  const [state, setState] = useState<AuthState>(initialState)

  useEffect(() => {
    let isMounted = true
    const run = async () => {
      const result = await bootstrapSession()
      if (!isMounted) {
        return
      }

      setState((current) => ({
        ...current,
        initialized: true,
        user: result.status === "authenticated" ? result.user : null,
      }))
    }

    void run()
    return () => {
      isMounted = false
    }
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
      } catch {
        setState((current) => ({ ...current, loading: false, error: ERROR_COPY }))
      }
    },
    [state.mode],
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
        googleFallback: ERROR_COPY,
      }))
    } catch {
      setState((current) => ({ ...current, loading: false, error: ERROR_COPY }))
    }
  }, [])

  const signOut = useCallback(async () => {
    const confirmed = window.confirm(
      "Sign out: Are you sure you want to sign out on this device?",
    )
    if (!confirmed) {
      return
    }
    await logout()
    setState((current) => ({
      ...current,
      user: null,
      error: null,
      googleFallback: null,
    }))
  }, [])

  return useMemo(
    () => ({
      ...state,
      setMode,
      submit,
      beginGoogle,
      signOut,
      isAuthenticated: Boolean(state.user),
    }),
    [beginGoogle, setMode, signOut, state, submit],
  )
}
