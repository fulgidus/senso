# Phase 27: Admin username enforcement - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-10
**Phase:** 27-admin-username-enforcement
**Areas discussed:** Admin username format, Backend endpoint, Username suggestion mechanism, Gate trigger column, Modal design, Pre-Phase-13 migration, Handle validation

---

## Admin Username Format

| Option | Description | Selected |
|--------|-------------|----------|
| Change signup too | Admins get $adj-noun-N like everyone else; admin_handle is their !identity | ✓ |
| Gating flow only | Keep !admin for new admin signups; pre-Phase-13 nulls get $adj-noun-N via modal | |
| Custom input | Admins choose their own username format in the modal | |

**User's choice:** Change signup too — `username` column always `$adj-noun-N` for all users; `admin_handle` is the admin's `!identity`.

---

## Backend Endpoint for Username Update

| Option | Description | Selected |
|--------|-------------|----------|
| Extend PATCH /auth/me | Add username to UpdateMeRequest — simpler, one endpoint | |
| New PATCH /users/me/username | Dedicated endpoint per D-07 — cleaner separation | ✓ |

**User's choice:** New dedicated endpoint — but subsequently superseded: no modal for username at all (silent auto-assign), so no user-facing endpoint needed.

---

## Gate Trigger Column Clarification

| Option | Description | Selected |
|--------|-------------|----------|
| Gate on admin_handle NULL | !handle is what admins must set up; username auto-assigned | |
| Gate on username NULL | $adj-noun-N column fix; admin_handle stays optional | |
| Gate on BOTH | Admin must have both username and admin_handle | ✓ |

**User's choice:** Gate on both columns.
**Notes:** This evolved — username is auto-assigned silently, so the UX gate only fires for admin_handle.

---

## Username Suggestion / Setup UX

| Option | Description | Selected |
|--------|-------------|----------|
| Auto-assign silently | No modal for username — backend fixes it in background | ✓ |
| Accept/regenerate modal | Admin sees and confirms $adj-noun-N suggestion | |
| Custom input | Admin types their own username | |

**User's choice:** Auto-assign username silently. Modal is ONLY for admin_handle.
**Notes:** User clarified "username for normal users is always auto-generated. only username that can be setup is !username from an admin" — confirming that admins type their `!handle`, not a `$adj-noun-N` username.

---

## Modal Flow Design

| Option | Description | Selected |
|--------|-------------|----------|
| Two-step modal | Step 1 username, step 2 admin_handle | |
| Single modal both fields | Suggested username + handle input side by side | |
| Two separate gates | Each column checked independently | ✓ |

**User's choice:** Two separate gates checked independently.

---

## Pre-Phase-13 Admin Username Migration

| Option | Description | Selected |
|--------|-------------|----------|
| DB migration in _add_missing_columns() | Auto-assign on backend startup | ✓ |
| Lazy migration in /auth/me | Backend checks and assigns on the fly | |
| Frontend detects and calls endpoint | Frontend patches username with generated suggestion | |

**User's choice:** DB migration in `_add_missing_columns()`.
**Notes:** User said "just do it while signupping" (fix signup), then agreed migration covers existing pre-Phase-13 accounts.

---

## Admin Handle Validation

| Option | Description | Selected |
|--------|-------------|----------|
| Keep current validation | Any !prefixed string | |
| Add format rules | Lowercase alphanum + hyphens, 3-30 chars, reject reserved like !admin | ✓ |

**User's choice:** Tightened format: lowercase alphanumeric + hyphens, 3-30 chars, reject `!admin` and other reserved handles.

---

## Agent's Discretion

- Exact modal styling and layout
- Inline vs tooltip format hints
- Whether to lift existing Settings handle-claim input or rewrite fresh
- Animation/transition for gate modal appearing

## Deferred Ideas

- Username gate for regular users (Phase 13 already handles them at signup)
- Admin handle renaming (permanent once claimed)
- Rate-limiting on claim-handle endpoint
