# Pitfalls Research

**Domain:** AI voice financial education assistant (hackathon MVP)
**Researched:** 2026-03-23
**Confidence:** MEDIUM-HIGH

## Critical Pitfalls

### Pitfall 1: Demo relies on non-portable browser STT behavior

**What goes wrong:**
Voice input works on one machine/browser but fails or degrades on stage. The live demo loses the main differentiator (voice-first experience).

**Why it happens:**
Teams assume Web Speech recognition is baseline-stable. It is not broadly baseline-supported, and some implementations are server-backed and browser-dependent.

**How to avoid:**
- Define a **demo browser contract** on day start (exact browser + version + OS).
- Implement **hard fallback path**: typed input with identical downstream pipeline.
- Add pre-demo device check: mic permission, speech event loop, first transcript latency.
- Keep STT provider swappable (browser STT for speed, API STT fallback if needed).

**Warning signs:**
- `SpeechRecognition` undefined in target browser.
- Frequent `nomatch`/`error` events in local smoke tests.
- Recognition only stable on one developer machine.

**Phase to address:**
**Phase 0 – Demo Reliability Contract** (first phase, before feature expansion).

---

### Pitfall 2: Mic permission + HTTPS constraints discovered too late

**What goes wrong:**
The app cannot access microphone in staging/demo environment because permission, secure-context, iframe, or policy constraints were not handled.

**Why it happens:**
Teams test on localhost and forget production-like conditions. `getUserMedia` behavior differs when not in secure context or when permission is ignored.

**How to avoid:**
- Run from **HTTPS** deployment early (or localhost with same flow).
- Build explicit permission UX states: pending / denied / blocked / retry.
- Add recovery UX (“Enable mic” checklist + text input fallback).
- Avoid hidden iframe embedding for core voice flow unless permissions policy is configured.

**Warning signs:**
- Repeated `NotAllowedError`, `TypeError`, or unresolved permission prompts.
- Works local, fails on public demo URL.
- No telemetry on permission failure causes.

**Phase to address:**
**Phase 0 – Demo Reliability Contract**.

---

### Pitfall 3: Latency budget blow-up (STT → LLM → retrieval → TTS)

**What goes wrong:**
Response feels slow and awkward, killing perceived intelligence. The 75-second demo script overruns.

**Why it happens:**
Teams optimize one component (e.g., TTS model speed) but ignore end-to-end time-to-first-audio and chain latency.

**How to avoid:**
- Set explicit SLOs for hackathon demo:
  - STT transcript ready: <2.0s
  - LLM + retrieval decision: <3.0s
  - TTS TTFA: <1.2s
  - Total user-perceived response start: <6.0s
- Stream whenever possible (LLM tokens + TTS audio).
- Use fast default models/voices for live demo, quality voice for prerecorded backup only.
- Precompute user profile summary after upload; avoid recomputing on every turn.

**Warning signs:**
- Team quotes only model inference speed, not TTFA.
- First spoken token arrives >2s after text answer is ready.
- P95 response latency unknown.

**Phase to address:**
**Phase 1 – End-to-End Performance Budgeting**.

---

### Pitfall 4: “Personalized” advice is actually generic (weak grounding)

**What goes wrong:**
Assistant claims to use user data but outputs generic financial tips. Judges/users detect bluffing; trust collapses.

**Why it happens:**
No strict answer contract requiring cited user facts (income, recurring costs, margin). Retrieval and profile extraction are loosely connected.

**How to avoid:**
- Enforce response schema with mandatory fields:
  - `decision`
  - `reasoning_with_user_numbers`
  - `assumptions`
  - `education_link`
  - `action_card`
- Add guardrail: reject/regenerate if no numeric references from profile.
- Keep one canonical computed “financial snapshot” per session and pass it explicitly.

**Warning signs:**
- Answers contain vague phrases (“it depends”, “consider your budget”) without numbers.
- Same prompt returns near-identical response across different uploaded profiles.
- No automated test that checks numeric grounding.

