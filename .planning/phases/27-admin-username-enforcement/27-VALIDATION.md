---
phase: 27
slug: admin-username-enforcement
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-04-11
---

# Phase 27 - Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property               | Value                                                |
| ---------------------- | ---------------------------------------------------- |
| **Framework**          | pytest (backend) / vitest (frontend)                 |
| **Config file**        | `api/pyproject.toml` / `senso/vitest.config.ts`      |
| **Quick run command**  | `docker compose run --rm api uv run pytest api/tests/ -x -q` |
| **Full suite command** | `docker compose run --rm api uv run pytest api/tests/` |
| **Estimated runtime**  | ~30 seconds                                          |

---

## Sampling Rate

- **After every task commit:** Run `docker compose run --rm api uv run pytest api/tests/ -x -q`
- **After every plan wave:** Run `docker compose run --rm api uv run pytest api/tests/`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID   | Plan | Wave | Requirement | Test Type   | Automated Command | File Exists | Status    |
| --------- | ---- | ---- | ----------- | ----------- | ----------------- | ----------- | --------- |
| 27-01-01  | 01   | 1    | D-09        | unit        | `docker compose run --rm api uv run pytest api/tests/ -k test_admin_signup_username -x -q` | ❌ W0 | ⬜ pending |
| 27-01-02  | 01   | 1    | D-10        | unit        | `docker compose run --rm api uv run pytest api/tests/ -k test_username_backfill -x -q` | ❌ W0 | ⬜ pending |
| 27-01-03  | 01   | 1    | D-12        | unit        | `docker compose run --rm api uv run pytest api/tests/ -k test_claim_handle_validation -x -q` | ❌ W0 | ⬜ pending |
| 27-02-01  | 02   | 1    | D-01,D-02   | manual      | —                 | N/A         | ⬜ pending |
| 27-02-02  | 02   | 1    | D-03,D-04   | manual      | —                 | N/A         | ⬜ pending |
| 27-02-03  | 02   | 1    | D-05        | manual      | —                 | N/A         | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `api/tests/test_phase27_username_enforcement.py` — stubs for:
  - `test_admin_signup_username` (D-09: admin signup produces `$adj-noun-N` not `!admin`)
  - `test_username_backfill` (D-10: `_add_missing_columns` assigns unique usernames to NULL/`!admin` admins)
  - `test_claim_handle_validation` (D-12: format rules, reserved handle rejection)
  - `test_claim_handle_uniqueness` (D-12: 409 on duplicate)

*Frontend gate modal tests are manual-only (DOM interaction, blocking overlay behavior).*

---

## Manual-Only Verifications

| Behavior                                       | Requirement | Why Manual             | Test Instructions                                                                                                                              |
| ---------------------------------------------- | ----------- | ---------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Admin without `admin_handle` sees blocking gate | D-01, D-02  | DOM overlay behavior   | Log in as admin with no `admin_handle` set → verify full-screen modal renders, nav/content not accessible                                     |
| Gate is non-dismissable                        | D-03, D-04  | UX interaction         | Try clicking backdrop, pressing Escape → verify modal stays; only valid handle save closes it                                                  |
| Gate dismisses after successful claim          | D-05        | State update assertion | Fill in valid handle, submit → verify modal disappears, app shell renders, Settings shows claimed handle                                        |
| Admin WITH `admin_handle` sees no gate         | D-01        | Negative path          | Log in as admin with `admin_handle` set → verify app shell renders without modal                                                               |
| Format rejection in modal                      | D-12        | UX validation feedback | Try uppercase chars, spaces, too-short value, `admin` (reserved) → verify inline error messages per validation rule                            |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
