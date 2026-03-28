import { useCallback, useEffect, useMemo, useState } from "react"

import {
  bootstrapSession,
  login,
  logout,
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

function loginErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code = (err.data as { code?: string } | null)?.code
    if (err.status === 401 || code === "invalid_credentials") {
      return "Email o password non corretti."
    }
    if (err.status === 429) {
      return "Troppi tentativi. Aspetta qualche minuto e riprova."
    }
    if (err.status >= 500) {
      return "Il server non risponde. Riprova tra poco."
    }
  }
  return "Accesso non riuscito. Controlla la connessione e riprova."
}

function signupErrorMessage(err: unknown): string {
  if (err instanceof ApiClientError) {
    const code = (err.data as { code?: string } | null)?.code
    if (err.status === 409 || code === "email_in_use") {
      return "Questa email è già registrata. Prova ad accedere."
    }
    if (err.status === 422) {
      return "Dati non validi. Controlla email e password (minimo 8 caratteri)."
    }
    if (err.status >= 500) {
      return "Il server non risponde. Riprova tra poco."
    }
  }
  return "Registrazione non riuscita. Controlla la connessione e riprova."
}

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
      } catch (err) {
        const message =
          state.mode === "signup" ? signupErrorMessage(err) : loginErrorMessage(err)
        setState((current) => ({ ...current, loading: false, error: message }))
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
        googleFallback: "Accesso con Google non disponibile. Usa email e password.",
      }))
    } catch {
      setState((current) => ({
        ...current,
        loading: false,
        error: "Accesso con Google non riuscito. Usa email e password.",
      }))
    }
  }, [])

  const updateUser = useCallback((updated: Partial<User>) => {
    setState((current) => ({
      ...current,
      user: current.user ? { ...current.user, ...updated } : current.user,
    }))
  }, [])

  const signOut = useCallback(async () => {
    const confirmed = window.confirm("Vuoi davvero uscire dal tuo account su questo dispositivo?")
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
      updateUser,
      isAuthenticated: Boolean(state.user),
    }),
    [beginGoogle, setMode, signOut, updateUser, state, submit],
  )
}
