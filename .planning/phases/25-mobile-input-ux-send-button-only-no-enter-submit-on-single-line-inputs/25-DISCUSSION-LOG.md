# Phase 25: Mobile input UX - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 25 - Mobile input UX - send button only, no enter submit on single-line inputs
**Areas discussed:** Input scope, Universal vs mobile-only, Chat textarea fate, Exemption candidates

---

## Input Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Chat textarea only | The primary mobile pain point; everything else unchanged | |
| All conversational/text inputs | Chat + session rename + profile name inputs (forms excluded) | |
| Every single-line input in the app | Chat, rename, profile, tags, search — full sweep | ✓ |

**User's choice:** Every single-line input — full sweep
**Notes:** User wanted comprehensive coverage across the app.

---

## Universal vs Mobile-Only

| Option | Description | Selected |
|--------|-------------|----------|
| Universal | Remove Enter-submit on all platforms | |
| Mobile-only | Detect touch/mobile device; desktop keeps Enter-submit | ✓ |

**User's choice:** Mobile-only
**Notes:** "only for mobile... in desktop using enter feels natural: allow use of Shift+Enter to return text." Shift+Enter for newlines in textarea is already the existing desktop behavior — no change needed.

---

## Chat Textarea Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Keep as `<textarea>` | Enter on mobile inserts newline; textarea auto-expands; send button submits | ✓ |
| Convert to `<input type="text">` | Truly single-line forever; simpler but no multiline messages | |

**User's choice:** Keep as `<textarea>`
**Notes:** Natural multiline behavior on mobile is desirable.

---

## Exemption Candidates

| Input | Decision | Notes |
|-------|----------|-------|
| Search (ContentBrowsePage) | Exempt — Enter stays everywhere | Has Search button already for mobile fallback |
| Tag chip (SettingsScreen) | Partially changed | Desktop: Enter + comma add chip. Mobile: comma auto-adds + new "Add" button; Enter removed |

**User's choice:** "tag can auto-add on commas AND Enter on desktop; comma and button on mobile. search is fine as-is"
**Notes:** User explicitly wanted comma as a new trigger for tag chips on desktop. Search is fully exempt.

---

## Agent's Discretion

- Mobile/touch detection implementation strategy
- Placement and styling of the new tag chip "Add" button
- Whether to extract mobile-detection into a shared hook or handle inline

## Deferred Ideas

None.
