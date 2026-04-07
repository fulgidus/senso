---
plan: "19-04"
phase: "19"
status: complete
completed: "2026-04-07"
---

# Summary: 19-04 - Timeline Tab Visual Improvements

## What was built

- **Vertical connector timeline**: events rendered as `<ol>` with `border-l border-border` connector line, event icons as dots on the line, cards branching right
- **Empty state CTA**: button linking to `/upload` when no events exist
- **Notification badge**: red dot on Timeline profile tab when undismissed events exist; clears when tab is clicked
- **i18n keys added**: `timeline.emptyCta`, `timeline.basedOnTransactions`, `timeline.relocation`, `timeline.debt_change` in both `it.json` and `en.json`
- **TypeScript fix**: `_id` prefix on unused `it.each` parameter in MarpSlideViewer.test.ts

## Key files modified
- `senso/src/features/profile/TimelineTab.tsx`
- `senso/src/features/profile/ProfileScreen.tsx`
- `senso/src/i18n/locales/it.json`
- `senso/src/i18n/locales/en.json`
- `senso/src/features/coaching/MarpSlideViewer.test.ts` (TS fix)

## Self-Check: PASSED — `pnpm build` exits 0
