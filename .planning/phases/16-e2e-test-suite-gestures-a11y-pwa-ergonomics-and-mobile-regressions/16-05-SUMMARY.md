---
plan: "16-05"
phase: "16"
status: complete
completed_at: "2026-04-05"
---

# Summary: 16-05 — PWA, Ergonomics & Coach Picker Regression Tests

## What was built

Three spec files:
- `pwa.spec.ts`: manifest fields (name, short_name, start_url, display:standalone, icons), HTML manifest link, theme-color meta; SW and offline as test.fail() documenting known gaps
- `ergonomics.spec.ts`: tap targets ≥44px (hamburger, send, nav links), chat input in viewport, send button in bottom 60%, horizontal overflow guards, modal close button position
- `coach-picker.spec.ts`: persona picker displays all coaches, switch creates session with correct persona_id, chat continues working post-switch

## Key files
- `senso/e2e/pwa.spec.ts`
- `senso/e2e/ergonomics.spec.ts`
- `senso/e2e/coach-picker.spec.ts`

## Self-Check: PASSED
