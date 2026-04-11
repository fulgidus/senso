/**
 * ContentBrowsePage - public /learn page for browsing published content.
 *
 * No authentication required. Displays content items in a filterable grid
 * with BM25 search and type filters. Content locale follows the app's UI language.
 *
 * URL patterns:
 *   /learn                - browse all
 *   /learn/q/:query       - search results for :query
 *   /learn/t/:tag1/:tag2  - OR-filter by tags
 *   /learn/t/all/:t1/:t2  - AND-filter by tags
 *
 * Group C additions:
 *   C1: Sort controls (newest, oldest, reading_time, duration, title)
 *   C2: (Removed - locale follows app language switch)
 *   C3: Filter persistence (sessionStorage for unauthed, localStorage for authed)
 *   C4: Search suggestions (debounced BM25 suggest) + syntax hint tooltip
 *   C5: Clickable tags (done in Group B)
 */

import { useEffect, useState, useCallback, useRef, useMemo } from "react";
import { Link, useParams, useNavigate, useSearchParams } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  fetchPublicContent,
  searchContent,
  suggestContent,
  type ContentItemDTO,
  type ContentSuggestion,
} from "./contentApi";

// ── Type badge colours ───────────────────────────────────────────────────────

const TYPE_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  article: {
    bg: "bg-blue-100 dark:bg-blue-900/40",
    text: "text-blue-700 dark:text-blue-300",
    label: "article",
  },
  video: {
    bg: "bg-red-100 dark:bg-red-900/40",
    text: "text-red-700 dark:text-red-300",
    label: "video",
  },
  slide_deck: {
    bg: "bg-green-100 dark:bg-green-900/40",
    text: "text-green-700 dark:text-green-300",
    label: "slide_deck",
  },
  partner_offer: {
    bg: "bg-amber-100 dark:bg-amber-900/40",
    text: "text-amber-700 dark:text-amber-300",
    label: "partner_offer",
  },
};

const TYPE_ICON: Record<string, string> = {
  article: "📄",
  video: "🎬",
  slide_deck: "📊",
  partner_offer: "🤝",
};

type FilterType = "all" | "article" | "video" | "slide_deck" | "partner_offer";

const FILTER_TABS: { key: FilterType; i18nKey: string }[] = [
  { key: "all", i18nKey: "content.filterAll" },
  { key: "article", i18nKey: "content.filterArticles" },
  { key: "video", i18nKey: "content.filterVideos" },
  { key: "slide_deck", i18nKey: "content.filterSlides" },
  { key: "partner_offer", i18nKey: "content.filterPartners" },
];

// ── Sort options ─────────────────────────────────────────────────────────────

type SortOption = { key: string; dir: "asc" | "desc"; i18nKey: string };

const SORT_OPTIONS: SortOption[] = [
  { key: "created_at", dir: "desc", i18nKey: "content.sortNewest" },
  { key: "created_at", dir: "asc", i18nKey: "content.sortOldest" },
  { key: "reading_time_minutes", dir: "asc", i18nKey: "content.sortReadingTime" },
  { key: "duration_seconds", dir: "asc", i18nKey: "content.sortDuration" },
  { key: "title", dir: "asc", i18nKey: "content.sortTitle" },
];

// ── Filter persistence (C3) ─────────────────────────────────────────────────

const FILTER_STORAGE_KEY = "senso:learnFilters";

interface PersistedFilters {
  type?: FilterType;
  sortIdx?: number;
}

function readPersistedFilters(): PersistedFilters {
  try {
    // Try localStorage first (authed), then sessionStorage (unauthed)
    const raw =
      localStorage.getItem(FILTER_STORAGE_KEY) ?? sessionStorage.getItem(FILTER_STORAGE_KEY);
    if (raw) return JSON.parse(raw) as PersistedFilters;
  } catch {
    /* ignore */
  }
  return {};
}

function writePersistedFilters(filters: PersistedFilters) {
  const json = JSON.stringify(filters);
  try {
    // Write to both - the one that matters depends on auth state
    localStorage.setItem(FILTER_STORAGE_KEY, json);
  } catch {
    try {
      sessionStorage.setItem(FILTER_STORAGE_KEY, json);
    } catch {
      /* ignore */
    }
  }
}

