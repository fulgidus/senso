import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, ArrowDownLeft, ArrowUpRight, ArrowLeftRight, CheckCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  getUncategorized,
  bulkUpdateCategoryByDescription,
  type UncategorizedTransactionDTO,
} from "@/lib/profile-api"
import { readAccessToken } from "@/features/auth/storage"
import { useLocaleFormat } from "@/hooks/useLocaleFormat"

const VALID_CATEGORIES = [
  "dining",
  "donations",
  "extraordinary_income",
  "fast_food",
  "food_delivery",
  "groceries",
  "health",
  "housing",
  "income",
  "interest",
  "internal_transfer",
  "personal_care",
  "pets",
  "savings",
  "shopping",
  "subscriptions",
  "tech_tools",
  "telecom",
  "transfers",
  "transport",
  "uncategorized",
  "utilities",
]

// ── Actor group: all transactions sharing the same description ────────────────
type ActorGroup = {
  description: string
  counterpart_name: string | null
  transactions: UncategorizedTransactionDTO[]
  totalAmount: number
  // net sign: positive = money in, negative = money out
  netAmount: number
  dominantType: "income" | "expense" | "transfer" | null
}

function groupByActor(transactions: UncategorizedTransactionDTO[]): ActorGroup[] {
  const groups = new Map<string, UncategorizedTransactionDTO[]>()

  for (const txn of transactions) {
    const key = txn.description ?? "(no description)"
    const existing = groups.get(key) ?? []
    existing.push(txn)
    groups.set(key, existing)
  }

  return Array.from(groups.entries())
    .map(([description, txns]) => {
      const net = txns.reduce((sum, t) => sum + (t.amount ?? 0), 0)
      const total = txns.reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0)

      // dominant type by count
      const typeCounts: Record<string, number> = {}
      for (const t of txns) {
        if (t.type) typeCounts[t.type] = (typeCounts[t.type] ?? 0) + 1
      }
      const dominantType = (Object.entries(typeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ??
        null) as ActorGroup["dominantType"]

      return {
        description,
        counterpart_name: txns[0].counterpart_name ?? null,
        transactions: txns,
        totalAmount: total,
        netAmount: net,
        dominantType,
      }
    })
    .sort((a, b) => {
      // Most frequent first, then highest total volume
      if (b.transactions.length !== a.transactions.length)
        return b.transactions.length - a.transactions.length
      return b.totalAmount - a.totalAmount
    })
}

type GroupState = {
  saving: boolean
  success: boolean
  error: string | null
  category: string
  updatedCount?: number
}

function looksLikePrivateIndividual(name: string): boolean {
  if (!name) return false
  const businessIndicators = /\b(srl|spa|sas|snc|banca|bank|poste|amazon|google|apple|netflix|spotify|telecom|vodafone|tim|enel|eni|fineco|unicredit|intesa|sanpaolo|bnl|bnp|paypal|stripe|klarna)\b/i
  if (businessIndicators.test(name)) return false
  // If all words are title-cased and no business indicators, likely a person
  const words = name.trim().split(/\s+/)
  return words.length >= 2 && words.every(w => /^[A-ZÁÀÈÉÌÍÒÓÙÚ][a-záàèéìíòóùú]+$/.test(w))
}

function DirectionIcon({ type }: { type: ActorGroup["dominantType"] }) {
  if (type === "income")
    return <ArrowDownLeft className="h-4 w-4 text-green-500 shrink-0" />
  if (type === "expense")
    return <ArrowUpRight className="h-4 w-4 text-red-400 shrink-0" />
  return <ArrowLeftRight className="h-4 w-4 text-muted-foreground shrink-0" />
}

