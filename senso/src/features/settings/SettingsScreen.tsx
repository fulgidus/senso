import { useState } from "react"
import { LogOut, Save } from "lucide-react"
import { useAuthContext } from "@/features/auth/AuthContext"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"
import { updateMe } from "@/features/auth/session"
import { readAccessToken } from "@/features/auth/storage"
import { UserAvatar } from "@/components/UserAvatar"
import { getDisplayName } from "@/lib/user-avatar"

type ThemeOption = "light" | "dark" | "system"

const THEME_OPTIONS: { value: ThemeOption; label: string }[] = [
  { value: "light", label: "Chiaro" },
  { value: "dark", label: "Scuro" },
  { value: "system", label: "Sistema" },
]

export function SettingsScreen() {
  const { user, signOut, updateUser } = useAuthContext()
  const { theme, setTheme } = useTheme()

  const [firstName, setFirstName] = useState(user.firstName ?? "")
  const [lastName, setLastName] = useState(user.lastName ?? "")
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)

  const isDirty =
    firstName.trim() !== (user.firstName ?? "") ||
    lastName.trim() !== (user.lastName ?? "")

  const handleSave = async () => {
    if (!firstName.trim()) return
    setSaving(true)
    setSaveError(null)
    setSaveSuccess(false)
    try {
      const token = readAccessToken()
      if (!token) throw new Error("Not authenticated")
      const updated = await updateMe(token, {
        firstName: firstName.trim(),
        lastName: lastName.trim() || null,
      })
      updateUser(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError("Errore durante il salvataggio. Riprova.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-10 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Impostazioni</h1>
        <p className="mt-1 text-sm text-muted-foreground">Gestisci il tuo account e le preferenze</p>
      </div>

      {/* Account section */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Account</h2>

        <div className="flex items-center gap-4">
          <UserAvatar user={user} size="lg" />
          <div>
            <p className="text-sm font-medium text-foreground">{getDisplayName(user)}</p>
            <p className="text-xs text-muted-foreground mt-0.5">{user.email}</p>
          </div>
        </div>

        {/* Name fields */}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div className="space-y-1">
            <label className="block text-sm text-muted-foreground">
              Nome <span className="text-destructive">*</span>
            </label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              placeholder="Il tuo nome"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
          <div className="space-y-1">
            <label className="block text-sm text-muted-foreground">Cognome</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              placeholder="Il tuo cognome (opzionale)"
              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
            />
          </div>
        </div>

        {saveError && <p className="text-sm text-destructive">{saveError}</p>}
        {saveSuccess && (
          <p className="text-sm text-green-600 dark:text-green-400">Profilo aggiornato.</p>
        )}

        <Button
          variant="default"
          disabled={!firstName.trim() || !isDirty || saving}
          onClick={() => void handleSave()}
          className="w-full sm:w-auto"
        >
          <Save className="h-4 w-4 mr-2" />
          {saving ? "Salvataggio..." : "Salva modifiche"}
        </Button>

        {/* Read-only email */}
        <div className="space-y-1 pt-2 border-t border-border">
          <label className="block text-sm text-muted-foreground">Email</label>
          <input
            type="text"
            readOnly
            value={user.email}
            className="w-full rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground cursor-not-allowed"
          />
        </div>
      </section>

      {/* Appearance section */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-4">
        <h2 className="text-base font-semibold text-foreground">Aspetto</h2>
        <div>
          <p className="text-sm text-muted-foreground mb-3">Tema colori</p>
          <div className="flex gap-2 flex-wrap">
            {THEME_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setTheme(opt.value)}
                className={[
                  "rounded-lg border px-4 py-2 text-sm font-medium transition-colors",
                  theme === opt.value
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-background text-muted-foreground hover:bg-accent hover:text-accent-foreground",
                ].join(" ")}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Premi <kbd className="rounded border border-border px-1 py-0.5 font-mono text-xs">D</kbd> in qualsiasi schermata per cambiare tema rapidamente
          </p>
        </div>
      </section>

      {/* App info */}
      <section className="rounded-2xl border border-border bg-card p-6 space-y-2">
        <h2 className="text-base font-semibold text-foreground">Informazioni</h2>
        <p className="text-sm text-muted-foreground">
          <strong className="text-foreground">S.E.N.S.O.</strong> — Sistema Educativo per Numeri, Spese e Obiettivi
        </p>
        <p className="text-xs text-muted-foreground">
          Assistente finanziario educativo. Non fornisce consulenza finanziaria professionale.
        </p>
      </section>

      {/* Sign out */}
      <section className="rounded-2xl border border-destructive/20 bg-destructive/5 p-6">
        <h2 className="text-base font-semibold text-foreground mb-2">Sessione</h2>
        <p className="text-sm text-muted-foreground mb-4">
          Esci dal tuo account su questo dispositivo.
        </p>
        <Button
          variant="destructive"
          onClick={() => void signOut()}
          className="w-full sm:w-auto"
        >
          <LogOut className="h-4 w-4 mr-2" />
          Esci dall'account
        </Button>
      </section>
    </div>
  )
}
