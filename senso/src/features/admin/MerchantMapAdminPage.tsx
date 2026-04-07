/**
 * MerchantMapAdminPage.tsx - Admin page for browsing and managing the learned merchant map.
 *
 * Features:
 * - Filter bar: search input + method dropdown + blacklisted toggle
 * - Table per UI-SPEC Section 3
 * - Inline blacklist expansion with reason textarea
 * - Blacklisted row: opacity-50 + border-l-2 border-destructive
 */

import { useCallback, useEffect, useState } from "react"
import { useTranslation } from "react-i18next"
import { Search, Loader2 } from "lucide-react"
import {
    getMerchantMap,
    blacklistMerchant,
    unblacklistMerchant,
    type MerchantMapAdminDTO,
} from "./adminMerchantApi"

// ── Relative date helper ──────────────────────────────────────────────────────

function relativeDate(isoString: string): string {
    const diffMs = Date.now() - new Date(isoString).getTime()
    const diffDays = Math.floor(diffMs / 86_400_000)
    if (diffDays === 0) return "oggi"
    if (diffDays === 1) return "ieri"
    if (diffDays < 30) return `${diffDays} giorni fa`
    const diffMonths = Math.floor(diffDays / 30)
    return `${diffMonths} mes${diffMonths === 1 ? "e" : "i"} fa`
}

// ── Confidence colour ─────────────────────────────────────────────────────────

function ConfidenceBadge({ value }: { value: number }) {
    const pct = Math.round(value * 100)
    const cls =
        pct >= 80
            ? "text-green-700 bg-green-100 dark:text-green-400 dark:bg-green-900/30"
            : pct >= 50
                ? "text-yellow-700 bg-yellow-100 dark:text-yellow-400 dark:bg-yellow-900/30"
                : "text-red-700 bg-red-100 dark:text-red-400 dark:bg-red-900/30"
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {pct}%
        </span>
    )
}

// ── Method badge ──────────────────────────────────────────────────────────────

