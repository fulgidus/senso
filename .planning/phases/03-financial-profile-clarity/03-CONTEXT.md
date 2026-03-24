# Phase 3: Financial Profile Clarity - Context

**Gathered:** 2026-03-25
**Status:** Ready for planning

<domain>
## Phase Boundary

Users see an understandable affordability baseline derived from their confirmed uploaded data. This includes: income estimation, categorized spending breakdown, monthly margin, and 1-3 AI-generated insight cards highlighting high-impact patterns.

The path to the profile involves two entry routes: (1) file-based ingestion (transactions, payslips, etc.) followed by confirm-all, which triggers background categorization and then auto-redirects to the profile; or (2) a questionnaire onboarding flow for users who skip uploads or have incomplete data.

The profile generates a persisted structured data record consumed by Phase 4 coaching — it is not just a display screen.

This phase does NOT include text coaching interactions, voice input/output, or learn+act cards — those are Phases 4–6. Phase 3 ends when the user has a saved structured financial profile they can review and correct.

</domain>

<decisions>
## Implementation Decisions

### Profile Screen Navigation
- **D-01:** Phase 3 introduces a new `ProfileScreen` component. `AuthedHome` routes between `IngestionScreen` and `ProfileScreen` based on profile state (no tabs/sidebar — separate screens).
- **D-02:** After `confirm-all` on the ingestion screen, the app auto-redirects to a `ProcessingScreen` (intermediate loading/status screen) that polls categorization job status. When complete, it auto-advances to `ProfileScreen`.
- **D-03:** The `ProcessingScreen` shows: job status (queued → categorizing → generating insights → complete), a brief explanation of what's happening, and a "Come back later" option that returns the user to `IngestionScreen`. When the user returns, the processing status is resumed/polled from the backend.
- **D-04:** PWA service worker push notification for async completion is explicitly deferred to Phase 6.

### Categorization Pipeline
- **D-05:** Categorization uses a **rules-first, LLM-fallback** approach: a rule engine checks transaction descriptions against known keyword patterns; unmatched transactions are sent to Gemini Flash (OpenAI fallback) for classification. This follows the established dual-provider pattern from Phase 2.
- **D-06:** Each transaction gets one **primary category** (English key, e.g. `groceries`, `dining`, `transport`) plus zero or more **tags** from an admin-editable fixed vocabulary.
- **D-07:** **The implementing agent MUST read the sample files in `api/app/ingestion/samples/` and analyze actual transaction descriptions from each builtin module before defining the category set and tag vocabulary.** The taxonomy is derived from real data — not theoretical buckets. This is a mandatory pre-implementation step.
- **D-08:** The tag vocabulary is **admin-editable** (stored in the DB, exposed via the `/admin` panel). The system ships a default vocabulary. Tags should also be programmatically auto-applied where extractable from module-converted data (e.g. recurring charges detected by date pattern, subscriptions identified by merchant).
- **D-09:** Category and tag assignments are stored on the `transactions.category` column (primary category) and a new `transactions.tags` array column (or a separate `transaction_tags` join table). Implementation agent decides the storage pattern.
- **D-10:** Categorization runs as a **background job triggered by confirm-all**. The `ProcessingScreen` polls a new status endpoint for job progress. If categorization fails for a subset of transactions, those transactions are assigned `category = "uncategorized"` and the job is still considered complete.

### Onboarding Questionnaire
- **D-11:** When a user reaches the profile flow, they are first asked: **"Start from your uploaded files, or answer a few questions first?"** — both paths are supported.
- **D-12:** If the questionnaire path is chosen, the user is then asked: **"Quick (3 questions) or thorough (7-10 questions)?"**
- **D-13:** Quick questionnaire: employment type (employed / self-employed / student / other), estimated monthly net income, primary currency. Three fields only.
- **D-14:** Thorough questionnaire: adds estimated fixed monthly costs (rent, utilities, subscriptions), other income sources, household size, savings behavior (none / occasional / regular), and financial goal (save more / reduce debt / just track).
- **D-15:** After the questionnaire (or file processing), a **confirm/correct summary screen** shows the LLM-synthesized profile conclusions (income range, main expense areas, estimated margin, detected patterns). The user can correct any field before saving.
- **D-16:** The confirmed/corrected profile is saved as a structured record (`user_profiles` table or JSONB column) that the Phase 4 coaching LLM retrieves as context. This is the primary output of Phase 3.

