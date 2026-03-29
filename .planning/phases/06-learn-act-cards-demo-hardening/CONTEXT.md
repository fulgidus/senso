# Phase 6 Context: Learn+Act Cards & Demo Hardening

**Phase goal:** Users can complete the full demo journey from upload to grounded spoken
recommendation and immediate next actions.

**Requirements covered:** ACTN-01, ACTN-02, ACTN-03, DEMO-01, DEMO-02

---

## What is already built (ahead of schedule)

The following was completed during Phases 4 and 5 and does not need to be rebuilt:

### Backend
- `coaching_response.schema.json` — full schema with `action_cards[]`, `resource_cards[]`,
  `learn_cards[]`, `affordability_verdict`, `details_a2ui`, `new_insight`.
- `ContentIndex` BM25 engine (`api/app/content/search.py`) — locale-partitioned, built at
  startup, exposes `search_content(query, locale, top_k, content_types)`.
- `_SEARCH_CONTENT_TOOL` — LLM tool definition wired into `CoachingService.chat()`.
- `_tool_executor` closure — handles `search_content` tool calls during LLM inference.
- Content catalogs (all under `api/app/content/`):
  - `articles.json` — 12 articles, `it` and `en`, covering budget, loans, ETF, emergency fund.
  - `videos.json` — 8 videos with YouTube `video_id`, `it` and `en`.
  - `slides.json` — 6 MARP slide decks, `it` and `en`.
  - `partners.json` — 5 Italian partner offers (Fineco, Hype, Moneyfarm, ING, buddybank).
- `response_format.j2` — LLM is instructed to call `search_content` before populating
  `resource_cards`; never invent URLs.
- `_repair_response()` — ensures `action_cards`, `resource_cards`, `learn_cards` default to
  `[]` if missing.

### Frontend
- Full card component tree in `ChatScreen.tsx`:
  - `ActionCardRouter` → `LoanCalculatorCard` (interactive sliders) | `PartnerOfferCard` | `GenericActionCard`
  - `ResourceCardRouter` → `VideoCard` (inline YouTube iframe) | `MarpSlideViewer` (slide deck) | `ArticleCard` (external link)
  - `LearnCardStub` (microlearning card with concept + plain explanation + example)
  - `AffordabilityVerdictCard` (yes/no/conditional verdict with key figures)
- `AssistantBubble` already renders all card sections when present in the response.
- `MarpSlideViewer` component with slide parsing, navigation, and fullscreen.
- `SLIDE_INDEX` in `senso/src/content/slideIndex.ts` maps deck IDs to bundled `.md` files.
- Frontend slide content (`senso/src/content/slides/`): 6 MARP `.md` files.
- Frontend video catalog (`senso/src/content/videos.json`).
- Voice: STT (`useVoiceInput` hook), TTS (`useTTS` hook + `VoicePlayButton`), ElevenLabs
  backend with browser `speechSynthesis` fallback.

---

## What needs work in Phase 6

### 1. Card reliability (untested end-to-end)
Cards have never been observed appearing in the live app. The LLM pipeline supports them via
the `search_content` tool call, but whether the model reliably calls the tool and whether the
response is correctly parsed and rendered has not been tested. The full path —
`search_content` tool call → BM25 hit → populated `resource_cards`/`action_cards` in JSON →
frontend rendering — needs end-to-end verification and any reliability fixes.

**Risk area:** The LLM may skip the tool call for simple questions. The prompt instructs it
to call `search_content` for any question "where the user would benefit from reading material"
but this needs to be validated against real coaching sessions.

### 2. MARP slide viewer (untested)
`MarpSlideViewer` has never rendered in the browser. Needs visual QA: slide parsing,
navigation arrows, fullscreen toggle, theme (light/dark), and that the `slide_id` returned
by the LLM actually matches an entry in `SLIDE_INDEX`.

**Risk area:** `ResourceCardRouter` routes to `MarpSlideViewer` only when
`card.resource_type === "slide_deck" && card.slide_id` is truthy. If the LLM returns a
slide deck item with `slide_id: null` it falls through to `ArticleCard`. The LLM prompt
needs to be verified to set `slide_id` from the catalog result.

### 3. Speech-to-speech loop (untested end-to-end)
The full STT → coaching API → TTS path has never been tested as a single continuous flow.
Individual pieces (STT hook, TTS hook, coaching API) were each built and unit-tested in
isolation. The integrated loop — user speaks → transcript sent → coaching response plays
back — needs an end-to-end test and fixes for any timing or state issues.

### 4. Demo seed data (no seed script exists)
Real sample files exist at `api/app/ingestion/samples/` but there is no script to create a
demo account and upload them. A seed script is required so the demo can be reset and
re-run in one command.

