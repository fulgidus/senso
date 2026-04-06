---
phase: "19"
slug: financial-timeline-real-inference-and-visibility
created: "2026-04-06"
status: ready-to-execute
---

# Phase 19 Context — Financial Timeline: Real Inference + Visibility

## Why This Phase Exists

The timeline infrastructure (backend inference, `TimelineTab`, API endpoints) was built in
Phase 9 but almost never fires in practice:

1. **4/6 event types implemented**: `relocation` and `debt_change` were deferred in Phase 9
   with a note that "insufficient transaction fields for reliable detection". Phase 18 now
   gives us utility bill data (address patterns → relocation) and invoice/payslip data
   (large fixed payments → debt signatures).

2. **Timeline never populated from non-ledger docs**: A payslip representing a salary
   increase is the clearest `income_shift` signal possible, but the timeline only looks at
   transaction aggregates. Similarly, a new recurring utility bill is a textbook
   `subscription_accumulation`.

3. **Not promoted into coach context**: The system prompt does not receive timeline events.
   The coach has no idea whether the user recently moved, got a raise, or took out a loan.

4. **Timeline tab underwhelming**: The UI shows raw event cards with dismiss controls but
   no visual timeline structure, no date axis, no connection between events and transactions.

## What This Phase Does

### 19-01: Complete 6/6 event types
- `relocation`: detected from utility bill address changes (billing address shifts between
  two consecutive utility bills from the same provider) OR from a cluster of
  removal/setup fees in transactions
- `debt_change`: detected from new large fixed recurring transactions that match loan
  payment patterns (regular, same amount, same recipient, monthly cadence)

### 19-02: Non-ledger timeline triggers
- Payslip ingestion → triggers `income_shift` event if net_salary differs >5% from
  last verified income source
- New utility bill provider → triggers `subscription_accumulation` if total fixed
  expenses increases by >10%
- `ProfileService.enrich_from_extraction()` calls `TimelineInferenceService.check_triggers()`
  after updating profile columns

### 19-03: Coach system prompt receives timeline context
- New Jinja2 template block `timeline_block.j2`: condensed 3-event summary injected when
  relevant events exist (non-dismissed, last 180 days)
- Coach prompt assembly in `CoachingService` includes timeline block after profile block
- New tool: `get_timeline_events(types: list[str])` — LLM can fetch specific event types

### 19-04: Timeline tab visual improvements
- Date axis: events sorted chronologically with relative date labels ("3 mesi fa", "ieri")
- Visual connector line between events (CSS before/after pseudo-elements)
- Event cards show related transaction count ("basato su 12 transazioni")
- Empty state: helpful message + CTA to upload a payslip or connect a bank
- Notification badge on profile tab when new (undismissed) events exist

## Scope

**In scope:**
- `api/app/ingestion/adaptive.py` — `_run_timeline_inference()` completing 6/6 types
- `api/app/services/profile_service.py` — timeline trigger calls from enrichment
- `api/app/coaching/service.py` + `prompts/` — timeline context injection + new tool
- `senso/src/features/profile/TimelineTab.tsx` — visual improvements
- `api/tests/` — timeline inference tests

**Not in scope:**
- Push notifications for timeline events (notifications exist but won't be extended)
- Interactive timeline editing (event dates, merging)
- Predictive timeline (future events)