### Profile Display (ProfileScreen)
- **D-17:** The `ProfileScreen` shows two layers:
  1. **Deterministic charts** — category spending breakdown (bar or donut), income vs. expenses (bar), monthly spending trend (line chart if multiple months of data).
  2. **LLM-generated insight cards** — 1–3 cards, each with: a provocative headline, a concrete data point (e.g. "€127/month on subscriptions"), and a short plain-language educational framing.
- **D-18:** Charts use the **shadcn chart component** (`npx shadcn add chart` during implementation), which wraps Recharts. This is consistent with the existing shadcn setup (`components.json` uses `radix-vega` style, shadcn v4 installed).
- **D-19:** The income figure in the profile uses a **priority chain**: (1) `net_income` from a confirmed payslip document, (2) questionnaire-provided income, (3) inferred from sum of positively-typed transactions (credits minus obvious transfers/refunds). The source used is labelled in the UI (e.g. "from payslip" / "from questionnaire" / "estimated from transactions").
- **D-20:** Users can navigate back from `ProfileScreen` to `IngestionScreen` to add more documents. Re-uploading and re-confirming should trigger re-categorization and profile refresh. Implementation agent decides the re-trigger mechanic.

### Profile Data Schema (new)
- **D-21:** Phase 3 adds a `user_profiles` table (or extends `users` with a `profile_json JSONB` column — agent's discretion on storage shape). The profile record includes: income summary, monthly margin, category totals, insight card payloads, questionnaire answers (if collected), data sources used, and `profile_generated_at` timestamp.
- **D-22:** A new API endpoint `GET /profile` returns the current user's profile. A `POST /profile/confirm` finalizes the confirm/correct step and persists the user-edited profile. Phase 4 coaching reads the profile via the service layer, not through the frontend.

### Agent's Discretion
- Exact category set and tag vocabulary (must be derived from sample file analysis per D-07).
- Storage shape for `user_profiles` (separate table vs. JSONB on `users`).
- Storage shape for transaction tags (column array vs. join table).
- Recharts chart types within the shadcn wrapper (bar, donut, line — as appropriate per data available).
- Exact LLM prompt wording for insight card generation (must produce `{headline, data_point, educational_framing}` JSON).
- Polling interval and retry logic for the `ProcessingScreen`.
- Re-trigger mechanic when user adds more uploads after profile is already generated.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Acceptance
- `.planning/ROADMAP.md` — Phase 3 boundary, requirements list (PROF-01, PROF-02, PROF-03), and success criteria.
- `.planning/REQUIREMENTS.md` — `PROF-01`, `PROF-02`, `PROF-03` acceptance targets.
- `.planning/PROJECT.md` — non-negotiables (one-day demo reliability, simple jargon-free language for 18-30 audience, AI-central product).

### Prior Phase Context (must carry forward)
- `.planning/phases/02-financial-input-ingestion/02-CONTEXT.md` — DB schema for `transactions` (D-28, D-29), `ExtractedDocument` structure, confirmed upload query pattern, API patterns, service layer layout. Phase 3 queries confirmed transactions from this schema.
- `.planning/phases/01-runtime-account-foundation/01-CONTEXT.md` — auth patterns (JWT in localStorage, `readAccessToken()`), service layer conventions.

### Existing Code to Extend
- `api/app/db/models.py` — `Transaction` model (`category` column currently NULL, `type`, `description`); `Upload` model (`confirmed` flag); these are the direct data sources for categorization.
- `api/app/db/repository.py` — repository function pattern to follow when adding profile/categorization queries.
- `api/app/services/ingestion_service.py` — confirmed upload query: `transactions WHERE user_id=? AND upload_id IN (SELECT id FROM uploads WHERE confirmed=true)`. Phase 3 categorization service follows the same pattern.
- `api/app/api/ingestion.py` + `api/app/main.py` — register new `/profile` router here.
- `api/app/ingestion/llm.py` — existing LLM provider wrapper (Gemini Flash primary, OpenAI fallback). Phase 3 categorization and insight generation use this same wrapper.
- `senso/src/features/auth/AuthedHome.tsx` — currently renders `IngestionScreen` directly; Phase 3 extends this to route between Ingestion, Processing, and Profile screens.
- `senso/src/features/ingestion/IngestionScreen.tsx` — existing screen pattern to mirror for `ProfileScreen` layout.
- `senso/src/lib/api-client.ts` — existing API request wrapper (`apiRequest`) for new profile API calls.
- `senso/components.json` — shadcn config; use `npx shadcn add chart` to add chart component.

### Sample Data (mandatory pre-implementation analysis)
- `api/app/ingestion/samples/` — builtin module sample files. **The implementing agent MUST read these to derive the initial category taxonomy and tag vocabulary before writing any classification logic.**

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `api/app/ingestion/llm.py` — thin LLM provider wrapper (`complete()`, `vision()`) with Gemini Flash → OpenAI fallback. Phase 3 categorization and insight generation reuse this directly.
- `senso/src/components/ui/button.tsx` — existing shadcn Button component (variants: default, outline, secondary, ghost, destructive, link). Use for all profile screen actions.
- `senso/src/lib/api-client.ts` — `apiRequest<T>()` pattern for all new profile API calls.
- `senso/src/features/auth/storage.ts` — `readAccessToken()` for auth token in API calls.
- `api/app/db/repository.py` — functional repository pattern to follow for new profile/categorization repository functions.

### Established Patterns
- **Service layer**: `api/app/services/` contains business logic; `api/app/api/` contains routers; `api/app/schemas/` contains Pydantic models. Phase 3 adds `profile_service.py`, `api/profile.py`, `schemas/profile.py`.
- **Background tasks**: Phase 2 uses `BackgroundTasks` for extraction after upload returns `202`. Phase 3 categorization should follow the same async pattern.
- **LLM fallback chain**: All LLM calls use `llm.py` wrapper with Gemini Flash primary, OpenAI fallback, and explicit error states. Phase 3 categorization and insight generation follow this pattern.
- **Polling**: Frontend polls `GET /ingestion/uploads/{id}` for extraction status. Phase 3 `ProcessingScreen` should poll a new `GET /profile/status` endpoint in the same style.
- **Pydantic schemas**: Pydantic v2 `BaseModel` with `Field(alias=...)` for camelCase JSON. Phase 3 schemas follow the same convention.
- **Test coverage**: `api/tests/` with `httpx` TestClient, pytest. Phase 3 adds profile endpoint tests.

### Integration Points
- `confirm-all` on `IngestionScreen` triggers `POST /ingestion/confirm-all` (or per-file confirms) → Phase 3 adds a background categorization job triggered by this action.
- `AuthedHome.tsx` currently routes only to `IngestionScreen`. Phase 3 extends it to check profile state: if no profile exists → `IngestionScreen`; if categorization in progress → `ProcessingScreen`; if profile ready → `ProfileScreen`.
- The `user_profiles` record becomes the primary context object that Phase 4 coaching reads. The profile schema must be designed with Phase 4's LLM grounding needs in mind (income, margin, category totals, tags patterns, insight summaries).

</code_context>

<specifics>
## Specific Ideas

- The income figure displayed must be labelled by source: "from payslip", "from questionnaire", or "estimated from transactions". Users with atypical/multiple income sources may not have a clean single figure.
- The profile is not just a display screen — it's a persisted structured record the coaching LLM retrieves. Design the data schema with Phase 4 in mind.
- The LLM insight cards should surface non-obvious patterns (not just "groceries is your top category"), e.g. subscription creep, irregular large spends, income-to-fixed-cost ratio warnings.
- The confirm/correct summary screen (step 4 of the profile flow) allows the user to edit LLM-synthesized conclusions before they're persisted. This is the trust and transparency mechanism for financial data.
- The tag vocabulary ships with a meaningful default set. The admin panel already exists from Phase 2 — Phase 3 extends it with a tag management section.

</specifics>

<deferred>
## Deferred Ideas

- **PWA push notification** for async categorization completion — deferred to Phase 6 (demo hardening). Requires service worker setup, VAPID key infrastructure, and browser permission flow. Loading screen + manual return is sufficient for demo.
- **Tag system** fully exposed in frontend UI for users to edit/add tags per transaction — Phase 3 only shows tags in the profile view; user tag editing is a future phase.
- **Re-upload flow** (adding documents after profile is generated and triggering a full re-profile) — agent's discretion on Phase 3 scope; may be light-touch or deferred to post-MVP.
- **Row-level transaction category editing** — user explicitly corrects individual transaction categories. Was deferred from Phase 2. If time allows in Phase 3 it fits, but not required for PROF-01/02/03.

</deferred>

---

*Phase: 03-financial-profile-clarity*
*Context gathered: 2026-03-25*