**Phase to address:**
**Phase 2 – Grounding & Reasoning Integrity**.

---

### Pitfall 5: Harmful or overconfident financial advice from persona tone

**What goes wrong:**
Tone personas (sarcastic/harsh) produce shaming, coercive, or unsafe guidance (“you should definitely do X”), creating ethical and reputational risk during demo.

**Why it happens:**
Persona style is prioritized over policy hierarchy. Soft boundaries exist but are not enforced at output level.

**How to avoid:**
- Keep strict instruction hierarchy: safety policy > financial guidance policy > persona style.
- Add deterministic post-generation safety checks (regex/rules + classifier) for prohibited patterns.
- Force uncertainty language where data confidence is low.
- Ban definitive claims for regulated/high-impact decisions; route to “educational, non-advisory” framing.

**Warning signs:**
- Responses contain absolute imperatives (“always”, “must buy now”).
- Persona differences affect factual advice, not only tone.
- Prompt-injection tests can override boundaries.

**Phase to address:**
**Phase 2 – Safety & Policy Guardrails**.

---

### Pitfall 6: Prompt injection via uploaded documents or user turns

**What goes wrong:**
Malicious text in receipts/PDFs/chat alters system behavior (ignore rules, leak prompt, produce unsafe output).

**Why it happens:**
Untrusted content from documents is mixed into prompts without delimiting, trust labels, or instruction isolation.

**How to avoid:**
- Treat all user-provided text as untrusted data.
- Separate sections in prompt: system policy, trusted profile facts, untrusted excerpts.
- Use content filtering before storage/retrieval.
- Add red-team tests for common injection strings in OCR/text chunks.

**Warning signs:**
- Model repeats hidden instructions from uploaded docs.
- Sudden changes in tone/policy after ingesting a file.
- System prompt leakage attempts succeed.

**Phase to address:**
**Phase 2 – Safety & Policy Guardrails**.

---

### Pitfall 7: Sensitive data retention exceeds hackathon need

**What goes wrong:**
Bank statements, payslips, and conversation audio are retained longer than necessary; privacy risk and compliance narrative failure in judging.

**Why it happens:**
Defaults are left unchanged (e.g., long retention windows), no data minimization policy is set for MVP.

**How to avoid:**
- Define explicit retention by artifact type for MVP:
  - Raw uploads: short TTL (e.g., 24–72h)
  - Derived profile: retain only required fields
  - Voice transcripts/audio: opt-in and short TTL
- Add in-product disclosure: what is stored, for how long, and why.
- Implement one-click delete for demo account.

**Warning signs:**
- Team cannot answer “what data do you store and for how long?”
- No deletion job/logs exist.
- Raw sensitive files remain after session end.

**Phase to address:**
**Phase 3 – Privacy, Retention, and Trust Narrative**.

---

### Pitfall 8: Partner/service cards are irrelevant or manipulative

**What goes wrong:**
Action cards feel like ads, not help. Product appears to push financial products regardless of user context.

**Why it happens:**
No ranking policy balancing user benefit vs partner conversion. Educational intent is not enforced.

**How to avoid:**
- Add ranking rules: relevance to user constraint > educational value > partner priority.
- Require rationale per card (“shown because your monthly margin is X”).
- Cap number of partner cards; always pair with neutral educational alternative.

**Warning signs:**
- Same partner card shown for unrelated scenarios.
- Card rationale missing or generic.
- User trust feedback drops after seeing actions.

**Phase to address:**
**Phase 3 – Recommendation Ethics & Ranking Rules**.

---

### Pitfall 9: OCR/CSV extraction errors silently corrupt profile

**What goes wrong:**
Incorrect parsing (currency, date, category, sign) creates wrong affordability conclusions. Demo answer looks precise but is wrong.

**Why it happens:**
LLM extraction output is accepted without validation or confidence thresholds.

