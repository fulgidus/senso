import { useEffect, useState } from "react"
import { AlertTriangle, Lightbulb, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts"
import { Button } from "@/components/ui/button"
import type { User } from "@/features/auth/types"
import {
  confirmProfile,
  getProfile,
  getProfileStatus,
  triggerCategorization,
  type InsightCard,
  type UserProfile,
} from "@/lib/profile-api"
import { ApiClientError } from "@/lib/api-client"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function formatCurrency(amount: number | null, currency = "EUR"): string {
  if (amount === null) return "-"
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getCategoryChartData(
  categoryTotals: Record<string, number>,
  otherLabel: string,
): { name: string; value: number }[] {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1])
  if (entries.length <= 5) {
    return entries.map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value: Math.round(value),
    }))
  }
  const top5 = entries.slice(0, 5)
  const otherTotal = entries.slice(5).reduce((acc, [, v]) => acc + v, 0)
  return [
    ...top5.map(([name, value]) => ({
      name: name.replace(/_/g, " "),
      value: Math.round(value),
    })),
    { name: otherLabel, value: Math.round(otherTotal) },
  ]
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  )
}

type Props = {
  user: User
  token: string
  onAddDocuments: () => void
  onNavigateToChat: () => void
  onSignOut?: () => Promise<void>
  onNoProfile?: () => void
  onRetrigger?: () => void
}

