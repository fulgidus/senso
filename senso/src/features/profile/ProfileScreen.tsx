import { useEffect, useState, useCallback } from "react"
import { AlertTriangle, Eye, EyeOff, Lightbulb, Loader2, Plus } from "lucide-react"
import { useTranslation } from "react-i18next"
import { useLocaleFormat } from "@/hooks/useLocaleFormat"
import { Link } from "react-router-dom"
import { FilesTab } from "@/features/profile/FilesTab"
import { AdminInspectorDrawer } from "@/features/profile/AdminInspectorDrawer"
import { BalanceMask } from "@/components/BalanceMask"
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
  getUncategorized,
  triggerCategorization,
  type InsightCard,
  type UserProfile,
} from "@/lib/profile-api"
import { ApiClientError } from "@/lib/api-client"
import { TimelineTab } from "@/features/profile/TimelineTab"
import { ConnectorsTab } from "@/features/profile/ConnectorsTab"
import { usePullToRefresh } from "@/hooks/usePullToRefresh"

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

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
  const fmt = useLocaleFormat()

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
  const [activeTab, setActiveTab] = useState<"summary" | "charts" | "timeline" | "files" | "connectors">("summary")
  const [uncategorizedCount, setUncategorizedCount] = useState(0)
  const [inspectUploadId, setInspectUploadId] = useState<string | null>(null)
  const [balanceMasked, setBalanceMasked] = useState(
    () => localStorage.getItem("senso:balanceMask") === "true"
  )

  const toggleBalanceMask = () => {
    setBalanceMasked((prev) => {
      const next = !prev
      localStorage.setItem("senso:balanceMask", String(next))
      return next
    })
  }

  // Pull-to-refresh: reload profile and status
  const handlePullRefresh = useCallback(async () => {
    try {
      const [p, statusData] = await Promise.all([
        getProfile(token),
        getProfileStatus(token),
      ])
      setProfile(p)
      setIncomeEdit(String(p.incomeSummary?.amount ?? ""))
      setExpensesEdit(String(p.monthlyExpenses ?? ""))
      if (
        statusData.currentUploadsFingerprint &&
        statusData.currentUploadsFingerprint !== statusData.uploadsFingerprint
      ) {
        setIsStale(true)
      } else {
        setIsStale(false)
      }
    } catch { /* non-fatal */ }
  }, [token])

  const pullToRefresh = usePullToRefresh({
    onRefresh: handlePullRefresh,
    disabled: loading,
  })

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

    // Fetch uncategorized count (non-blocking — ignore errors)
    void getUncategorized(token)
      .then((items) => setUncategorizedCount(items.length))
      .catch(() => undefined)
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
    ? fmt.date(new Date(profile.profileGeneratedAt))
    : ""
  const dataSourcesLabel = formatDataSources(profile.dataSources)

  return (
    <main
      ref={pullToRefresh.containerRef as React.RefCallback<HTMLElement>}
      className="mx-auto w-full max-w-4xl px-6 py-6 overscroll-y-contain"
      style={{ touchAction: "pan-x" }}
    >
      {/* Pull-to-refresh indicator */}
      {(pullToRefresh.isPulling || pullToRefresh.isRefreshing) && (
        <div className="flex justify-center pb-4">
          <Loader2 className={["h-5 w-5 text-muted-foreground", pullToRefresh.isRefreshing ? "animate-spin" : ""].join(" ")} />
        </div>
      )}
      <div className="mb-2 flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold text-foreground">{t("profile.heading")}</h2>
          {confirmedDate && (
            <p className="text-sm text-muted-foreground">
              {t("profile.updatedOn", { date: confirmedDate })}
              {dataSourcesLabel && <> · {t("profile.sources", { sources: dataSourcesLabel })}</>}
            </p>
          )}
        </div>
        <button
          onClick={toggleBalanceMask}
          aria-label={t("accessibility.toggleBalanceVisibility")}
          className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
        >
          {balanceMasked ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
        </button>
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

      {/* Uncategorized amber banner */}
      {uncategorizedCount > 0 && (
        <div className="mb-4 flex items-center justify-between rounded-xl border border-yellow-500/40 bg-yellow-50 px-4 py-3 dark:bg-yellow-950/30">
          <span className="text-sm text-yellow-800 dark:text-yellow-300">
            {t("profile.uncategorizedBadge", { count: uncategorizedCount })}
          </span>
          <Link
            to="/profile/uncategorized"
            className="text-sm font-medium text-yellow-800 underline dark:text-yellow-300"
          >
            {t("timeline.reviewUncategorizedCta")}
          </Link>
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

      {/* Tab bar */}
      <div className="mb-6 flex gap-2 flex-wrap">
        <button
          onClick={() => setActiveTab("summary")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            activeTab === "summary"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("profile.heading")}
        </button>
        <button
          onClick={() => setActiveTab("charts")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            activeTab === "charts"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("profile.spendingBreakdown")}
        </button>
        <button
          onClick={() => setActiveTab("timeline")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            activeTab === "timeline"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("timeline.tabLabel")}
        </button>
        <button
          onClick={() => setActiveTab("files")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            activeTab === "files"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("files.tabLabel")}
        </button>
        <button
          onClick={() => setActiveTab("connectors")}
          className={`rounded-full px-4 py-1.5 text-sm font-medium ${
            activeTab === "connectors"
              ? "bg-primary text-primary-foreground"
              : "text-muted-foreground hover:text-foreground"
          }`}
        >
          {t("connectors.tabLabel")}
        </button>
      </div>

      {/* Timeline tab */}
      {activeTab === "timeline" && (
        <TimelineTab token={token} />
      )}

      {/* Files tab */}
      {activeTab === "files" && (
        <FilesTab
          token={token}
          isAdmin={!!_user.isAdmin || _user.role === "admin"}
          onInspect={setInspectUploadId}
        />
      )}

      {/* Connectors tab */}
      {activeTab === "connectors" && (
        <ConnectorsTab />
      )}

      {/* Summary + Charts tabs */}
      {activeTab !== "timeline" && activeTab !== "files" && activeTab !== "connectors" && (
        <div className="space-y-8">
          {/* Summary Card */}
          {activeTab === "summary" && (
            <section className="rounded-2xl border border-border bg-card p-6">
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                {/* Income */}
                <div>
                  <p className="text-sm text-muted-foreground mb-1">{t("profile.incomeMonthly")}</p>
                  <p className="text-xl font-semibold text-foreground">
                    <BalanceMask
                      value={profile.incomeSummary?.amount != null
                        ? fmt.currency(profile.incomeSummary.amount, profile.incomeSummary.currency ? { currency: profile.incomeSummary.currency } : undefined)
                        : "-"}
                      masked={balanceMasked}
                    />
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
                    <BalanceMask
                      value={profile.monthlyExpenses != null ? fmt.currency(profile.monthlyExpenses) : "-"}
                      masked={balanceMasked}
                    />
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
                    <BalanceMask
                      value={profile.monthlyMargin != null ? fmt.currency(profile.monthlyMargin) : "-"}
                      masked={balanceMasked}
                    />
                  </p>
                </div>
              </div>
            </section>
          )}

          {/* Spending Breakdown */}
          {activeTab === "charts" && chartData.length > 0 && (
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
                          ? fmt.currency(value)
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
                    {entry.name} · {fmt.currency(entry.value)}
                  </span>
                ))}
              </div>
            </section>
          )}

          {/* Income vs Expenses (only if income available, charts tab) */}
          {activeTab === "charts" && incomeAvailable && profile.monthlyExpenses !== null && (
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
                          ? fmt.currency(value)
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

          {/* AI Insight Cards (summary tab) */}
          {activeTab === "summary" && (
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
          )}

          {/* Ask the Coach CTA (summary tab) */}
          {activeTab === "summary" && (
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
          )}

          {/* Confirm / Correct Section (summary tab) */}
          {activeTab === "summary" && (
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
          )}
        </div>
      )}
      {inspectUploadId && (
        <AdminInspectorDrawer
          uploadId={inspectUploadId}
          token={token}
          onClose={() => setInspectUploadId(null)}
        />
      )}
    </main>
  )
}