export function UncategorizedScreen() {
  const { t } = useTranslation()
  const fmt = useLocaleFormat()
  const token = readAccessToken()

  const [transactions, setTransactions] = useState<UncategorizedTransactionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [groupStates, setGroupStates] = useState<Record<string, GroupState>>({})

  const loadData = useCallback(() => {
    if (!token) return
    setLoading(true)
    setLoadError(null)
    void getUncategorized(token)
      .then((data) => setTransactions(data))
      .catch(() => setLoadError(t("uncategorized.errorLoad")))
      .finally(() => setLoading(false))
  }, [token, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleBulkCategorize = useCallback(
    async (description: string, category: string) => {
      if (!token) return

      setGroupStates((prev) => ({
        ...prev,
        [description]: { saving: true, success: false, error: null, category },
      }))

      try {
        const result = await bulkUpdateCategoryByDescription(token, description, category)
        setGroupStates((prev) => ({
          ...prev,
          [description]: {
            saving: false,
            success: true,
            error: null,
            category,
            updatedCount: result.updated,
          },
        }))
        // Remove all matching transactions from the list after feedback fades
        setTimeout(() => {
          setTransactions((prev) => prev.filter((t) => t.description !== description))
          setGroupStates((prev) => {
            const next = { ...prev }
            delete next[description]
            return next
          })
        }, 1500)
      } catch {
        setGroupStates((prev) => ({
          ...prev,
          [description]: {
            saving: false,
            success: false,
            error: t("uncategorized.errorSave"),
            category: "",
          },
        }))
      }
    },
    [token, t],
  )

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="mb-4 h-6 w-24 animate-pulse rounded bg-muted" />
        <div className="mb-2 h-8 w-64 animate-pulse rounded bg-muted" />
        <div className="mb-6 h-4 w-48 animate-pulse rounded bg-muted" />
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <div key={i} className="animate-pulse rounded bg-muted h-16 mb-2" />
          ))}
        </div>
      </main>
    )
  }

  if (loadError) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <Link to="/profile" className="mb-4 inline-block text-sm text-primary hover:underline">
          ← {t("nav.profile")}
        </Link>
        <div className="mt-8 flex flex-col items-center gap-4 text-center">
          <AlertTriangle className="h-10 w-10 text-destructive" />
          <p className="text-sm text-destructive">{loadError}</p>
          <Button variant="ghost" onClick={loadData}>
            {t("uncategorized.reloadButton")}
          </Button>
        </div>
      </main>
    )
  }

  const groups = groupByActor(transactions)

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <Link to="/profile" className="mb-4 inline-block text-sm text-primary hover:underline">
        ← {t("nav.profile")}
      </Link>

      <div className="mb-6">
        <h2 className="text-xl font-semibold text-foreground">
          {t("uncategorized.pageTitle")}
        </h2>
        {transactions.length > 0 && (
          <p className="text-sm text-muted-foreground">
            {t("uncategorized.actorSubtitle", {
              groups: groups.length,
              transactions: transactions.length,
            })}
          </p>
        )}
      </div>

      {transactions.length === 0 ? (
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <CheckCircle className="h-10 w-10 text-primary" />
          <div>
            <p className="text-base font-semibold text-foreground">
              {t("uncategorized.emptyHeading")}
            </p>
            <p className="mt-1 text-sm text-muted-foreground">{t("uncategorized.emptyBody")}</p>
          </div>
        </div>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const state = groupStates[group.description]
            const isSuccess = state?.success
            const isSaving = state?.saving

            return (
              <div
                key={group.description}
                className={`rounded-xl border border-border bg-card px-4 py-3 transition-opacity ${
                  isSuccess ? "opacity-40" : ""
                }`}
              >
                <div className="flex items-start gap-3">
                  {/* Direction icon */}
                  <div className="mt-1">
                    <DirectionIcon type={group.dominantType} />
                  </div>

                  {/* Actor info */}
                  <div className="flex-1 min-w-0">
                    {/* Counterpart name — the "who" */}
                    <p className="text-sm font-semibold text-foreground truncate">
                      {group.counterpart_name ?? group.description ?? "—"}
                    </p>
                    {/* Privacy notice for likely-private individuals */}
                    {looksLikePrivateIndividual(group.counterpart_name ?? group.description ?? "") && (
                      <p className="text-xs text-amber-700 dark:text-amber-400 mt-0.5">
                        {t("profile.privateIndividualNotice")}
                      </p>
                    )}
                    {/* Raw description if different from counterpart */}
                    {group.counterpart_name &&
                      group.counterpart_name !== group.description && (
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {group.description}
                        </p>
                      )}
                    {/* Count + date range */}
                    <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                      <span>
                        {t("uncategorized.txnCount", { count: group.transactions.length })}
                      </span>
                      {group.transactions.length > 1 && (
                        <span>
                          {group.transactions[group.transactions.length - 1].date} →{" "}
                          {group.transactions[0].date}
                        </span>
                      )}
                      {group.transactions.length === 1 && group.transactions[0].date && (
                        <span>{group.transactions[0].date}</span>
                      )}
                      {group.transactions[0].source_filename && (
                        <span className="rounded-full bg-secondary px-2 py-0.5">
                          {group.transactions[0].source_filename}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Amount + category picker */}
                  <div className="flex flex-col items-end gap-2 shrink-0">
                    {/* Net amount */}
                    <span
                      className={`text-sm font-semibold ${
                        group.netAmount >= 0 ? "text-green-600" : "text-foreground"
                      }`}
                    >
                      {group.netAmount >= 0 ? "+" : ""}
                      {fmt.currency(group.netAmount)}
                    </span>

                    {/* Category picker or success badge */}
                    {isSuccess ? (
                      <div className="flex items-center gap-1 text-green-600">
                        <CheckCircle className="h-4 w-4" />
                        <span className="text-xs">
                          {t("uncategorized.savedCount", {
                            count: state.updatedCount ?? group.transactions.length,
                          })}
                        </span>
                      </div>
                    ) : (
                      <div className="w-44">
                        <select
                          disabled={isSaving}
                          value={state?.category ?? ""}
                          onChange={(e) => {
                            if (e.target.value) {
                              void handleBulkCategorize(group.description, e.target.value)
                            }
                          }}
                          className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                        >
                          <option value="" disabled>
                            {t("uncategorized.categoryPickerPlaceholder")}
                          </option>
                          {VALID_CATEGORIES.map((cat) => (
                            <option key={cat} value={cat}>
                              {t(`profile.categories.${cat}`, { defaultValue: cat.replace(/_/g, " ") })}
                            </option>
                          ))}
                        </select>
                        {state?.error && (
                          <p className="mt-1 text-xs text-destructive">{state.error}</p>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </main>
  )
}
