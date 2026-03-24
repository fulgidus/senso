import { Button } from "@/components/ui/button"
import type { UploadStatus } from "./types"

type Props = {
  uploads: UploadStatus[]
  allConfirmed: boolean
  onInspect: (id: string) => void
  onRetry: (id: string) => void
  onReport: (id: string) => void
  onRemove: (id: string) => void
  onConfirmOne: (id: string) => void
  onConfirmAll: () => void
}

function ExtractionMethodCell({ upload }: { upload: UploadStatus }) {
  const { extractionStatus, extractionMethod, moduleSource } = upload

  if (extractionStatus === "failed") {
    return <span className="text-destructive text-sm">Failed</span>
  }
  if (extractionStatus === "provider_outage") {
    return <span className="text-destructive text-sm">System outage</span>
  }
  if (extractionStatus === "pending") {
    return (
      <span className="text-muted-foreground text-sm animate-pulse">Processing...</span>
    )
  }
  if (extractionStatus === "adaptive_failed") {
    return <span className="text-destructive text-sm">Adaptive failed</span>
  }
  if (!extractionMethod) {
    return <span className="text-muted-foreground text-sm">—</span>
  }

  if (extractionMethod.startsWith("module:") || extractionMethod.startsWith("adaptive:")) {
    const name = extractionMethod.replace(/^(module:|adaptive:)/, "")
    if (moduleSource === "generated") {
      return (
        <span className="text-sm flex items-center gap-1.5">
          <span className="rounded px-1.5 py-0.5 text-xs font-bold bg-amber-100 text-amber-700 border border-amber-300">
            {"{NEW}"}
          </span>
          Conversion module ({name})
        </span>
      )
    }
    if (moduleSource === "promoted") {
      return <span className="text-sm">Conversion module (promoted: {name})</span>
    }
    return <span className="text-sm">Conversion module ({name})</span>
  }
  if (extractionMethod === "ocr_text" || extractionMethod === "llm_text") {
    return <span className="text-sm">OCR → LLM text</span>
  }
  if (extractionMethod === "llm_vision") {
    return <span className="text-sm">LLM vision</span>
  }
  return <span className="text-sm">{extractionMethod}</span>
}

function canRetry(upload: UploadStatus): boolean {
  return (
    upload.extractionStatus === "failed" ||
    upload.extractionStatus === "adaptive_failed" ||
    upload.extractionStatus === "provider_outage" ||
    upload.moduleSource === "generated"
  )
}

export function FileList({
  uploads,
  onInspect,
  onRetry,
  onReport,
  onRemove,
  onConfirmOne,
  onConfirmAll,
}: Props) {
  if (uploads.length === 0) {
    return (
      <p className="text-center text-sm text-muted-foreground py-8">
        No files uploaded yet. Drop a file above to get started.
      </p>
    )
  }

  const allEligibleConfirmed = uploads
    .filter((u) => u.extractionStatus === "success")
    .every((u) => u.confirmed)

  const hasAnySuccess = uploads.some((u) => u.extractionStatus === "success")

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-lg border border-border">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-secondary/50">
              <th className="px-4 py-3 text-left font-semibold text-foreground">File</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Type</th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">
                Extraction Method
              </th>
              <th className="px-4 py-3 text-left font-semibold text-foreground">Actions</th>
            </tr>
          </thead>
          <tbody>
            {uploads.map((upload) => (
              <tr
                key={upload.id}
                className="border-b border-border last:border-0 hover:bg-secondary/20"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2">
                    {upload.confirmed && (
                      <span className="text-green-600 font-bold" title="Confirmed">
                        ✓
                      </span>
                    )}
                    <span
                      className="font-medium text-foreground truncate max-w-[200px]"
                      title={upload.originalFilename}
                    >
                      {upload.originalFilename}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-muted-foreground text-xs">
                  {upload.contentType}
                </td>
                <td className="px-4 py-3">
                  <ExtractionMethodCell upload={upload} />
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center gap-1.5 flex-wrap">
                    {/* Inspect — always shown but disabled when not success */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs"
                      onClick={() => onInspect(upload.id)}
                      disabled={upload.extractionStatus !== "success"}
                    >
                      Inspect
                    </Button>
                    {/* Retry — per D-36: failed | adaptive_failed | provider_outage | generated */}
                    {canRetry(upload) && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onRetry(upload.id)}
                      >
                        Retry
                      </Button>
                    )}
                    {/* Individual Confirm — success + not yet confirmed */}
                    {upload.extractionStatus === "success" && !upload.confirmed && (
                      <Button
                        size="sm"
                        className="h-7 text-xs"
                        onClick={() => onConfirmOne(upload.id)}
                      >
                        Confirm
                      </Button>
                    )}
                    {/* Report — success only per D-36 */}
                    {upload.extractionStatus === "success" && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 text-xs text-muted-foreground"
                        onClick={() => onReport(upload.id)}
                      >
                        Report
                      </Button>
                    )}
                    {/* Remove — always shown */}
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      onClick={() => onRemove(upload.id)}
                    >
                      Remove
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Confirm all / All confirmed — only show when there are eligible files */}
      {hasAnySuccess && (
        <div className="flex justify-end">
          <Button
            disabled={allEligibleConfirmed}
            onClick={onConfirmAll}
            className="min-w-36"
          >
            {allEligibleConfirmed ? "All confirmed" : "Confirm all"}
          </Button>
        </div>
      )}
    </div>
  )
}
