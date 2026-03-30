# Phase 9: LLM Financial Intelligence - Context

**Gathered:** 2026-03-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Enhance the financial intelligence layer built in Phase 3. Basic categorization and tagging already exist (rules-first + LLM-fallback). Phase 9 delivers:

1. **Multi-tier LLM classification** - progressive escalation (sm→md→lg) to dramatically reduce "uncategorized" transactions. Current Phase 3 misses too much to be useful.
2. **Crowdsourced merchant mapping** - a shared merchant→category knowledge base, accumulated implicitly from LLM classifications and explicitly from user corrections. Full audit trail for abuse prevention.
3. **Financial timeline with life events** - detect life events from spending patterns (job change, relocation, major purchase, etc.). New "Timeline" tab in ProfileScreen.
4. **User context on insights** - users can annotate timeline insights with free-text. LLM distills for coaching injection and checks for TOS violations. Progressive moderation enforcement.
5. **In-app notifications** - modular notification system for moderation feedback, appeals, and admin actions. In-app only (expandable to email/push later).

This phase does NOT include changes to the ingestion pipeline (modules, OCR, adaptive pipeline) - those belong to Phase 2. Phase 9 operates entirely on already-extracted transaction data.

</domain>

<decisions>
## Implementation Decisions

### Multi-tier LLM Classification (Categorization Improvement)