**How to avoid:**
- Add schema validation + sanity checks (sum consistency, negative/positive transaction logic, currency detection).
- Show “what we parsed” confirmation screen before enabling advice.
- Flag low-confidence fields and request user confirmation.

**Warning signs:**
- Impossible totals (expenses > income by large unexplained amounts).
- Frequent manual corrections after upload.
- No extraction confidence surfaced.

**Phase to address:**
**Phase 1 – Data Ingestion Reliability**.

---

### Pitfall 10: No offline/scripted backup for live demo volatility

**What goes wrong:**
Network/API outage ruins live run despite working code. Team cannot recover in front of judges.

**Why it happens:**
Hackathon teams over-index on “happy-path live” and skip fallback choreography.

**How to avoid:**
- Prepare two-tier demo plan:
  1. Live path (primary)
  2. Cached fallback (preloaded profile + canned voice turn + local recordings)
- Keep one-click “demo mode” toggle with deterministic sample data.
- Rehearse failure recovery script (“If mic fails, switch to text in 5 seconds”).

**Warning signs:**
- No demo runbook exists.
- Any single API failure blocks the entire narrative.
- Team has never timed a full dry run.

**Phase to address:**
**Phase 4 – Demo Ops & Failure Recovery**.

## Technical Debt Patterns

| Shortcut | Immediate Benefit | Long-term Cost | When Acceptable |
|----------|-------------------|----------------|-----------------|
| Hardcoding prompts in UI layer | Faster iteration in hackathon | Untraceable policy drift, unsafe edits | Acceptable only for prototype day; move to versioned prompt files in next phase |
| Storing raw financial docs indefinitely | Easier debugging | Privacy/compliance risk | Never acceptable beyond controlled local test |
| Single monolithic “do everything” prompt | Quick implementation | Unstable outputs, hard debugging | Acceptable for first spike only; split by tasks immediately |
| No typed response schema | Faster coding | Silent contract breaks in frontend | Never acceptable for demo-critical path |

## Integration Gotchas

| Integration | Common Mistake | Correct Approach |
|-------------|----------------|------------------|
| Browser STT (Web Speech) | Assuming cross-browser support and offline behavior | Lock demo browser + fallback to typed input/API STT |
| `getUserMedia` | Testing only on localhost without HTTPS/permission states | Validate secure context + explicit denied/blocked UX |
| ElevenLabs TTS | Optimizing model only, ignoring TTFA and buffering | Measure end-to-end TTFA and stream audio early |
| LLM + RAG | Injecting raw OCR chunks directly into instruction context | Separate trusted/untrusted context and sanitize outputs |

## Performance Traps

| Trap | Symptoms | Prevention | When It Breaks |
|------|----------|------------|----------------|
| Recomputing full profile every turn | Slow answers after each question | Precompute snapshot and incremental updates | Breaks demo flow immediately (>2 turns) |
| Sequential STT→LLM→retrieval→TTS without overlap | Long pauses before speech | Pipeline parallelism + streaming | Noticeable even at <100 users |
| Large unfiltered retrieval context | High token cost and drift | Retrieval top-k + strict context budget | Breaks quality/cost at moderate usage |

## Security Mistakes

| Mistake | Risk | Prevention |
|---------|------|------------|
| Trusting document text as instructions | Prompt injection, policy bypass | Treat uploaded text as untrusted; delimit and filter |
| Logging full raw financial payloads | Sensitive data exposure in logs | Structured redaction + minimal logs |
| Missing output validation before UI/action cards | Unsafe or manipulative guidance shown to user | Output schema + policy validation layer |

## UX Pitfalls

| Pitfall | User Impact | Better Approach |
|---------|-------------|-----------------|
| “Can I buy this?” answered with yes/no only | Feels judgmental and shallow | Always include reason + tradeoff + alternative action |
| No transparency on which numbers were used | Low trust (“this is generic AI”) | Show cited personal factors in every answer |
| Harsh persona without empathy guardrails | Shame response, user disengagement | Keep assertive tone but non-judgmental wording policy |

