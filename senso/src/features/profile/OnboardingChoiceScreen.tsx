import { FileUp, MessageSquare } from "lucide-react"
import { useTranslation } from "react-i18next"
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
  const { t } = useTranslation()

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="mx-auto max-w-[480px]">
        <h2 className="mb-6 text-xl font-semibold text-foreground text-center">
          {t("onboarding.heading")}
        </h2>

        <div className="grid gap-4 sm:grid-cols-2">
          {/* Option 1: From files */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <FileUp className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              {t("onboarding.fromFilesTitle")}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              {t("onboarding.fromFilesBody")}
            </p>
            <Button variant="default" className="w-full" onClick={onChooseFiles}>
              {t("onboarding.fromFilesCta")}
            </Button>
          </div>

          {/* Option 2: Questionnaire */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <MessageSquare className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              {t("onboarding.questionnaireTitle")}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              {t("onboarding.questionnaireBody")}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={onChooseQuestionnaire}
            >
              {t("onboarding.questionnaireCta")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
