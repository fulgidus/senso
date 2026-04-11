import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  Plus,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { Link, useLocation } from "react-router-dom";
import { FilesTab } from "@/features/profile/FilesTab";
import { AdminInspectorDrawer } from "@/features/profile/AdminInspectorDrawer";
import { BalanceMask } from "@/components/BalanceMask";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button } from "@/components/ui/button";
import type { User } from "@/features/auth/types";
import { createProfileApi, type InsightCard, type UserProfile } from "@/lib/profile-api";
import { ApiClientError } from "@/lib/api-client";
import { useAuthContext } from "@/features/auth/AuthContext";
import { TimelineTab } from "@/features/profile/TimelineTab";
import { ConnectorsTab } from "@/features/profile/ConnectorsTab";
import { PreferenzaTab } from "@/features/profile/PreferenzaTab";
import { usePullToRefresh } from "@/hooks/usePullToRefresh";

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

function getCategoryChartData(
  categoryTotals: Record<string, number>,
  otherLabel: string,
  categoryLabel: (slug: string) => string,
): { name: string; value: number }[] {
  const entries = Object.entries(categoryTotals).sort((a, b) => b[1] - a[1]);
  if (entries.length <= 5) {
    return entries.map(([name, value]) => ({
      name: categoryLabel(name),
      value: Math.round(value),
    }));
  }
  const top5 = entries.slice(0, 5);
  const otherTotal = entries.slice(5).reduce((acc, [, v]) => acc + v, 0);
  return [
    ...top5.map(([name, value]) => ({
      name: categoryLabel(name),
      value: Math.round(value),
    })),
    { name: otherLabel, value: Math.round(otherTotal) },
  ];
}

function SkeletonCard() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="mb-3 h-4 w-3/4 animate-pulse rounded bg-muted" />
      <div className="mb-2 h-3 w-full animate-pulse rounded bg-muted" />
      <div className="h-3 w-5/6 animate-pulse rounded bg-muted" />
    </div>
  );
}

type Props = {
  user: User;
  token: string;
  onAddDocuments: () => void;
  onNavigateToChat: () => void;
  onSignOut?: () => Promise<void>;
  onNoProfile?: () => void;
  onRetrigger?: () => void;
};

