import { useEffect, useState } from "react"
import { RefreshCw, Search, Trash2 } from "lucide-react"
import { useTranslation } from "react-i18next"
import { listUploads, deleteUpload, retryUpload, type UploadFile } from "@/api/ingestionFilesApi"
import { useLocaleFormat } from "@/hooks/useLocaleFormat"

type Props = {
  token: string
  isAdmin: boolean
  onInspect?: (uploadId: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(1)} KB`
}

function StatusBadge({ status, t }: { status: string; t: (key: string) => string }) {
  const classMap: Record<string, string> = {
    pending: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    queued: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300",
    processing: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
    done: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    failed: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  }

  const labelMap: Record<string, string> = {
    pending: t("files.statusPending"),
    queued: t("files.statusQueued"),
    processing: t("files.statusProcessing"),
    done: t("files.statusDone"),
    failed: t("files.statusFailed"),
  }

  const cls = classMap[status] ?? "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300"
  const label = labelMap[status] ?? status

  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

export function FilesTab({ token, isAdmin, onInspect }: Props) {
  const { t } = useTranslation()
  const fmt = useLocaleFormat()
  const [files, setFiles] = useState<UploadFile[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionLoading, setActionLoading] = useState<Record<string, boolean>>({})

  const loadFiles = () => {
    setLoading(true)
    setError(null)
    listUploads(token)
      .then((result) => setFiles(result))
      .catch(() => setError(t("files.loadError")))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    loadFiles()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const setItemLoading = (id: string, val: boolean) =>
    setActionLoading((prev) => ({ ...prev, [id]: val }))

  const handleRetry = async (file: UploadFile) => {
    setItemLoading(file.id, true)
    try {
      await retryUpload(token, file.id)
      loadFiles()
    } finally {
      setItemLoading(file.id, false)
    }
  }

  const handleDelete = async (file: UploadFile) => {
    if (!window.confirm(t("files.confirmDelete"))) return
    setItemLoading(file.id, true)
    try {
      await deleteUpload(token, file.id)
      setFiles((prev) => prev.filter((f) => f.id !== file.id))
    } finally {
      setItemLoading(file.id, false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-14 animate-pulse rounded-xl bg-muted" />
        ))}
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col items-center gap-3 py-8 text-center">
        <p className="text-sm text-destructive">{error}</p>
        <button
          onClick={loadFiles}
          className="rounded-lg border border-border px-3 py-1.5 text-sm hover:bg-muted"
        >
          {t("files.retry")}
        </button>
      </div>
    )
  }

  if (files.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">{t("files.empty")}</p>
    )
  }

  return (
    <ul className="space-y-2">
      {files.map((file) => {
        const busy = actionLoading[file.id] ?? false
        const canRetry =
          file.extraction_status === "failed" || file.extraction_status === "pending"
        const uploadDate = fmt.date(new Date(file.uploaded_at))

        return (
          <li
            key={file.id}
            className="flex flex-col gap-2 rounded-xl border border-border bg-card px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
          >
            {/* File info */}
            <div className="flex min-w-0 flex-1 flex-col gap-1">
              <span
                className="truncate text-sm font-medium text-foreground"
                title={file.original_filename}
              >
                {file.original_filename.length > 40
                  ? `${file.original_filename.slice(0, 40)}…`
                  : file.original_filename}
              </span>
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <StatusBadge status={file.extraction_status} t={t} />
                <span>{uploadDate}</span>
                <span>{formatFileSize(file.size_bytes)}</span>
              </div>
            </div>

            {/* Action buttons */}
            <div className="flex shrink-0 items-center gap-1">
              {canRetry && (
                <button
                  disabled={busy}
                  onClick={() => void handleRetry(file)}
                  aria-label={t("files.retry")}
                  title={t("files.retry")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <RefreshCw className="h-4 w-4" />
                </button>
              )}
              <button
                disabled={busy}
                onClick={() => void handleDelete(file)}
                aria-label={t("files.delete")}
                title={t("files.delete")}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" />
              </button>
              {isAdmin && (
                <button
                  disabled={busy}
                  onClick={() => onInspect?.(file.id)}
                  aria-label={t("files.inspect")}
                  title={t("files.inspect")}
                  className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground disabled:opacity-50"
                >
                  <Search className="h-4 w-4" />
                </button>
              )}
            </div>
          </li>
        )
      })}
    </ul>
  )
}
