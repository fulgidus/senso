---
phase: 08-content-platform-management-indexing-and-public-serving
plan: "03"
subsystem: frontend, ui
tags: [react, react-router, tailwind, i18n, marp, youtube, public-pages]

requires:
  - phase: 08-content-platform-management-indexing-and-public-serving
    provides: "Public content API at /content (Plan 02)"
provides:
  - "Public content browse page at /learn with type filtering and BM25 search"
  - "Public content detail page at /learn/:id with type-specific rendering"
  - "Content API client (fetchPublicContent, fetchContentItem, searchContent)"
  - "Public routes in App.tsx outside auth gate for shareable URLs"
affects: []

tech-stack:
  added: []
  patterns:
    - "Public routes at root BrowserRouter level, before auth check - /learn and /learn/:id bypass authentication"
    - "AppRoutes component checks location.pathname for /learn prefix before rendering auth-gated routes"
    - "Type-specific content rendering: ArticleDetail, VideoDetail, SlideDetail, PartnerDetail sub-components"

key-files:
  created:
    - senso/src/features/content/contentApi.ts
    - senso/src/features/content/ContentBrowsePage.tsx
    - senso/src/features/content/ContentDetailPage.tsx
  modified:
    - senso/src/App.tsx (BrowserRouter at root, public /learn routes)
    - senso/src/i18n/locales/it.json (content i18n keys)
    - senso/src/i18n/locales/en.json (content i18n keys)

key-decisions:
  - "BrowserRouter moved to root level; AppRoutes checks pathname for /learn to render public routes before auth gate"
  - "MarpSlideViewer reused directly from coaching feature for slide_deck detail rendering"
  - "Native fetch used in contentApi.ts (no auth headers needed for public endpoints)"

patterns-established:
  - "Public page pattern: route at BrowserRouter root, no auth dependency, standalone component with its own data fetching"
  - "Type-specific rendering pattern: parent detail page delegates to sub-components by item.type"

requirements-completed: [CONT-05, CONT-06]

duration: 5min
completed: 2026-03-30
---

# Phase 8 Plan 03: Public Content Browse + Detail Pages Summary

**Public /learn browse page with type filters, BM25 search, and responsive grid, plus /learn/:id detail page with article links, YouTube embeds, MARP slides, and partner CTAs - all shareable without auth**

## Performance

- **Duration:** 5 min
- **Started:** 2026-03-30T00:30:00Z
- **Completed:** 2026-03-30T00:35:00Z
- **Tasks:** 2
- **Files modified:** 6

## Accomplishments
- Public content browse page at /learn with locale-aware type filters (All/Articles/Videos/Slides/Partners) and BM25 search
- Public content detail page at /learn/:id with type-specific rendering: articles with external links, videos with YouTube iframe embeds, slide decks with MarpSlideViewer, partner offers with CTA buttons
- Content API client using native fetch for unauthenticated access to public content endpoints
- App.tsx restructured with BrowserRouter at root level to support public routes alongside auth-gated routes
- i18n keys added for both Italian and English locales (browseTitle, filters, labels)
- Frontend build passes with all new components

## Task Commits

1. **Task 1: Content API client + ContentBrowsePage + public routes + i18n** - `6c4742b` (feat)
2. **Task 2: ContentDetailPage with type-specific rendering** - `0ebe3ac` (feat)

## Files Created/Modified
- `senso/src/features/content/contentApi.ts` - Public content API client: fetchPublicContent, fetchContentItem, searchContent
- `senso/src/features/content/ContentBrowsePage.tsx` - Browse page with type filter tabs, search input, responsive card grid
- `senso/src/features/content/ContentDetailPage.tsx` - Detail page with ArticleDetail, VideoDetail, SlideDetail, PartnerDetail sub-components
- `senso/src/App.tsx` - Restructured with BrowserRouter at root; public /learn and /learn/:id routes before auth gate
- `senso/src/i18n/locales/it.json` - Added "content" i18n keys (browseTitle, searchPlaceholder, filters, labels)
- `senso/src/i18n/locales/en.json` - Added "content" i18n keys (English translations)

## Decisions Made
- BrowserRouter moved to root level with AppRoutes component that checks pathname for /learn prefix to render public routes before checking auth state - preserves existing auth flow while enabling unauthenticated content pages
- MarpSlideViewer reused directly from coaching feature for slide_deck items - avoids component duplication
- Native fetch used in contentApi.ts since public endpoints require no auth headers (no apiRequest wrapper needed)

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
None

## User Setup Required
None - no external service configuration required.

## Known Stubs
None - all content types render with real data from the public API.

## Next Phase Readiness
- Phase 08 content platform is fully complete: admin CRUD, DB-backed search, public API, and frontend pages
- Content is shareable via direct URLs (/learn/:id) without requiring login

---
*Phase: 08-content-platform-management-indexing-and-public-serving*
*Completed: 2026-03-30*
