import { useEffect, useState } from "react"
import { ChevronDown, ChevronRight, Clipboard, X } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  getExtracted,
  getTrace,
  type ExtractedDocumentDetail,
  type TraceStep,
} from "@/api/ingestionFilesApi"
import { useLocaleFormat } from "@/hooks/useLocaleFormat"

// ─── JSON Tree ─────────────────────────────────────────────────────────────────

type JsonValue = string | number | boolean | null | JsonObject | JsonArray
type JsonObject = { [key: string]: JsonValue }
type JsonArray = JsonValue[]

function JsonLeaf({ value }: { value: string | number | boolean | null }) {
  if (value === null) return <span className="text-gray-400">null</span>
  if (typeof value === "boolean")
    return <span className="text-orange-500">{String(value)}</span>
  if (typeof value === "number") return <span className="text-blue-500">{value}</span>
  return <span className="text-green-600 dark:text-green-400">"{value}"</span>
}

function JsonTree({
  data,
  depth = 0,
}: {
  data: JsonValue
  depth?: number
}) {
  const [open, setOpen] = useState(depth < 2)

  if (data === null || typeof data !== "object") {
    return <JsonLeaf value={data as string | number | boolean | null} />
  }

  const isArray = Array.isArray(data)
  const entries = isArray
    ? (data as JsonArray).map((v, i) => [String(i), v] as [string, JsonValue])
    : Object.entries(data as JsonObject)

  if (entries.length === 0) {
    return <span className="text-muted-foreground">{isArray ? "[]" : "{}"}</span>
  }

  return (
    <span>
      <button
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-0.5 text-muted-foreground hover:text-foreground"
        aria-label={open ? "collapse" : "expand"}
      >
        {open ? (
          <ChevronDown className="h-3 w-3" />
        ) : (
          <ChevronRight className="h-3 w-3" />
        )}
        <span className="text-xs">{isArray ? `[${entries.length}]` : `{…}`}</span>
      </button>
      {open && (
        <span className="ml-2 block border-l border-border pl-3">
          {entries.map(([key, val]) => (
            <span key={key} className="block">
              <span className="text-xs text-muted-foreground">{key}: </span>
              <JsonTree data={val} depth={depth + 1} />
            </span>
          ))}
        </span>
      )}
    </span>
  )
}

// ─── Copy Button ───────────────────────────────────────────────────────────────

function CopyButton({ data, label }: { data: unknown; label: string }) {
  const [copied, setCopied] = useState(false)
  const { t } = useTranslation()

  const handleCopy = () => {
    void navigator.clipboard.writeText(JSON.stringify(data, null, 2)).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    })
  }

  return (
    <button
      onClick={handleCopy}
      title={label}
      aria-label={label}
      className="inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
    >
      <Clipboard className="h-3 w-3" />
      {copied ? t("inspector.copied") : label}
    </button>
  )
}

// ─── Collapsible Section ───────────────────────────────────────────────────────

function Section({
  title,
  copyData,
  children,
  defaultOpen = true,
}: {
  title: string
  copyData?: unknown
  children: React.ReactNode
  defaultOpen?: boolean
}) {
  const [open, setOpen] = useState(defaultOpen)
  const { t } = useTranslation()

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex items-center justify-between px-4 py-2.5">
        <button
          onClick={() => setOpen((o) => !o)}
          className="flex items-center gap-1.5 text-sm font-medium text-foreground hover:text-primary"
        >
          {open ? (
            <ChevronDown className="h-4 w-4" />
          ) : (
            <ChevronRight className="h-4 w-4" />
          )}
          {title}
        </button>
        {copyData !== undefined && (
          <CopyButton data={copyData} label={t("inspector.copySection")} />
        )}
      </div>
      {open && <div className="border-t border-border px-4 pb-4 pt-3">{children}</div>}
    </div>
  )
}

// ─── Status Badge ──────────────────────────────────────────────────────────────

function TraceBadge({ status }: { status: string }) {
  const classMap: Record<string, string> = {
    success: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
    error: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
    skipped: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
  }
  const cls =
    classMap[status] ?? "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400"
  return (
    <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {status}
    </span>
  )
}

// ─── Main Drawer ───────────────────────────────────────────────────────────────

type Props = {
  uploadId: string
  token: string
  onClose: () => void
}

