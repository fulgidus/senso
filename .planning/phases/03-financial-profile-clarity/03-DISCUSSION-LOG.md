# Phase 3: Financial Profile Clarity - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-03-25
**Phase:** 03-financial-profile-clarity
**Areas discussed:** Profile screen placement, Categorization approach, Profile summary content, Spending pattern highlight

---

## Profile Screen Placement

| Option                   | Description                                                                                                                                             | Selected |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| New screen after confirm | After confirming uploads, a new ProfileScreen is navigated to. IngestionScreen stays as the upload/manage area. Cleanest separation and best demo flow. | ✓        |
| Tab/nav between screens  | Tab bar or sidebar adds both Upload and Profile sections. Profile tab becomes active once uploads are confirmed.                                        |          |
| Inline below ingestion   | Profile summary appears inline below the confirmed file list on the same IngestionScreen.                                                               |          |

**User's choice:** New screen after confirm

---

### Transition mechanism

| Option                   | Description                                                                              | Selected |
| ------------------------ | ---------------------------------------------------------------------------------------- | -------- |
| Auto-redirect on confirm | Once all uploads are confirmed, auto-redirect sends the user to the profile immediately. | ✓        |
| Button to navigate       | A prominent 'View my profile' button appears after all uploads are confirmed.            |          |

**User's choice:** Auto-redirect, but with an intermediate loading/processing screen. User should be able to come back later. PWA notification also mentioned.

---

### Intermediate loading screen scope

| Option                            | Description                                                                              | Selected          |
| --------------------------------- | ---------------------------------------------------------------------------------------- | ----------------- |
| Loading screen only               | Processing screen shows categorization progress. No notification - user waits or leaves. |                   |
| Loading screen + PWA notification | Loading screen AND PWA service worker push notification when done.                       | ✓ (then deferred) |

**User's choice:** Initially requested both, then agreed to defer PWA to Phase 6 to preserve hackathon velocity.

**Notes:** PWA requires service worker, VAPID keys, browser permission flow - noted as a deferred idea for Phase 6.

---

## Categorization Approach

| Option                     | Description                                                                            | Selected |
| -------------------------- | -------------------------------------------------------------------------------------- | -------- |
| LLM-powered classification | Gemini Flash classifies each transaction. Higher accuracy for Italian merchant names.  |          |
| Rule-based heuristics      | Keyword matching for known merchants. Fast, deterministic, less accurate for unknowns. |          |
| Rules + LLM fallback       | Rules first; LLM for unmatched transactions. Best of both.                             | ✓        |

**User's choice:** Rules + LLM fallback

---

### Category taxonomy

| Option                         | Description                                          | Selected |
| ------------------------------ | ---------------------------------------------------- | -------- |
| ~8-10 fixed Italian categories | Italian-friendly names (Alimentari, Trasporti, etc.) |          |
| ~8-10 fixed English categories | English names consistent with existing UI            |          |
| Flexible LLM-chosen labels     | LLM chooses labels from data                         |          |

**User's choice:** English keys with translatable labels. Wanted to debate fixed categories vs. tag system.

**Notes:** User pushed back on predefined categories, wanting a tag system to capture nuances.

---

### Tags vs. categories

| Option                           | Description                                                                  | Selected |
| -------------------------------- | ---------------------------------------------------------------------------- | -------- |
| Single category, 10 buckets      | One primary category per transaction. Clean for charts and Phase 4 coaching. |          |
| Primary category + optional tags | Primary category for aggregation + optional tags for nuance.                 | ✓        |

**User's choice:** Primary category + optional tags

---

### Tag vocabulary type

| Option                          | Description                                                                                 | Selected |
| ------------------------------- | ------------------------------------------------------------------------------------------- | -------- |
| Free-form LLM strings           | Tags are free-form strings assigned by the LLM.                                             |          |
| Fixed tag vocabulary            | Tags come from a fixed vocabulary. LLM picks from the list.                                 |          |
| Agent's discretion on tags      | Lock primary category schema, let implementing agent decide tags.                           |          |
| Admin-editable fixed vocabulary | Fixed vocabulary managed via admin panel. Default set provided. Auto-tag where extractable. | ✓        |

**User's choice:** Admin-editable fixed vocabulary, default set provided, auto-tag programmatically from module-converted files where applicable.

---

### Taxonomy derivation