function MethodBadge({ method }: { method: string }) {
    const cls =
        method === "manual"
            ? "bg-primary/10 text-primary"
            : "bg-secondary text-secondary-foreground"
    return (
        <span className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${cls}`}>
            {method}
        </span>
    )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export function MerchantMapAdminPage() {
    const { t } = useTranslation()

    const [items, setItems] = useState<MerchantMapAdminDTO[]>([])
    const [loading, setLoading] = useState(true)
    const [error, setError] = useState<string | null>(null)

    // Filters
    const [search, setSearch] = useState("")
    const [method, setMethod] = useState("")
    const [blacklistedFilter, setBlacklistedFilter] = useState("")

    // Blacklist inline state: expandedId → reason text
    const [expandedId, setExpandedId] = useState<string | null>(null)
    const [reasonText, setReasonText] = useState("")
    const [saving, setSaving] = useState(false)

    const load = useCallback(async () => {
        setLoading(true)
        setError(null)
        try {
            const data = await getMerchantMap({
                search: search || undefined,
                method: method || undefined,
                blacklisted: blacklistedFilter || undefined,
                limit: 100,
            })
            setItems(data)
        } catch (err) {
            setError(err instanceof Error ? err.message : t("admin.merchantMap.loadError"))
        } finally {
            setLoading(false)
        }
    }, [search, method, blacklistedFilter, t])

    useEffect(() => {
        void load()
    }, [load])

    const handleBlacklist = useCallback(
        async (id: string) => {
            if (reasonText.trim().length < 5) return
            setSaving(true)
            try {
                await blacklistMerchant(id, reasonText.trim())
                setExpandedId(null)
                setReasonText("")
                await load()
            } catch (err) {
                setError(err instanceof Error ? err.message : t("admin.merchantMap.loadError"))
            } finally {
                setSaving(false)
            }
        },
        [reasonText, load, t],
    )

    const handleUnblacklist = useCallback(
        async (id: string) => {
            setSaving(true)
            try {
                await unblacklistMerchant(id)
                await load()
            } catch (err) {
                setError(err instanceof Error ? err.message : t("admin.merchantMap.loadError"))
            } finally {
                setSaving(false)
            }
        },
        [load, t],
    )

    const inputCls =
        "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
    const selectCls =
        "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"

    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6">
            {/* Header */}
            <div className="mb-6">
                <h1 className="text-2xl font-bold text-foreground">
                    {t("admin.merchantMap.title")}
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

            {/* Filters */}
            <div className="mb-4 flex flex-wrap items-center gap-3">
                <div className="relative flex-1 min-w-[200px]">
                    <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                    <input
                        className={`${inputCls} pl-9 w-full`}
                        value={search}
                        onChange={(e) => setSearch(e.target.value)}
                        placeholder={t("admin.merchantMap.searchPlaceholder")}
                    />
                </div>
                <select
                    className={selectCls}
                    value={method}
                    onChange={(e) => setMethod(e.target.value)}
                >
                    <option value="">{t("admin.merchantMap.filterAllMethods")}</option>
                    <option value="manual">manual</option>
                    <option value="sm">sm</option>
                    <option value="md">md</option>
                    <option value="lg">lg</option>
                </select>
                <select
                    className={selectCls}
                    value={blacklistedFilter}
                    onChange={(e) => setBlacklistedFilter(e.target.value)}
                >
                    <option value="">{t("admin.merchantMap.filterAll")}</option>
                    <option value="false">{t("admin.merchantMap.filterActive")}</option>
                    <option value="true">{t("admin.merchantMap.filterBlacklisted")}</option>
                </select>
            </div>

            {/* Table */}
            {loading ? (
                <div className="flex items-center justify-center py-16">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
            ) : items.length === 0 ? (
                <div className="py-16 text-center text-sm text-muted-foreground">
                    {t("admin.merchantMap.noItems")}
                </div>
            ) : (
                <>
                    {/* Mobile card list */}
                    <div className="sm:hidden space-y-2">
                        {items.map((item) => (
                            <div
                                key={item.id}
                                className={[
                                    "rounded-2xl border border-border bg-card p-3 space-y-1.5",
                                    item.is_blacklisted ? "opacity-50 border-l-2 border-destructive" : "",
                                ].join(" ")}
                            >
                                <div className="font-mono text-xs font-medium text-foreground truncate">{item.description_raw}</div>
                                <div className="text-xs text-muted-foreground">{item.canonical_merchant ?? "-"}</div>
                                <div className="flex flex-wrap gap-1.5 items-center">
                                    <MethodBadge method={item.learned_method} />
                                    <ConfidenceBadge value={item.confidence} />
                                    <span className="rounded-full bg-secondary px-2 py-0.5 text-xs text-secondary-foreground">{item.category}</span>
                                </div>
                                <div className="flex justify-end">
                                    {item.is_blacklisted ? (
                                        <button onClick={() => void handleUnblacklist(item.id)} disabled={saving} className="text-xs text-muted-foreground hover:text-foreground underline">
                                            {t("admin.merchantMap.unblacklistBtn")}
                                        </button>
                                    ) : (
                                        <button onClick={() => { setExpandedId((prev) => (prev === item.id ? null : item.id)); setReasonText("") }} className="text-xs text-destructive hover:underline">
                                            {t("admin.merchantMap.blacklistBtn")}
                                        </button>
                                    )}
                                </div>
                                {expandedId === item.id && !item.is_blacklisted && (
                                    <div className="flex items-start gap-2 pt-1">
                                        <textarea
                                            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive resize-none"
                                            rows={2}
                                            value={reasonText}
                                            onChange={(e) => setReasonText(e.target.value)}
                                            placeholder={t("admin.merchantMap.reasonPlaceholder")}
                                        />
                                        <button
                                            onClick={() => void handleBlacklist(item.id)}
                                            disabled={saving || reasonText.trim().length < 5}
                                            className="shrink-0 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                        >
                                            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : t("admin.merchantMap.confirmBlacklist")}
                                        </button>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>

                    {/* Desktop table */}
                    <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border bg-card">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-border text-left">
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colDescription")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colCanonical")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colCategory")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colConfidence")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colMethod")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colProvider")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colUser")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground">
                                        {t("admin.merchantMap.colDate")}
                                    </th>
                                    <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                                        {t("admin.merchantMap.colActions")}
                                    </th>
                                </tr>
                            </thead>
                            <tbody>
                                {items.map((item) => (
                                    <>
                                        <tr
                                            key={item.id}
                                            className={[
                                                "border-b border-border last:border-0 hover:bg-accent/50 transition-colors",
                                                item.is_blacklisted ? "opacity-50 border-l-2 border-destructive" : "",
                                            ].join(" ")}
                                        >
                                            <td className="px-4 py-3 font-mono text-xs max-w-[160px] truncate">
                                                {item.description_raw}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {item.canonical_merchant ?? "-"}
                                            </td>
                                            <td className="px-4 py-3">
                                                <span className="rounded-full bg-secondary px-2 py-1 text-xs text-secondary-foreground">
                                                    {item.category}
                                                </span>
                                            </td>
                                            <td className="px-4 py-3">
                                                <ConfidenceBadge value={item.confidence} />
                                            </td>
                                            <td className="px-4 py-3">
                                                <MethodBadge method={item.learned_method} />
                                            </td>
                                            <td className="px-4 py-3 font-mono text-xs truncate max-w-[120px]">
                                                {item.learned_provider_model ?? "-"}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground">
                                                {item.contributing_user_obfuscated ?? "-"}
                                            </td>
                                            <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                                                {relativeDate(item.learned_at)}
                                            </td>
                                            <td className="px-4 py-3 text-right">
                                                {item.is_blacklisted ? (
                                                    <button
                                                        onClick={() => void handleUnblacklist(item.id)}
                                                        disabled={saving}
                                                        className="text-xs text-muted-foreground hover:text-foreground underline"
                                                    >
                                                        {t("admin.merchantMap.unblacklistBtn")}
                                                    </button>
                                                ) : (
                                                    <button
                                                        onClick={() => {
                                                            setExpandedId((prev) => (prev === item.id ? null : item.id))
                                                            setReasonText("")
                                                        }}
                                                        className="text-xs text-destructive hover:underline"
                                                    >
                                                        {t("admin.merchantMap.blacklistBtn")}
                                                    </button>
                                                )}
                                            </td>
                                        </tr>
                                        {/* Inline blacklist expansion */}
                                        {expandedId === item.id && !item.is_blacklisted && (
                                            <tr key={`${item.id}-expand`} className="border-b border-border bg-destructive/5">
                                                <td colSpan={9} className="px-4 py-3">
                                                    <div className="flex items-start gap-3">
                                                        <textarea
                                                            className="flex-1 rounded-lg border border-border bg-background px-3 py-2 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-destructive resize-none"
                                                            rows={2}
                                                            value={reasonText}
                                                            onChange={(e) => setReasonText(e.target.value)}
                                                            placeholder={t("admin.merchantMap.reasonPlaceholder")}
                                                        />
                                                        <button
                                                            onClick={() => void handleBlacklist(item.id)}
                                                            disabled={saving || reasonText.trim().length < 5}
                                                            className="shrink-0 rounded-lg bg-destructive px-3 py-2 text-sm font-medium text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                                        >
                                                            {saving ? (
                                                                <Loader2 className="h-4 w-4 animate-spin" />
                                                            ) : (
                                                                t("admin.merchantMap.confirmBlacklist")
                                                            )}
                                                        </button>
                                                        <button
                                                            onClick={() => setExpandedId(null)}
                                                            className="shrink-0 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground hover:bg-accent transition-colors"
                                                        >
                                                            ✕
                                                        </button>
                                                    </div>
                                                </td>
                                            </tr>
                                        )}
                                    </>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}
        </div>
    )
}
