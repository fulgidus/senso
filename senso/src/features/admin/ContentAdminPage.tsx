/**
 * ContentAdminPage.tsx — Backoffice page for managing content items.
 *
 * Features:
 * - Table view with locale/type/published filters
 * - Create new item with auto-slug generation (D2)
 * - Edit with unlocked locale field (D1) + slug field
 * - Debounced slug collision detection (D3)
 * - Localization group linking/unlinking (D4)
 * - Group-aware bulk publish/delete (D5)
 * - Tabbed edit when item is in a localization group (D5)
 * - Selection checkboxes for bulk operations
 */

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
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
  ChevronsUpDown,
  Globe,
  Settings2,
  Loader2,
  Link2,
  Unlink,
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
  checkSlugExists,
  searchLinkableItems,
  getItemSiblings,
  bulkPublish,
  bulkDelete,
} from "./adminContentApi"

// ── Constants ────────────────────────────────────────────────────────────────

const CONTENT_TYPES = ["article", "video", "slide_deck", "partner_offer"] as const
const LOCALES = ["it", "en"] as const

type ContentType = (typeof CONTENT_TYPES)[number]

// ── Metadata field hints per type ────────────────────────────────────────

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

// ── Slug helper (basic client-side slugify) ──────────────────────────────

function slugify(text: string): string {
  return text
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "") // strip diacritics
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 200)
}

// ── Helpers ──────────────────────────────────────────────────────────────

function emptyCreate(): ContentItemCreatePayload {
  return {
    slug: "",
    locale: "it",
    type: "article",
    title: "",
    summary: "",
    topics: [],
    metadata: {},
    is_published: true,
  }
}

// ── Item form (shared by create and edit) ────────────────────────────────

type ItemFormProps = {
  initial: ContentItemCreatePayload
  mode: "create" | "edit"
  itemId?: string // only in edit mode — for slug collision exclude
  saving: boolean
  onSave: (data: ContentItemCreatePayload) => void
  onCancel: () => void
}

