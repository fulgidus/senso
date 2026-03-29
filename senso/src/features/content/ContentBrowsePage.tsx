/**
 * ContentBrowsePage — public /learn page for browsing published content.
 *
 * No authentication required. Displays content items in a filterable grid
 * with BM25 search and type/locale filters.
 */

import { useEffect, useState, useCallback } from "react"
import { Link, useSearchParams } from "react-router-dom"
import { useTranslation } from "react-i18next"
import {
  fetchPublicContent,
  searchContent,
  type ContentItemDTO,
} from "./contentApi"

// ── Type badge colours ───────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  article: { bg: "bg-blue-100 dark:bg-blue-900/40", text: "text-blue-700 dark:text-blue-300", label: "article" },
  video: { bg: "bg-red-100 dark:bg-red-900/40", text: "text-red-700 dark:text-red-300", label: "video" },
  slide_deck: { bg: "bg-green-100 dark:bg-green-900/40", text: "text-green-700 dark:text-green-300", label: "slide_deck" },
  partner_offer: { bg: "bg-amber-100 dark:bg-amber-900/40", text: "text-amber-700 dark:text-amber-300", label: "partner_offer" },
}

const TYPE_ICON: Record<string, string> = {
  article: "📄",
  video: "🎬",
  slide_deck: "📊",
  partner_offer: "🤝",
}

type FilterType = "all" | "article" | "video" | "slide_deck" | "partner_offer"

const FILTER_TABS: { key: FilterType; i18nKey: string }[] = [
  { key: "all", i18nKey: "content.filterAll" },
  { key: "article", i18nKey: "content.filterArticles" },
  { key: "video", i18nKey: "content.filterVideos" },
  { key: "slide_deck", i18nKey: "content.filterSlides" },
  { key: "partner_offer", i18nKey: "content.filterPartners" },
]

// ── Component ────────────────────────────────────────────────────────────────

export function ContentBrowsePage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"
  const [searchParams, setSearchParams] = useSearchParams()

  const [items, setItems] = useState<ContentItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get("type") as FilterType) || "all",
  )
  const [searchQuery, setSearchQuery] = useState(searchParams.get("q") || "")
  const [isSearching, setIsSearching] = useState(false)

  // Load content items
  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPublicContent({
        locale,
        type: filter === "all" ? undefined : filter,
        pageSize: 50,
      })
      setItems(data)
    } catch {
      setError("Failed to load content")
    } finally {
      setLoading(false)
    }
  }, [locale, filter])

  // Perform search
  const doSearch = useCallback(async (q: string) => {
    if (!q.trim()) {
      setIsSearching(false)
      void loadItems()
      return
    }
    setIsSearching(true)
    setLoading(true)
    setError(null)
    try {
      const data = await searchContent({
        q,
        locale,
        topK: 20,
        type: filter === "all" ? undefined : filter,
      })
      setItems(data)
    } catch {
      setError("Search failed")
    } finally {
      setLoading(false)
    }
  }, [locale, filter, loadItems])

  // Load on filter or locale change
  useEffect(() => {
    if (!isSearching) {
      void loadItems()
    }
  }, [loadItems, isSearching])

  // Update URL params
  useEffect(() => {
    const params: Record<string, string> = {}
    if (filter !== "all") params.type = filter
    if (searchQuery) params.q = searchQuery
    setSearchParams(params, { replace: true })
  }, [filter, searchQuery, setSearchParams])

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    if (searchQuery) {
      void doSearch(searchQuery)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    void doSearch(searchQuery)
  }

  const handleSearchClear = () => {
    setSearchQuery("")
    setIsSearching(false)
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <div className="flex items-center justify-between">
            <h1 className="text-2xl font-bold text-foreground">
              {t("content.browseTitle")}
            </h1>
            <Link
              to="/"
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              ← S.E.N.S.O.
            </Link>
          </div>

          {/* Search bar */}
          <form onSubmit={handleSearchSubmit} className="mt-4 flex gap-2">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={t("content.searchPlaceholder")}
              className="flex-1 rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={handleSearchClear}
                className="rounded-lg border border-input px-3 py-2 text-sm text-muted-foreground hover:bg-muted"
              >
                ✕
              </button>
            )}
          </form>

          {/* Filter tabs */}
          <div className="mt-4 flex gap-1 overflow-x-auto">
            {FILTER_TABS.map(({ key, i18nKey }) => (
              <button
                key={key}
                onClick={() => handleFilterChange(key)}
                className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                  filter === key
                    ? "bg-primary text-primary-foreground"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
              >
                {t(i18nKey)}
              </button>
            ))}
          </div>
        </div>
      </header>

      {/* Content grid */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {loading && (
          <div className="flex items-center justify-center py-12">
            <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
          </div>
        )}

        {error && !loading && (
          <div className="rounded-lg border border-destructive/50 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {!loading && !error && items.length === 0 && (
          <p className="py-12 text-center text-muted-foreground">
            {t("content.noResults")}
          </p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {items.map((item) => (
              <ContentCard key={item.id} item={item} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Content card ─────────────────────────────────────────────────────────────

function ContentCard({ item }: { item: ContentItemDTO }) {
  const { t } = useTranslation()
  const badge = TYPE_BADGE[item.type] || TYPE_BADGE.article
  const icon = TYPE_ICON[item.type] || "📄"

  const ctaLabel = (() => {
    switch (item.type) {
      case "article": return t("content.readMore")
      case "video": return t("content.watchVideo")
      case "slide_deck": return t("content.viewSlides")
      default: return t("content.readMore")
    }
  })()

  const metaInfo = (() => {
    const md = item.metadata
    if (item.type === "article" && md.estimated_read_minutes) {
      return t("content.readingMinutes", { minutes: md.estimated_read_minutes })
    }
    if (item.type === "slide_deck" && md.slide_count) {
      return t("content.slides", { count: md.slide_count })
    }
    if (item.type === "partner_offer" && md.partner_name) {
      return String(md.partner_name)
    }
    return null
  })()

  return (
    <Link
      to={`/learn/${encodeURIComponent(item.id)}`}
      className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md"
    >
      {/* Header: type badge + meta */}
      <div className="mb-2 flex items-center gap-2">
        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}>
          <span>{icon}</span>
          {t(`content.filter${item.type === "article" ? "Articles" : item.type === "video" ? "Videos" : item.type === "slide_deck" ? "Slides" : "Partners"}`)}
        </span>
        {metaInfo && (
          <span className="text-xs text-muted-foreground">{metaInfo}</span>
        )}
      </div>

      {/* Title */}
      <h3 className="mb-1 text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
        {item.title}
      </h3>

      {/* Summary */}
      {item.summary && (
        <p className="mb-3 text-sm text-muted-foreground line-clamp-3">
          {item.summary}
        </p>
      )}

      {/* Topics */}
      {item.topics.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {item.topics.slice(0, 4).map((topic) => (
            <span
              key={topic}
              className="rounded-md bg-muted px-2 py-0.5 text-xs text-muted-foreground"
            >
              {topic}
            </span>
          ))}
        </div>
      )}

      {/* CTA */}
      <span className="mt-3 text-sm font-medium text-primary">
        {ctaLabel} →
      </span>
    </Link>
  )
}

export default ContentBrowsePage
