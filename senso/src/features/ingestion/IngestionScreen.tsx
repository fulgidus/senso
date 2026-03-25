import { useState, useCallback } from "react"
import type { User } from "@/features/auth/types"
import { readAccessToken } from "@/features/auth/storage"
import { useIngestion } from "./useIngestion"
import { UploadZone } from "./UploadZone"
import { FileList } from "./FileList"
import { InspectModal } from "./InspectModal"
import { RetryDialog } from "./RetryDialog"

type Props = {
  user: User
  onSignOut: () => Promise<void>
  onConfirmAll?: () => void
}

export function IngestionScreen({ user, onSignOut, onConfirmAll }: Props) {
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
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-8 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">S.E.N.S.O.</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Welcome, {user.email}. Upload your financial documents to get started.
          </p>
        </div>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => void onSignOut()}
        >
          Sign out
        </button>
      </div>

      {/* Upload zone */}
      <section className="mb-6 rounded-2xl border border-border bg-card p-6">
        <h2 className="mb-4 text-base font-semibold text-foreground">Upload Document</h2>
        <UploadZone onFile={(f) => void upload(f)} uploading={uploading} />
        {error && <p className="mt-2 text-sm text-destructive">{error}</p>}
      </section>

      {/* File list */}
      <section className="rounded-2xl border border-border bg-card p-6">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-base font-semibold text-foreground">
            Uploaded Documents
            {uploads.length > 0 && (
              <span className="ml-2 text-sm font-normal text-muted-foreground">
                ({uploads.length})
              </span>
            )}
          </h2>
          {loading && (
            <span className="text-xs text-muted-foreground animate-pulse">Refreshing...</span>
          )}
          {!loading && uploads.length > 0 && allConfirmed && (
            <span className="text-xs text-green-600 font-medium">All confirmed ✓</span>
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
