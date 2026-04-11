# Phase 28: Auth token renewal flow fix - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-04-11
**Phase:** 28-auth-token-renewal-flow-fix-broken-expiry-handling
**Areas discussed:** Scope, Fix strategy, Factory structure, session.ts treatment, Component direct calls, Test coverage

---

## Scope discovery

Codebase scan revealed original D-02 was severely incomplete. Original context listed ~14 calls (profile-api.ts + 2 in adminContentApi.ts). Actual count: **8 API modules (66+ calls) + 4 direct component calls** — all without `onUnauthorized`.

| Option | Description | Selected |
|---|---|---|
| Full sweep | All 8 modules + component calls | ✓ |
| Originally scoped only | profile-api.ts + adminContentApi.ts as per D-02 | |
| Core flows only | profile-api.ts + coachingApi.ts + adminContentApi.ts | |

**User's choice:** Full sweep — every authenticated API call gets onUnauthorized.

---

## Fix strategy

| Option | Description | Selected |
|---|---|---|
| Param threading | Per-function optional param (D-03 approach, scaled) | |
| Factory / bound-client | createXxxApi(onUnauthorized) per module | ✓ |
| Context injection | React Context supplies onUnauthorized to API modules | |

**User's choice:** Per-module factory pattern — each module exports `createXxxApi(onUnauthorized)` returning all functions bound to the callback. Less prop-drilling at 66+ calls.

---

## Factory structure

| Option | Description | Selected |
|---|---|---|
| Single unified factory | createApiClient() returns { profile, coaching, admin, ... } | |
| Per-module factories | createProfileApi, createCoachingApi, etc. | ✓ |
| Agent's discretion | Whatever fits module structure best | |

**User's choice:** Per-module factories — keeps module separation, each file exports its own factory.

---

## session.ts treatment

| Option | Description | Selected |
|---|---|---|
| Exclude session.ts | Leave untouched — handles 401 explicitly | |
| Explicit null/no-op | Add `/* no onUnauthorized — auth primitive */` comment to each call | ✓ |

**User's choice:** Explicit null/no-op comments — documents the exclusion intentionally in code rather than silently skipping.

---

## Component direct calls

| Option | Description | Selected |
|---|---|---|
| Migrate to module factories | Move each to appropriate factory (claim-handle → adminApi, etc.) | ✓ |
| Thread inline via useAuth | Stay inline, pass onUnauthorized from useAuth() destructure | |
| Agent's discretion | Move if factory exists, thread if one-off | |

**User's choice:** Migrate to module factories — cleaner, removes antipattern of inline apiRequest in components.

---

## Test coverage

| Option | Description | Selected |
|---|---|---|
| Representative coverage | Deep test for profile-api factory + smoke tests for 2-3 modules | |
| Full module coverage | Every factory gets ≥1 test with 401 simulation | ✓ |
| E2E only | Single Playwright test — simulate expired token, verify redirect | |

**User's choice:** Full module coverage — every module factory gets at least one vitest test that mocks fetch → 401, asserts onUnauthorized called, asserts navigate("/auth") received.

---

## Agent's Discretion

- Factory return type shape (named object vs array vs class instance)
- Whether DebugScreen gets its own factory or stays inline with onUnauthorized threaded
- Exact file structure for factory exports (co-located vs separate `*-client.ts`)

## Deferred Ideas

- Global auth client singleton — stale closure risk, deferred
- BUG_BASH item 8 (toast z-index) — separate visual bug, out of scope
