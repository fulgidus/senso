---
phase: 09-llm-financial-intelligence
plan: "07"
subsystem: frontend
tags: [notifications, admin, merchant-map, moderation, bell, ui]
dependency_graph:
  requires: [09-04, 09-05]
  provides: [notification-bell, notification-panel, merchant-map-admin-page, moderation-queue-page]
  affects: [AppShell, App.tsx, i18n]
tech_stack:
  added: []
  patterns:
    - "NotificationPanel with outside-click-close via useRef + mousedown pattern"
    - "30s polling interval for unread count, cleared on component unmount"
    - "Inline blacklist expansion row without modal"
    - "Inline revert confirmation without modal"
key_files:
  created:
    - senso/src/api/notificationsApi.ts
    - senso/src/features/notifications/NotificationPanel.tsx
    - senso/src/features/admin/adminMerchantApi.ts
    - senso/src/features/admin/MerchantMapAdminPage.tsx
    - senso/src/features/admin/ModerationQueuePage.tsx
  modified:
    - senso/src/components/AppShell.tsx
    - senso/src/App.tsx
    - senso/src/i18n/locales/it.json
    - senso/src/i18n/locales/en.json
decisions:
  - "notificationsApi.ts placed in senso/src/api/ (new dir) not senso/src/lib/ — symmetric with plan intent, consistent with plan 09-06 profile-api.ts in lib being an extension, not a new pattern"
  - "adminMerchantApi.ts placed in senso/src/features/admin/ following adminContentApi.ts co-location pattern"
  - "Admin nav uses t('admin.merchantMap.title') and t('admin.moderation.title') — auto-updated when i18n changes"
  - "ModerationQueuePage revert uses inline two-step confirm (not modal) — same UX pattern as ContentAdminPage delete confirm"
metrics:
  duration: "15 min"
  completed_date: "2026-03-31"
  tasks: 2
  files: 9
---

# Phase 09 Plan 07: Notification Bell + Admin Pages Summary

**One-liner:** Bell icon with 30s polling + NotificationPanel dropdown, plus MerchantMapAdminPage and ModerationQueuePage completing Phase 9 UI.

## What Was Built

### Task 1: notificationsApi.ts, NotificationPanel, Bell in AppShell

- **`senso/src/api/notificationsApi.ts`** — typed API client: `getNotifications(limit)`, `markNotificationRead(id)`, `markAllNotificationsRead()`. Uses `@/lib/api-client` + `getBackendBaseUrl()` + `readAccessToken()` — same pattern as `adminContentApi.ts`.
- **`senso/src/features/notifications/NotificationPanel.tsx`** — dropdown panel. Opens when `isOpen=true`, fetches notifications. Shows type icons (AlertTriangle/Clock/ShieldOff/CheckCircle/RotateCcw/Bell per notification type), unread left-border highlight, relative time, "Segna tutto come letto" button. Closes on outside click. Loading skeleton + empty state.
- **`senso/src/components/AppShell.tsx`** — Bell icon added immediately left of LanguageSwitcher. Polls every 30s via `setInterval`. Badge shows unread count (9+ cap). Three admin nav items added (content, merchant-map, moderation) for admin users. Imports `Bell` from lucide-react.

### Task 2: Admin merchant map and moderation queue pages

- **`senso/src/features/admin/adminMerchantApi.ts`** — typed API client: `getMerchantMap(params)`, `blacklistMerchant(id, reason)`, `unblacklistMerchant(id)`, `getModerationQueue(statusFilter)`, `confirmModerationAction(id)`, `revertModerationAction(id)`.
- **`senso/src/features/admin/MerchantMapAdminPage.tsx`** — search input + method dropdown + blacklisted filter. Table with Description (mono), Canonical, Category (pill), Confidence (colour-coded %), Method (badge), Provider:model (mono), Contributing user, Date (relative), Actions. Blacklist: inline row expansion with textarea + destructive confirm. Blacklisted rows: `opacity-50 border-l-2 border-destructive`.
- **`senso/src/features/admin/ModerationQueuePage.tsx`** — status filter dropdown. Table with obfuscated user + date, content type badge, violations (red pills), severity (amber/orange/red badge), action taken, confirm + inline-confirm revert buttons.
- **`senso/src/App.tsx`** — routes `/admin/merchant-map` and `/admin/moderation` added as admin-protected routes.
- **i18n** — `admin.merchantMap.*` and `admin.moderation.*` keys added to both `it.json` and `en.json`.

## Deviations from Plan

### Import Path Corrections (Rule 3 — Auto-fix)

**1. [Rule 3 - Blocking] Used `@/lib/api-client` instead of `@/api/api-client`**
- **Found during:** Task 1 pre-read of adminContentApi.ts
- **Issue:** Plan template specified `import { apiRequest } from "@/api/api-client"` but that path does not exist. The real path is `@/lib/api-client`.
- **Fix:** Used `@/lib/api-client` in both `notificationsApi.ts` and `adminMerchantApi.ts`.
- **Files modified:** senso/src/api/notificationsApi.ts, senso/src/features/admin/adminMerchantApi.ts

**2. [Rule 3 - Blocking] adminMerchantApi.ts placed in features/admin/ not src/api/**
- **Found during:** Task 2 pre-read of adminContentApi.ts
- **Issue:** adminContentApi.ts is co-located with the admin feature in `features/admin/`. Creating adminMerchantApi.ts in `src/api/` would break the established pattern.
- **Fix:** Created adminMerchantApi.ts at `senso/src/features/admin/adminMerchantApi.ts`.
- **Files modified:** senso/src/features/admin/adminMerchantApi.ts

**3. [Rule 2 - Missing critical] Added `onUnreadCountChange` callback to NotificationPanel**
- **Found during:** Task 1 implementation
- **Issue:** When user clicks a notification to mark it read, the bell badge count in AppShell must also update, not just the panel's internal state. Without a callback, the badge count stays stale until the next 30s poll.
- **Fix:** Added `onUnreadCountChange?: (count: number) => void` prop to NotificationPanel; called whenever unread count changes (mark all read, individual mark read).
- **Files modified:** senso/src/features/notifications/NotificationPanel.tsx, senso/src/components/AppShell.tsx

## Known Stubs

None. All UI wires directly to live backend API endpoints implemented in Plans 09-03 and 09-04.

## Checkpoint Gate

Plan 09-07 ends at a `checkpoint:human-verify` blocking gate. Automated build verification passed (`pnpm build` exits 0). Human verification of end-to-end Phase 9 UI is required per plan.

## Self-Check: PASSED

- `senso/src/api/notificationsApi.ts` ✅
- `senso/src/features/notifications/NotificationPanel.tsx` ✅
- `senso/src/features/admin/adminMerchantApi.ts` ✅
- `senso/src/features/admin/MerchantMapAdminPage.tsx` ✅
- `senso/src/features/admin/ModerationQueuePage.tsx` ✅
- Commits `bcd2efe` (Task 1) and `09ac70b` (Task 2) ✅
