import { CheckCircle2, Circle, FileText, Loader2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"
import { useProfileStatus } from "./useProfileStatus"
import type { CategorizationStatus, ProgressFile } from "@/lib/profile-api"

export type { CategorizationStatus }

function coarseProgressPercent(status: CategorizationStatus): number {
  const map: Record<CategorizationStatus, number> = {
    not_started: 0,
    queued: 5,
    categorizing: 40,
    generating_insights: 80,
    complete: 100,
    failed: 0,
  }
  return map[status] ?? 0
}

function FileRow({ file, t }: { file: ProgressFile; t: (k: string, opts?: Record<string, unknown>) => string }) {
  return (
    <li className="flex items-center gap-3 py-1">
      {file.status === "done" ? (
        <CheckCircle2 className="h-4 w-4 shrink-0 text-green-600" />
      ) : file.status === "processing" ? (
        <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
      ) : (
        <Circle className="h-4 w-4 shrink-0 text-muted-foreground/50" />
      )}
      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span
        className={
          file.status === "done"
            ? "min-w-0 flex-1 truncate text-sm text-muted-foreground"
            : file.status === "processing"
              ? "min-w-0 flex-1 truncate text-sm font-medium text-foreground"
              : "min-w-0 flex-1 truncate text-sm text-muted-foreground/60"
        }
        title={file.name}
      >
        {file.name}
      </span>
      {file.status === "done" && file.txn_count != null && (
        <span className="shrink-0 text-xs text-muted-foreground">
          {t("processing.txnCount", { count: file.txn_count })}
        </span>
      )}
    </li>
  )
}

type Props = {
  user: User
  token: string
  onBack: () => void
  onComplete: () => void
}

export function ProcessingScreen({ token, onBack, onComplete }: Props) {
  const { t } = useTranslation()
  const { status, errorMessage, progressDetail } = useProfileStatus({
    token,
    onComplete,
    enabled: true,
  })

  const isFailed = status === "failed"

  // Determine progress bar value
  const progressPct =
    progressDetail && progressDetail.txn_total > 0
      ? Math.round((progressDetail.txn_categorised / progressDetail.txn_total) * 85) // cap at 85% until insights done
      : status === "generating_insights"
        ? 85
        : status === "complete"
          ? 100
          : coarseProgressPercent(status)

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
              <p className="mb-4 text-sm text-muted-foreground">
                {t("processing.subtitleAnalysing")}
              </p>

              {/* File list — shown when backend provides per-file detail */}
              {progressDetail && progressDetail.files.length > 0 ? (
                <ul className="mb-4 space-y-0.5 rounded-xl border border-border bg-muted/40 px-4 py-3">
                  {progressDetail.files.map((file) => (
                    <FileRow key={file.id} file={file} t={t} />
                  ))}
                </ul>
              ) : (
                /* Fallback: coarse step indicator while waiting for first progress tick */
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{t("processing.stepCategorising")}</span>
                </div>
              )}

              {/* Current step detail text */}
              {progressDetail?.current_step_detail && (
                <p className="mb-4 text-xs text-muted-foreground">
                  {progressDetail.current_step_detail}
                </p>
              )}

              {/* Generating insights indicator */}
              {status === "generating_insights" && (
                <div className="mb-4 flex items-center gap-2 text-sm text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin text-primary" />
                  <span>{t("processing.stepInsights")}</span>
                </div>
              )}

              {/* Progress bar */}
              <div className="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
                <div
                  className="h-full rounded-full bg-primary transition-all duration-700"
                  style={{ width: `${progressPct}%` }}
                />
              </div>

              {/* Txn counter */}
              {progressDetail && progressDetail.txn_total > 0 && (
                <p className="mb-4 text-center text-xs tabular-nums text-muted-foreground">
                  {progressDetail.txn_categorised} / {progressDetail.txn_total}{" "}
                  {t("processing.transactionsLabel")}
                </p>
              )}

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
