---
phase: 7
slug: streaming-nice-to-have-polish
status: draft
nyquist_compliant: true
wave_0_complete: true
created: 2026-03-29
---

# Phase 7 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
| -------- | ----- |
| **Framework** | pytest + vitest + frontend build |
| **Config file** | `api/pyproject.toml`, `senso/vitest.config.ts`, `docker-compose.yml` |
| **Quick run command** | `docker compose run --rm api uv run pytest tests/test_auth_endpoints.py tests/test_coaching_endpoints.py tests/test_safety_hardening.py -q` |
| **Full suite command** | `docker compose run --rm api uv run pytest tests/test_auth_endpoints.py tests/test_coaching_endpoints.py tests/test_safety_hardening.py -q && docker compose run --rm frontend pnpm vitest run src/features/auth/__tests__/auth-session.test.ts && docker compose run --rm frontend pnpm build` |
| **Estimated runtime** | ~45 seconds |

---

## Sampling Rate

- **After every task commit:** Run the task's targeted `<automated>` command.
- **After every plan wave:** Run `docker compose run --rm frontend pnpm build` plus the relevant backend test bundle for that wave.
- **Before `/gsd-verify-work`:** Full suite above must be green.
- **Max feedback latency:** 45 seconds.

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status |
| ------- | ---- | ---- | ----------- | --------- | ----------------- | ----------- | ------ |
| 07-01-01 | 01 | 1 | COCH-05 | api/auth | `docker compose run --rm api uv run pytest tests/test_auth_endpoints.py -q` | ✅ | ⬜ pending |
| 07-01-02 | 01 | 1 | COCH-05 | api/coaching | `docker compose run --rm api uv run pytest tests/test_coaching_endpoints.py -q` | ✅ | ⬜ pending |
| 07-02-01 | 02 | 1 | COCH-05 | api/streaming | `docker compose run --rm api uv run pytest tests/test_coaching_endpoints.py -q` | ✅ | ⬜ pending |
| 07-02-02 | 02 | 1 | SAFE-01 | api/safety | `docker compose run --rm api uv run pytest tests/test_safety_hardening.py -q` | ✅ | ⬜ pending |
| 07-03-01 | 03 | 2 | COCH-05 | frontend/unit | `docker compose run --rm frontend pnpm vitest run src/features/auth/__tests__/auth-session.test.ts` | ✅ | ⬜ pending |
| 07-03-02 | 03 | 2 | COCH-05 | frontend/build | `docker compose run --rm frontend pnpm build` | ✅ | ⬜ pending |
| 07-04-01 | 04 | 3 | COCH-05 | frontend/unit | `docker compose run --rm frontend pnpm vitest run src/features/auth/__tests__/auth-session.test.ts` | ✅ | ⬜ pending |
| 07-04-02 | 04 | 3 | COCH-05 | frontend/build | `docker compose run --rm frontend pnpm build` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

Existing infrastructure covers all phase requirements.

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
| -------- | ----------- | ---------- | ----------------- |
| Streaming bubble feels progressive and subtle | COCH-05 | motion quality is visual | Ask one coaching question, watch the same assistant bubble fill progressively, confirm structured cards appear only after final text |
| Restore toast placement/timing | COCH-05 | timing + visual prominence | Open chat with prior history, confirm a small toast appears once and disappears automatically |
| Persona tint subtlety in light/dark mode | COCH-05 | visual style judgement | Switch personas in chat and Settings, verify tint changes are noticeable but restrained in both themes |

---

## Validation Sign-Off

- [x] All tasks have `<automated>` verify commands
- [x] Sampling continuity: no 3 consecutive tasks without automated verify
- [x] Wave 0 covers all MISSING references
- [x] No watch-mode flags
- [x] Feedback latency < 60s
- [x] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