## "Looks Done But Isn't" Checklist

- [ ] **Voice input:** Works only on one machine/browser — verify on the exact demo hardware.
- [ ] **Grounded reasoning:** Mentions “your data” but cites no numbers — verify numeric citation in output.
- [ ] **Privacy:** Privacy claim exists but no retention/deletion behavior — verify TTL + delete flow.
- [ ] **Safety:** Persona boundaries written but not enforced — verify rule-based output checks.
- [ ] **Demo readiness:** Happy-path works once — verify 3 consecutive timed dry runs + fallback plan.

## Recovery Strategies

| Pitfall | Recovery Cost | Recovery Steps |
|---------|---------------|----------------|
| Voice stack failure live | MEDIUM | Switch to typed mode, keep TTS output, continue scenario |
| Ungrounded response detected | LOW | Regenerate with strict schema and required numeric fields |
| Unsafe response emitted | MEDIUM | Block render, show safe fallback message, log violation |
| Bad parsed profile | HIGH | Re-run extraction with confirmation UI; use known-good demo dataset if needed |

## Pitfall-to-Phase Mapping

| Pitfall | Prevention Phase | Verification |
|---------|------------------|--------------|
| Non-portable STT + mic permission issues | Phase 0 – Demo Reliability Contract | Browser/device matrix pass + mic permission test pass |
| Latency budget blow-up | Phase 1 – End-to-End Performance Budgeting | P95 response-start <6s in dry run |
| OCR/CSV extraction corruption | Phase 1 – Data Ingestion Reliability | Validation checks + user confirm step before advice |
| Ungrounded generic advice | Phase 2 – Grounding & Reasoning Integrity | 100% answers include profile numbers + assumptions |
| Persona safety drift/prompt injection | Phase 2 – Safety & Policy Guardrails | Red-team prompts fail to bypass policies |
| Privacy/retention ambiguity | Phase 3 – Privacy, Retention, and Trust Narrative | Documented TTL + delete action works in demo |
| Manipulative action cards | Phase 3 – Recommendation Ethics & Ranking Rules | Card rationale visible + relevance checks pass |
| Live demo outage risk | Phase 4 – Demo Ops & Failure Recovery | Rehearsed fallback (<10s switch) in full runbook |

## Sources

- Project context docs (HIGH):
  - `/home/fulgidus/Documents/senso/.planning/PROJECT.md`
  - `/home/fulgidus/Documents/senso/CONCEPT.md`
  - `/home/fulgidus/Documents/senso/README.md`
- MDN Web Speech API `SpeechRecognition` (HIGH for browser support note and server-based recognition caveat):
  - https://developer.mozilla.org/en-US/docs/Web/API/SpeechRecognition
- MDN `getUserMedia` (HIGH for secure context, permission, and error behavior):
  - https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia
- ElevenLabs latency concept doc (HIGH for TTFA vs inference tradeoff):
  - https://elevenlabs.io/docs/eleven-api/concepts/latency.mdx
- ElevenLabs security best practices (MEDIUM-HIGH for environment isolation and resource permissions):
  - https://elevenlabs.io/docs/eleven-api/guides/how-to/best-practices/security.mdx
- ElevenLabs retention settings (MEDIUM-HIGH for configurable retention defaults):
  - https://elevenlabs.io/docs/eleven-agents/customization/privacy/retention.mdx
- OWASP GenAI/LLM Top 10 (HIGH for AI-app-specific risk taxonomy):
  - https://genai.owasp.org/llm-top-10/
- GDPR checklist reference (MEDIUM, secondary explainer not official legal advice):
  - https://gdpr.eu/checklist/

---
*Pitfalls research for: AI voice financial education assistant (one-day hackathon MVP)*
*Researched: 2026-03-23*
