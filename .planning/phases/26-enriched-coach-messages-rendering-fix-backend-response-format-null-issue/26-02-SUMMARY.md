---
plan_id: "26-02"
phase: 26
status: complete
completed_at: "2026-04-10"
commit: 9dc3b0cc
---

# Summary: Frontend defensive null guards in AssistantBubble and parseStoredMessage

## What Was Built

Added belt-and-suspenders null safety in `ChatScreen.tsx` for two crash sites:
1. **AssistantBubble render:** `resp.content_cards.length > 0` and `resp.interactive_cards.length > 0` replaced with `(resp.content_cards ?? []).length > 0` and `(resp.interactive_cards ?? []).length > 0`
2. **parseStoredMessage:** Added `parsed.content_cards ??= []` and `parsed.interactive_cards ??= []` after `JSON.parse` to normalize null values from stored history messages before replay

## Key Files

### Modified
- `senso/src/features/coaching/ChatScreen.tsx` — null guards at lines 710, 715 (render) and 922–923 (parseStoredMessage)

## Deviations

None. Changes match plan exactly.

## Verification

- `docker compose run --rm frontend pnpm build` → **✓ built in 12.19s** (0 TypeScript errors)
- Both `resp.content_cards.length` and `resp.interactive_cards.length` removed (no match)
- Both `(resp.content_cards ?? []).length` and `(resp.interactive_cards ?? []).length` present (1 match each)
- Both `??=` normalization lines present in `parseStoredMessage` (1 match each)

## Self-Check: PASSED
