---
phase: 6
reviewers: [gemini]
reviewed_at: 2026-03-29T00:00:00Z
plans_reviewed: [06-01-PLAN.md, 06-02-PLAN.md, 06-03-PLAN.md, 06-04-PLAN.md]
note: claude (current runtime) skipped for independence. codex not installed.
---

# Cross-AI Plan Review - Phase 6: Learn+Act Cards & Demo Hardening

## Gemini Review

I will now investigate the current state of the coaching prompts, frontend components, and content catalogs to provide grounded feedback on the implementation plans.

### Phase 6: Learn+Act Cards & Demo Hardening - Cross-AI Plan Review

This review evaluates the proposed implementation plans for the final "Demo Hardening" phase of the S.E.N.S.O. project.

#### 1. Summary

The four plans provide a comprehensive strategy for bridging the gap between "functional" and "demo-ready." **Plan 06-01 (Card Reliability)** and **Plan 06-03 (Seed/Reset Scripts)** are the strongest, addressing the most critical risks for a live hackathon presentation: content presence and environment reproducibility. **Plan 06-02** correctly identifies a common "silent failure" point (ID mismatch between backend and frontend), while **Plan 06-04** provides the necessary UX "smoke and mirrors" to handle LLM latency gracefully.

#### 2. Strengths

- **Dual-Layer Reliability:** The "Prompt Hardening + Fallback Injection" approach in Plan 06-01 is excellent. Relying solely on LLM compliance for a 90-second demo is risky; the server-side fallback guarantees the visual presence of cards even if the LLM skips a tool call.
- **Automated Verification:** Plan 06-01 includes a specific 10-test suite (`test_coaching_cards.py`). This prevents regression in the most visually impactful part of the app.
- **Operational Readiness:** Plan 06-03 (Reset Script) is a "pro-tier" addition. In a hackathon, being able to wipe the database and restart a clean demo in seconds is often the difference between a successful pitch and a technical failure.
- **UX Continuity:** Plan 06-04's focus on "staggered animation-delay" and skeleton text prevents the "jumping UI" effect common in LLM-driven apps.

#### 3. Concerns

- **[MEDIUM] Fallback Logic Threshold:** Plan 06-01 uses `message >= 30 chars` for fallback injection. Many valid financial questions are shorter (e.g., *"Can I buy this laptop?"* is 21 chars; *"Posso comprarlo?"* is 15). Risk: Users asking short, natural questions might not see the cards that are the core requirement of this phase.
- **[MEDIUM] Voice Echo/Interruption:** Plan 06-02 focuses on TTS timing but doesn't explicitly mention **STT muting/disabling during playback**. Risk: If the assistant's voice is played through speakers, the browser's STT might "hear" itself, creating a feedback loop or duplicate transcripts.
- **[LOW] Timeout vs. Demo Goal:** Plan 06-04 sets a 75-second client-side timeout. The project goal (DEMO-01) is a full flow in under 90 seconds. Risk: If a single response takes 75 seconds, the demo has already failed its time constraint.
- **[LOW] SQL Reset Permissions:** Using `docker compose exec postgres psql` for resets is fast but bypasses the application layer. Risk: External files in MinIO might remain as "ghost" files that cause ingestion errors on the second run. (The plan already accounts for MinIO clearing as best-effort, but a failure there could silently corrupt the second seed run.)

#### 4. Suggestions

- **Refine Fallback Trigger:** Instead of a character count, trigger the card fallback based on the `affordability_verdict` presence. If the LLM provides a verdict (Grounded Recommendation) but forgets the tool call, inject the cards.
- **STT State Management:** In `useVoiceMode`, ensure `recognition.stop()` is called immediately when the `onAssistantMessage` (TTS) begins, and only re-enable after the `onEnd` event of the TTS.
- **Tighten Timeouts:** Lower the client-side timeout to 30 seconds for the demo. If it takes longer, the "Riprova" (Retry) button is a better user experience than waiting 75 seconds for a potential failure.
- **Unified Reset:** Enhance `reset-demo.sh` to include a `mc rb --force` (MinIO Client) command to ensure the object storage is as clean as the database.
- **Card Mapping Automation:** Add a small script or a test case to `test_coaching_cards.py` that cross-references `api/app/content/slides.json` with `senso/src/content/slideIndex.ts` to flag missing IDs before the demo.

#### 5. Risk Assessment: LOW

The plans are highly focused and "surgically" address the requirements. The inclusion of fallback injection and environment scripts significantly lowers the risk of a "demo effect" failure. If the concerns regarding voice loop interruption and fallback thresholds are addressed, the phase is positioned for a high-quality delivery.

---

## Consensus Summary

Only one independent reviewer (Gemini) was available. `claude` CLI was skipped as the current runtime; `codex` is not installed.

### Agreed Strengths

- **Fallback injection is the right call** - dual-layer reliability (prompt hardening + server-side fallback) is robust against LLM non-compliance during a live demo.
- **The seed/reset scripts address the single highest-risk demo failure mode** - the ability to run `reset-demo.sh && seed-demo.sh` in one command is critical for a hackathon.
- **The test suite in 06-01 is well-scoped** - 10 tests covering BM25 paths, fallback injection, and locale isolation provide meaningful regression coverage.

### Agreed Concerns

1. **[MEDIUM] Fallback trigger threshold (30 chars) is too low** - natural Italian financial questions like "Posso comprarlo?" (16 chars) or "È conveniente?" (14 chars) fall below the threshold and would receive no cards. The trigger should use a semantic signal (e.g., `affordability_verdict != null` OR `len(message) > 15`) rather than a character-count proxy.

2. **[MEDIUM] STT-TTS feedback loop not addressed in 06-02** - the plan fixes TTS timing but doesn't document how STT is disabled/paused while TTS audio is playing. In a speaker-based demo (not headphones), the microphone will pick up the assistant's spoken output and loop it back as user input. This must be verified in the end-to-end voice test.

3. **[LOW] 75-second client timeout is too permissive for a 90-second demo** - if the timeout fires, the demo has effectively failed. Consider 30-40 seconds as the client timeout to match user expectations, with the Retry button as the recovery path.

### Divergent Views

N/A - only one external reviewer. No divergence to report.

### Priority Action Items Before Execution

1. **06-01 Task 1**: Change the fallback trigger from `len(message) < 30` to a combined check: skip if `len(message) < 15` OR `affordability_verdict` is absent (i.e., the response is truly conversational, not a financial recommendation).
2. **06-02 Task 2**: Add explicit STT mute/unmute logic during TTS playback in `useVoiceMode` - disable `recognition` on TTS start, re-enable on TTS `onEnd`.
3. **06-04 Task 1**: Lower client-side timeout from 75s to 35s; this is also safer because the backend 60s LLM timeout should trigger a 502 before the frontend timeout fires.
4. **06-01 Task 2** (optional enhancement): Add a test in `test_coaching_cards.py` that validates all slide IDs in `slides.json` exist as keys in `slideIndex.ts` (cross-catalog integrity check).
