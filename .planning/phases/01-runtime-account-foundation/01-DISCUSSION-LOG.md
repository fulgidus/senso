# Phase 1: Runtime & Account Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md - this log preserves the alternatives considered.

**Date:** 2026-03-23
**Phase:** 01-runtime-account-foundation
**Areas discussed:** Framework foundation, Auth ownership, Email auth scope, Session storage/policy, Runtime reproducibility, Provider failure behavior, Deferred deployment scope

---

## Framework foundation

| Option           | Description                                                  | Selected |
| ---------------- | ------------------------------------------------------------ | -------- |
| Vite + React     | Lean ReactJS setup, fast path if avoiding Next.js complexity | ✓        |
| Keep Next.js     | Built-in routing/SSR/handlers and auth ergonomics            |          |
| Create React App | Legacy React setup, less modern in 2026                      |          |

**User's choice:** Vite + React
**Notes:** User explicitly requested moving away from Next.js and locking ReactJS-first foundation.

---

## Auth ownership

| Option             | Description                                     | Selected |
| ------------------ | ----------------------------------------------- | -------- |
| Supabase Auth      | Hosted auth/session managed via Supabase        |          |
| FastAPI-owned auth | Auth/session endpoints owned by backend service | ✓        |
| Hybrid             | Supabase auth plus backend-only domain APIs     |          |

**User's choice:** FastAPI-owned auth
**Notes:** Decision applies to session management and OAuth completion path.

---

## Email auth scope (Phase 1)

| Option                 | Description                             | Selected |
| ---------------------- | --------------------------------------- | -------- |
| Email+password only    | Simple signup/login path for speed      | ✓        |
| Add email verification | Require verification before first login |          |
| Add magic link too     | Include passwordless option in Phase 1  |          |

**User's choice:** Email+password only
**Notes:** Verification and magic link deferred.

---

## Session persistence and policy

| Option              | Description                      | Selected |
| ------------------- | -------------------------------- | -------- |
| HttpOnly cookies    | Server-managed session cookies   |          |
| JWT in localStorage | Client-managed token persistence | ✓        |
| Remember-me only    | Persist only if user opts in     |          |

**User's choice:** JWT in localStorage
**Notes:** Additional guardrail selected below.

### JWT guardrail

| Option                       | Description                       | Selected |
| ---------------------------- | --------------------------------- | -------- |
| Short-lived access + refresh | Reduce theft window with rotation | ✓        |
| Long-lived single JWT        | Simpler, higher risk              |          |
| You decide                   | Leave to planner                  |          |

**User's choice:** Short-lived access + refresh
**Notes:** Must be enforced in Phase 1 implementation decisions.

### Session lifetime

| Option        | Description                   | Selected |
| ------------- | ----------------------------- | -------- |
| 7-day rolling | Activity-based renewal window | ✓        |
| 24-hour fixed | Force daily re-login          |          |
| Session-only  | Logout on browser close       |          |

**User's choice:** 7-day rolling
**Notes:** Chosen as baseline persistence policy.

---

## Google OAuth failure behavior

| Option                  | Description                                           | Selected |
| ----------------------- | ----------------------------------------------------- | -------- |
| Fallback to email login | Keep email/password path available on provider issues | ✓        |
| Block login entirely    | Stop auth flow if Google fails                        |          |
| Hide Google button      | Temporarily disable Google sign-in                    |          |

**User's choice:** Fallback to email login
**Notes:** Explicit runtime resilience behavior for Phase 1.

---

## Reproducible runtime definition

| Option                     | Description                             | Selected |
| -------------------------- | --------------------------------------- | -------- |
| Docker Compose one-command | Single command boots required stack     | ✓        |
| Manual services            | Separate local service startup          |          |
| Hybrid                     | Partial containerization + local FE run |          |

**User's choice:** Docker Compose one-command
**Notes:** User also noted future VPS automation plans.

---

## VPS automation scope

| Option                     | Description                                   | Selected |
| -------------------------- | --------------------------------------------- | -------- |
| Defer automation           | Keep Phase 1 focused on local reproducibility | ✓        |
| Include minimal VPS deploy | Add simple deploy script now                  |          |
| Include full CI/CD deploy  | Build complete VPS pipeline in this phase     |          |

**User's choice:** Defer automation
**Notes:** Tracked as deferred idea for a later phase.

---

## the agent's Discretion

- Exact token/access-refresh durations.
- UI treatment wording for auth fallback states.
- Compose service naming/startup script shape.

## Deferred Ideas

- VPS deployment automation beyond local runtime reproducibility.
- Email verification and magic-link authentication.