**Available sample files:**
| File | Type | Institution |
|------|------|-------------|
| `revolut_it/RevolutIT_account-statement_2026-02-01_2026-03-24_en-us_4700b8.csv` | CSV bank statement | Revolut IT |
| `revolut_it/RevolutIT_account-statement_2026-02-01_2026-03-24_en-us_d8fee2.pdf` | PDF bank statement | Revolut IT |
| `fineco_it/FinecoIT_movements_20260324.xlsx` | XLSX movements | Fineco IT |
| `satispay_it/SatispayIT_Export_Report.xlsx` | XLSX transactions | Satispay IT |
| `satispay_it/SatispayIT_Export_Report.pdf` | PDF report | Satispay IT |
| `paypal_it/PaypalIT_XLKMUX84JSM7Y-CSR-...` | CSV + PDF | PayPal IT |
| `edison_energia_it/610*.pdf` | PDF utility bills (6 files) | Edison Energia IT |
| `generic_invoice_it/ricevuta*.pdf` | PDF receipts (4 files) | Generic invoice IT |

**Note:** These files are gitignored and never shipped in Docker — they are local development
references only.

### 5. Loading/skeleton states
No skeleton or spinner state exists for the period while the coaching API is generating a
response (LLM call + optional tool call can take 5-15 seconds). The chat should show a
visible loading indicator so the demo does not look frozen.

### 6. Error recovery
Graceful degradation for two specific failure modes that matter for demo reliability:
- **LLM slow/timeout:** show a user-friendly message rather than a blank timeout error.
- **TTS failure:** the play button should silently fall back to browser `speechSynthesis`
  (already designed this way in `useTTS`; needs verified it works under real ElevenLabs
  503/timeout conditions).

### 7. Demo reset script
A one-command script to wipe the demo user's session history and uploaded documents, so
the demo can be re-run from a clean slate without re-creating the account.

---

## Demo scenario

The demo is **not scripted to a single question**. Cards must work reliably across the
range of financial questions a 18-30 year old would ask: affordability checks ("posso
permettermi X?"), savings questions ("come risparmio di più?"), loan comparisons, budget
advice. The demo flow is:

```
1. Upload sample docs (Revolut CSV + one additional doc)
2. Confirm extraction → profile generated
3. View profile summary (income, margin, top spending category)
4. Ask a voice question (any affordability or savings question)
5. Hear spoken recommendation
6. See at least one resource card (article or video) and one action card inline in chat
```

Target wall time: under 90 seconds from step 1 to step 6 for a prepared presenter.

---

## Card display preferences

- Cards render **inline in chat**, below the spoken message text, in the `AssistantBubble`.
- Card order (already implemented): action cards → resource cards → learn cards →
  affordability verdict → A2UI detail panel.
- No modal or separate panel required — inline is sufficient and cleaner for demo.
- Cards must be **visually polished** for demo judges: clear typography, proper spacing,
  real thumbnails for videos, readable slide navigation.
- Partner offer cards must show the partner name and CTA button clearly.
- At minimum, one resource card (article, video, or slide) and one action card must appear
  on any coaching response to a financial decision question.

---

## Key design decisions already made

| Decision | Source |
|----------|--------|
| BM25 in-process (not Qdrant) for content search | CONVENTIONS.md |
| LLM calls `search_content` tool before populating `resource_cards` | `response_format.j2` |
| `resource_cards.url` must be from catalog — never LLM-invented | CONVENTIONS.md |
| `slide_id` field on ResourceCard maps to `SLIDE_INDEX` in frontend | `ResourceCardRouter` |
| `action_type: "calculator"` renders `LoanCalculatorCard` with sliders | CONVENTIONS.md |
| `action_type: "funnel"` renders `PartnerOfferCard` | CONVENTIONS.md |
| TTS falls back to browser `speechSynthesis` when ElevenLabs returns 503 | Phase 5 decision |
| Sample files are gitignored, never shipped in Docker image | `samples/.gitignore` |

---

## Open questions for planning

1. **Seed script format:** Should the seed script use the existing API endpoints
   (register → upload → confirm) or should it write directly to the database? Using the API
   is safer and more realistic for the demo; direct DB writes are faster but bypass
   ingestion logic.

2. **Card guarantee strategy:** Should the prompt be hardened to *always* emit at least one
   `resource_card` and one `action_card` for decision questions (via stronger schema
   `minItems` enforcement), or should we rely on the LLM following the existing instruction?
   Schema enforcement is more reliable for demo; prompt-only is more flexible.

3. **Loading state placement:** Should the loading skeleton appear as a placeholder
   `AssistantBubble` (realistic preview of layout) or as a simple spinner/pulsing dot
   (simpler, less layout shift)?

4. **Reset script scope:** Should "reset" clear only chat sessions, or also re-upload
   documents (full reset to pre-profile state)? A full reset takes longer but gives a
   cleaner demo start.
