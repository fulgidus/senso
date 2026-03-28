import { useState } from "react"
import type { FormEvent } from "react"

import { Button } from "@/components/ui/button"

type AuthScreenProps = {
  mode: "signup" | "login"
  loading: boolean
  error: string | null
  googleFallback: string | null
  onModeChange: (mode: "signup" | "login") => void
  onSubmit: (email: string, password: string) => Promise<void>
  onGoogle: () => Promise<void>
}

export function AuthScreen({
  mode,
  loading,
  error,
  onModeChange,
  onSubmit,
}: AuthScreenProps) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault()
    await onSubmit(email, password)
  }

  const isLogin = mode === "login"
  const heading = isLogin ? "Welcome back" : "Create your account"
  const body = isLogin
    ? "Sign in to access your financial coaching workspace."
    : "Sign up to get started with your financial coaching workspace."

  return (
    <main className="mx-auto flex min-h-screen w-full max-w-xl items-center justify-center px-6 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-6 shadow-sm md:p-8">
        <header className="space-y-2">
          <h1 className="text-[28px] leading-[1.2] font-semibold">{heading}</h1>
          <p className="text-base leading-[1.5] text-muted-foreground">{body}</p>
        </header>

        <div className="mt-6 grid grid-cols-2 gap-2 rounded-lg bg-secondary p-1">
          <button
            type="button"
            className={`h-11 rounded-md text-sm font-semibold ${
              mode === "login" ? "bg-accent text-white" : "text-foreground"
            }`}
            onClick={() => onModeChange("login")}
          >
            Sign in
          </button>
          <button
            type="button"
            className={`h-11 rounded-md text-sm font-semibold ${
              mode === "signup" ? "bg-accent text-white" : "text-foreground"
            }`}
            onClick={() => onModeChange("signup")}
          >
            Sign up
          </button>
        </div>

        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <label className="block space-y-2">
            <span className="text-sm leading-[1.5] font-semibold">Email</span>
            <input
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>

          <label className="block space-y-2">
            <span className="text-sm leading-[1.5] font-semibold">Password</span>
            <input
              className="h-11 w-full rounded-md border border-input bg-background px-3 text-base"
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={8}
              required
            />
          </label>

          <Button className="h-11 w-full text-sm font-semibold" disabled={loading}>
            {isLogin ? "Sign in" : "Create account"}
          </Button>
        </form>

        <Button
          variant="outline"
          className="mt-4 h-11 w-full text-sm font-semibold opacity-50 cursor-not-allowed"
          disabled
          title="Google sign-in is not available yet"
        >
          Continue with Google
        </Button>

        {error && (
          <p className="mt-4 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm leading-[1.5] text-destructive">
            {error}
          </p>
        )}
      </section>
    </main>
  )
}
