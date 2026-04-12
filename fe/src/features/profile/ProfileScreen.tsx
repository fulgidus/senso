import { useEffect, useMemo, useState, useCallback } from "react";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  Lightbulb,
  Loader2,
  Pencil,
  Plus,
  RefreshCw,
} from "lucide-react";
import { useTranslation } from "react-i18next";
import { useLocaleFormat } from "@/hooks/useLocaleFormat";
import { Link, useNavigate, useParams } from "react-router-dom";
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

// ── Route-based tab definitions ──────────────────────────────────────────────

const TABS = ["summary", "stats", "timeline", "files", "connectors", "personal"] as const;
type Tab = (typeof TABS)[number];

function isValidTab(s: string | undefined): s is Tab {
  return TABS.includes(s as Tab);
}

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

function tabLabel(tab: Tab, t: (k: string) => string): string {
  switch (tab) {
    case "summary":
      return t("profile.heading");
    case "stats":
      return t("profile.spendingBreakdown");
    case "timeline":
      return t("timeline.tabLabel");
    case "files":
      return t("files.tabLabel");
    case "connectors":
      return t("connectors.tabLabel");
    case "personal":
      return t("profile.preferences.tabLabel");
  }
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
  const navigate = useNavigate();
  const { onUnauthorized } = useAuthContext();
  const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized]);
  const { tab: tabParam } = useParams<{ tab: string }>();
  const activeTab: Tab = isValidTab(tabParam) ? tabParam : "summary";

  const DATA_SOURCE_LABELS: Record<string, string> = {
    bank_statement: t("profile.sourceBank"),
    payslip: t("profile.sourcePayslip"),
    questionnaire: t("profile.sourceQuestionnaire"),
    estimated_from_transactions: t("profile.sourceEstimated"),
    user_override: t("profile.sourceUserOverride"),
  };

  function formatDataSources(sources: string[]): string {
    if (!sources.length) return "";
    return sources.map((s) => DATA_SOURCE_LABELS[s] ?? s).join(", ");
  }

  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [insightsError, setInsightsError] = useState(false);
  const [isStale, setIsStale] = useState(false);
  const [retriggerLoading, setRetriggerLoading] = useState(false);
  const [touchStartX, setTouchStartX] = useState<number | null>(null);
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
  }, [token, profileApi]);

  const pullToRefresh = usePullToRefresh({
    onRefresh: handlePullRefresh,
    disabled: loading,
  });

  // Scroll to hash anchor on mount
  useEffect(() => {
    if (window.location.hash) {
      const el = document.querySelector(window.location.hash);
      if (el) el.scrollIntoView({ behavior: "smooth" });
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    setInsightsError(false);
    void Promise.all([profileApi.getProfile(token), profileApi.getProfileStatus(token)])
      .then(([p, statusData]) => {
        setProfile(p);
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
  }, [token, onNoProfile, profileApi, t]);

  const handleRetrigger = async () => {
    setRetriggerLoading(true);
    try {
      await profileApi.triggerCategorization(token);
      onRetrigger?.();
    } catch {
      setRetriggerLoading(false);
    }
  };

  // ── Mobile swipe navigation ────────────────────────────────────────────────
  const tabIdx = TABS.indexOf(activeTab);

  const handleSwipeEnd = (e: React.TouchEvent) => {
    if (touchStartX === null) return;
    const delta = touchStartX - e.changedTouches[0].clientX;
    if (delta > 40 && tabIdx < TABS.length - 1) navigate(`/profile/${TABS[tabIdx + 1]}`);
    if (delta < -40 && tabIdx > 0) navigate(`/profile/${TABS[tabIdx - 1]}`);
    setTouchStartX(null);
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
  const confirmedDate = fmt.date(profile.profileGeneratedAt);
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
        <div className="flex items-center gap-1">
          {activeTab === "summary" && (
            <Link
              to="/profile/personal"
              className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
              aria-label={t("profile.editProfile")}
              title={t("profile.editProfile")}
            >
              <Pencil className="h-5 w-5" />
            </Link>
          )}
          <button
            onClick={toggleBalanceMask}
            aria-label={t("accessibility.toggleBalanceVisibility")}
            className="rounded-full p-2 text-muted-foreground hover:bg-muted transition-colors"
          >
            {balanceMasked ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
          </button>
        </div>
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

      {/* ── Tab bar: Mobile carousel ────────────────────────────────────────── */}
      <div
        className="sm:hidden mb-4"
        onTouchStart={(e) => setTouchStartX(e.touches[0].clientX)}
        onTouchEnd={handleSwipeEnd}
      >
        <div className="flex items-center gap-1">
          <Link
            to={tabIdx > 0 ? `/profile/${TABS[tabIdx - 1]}` : "#"}
            aria-label={t("profile.tabs.prev")}
            aria-disabled={tabIdx === 0}
            className={`rounded-full p-1.5 bg-muted text-muted-foreground shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${tabIdx === 0 ? "opacity-30 pointer-events-none" : ""}`}
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 flex items-center justify-center">
            <span className="rounded-lg px-4 py-2.5 text-sm font-medium min-h-[44px] flex items-center bg-primary text-primary-foreground">
              {tabLabel(activeTab, t)}
              {activeTab === "timeline" && hasNewTimelineEvents && (
                <span className="ml-1.5 h-2 w-2 rounded-full bg-white inline-block" />
              )}
            </span>
          </div>
          <Link
            to={tabIdx < TABS.length - 1 ? `/profile/${TABS[tabIdx + 1]}` : "#"}
            aria-label={t("profile.tabs.next")}
            aria-disabled={tabIdx === TABS.length - 1}
            className={`rounded-full p-1.5 bg-muted text-muted-foreground shrink-0 min-h-[44px] min-w-[44px] flex items-center justify-center ${tabIdx === TABS.length - 1 ? "opacity-30 pointer-events-none" : ""}`}
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
      </div>

      {/* ── Tab bar: Desktop strip ──────────────────────────────────────────── */}
      <div className="hidden sm:flex mb-6 gap-2 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden pb-1">
        {TABS.map((tab) => (
          <Link
            key={tab}
            to={`/profile/${tab}`}
            onClick={() => {
              if (tab === "timeline") setHasNewTimelineEvents(false);
            }}
            className={`relative rounded-full px-4 py-1.5 text-sm font-medium shrink-0 ${activeTab === tab ? "bg-primary text-primary-foreground" : "text-muted-foreground hover:text-foreground"}`}
          >
            {tabLabel(tab, t)}
            {tab === "timeline" && hasNewTimelineEvents && activeTab !== "timeline" && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-destructive" />
            )}
          </Link>
        ))}
      </div>

      {/* ── Tab content ─────────────────────────────────────────────────────── */}

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

      {/* Personal tab */}
      {activeTab === "personal" && <PreferenzaTab token={token} />}

      {/* Summary tab */}
      {activeTab === "summary" && (
        <div className="space-y-8">
          {/* Summary Card */}
          <section id="income" className="card-glow p-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              {/* Income */}
              <div>
                <p className="text-sm text-muted-foreground mb-1">{t("profile.incomeMonthly")}</p>
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
                      profile.monthlyExpenses != null ? fmt.currency(profile.monthlyExpenses) : "-"
                    }
                    masked={balanceMasked}
                  />
                </p>
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

          {/* AI Insight Cards */}
          <section id="insights">
            <h3 className="mb-4 text-xl font-semibold text-foreground">
              {t("profile.insightsHeading")}
            </h3>
            {insightsError ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center rounded-2xl border border-border bg-card">
                <AlertTriangle className="h-8 w-8 text-destructive" />
                <p className="text-sm text-destructive">{t("profile.insightsError")}</p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setInsightsError(false);
                    void handlePullRefresh();
                  }}
                >
                  <RefreshCw className="h-4 w-4 mr-1" />
                  {t("profile.insightsRetry")}
                </Button>
              </div>
            ) : profile.insightCards.length === 0 ? (
              <div className="flex flex-col items-center gap-3 py-8 text-center rounded-2xl border border-border bg-card">
                <Lightbulb className="h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("profile.insightsEmpty")}</p>
              </div>
            ) : (
              <div className="grid gap-4 lg:grid-cols-3">
                {profile.insightCards.map((card: InsightCard, idx: number) => (
                  <div key={idx} className="card-glow p-5">
                    <Lightbulb className="mb-2 h-4 w-4 text-primary" />
                    <p className="mb-1 text-base font-semibold text-foreground">{card.headline}</p>
                    <p className="mb-2 text-sm text-muted-foreground">{card.data_point}</p>
                    <p className="text-sm text-foreground">{card.educational_framing}</p>
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
              <p className="text-sm text-muted-foreground mt-1">{t("profile.ctaBody")}</p>
            </div>
            <Button variant="default" onClick={onNavigateToChat} className="w-full sm:w-auto">
              {t("profile.ctaButton")}
            </Button>
          </section>
        </div>
      )}

      {/* Stats tab */}
      {activeTab === "stats" && (
        <div className="space-y-8">
          {/* Spending Breakdown */}
          {chartData.length > 0 && (
            <section id="spending" className="card-glow p-6">
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

          {/* Income vs Expenses */}
          {incomeAvailable && profile.monthlyExpenses !== null && (
            <section id="income-vs-expenses" className="card-glow p-6">
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
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="var(--border)" />
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
