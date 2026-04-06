---
status: pending
phase: "17"
---

# Phase 17 Verification — MARP Real Rendering

## Must-Haves

| # | Requirement | Status | Evidence |
|---|-------------|--------|---------|
| 1 | `@marp-team/marp-core` installed in frontend | ⏳ | |
| 2 | `MarpSlideViewer` uses `Marp().render()` not `marked` | ⏳ | |
| 3 | MARP-generated CSS injected and scoped (no app bleed) | ⏳ | |
| 4 | `senso-light` + `senso-dark` MARP themes registered | ⏳ | |
| 5 | Fullscreen via React portal | ⏳ | |
| 6 | All existing slide decks render with correct slide count | ⏳ | |
| 7 | No visible `<!--` comment text in rendered slides | ⏳ | |
| 8 | `pnpm build` clean | ⏳ | |
| 9 | Unit tests pass | ⏳ | |
