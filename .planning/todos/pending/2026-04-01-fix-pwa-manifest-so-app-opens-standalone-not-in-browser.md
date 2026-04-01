---
created: "2026-04-01T18:59:18.910Z"
title: Fix PWA manifest so app opens standalone not in browser
area: ui
source: .planning/notes/2026-04-01-pwa-ux-bug-dump.md
files: []
---

## Problem

PWA can be added to home screen, but still opens in a regular browser tab with the address bar visible. The `display` mode in the web manifest is likely set incorrectly (should be `standalone` or `fullscreen`), or the manifest link/meta tags are misconfigured so the OS doesn't recognize it as a standalone app.

## Solution

- Check `manifest.json` / `manifest.webmanifest` for `"display": "standalone"`.
- Verify `<link rel="manifest">` is present in the HTML head.
- Verify `<meta name="apple-mobile-web-app-capable" content="yes">` for iOS.
- Test on both Android (Chrome) and iOS (Safari) after fix.
