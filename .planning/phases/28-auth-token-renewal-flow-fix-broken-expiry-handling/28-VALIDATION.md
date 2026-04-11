---
phase: 28
slug: auth-token-renewal-flow-fix-broken-expiry-handling
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 28 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                            |
| ---------------------- | ---------------------------------------------------------------- |
| **Framework**          | Vitest (`vite-plus/test`) + jsdom                                |
| **Config file**        | `senso/vitest.config.ts`                                         |
| **Quick run command**  | `docker compose run --rm frontend pnpm test -- --run --reporter=verbose` |
| **Full suite command**  | `docker compose run --rm frontend pnpm test -- --run`           |
| **Estimated runtime**  | ~20 seconds                                                      |

---

## Sampling Rate

- **After every task commit:** Run quick command
- **After every plan wave:** Run full suite + `pnpm tsc --noEmit`
- **Before `/gsd-verify-work`:** Full suite must be green + tsc clean
- **Max feedback latency:** ~30 seconds

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement | Test Type | Automated Command | File Exists | Status    |
| --------- | ---- | ---- | ----------- | --------- | ----------------- | ----------- | --------- |
| 28-01-01  | 01   | 1    | D-01        | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |
| 28-01-02  | 01   | 1    | D-03        | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |
| 28-02-01  | 02   | 1    | D-02, D-03  | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |
| 28-02-02  | 02   | 1    | D-02, D-03  | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |
| 28-03-01  | 03   | 2    | D-04, D-05  | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |
| 28-04-01  | 04   | 2    | D-07        | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |
| 28-05-01  | 05   | 2    | D-08        | unit      | `pnpm test -- --run`   | ❌ W0  | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `senso/src/lib/__tests__/profile-api.test.ts` — factory onUnauthorized stubs
- [ ] `senso/src/features/coaching/__tests__/coachingApi.test.ts` — factory 401 stubs
- [ ] `senso/src/features/admin/__tests__/adminContentApi.test.ts` — factory 401 stubs
- [ ] `senso/src/features/admin/__tests__/adminMerchantApi.test.ts` — factory 401 stubs
- [ ] `senso/src/api/__tests__/ingestionFilesApi.test.ts` — factory 401 stubs
- [ ] `senso/src/features/ingestion/__tests__/ingestionApi.test.ts` — factory 401 stubs
- [ ] `senso/src/features/messages/__tests__/messagesApi.test.ts` — factory 401 stubs
- [ ] `senso/src/api/__tests__/notificationsApi.test.ts` — factory 401 stubs

*Existing infrastructure (vitest + jsdom + `vi.spyOn(globalThis, "fetch")`) covers all phase requirements — no new framework install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
| -------- | ----------- | ---------- | ----------------- |
| Browser: expired token → redirect to /auth | D-01 | Requires real token expiry flow in browser | Log in, manually expire access token in localStorage, navigate to /profile, confirm redirect to /auth |
| `sendMessageStream` SSE stream on 401 | out-of-scope | Uses native fetch, not apiRequest | Manual: use expired token and observe stream behavior — out of scope for this phase |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