export function AdminInspectorDrawer({ uploadId, token, onClose }: Props) {
  const { t } = useTranslation()
  const fmt = useLocaleFormat()

  const [extracted, setExtracted] = useState<ExtractedDocumentDetail | null | undefined>(
    undefined,
  )
  const [trace, setTrace] = useState<TraceStep[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    setLoading(true)
    void Promise.all([getExtracted(token, uploadId), getTrace(token, uploadId)]).then(
      ([ext, tr]) => {
        setExtracted(ext)
        setTrace(tr)
        setLoading(false)
      },
    )
  }, [token, uploadId])

  const allData = { uploadId, extracted, trace }

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col overflow-y-auto bg-background/95 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={t("inspector.title")}
    >
      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between border-b border-border bg-background/90 px-6 py-4 backdrop-blur-sm">
        <h2 className="text-lg font-semibold text-foreground">{t("inspector.title")}</h2>
        <div className="flex items-center gap-2">
          <CopyButton data={allData} label={t("inspector.copyAll")} />
          <button
            onClick={onClose}
            aria-label={t("inspector.close")}
            title={t("inspector.close")}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="mx-auto w-full max-w-4xl space-y-4 px-6 py-6">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-24 animate-pulse rounded-xl bg-muted" />
            ))}
          </div>
        ) : (
          <>
            {/* Section 1: Upload metadata */}
            <Section
              title={t("inspector.sectionUpload")}
              copyData={{ uploadId }}
            >
              <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-xs text-muted-foreground">upload_id</dt>
                  <dd className="font-mono text-foreground">{uploadId}</dd>
                </div>
                {extracted && (
                  <>
                    <div>
                      <dt className="text-xs text-muted-foreground">extraction_status</dt>
                      <dd className="text-foreground">{extracted.document_type ?? "—"}</dd>
                    </div>
                    <div>
                      <dt className="text-xs text-muted-foreground">extracted_at</dt>
                      <dd className="text-foreground">
                        {fmt.date(new Date(extracted.extracted_at), { dateStyle: "medium", timeStyle: "short" })}
                       </dd>
                   </div>
                 </>
               )}
             </dl>
           </Section>

           {/* Section 2: Extracted document */}
            <Section
              title={t("inspector.sectionExtracted")}
              copyData={extracted ?? undefined}
            >
              {extracted === null ? (
                <p className="text-sm text-muted-foreground">{t("inspector.noExtracted")}</p>
              ) : extracted === undefined ? null : (
                <dl className="grid grid-cols-1 gap-x-6 gap-y-2 text-sm sm:grid-cols-2">
                  <div>
                    <dt className="text-xs text-muted-foreground">document_type</dt>
                    <dd className="text-foreground">{extracted.document_type}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">module_name</dt>
                    <dd className="text-foreground">{extracted.module_name}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">
                      {t("inspector.confidence")}
                    </dt>
                    <dd className="text-foreground">
                      {(extracted.confidence * 100).toFixed(1)}%
                    </dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">extracted_at</dt>
                    <dd className="text-foreground">
                      {fmt.date(new Date(extracted.extracted_at), { dateStyle: "medium", timeStyle: "short" })}
                    </dd>
                  </div>
                  {extracted.raw_text && (
                    <div className="col-span-2">
                      <dt className="mb-1 text-xs text-muted-foreground">raw_text</dt>
                      <dd>
                        <pre className="max-h-40 overflow-y-auto whitespace-pre-wrap rounded-lg bg-muted px-3 py-2 text-xs text-foreground">
                          {extracted.raw_text}
                        </pre>
                      </dd>
                    </div>
                  )}
                </dl>
              )}
            </Section>

            {/* Section 3: Payload JSON */}
            <Section
              title={t("inspector.sectionPayload")}
              copyData={extracted?.payload_json}
            >
              {extracted ? (
                <div className="overflow-x-auto rounded-lg bg-muted px-3 py-2 text-xs font-mono">
                  <JsonTree data={extracted.payload_json as JsonValue} />
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">{t("inspector.noExtracted")}</p>
              )}
            </Section>

            {/* Section 4: Transactions (bank statement only) */}
            {extracted &&
              typeof extracted.document_type === "string" &&
              extracted.document_type.includes("bank_statement") && (
                <Section
                  title={t("inspector.sectionTransactions")}
                  copyData={(extracted.payload_json as { transactions?: unknown }).transactions}
                >
                  {Array.isArray(
                    (extracted.payload_json as { transactions?: unknown[] }).transactions,
                  ) ? (
                    <ul className="space-y-1">
                      {(
                        extracted.payload_json as {
                          transactions: Array<Record<string, unknown>>
                        }
                      ).transactions.map((tx, i) => (
                        <li
                          key={i}
                          className="rounded-lg border border-border px-3 py-2 text-xs font-mono"
                        >
                          <JsonTree data={tx as JsonValue} depth={0} />
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <p className="text-sm text-muted-foreground">—</p>
                  )}
                </Section>
              )}

            {/* Section 5: Pipeline trace */}
            <Section
              title={t("inspector.sectionTrace")}
              copyData={trace}
              defaultOpen={trace.length > 0}
            >
              {trace.length === 0 ? (
                <p className="text-sm text-muted-foreground">—</p>
              ) : (
                <ol className="space-y-2">
                  {trace.map((step) => (
                    <TraceStepRow key={step.id} step={step} />
                  ))}
                </ol>
              )}
            </Section>
          </>
        )}
      </div>
    </div>
  )
}

// ─── Trace Step Row ────────────────────────────────────────────────────────────

function TraceStepRow({ step }: { step: TraceStep }) {
  const [open, setOpen] = useState(false)
  const { t } = useTranslation()

  return (
    <li className="rounded-xl border border-border bg-card">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center justify-between px-4 py-2.5 text-left"
      >
        <span className="flex items-center gap-2 text-sm">
          <span className="w-5 text-xs text-muted-foreground">{step.step_order}.</span>
          <span className="font-medium text-foreground">{step.step_name}</span>
          <TraceBadge status={step.status} />
          {step.duration_ms !== null && (
            <span className="text-xs text-muted-foreground">
              {t("inspector.durationMs", { ms: step.duration_ms })}
            </span>
          )}
        </span>
        {open ? (
          <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
        )}
      </button>

      {open && (
        <div className="border-t border-border px-4 pb-4 pt-3 space-y-3 text-xs">
          {step.input_summary && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">input_summary</p>
              <p className="text-foreground">{step.input_summary}</p>
            </div>
          )}
          {step.output_summary && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">output_summary</p>
              <p className="text-foreground">{step.output_summary}</p>
            </div>
          )}
          {step.raw_input && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">raw_input</p>
              <div className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono">
                <JsonTree data={step.raw_input as JsonValue} depth={0} />
              </div>
            </div>
          )}
          {step.raw_output && (
            <div>
              <p className="mb-1 font-medium text-muted-foreground">raw_output</p>
              <div className="overflow-x-auto rounded-lg bg-muted px-3 py-2 font-mono">
                <JsonTree data={step.raw_output as JsonValue} depth={0} />
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  )
}
