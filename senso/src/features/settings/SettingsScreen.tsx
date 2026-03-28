import { LogOut } from "lucide-react"
import { useAuthContext } from "@/features/auth/AuthContext"
import { useTheme } from "@/components/theme-provider"
import { Button } from "@/components/ui/button"

type ThemeOption = "light" | "dark" | "system"

const THEME_OPTIONS: { value: ThemeOption; label: string }[] = [
  { value: "light", label: "Chiaro" },
  { value: "dark", label: "Scuro" },
  { value: "system", label: "Sistema" },
]

export function SettingsScreen() {
  const { user, signOut } = useAuthContext()
  const { theme, setTheme } = useTheme()

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
          {/* Avatar placeholder */}
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground font-bold text-2xl select-none">
            {user.email.charAt(0).toUpperCase()}
          </div>
          <div>
            <p className="text-sm font-medium text-foreground">{user.email}</p>
            <p className="text-xs text-muted-foreground mt-0.5">
              Immagine profilo — prossimamente
            </p>
          </div>
        </div>

        <div className="space-y-2">
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
