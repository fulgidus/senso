# Phase 9: LLM Financial Intelligence - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-03-30
**Phase:** 09-llm-financial-intelligence-with-categorization-tagging-timeline-inference-and-crowdsourced-merchant-mapping
**Mode:** discuss
**Areas discussed:** Financial timeline scope, Crowdsourced merchant mapping, LLM classification tiers, Timeline life events, User context on insights (distillation + moderation), Notifications scope

---

## Area Selection

| Option | Description | Selected |
|--------|-------------|----------|
| Financial timeline scope | What the timeline shows, how it surfaces to the user, A2UI reuse | ✓ |
| Crowdsourced merchant mapping | Implicit vs. explicit learning, privacy, merchant map table | ✓ |
| Merchant normalization approach | Raw description → canonical name field | ✓ |
| Scope reality check | Priority order between Phase 9 capabilities | ✓ |

**User's opening note:** "This hackathon is two weeks out, we have time to go to the competition with a polished prototype ready to pivot. Phase 3 categorization misses so much it's basically impossible to understand anything useful from transaction history."

---

## LLM Classification Tiers

| Option | Description | Selected |
|--------|-------------|----------|
| Rule engine first (zero cost) | No data leaves backend | ✓ |
| text:classification:sm | First LLM tier | ✓ |
| text:classification:md | Second tier on sm failure | ✓ |
| text:classification:lg | Third tier on md failure | ✓ |
| General LLM fallback with anonymized data | "slap a copy" of rounded amounts | |
| User manual review | If all tiers fail | ✓ |

**User's choice:** 3-tier escalation (sm→md→lg). If all fail → user reviews manually. NO external LLM fallback with user data.

**Notes:** User initially mentioned "slap a copy of the transaction data, amount rounded to nearest 10s" - this was clarified as NOT the intended approach. If machines fail, it's up to the user. Rule engine (programmatic module) is cheapest option first, then escalate through 3 tiers.

---

## Financial Timeline Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Life events + coaching context | Detected events injected into coaching LLM | |
| Annotated spending chart | Per-category trend lines with LLM annotations | |
| Full timeline dashboard | Both life events AND per-category trends | ✓ |

**User's choice:** Full timeline dashboard.

---

## Timeline Location in App

| Option | Description | Selected |
|--------|-------------|----------|
| New tab in ProfileScreen | Alongside existing charts and insight cards | ✓ |
| Separate /timeline page | Standalone route | |
| Inline annotations on charts | Markers on existing trend lines | |

**User's choice:** New tab in ProfileScreen.

---

## Life Events to Detect

| Event Type | Selected |
|------------|----------|
| Job change / income shift (income sender tracking) | ✓ |
| Relocation / moving | ✓ |
| Subscription accumulation | ✓ |
| Major one-off purchase | ✓ |
| Debt payoff / loan start | ✓ |
| Extraordinary income event | ✓ |

**User's choice:** All 6 types selected.

**User notes:** "Job change can be detected when a recurring income sender disappears and another one appears." User also specified: insights must be available in a dedicated section where users can remove them (with required reason: "false-assumption" | "based-on-clerical-error" | ... | "other (please tell us more)"). Insights must have a way to manually add context (e.g. "Bought new car, a nice used Citroën C3 Picasso with alloy rims").

---

## User Context on Insights

| Option | Description | Selected |
|--------|-------------|----------|
| Free-text per card with LLM distillation | LLM distills + TOS checks on save | ✓ |
| Structured fields only | Dropdown + short description | |
| Free-text, no distillation | Verbatim to coaching context | |

**User's choice:** Free-text per card with LLM distillation.

**User notes:** Required two LLM passes: (1) distill core information for coaching context injection (invisible to user), (2) TOS check for: foul language, blasphemy, aggressive text, prompt injections, unicode attacks incompatible with user locale, context pollution/spamming, LLM-oriented attacks. "Each occurrence must be logged for auditing and moderation purposes."

---

## Crowdsourced Merchant Mapping

| Option | Description | Selected |
|--------|-------------|----------|
| Passive shared learning (implicit) | LLM results auto-accumulate | ✓ |
| Explicit user corrections (active) | Users correct in UI | ✓ |
| Hybrid: implicit + explicit | Both paths | ✓ |

**User's choice:** Hybrid (implicit + explicit corrections).

---

## Merchant Correction UX

| Option | Description | Selected |
|--------|-------------|----------|
| Inline in ProfileScreen transaction list | Edit icon on each row | |
| Dedicated review screen | CTA near uncategorized mentions + menu | ✓ |
| Admin review queue only | No user-facing correction | |

**User's choice:** Dedicated "Review uncategorized" screen for users (CTA near uncategorized mentions + menu/voice navigation). Plus `/admin/learned-merchants` page for admin oversight.

**User notes on audit trail:** "Must save details on how they were learned ['manual'|'text:categorization:lg'], which specific provider:model ['openrouter:minimax/minimax-m2.7'], learned_at [datetime-with-timezone], which account contributed [User.id], on which job [CategorizationJob], which file id... we need to be able to blacklist adversarial behaviour if/when it happens (ban by user, file, upload, etc. depending on the blast zone)."

---

## Merchant Map - Description Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Normalized key + audit trail | Privacy-preserving | |
| Full description stored | Simpler, may contain PII | ✓ |
| Hashed key only | Zero PII but lookup harder | |

**User's choice:** Full description stored.

---

## Moderation Enforcement

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-enforce progressive + admin override | Warn → 24h → 7d → ban | ✓ |
| Manual admin queue only | Nothing auto-enforced | |
| Auto-remove immediately, ban on repeat | No progressive steps | |

**User's choice:** Auto-enforce progressive + admin override + user appeals (with human review where admin can confirm or revert).

**User notes:** "Warnings and appeals mean a notifications API and a messaging system."

---

## Notifications Scope

| Option | Description | Selected |
|--------|-------------|----------|
| In-app notifications only (MVP) | No push, no email. Modular. | ✓ |
| Email notifications only | Via existing backend | |
| Full notifications API | In-app + email + push hooks | |

**User's choice:** In-app only, but modular and expandable.

**User notes:** "We also need email at least for registration confirmation at some point, and eventually push notifications with web workers for PWA+web-haptics+WebAuthn evolution."

---

## Agent's Discretion

- Exact fuzzy matching strategy for merchant map lookups
- Exact confidence thresholds for escalating between sm/md/lg tiers
- Whether timeline inference runs in-process or as a separate background step
- Exact LLM prompts for distillation and TOS checking
- Configurable moderation threshold fields and default values in admin panel
- Batch vs. per-transaction error handling for LLM classification failures
- Timeline chart rendering details (chart library, color coding per event type)

## Deferred Ideas

- Email notifications (registration confirmation + future transactional email)
- PWA push notifications with web workers
- Open-banking merchant enrichment APIs
- Community merchant map browsing for transparency
- Merchant map versioning and rollback
- Notification preferences / granular opt-outs