function ItemForm({ initial, mode, itemId, saving, onSave, onCancel }: ItemFormProps) {
  const { t } = useTranslation()
  const [form, setForm] = useState<ContentItemCreatePayload>(initial)
  const [topicsStr, setTopicsStr] = useState(initial.topics?.join(", ") ?? "")
  const [metaStr, setMetaStr] = useState(
    JSON.stringify(initial.metadata ?? {}, null, 2),
  )
  const [metaError, setMetaError] = useState(false)

  // D2: Auto-slug from title (create mode only, if slug not manually edited)
  const [slugManuallyEdited, setSlugManuallyEdited] = useState(mode === "edit")

  // D3: Slug collision detection
  const [slugCollision, setSlugCollision] = useState(false)
  const [slugChecking, setSlugChecking] = useState(false)
  const slugCheckTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const currentType = form.type as ContentType
  const hints = METADATA_HINTS[currentType] ?? []

  // D2: Auto-generate slug when title changes (create mode, not manually edited)
  useEffect(() => {
    if (mode === "create" && !slugManuallyEdited && form.title) {
      const newSlug = slugify(form.title)
      setForm((f) => ({ ...f, slug: newSlug }))
    }
  }, [form.title, mode, slugManuallyEdited])

  // D3: Debounced slug collision check
  useEffect(() => {
    if (!form.slug || form.slug.length < 2) {
      setSlugCollision(false)
      return
    }
    if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current)
    slugCheckTimer.current = setTimeout(async () => {
      setSlugChecking(true)
      try {
        const exists = await checkSlugExists(form.slug, mode === "edit" ? itemId : undefined)
        setSlugCollision(exists)
      } catch {
        // ignore check errors
      } finally {
        setSlugChecking(false)
      }
    }, 500)
    return () => {
      if (slugCheckTimer.current) clearTimeout(slugCheckTimer.current)
    }
  }, [form.slug, mode, itemId])

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (slugCollision) return // D3: prevent save on collision
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
        {/* Slug (D1/D2/D3) */}
        <div>
          <label className={labelCls}>{t("admin.content.fieldSlug")}</label>
          <div className="relative">
            <input
              className={`${inputCls} ${slugCollision ? "border-destructive ring-destructive" : ""}`}
              value={form.slug}
              onChange={(e) => {
                setSlugManuallyEdited(true)
                setForm((f) => ({ ...f, slug: e.target.value }))
              }}
              required
              placeholder={t("admin.content.fieldSlugPlaceholder")}
            />
            {slugChecking && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {mode === "create" && !slugManuallyEdited && form.slug && (
            <p className="mt-1 text-xs text-muted-foreground">
              {t("admin.content.slugAutoHint")}
            </p>
          )}
        </div>

        {/* D1: Locale — now editable in edit mode */}
        <div>
          <label className={labelCls}>{t("admin.content.fieldLocale")}</label>
          <select
            className={inputCls}
            value={form.locale}
            onChange={(e) => setForm((f) => ({ ...f, locale: e.target.value }))}
          >
            {LOCALES.map((l) => (
              <option key={l} value={l}>
                {l.toUpperCase()}
              </option>
            ))}
          </select>
        </div>

        {/* Type — locked on edit */}
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
        <div className="sm:col-span-2 lg:col-span-2">
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

        {/* Body */}
        <div className="sm:col-span-2 lg:col-span-3">
          <label className={labelCls}>{t("admin.content.fieldBody")}</label>
          <textarea
            className={`${inputCls} min-h-[120px] resize-y font-mono text-xs`}
            value={form.body ?? ""}
            onChange={(e) => setForm((f) => ({ ...f, body: e.target.value }))}
            placeholder={t("admin.content.fieldBodyPlaceholder")}
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

        {/* Reading time (articles) */}
        {(form.type === "article" || form.type === "slide_deck") && (
          <div>
            <label className={labelCls}>{t("admin.content.fieldReadingTime")}</label>
            <input
              className={inputCls}
              type="number"
              min="0"
              value={form.reading_time_minutes ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  reading_time_minutes: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="5"
            />
          </div>
        )}

        {/* Duration (videos) */}
        {form.type === "video" && (
          <div>
            <label className={labelCls}>{t("admin.content.fieldDuration")}</label>
            <input
              className={inputCls}
              type="number"
              min="0"
              value={form.duration_seconds ?? ""}
              onChange={(e) =>
                setForm((f) => ({
                  ...f,
                  duration_seconds: e.target.value ? Number(e.target.value) : null,
                }))
              }
              placeholder="300"
            />
          </div>
        )}

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
        <Button type="submit" disabled={saving || slugCollision}>
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

// ── Localization group panel (D4) ────────────────────────────────────────

type L10nGroupPanelProps = {
  item: AdminContentItemDTO
  onLink: (targetId: string) => void
  onUnlink: () => void
}

function L10nGroupPanel({ item, onLink, onUnlink }: L10nGroupPanelProps) {
  const { t } = useTranslation()
  const [siblings, setSiblings] = useState<AdminContentItemDTO[]>([])
  const [loadingSiblings, setLoadingSiblings] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [searchResults, setSearchResults] = useState<AdminContentItemDTO[]>([])
  const [searching, setSearching] = useState(false)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load siblings on mount
  useEffect(() => {
    if (item.localization_group) {
      setLoadingSiblings(true)
      getItemSiblings(item.id)
        .then(setSiblings)
        .catch(() => setSiblings([]))
        .finally(() => setLoadingSiblings(false))
    }
  }, [item.id, item.localization_group])

  // Debounced search for linkable items
  useEffect(() => {
    if (searchQuery.length < 2) {
      setSearchResults([])
      return
    }
    if (searchTimer.current) clearTimeout(searchTimer.current)
    searchTimer.current = setTimeout(async () => {
      setSearching(true)
      try {
        const results = await searchLinkableItems({
          q: searchQuery,
          contentType: item.type,
          excludeLocale: item.locale,
          limit: 8,
        })
        setSearchResults(results)
      } catch {
        setSearchResults([])
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [searchQuery, item.type, item.locale])

  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"

  return (
    <div className="mt-4 rounded-lg border border-border bg-muted/30 p-4">
      <h4 className="mb-3 flex items-center gap-2 text-sm font-semibold text-foreground">
        <Link2 className="h-4 w-4" />
        {t("admin.content.l10nGroup")}
      </h4>

      {/* Current group siblings */}
      {item.localization_group && (
        <div className="mb-3">
          {loadingSiblings ? (
            <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
          ) : siblings.length > 0 ? (
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground mb-1">{t("admin.content.l10nSiblings")}</p>
              {siblings.map((sib) => (
                <div
                  key={sib.id}
                  className="flex items-center gap-2 rounded bg-background px-3 py-1.5 text-sm"
                >
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {sib.locale}
                  </span>
                  <span className="truncate text-foreground">{sib.title}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted-foreground">{t("admin.content.l10nNoSiblings")}</p>
          )}

          <button
            type="button"
            onClick={onUnlink}
            className="mt-2 flex items-center gap-1 text-xs text-destructive hover:underline"
          >
            <Unlink className="h-3 w-3" />
            {t("admin.content.l10nUnlink")}
          </button>
        </div>
      )}

      {/* Search to link */}
      {!item.localization_group && (
        <div>
          <p className="mb-2 text-xs text-muted-foreground">
            {t("admin.content.l10nSearchHint")}
          </p>
          <div className="relative">
            <input
              className={inputCls}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("admin.content.l10nSearchPlaceholder")}
            />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {searchResults.length > 0 && (
            <div className="mt-1 space-y-1">
              {searchResults.map((r) => (
                <button
                  key={r.id}
                  type="button"
                  onClick={() => onLink(r.id)}
                  className="flex w-full items-center gap-2 rounded bg-background px-3 py-1.5 text-sm text-left hover:bg-accent transition-colors"
                >
                  <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">
                    {r.locale}
                  </span>
                  <span className="truncate text-foreground">{r.title}</span>
                  <Link2 className="ml-auto h-3 w-3 text-muted-foreground" />
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ── Main page ────────────────────────────────────────────────────────────────

export function ContentAdminPage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"

  // ── State ──
  const [items, setItems] = useState<AdminContentItemDTO[]>([])
  const [totalCount, setTotalCount] = useState(0)
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

  // Pagination
  const [page, setPage] = useState(1)
  const PAGE_SIZE = 25

  // D5: Selection for bulk operations
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [_bulkAction, setBulkAction] = useState<"publish" | "unpublish" | "delete" | null>(null)
  const [bulkApplyToGroup, setBulkApplyToGroup] = useState(true)
  const [bulkProcessing, setBulkProcessing] = useState(false)

  // ── Load items ──
  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await listAdminContent({
        locale: filterLocale || undefined,
        type: filterType || undefined,
      })
      setItems(data.items)
      setTotalCount(data.total)
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

  // Reset page when filters or sort change
  useEffect(() => { setPage(1) }, [filterLocale, filterType, filterSearch, sortField, sortDir])

  // ── Filtered + sorted items ──
  const filtered = useMemo(() => {
    let list = items
    if (filterSearch) {
      const q = filterSearch.toLowerCase()
      list = list.filter(
        (it) =>
          it.title.toLowerCase().includes(q) ||
          it.id.toLowerCase().includes(q) ||
          it.slug.toLowerCase().includes(q) ||
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

  // ── Paginated items ──
  const paginated = useMemo(
    () => filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE),
    [filtered, page],
  )
  const totalPages = Math.ceil(filtered.length / PAGE_SIZE)

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
          slug: data.slug,
          locale: data.locale,
          title: data.title,
          summary: data.summary,
          body: data.body,
          topics: data.topics,
          metadata: data.metadata,
          is_published: data.is_published,
          reading_time_minutes: data.reading_time_minutes,
          duration_seconds: data.duration_seconds,
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

  // D4: Link localization group
  const handleL10nLink = useCallback(
    async (itemId: string, targetId: string) => {
      try {
        // Get the target item to see if it has a group already
        const target = items.find((i) => i.id === targetId)
        const currentItem = items.find((i) => i.id === itemId)
        if (!currentItem) return

        // Use existing group or create new one (UUIDv7 generated server-side)
        // The backend assigns `localization_group` via update
        const groupId = target?.localization_group ?? crypto.randomUUID()

        // Set group on both items
        await updateContentItem(itemId, { localization_group: groupId })
        if (!target?.localization_group) {
          await updateContentItem(targetId, { localization_group: groupId })
        }
        await loadItems()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.content.updateError"),
        )
      }
    },
    [items, loadItems, t],
  )

  // D4: Unlink from localization group
  const handleL10nUnlink = useCallback(
    async (itemId: string) => {
      try {
        await updateContentItem(itemId, { localization_group: null })
        await loadItems()
      } catch (err) {
        setError(
          err instanceof Error ? err.message : t("admin.content.updateError"),
        )
      }
    },
    [loadItems, t],
  )

  // D5: Bulk action handlers
  const handleBulkExecute = useCallback(async (action: "publish" | "unpublish" | "delete") => {
    if (selected.size === 0) return
    setBulkAction(action)
    setBulkProcessing(true)
    try {
      const ids = Array.from(selected)
      if (action === "publish") {
        await bulkPublish({ itemIds: ids, isPublished: true, applyToGroup: bulkApplyToGroup })
      } else if (action === "unpublish") {
        await bulkPublish({ itemIds: ids, isPublished: false, applyToGroup: bulkApplyToGroup })
      } else if (action === "delete") {
        await bulkDelete({ itemIds: ids, applyToGroup: bulkApplyToGroup })
      }
      setSelected(new Set())
      setBulkAction(null)
      await loadItems()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : t("admin.content.bulkError"),
      )
    } finally {
      setBulkProcessing(false)
    }
  }, [selected, bulkApplyToGroup, loadItems, t])

  const toggleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"))
    } else {
      setSortField(field)
      setSortDir("asc")
    }
  }

  const toggleSelectAll = () => {
    if (selected.size === filtered.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(filtered.map((i) => i.id)))
    }
  }

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  const SortIcon = ({ field }: { field: typeof sortField }) =>
    sortField === field ? (
      sortDir === "asc" ? (
        <ChevronUp className="inline h-3 w-3 ml-1" />
      ) : (
        <ChevronDown className="inline h-3 w-3 ml-1" />
      )
    ) : (
      <ChevronsUpDown className="inline h-3 w-3 ml-1 opacity-40" />
    )

  const selectCls =
    "rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-primary"
  const inputCls =
    "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary"

  // Check if any selected items have localization groups
  const selectedHaveGroups = useMemo(
    () => Array.from(selected).some((id) => items.find((i) => i.id === id)?.localization_group),
    [selected, items],
  )

  return (
    <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6">
      {/* Header */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">
            {t("admin.content.title")}
          </h1>
          <p className="text-sm text-muted-foreground">
            {t("admin.content.subtitle", { count: totalCount })}
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

      {/* D5: Bulk action bar */}
      {selected.size > 0 && (
        <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <span className="text-sm font-medium text-foreground">
            {t("admin.content.bulkSelected", { count: selected.size })}
          </span>
          <div className="flex-1"></div>
          {selectedHaveGroups && (
            <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <input
                type="checkbox"
                checked={bulkApplyToGroup}
                onChange={(e) => setBulkApplyToGroup(e.target.checked)}
                className="h-3.5 w-3.5 rounded border-border"
              />
              {t("admin.content.bulkApplyToGroup")}
            </label>
          )}
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleBulkExecute("publish")}
            disabled={bulkProcessing}
          >
            <Eye className="mr-1 h-3.5 w-3.5" />
            {t("admin.content.bulkPublish")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => void handleBulkExecute("unpublish")}
            disabled={bulkProcessing}
          >
            <EyeOff className="mr-1 h-3.5 w-3.5" />
            {t("admin.content.bulkUnpublish")}
          </Button>
          <Button
            size="sm"
            variant="destructive"
            onClick={() => void handleBulkExecute("delete")}
            disabled={bulkProcessing}
          >
            <Trash2 className="mr-1 h-3.5 w-3.5" />
            {t("admin.content.bulkDelete")}
          </Button>
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setSelected(new Set())}
          >
            {t("admin.content.bulkClear")}
          </Button>
          {bulkProcessing && <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />}
        </div>
      )}

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
        <>
          {/* Mobile card list */}
          <div className="sm:hidden space-y-2">
            {filtered.map((item) => (
              <div key={item.id} className="rounded-2xl border border-border bg-card p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="font-medium text-foreground text-sm truncate">{item.title}</div>
                    <div className="text-xs text-muted-foreground truncate">{item.slug}</div>
                  </div>
                  <span className="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary shrink-0">
                    {t(`admin.content.type_${item.type}`)}
                  </span>
                </div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-xs font-medium uppercase">{item.locale}</span>
                  <button
                    onClick={() => void handleTogglePublished(item)}
                    className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium transition-colors ${
                      item.is_published
                        ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
                        : "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400"
                    }`}
                  >
                    {item.is_published ? <Eye className="h-3 w-3" /> : <EyeOff className="h-3 w-3" />}
                    {item.is_published ? t("admin.content.published") : t("admin.content.draft")}
                  </button>
                  {item.updated_at && (
                    <span className="text-xs text-muted-foreground">
                      {new Date(item.updated_at).toLocaleDateString(locale, { day: "2-digit", month: "short", year: "numeric" })}
                    </span>
                  )}
                </div>
                <div className="flex items-center justify-end gap-1">
                  <Button variant="ghost" size="icon-xs" onClick={() => setEditingId(item.id)} title={t("admin.content.editBtn")}>
                    <Pencil className="h-3.5 w-3.5" />
                  </Button>
                  {deleteConfirm === item.id ? (
                    <>
                      <Button variant="destructive" size="icon-xs" onClick={() => void handleDelete(item.id)} title={t("admin.content.confirmDelete")}>
                        <Check className="h-3.5 w-3.5" />
                      </Button>
                      <Button variant="ghost" size="icon-xs" onClick={() => setDeleteConfirm(null)} title={t("admin.content.cancelBtn")}>
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </>
                  ) : (
                    <Button variant="ghost" size="icon-xs" onClick={() => setDeleteConfirm(item.id)} title={t("admin.content.deleteBtn")}>
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {/* Desktop table */}
          <div className="hidden sm:block overflow-x-auto rounded-2xl border border-border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left">
                {/* D5: Select all checkbox */}
                <th className="w-10 px-3 py-3">
                  <input
                    type="checkbox"
                    checked={selected.size === filtered.length && filtered.length > 0}
                    onChange={toggleSelectAll}
                    className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                  />
                </th>
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
                  title={t("admin.content.colLocale")}
                >
                  <Globe className="h-4 w-4 inline" aria-hidden="true" />
                  <span className="sr-only">{t("admin.content.colLocale")}</span>
                  <SortIcon field="locale" />
                </th>
                <th className="px-4 py-3 font-medium text-muted-foreground">
                  {t("admin.content.colGroup")}
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
                  <Settings2 className="h-4 w-4 ml-auto inline" aria-hidden="true" />
                  <span className="sr-only">{t("admin.content.colActions")}</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {paginated.map((item) =>
                editingId === item.id ? (
                  <tr key={item.id}>
                    <td colSpan={8} className="p-4">
                      <ItemForm
                        initial={{
                          slug: item.slug,
                          locale: item.locale,
                          type: item.type,
                          title: item.title,
                          summary: item.summary ?? "",
                          body: item.body ?? "",
                          topics: item.topics,
                          metadata: item.metadata,
                          is_published: item.is_published,
                          reading_time_minutes: item.reading_time_minutes,
                          duration_seconds: item.duration_seconds,
                        }}
                        mode="edit"
                        itemId={item.id}
                        saving={saving}
                        onSave={(data) => void handleUpdate(item.id, data)}
                        onCancel={() => setEditingId(null)}
                      />
                      {/* D4: Localization group panel */}
                      <L10nGroupPanel
                        item={item}
                        onLink={(targetId) => void handleL10nLink(item.id, targetId)}
                        onUnlink={() => void handleL10nUnlink(item.id)}
                      />
                    </td>
                  </tr>
                ) : (
                  <tr
                    key={item.id}
                    className="border-b border-border last:border-0 hover:bg-accent/50 transition-colors"
                  >
                    {/* D5: Row checkbox */}
                    <td className="px-3 py-3">
                      <input
                        type="checkbox"
                        checked={selected.has(item.id)}
                        onChange={() => toggleSelect(item.id)}
                        className="h-4 w-4 rounded border-border text-primary focus:ring-primary"
                      />
                    </td>
                    <td className="px-4 py-3">
                      <div className="font-medium text-foreground">
                        {item.title}
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {item.slug}
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
                      {item.localization_group ? (
                        <Link2 className="h-3.5 w-3.5 text-primary" aria-label={t("admin.content.l10nLinked")} />
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
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

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between gap-3 mt-3 px-1">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
              >
                {t("admin.content.paginationPrev")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("admin.content.paginationInfo", { page, totalPages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                {t("admin.content.paginationNext")}
              </Button>
            </div>
          )}
        </div>
        </>
      )}

      {/* Summary footer */}
      {!loading && (
        <div className="mt-4 text-xs text-muted-foreground">
          {t("admin.content.showingCount", {
            shown: filtered.length,
            total: totalCount,
          })}
        </div>
      )}
    </div>
  )
}
