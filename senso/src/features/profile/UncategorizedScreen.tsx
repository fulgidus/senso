import { useCallback, useEffect, useState } from "react"
import { AlertTriangle, CheckCircle } from "lucide-react"
import { useTranslation } from "react-i18next"
import { Link } from "react-router-dom"
import { Button } from "@/components/ui/button"
import {
  getUncategorized,
  updateTransactionCategory,
  type UncategorizedTransactionDTO,
} from "@/lib/profile-api"
import { readAccessToken } from "@/features/auth/storage"

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

// Group transactions by description, sort by frequency desc, then amount desc
type TransactionGroup = {
  description: string
  transactions: UncategorizedTransactionDTO[]
  totalAmount: number
}

function groupTransactions(transactions: UncategorizedTransactionDTO[]): TransactionGroup[] {
  const groups = new Map<string, UncategorizedTransactionDTO[]>()

  for (const txn of transactions) {
    const key = txn.description ?? "(no description)"
    const existing = groups.get(key) ?? []
    existing.push(txn)
    groups.set(key, existing)
  }

  return Array.from(groups.entries())
    .map(([description, txns]) => ({
      description,
      transactions: txns,
      totalAmount: txns.reduce((sum, t) => sum + Math.abs(t.amount ?? 0), 0),
    }))
    .sort((a, b) => {
      if (b.transactions.length !== a.transactions.length)
        return b.transactions.length - a.transactions.length
      return b.totalAmount - a.totalAmount
    })
}

type RowState = {
  saving: boolean
  success: boolean
  error: string | null
  category: string
}

export function UncategorizedScreen() {
  const { t } = useTranslation()
  const token = readAccessToken()

  const [transactions, setTransactions] = useState<UncategorizedTransactionDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [rowStates, setRowStates] = useState<Record<string, RowState>>({})

  const loadData = useCallback(() => {
    if (!token) return
    setLoading(true)
    setLoadError(null)
    void getUncategorized(token)
      .then((data) => {
        setTransactions(data)
      })
      .catch(() => {
        setLoadError(t("uncategorized.errorLoad"))
      })
      .finally(() => setLoading(false))
  }, [token, t])

  useEffect(() => {
    loadData()
  }, [loadData])

  const handleCategoryChange = useCallback(
    async (transactionId: string, category: string) => {
      if (!token) return

      setRowStates((prev) => ({
        ...prev,
        [transactionId]: { saving: true, success: false, error: null, category },
      }))

      try {
        await updateTransactionCategory(token, transactionId, category)
        setRowStates((prev) => ({
          ...prev,
          [transactionId]: { saving: false, success: true, error: null, category },
        }))
        // Remove from list after success feedback fades
        setTimeout(() => {
          setTransactions((prev) => prev.filter((t) => t.id !== transactionId))
          setRowStates((prev) => {
            const next = { ...prev }
            delete next[transactionId]
            return next
          })
        }, 1500)
      } catch {
        setRowStates((prev) => ({
          ...prev,
          [transactionId]: {
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

  const groups = groupTransactions(transactions)

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
            {t("uncategorized.pageSubtitle_other", { count: transactions.length })}
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
        <div className="space-y-6">
          {groups.map((group) => (
            <div key={group.description}>
              {group.transactions.length > 1 && (
                <p className="mb-2 text-sm text-muted-foreground">
                  {t("uncategorized.occurrenceSummary", {
                    count: group.transactions.length,
                    total: Math.round(group.totalAmount),
                  })}
                </p>
              )}
              <div className="space-y-2">
                {group.transactions.map((txn) => {
                  const state = rowStates[txn.id]
                  return (
                    <div
                      key={txn.id}
                      className={`rounded-xl border border-border bg-card px-4 py-3 flex items-center gap-4 transition-opacity ${
                        state?.success ? "opacity-50" : ""
                      }`}
                    >
                      {/* Left: description + date + source */}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">
                          {txn.description ?? "—"}
                        </p>
                        <div className="mt-0.5 flex items-center gap-2 flex-wrap">
                          {txn.date && (
                            <span className="text-sm text-muted-foreground">{txn.date}</span>
                          )}
                          {txn.source_filename && (
                            <span className="rounded-full bg-secondary px-2 py-1 text-sm">
                              {txn.source_filename}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Amount */}
                      {txn.amount !== null && (
                        <span className="text-sm font-semibold text-foreground shrink-0">
                          €{Math.abs(txn.amount).toLocaleString("it-IT")}
                        </span>
                      )}

                      {/* Category picker or feedback */}
                      <div className="shrink-0 w-44">
                        {state?.success ? (
                          <div className="flex items-center gap-1 text-green-600">
                            <CheckCircle className="h-4 w-4" />
                            <span className="text-sm">{state.category}</span>
                          </div>
                        ) : (
                          <div>
                            <select
                              disabled={state?.saving}
                              value={state?.category ?? ""}
                              onChange={(e) => {
                                if (e.target.value) {
                                  void handleCategoryChange(txn.id, e.target.value)
                                }
                              }}
                              className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary disabled:opacity-50"
                            >
                              <option value="" disabled>
                                {t("uncategorized.categoryPickerPlaceholder")}
                              </option>
                              {VALID_CATEGORIES.map((cat) => (
                                <option key={cat} value={cat}>
                                  {cat.replace(/_/g, " ")}
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
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </main>
  )
}
