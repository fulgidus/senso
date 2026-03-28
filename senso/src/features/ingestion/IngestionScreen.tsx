import { useState, useCallback } from "react"
import { useTranslation } from "react-i18next"
import type { User } from "@/features/auth/types"
import { readAccessToken } from "@/features/auth/storage"
import { useIngestion } from "./useIngestion"
import { UploadZone } from "./UploadZone"
import { FileList } from "./FileList"
import { InspectModal } from "./InspectModal"
import { RetryDialog } from "./RetryDialog"

type Props = {
  user: User
  onSignOut?: () => Promise<void>
  onConfirmAll?: () => void
}

export function IngestionScreen({ user, onConfirmAll }: Props) {
  const { t } = useTranslation()
  const effectiveGender: "masculine" | "feminine" | "neutral" =
    user.voiceGender && user.voiceGender !== "indifferent"
      ? (user.voiceGender as "masculine" | "feminine" | "neutral")
      : "neutral"
  const token = readAccessToken()
  const {
    uploads,
    loading,
    uploading,
    error,
    allConfirmed,
    upload,
    confirmOne,
    confirmAll,
    retry,
    report,
    remove,
    getExtracted,
  } = useIngestion(token)

  const [inspectId, setInspectId] = useState<string | null>(null)
  const [retryId, setRetryId] = useState<string | null>(null)

  const handleRetry = useCallback(
    async (uploadId: string, hint?: string) => {
      await retry(uploadId, hint)
    },
    [retry],
  )

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">{t("ingestion.heading")}</h2>
        <p className="mt-1 text-sm text-muted-foreground">
          {t(`ingestion.welcomeSubtitle.${effectiveGender}`, { email: user.email })}
        </p>
      </div>

      {/* Upload zone */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">
          {t("ingestion.uploadSectionTitle")}
        </h2>
        <UploadZone onFiles={(files) => { files.forEach((f) => void upload(f)) }} uploading={uploading} />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      {/* File list */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            {t("ingestion.uploadedSectionTitle")}
            {uploads.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({uploads.length})
              </span>
            )}
          </h2>
          {loading && (
            <span className="text-xs text-muted-foreground animate-pulse">
              {t("ingestion.refreshing")}
            </span>
          )}
          {!loading && uploads.length > 0 && allConfirmed && (
            <span className="text-xs text-green-600 font-medium">
              {t("ingestion.allConfirmed")}
            </span>
          )}
        </div>
        <FileList
          uploads={uploads}
          allConfirmed={allConfirmed}
          onInspect={setInspectId}
          onRetry={setRetryId}
          onReport={(id) => void report(id)}
          onRemove={(id) => void remove(id)}
          onConfirmOne={(id) => void confirmOne(id)}
          onConfirmAll={() => { void confirmAll(); onConfirmAll?.() }}
        />
      </section>

      {/* Modals */}
      <InspectModal
        uploadId={inspectId}
        onClose={() => setInspectId(null)}
        getExtracted={getExtracted}
      />
      <RetryDialog
        uploadId={retryId}
        onClose={() => setRetryId(null)}
        onRetry={handleRetry}
      />
    </main>
  )
}
