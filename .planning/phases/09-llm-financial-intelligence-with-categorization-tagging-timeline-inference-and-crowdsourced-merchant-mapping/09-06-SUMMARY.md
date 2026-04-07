---
phase: 09-llm-financial-intelligence
plan: "06"
subsystem: frontend
tags: [timeline, uncategorized, profile, i18n, react]
dependency_graph:
  requires: ["09-04"]
  provides: ["timeline-ui", "uncategorized-review-ui", "profile-api-extensions", "i18n-phase9"]
  affects: ["senso/src/features/profile", "senso/src/lib/profile-api.ts", "senso/src/App.tsx"]
tech_stack:
  added: []
  patterns:
    - "Inline dismiss flow with reason picker (no modal)"
    - "Inline add-context textarea with distilled display after save"
    - "Optimistic category update with green CheckCircle fade"
    - "Frequency-grouped uncategorized transactions"
    - "3-tab pill navigation in ProfileScreen"
key_files:
  created:
    - senso/src/features/profile/TimelineTab.tsx
    - senso/src/features/profile/UncategorizedScreen.tsx
  modified:
    - senso/src/lib/profile-api.ts
    - senso/src/features/profile/ProfileScreen.tsx
    - senso/src/App.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
decisions:
  - "Added new API functions to lib/profile-api.ts (not a new src/api/profileApi.ts) - the existing pattern uses token-based apiRequest and there was no src/api/ directory"
  - "ProfileScreen tab bar uses three tabs: Riepilogo (summary), Grafici (charts), Timeline - clean separation without breaking existing content"
  - "handleContextSaved refreshes full timeline to get distilled context from backend (not optimistic)"
metrics:
  duration: "~7 minutes"
  completed: "2026-03-30T22:59:15Z"
  tasks: 2
  files: 7
---

# Phase 09 Plan 06: Frontend Timeline Tab and Uncategorized Review Summary

**One-liner:** ProfileScreen 3-tab pill nav with inline Timeline events (dismiss + context) and frequency-grouped UncategorizedScreen with optimistic category picker.

## What Was Built

### TimelineTab (`senso/src/features/profile/TimelineTab.tsx`)
- Renders FinancialTimeline events as `rounded-2xl border border-border bg-card p-5` cards
- Event type → lucide icon mapping: `income_shift→TrendingUp`, `major_purchase→ShoppingCart`, `subscription_accumulation→List`, `extraordinary_income→Star`, `relocation→MapPin`, `debt_change→CreditCard`, default→Clock
- Date chip: `rounded-full bg-secondary px-2 py-1 text-sm text-muted-foreground`
- **Dismiss flow:** Ghost "Nascondi evento" button → inline `<select>` reason picker (5 reasons) → "Altro" shows 200-char textarea → confirm calls `dismissTimelineEvent()` → card animates to `opacity-50`, title gets `line-through`
- **Add context flow:** Ghost button → inline `<textarea>` autofocus → "Salva contesto" calls `addTimelineContext()` → refreshes timeline to show distilled context as italic text
- Dismissed events: collapsed behind ghost "Mostra N eventi nascosti" button, expanded at `opacity-50`
- Loading: 3× `animate-pulse rounded-2xl bg-muted h-24`
- Empty state: Clock icon + `timeline.emptyHeading` + `timeline.emptyBody`
- Error state: AlertTriangle + `timeline.errorLoad` + retry

### UncategorizedScreen (`senso/src/features/profile/UncategorizedScreen.tsx`)
- Route: `/profile/uncategorized` (added to App.tsx)
- Groups transactions by description, sorted by frequency desc, then monthly amount desc
- Group header: `uncategorized.occurrenceSummary` ("N occorrenze · €X/mese")
- Per-row: native `<select>` with 22 VALID_CATEGORIES (alphabetical)
- Optimistic update: immediately shows success state on select, then removes row after 1.5s
- Success: green `CheckCircle` + category name
- Error: inline `text-destructive` per row
- Loading: 5× skeleton rows `animate-pulse rounded bg-muted h-16`
- Empty state: `CheckCircle h-10 w-10 text-primary` + `uncategorized.emptyHeading`
- Error state: `AlertTriangle` + `uncategorized.errorLoad` + reload button
- Back button: `← Profilo` Link to `/profile`

### ProfileScreen Changes
- Imported `TimelineTab`, `Link` from react-router-dom, `getUncategorized`
- Added `activeTab` state (`"summary" | "charts" | "timeline"`)
- Added `uncategorizedCount` state, fetched non-blocking on mount
- Tab bar: 3 pill-style buttons, `bg-primary text-primary-foreground` for active
- Amber banner when `uncategorizedCount > 0`: yellow border + CTA Link to `/profile/uncategorized`
- Existing content reorganised under "summary" / "charts" tabs (backward-compatible)

### profile-api.ts Extensions
New types: `TimelineEventDTO`, `UncategorizedTransactionDTO`
New functions: `getTimeline`, `dismissTimelineEvent`, `addTimelineContext`, `getUncategorized`, `updateTransactionCategory`

### i18n
Added to `it.json` and `en.json`:
- `timeline.*` (14 keys)
- `uncategorized.*` (8 keys)
- `notifications.*` (9 keys - stub for Plan 09-07)
- `profile.uncategorizedBadge`
- `admin.merchantMap.*` (15 keys - stub for Plan 09-07)
- `admin.moderation.*` (15 keys - stub for Plan 09-07)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] API functions added to `lib/profile-api.ts` instead of `src/api/profileApi.ts`**
- **Found during:** Task 1
- **Issue:** Plan specified `senso/src/api/profileApi.ts` but that file and directory do not exist. The real API client is at `senso/src/lib/profile-api.ts` using `token` as a function parameter (not via context).
- **Fix:** Added all new types and functions to `senso/src/lib/profile-api.ts` following the existing `getProfile(token)` pattern.
- **Files modified:** `senso/src/lib/profile-api.ts`
- **Commit:** ce0cd8c

**2. [Rule 1 - Bug] Fixed unused `id` parameter in `handleContextSaved`**
- **Found during:** Build verification
- **Issue:** TypeScript strict mode reported `id` declared but never used in `handleContextSaved` callback.
- **Fix:** Renamed to `_id` (TypeScript convention for intentionally unused parameter).
- **Files modified:** `senso/src/features/profile/TimelineTab.tsx`
- **Commit:** ce0cd8c

## Commits

| Hash    | Description                                                                    |
| ------- | ------------------------------------------------------------------------------ |
| ce0cd8c | feat(09-06): add Timeline tab, UncategorizedScreen, and profile API extensions |

## Self-Check

Files created/modified:
- senso/src/features/profile/TimelineTab.tsx ✓
- senso/src/features/profile/UncategorizedScreen.tsx ✓
- senso/src/lib/profile-api.ts ✓
- senso/src/features/profile/ProfileScreen.tsx ✓
- senso/src/App.tsx ✓
- senso/src/i18n/locales/it.json ✓
- senso/src/i18n/locales/en.json ✓
