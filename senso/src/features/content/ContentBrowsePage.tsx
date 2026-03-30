/**
 * ContentBrowsePage — public /learn page for browsing published content.
 *
 * No authentication required. Displays content items in a filterable grid
 * with BM25 search and type/locale filters.
 *
 * URL patterns:
 *   /learn                — browse all
 *   /learn/q/:query       — search results for :query
 *   /learn/t/:tag1/:tag2  — OR-filter by tags
 *   /learn/t/all/:t1/:t2  — AND-filter by tags
 */

import { useEffect, useState, useCallback } from "react"
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom"
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

// ── URL-driven state helpers ─────────────────────────────────────────────────

/** Parse /learn/t/... URL segments into tags array + mode */
export function parseTagsFromPath(segments: string[]): { tags: string[]; mode: "any" | "all" } {
  if (segments.length === 0) return { tags: [], mode: "any" }
  if (segments[0] === "all") return { tags: segments.slice(1), mode: "all" }
  return { tags: segments, mode: "any" }
}

// ── Component ────────────────────────────────────────────────────────────────

/** Main browse page — used by /learn, /learn/q/:query, /learn/t/:tags */
export function ContentBrowsePage() {
  const { t, i18n } = useTranslation()
  const locale = i18n.language.startsWith("en") ? "en" : "it"
  const params = useParams()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  // URL-driven search query from /learn/q/:query
  const urlQuery = params.query ?? ""
  // URL-driven tags from /learn/t/:tags+
  const urlTagsRaw = params["*"] ?? ""
  const urlTagSegments = urlTagsRaw ? urlTagsRaw.split("/").filter(Boolean) : []
  const { tags: urlTags, mode: urlTagsMode } = parseTagsFromPath(urlTagSegments)

  const [items, setItems] = useState<ContentItemDTO[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get("type") as FilterType) || "all",
  )
  const [searchQuery, setSearchQuery] = useState(urlQuery || searchParams.get("q") || "")
  const [isSearching, setIsSearching] = useState(!!urlQuery)

  // Load content items (browse mode)
  const loadItems = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchPublicContent({
        locale,
        type: filter === "all" ? undefined : filter,
        pageSize: 50,
        topics: urlTags.length > 0 ? urlTags : undefined,
        topicsMode: urlTags.length > 0 ? urlTagsMode : undefined,
      })
      setItems(data.items)
    } catch {
      setError("Failed to load content")
    } finally {
      setLoading(false)
    }
  }, [locale, filter, urlTags.join(","), urlTagsMode])

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

  // React to URL-driven search query
  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery)
      void doSearch(urlQuery)
    } else if (!isSearching) {
      void loadItems()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery, loadItems])

  // React to tag-only changes (when no search query)
  useEffect(() => {
    if (!urlQuery && !isSearching) {
      void loadItems()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTags.join(","), urlTagsMode])

  // Update URL search params for type filter (only when not using tag/query routes)
  useEffect(() => {
    if (!urlQuery && urlTags.length === 0) {
      const params: Record<string, string> = {}
      if (filter !== "all") params.type = filter
      if (searchQuery && isSearching) params.q = searchQuery
      setSearchParams(params, { replace: true })
    }
  }, [filter, searchQuery, isSearching, setSearchParams, urlQuery, urlTags.length])

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter)
    if (searchQuery && isSearching) {
      void doSearch(searchQuery)
    }
  }

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = searchQuery.trim()
    if (trimmed) {
      // Navigate to /learn/q/:query URL
      navigate(`/learn/q/${encodeURIComponent(trimmed)}`)
    } else {
      navigate("/learn")
    }
  }

  const handleSearchClear = () => {
    setSearchQuery("")
    setIsSearching(false)
    navigate("/learn")
  }

  const handleTagClick = (tag: string) => {
    // If already filtering by this tag, remove it; otherwise add
    if (urlTags.includes(tag)) {
      const newTags = urlTags.filter((t) => t !== tag)
      if (newTags.length === 0) {
        navigate("/learn")
      } else {
        navigate(`/learn/t/${newTags.map(encodeURIComponent).join("/")}`)
      }
    } else {
      const newTags = [...urlTags, tag]
      navigate(`/learn/t/${newTags.map(encodeURIComponent).join("/")}`)
    }
  }

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">
            {t("content.browseTitle")}
          </h1>

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

          {/* Active tag filters */}
          {urlTags.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {urlTagsMode === "all" ? t("content.tagsFilterAnd") : t("content.tagsFilterOr")}:
              </span>
              {urlTags.map((tag) => (
                <button
                  key={tag}
                  onClick={() => handleTagClick(tag)}
                  className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary hover:bg-primary/20 transition-colors"
                >
                  {tag}
                  <span className="text-primary/60">✕</span>
                </button>
              ))}
              <button
                onClick={() => navigate("/learn")}
                className="text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                {t("content.clearTags")}
              </button>
            </div>
          )}

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
              <ContentCard key={item.id} item={item} onTagClick={handleTagClick} activeTags={urlTags} />
            ))}
          </div>
        )}
      </main>
    </div>
  )
}

// ── Content card ─────────────────────────────────────────────────────────────

function ContentCard({ item, onTagClick, activeTags }: { item: ContentItemDTO; onTagClick: (tag: string) => void; activeTags: string[] }) {
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
    if (item.type === "article" && item.reading_time_minutes) {
      return t("content.readingMinutes", { minutes: item.reading_time_minutes })
    }
    if (item.type === "slide_deck") {
      const slideCount = item.metadata?.slide_count as number | undefined
      if (slideCount) return t("content.slides", { count: slideCount })
    }
    if (item.type === "partner_offer") {
      const partnerName = item.metadata?.partner_name as string | undefined
      if (partnerName) return partnerName
    }
    return null
  })()

  return (
    <div className="group flex flex-col rounded-xl border border-border bg-card p-4 transition-shadow hover:shadow-md">
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

      {/* Title — links to slug-based detail page */}
      <Link to={`/learn/${encodeURIComponent(item.slug)}`} className="mb-1">
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {item.title}
        </h3>
      </Link>

      {/* Summary */}
      {item.summary && (
        <p className="mb-3 text-sm text-muted-foreground line-clamp-3">
          {item.summary}
        </p>
      )}

      {/* Topics — clickable */}
      {item.topics.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {item.topics.slice(0, 4).map((topic) => (
            <button
              key={topic}
              onClick={(e) => {
                e.preventDefault()
                onTagClick(topic)
              }}
              className={`rounded-md px-2 py-0.5 text-xs transition-colors ${
                activeTags.includes(topic)
                  ? "bg-primary/20 text-primary font-medium"
                  : "bg-muted text-muted-foreground hover:bg-primary/10 hover:text-primary"
              }`}
            >
              {topic}
            </button>
          ))}
        </div>
      )}

      {/* CTA */}
      <Link
        to={`/learn/${encodeURIComponent(item.slug)}`}
        className="mt-3 text-sm font-medium text-primary"
      >
        {ctaLabel} →
      </Link>
    </div>
  )
}

export default ContentBrowsePage