export function ProfileScreen({
  user: _user,
  token,
  onAddDocuments,
  onNavigateToChat,
  onNoProfile,
  onRetrigger,
}: Props) {
  const { t } = useTranslation();
  const fmt = useLocaleFormat();
  const { onUnauthorized } = useAuthContext();
  const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized]);

  const DATA_SOURCE_LABELS: Record<string, string> = {
    bank_statement: t("profile.sourceBank"),
    payslip: t("profile.sourcePayslip"),
    questionnaire: t("profile.sourceQuestionnaire"),
    estimated_from_transactions: t("profile.sourceEstimated"),
  };

  function formatDataSources(sources: string[]): string {
    if (!sources.length) return "";
    return sources.map((s) => DATA_SOURCE_LABELS[s] ?? s).join(", ");
  }

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [incomeEdit, setIncomeEdit] = useState<string>("");
  const [expensesEdit, setExpensesEdit] = useState<string>("");
  const [isStale, setIsStale] = useState(false);
  const [retriggerLoading, setRetriggerLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<
    "summary" | "charts" | "timeline" | "files" | "connectors" | "preferences"
  >("summary");
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
  const location = useLocation();
  const [uncategorizedCount, setUncategorizedCount] = useState(0);
  const [inspectUploadId, setInspectUploadId] = useState<string | null>(null);
  const [hasNewTimelineEvents, setHasNewTimelineEvents] = useState(false);
  const [balanceMasked, setBalanceMasked] = useState(
    () => localStorage.getItem("senso:balanceMask") === "true",
  );

  const toggleBalanceMask = () => {
    setBalanceMasked((prev) => {
      const next = !prev;
      localStorage.setItem("senso:balanceMask", String(next));
      return next;
    });
  };

  // Pull-to-refresh: reload profile and status
  const handlePullRefresh = useCallback(async () => {
    try {
      const [p, statusData] = await Promise.all([
        profileApi.getProfile(token),
        profileApi.getProfileStatus(token),
      ]);
      setProfile(p);
      setIncomeEdit(String(p.incomeSummary?.amount ?? ""));
      setExpensesEdit(String(p.monthlyExpenses ?? ""));
      if (
        statusData.currentUploadsFingerprint &&
        statusData.currentUploadsFingerprint !== statusData.uploadsFingerprint
      ) {
        setIsStale(true);
      } else {
        setIsStale(false);
      }
    } catch {
      /* non-fatal */
    }
  }, [token]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: handlePullRefresh,
    disabled: loading,
  });

  // Scroll to hash anchor on mount (e.g. /profile#income, /profile#spending)
  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  // Navigate to a specific tab when location.state.tab is set (e.g. from SettingsScreen redirect)
  useEffect(() => {
    const state = location.state as { tab?: string } | null;
    if (state?.tab === "preferences") setActiveTab("preferences");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setLoading(true);
    void Promise.all([profileApi.getProfile(token), profileApi.getProfileStatus(token)])
      .then(([p, statusData]) => {
        setProfile(p);
        setIncomeEdit(String(p.incomeSummary?.amount ?? ""));
        setExpensesEdit(String(p.monthlyExpenses ?? ""));
        // Profile is stale when there are confirmed uploads not yet categorized
        if (
          statusData.currentUploadsFingerprint &&
          statusData.currentUploadsFingerprint !== statusData.uploadsFingerprint
        ) {
          setIsStale(true);
        }
      })
      .catch((err) => {
        if (err instanceof ApiClientError && err.status === 404) {
          onNoProfile?.();
        } else {
          setError(t("profile.errorLoad"));
        }
      })
      .finally(() => setLoading(false));

    // Fetch uncategorized count (non-blocking - ignore errors)
    void profileApi
      .getUncategorized(token)
      .then((items) => setUncategorizedCount(items.length))
      .catch(() => undefined);

    // Check for new timeline events (non-blocking - for notification badge)
    void profileApi
      .getTimeline(token, false)
      .then((evts) => setHasNewTimelineEvents(evts.some((e) => !e.is_user_dismissed)))
      .catch(() => undefined);
  }, [token, onNoProfile]);

  const handleSaveProfile = async () => {
    if (!profile) return;
    setSaving(true);
    setSaveError(null);
    try {
      const updated = await profileApi.confirmProfile(token, {
        incomeOverride: incomeEdit ? parseFloat(incomeEdit) : null,
        expensesOverride: expensesEdit ? parseFloat(expensesEdit) : null,
      });
      setProfile(updated);
      setSaveSuccess(true);
      setTimeout(() => setSaveSuccess(false), 3000);
    } catch {
      setSaveError(t("profile.errorSave"));
    } finally {
      setSaving(false);
    }
  };

  const handleRetrigger = async () => {
    setRetriggerLoading(true);
    try {
      await profileApi.triggerCategorization(token);
      onRetrigger?.();
    } catch {
      setRetriggerLoading(false);
    }
  };

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <div className="mb-8 h-8 w-32 animate-pulse rounded bg-muted" />
        <div className="space-y-8">
          <div className="h-32 animate-pulse rounded-2xl bg-muted" />
          <div className="h-64 animate-pulse rounded-2xl bg-muted" />
        </div>
      </main>
    );
  }

  if (error || !profile) {
    return (
      <main className="mx-auto w-full max-w-4xl px-6 py-6">
        <p className="text-sm text-destructive">{error ?? t("profile.errorLoad")}</p>
      </main>
    );
  }

  const chartData = getCategoryChartData(
    profile.categoryTotals,
    t("profile.otherCategory"),
    (slug) => t(`profile.categories.${slug}`, { defaultValue: slug.replace(/_/g, " ") }),
  );
  const incomeAvailable = !!profile.incomeSummary?.amount;
  const confirmedDate = profile.profileGeneratedAt
    ? fmt.date(new Date(profile.profileGeneratedAt))
    : "";
  const dataSourcesLabel = formatDataSources(profile.dataSources);

  return (
    <main
      ref={pullToRefresh.containerRef as React.RefCallback<HTMLElement>}
      className="mx-auto w-full max-w-4xl px-6 py-6 overscroll-y-contain"
    >
      {/* Pull-to-refresh indicator */}
      {(pullToRefresh.isPulling || pullToRefresh.isRefreshing) && (
        <div className="flex justify-center pb-4">
          <Loader2
            className={[
              "h-5 w-5 text-muted-foreground",
              pullToRefresh.isRefreshing ? "animate-spin" : "",
            ].join(" ")}
          />
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
      {/* Mobile: carousel with prev/next arrows + swipe; Desktop: scrollable horizontal strip */}
      <div
        className="sm:hidden mb-4"
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={(e) => {
          if (touchStartX === null) return;
          const delta = touchStartX - e.changedTouches[0].clientX;
          const tabs = [
            "summary",
            "charts",
            "timeline",
            "files",
            "connectors",
            "preferences",
          ] as const;
          const idx = tabs.indexOf(activeTab as (typeof tabs)[number]);
          if (delta > 40 && idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
          if (delta < -40 && idx > 0) setActiveTab(tabs[idx - 1]);
          setTouchStartX(null);
        }}
      >
        <div className="flex items-center gap-1">
          <button
            onClick={() => {
              const tabs = [
                "summary",
                "charts",
                "timeline",
                "files",
                "connectors",
                "preferences",
              ] as const;
              const idx = tabs.indexOf(activeTab as (typeof tabs)[number]);
              if (idx > 0) setActiveTab(tabs[idx - 1]);
            }}
            disabled={activeTab === "summary"}
            aria-label={t("profile.tabs.prev")}
            className="rounded-full p-1.5 bg-muted text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <div className="flex-1 flex items-center justify-center">
            <span className="rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] flex items-center bg-primary text-primary-foreground">
              {activeTab === "summary" && t("profile.heading")}
              {activeTab === "charts" && t("profile.spendingBreakdown")}
              {activeTab === "timeline" && t("timeline.tabLabel")}
              {activeTab === "files" && t("files.tabLabel")}
              {activeTab === "connectors" && t("connectors.tabLabel")}
              {activeTab === "preferences" && t("profile.preferences.tabLabel")}
              {activeTab === "timeline" && hasNewTimelineEvents && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-white inline-block" />
              )}
            </span>
          </div>
          <button
            onClick={() => {
              const tabs = [
                "summary",
                "charts",
                "timeline",
                "files",
                "connectors",
                "preferences",
              ] as const;
              const idx = tabs.indexOf(activeTab as (typeof tabs)[number]);
              if (idx < tabs.length - 1) setActiveTab(tabs[idx + 1]);
            }}
            disabled={activeTab === "preferences"}
            aria-label={t("profile.tabs.next")}
            className="rounded-full p-1.5 bg-muted text-muted-foreground disabled:opacity-30 disabled:cursor-not-allowed shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Desktop: scrollable horizontal strip */}
      <div className="hidden sm:flex mb-6 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1">
        {(["summary", "charts", "timeline", "files", "connectors", "preferences"] as const).map(
          (tab) => (
            <button
              key={tab}
              onClick={() => {
                setActiveTab(tab);
                if (tab !== "timeline") return;
                setHasNewTimelineEvents(false);
              }}
              className={`relative rounded-full px-4 py-1.5 text-sm font-medium shrink-0 ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
            >
              {tab === "summary" && t("profile.heading")}
              {tab === "charts" && t("profile.spendingBreakdown")}
              {tab === "timeline" && t("timeline.tabLabel")}
              {tab === "files" && t("files.tabLabel")}
              {tab === "connectors" && t("connectors.tabLabel")}
              {tab === "preferences" && t("profile.preferences.tabLabel")}
              {tab === "timeline" && hasNewTimelineEvents && activeTab !== "timeline" && (
                <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
              )}
            </button>
          ),
        )}
      </div>

      {/* Timeline tab */}
      {activeTab === "timeline" && <TimelineTab token={token} />}

      {/* Files tab */}
      {activeTab === "files" && (
        <FilesTab
          token={token}
          isAdmin={!!_user.isAdmin || _user.role === "admin"}
          onInspect={setInspectUploadId}
        />
      )}

      {/* Connectors tab */}
      {activeTab === "connectors" && <ConnectorsTab />}

      {/* Preferenze tab */}
      {activeTab === "preferences" && <PreferenzaTab token={token} />}

      {/* Summary + Charts tabs */}
      {activeTab !== "timeline" &&
        activeTab !== "files" &&
        activeTab !== "connectors" &&
        activeTab !== "preferences" && (
          <div className="space-y-8">
            {/* Summary Card */}
            {activeTab === "summary" && (
              <section id="income" className="rounded-2xl border border-border bg-card p-6">
                <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
                  {/* Income */}
                  <div>
                    <p className="text-sm text-muted-foreground mb-1">
                      {t("profile.incomeMonthly")}
                    </p>
                    <p className="text-xl font-semibold text-foreground">
                      <BalanceMask
                        value={
                          profile.incomeSummary?.amount != null
                            ? fmt.currency(
                                profile.incomeSummary.amount,
                                profile.incomeSummary.currency
                                  ? { currency: profile.incomeSummary.currency }
                                  : undefined,
                              )
                            : "-"
                        }
                        masked={balanceMasked}
                      />
                    </p>
                    {/* TODO-7: show range when min ≠ max */}
                    {profile.incomeMin != null && profile.incomeMax != null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <BalanceMask
                          value={t("profile.incomeRange", {
                            min: fmt.currency(
                              profile.incomeMin,
                              profile.incomeSummary?.currency
                                ? { currency: profile.incomeSummary.currency }
                                : undefined,
                            ),
                            max: fmt.currency(
                              profile.incomeMax,
                              profile.incomeSummary?.currency
                                ? { currency: profile.incomeSummary.currency }
                                : undefined,
                            ),
                          })}
                          masked={balanceMasked}
                        />
                      </p>
                    )}
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
                        value={
                          profile.monthlyExpenses != null
                            ? fmt.currency(profile.monthlyExpenses)
                            : "-"
                        }
                        masked={balanceMasked}
                      />
                    </p>
                    {/* TODO-7: show expense range when min ≠ max */}
                    {profile.expenseMin != null && profile.expenseMax != null && (
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        <BalanceMask
                          value={t("profile.expenseRange", {
                            min: fmt.currency(profile.expenseMin),
                            max: fmt.currency(profile.expenseMax),
                          })}
                          masked={balanceMasked}
                        />
                      </p>
                    )}
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
                        (profile.monthlyMargin ?? 0) >= 0 ? "text-primary" : "text-destructive"
                      }`}
                    >
                      <BalanceMask
                        value={
                          profile.monthlyMargin != null ? fmt.currency(profile.monthlyMargin) : "-"
                        }
                        masked={balanceMasked}
                      />
                    </p>
                  </div>
                </div>
              </section>
            )}

            {/* Spending Breakdown */}
            {activeTab === "charts" && chartData.length > 0 && (
              <section id="spending" className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-xl font-semibold text-foreground">
                  {t("profile.spendingBreakdown")}
                </h3>
                <div className="min-h-[260px]">
                  <ResponsiveContainer width="100%" height={260}>
                    <PieChart>
                      <Pie
                        data={chartData}
                        cx="50%"
                        cy="50%"
                        innerRadius="55%"
                        outerRadius="75%"
                        dataKey="value"
                        paddingAngle={2}
                      >
                        {chartData.map((_, idx) => (
                          <Cell key={idx} fill={CHART_COLORS[idx % CHART_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(value) => [
                          typeof value === "number" ? fmt.currency(value) : String(value ?? ""),
                          t("profile.chartTotal"),
                        ]}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Legend
                        formatter={(value) => (
                          <span style={{ fontSize: 12, color: "var(--muted-foreground)" }}>
                            {value}
                          </span>
                        )}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* Income vs Expenses (only if income available, charts tab) */}
            {activeTab === "charts" && incomeAvailable && profile.monthlyExpenses !== null && (
              <section
                id="income-vs-expenses"
                className="rounded-2xl border border-border bg-card p-6"
              >
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
                          typeof value === "number" ? fmt.currency(value) : String(value ?? ""),
                          name === "income" ? t("profile.incomeBar") : t("profile.expensesBar"),
                        ]}
                        contentStyle={{
                          background: "var(--card)",
                          border: "1px solid var(--border)",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        dataKey="income"
                        fill={CHART_COLORS[0]}
                        radius={[4, 4, 0, 0]}
                        name="income"
                      />
                      <Bar
                        dataKey="expenses"
                        fill={CHART_COLORS[2]}
                        radius={[4, 4, 0, 0]}
                        name="expenses"
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </section>
            )}

            {/* AI Insight Cards (summary tab) */}
            {activeTab === "summary" && (
              <section id="insights">
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
                      <div key={idx} className="rounded-2xl border border-border bg-card p-5">
                        <Lightbulb className="mb-2 h-4 w-4 text-primary" />
                        <p className="mb-1 text-base font-semibold text-foreground">
                          {card.headline}
                        </p>
                        <p className="mb-2 text-sm text-muted-foreground">{card.data_point}</p>
                        <p className="text-sm text-foreground">{card.educational_framing}</p>
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
                  <h3 className="text-lg font-semibold text-foreground">
                    {t("profile.ctaHeading")}
                  </h3>
                  <p className="text-sm text-muted-foreground mt-1">{t("profile.ctaBody")}</p>
                </div>
                <Button variant="default" onClick={onNavigateToChat} className="w-full sm:w-auto">
                  {t("profile.ctaButton")}
                </Button>
              </section>
            )}

            {/* Confirm / Correct Section (summary tab) */}
            {activeTab === "summary" && (
              <section id="confirm" className="rounded-2xl border border-border bg-card p-6">
                <h3 className="mb-4 text-xl font-semibold text-foreground">
                  {t("profile.confirmHeading")}
                </h3>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-sm text-muted-foreground">
                      {t("profile.incomeMonthly")}
                      {profile.incomeSummary?.source && (
                        <span className="ml-2 text-xs">
                          (
                          {DATA_SOURCE_LABELS[profile.incomeSummary.source] ??
                            profile.incomeSummary.source}
                          )
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
                  {saveError && <span className="text-sm text-destructive">{saveError}</span>}
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
  );
}