- **D-01:** Classification escalation order: first try the existing rule engine (zero LLM cost, no data leaves backend). If no rule match → `text:classification:sm`. If sm returns low confidence or fails → `text:classification:md`. If md fails → `text:classification:lg`. If all tiers fail → mark `uncategorized`, surface to user in a dedicated "Review uncategorized" screen.
- **D-02:** NO fallback to a general-purpose LLM with external data. If all 3 classification tiers fail, the transaction stays uncategorized and the user is asked to identify it manually (shown full context: amount, date, filename, description to help them remember).
- **D-03:** The "Review uncategorized" screen surfaces transactions ordered by frequency and monthly impact. Each row shows: description, amount, date, source filename. User can pick a category from a picker (same taxonomy as Phase 3). User corrections feed the merchant map (see merchant mapping decisions).
- **D-04:** A CTA near uncategorized mentions in ProfileScreen and in the main menu/voice nav routes users to the review screen when uncategorized transactions exist.
- **D-05:** The 3-tier escalation is per-transaction, not per-batch. Each unknown transaction independently tries sm→md→lg until a confident result is returned. Batch grouping is allowed for sm/md tiers if the provider supports it (implementation agent's discretion).

### Crowdsourced Merchant Mapping

- **D-06:** New DB table `merchant_map` stores the shared merchant knowledge base. Schema:
  - `id` (PK)
  - `description_raw` (TEXT, full original transaction description - stored as-is)
  - `canonical_merchant` (VARCHAR, normalized name e.g. "Amazon")
  - `category` (VARCHAR, from VALID_CATEGORIES)
  - `confidence` (FLOAT)
  - `learned_method` (VARCHAR: `"manual"` | `"text:classification:sm"` | `"text:classification:md"` | `"text:classification:lg"`)
  - `learned_provider_model` (VARCHAR e.g. `"openrouter:minimax/minimax-m2.7"`)
  - `learned_at` (TIMESTAMP WITH TIMEZONE)
  - `contributing_user_id` (FK → users.id, nullable for system-learned entries; stored for audit/ban)
  - `contributing_job_id` (FK → categorization_jobs.id, nullable)
  - `contributing_upload_id` (FK → uploads.id, nullable)
  - `is_blacklisted` (BOOLEAN DEFAULT false - for adversarial entries)
  - `blacklisted_at`, `blacklisted_reason` (nullable)
- **D-07:** Lookup uses the full `description_raw` as the key (exact match first, then prefix/fuzzy fallback - implementation agent's discretion on fuzzy strategy). Blacklisted entries are never used for classification.
- **D-08:** When an LLM tier returns a classification for a previously unknown description → automatically write to `merchant_map` (implicit accumulation). This happens silently, no user action required.
- **D-09:** When a user manually corrects a transaction category in the review screen → write to `merchant_map` with `learned_method = "manual"`. The correction is also applied immediately to that transaction row.
- **D-10:** Admin page `/admin/learned-merchants` shows the full merchant map with: description, canonical name, category, confidence, learned method, provider:model, learned_at, contributing user (obfuscated email - show `u****@domain.com`). Admin can blacklist individual entries with a reason. Blacklisting removes the entry from active use but preserves it for audit.
- **D-11:** When categorizing, check `merchant_map` BEFORE calling any LLM tier. If a confident non-blacklisted entry exists → use it directly (rule-tier equivalent, zero LLM cost). This is the core compounding accuracy benefit.

### Financial Timeline with Life Events

- **D-12:** Timeline lives as a dedicated "Timeline" tab in ProfileScreen, alongside the existing charts and insight cards tabs.
- **D-13:** Life events detected (all 6 types):
  - **Income shift**: recurring income sender disappears AND a new one appears → "Job change detected". Large income spike (>20% sustained over 2+ months) → "Income increase". Income gap (regular income absent ≥1 month) → "Career break / gap period".
  - **Relocation**: new location-specific utility providers appear, or primary spending geography shifts (if merchantable from descriptions).
  - **Subscription accumulation**: net new subscriptions added in a calendar month exceed a threshold → "Subscription creep: N new services added".
  - **Major one-off purchase**: single transaction >2x average monthly category spend → "Large purchase: [category]".
  - **Debt payoff / loan start**: recurring payment to a known loan/credit description starts or stops.
  - **Extraordinary income**: already tagged in Phase 3 as `extraordinary_income` → automatically becomes a timeline event.
- **D-14:** Timeline entries are stored in a new `financial_timeline` table:
  - `id` (PK), `user_id` (FK), `event_type` (VARCHAR), `event_date` (DATE), `title` (VARCHAR), `description` (TEXT), `evidence_json` (JSON - supporting transaction IDs/amounts), `user_context_raw` (TEXT nullable - what user typed), `user_context_distilled` (TEXT nullable - LLM-distilled version for coaching injection), `context_tos_status` (VARCHAR: `"pending"` | `"clean"` | `"flagged"` | `"removed"`), `is_user_dismissed` (BOOLEAN), `dismissed_reason` (VARCHAR nullable: `"false_assumption"` | `"clerical_error"` | `"outdated"` | `"duplicate"` | `"other"`), `dismissed_detail` (TEXT nullable - for "other"), `created_at`, `updated_at`.
- **D-15:** The coaching LLM receives timeline events (non-dismissed, non-removed) injected into its context. It receives only `event_type`, `event_date`, `title`, and `user_context_distilled` (not raw user input, not evidence_json).
- **D-16:** Users can:
  - **Dismiss** any timeline insight with a required reason from the predefined list (plus "other" with free text).
  - **Add context** (free-text, no character limit shown - backend enforces a reasonable max).
  - **View** the full event details including supporting evidence.
- **D-17:** Timeline inference runs as part of the categorization background job pipeline (triggered by `confirm-all`), after category assignment is complete. It is a new step added to `CategorizationService.run_categorization()`.

### User Context + TOS Moderation

- **D-18:** When a user saves context on a timeline insight, two LLM passes run asynchronously:
  1. **Distillation pass**: extracts core semantic facts from the free text (e.g. "bought used Citroën C3 Picasso with alloy rims" → "Purchased a used car (Citroën C3 Picasso)"). Result stored in `user_context_distilled`. Only the distilled version is used by the coaching LLM.
  2. **TOS check pass**: evaluates for violations: prompt injection, foul language, blasphemy, aggressive/threatening text, Unicode attacks (incompatible characters for user locale), context pollution/spamming, LLM-oriented attacks. Returns `{ "clean": bool, "violations": [type], "severity": "warn"|"remove"|"ban" }`.
- **D-19:** TOS violations are logged to a `moderation_log` table with: `id`, `user_id`, `content_type` (e.g. `"timeline_context"`), `content_ref_id` (FK to the timeline entry), `raw_input` (stored for audit), `detected_violations` (JSON array), `severity`, `action_taken`, `created_at`.
- **D-20:** Auto-enforcement progressive penalty (configurable thresholds in admin panel):
  - 1st violation: warning notification to user, content removed.
  - 2nd violation: 24h timeout (all write actions blocked).
  - 3rd violation: 7-day timeout.
  - 4th violation: permanent ban.
  - Each step is logged. Admin can override at any level (reduce or escalate).
- **D-21:** User can submit an appeal via in-app notification. Admin reviews in the moderation queue and can `confirm` (action stands) or `revert` (undo penalty, restore content). Appeal outcome triggers a notification back to the user.
- **D-22:** Merchant map entries are also subject to TOS checking if they contain free text (canonical_merchant name validation).

### In-App Notifications

- **D-23:** New `notifications` table: `id`, `user_id` (FK), `type` (VARCHAR: `"moderation_warning"` | `"moderation_timeout"` | `"moderation_ban"` | `"appeal_confirmed"` | `"appeal_reverted"` | `"system"`), `title`, `body`, `is_read` (BOOLEAN DEFAULT false), `action_url` (nullable - deep link to relevant screen), `created_at`.
- **D-24:** Frontend: notification bell icon in the app header. Badge shows unread count. Clicking opens a notification panel (drawer or dropdown). Each notification is marked read on view.
- **D-25:** API: `GET /notifications` (paginated, newest first), `POST /notifications/{id}/read`, `POST /notifications/read-all`. Auth-gated.
- **D-26:** Notification system is intentionally modular: the `notifications` table and API are the only integration point. Email/push can be added later by adding senders on top of the same table without changing consumer logic.

### Agent's Discretion

- Exact fuzzy matching strategy for merchant map lookup (prefix matching, Levenshtein, or normalized token comparison).
- Exact confidence thresholds for each classification tier (sm/md/lg) to trigger escalation.
- Whether to run timeline inference in-process or as a separate background step.
- Exact LLM prompts for distillation and TOS checking passes.
- The configurable thresholds UI in the admin panel (exact fields and default values).
- How to handle partial LLM classification failures (batch vs. per-transaction error handling).
- Timeline chart rendering details (which chart library, color coding per event type).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Prior Foundation
- `.planning/ROADMAP.md` - Phase 9 goal and boundary.
- `.planning/phases/03-financial-profile-clarity/03-CONTEXT.md` - Full categorization service design (D-05 through D-10), taxonomy, tag vocabulary, background job pattern. Phase 9 EXTENDS this, does not replace it.
- `.planning/phases/02-financial-input-ingestion/02-CONTEXT.md` - DB schema decisions (D-28, D-29), transaction model, confirmed upload query pattern.

### Existing Code to Extend
- `api/app/services/categorization_service.py` - Full rules + LLM-fallback pipeline. Phase 9 inserts the merchant map lookup BEFORE LLM calls, and adds the 3-tier escalation for unmatched transactions. Timeline inference is added as a new step in `run_categorization()`.
- `api/app/db/models.py` - All existing models. Phase 9 adds: `MerchantMap`, `FinancialTimeline`, `ModerationLog`, `Notification` (and adds columns to existing tables per `_add_missing_columns()` pattern in `session.py`).
- `api/app/db/session.py` - `_add_missing_columns()` idempotent migration pattern. Phase 9 adds new tables and columns here.
- `api/app/ingestion/llm.py` - LLM provider wrapper. Phase 9 adds support for `text:classification:sm/md/lg` model route parameters to this wrapper.
- `senso/src/features/profile/ProfileScreen.tsx` - Phase 9 adds a "Timeline" tab alongside existing charts. Reads from new `GET /profile/timeline` endpoint.
- `senso/src/components/a2ui-element.ts` - Already has a `timeline` component type (lines 37-38). Phase 9 uses it for rendering timeline events in coaching responses.
- `api/app/api/profile.py` - Phase 9 adds: `GET /profile/timeline`, `POST /profile/timeline/{id}/dismiss`, `POST /profile/timeline/{id}/context`.
- `api/app/api/admin.py` - Phase 9 adds: `GET /admin/learned-merchants`, `POST /admin/learned-merchants/{id}/blacklist`, moderation queue endpoints.

### Safety and Moderation Patterns
- `personas/boundaries.md` - Safety boundary reference. Moderation TOS check must align with existing persona safety contracts.
- `personas/hard-boundaries.yml` - Injection pattern corpus. TOS checker extends this pattern set.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/app/services/categorization_service.py` - Full categorization pipeline with `VALID_CATEGORIES`, `CATEGORY_RULES`, rules engine, LLM fallback, and `_finalize_profile()`. Phase 9 modifies `run_categorization()` to add: (1) merchant map pre-check before LLM, (2) 3-tier escalation for unmatched, (3) timeline inference step after categorization.
- `api/app/ingestion/llm.py` - `LLMClient.complete()` and `LLMClient.vision()`. Phase 9 needs a `classify(description, tier)` method added to this client that routes to `text:classification:sm/md/lg` endpoints.
- `senso/src/components/a2ui-element.ts` - Already implements `timeline` component type at line 37. Timeline events in ProfileScreen and in coaching bubbles reuse this.
- `api/app/api/admin.py` - Existing admin router pattern. Phase 9 adds merchant map management and moderation queue here.
- `api/app/db/repository.py` - Functional repository pattern. Phase 9 adds repository functions for `merchant_map`, `financial_timeline`, `moderation_log`, `notifications`.

### Established Patterns
- **Background job + polling**: `CategorizationJob` model, `upsert_categorization_job()`, `GET /profile/status` polling loop. Timeline inference runs as an additional step in this same job - no new job infrastructure needed.
- **`_add_missing_columns()`**: All new DB columns/tables added via idempotent SQL in `session.py`. No Alembic.
- **LLM provider fallback**: All LLM calls use `llm.py` wrapper. The 3-tier classification adds new routes to this wrapper but keeps the same provider fallback chain (Gemini Flash → OpenAI).
- **Admin panel**: Existing `/admin` frontend route + FastAPI `/admin/*` router with `require_admin` dependency. Phase 9 adds new admin pages/endpoints to this existing structure.
- **Guardrail preflight pattern** (`api/app/ingestion/guardrail.py`): TOS checking for user context follows the same pattern as the existing guardrail call - strict JSON-mode LLM call with a structured `{ clean, violations, severity }` output.

### Integration Points
- `CategorizationService.run_categorization()` is the insertion point for: (1) merchant map pre-check step, (2) 3-tier LLM escalation for unmatched transactions, (3) timeline inference step.
- `ProfileScreen` in the frontend gets a new "Timeline" tab. The existing profile data fetch stays unchanged; a new `GET /profile/timeline` endpoint is added.
- The coaching prompt injection (Phase 4) gets a new context block for timeline events. The coaching service reads from `GET /profile/timeline` (or a service-layer equivalent) and injects non-dismissed events.
- The `notification` bell integrates into the existing app header (`AppHeader` or equivalent component). The unread count is fetched on mount and after any write action.

</code_context>

<specifics>
## Specific Ideas

- **Merchant map pre-check compounding benefit**: Over time, as the shared merchant map grows, the "uncategorized" rate should drop dramatically. The Phase 3 rules engine is a fixed list; the merchant map is a growing learned index. This is the core compounding value of Phase 9.
- **Review uncategorized screen ordering**: Transactions ordered by frequency first (same merchant appearing many times = most impactful to classify once), then by absolute monthly impact (largest total spending going uncategorized first). Full context shown (amount, date, filename) to help users identify unknown merchants.
- **Income-sender tracking for job change detection**: Track `(description_prefix, upload_id)` pairs for recurring income transactions. When a previously regular income sender stops appearing AND a new regular income sender starts → flag as "Job change detected". This requires remembering which income sender was active in prior periods - may need a lightweight `income_sender_history` derived at timeline inference time from the transactions themselves.
- **Timeline distillation for coaching**: The coaching LLM should receive a compact fact (e.g. "User bought a used car (Citroën C3 Picasso) 3 months ago") not the raw "bought used Citröen C3 Picasso with alloy rims". The distillation pass is what makes user-provided context useful for grounded advice.
- **Moderation logging granularity**: Every TOS check result (clean or not) should be logged with the raw input. This provides the audit trail needed to review appeals and identify patterns of adversarial behavior. "Clean" results are logged but don't trigger enforcement.
- **Admin merchant map obfuscation**: `contributing_user_id` is shown as obfuscated email in the admin UI (`u****@domain.com` pattern) to protect user privacy while still enabling admin to identify and ban repeat offenders.

</specifics>

<deferred>
## Deferred Ideas

- **Email notifications** - architectural hooks exist (modular notification table), but actual email sending (SMTP, Mailgun, etc.) is post-hackathon. Registration confirmation email was mentioned but is out of Phase 9 scope.
- **PWA push notifications with web workers** - noted for future PWA evolution. In-app only for now.
- **Open-banking direct merchant enrichment APIs** (e.g. Open Banking merchant data) - would supplement LLM classification but adds external API dependency. Post-MVP.
- **Community merchant map browsing** - users seeing the shared merchant map is a transparency feature for a later phase.
- **Merchant map versioning and rollback** - admin can blacklist entries but full version history with rollback is beyond MVP.
- **Notification preferences / granular opt-outs** - user control over which notification types they receive. Future enhancement.

</deferred>

---

*Phase: 09-llm-financial-intelligence-with-categorization-tagging-timeline-inference-and-crowdsourced-merchant-mapping*
*Context gathered: 2026-03-30*
