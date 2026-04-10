# Phase 25: Mobile input UX - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

Remove Enter-to-submit keyboard behavior from single-line inputs on mobile so the virtual keyboard return key cannot accidentally trigger send/submit. The send button (or equivalent action button) becomes the sole submission path on touch devices. Desktop behavior is unchanged.

</domain>

<decisions>
## Implementation Decisions

### Scope of affected inputs
- **D-01:** Full sweep — every single-line input in the app that currently has Enter-submit behavior is in scope. This includes: chat textarea, session rename input, profile name inputs (ProfileSetupScreen), and the tag chip input (SettingsScreen).
- **D-02:** Mobile-only change — detect touch/mobile device; desktop keeps existing Enter-submit behavior unchanged.

### Desktop behavior (no change)
- **D-03:** On desktop, Enter still submits/advances as before. Shift+Enter in the chat textarea continues to insert a newline (already the existing behavior — no code change needed here).

### Chat textarea
- **D-04:** Keep chat input as `<textarea>` (do NOT convert to `<input type="text">`). On mobile, Enter now inserts a newline instead of submitting. The textarea already auto-expands up to `max-h-32`. Send button is the only submit path on mobile.

### Search input (exempt)
- **D-05:** ContentBrowsePage search input is exempt — Enter-to-search stays everywhere. The search form already has a visible Search button that provides the mobile fallback; no change needed.

### Tag chip input
- **D-06:** Desktop: Enter AND comma both add a chip (new: add comma as a trigger in addition to existing Enter).
- **D-07:** Mobile: Comma auto-adds a chip + an explicit "Add" button must be added to the UI (currently Enter is the only submission path, so removing it on mobile requires a button). Enter is removed as a chip-add trigger on mobile.

### Agent's Discretion
- How to detect mobile/touch device (e.g., `window.matchMedia('(pointer: coarse)')`, `navigator.maxTouchPoints > 0`, or a React hook). Pick whatever is most consistent with existing patterns in the codebase.
- Exact placement and styling of the new "Add" button in the tag chip input.
- Whether to extract mobile-detection logic into a shared `useIsMobile()` hook or handle inline per component.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files requiring changes
- `senso/src/features/coaching/ChatScreen.tsx` — `handleKeyDown` at line 1610 (chat textarea Enter-submit); session rename `<input>` `onKeyDown` at line 846
- `senso/src/features/profile/ProfileSetupScreen.tsx` — name `<input>` `onKeyDown` at lines 74 and 90
- `senso/src/features/settings/SettingsScreen.tsx` — tag chip `<input>` `onKeyDown` at line 47 (needs comma trigger added + mobile Enter removal + Add button)
- `senso/src/features/content/ContentBrowsePage.tsx` — search input `handleSearchKeyDown` at line 335 (EXEMPT — no change)

No external specs — requirements fully captured in decisions above.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `ChatScreen.tsx` already has `handleKeyDown` isolating the Enter-submit logic — easy to gate on mobile detection
- The tag chip `<input>` in `SettingsScreen.tsx` has a self-contained `onKeyDown` handler with both the add logic and the input clear — comma trigger and mobile detection can be added there

### Established Patterns
- Enter-submit pattern is inline `onKeyDown` handlers throughout (no shared utility). Mobile detection will need to be added consistently, likely via a shared hook.
- Chat textarea uses `rows={1}` + `max-h-32 overflow-y-auto` for auto-expand — this works fine for multiline on mobile once Enter-submit is removed.
- i18n: any new button labels (e.g. "Add" for tag chips) must use `t()` with keys in `senso/src/locales/it.json` and `en.json`.

### Integration Points
- `handleKeyDown` in `ChatScreen` is the primary target; it feeds into `handleSend` which is wired to the send Button's `onClick` — the Button path is already correct and unchanged
- Tag chip add logic is in SettingsScreen's inline `onKeyDown` — new "Add" button needs to call the same chip-add logic

</code_context>

<specifics>
## Specific Ideas

- "comma and Enter on desktop for tag chips, comma and button on mobile" — explicit UX parity decision by the user
- Send button is already present and functional in ChatScreen; this phase just removes the keyboard shortcut on mobile, it does not redesign the send button

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 25-mobile-input-ux-send-button-only-no-enter-submit-on-single-line-inputs*
*Context gathered: 2026-04-10*
