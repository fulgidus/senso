import { FileUp, MessageSquare, Zap } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"

type Props = {
  user: User
  onChooseFiles: () => void
  onChooseQuizThorough: () => void
  onChooseQuizQuick: () => void
  onSignOut?: () => Promise<void>
}

export function OnboardingChoiceScreen({
  onChooseFiles,
  onChooseQuizThorough,
  onChooseQuizQuick,
}: Props) {
  const { t } = useTranslation()

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="mx-auto max-w-[640px]">
        <h2 className="mb-6 text-xl font-semibold text-foreground text-center">
          {t("onboarding.heading")}
        </h2>

        <div className="grid gap-4 sm:grid-cols-3">
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

          {/* Option 2: Thorough questionnaire (recommended) */}
          <div className="rounded-2xl border-2 border-primary/50 bg-card p-6 hover:border-primary transition-colors ring-1 ring-primary/20">
            <div className="mb-3 flex justify-center">
              <MessageSquare className="h-8 w-8 text-primary" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              {t("onboarding.quizThoroughTitle")}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              {t("onboarding.quizThoroughBody")}
            </p>
            <Button variant="default" className="w-full" onClick={onChooseQuizThorough}>
              {t("onboarding.quizThoroughCta")}
            </Button>
          </div>

          {/* Option 3: Quick questionnaire */}
          <div className="rounded-2xl border-2 border-border bg-card p-6 hover:border-primary transition-colors">
            <div className="mb-3 flex justify-center">
              <Zap className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="mb-2 text-base font-semibold text-foreground text-center">
              {t("onboarding.quizQuickTitle")}
            </h3>
            <p className="mb-4 text-sm text-muted-foreground text-center">
              {t("onboarding.quizQuickBody")}
            </p>
            <Button
              variant="outline"
              className="w-full"
              onClick={onChooseQuizQuick}
            >
              {t("onboarding.quizQuickCta")}
            </Button>
          </div>
        </div>
      </div>
    </main>
  )
}
