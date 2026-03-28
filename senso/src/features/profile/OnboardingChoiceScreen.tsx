import { FileUp, MessageSquare } from "lucide-react"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"

type Props = {
  user: User
  onChooseFiles: () => void
  onChooseQuestionnaire: () => void
  onSignOut?: () => Promise<void>
}

export function OnboardingChoiceScreen({
  onChooseFiles,
  onChooseQuestionnaire,
}: Props) {
  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="mx-auto max-w-[480px]">
        <h2 className="mb-6 text-xl font-semibold text-foreground text-center">
          Come costruiamo il tuo profilo?
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Option 1: From files */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              Dai tuoi file
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              Usa i documenti che hai già caricato.
            </p>
            <Button variant="default" className="w-full" onClick={onChooseFiles}>
              Usa i miei upload
            </Button>
          </div>

          {/* Option 2: Questionnaire */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              Rispondi a qualche domanda
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              Setup rapido in 3 domande o profilo completo in 7–10 domande.
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={onChooseQuestionnaire}
            >
              Inizia il questionario
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
