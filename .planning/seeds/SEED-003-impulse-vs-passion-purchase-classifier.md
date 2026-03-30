---
id: SEED-003
status: dormant
planted: 2026-03-31
planted_during: Phase 09 - LLM Financial Intelligence (v1.0 milestone, In Progress)
trigger_when: when a personalization milestone is planned OR when sufficient transaction + outcome history exists for behavioral pattern analysis
scope: large
---

# SEED-003: Impulse vs. genuine passion purchase classifier

## Why This Matters

Young adults routinely misread their own motivation when making discretionary purchases.
The instinctive dopamine hit of "I want this NOW" and the considered investment in a real,
lasting interest feel identical in the moment — but have wildly different outcomes one month
later (abandoned guitar on a shelf vs. hobby that compounds).

This is not a cosmetic feature. It sits at the core of what S.E.N.S.O. promises: helping
users make *better* financial decisions *in the moment*. Blocking an impulse buy is trivial.
Teaching someone to tell the difference themselves — and backing that with their own behavioral
data — is the educational layer that makes the app genuinely valuable and differentiated.

As the user put it: distinguishing capriccio dal reale investimento su una passione è il
fondamento del buon risparmio. And the key ingredient is not an external rule but
**self-knowledge validated against history**: how many past hobbies/purchases did the user
actually sustain after the initial dopamine surge?

The AI cannot substitute that self-knowledge, but it *can*:
1. Surface the question at the right moment ("you've bought into 3 'new hobbies' in the past
   6 months — 2 were abandoned within 4 weeks. Is this one different?").
2. Guide a short self-reflection prompt before rendering a verdict.
3. Track follow-through over time and surface patterns the user hasn't noticed.

This requires *honesty from the user about past outcomes* — which means a lightweight
self-report loop, not pure transaction inference.

## When to Surface

**Trigger:** Present this seed when either of these conditions is true at milestone-planning
time:
- The roadmap introduces a **personalization or behavioral profiling milestone** (e.g. user
  goals tracking, spending habit reflection, outcome journaling).
- **Transaction history spans ≥ 3 months** for a meaningful cohort and user-reported outcome
  data exists (even one self-report field counts as the seed of the feedback loop).

This seed should be presented during `/gsd-new-milestone` when the milestone scope matches
any of these conditions:
- Milestone title or goal mentions "behavioral patterns", "habit tracking", "user goals",
  "personalization", or "outcome tracking".
- Milestone depends on Phase 09 (LLM Financial Intelligence) which already classifies
  transactions by category and tags — the substrate for behavioral analysis exists there.
- A content or coaching milestone adds reflection prompts, journaling, or learning outcomes.

## Scope Estimate

**Large** — This is a multi-phase feature with distinct buildable layers:

1. **Data substrate** (prerequisite — partially exists post Phase 09):
   - Category + tag history per user (Phase 09 provides this).
   - Outcome self-report: a lightweight "did you use this?" prompt 4 weeks after a
     purchase in a discretionary category (new: small UI + DB column).

2. **Behavioral pattern engine** (new phase):
   - LLM prompt + structured schema to analyze: discretionary purchase frequency by
     category, follow-through rate per category type, time-to-abandonment distribution.
   - Produces a `behavioral_profile` field on `user_profiles`: e.g. 
     `{ "hobby_follow_through_rate": 0.33, "impulse_categories": ["gaming", "fitness"] }`.

3. **Coaching integration** (extends existing coaching service):
   - Before rendering an affordability verdict for a discretionary purchase, inject the
     behavioral profile into the prompt context.
   - Coach surfaces the pattern ("last 2 fitness purchases abandoned after ~3 weeks") and
     asks a guided self-reflection question before or alongside the verdict.
   - New `reflection_prompt` field in the coaching response schema (nullable, only emitted
     for discretionary categories with behavioral history).

4. **UI layer** (new components):
   - Post-purchase follow-up card: "Did you end up using [item]?" — appears 4 weeks after
     a confirmed discretionary purchase.
   - Behavioral insight card: annual or quarterly summary of follow-through rates by
     category, shown on the profile screen.

## Breadcrumbs

Related code and decisions found in the current codebase:

- **Categorization & insight generation**: `api/app/services/categorization_service.py`
  — `_generate_insights()` (line 799) already derives behavioral patterns from
  `category_totals`. The impulse classifier would extend this with temporal follow-through
  data.

- **Coaching context injection**: `api/app/coaching/service.py` line 554-573
  — `insight_cards` and `coaching_insights` are injected into the coaching prompt context
  here. The `behavioral_profile` would be a third context field injected the same way.

- **User profile DB model**: `api/app/db/models.py` line 234-236
  — `insight_cards`, `coaching_insights`, `questionnaire_answers` columns show the pattern
  for adding `behavioral_profile` as a new JSONB column via `_add_missing_columns()`.

- **Questionnaire + financial goals**: `api/app/schemas/profile.py` line 171
  — `financial_goal` field already exists. Self-report outcome data would extend the
  questionnaire schema with a `purchase_outcomes` array.

- **Affordability verdict schema**: `api/app/coaching/safety.py` line 338
  — The verdict sanitization pass is where a `reflection_prompt` field would be validated
  before reaching the client.

- **Phase 09 substrate**: `.planning/phases/09-llm-financial-intelligence-*/`
  — Crowdsourced merchant mapping and tagging logic being built in Phase 09 are the direct
  predecessor: once transactions have reliable categories + tags, behavioral frequency
  analysis over time becomes tractable.

- **Financial goal in profile schema**: `api/app/schemas/profile.py` line 159-171
  — `QuestionnaireAnswers` is the natural extension point for a `purchase_intentions`
  array: user states what the purchase is for before buying, enabling retrospective
  follow-up.

## Notes

From the ideation conversation:

> "È qualcosa che richiede conoscenza di se stessi, onestà verso se stessi e buon senso.
> Delegare ciò a una IA... richiederebbe una mole di dati cicciona su quanti dei tuoi
> hobby e passioni hai portato a sviluppo dopo la scarica di adrenalina iniziale."

Key design constraint surfaced by the user: **the AI cannot substitute self-knowledge**.
The correct framing is the AI as a *mirror* — it surfaces the user's own behavioral history
back to them at the decision moment, rather than making the judgment for them. The user
retains agency; the AI provides the inconvenient data the user would otherwise forget.

This also means the UX must be honest without being preachy: showing "you've abandoned 2/3
recent hobby purchases" must feel like a helpful nudge, not a guilt trip. Tone calibration
in the coaching prompt will be critical.

The feature is inherently post-hackathon: it requires longitudinal data that doesn't exist
on demo day. Do not force it into v1.0.