// ── URL-driven state helpers ─────────────────────────────────────────────────

/** Parse /learn/t/... URL segments into tags array + mode */
export function parseTagsFromPath(segments: string[]): { tags: string[]; mode: "any" | "all" } {
  if (segments.length === 0) return { tags: [], mode: "any" };
  if (segments[0] === "all") return { tags: segments.slice(1), mode: "all" };
  return { tags: segments, mode: "any" };
}

// ── Component ────────────────────────────────────────────────────────────────

/** Main browse page - used by /learn, /learn/q/:query, /learn/t/:tags */
export function ContentBrowsePage() {
  const { t, i18n } = useTranslation();
  const uiLocale = i18n.language.startsWith("en") ? "en" : "it";
  const params = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  // URL-driven search query from /learn/q/:query
  const urlQuery = params.query ?? "";
  // URL-driven tags from /learn/t/:tags+
  const urlTagsRaw = params["*"] ?? "";
  const urlTagSegments = urlTagsRaw ? urlTagsRaw.split("/").filter(Boolean) : [];
  const { tags: urlTags, mode: urlTagsMode } = parseTagsFromPath(urlTagSegments);

  // C3: Read persisted defaults (only for initial state, URL overrides)
  const persisted = useMemo(() => readPersistedFilters(), []);

  const [items, setItems] = useState<ContentItemDTO[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<FilterType>(
    (searchParams.get("type") as FilterType) || persisted.type || "all",
  );
  const [sortIdx, setSortIdx] = useState(persisted.sortIdx != null ? persisted.sortIdx : 0);
  const [searchQuery, setSearchQuery] = useState(urlQuery || searchParams.get("q") || "");
  const [isSearching, setIsSearching] = useState(!!urlQuery);

  // C4: Search suggestions
  const [suggestions, setSuggestions] = useState<ContentSuggestion[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestionIdx, setSelectedSuggestionIdx] = useState(-1);
  const [showSyntaxHint, setShowSyntaxHint] = useState(false);
  const suggestTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  const sort = SORT_OPTIONS[sortIdx] ?? SORT_OPTIONS[0];

  // C3: Persist filter changes
  useEffect(() => {
    writePersistedFilters({ type: filter, sortIdx });
  }, [filter, sortIdx]);

  // Load content items (browse mode) - fetch ALL locales so multilingual
  // content stays visible; dedup logic picks the preferred-locale card.
  const loadItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchPublicContent({
        locale: undefined,
        type: filter === "all" ? undefined : filter,
        pageSize: 50,
        sortBy: sort.key,
        sortDir: sort.dir,
        topics: urlTags.length > 0 ? urlTags : undefined,
        topicsMode: urlTags.length > 0 ? urlTagsMode : undefined,
      });
      setItems(data.items);
      setTotalCount(data.total);
    } catch {
      setError("Failed to load content");
    } finally {
      setLoading(false);
    }
  }, [filter, sort.key, sort.dir, urlTags.join(","), urlTagsMode]);

  // Perform search
  const doSearch = useCallback(
    async (q: string) => {
      if (!q.trim()) {
        setIsSearching(false);
        void loadItems();
        return;
      }
      setIsSearching(true);
      setLoading(true);
      setError(null);
      try {
        const data = await searchContent({
          q,
          locale: uiLocale,
          topK: 20,
          type: filter === "all" ? undefined : filter,
        });
        setItems(data);
        setTotalCount(data.length);
      } catch {
        setError("Search failed");
      } finally {
        setLoading(false);
      }
    },
    [uiLocale, filter, loadItems],
  );

  // C4: Debounced suggestions
  const fetchSuggestions = useCallback(
    async (q: string) => {
      if (q.trim().length < 2) {
        setSuggestions([]);
        return;
      }
      try {
        const results = await suggestContent({ q: q.trim(), locale: uiLocale, limit: 5 });
        setSuggestions(results);
      } catch {
        setSuggestions([]);
      }
    },
    [uiLocale],
  );

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    setSelectedSuggestionIdx(-1);
    // Debounce suggestions at 300ms
    if (suggestTimerRef.current) clearTimeout(suggestTimerRef.current);
    if (value.trim().length >= 2) {
      suggestTimerRef.current = setTimeout(() => {
        void fetchSuggestions(value);
        setShowSuggestions(true);
      }, 300);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  };

  // Close suggestions on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        suggestionsRef.current &&
        !suggestionsRef.current.contains(e.target as Node) &&
        searchInputRef.current &&
        !searchInputRef.current.contains(e.target as Node)
      ) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // React to URL-driven search query
  useEffect(() => {
    if (urlQuery) {
      setSearchQuery(urlQuery);
      void doSearch(urlQuery);
    } else if (!isSearching) {
      void loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlQuery, loadItems]);

  // React to tag-only changes (when no search query)
  useEffect(() => {
    if (!urlQuery && !isSearching) {
      void loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [urlTags.join(","), urlTagsMode]);

  // Update URL search params for type filter (only when not using tag/query routes)
  useEffect(() => {
    if (!urlQuery && urlTags.length === 0) {
      const params: Record<string, string> = {};
      if (filter !== "all") params.type = filter;
      if (searchQuery && isSearching) params.q = searchQuery;
      setSearchParams(params, { replace: true });
    }
  }, [filter, searchQuery, isSearching, setSearchParams, urlQuery, urlTags.length]);

  const handleFilterChange = (newFilter: FilterType) => {
    setFilter(newFilter);
    if (searchQuery && isSearching) {
      void doSearch(searchQuery);
    }
  };

  const handleSortChange = (idx: number) => {
    setSortIdx(idx);
  };

  // Re-fetch when sort changes (browse mode only)
  useEffect(() => {
    if (!isSearching && !urlQuery) {
      void loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortIdx]);

  // Re-fetch when app locale changes
  useEffect(() => {
    if (isSearching && searchQuery) {
      void doSearch(searchQuery);
    } else if (!urlQuery) {
      void loadItems();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uiLocale]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuggestions(false);
    const trimmed = searchQuery.trim();
    if (trimmed) {
      navigate(`/learn/q/${encodeURIComponent(trimmed)}`);
    } else {
      navigate("/learn");
    }
  };

  const handleSearchClear = () => {
    setSearchQuery("");
    setIsSearching(false);
    setSuggestions([]);
    setShowSuggestions(false);
    navigate("/learn");
  };

  const handleSuggestionClick = (suggestion: ContentSuggestion) => {
    setShowSuggestions(false);
    setSelectedSuggestionIdx(-1);
    navigate(`/learn/${encodeURIComponent(suggestion.slug)}`);
  };

  const handleSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!showSuggestions || suggestions.length === 0) return;

    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => {
          const next = prev < suggestions.length - 1 ? prev + 1 : 0;
          scrollSuggestionIntoView(next);
          return next;
        });
        break;
      case "ArrowUp":
        e.preventDefault();
        setSelectedSuggestionIdx((prev) => {
          const next = prev > 0 ? prev - 1 : suggestions.length - 1;
          scrollSuggestionIntoView(next);
          return next;
        });
        break;
      case "Enter":
        if (selectedSuggestionIdx >= 0 && selectedSuggestionIdx < suggestions.length) {
          e.preventDefault();
          handleSuggestionClick(suggestions[selectedSuggestionIdx]);
        }
        // Otherwise let the form submit normally
        break;
      case "Escape":
        setShowSuggestions(false);
        setSelectedSuggestionIdx(-1);
        break;
    }
  };

  const scrollSuggestionIntoView = (idx: number) => {
    const container = suggestionsRef.current;
    if (!container) return;
    const items = container.querySelectorAll("[data-suggestion]");
    items[idx]?.scrollIntoView({ block: "nearest" });
  };

  const handleTagClick = (tag: string) => {
    if (urlTags.includes(tag)) {
      const newTags = urlTags.filter((t) => t !== tag);
      if (newTags.length === 0) {
        navigate("/learn");
      } else {
        navigate(`/learn/t/${newTags.map(encodeURIComponent).join("/")}`);
      }
    } else {
      const newTags = [...urlTags, tag];
      navigate(`/learn/t/${newTags.map(encodeURIComponent).join("/")}`);
    }
  };

  // E1: Dedup items by localization_group - show one card per group,
  // prefer the card matching the app's UI locale.
  // Cards not in a group are shown as-is with only their own locale badge.
  const dedupedItems = useMemo(() => {
    const preferredLocale = uiLocale;
    const groups = new Map<string, ContentItemDTO[]>();
    const standalone: ContentItemDTO[] = [];

    for (const item of items) {
      if (item.localization_group) {
        const group = groups.get(item.localization_group) || [];
        group.push(item);
        groups.set(item.localization_group, group);
      } else {
        standalone.push(item);
      }
    }

    const result: { item: ContentItemDTO; availableLocales: string[] }[] = [];

    for (const [, groupItems] of groups) {
      const locales = groupItems.map((i) => i.locale).sort();
      // Pick the item matching the preferred locale, or the first one
      const preferred = groupItems.find((i) => i.locale === preferredLocale) ?? groupItems[0];
      result.push({ item: preferred, availableLocales: locales });
    }

    for (const item of standalone) {
      result.push({ item, availableLocales: [item.locale] });
    }

    return result;
  }, [items, uiLocale]);

  return (
    <div className="min-h-[calc(100vh-3.5rem)] bg-background">
      {/* Header */}
      <header className="border-b border-border bg-card">
        <div className="mx-auto max-w-6xl px-4 py-6">
          <h1 className="text-2xl font-bold text-foreground">{t("content.browseTitle")}</h1>

          {/* Search bar with suggestions */}
          <div className="relative mt-4">
            <form onSubmit={handleSearchSubmit} className="flex gap-2">
              <div className="relative flex-1">
                <input
                  ref={searchInputRef}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearchInputChange(e.target.value)}
                  onFocus={() => {
                    if (suggestions.length > 0) setShowSuggestions(true);
                    setShowSyntaxHint(true);
                  }}
                  onBlur={() => {
                    // Delay hiding so click on suggestion registers
                    setTimeout(() => setShowSyntaxHint(false), 200);
                  }}
                  onKeyDown={handleSearchKeyDown}
                  placeholder={t("content.searchPlaceholder")}
                  className="w-full rounded-lg border border-input bg-background px-4 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
                  role="combobox"
                  aria-expanded={showSuggestions && suggestions.length > 0}
                  aria-controls="search-suggestions-listbox"
                  aria-activedescendant={
                    selectedSuggestionIdx >= 0
                      ? `suggestion-${suggestions[selectedSuggestionIdx]?.id}`
                      : undefined
                  }
                  aria-autocomplete="list"
                />
                {/* C4: Syntax hint tooltip */}
                {showSyntaxHint && !searchQuery && (
                  <div className="absolute left-0 top-full z-40 mt-1 w-full rounded-lg border border-border bg-card p-3 text-xs text-muted-foreground shadow-lg">
                    {t("content.searchSyntaxHint")}
                  </div>
                )}
                {/* C4: Suggestions dropdown */}
                {showSuggestions && suggestions.length > 0 && (
                  <div
                    ref={suggestionsRef}
                    id="search-suggestions-listbox"
                    role="listbox"
                    className="absolute left-0 top-full z-50 mt-1 w-full rounded-lg border border-border bg-card shadow-lg py-1"
                  >
                    {suggestions.map((s, index) => (
                      <button
                        key={s.id}
                        id={`suggestion-${s.id}`}
                        type="button"
                        role="option"
                        aria-selected={selectedSuggestionIdx === index}
                        data-suggestion
                        onMouseDown={() => handleSuggestionClick(s)}
                        onMouseEnter={() => setSelectedSuggestionIdx(index)}
                        className={`w-full flex items-center gap-2 px-4 py-2 text-sm text-left transition-colors ${
                          selectedSuggestionIdx === index
                            ? "bg-accent text-accent-foreground"
                            : "hover:bg-accent"
                        }`}
                      >
                        <span className="text-xs text-muted-foreground">
                          {TYPE_ICON[s.type] || "📄"}
                        </span>
                        <span className="truncate text-foreground">{s.title}</span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
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
          </div>

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

          {/* Controls row: type filters + sort */}
          <div className="mt-4 flex flex-wrap items-center gap-3">
            {/* Type filter tabs */}
            <div className="flex gap-1 overflow-x-auto">
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

            {/* Spacer */}
            <div className="flex-1" />

            {/* C1: Sort dropdown */}
            <select
              value={sortIdx}
              onChange={(e) => handleSortChange(Number(e.target.value))}
              className="rounded-lg border border-input bg-background px-3 py-1.5 text-sm text-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            >
              {SORT_OPTIONS.map((opt, idx) => (
                <option key={`${opt.key}-${opt.dir}`} value={idx}>
                  {t(opt.i18nKey)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </header>

      {/* Content grid */}
      <main className="mx-auto max-w-6xl px-4 py-6">
        {/* Result count */}
        {!loading && !error && items.length > 0 && (
          <p className="mb-4 text-sm text-muted-foreground">
            {t("content.resultCount", { count: totalCount })}
          </p>
        )}

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
          <p className="py-12 text-center text-muted-foreground">{t("content.noResults")}</p>
        )}

        {!loading && !error && items.length > 0 && (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {dedupedItems.map(({ item, availableLocales }) => (
              <ContentCard
                key={item.id}
                item={item}
                onTagClick={handleTagClick}
                activeTags={urlTags}
                availableLocales={availableLocales}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Content card ─────────────────────────────────────────────────────────────

function ContentCard({
  item,
  onTagClick,
  activeTags,
  availableLocales,
}: {
  item: ContentItemDTO;
  onTagClick: (tag: string) => void;
  activeTags: string[];
  availableLocales: string[];
}) {
  const { t } = useTranslation();
  const badge = TYPE_BADGE[item.type] || TYPE_BADGE.article;
  const icon = TYPE_ICON[item.type] || "📄";

  const ctaLabel = (() => {
    switch (item.type) {
      case "article":
        return t("content.readMore");
      case "video":
        return t("content.watchVideo");
      case "slide_deck":
        return t("content.viewSlides");
      default:
        return t("content.readMore");
    }
  })();

  const metaInfo = (() => {
    if (item.type === "article" && item.reading_time_minutes) {
      return t("content.readingMinutes", { minutes: item.reading_time_minutes });
    }
    if (item.type === "video" && item.duration_seconds) {
      return t("content.durationMinutes", { minutes: Math.ceil(item.duration_seconds / 60) });
    }
    if (item.type === "slide_deck") {
      const slideCount = item.metadata?.slide_count as number | undefined;
      if (slideCount) return t("content.slides", { count: slideCount });
    }
    if (item.type === "partner_offer") {
      const partnerName = item.metadata?.partner_name as string | undefined;
      if (partnerName) return partnerName;
    }
    return null;
  })();

  return (
    <div className="group flex flex-col card-glow p-4 hover:shadow-xl hover:shadow-primary/10">
      {/* Header: type badge + meta + locale badge */}
      <div className="mb-2 flex items-center gap-2">
        <span
          className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${badge.bg} ${badge.text}`}
        >
          <span>{icon}</span>
          {t(
            `content.filter${item.type === "article" ? "Articles" : item.type === "video" ? "Videos" : item.type === "slide_deck" ? "Slides" : "Partners"}`,
          )}
        </span>
        {metaInfo && <span className="text-xs text-muted-foreground">{metaInfo}</span>}
        {/* E1: Locale badges - show all available locales for the group */}
        <div className="ml-auto flex gap-1">
          {availableLocales.map((loc) => (
            <span
              key={loc}
              className={`rounded px-1.5 py-0.5 text-[10px] font-medium uppercase ${
                loc === item.locale
                  ? "bg-primary/10 text-primary"
                  : "bg-muted text-muted-foreground"
              }`}
            >
              {loc}
            </span>
          ))}
        </div>
      </div>

      {/* Title - links to slug-based detail page */}
      <Link to={`/learn/${encodeURIComponent(item.slug)}`} className="mb-1">
        <h3 className="text-base font-semibold text-foreground group-hover:text-primary transition-colors line-clamp-2">
          {item.title}
        </h3>
      </Link>

      {/* Summary */}
      {item.summary && (
        <p className="mb-3 text-sm text-muted-foreground line-clamp-3">{item.summary}</p>
      )}

      {/* Topics - clickable */}
      {item.topics.length > 0 && (
        <div className="mt-auto flex flex-wrap gap-1 pt-2">
          {item.topics.slice(0, 4).map((topic) => (
            <button
              key={topic}
              onClick={(e) => {
                e.preventDefault();
                onTagClick(topic);
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
  );
}

export default ContentBrowsePage;