export function ProfileScreen({ user: _user, token, onAddDocuments, onNavigateToChat, onNoProfile, onRetrigger }: Props) {
  const { t } = useTranslation()

  const DATA_SOURCE_LABELS: Record<string, string> = {
    bank_statement: t("profile.sourceBank"),
    payslip: t("profile.sourcePayslip"),
    questionnaire: t("profile.sourceQuestionnaire"),
  }

  function formatDataSources(sources: string[]): string {
    if (!sources.length) return ""
    return sources
      .map((s) => DATA_SOURCE_LABELS[s] ?? s)
      .join(", ")
  }

  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [incomeEdit, setIncomeEdit] = useState<string>("")
  const [expensesEdit, setExpensesEdit] = useState<string>("")
  const [isStale, setIsStale] = useState(false)
  const [retriggerLoading, setRetriggerLoading] = useState(false)

  useEffect(() => {
    setLoading(true)
    void Promise.all([
      getProfile(token),
      getProfileStatus(token),
    ])
      .then(([p, statusData]) => {
        setProfile(p)
        setIncomeEdit(String(p.incomeSummary?.amount ?? ""))
        setExpensesEdit(String(p.monthlyExpenses ?? ""))
        // Profile is stale when there are confirmed uploads not yet categorized
        if (
          statusData.currentUploadsFingerprint &&
          statusData.currentUploadsFingerprint !== statusData.uploadsFingerprint
        ) {
          setIsStale(true)
        }
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 404) {
          onNoProfile?.()
        } else {
          setError(t("profile.errorLoad"))
        }
      })
      .finally(() => setLoading(false))
  }, [token, onNoProfile])

  const handleSaveProfile = async () => {
    if (!profile) return
    setSaving(true)
    setSaveError(null)
    try {
      const updated = await confirmProfile(token, {
        incomeOverride: incomeEdit ? parseFloat(incomeEdit) : null,
        expensesOverride: expensesEdit ? parseFloat(expensesEdit) : null,
      })
      setProfile(updated)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
    } catch {
      setSaveError(t("profile.errorSave"))
    } finally {
      setSaving(false)
    }
  }

  const handleRetrigger = async () => {
    setRetriggerLoading(true)
    try {
      await triggerCategorization(token)
      onRetrigger?.()
    } catch {
      setRetriggerLoading(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="mb-8 h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-8">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </main>
    )
  }

  if (error || !profile) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <p className="text-sm text-destructive">
          {error ?? t("profile.errorLoad")}
        </p>
      </main>
    )
  }

  const chartData = getCategoryChartData(profile.categoryTotals, t("profile.otherCategory"))
  const incomeAvailable = !!profile.incomeSummary?.amount
  const confirmedDate = profile.profileGeneratedAt
    ? new Date(profile.profileGeneratedAt).toLocaleDateString("it-IT")
    : ""
  const dataSourcesLabel = formatDataSources(profile.dataSources)

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-6">
      <div className="mb-2">
        <h2 className="text-xl font-semibold text-foreground">{t("profile.heading")}</h2>
        {confirmedDate && (
          <p className="text-sm text-muted-foreground">
            {t("profile.updatedOn", { date: confirmedDate })}
            {dataSourcesLabel && <> · {t("profile.sources", { sources: dataSourcesLabel })}</>}
          </p>
        )}
      </div>

      {/* Stale profile banner */}
      {isStale && (
        <div className="mb-4 flex flex-col gap-3 rounded-xl border border-yellow-500/40 bg-yellow-50 px-4 py-3 dark:bg-yellow-950/30 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-2 text-sm text-yellow-800 dark:text-yellow-300">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{t("profile.staleWarning")}</span>
          </div>
          <Button
            variant="default"
            size="sm"
            disabled={retriggerLoading}
            onClick={() => void handleRetrigger()}
            className="shrink-0"
          >
            {retriggerLoading ? t("profile.retriggerLoading") : t("profile.retrigger")}
          </Button>
        </div>
      )}

      <div className="mb-6">
        <Button
          variant="ghost"
          className="text-sm text-primary gap-1 px-0"
          onClick={onAddDocuments}
        >
          <Plus className="h-4 w-4" />
          {t("profile.addDocuments")}
        </Button>
      </div>

      <div className="space-y-8">
        {/* Summary Card */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Income */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">{t("profile.incomeMonthly")}</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(
                  profile.incomeSummary?.amount ?? null,
                  profile.incomeSummary?.currency,
                )}
              </p>
              {profile.incomeSummary?.source && (
                <span className="mt-1 inline-block rounded-full border border-primary px-2 py-0.5 text-xs text-muted-foreground">
                  {DATA_SOURCE_LABELS[profile.incomeSummary.source] ??
                    profile.incomeSummary.source}
                </span>
              )}
            </div>

            {/* Expenses */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {t("profile.expensesMonthly")}{" "}
                <span className="text-xs">{t("profile.expensesRecurring")}</span>
              </p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(profile.monthlyExpenses)}
              </p>
            </div>

            {/* Margin */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {(profile.monthlyMargin ?? 0) >= 0
                  ? t("profile.marginPositive")
                  : t("profile.marginNegative")}
              </p>
              <p
                className={`text-xl font-semibold ${
                  (profile.monthlyMargin ?? 0) >= 0
                    ? "text-primary"
                    : "text-destructive"
                }`}
              >
                {formatCurrency(profile.monthlyMargin)}
              </p>
            </div>
          </div>
        </section>

        {/* Spending Breakdown */}
        {chartData.length > 0 && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 text-xl font-semibold text-foreground">
              {t("profile.spendingBreakdown")}
            </h3>
            <div className="min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={chartData}
                  layout="vertical"
                  margin={{ left: 8, right: 16 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    horizontal={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    type="number"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `€${v}`}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={110}
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <Tooltip
                    formatter={(value) => [
                      typeof value === "number"
                        ? `€${value.toLocaleString("it-IT")}`
                        : String(value ?? ""),
                      t("profile.chartTotal"),
                    ]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={CHART_COLORS[idx % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>

            {/* Category pills */}
            <div className="mt-4 flex flex-wrap gap-2">
              {chartData.map((entry, idx) => (
                <span
                  key={entry.name}
                  className="rounded-full bg-secondary px-3 py-1 text-xs text-secondary-foreground"
                  style={{ borderLeft: `3px solid ${CHART_COLORS[idx % CHART_COLORS.length]}` }}
                >
                  {entry.name} · €{entry.value.toLocaleString("it-IT")}
                </span>
              ))}
            </div>
          </section>
        )}

        {/* Income vs Expenses (only if income available) */}
        {incomeAvailable && profile.monthlyExpenses !== null && (
          <section className="rounded-2xl border border-border bg-card p-6">
            <h3 className="mb-4 text-xl font-semibold text-foreground">
              {t("profile.incomeVsExpenses")}
            </h3>
            <div className="min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    {
                      name: t("profile.thisMonth"),
                      income: Math.round(profile.incomeSummary!.amount),
                      expenses: Math.round(profile.monthlyExpenses!),
                    },
                  ]}
                  margin={{ top: 8, right: 16, left: 8, bottom: 8 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    vertical={false}
                    stroke="var(--border)"
                  />
                  <XAxis
                    dataKey="name"
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                  />
                  <YAxis
                    tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                    tickFormatter={(v: number) => `€${v}`}
                  />
                  <Tooltip
                    formatter={(value, name) => [
                      typeof value === "number"
                        ? `€${value.toLocaleString("it-IT")}`
                        : String(value ?? ""),
                      name === "income" ? t("profile.incomeBar") : t("profile.expensesBar"),
                    ]}
                    contentStyle={{
                      background: "var(--card)",
                      border: "1px solid var(--border)",
                      borderRadius: "8px",
                      fontSize: "12px",
                    }}
                  />
                  <Bar dataKey="income" fill={CHART_COLORS[0]} radius={[4, 4, 0, 0]} name="income" />
                  <Bar dataKey="expenses" fill={CHART_COLORS[2]} radius={[4, 4, 0, 0]} name="expenses" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </section>
        )}

        {/* AI Insight Cards */}
        <section>
          <h3 className="mb-4 text-xl font-semibold text-foreground">
            {t("profile.insightsHeading")}
          </h3>
          {profile.insightCards.length === 0 ? (
            <div className="grid gap-4 lg:grid-cols-3">
              <SkeletonCard />
              <SkeletonCard />
              <SkeletonCard />
            </div>
          ) : (
            <div className="grid gap-4 lg:grid-cols-3">
              {profile.insightCards.map((card: InsightCard, idx: number) => (
                <div
                  key={idx}
                  className="rounded-2xl border border-border bg-card p-5"
                >
                  <Lightbulb className="mb-2 h-4 w-4 text-primary" />
                  <p className="mb-1 text-base font-semibold text-foreground">
                    {card.headline}
                  </p>
                  <p className="mb-2 text-sm text-muted-foreground">
                    {card.data_point}
                  </p>
                  <p className="text-sm text-foreground">
                    {card.educational_framing}
                  </p>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* Ask the Coach CTA */}
        <section className="rounded-2xl border border-primary/20 bg-primary/5 p-6 flex flex-col items-center text-center gap-3">
          <p className="text-2xl">🦉</p>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{t("profile.ctaHeading")}</h3>
            <p className="text-sm text-muted-foreground mt-1">
              {t("profile.ctaBody")}
            </p>
          </div>
          <Button
            variant="default"
            onClick={onNavigateToChat}
            className="w-full sm:w-auto"
          >
            {t("profile.ctaButton")}
          </Button>
        </section>

        {/* Confirm / Correct Section */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-4 text-xl font-semibold text-foreground">
            {t("profile.confirmHeading")}
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
                <label className="mb-1 block text-sm text-muted-foreground">
                  {t("profile.incomeMonthly")}
                  {profile.incomeSummary?.source && (
                    <span className="ml-2 text-xs">
                      ({DATA_SOURCE_LABELS[profile.incomeSummary.source] ?? profile.incomeSummary.source})
                    </span>
                  )}
                </label>
              <div className="flex items-center gap-2">
                <span className="text-sm">€</span>
                <input
                  type="number"
                  min={0}
                  value={incomeEdit}
                  onChange={(e) => setIncomeEdit(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                {t("profile.expensesMonthly")}
              </label>
              <div className="flex items-center gap-2">
                <span className="text-sm">€</span>
                <input
                  type="number"
                  min={0}
                  value={expensesEdit}
                  onChange={(e) => setExpensesEdit(e.target.value)}
                  className="w-full rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
                />
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3">
            <Button
              variant="default"
              disabled={saving}
              onClick={() => void handleSaveProfile()}
              className="sm:w-auto w-full"
            >
              {saving ? t("profile.saving") : t("profile.saveProfile")}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-green-600">{t("profile.saveSuccess")}</span>
            )}
            {saveError && (
              <span className="text-sm text-destructive">{saveError}</span>
            )}
          </div>
        </section>
      </div>
    </main>
  )
}
