import { useEffect, useState } from "react"
import { Lightbulb, Plus } from "lucide-react"
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
  type InsightCard,
  type UserProfile,
} from "@/lib/profile-api"

const SOURCE_LABELS: Record<string, string> = {
  payslip: "from payslip",
  questionnaire: "from questionnaire",
  estimated_from_transactions: "estimated from transactions",
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
]

function formatCurrency(amount: number | null, currency = "EUR"): string {
  if (amount === null) return "—"
  return new Intl.NumberFormat("it-IT", {
    style: "currency",
    currency,
    maximumFractionDigits: 0,
  }).format(amount)
}

function getCategoryChartData(
  categoryTotals: Record<string, number>,
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
    { name: "Other", value: Math.round(otherTotal) },
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
  onSignOut: () => Promise<void>
}

export function ProfileScreen({ user, token, onAddDocuments, onSignOut }: Props) {
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [incomeEdit, setIncomeEdit] = useState<string>("")
  const [expensesEdit, setExpensesEdit] = useState<string>("")

  useEffect(() => {
    setLoading(true)
    void getProfile(token)
      .then((p) => {
        setProfile(p)
        setIncomeEdit(String(p.incomeSummary?.amount ?? ""))
        setExpensesEdit(String(p.monthlyExpenses ?? ""))
      })
      .catch(() =>
        setError("Couldn't load your profile. Check your connection and refresh."),
      )
      .finally(() => setLoading(false))
  }, [token])

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
      setSaveError("Profile not saved. Check your connection and try again.")
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
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
      <main className="mx-auto w-full max-w-4xl px-6 py-10">
        <h1 className="text-2xl font-bold text-foreground mb-4">S.E.N.S.O.</h1>
        <p className="text-sm text-destructive">
          {error ?? "Couldn't load your profile. Check your connection and refresh."}
        </p>
      </main>
    )
  }

  const chartData = getCategoryChartData(profile.categoryTotals)
  const incomeAvailable = !!profile.incomeSummary?.amount
  const confirmedDate = profile.profileGeneratedAt
    ? new Date(profile.profileGeneratedAt).toLocaleDateString("en-GB")
    : ""
  const documentCount = profile.dataSources.length

  return (
    <main className="mx-auto w-full max-w-4xl px-6 py-10">
      {/* Header */}
      <div className="mb-4 flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">S.E.N.S.O.</h1>
          <p className="mt-1 text-sm text-muted-foreground">{user.email}</p>
        </div>
        <button
          className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          onClick={() => void onSignOut()}
        >
          Sign out
        </button>
      </div>

      <div className="mb-2">
        <h2 className="text-xl font-semibold text-foreground">Your Financial Profile</h2>
        {confirmedDate && (
          <p className="text-sm text-muted-foreground">
            Based on {documentCount} document{documentCount !== 1 ? "s" : ""} confirmed{" "}
            {confirmedDate}
          </p>
        )}
      </div>

      <div className="mb-6">
        <Button
          variant="ghost"
          className="text-sm text-primary gap-1 px-0"
          onClick={onAddDocuments}
        >
          <Plus className="h-4 w-4" />
          Add more documents
        </Button>
      </div>

      <div className="space-y-8">
        {/* Summary Card */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
            {/* Income */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">Monthly Income</p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(
                  profile.incomeSummary?.amount ?? null,
                  profile.incomeSummary?.currency,
                )}
              </p>
              {profile.incomeSummary?.source && (
                <span className="mt-1 inline-block rounded-full border border-primary px-2 py-0.5 text-xs text-muted-foreground">
                  {SOURCE_LABELS[profile.incomeSummary.source] ??
                    profile.incomeSummary.source}
                </span>
              )}
            </div>

            {/* Expenses */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                Monthly Expenses{" "}
                <span className="text-xs">(recurring)</span>
              </p>
              <p className="text-xl font-semibold text-foreground">
                {formatCurrency(profile.monthlyExpenses)}
              </p>
            </div>

            {/* Margin */}
            <div>
              <p className="text-sm text-muted-foreground mb-1">
                {(profile.monthlyMargin ?? 0) >= 0
                  ? "Available this month"
                  : "Over budget this month"}
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
              Where your money goes
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
                      "Total",
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
              Income vs. Expenses
            </h3>
            <div className="min-h-[220px]">
              <ResponsiveContainer width="100%" height={220}>
                <BarChart
                  data={[
                    {
                      name: "This month",
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
                      name === "income" ? "Income" : "Expenses",
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
            What your data shows
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

        {/* Confirm / Correct Section */}
        <section className="rounded-2xl border border-border bg-card p-6">
          <h3 className="mb-4 text-xl font-semibold text-foreground">
            Does this look right?
          </h3>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm text-muted-foreground">
                Monthly Income
                {profile.incomeSummary?.source && (
                  <span className="ml-2 text-xs">
                    ({SOURCE_LABELS[profile.incomeSummary.source]})
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
                Monthly Expenses
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
              {saving ? "Saving..." : "Save Profile"}
            </Button>
            {saveSuccess && (
              <span className="text-sm text-green-600">Profile saved ✓</span>
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
