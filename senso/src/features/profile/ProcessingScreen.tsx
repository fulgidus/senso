import { CheckCircle2, Circle, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"
import { useProfileStatus } from "./useProfileStatus"
import type { CategorizationStatus } from "@/lib/profile-api"

export type { CategorizationStatus }

type Step = {
  labelKey: string
  activeAt: CategorizationStatus[]
  doneAt: CategorizationStatus[]
}

const STEPS: Step[] = [
  {
    labelKey: "processing.stepCategorising",
    activeAt: ["queued", "categorizing"],
    doneAt: ["generating_insights", "complete"],
  },
  {
    labelKey: "processing.stepPatterns",
    activeAt: ["generating_insights"],
    doneAt: ["complete"],
  },
  {
    labelKey: "processing.stepInsights",
    activeAt: ["generating_insights"],
    doneAt: ["complete"],
  },
  {
    labelKey: "processing.stepProfile",
    activeAt: [],
    doneAt: ["complete"],
  },
]

function getStepState(
  step: Step,
  status: CategorizationStatus,
): "done" | "active" | "pending" {
  if (step.doneAt.includes(status)) return "done"
  if (step.activeAt.includes(status)) return "active"
  return "pending"
}

function progressPercent(status: CategorizationStatus): number {
  const map: Record<CategorizationStatus, number> = {
    not_started: 0,
    queued: 10,
    categorizing: 40,
    generating_insights: 75,
    complete: 100,
    failed: 0,
  }
  return map[status] ?? 0
}

type Props = {
  user: User
  token: string
  onBack: () => void
  onComplete: () => void
}

export function ProcessingScreen({ token, onBack, onComplete }: Props) {
  const { t } = useTranslation()
  const { status, errorMessage } = useProfileStatus({
    token,
    onComplete,
    enabled: true,
  })

  const isFailed = status === "failed"

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      {/* Processing card - narrower, centered */}
      <div className="mx-auto max-w-[480px]">
        <div className="rounded-2xl border border-border bg-card p-6">
          {isFailed ? (
            <>
              <h2 className="mb-2 text-xl font-semibold text-foreground">
                {t("processing.headingFailed")}
              </h2>
              <p className="mb-4 text-sm text-destructive">
                {errorMessage ?? t("processing.bodyFailed")}
              </p>
              <Button variant="default" onClick={onBack}>
                {t("processing.returnToUploads")}
              </Button>
            </>
          ) : (
            <>
              <h2 className="mb-1 text-xl font-semibold text-foreground">
                {t("processing.headingAnalysing")}
              </h2>
              <p className="mb-6 text-sm text-muted-foreground">
                {t("processing.subtitleAnalysing")}
              </p>

              {/* Step list */}
              <ol className="mb-6 space-y-3">
                {STEPS.map((step) => {
                  const state = getStepState(step, status)
                  return (
                    <li key={step.labelKey} className="flex items-center gap-3">
                      {state === "done" ? (
                        <CheckCircle2 className="h-5 w-5 shrink-0 text-green-600" />
                      ) : state === "active" ? (
                        <Loader2 className="h-5 w-5 shrink-0 animate-spin text-primary" />
                      ) : (
                        <Circle className="h-5 w-5 shrink-0 text-muted-foreground" />
                      )}
                      <span
                        className={
                          state === "active"
                            ? "text-sm font-medium text-foreground"
                            : state === "done"
                              ? "text-sm text-muted-foreground line-through"
                              : "text-sm text-muted-foreground"
                        }
                      >
                        {t(step.labelKey)}
                      </span>
                    </li>
                  )
                })}
              </ol>

              {/* Progress bar */}
              <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-500"
                  style={{ width: `${progressPercent(status)}%` }}
                />
              </div>

              {/* Come back later */}
              <Button
                variant="ghost"
                className="text-sm text-muted-foreground"
                onClick={onBack}
              >
                {t("processing.comeBackLater")}
              </Button>
            </>
          )}
        </div>
      </div>
    </main>
  )
}
