import { AuthScreen } from "@/features/auth/AuthScreen"
import { AuthedHome } from "@/features/auth/AuthedHome"
import { useAuth } from "@/features/auth/useAuth"

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

  return <AuthedHome user={auth.user} onSignOut={auth.signOut} />
}

export default App
