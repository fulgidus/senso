import { useState } from "react"
import { Button } from "@/components/ui/button"
import { updateMe } from "@/features/auth/session"
import { readAccessToken } from "@/features/auth/storage"

type Props = {
  onComplete: (firstName: string, lastName: string | null) => void
}

export function ProfileSetupScreen({ onComplete }: Props) {
  const [firstName, setFirstName] = useState("")
  const [lastName, setLastName] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const trimmedFirst = firstName.trim()
  const canSubmit = trimmedFirst.length > 0 && !loading

  const handleSubmit = async () => {
    if (!canSubmit) return
    setLoading(true)
    setError(null)
    const token = readAccessToken()
    if (!token) {
      setError("Sessione scaduta. Effettua di nuovo il login.")
      setLoading(false)
      return
    }
    try {
      await updateMe(token, {
        firstName: trimmedFirst,
        lastName: lastName.trim() || null,
      })
      onComplete(trimmedFirst, lastName.trim() || null)
    } catch {
      setError("Salvataggio non riuscito. Controlla la connessione e riprova.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      <div className="mx-auto max-w-[480px]">
        <h1 className="mb-2 text-2xl font-bold text-foreground">S.E.N.S.O.</h1>
        <p className="mb-8 text-sm text-muted-foreground">
          Prima di iniziare, come ti chiami?
        </p>

        <div className="rounded-2xl border border-border bg-card p-6 space-y-5">
          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="firstName">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              id="firstName"
              type="text"
              autoFocus
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="es. Marco"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-sm font-medium text-foreground" htmlFor="lastName">
              Cognome <span className="text-xs text-muted-foreground">(facoltativo)</span>
            </label>
            <input
              id="lastName"
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="es. Rossi"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>

          {error && <p className="text-sm text-destructive">{error}</p>}

          <Button
            className="w-full"
            disabled={!canSubmit}
            onClick={() => void handleSubmit()}
          >
            {loading ? "Salvataggio..." : "Continua"}
          </Button>
        </div>
      </div>
    </main>
  )
}
