---
id: SEED-001
status: dormant
planted: 2026-03-27
planted_during: v1.0 / phase 03-financial-profile-clarity
trigger_when: >
  Any milestone that touches profile editing, transaction review, user corrections,
  data quality improvements, or an AI assistant/chat phase. Also triggers if a
  "community / social" milestone is scoped, or when categorization accuracy becomes
  a roadmap concern.
scope: Large
---

# SEED-001: LLM-assisted crowdsourced category assignments per transaction source/recipient

## Why This Matters

The current categorization pipeline is a one-shot process: rules fire once, LLM
fallback runs once, and the result is frozen. Users have no way to correct individual
transaction categories, and the system learns nothing from corrections.

Two compounding problems this seed addresses:

**1. Profile summary values are not editable at category or transaction granularity.**
UAT-03.12 confirmed the "Confirm/Correct" section only accepts total income/expenses
overrides. A user who sees "€340/month groceries" and knows it's wrong (because some
supermarket transactions were misclassified as shopping) has no recourse. Corrections
need to go all the way down to the transaction level, and propagate back up to the
profile summary automatically.

**2. Category knowledge is siloed per user and never improves the system.**
Every time a user correctly identifies that "ESSELUNGA 0341 TORINO" is groceries, that
knowledge dies with their session. Multiplied across thousands of users, this is
enormous wasted signal. A crowdsourced mapping table (merchant name / description
fragment → category) would make the rules engine progressively more accurate without
any human curation effort.

**Why LLM-assisted matters for UX:**
Asking users to manually assign categories per transaction is friction that kills
engagement. Instead, LLM proposes a corrected category ("We think this might be
Groceries — does that sound right?"), user confirms with one tap, and the correction
is written to both the user's profile and the shared crowd table. This keeps the
interaction lightweight while capturing high-quality signal.

## When to Surface

**Trigger:** Any of these milestone scopes:

- A "profile editing / transaction review" phase is planned
- A "data quality / categorization accuracy" milestone is scoped
- An "AI assistant / chat" milestone is scoped (corrections can happen inline in chat)
- A "social / community" milestone is scoped (shared knowledge is a natural fit)
- Categorization accuracy becomes a measurable quality metric in the roadmap

This seed should be presented during `/gsd-new-milestone` when the milestone
scope matches any of these conditions:
- Milestone goal mentions user corrections, profile editing, or transaction review
- Milestone goal mentions improving categorization accuracy or data quality
- Milestone goal mentions crowdsourcing, shared learning, or community data

## Scope Estimate

**Large** — This is a full milestone or a major phase cluster:

- Backend: new `MerchantCategory` table (description_fragment, category, tag_list,
  confidence, vote_count, source: "user"|"llm"|"rule"); API endpoints for submitting
  corrections and querying the crowd table; re-categorization pass that consults the
  crowd table before rules
- AI layer: LLM prompt that, given a transaction description + amount + existing
  category, proposes a corrected category with reasoning; batched for efficiency
- Frontend: transaction-level edit UI in ProfileScreen (inline or drawer); one-tap
  confirm/correct flow per transaction; category picker with LLM suggestion pre-filled
- Profile propagation: when a transaction category changes, recompute the affected
  monthly totals and margin without re-running the full categorization job
- Privacy: crowd table stores only normalized description fragments, never raw amounts
  or user IDs; contributions are anonymous

## Breadcrumbs

Related code found in the codebase at time of planting:

**Category taxonomy (hardcoded, not user-editable):**
- `api/app/services/categorization_service.py:37` — `VALID_CATEGORIES` set
- `api/app/services/categorization_service.py:65` — `CATEGORY_RULES` regex list

**Tag vocabulary (DB table exists but only seeded, never updated from user input):**
- `api/app/db/models.py:198` — `TagVocabulary` model
- `api/app/db/repository.py:139` — `seed_default_tags` (one-way seed, no user writes)

**Profile confirm/correct (total-level only, not category/transaction level):**
- `api/app/services/profile_service.py:55` — `confirm_profile` accepts only
  `income_override` and `expenses_override` (totals, not per-category)
- `api/app/schemas/profile.py:82` — `ProfileConfirmRequest` schema
- `senso/src/lib/profile-api.ts:80` — `confirmProfile` frontend call

**Category totals (computed, stored as JSON, not editable):**
- `api/app/db/models.py:158` — `category_totals: JSON` column on `UserProfile`
- `api/app/schemas/profile.py:30` — `categoryTotals` in DTO
- `senso/src/lib/profile-api.ts:38` — `categoryTotals: Record<string, number>` in TS type

**Transaction model (has category field, but no user-correction audit trail):**
- `api/app/db/models.py:119` — `category: str | None` on `Transaction`
- `api/app/db/models.py:120` — `tags: JSON` on `Transaction`

## Notes

The crowd table design should be privacy-first from day one: store only normalized
merchant name fragments (lowercased, stripped of branch numbers/dates), never raw
transaction text, never amounts, never user identifiers. Contributions are aggregated
by vote count so no single user's data is identifiable.

The LLM-assist flow should be zero-friction: show the suggestion inline, let the user
tap Accept / Change / Skip. Don't force a category picker unless they tap Change.
Accepted corrections write to both `transactions.category` and the crowd table in a
single DB transaction.

The profile recompute on single-transaction correction should be incremental: don't
re-run the full categorization job. Instead, update `category_totals[old_cat]` and
`category_totals[new_cat]` in place and recompute `monthly_expenses` and
`monthly_margin` from the updated totals.
