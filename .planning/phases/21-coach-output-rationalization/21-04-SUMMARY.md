---
plan: "21-04"
phase: "21"
status: complete
completed: "2026-04-08"
commit: bbbf238
---

# Plan 21-04 SUMMARY: Frontend Types + Rendering Hierarchy + New Components + i18n

## What Was Built

Updated TypeScript types for new schema, implemented new rendering components (ToolUsagePill, TransactionEvidenceTable, GoalProgressBar, ContentCardStrip, InteractiveCardComponent, DetailsToggle), rewrote AssistantBubble rendering hierarchy, added SSE tool-use event handling, removed dead components, added all i18n keys.

## Key Files Modified

- `senso/src/features/coaching/coachingApi.ts` — New interfaces: ContentCard, InteractiveCard, TransactionEvidence, GoalProgress, StreamToolUseEvent, StreamToolsCompleteEvent; updated CoachingResponse and StreamCallbacks; handles `tool_use` and `tools_complete` SSE events
- `senso/src/features/coaching/ChatScreen.tsx` — New components: ToolUsagePill, TransactionEvidenceTable, GoalProgressBar, ContentCardStrip, InteractiveCardComponent, DetailsToggle; removed LoanCalculatorCard, PartnerOfferCard, GenericActionCard; rewritten AssistantBubble hierarchy; DisplayMessage has "tool" role
- `senso/src/i18n/locales/it.json` — Added coaching.showDetails, toolUsage.*, evidence.*, cardType.*, reminder.*, goalProgress.*
- `senso/src/i18n/locales/en.json` — Mirror English keys

## Must-Have Verification

- ✓ TypeScript types use `content_cards`, `interactive_cards`, `transaction_evidence`, `goal_progress`
- ✓ AssistantBubble hierarchy: verdict → reasoning → evidence → goal → content → interactive → details
- ✓ Tool-usage pills render as separate messages during streaming
- ✓ `new_insight` has no visible rendering (D-05)
- ✓ `details_a2ui` collapsed by default with toggle (D-04)
- ✓ Dead card components removed (LoanCalculatorCard, PartnerOfferCard, GenericActionCard)
- ✓ All 7 tool names have i18n entries in both locale files
- ✓ `pnpm build` clean (exit 0)

## Self-Check: PASSED
