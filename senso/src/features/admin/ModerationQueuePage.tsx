/**
 * ModerationQueuePage.tsx — Admin page for reviewing moderation actions.
 *
 * Features:
 * - Filter: All | Pending review | Resolved
 * - Table per UI-SPEC Section 5
 * - Severity badges: warn=amber, remove=orange, ban=red
 * - Confirm / Revert buttons with inline confirmation
 */

import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Loader2 } from "lucide-react"
import {
  getModerationQueue,
  confirmModerationAction,
  revertModerationAction,
  type ModerationLogAdminDTO,
} from "./adminMerchantApi"

// ── Severity badge ────────────────────────────────────────────────────────────

function SeverityBadge({ severity }: { severity: string }) {
  const { t } = useTranslation()
  let cls = ""
  let label = severity

  switch (severity) {
    case "warn":
      cls = "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
      label = t("admin.moderation.severityWarn")
      break
    case "remove":
      cls = "bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-400"
      label = t("admin.moderation.severityRemove")
      break
    case "ban":
      cls = "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
      label = t("admin.moderation.severityBan")
      break
    default:
      cls = "bg-secondary text-secondary-foreground"
  }

  return (
    <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
      {label}
    </span>
  )
}

// ── Content type badge ────────────────────────────────────────────────────────

function ContentTypeBadge({ type }: { type: string }) {
  return (
    <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
      {type}
    </span>
  )
}

// ── Obfuscate user ID ─────────────────────────────────────────────────────────

function obfuscateUser(userId: string): string {
  if (userId.includes("@")) {
    const [local, domain] = userId.split("@")
    return `${local.slice(0, 1)}****@${domain}`
  }
  return userId.slice(0, 8) + "…"
}

// ── Relative date ─────────────────────────────────────────────────────────────

function relativeDate(isoString: string): string {
  const diffMs = Date.now() - new Date(isoString).getTime()
  const diffMin = Math.floor(diffMs / 60_000)
  if (diffMin < 1) return "adesso"
  if (diffMin < 60) return `${diffMin} min fa`
  const diffH = Math.floor(diffMin / 60)
  if (diffH < 24) return `${diffH} ore fa`
  const diffD = Math.floor(diffH / 24)
  return `${diffD} giorni fa`
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function ModerationQueuePage() {
  const { t } = useTranslation()

  const [items, setItems] = useState<ModerationLogAdminDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [statusFilter, setStatusFilter] = useState("")

  // Inline revert confirmation
  const [revertConfirmId, setRevertConfirmId] = useState<string | null>(null)
  const [processing, setProcessing] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await getModerationQueue(statusFilter || undefined)
      setItems(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : t("admin.moderation.loadError"))
    } finally {
      setLoading(false)
    }
  }, [statusFilter, t])

  useEffect(() => {
    void load()
  }, [load])

  const handleConfirm = useCallback(
    async (id: string) => {
      setProcessing(id)
      try {
        await confirmModerationAction(id)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : t("admin.moderation.loadError"))
      } finally {
        setProcessing(null)
      }
    },
    [load, t],
  )

  const handleRevert = useCallback(
    async (id: string) => {
      setProcessing(id)
      setRevertConfirmId(null)
      try {
        await revertModerationAction(id)
        await load()
      } catch (err) {
        setError(err instanceof Error ? err.message : t("admin.moderation.loadError"))
      } finally {
        setProcessing(null)
      }
    },
    [load, t],
  )

  const selectCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"

  return (
    <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-foreground">
          {t("admin.moderation.title")}
        </h1>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button className="ml-2 underline" onClick={() => setError(null)}>
            ✕
          </button>
        </div>
      )}

      {/* Filter */}
      <div className="mb-4 flex items-center gap-3">
        <select
          className={selectCls}
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
        >
          <option value="">{t("admin.moderation.filterAll")}</option>
          <option value="pending">{t("admin.moderation.filterPending")}</option>
          <option value="resolved">{t("admin.moderation.filterResolved")}</option>
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : items.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t("admin.moderation.noItems")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.moderation.colUser")}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.moderation.colType")}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.moderation.colViolations")}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.moderation.colSeverity")}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.moderation.colAction")}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                  {t("admin.moderation.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr
                  key={item.id}
                  className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                >
                  <td className="px-4 py-3">
                    <div className="text-xs font-medium text-foreground">
                      {obfuscateUser(item.user_id)}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {relativeDate(item.created_at)}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <ContentTypeBadge type={item.content_type} />
                  </td>
                  <td className="px-4 py-3 max-w-[200px]">
                    <div className="flex flex-wrap gap-1">
                      {item.detected_violations.map((v) => (
                        <span
                          key={v}
                          className="inline-flex rounded-full bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400 px-2 py-0.5 text-xs"
                        >
                          {v}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <SeverityBadge severity={item.severity} />
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {item.action_taken}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => void handleConfirm(item.id)}
                        disabled={processing === item.id}
                        className="rounded-md bg-primary px-2.5 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                      >
                        {processing === item.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : (
                          t("admin.moderation.confirmPenalty")
                        )}
                      </button>
                      {revertConfirmId === item.id ? (
                        <>
                          <button
                            onClick={() => void handleRevert(item.id)}
                            disabled={processing === item.id}
                            className="rounded-md bg-destructive px-2.5 py-1.5 text-xs font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 transition-colors"
                          >
                            {t("admin.moderation.confirmRevert")}
                          </button>
                          <button
                            onClick={() => setRevertConfirmId(null)}
                            className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                          >
                            ✕
                          </button>
                        </>
                      ) : (
                        <button
                          onClick={() => setRevertConfirmId(item.id)}
                          className="rounded-md border border-border px-2.5 py-1.5 text-xs text-muted-foreground hover:bg-accent transition-colors"
                        >
                          {t("admin.moderation.revertPenalty")}
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