**Notes:** User requested that both the category set AND tag vocabulary be derived from sample file analysis (real transaction descriptions), not predefined theoretical buckets. Implementing agent MUST read `api/app/ingestion/samples/` before defining any taxonomy.

---

### Categorization timing

| Option                        | Description                                                | Selected |
| ----------------------------- | ---------------------------------------------------------- | -------- |
| Background job on confirm-all | Async job triggered by confirm-all. Frontend polls status. | ✓        |
| Synchronous on confirm-all    | Inline on confirm, blocks the UI.                          |          |
| Lazy on profile request       | Runs when profile is first viewed.                         |          |

**User's choice:** Background job on confirm-all

---

## Profile Summary Content

### Income source

**User's notes:** People can have multiple or atypical income sources. Payslips define a baseline but transactions may expand it. Some users won't have files or don't trust the system yet - needs a questionnaire path for supplemental/missing data. The income/money-inlet profile should be more than just a single value.

---

### Onboarding questionnaire scope

| Option                                | Description                                                                                           | Selected |
| ------------------------------------- | ----------------------------------------------------------------------------------------------------- | -------- |
| File-based + onboarding questionnaire | Phase 3 includes both file-based ingestion path and questionnaire for users without full upload data. | ✓        |
| File-based only, defer questionnaire  | Only file-based data. Users without uploads see a prompt to upload more.                              |          |

**User's choice:** Include onboarding questionnaire in Phase 3

---

### Questionnaire length

| Option                         | Description                                                | Selected |
| ------------------------------ | ---------------------------------------------------------- | -------- |
| 3-5 minimal questions          | Employment type, monthly net income, currency.             |          |
| 8-10 thorough questions        | Adds fixed costs, household size, savings behavior, goals. |          |
| User decides quick-vs-thorough | User chooses quick or thorough at the start.               | ✓        |

**User's choice:** User-selectable: quick (3 questions) or thorough (7-10 questions)

---

### Profile flow

**User-defined flow:**
1. Ask user: start from files or answer questions first?
2. Ask: quick questionnaire or thorough?
3a. Quick questionnaire (3 questions)
3b. Thorough questionnaire (7-10 questions)
4. Final confirm/correct/fill-in summary screen (LLM synthesizes conclusions from all available data; user validates and corrects)
5. Structured profile data saved - available to LLM for coaching context

**Notes:** The profile is a structured record for the coaching LLM, not just a display component. Design schema with Phase 4 in mind.

---

## Spending Pattern Highlight

### Pattern detection approach

**User's notes:** Should combine deterministic charts (high data quality, clear stats) with one or more "gotcha" LLM-generated insights that capture trends and non-obvious patterns - not just top spending categories. Prompt engineering for these insights will be nuanced work.

---

### Profile display layers

| Option                           | Description                                              | Selected |
| -------------------------------- | -------------------------------------------------------- | -------- |
| Charts + 1-3 LLM insight cards   | Deterministic charts + separate LLM insight cards below. | ✓        |
| Charts only, insights in Phase 4 | Only charts in Phase 3, LLM insights deferred.           |          |

**User's choice:** Charts + 1-3 LLM insight cards

---

### Chart library

| Option                          | Description                                                                       | Selected |
| ------------------------------- | --------------------------------------------------------------------------------- | -------- |
| shadcn chart (add during build) | shadcn chart component (Recharts wrapper). Consistent with existing shadcn setup. | ✓        |
| Recharts directly               | Install Recharts without shadcn wrapper.                                          |          |

**User's notes:** User asked whether shadcn already has chart components. Confirmed shadcn's chart component uses Recharts but is not yet installed (only button.tsx exists currently). Agent will run `npx shadcn add chart` during implementation.

---

## Agent's Discretion

- Exact category set and tag vocabulary (must derive from sample file analysis)
- Storage shape for user_profiles (separate table vs. JSONB on users)
- Storage shape for transaction tags (column array vs. join table)
- Recharts chart types within the shadcn wrapper
- LLM prompt wording for insight card generation
- Polling interval and retry logic for ProcessingScreen
- Re-trigger mechanic for re-upload after profile generated

## Deferred Ideas

- PWA push notification for async categorization completion - Phase 6
- User tag editing per transaction in frontend UI - future phase
- Re-upload/re-profile flow details - agent's discretion or post-MVP
- Row-level transaction category editing by user - was deferred from Phase 2, may be light-touch in Phase 3
