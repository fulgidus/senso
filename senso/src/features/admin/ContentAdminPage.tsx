/**
 * ContentAdminPage.tsx — Backoffice page for managing content items.
 *
 * Features:
 * - Table view with locale/type/published filters
 * - Create new item via inline form
 * - Edit existing items via inline form
 * - Delete with confirmation
 * - Toggle published status
 */

import { useCallback, useEffect, useMemo, useState } from "react"
import { useTranslation } from "react-i18next"
import {
  Plus,
  Pencil,
  Trash2,
  X,
  Check,
  Eye,
  EyeOff,
  Search,
  ChevronDown,
  ChevronUp,
  Loader2,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import type {
  AdminContentItemDTO,
  ContentItemCreatePayload,
  ContentItemUpdatePayload,
} from "./adminContentApi"
import {
  listAdminContent,
  createContentItem,
  updateContentItem,
  deleteContentItem,
} from "./adminContentApi"

// ── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = ["article", "video", "slide_deck", "partner_offer"] as const
const LOCALES = ["it", "en"] as const

type ContentType = (typeof CONTENT_TYPES)[number]

// ── Metadata field hints per type ────────────────────────────────────────────

const METADATA_HINTS: Record<ContentType, string[]> = {
  article: ["url", "estimated_read_minutes"],
  video: ["video_id"],
  slide_deck: ["slide_count"],
  partner_offer: [
    "partner_name",
    "partner_logo_initial",
    "description",
    "cta_label",
    "cta_url",
    "action_type",
    "funnel_id",
    "offer_type",
  ],
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function emptyCreate(): ContentItemCreatePayload {
  return {
    id: "",
    locale: "it",
    type: "article",
    title: "",
    summary: "",
    topics: [],
    metadata: {},
    is_published: true,
  }
}

// ── Item form (shared by create and edit) ────────────────────────────────────

type ItemFormProps = {
  initial: ContentItemCreatePayload
  mode: "create" | "edit"
  saving: boolean
  onSave: (data: ContentItemCreatePayload) => void
  onCancel: () => void
}

function ItemForm({ initial, mode, saving, onSave, onCancel }: ItemFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ContentItemCreatePayload>(initial)
  const [topicsStr, setTopicsStr] = useState(initial.topics?.join(", ") ?? "")
  const [metaStr, setMetaStr] = useState(
    JSON.stringify(initial.metadata ?? {}, null, 2),
  )
  const [metaError, setMetaError] = useState(false)

  const currentType = form.type as ContentType
  const hints = METADATA_HINTS[currentType] ?? []

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    // Parse topics
    const topics = topicsStr
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean)
    // Parse metadata JSON
    let metadata: Record<string, unknown> = {}
    try {
      metadata = JSON.parse(metaStr)
      setMetaError(false)
    } catch {
      setMetaError(true)
      return
    }
    onSave({ ...form, topics, metadata })
  }

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"
  const labelCls = "block text-sm font-medium text-foreground mb-1"

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {/* ID (only on create) */}
        <div>
          <label className={labelCls}>{t("admin.content.fieldId")}</label>
          <input
            className={inputCls}
            value={form.id}
            onChange={(e) => setForm((f) => ({ ...f, id: e.target.value }))}
            required
            disabled={mode === "edit"}
            placeholder="it-article-budget-101"
          />
        </div>

        {/* Locale */}
        <div>
          <label className={labelCls}>{t("admin.content.fieldLocale")}</label>
          <select
            className={inputCls}
            value={form.locale}
            onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
            disabled={mode === "edit"}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Type */}
        <div>
          <label className={labelCls}>{t("admin.content.fieldType")}</label>
          <select
            className={inputCls}
            value={form.type}
            onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
            disabled={mode === "edit"}
          >
            {CONTENT_TYPES.map((ct) => (
              <option key={ct} value={ct}>
                {t(`admin.content.type_${ct}`)}
              </option>
            ))}
          </select>
        </div>

        {/* Title */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>{t("admin.content.fieldTitle")}</label>
          <input
            className={inputCls}
            value={form.title}
            onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
            required
            placeholder={t("admin.content.fieldTitlePlaceholder")}
          />
        </div>

        {/* Summary */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>{t("admin.content.fieldSummary")}</label>
          <textarea
            className={`${inputCls} min-h-[80px] resize-y`}
            value={form.summary ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, summary: e.target.value }))}
            placeholder={t("admin.content.fieldSummaryPlaceholder")}
          />
        </div>

        {/* Topics */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>{t("admin.content.fieldTopics")}</label>
          <input
            className={inputCls}
            value={topicsStr}
            onChange={(e) => setTopicsStr(e.target.value)}
            placeholder={t("admin.content.fieldTopicsPlaceholder")}
          />
          <p className="mt-1 text-xs text-muted-foreground">
            {t("admin.content.fieldTopicsHint")}
          </p>
        </div>

        {/* Metadata JSON */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>
            {t("admin.content.fieldMetadata")}
            {hints.length > 0 && (
              <span className="ml-2 font-normal text-xs text-muted-foreground">
                ({hints.join(", ")})
              </span>
            )}
          </label>
          <textarea
            className={`${inputCls} min-h-[100px] resize-y font-mono text-xs ${metaError ? "border-destructive ring-destructive" : ""}`}
            value={metaStr}
            onChange={(e) => {
              setMetaStr(e.target.value)
              setMetaError(false)
            }}
          />
          {metaError && (
            <p className="mt-1 text-xs text-destructive">
              {t("admin.content.metadataJsonError")}
            </p>
          )}
        </div>

        {/* Published */}
        <div className="flex items-center gap-2">
          <input
            type="checkbox"
            id="is_published"
            checked={form.is_published ?? true}
            onChange={(e) =>
              setForm((f) => ({ ...f, is_published: e.target.checked }))
            }
            className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
          />
          <label htmlFor="is_published" className="text-sm text-foreground">
            {t("admin.content.fieldPublished")}
          </label>
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-2 pt-2">
        <Button type="submit" disabled={saving}>
          {saving && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {mode === "create"
            ? t("admin.content.createBtn")
            : t("admin.content.saveBtn")}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel}>
          {t("admin.content.cancelBtn")}
        </Button>
      </div>
    </form>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ContentAdminPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"

  // ── State ──
  const [items, setItems] = useState<AdminContentItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filters
  const [filterLocale, setFilterLocale] = useState<string>("")
  const [filterType, setFilterType] = useState<string>("")
  const [filterSearch, setFilterSearch] = useState("")

  // Form state
  const [showCreate, setShowCreate] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null)

  // Sort
  const [sortField, setSortField] = useState<"title" | "type" | "locale" | "updated_at">("updated_at")
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc")

  // ── Load items ──
  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdminContent({
        locale: filterLocale || undefined,
        type: filterType || undefined,
      })
      setItems(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.content.loadError"),
      )
    } finally {
      setLoading(false)
    }
  }, [filterLocale, filterType, t])

  useEffect(() => {
    void loadItems()
  }, [loadItems])

  // ── Filtered + sorted items ──
  const filtered = useMemo(() => {
    let list = items
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q) ||
          it.topics.some((tp) => tp.toLowerCase().includes(q)),
      )
    }
    list = [...list].sort((a, b) => {
      const va = a[sortField] ?? ""
      const vb = b[sortField] ?? ""
      const cmp = String(va).localeCompare(String(vb))
      return sortDir === "asc" ? cmp : -cmp
    })
    return list
  }, [items, filterSearch, sortField, sortDir])

  // ── Handlers ──
  const handleCreate = useCallback(
    async (data: ContentItemCreatePayload) => {
      setSaving(true)
      try {
        await createContentItem(data)
        setShowCreate(false)
        await loadItems()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.content.createError"),
        )
      } finally {
        setSaving(false)
      }
    },
    [loadItems, t],
  )

  const handleUpdate = useCallback(
    async (id: string, data: ContentItemCreatePayload) => {
      setSaving(true)
      try {
        const update: ContentItemUpdatePayload = {
          title: data.title,
          summary: data.summary,
          topics: data.topics,
          metadata: data.metadata,
          is_published: data.is_published,
        }
        await updateContentItem(id, update)
        setEditingId(null)
        await loadItems()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.content.updateError"),
        )
      } finally {
        setSaving(false)
      }
    },
    [loadItems, t],
  )

  const handleDelete = useCallback(
    async (id: string) => {
      try {
        await deleteContentItem(id)
        setDeleteConfirm(null)
        await loadItems()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.content.deleteError"),
        )
      }
    },
    [loadItems, t],
  )

  const handleTogglePublished = useCallback(
    async (item: AdminContentItemDTO) => {
      try {
        await updateContentItem(item.id, {
          is_published: !item.is_published,
        })
        await loadItems()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.content.updateError"),
        )
      }
    },
    [loadItems, t],
  )

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (
      sortDir === "asc" ? (
        <ChevronUp className="inline h-3 w-3" />
      ) : (
        <ChevronDown className="inline h-3 w-3" />
      )
    ) : null

  const selectCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("admin.content.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.content.subtitle", { count: items.length })}
          </p>
        </div>
        <Button onClick={() => setShowCreate((v) => !v)}>
          {showCreate ? (
            <X className="mr-1.5 h-4 w-4" />
          ) : (
            <Plus className="mr-1.5 h-4 w-4" />
          )}
          {showCreate
            ? t("admin.content.cancelBtn")
            : t("admin.content.newBtn")}
        </Button>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-4 rounded-lg border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          {error}
          <button
            className="ml-2 underline"
            onClick={() => setError(null)}
          >
            {t("admin.content.dismiss")}
          </button>
        </div>
      )}

      {/* Create form */}
      {showCreate && (
        <div className="mb-6 rounded-2xl border border-border bg-card p-6">
          <h2 className="mb-4 text-lg font-semibold text-foreground">
            {t("admin.content.createHeading")}
          </h2>
          <ItemForm
            initial={emptyCreate()}
            mode="create"
            saving={saving}
            onSave={handleCreate}
            onCancel={() => setShowCreate(false)}
          />
        </div>
      )}

      {/* Filters */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <input
            className={`${inputCls} pl-9`}
            value={filterSearch}
            onChange={(e) => setFilterSearch(e.target.value)}
            placeholder={t("admin.content.searchPlaceholder")}
          />
        </div>
        <select
          className={selectCls}
          value={filterLocale}
          onChange={(e) => setFilterLocale(e.target.value)}
        >
          <option value="">{t("admin.content.allLocales")}</option>
          {LOCALES.map((l) => (
            <option key={l} value={l}>
              {l.toUpperCase()}
            </option>
          ))}
        </select>
        <select
          className={selectCls}
          value={filterType}
          onChange={(e) => setFilterType(e.target.value)}
        >
          <option value="">{t("admin.content.allTypes")}</option>
          {CONTENT_TYPES.map((ct) => (
            <option key={ct} value={ct}>
              {t(`admin.content.type_${ct}`)}
            </option>
          ))}
        </select>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center text-sm text-muted-foreground">
          {t("admin.content.noItems")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                <th
                  className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort("title")}
                >
                  {t("admin.content.colTitle")} <SortIcon field="title" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort("type")}
                >
                  {t("admin.content.colType")} <SortIcon field="type" />
                </th>
                <th
                  className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort("locale")}
                >
                  {t("admin.content.colLocale")} <SortIcon field="locale" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.content.colTopics")}
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.content.colStatus")}
                </th>
                <th
                  className="cursor-pointer px-4 py-3 font-medium text-muted-foreground hover:text-foreground"
                  onClick={() => toggleSort("updated_at")}
                >
                  {t("admin.content.colUpdated")} <SortIcon field="updated_at" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground text-right">
                  {t("admin.content.colActions")}
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td colSpan={7} className="p-4">
                      <ItemForm
                        initial={{
                          id: item.id,
                          locale: item.locale,
                          type: item.type,
                          title: item.title,
                          summary: item.summary ?? "",
                          topics: item.topics,
                          metadata: item.metadata,
                          is_published: item.is_published,
                        }}
                        mode="edit"
                        saving={saving}
                        onSave={(data) => void handleUpdate(item.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.id}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                        {t(`admin.content.type_${item.type}`)}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-xs font-medium uppercase">
                        {item.locale}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-1">
                        {item.topics.slice(0, 3).map((tp) => (
                          <span
                            key={tp}
                            className="inline-flex rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground"
                          >
                            {tp}
                          </span>
                        ))}
                        {item.topics.length > 3 && (
                          <span className="text-xs text-muted-foreground">
                            +{item.topics.length - 3}
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => void handleTogglePublished(item)}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                          item.is_published
                            ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                            : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                        }`}
                        title={t("admin.content.togglePublished")}
                      >
                        {item.is_published ? (
                          <Eye className="h-3 w-3" />
                        ) : (
                          <EyeOff className="h-3 w-3" />
                        )}
                        {item.is_published
                          ? t("admin.content.published")
                          : t("admin.content.draft")}
                      </button>
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground">
                      {item.updated_at
                        ? new Date(item.updated_at).toLocaleDateString(locale, {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })
                        : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-xs"
                          onClick={() => setEditingId(item.id)}
                          title={t("admin.content.editBtn")}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        {deleteConfirm === item.id ? (
                          <>
                            <Button
                              variant="destructive"
                              size="icon-xs"
                              onClick={() => void handleDelete(item.id)}
                              title={t("admin.content.confirmDelete")}
                            >
                              <Check className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon-xs"
                              onClick={() => setDeleteConfirm(null)}
                              title={t("admin.content.cancelBtn")}
                            >
                              <X className="h-3.5 w-3.5" />
                            </Button>
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-xs"
                            onClick={() => setDeleteConfirm(item.id)}
                            title={t("admin.content.deleteBtn")}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ),
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Summary footer */}
      {!loading && (
        <div className="mt-4 text-xs text-muted-foreground">
          {t("admin.content.showingCount", {
            shown: filtered.length,
            total: items.length,
          })}
        </div>
      )}
    </div>
  )
}
