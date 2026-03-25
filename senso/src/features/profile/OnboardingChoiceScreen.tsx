import { FileUp, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"

type Props = {
  user: User
  onChooseFiles: () => void
  onChooseQuestionnaire: () => void
  onSignOut: () => Promise<void>
}

export function OnboardingChoiceScreen({
  user,
  onChooseFiles,
  onChooseQuestionnaire,
  onSignOut,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">S.E.N.S.O.</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => void onSignOut()}
        >
          Sign out
        </button>
      </div>

      <div className="mx-auto max-w-[480px]">
        <h2 className="mb-6 text-xl font-semibold text-foreground text-center">
          How should we build your profile?
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Option 1: From files */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              From your files
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              Use documents you&apos;ve already uploaded.
            </p>
            <Button variant="default" className="w-full" onClick={onChooseFiles}>
              Use my uploads
            </Button>
          </div>

          {/* Option 2: Questionnaire */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              Answer a few questions
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              Quick 3-question setup or a fuller 7–10 question profile.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={onChooseQuestionnaire}
            >
              Start questionnaire
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
