# Phase 29: Profile sealed and unsealed data sections - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 29-profile-sealed-and-unsealed-data-sections-with-goals-habits-migration
**Areas discussed:** Tab bar layout (6th tab overflow), Sealed notes save behavior

---

## Tab bar layout

| Option | Description | Selected |
|--------|-------------|---------|
| 6-tab scrollable bar | Keep all tabs, allow horizontal scroll | partial |
| Replace or merge | Preferenze absorbs Connectors (both settings-like) | |
| Separate entry point | Preferenze as section in summary tab, not a new tab | |
| Just add it | Trust existing layout to handle 6 tabs (agent decides) | |

**User's choice:** Hybrid — desktop: horizontally scrollable tab strip; mobile: carousel with `[<][...prev][CURRENT][next...][>]` pattern, arrow buttons + swipe both work.

**Notes:** User described the mobile pattern as `[<][...end-of-prev-tab-name][current-tab-name][start-on-next-tab-name...][>]` — partial adjacent tab names visible as affordance. Both `[<]`/`[>]` arrow buttons and swipe gesture should navigate.

---

## Sealed notes save behavior

| Option | Description | Selected |
|--------|-------------|---------|
| Explicit Save button | Encrypt then save when user clicks Save | |
| Auto-save on blur | Focus leaves textarea → encrypt → PATCH immediately | ✓ |
| Agent decides | Leave to agent's discretion | |

**User's choice:** Auto-save on blur — focus leaves textarea → encrypt → PATCH immediately.

**Notes:** No explicit Save button needed. A brief "Salvato 🔒" toast after successful PATCH would be appropriate feedback.

---

## Agent's Discretion

- Exact tab name and icon for the Preferenze tab
- Error handling when libsodium is not yet initialized
- Whether SettingsScreen shows a redirect link or removes preferences section entirely

## Deferred Ideas

- Sealed notes sharing with another user (E2E DM)
- Multiple sealed note categories
- Unsealed goals sync back to SettingsScreen
