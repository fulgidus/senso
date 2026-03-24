import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"

type AuthedHomeProps = {
  user: User
  onSignOut: () => Promise<void>
}

export function AuthedHome({ user, onSignOut }: AuthedHomeProps) {
  return (
    <main className="mx-auto flex min-h-screen w-full max-w-2xl items-center justify-center px-6 py-12">
      <section className="w-full rounded-2xl border border-border bg-card p-8 shadow-sm">
        <h1 className="text-[28px] leading-[1.2] font-semibold text-foreground">
          Welcome to S.E.N.S.O.
        </h1>
        <p className="mt-3 text-base leading-[1.5] text-muted-foreground">
          Signed in as <span className="font-semibold text-foreground">{user.email}</span>
        </p>

        <div className="mt-6 rounded-lg bg-secondary p-4 text-sm leading-[1.5]">
          Your account is active. Next phases will connect document upload and financial
          coaching flows.
        </div>

        <Button
          variant="outline"
          className="mt-6 h-11 min-w-44 text-sm font-semibold"
          onClick={() => {
            void onSignOut()
          }}
        >
          Sign out
        </Button>
      </section>
    </main>
  )
}
