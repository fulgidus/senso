import { useState } from "react"
import { useTranslation } from "react-i18next"
import { Button } from "@/components/ui/button"

type Props = {
  uploadId: string | null
  onClose: () => void
  onRetry: (uploadId: string, hint?: string) => Promise<void>
}

export function RetryDialog({ uploadId, onClose, onRetry }: Props) {
  const { t } = useTranslation()
  const [hint, setHint] = useState("")
  const [loading, setLoading] = useState(false)

  if (!uploadId) return null

  async function handleRetry() {
    if (!uploadId) return
    setLoading(true)
    try {
      await onRetry(uploadId, hint.trim() || undefined)
      setHint("")
      onClose()
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-xl">
        <h2 className="text-lg font-semibold text-foreground">{t("ingestion.retryTitle")}</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          {t("ingestion.retryBody")}
        </p>
        <textarea
          value={hint}
          onChange={(e) => setHint(e.target.value)}
          placeholder={t("ingestion.retryPlaceholder")}
          rows={3}
          className="mt-3 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground resize-none outline-none focus:ring-2 focus:ring-primary"
        />
        <div className="mt-4 flex justify-end gap-2">
          <Button variant="outline" onClick={onClose} disabled={loading}>
            {t("ingestion.retryCancel")}
          </Button>
          <Button onClick={() => void handleRetry()} disabled={loading}>
            {loading ? t("ingestion.retrying") : t("ingestion.retryButton")}
          </Button>
        </div>
      </div>
    </div>
  )
}
