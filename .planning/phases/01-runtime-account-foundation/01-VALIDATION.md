---
phase: 1
slug: runtime-account-foundation
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-03-23
---

# Phase 1 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                                          |
| ---------------------- | ------------------------------------------------------------------------------ |
| **Framework**          | pytest + vitest                                                                |
| **Config file**        | `api/pyproject.toml` (to be created), `senso/vitest.config.ts` (to be created) |
| **Quick run command**  | `pytest api/tests/test_auth_endpoints.py -q`                                   |
| **Full suite command** | `pytest api/tests -q && pnpm --dir senso typecheck && pnpm --dir senso build`  |
| **Estimated runtime**  | ~45 seconds                                                                    |

---

## Sampling Rate

- **After every task commit:** Run `pytest api/tests/test_auth_endpoints.py -q`
- **After every plan wave:** Run `pytest api/tests -q && pnpm --dir senso typecheck && pnpm --dir senso build`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID  | Plan | Wave | Requirement | Test Type       | Automated Command                                                                          | File Exists | Status    |
| -------- | ---- | ---- | ----------- | --------------- | ------------------------------------------------------------------------------------------ | ----------- | --------- |
| 01-01-01 | 01   | 1    | AUTH-01     | unit/api        | `pytest api/tests/test_auth_endpoints.py::test_signup_success -q`                          | ❌ W0        | ⬜ pending |
| 01-01-02 | 01   | 1    | AUTH-03     | integration/api | `pytest api/tests/test_auth_endpoints.py::test_refresh_rotation_revokes_previous_token -q` | ❌ W0        | ⬜ pending |
| 01-02-01 | 02   | 2    | AUTH-02     | ui/integration  | `pnpm --dir senso vitest run src/auth/auth-session.test.ts`                                | ❌ W0        | ⬜ pending |
| 01-03-01 | 03   | 2    | DEMO-03     | infra/smoke     | `docker compose config`                                                                    | ✅           | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_auth_endpoints.py` - auth endpoint and refresh-rotation scaffolds for AUTH-01/AUTH-03
- [ ] `api/tests/conftest.py` - shared FastAPI test client fixtures
- [ ] `senso/src/auth/auth-session.test.ts` - frontend token persistence + refresh behavior tests for AUTH-03/AUTH-02 fallback behavior
- [ ] `senso/vitest.config.ts` and `senso/package.json` test script - frontend test infrastructure setup

---

## Manual-Only Verifications

| Behavior                                                    | Requirement | Why Manual                                                             | Test Instructions                                                                                                                         |
| ----------------------------------------------------------- | ----------- | ---------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- |
| Google OAuth fallback to email UI copy and interaction feel | AUTH-02     | OAuth provider outage state and UX response must be visually confirmed | Start app with missing Google OAuth env vars; click Google sign-in; verify fallback message and usable email/password form remain visible |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
