---
plan: "22-05"
phase: "22"
status: complete
completed: "2026-04-08"
---

# Plan 22-05 Summary - PWA Standalone + Coach Picker Dark Mode + Session Fix

## What Was Built

1. **`senso/public/manifest.webmanifest`** - Fixed PWA icon entries:
   - Removed combined `"purpose": "any maskable"` entry (Chrome rejects this)
   - Split into separate entries: one `purpose: "any"` (SVG + PNG 192 + PNG 512) and one `purpose: "maskable"` (PNG 512 with safe zone)
   - Added pwa-192x192.png, pwa-512x512.png, maskable-icon-512x512.png entries
   - `display: standalone` was already correct; retained

2. **`senso/vite.config.ts`** - Added VitePWA plugin:
   - Import `VitePWA` from `vite-plugin-pwa`
   - Strategy: `generateSW` (zero-config service worker)
   - `registerType: "autoUpdate"` 
   - Workbox: `navigateFallback: "index.html"` for SPA offline routing
   - `manifest: false` to use existing `manifest.webmanifest`
   - `.wasm` files excluded from precaching (argon2-browser compatibility)

3. **`senso/package.json`** - Added `vite-plugin-pwa@1.2.0` to devDependencies

4. **`senso/src/features/coaching/ChatScreen.tsx`** - Coach picker dark mode fix:
   - Added `bg-card` class to coach picker card buttons
   - HTML `<button>` had browser default background overriding dark theme
   - `bg-card` uses the semantic CSS variable (`--card`) which respects dark mode

## Session Persistence Analysis
The persona_id session persistence was investigated and found to be working correctly:
- `sendMessage` and `sendMessageStream` both pass `persona_id` on every request
- Backend `service.chat()` uses `persona_id=body.persona_id` on every call
- No regression or bug found in current implementation

## key-files

### modified
- senso/public/manifest.webmanifest
- senso/vite.config.ts
- senso/package.json
- senso/pnpm-lock.yaml
- senso/src/features/coaching/ChatScreen.tsx

## Self-Check: PASSED
- TypeScript compiles without errors
- manifest.webmanifest: two separate icon purpose entries (any + maskable)
- display: standalone present in manifest
- vite-plugin-pwa in devDependencies
- Coach picker buttons: bg-card class added (dark mode readable)
