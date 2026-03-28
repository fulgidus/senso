# Phase 1 Research - Runtime & Account Foundation

**Phase:** 1 (Runtime & Account Foundation)  
**Date:** 2026-03-23  
**Purpose:** Determine concrete implementation approach for `AUTH-01`, `AUTH-02`, `AUTH-03`, `DEMO-03` under locked user decisions.

---

## Inputs Reviewed

- `.planning/phases/01-runtime-account-foundation/01-CONTEXT.md`
- `.planning/ROADMAP.md`
- `.planning/REQUIREMENTS.md`
- `.planning/STATE.md`
- `.planning/phases/01-runtime-account-foundation/01-UI-SPEC.md`
- `AGENTS.md`
- `config.json`
- current frontend scaffold under `senso/`

---

## Locked Decision Constraints (Must Honor)

- **D-01:** Frontend remains **Vite + React** (not Next.js).
- **D-02:** Auth/session logic is **FastAPI-owned**.
- **D-03:** Email auth scope is **signup + login** only.
- **D-04:** **Email verification and magic-link are deferred**.
- **D-05:** **Google OAuth required**, with email/password fallback when unavailable.
- **D-06:** Session persistence uses **JWT in localStorage**.
- **D-07:** JWT policy must include **short-lived access token + refresh rotation guardrail**.
- **D-08:** Session policy is **7-day rolling renewal**.
- **D-09:** Local reproducibility is **Docker Compose one-command startup**.
- **D-10:** **VPS deployment automation deferred**.

---

## Recommended Technical Direction for Phase 1

### 1) Backend auth as FastAPI module

Create a dedicated FastAPI auth module that owns:
- email/password signup
- email/password login
- Google OAuth callback exchange
- refresh token rotation endpoint
- logout + token revocation
- session introspection endpoint (`/auth/me`)

Use Postgres for users and refresh-session persistence (hashed refresh token IDs, rotation metadata, revoke flags, expirations).

### 2) Token/session model for D-06/D-07/D-08

- Access token: short-lived JWT (suggest 15 minutes).
- Refresh token: JWT containing `jti` and session reference.
- Persist access + refresh in browser localStorage per D-06.
- Rotate refresh token on each refresh call; revoke prior token row.
- Rolling renewal with absolute max equivalent to 7 days inactivity policy.

### 3) Google OAuth behavior for D-05

- Backend provides `/auth/google/start` and `/auth/google/callback`.
- If OAuth provider env vars missing or callback fails, backend returns explicit fallback state.
- Frontend displays non-blocking error and routes user to email/password form.

### 4) Frontend auth shell in Vite React (D-01)

- Add auth screen with tabs/buttons for email and Google.
- Add auth client wrapper reading `api.backendUrl` from root `config.json`.
- Add auth store/service that persists tokens in localStorage and refreshes on app load.
- Protect “authenticated home” view by `GET /auth/me` verification + refresh retry.

### 5) Reproducible runtime for DEMO-03 and D-09

- Docker Compose services:
  - `frontend` (Vite app)
  - `api` (FastAPI)
  - `postgres`
- Add one command (`docker compose up --build`) from repo root.
- Add `.env.example` and startup docs with judge-friendly commands.

---

## Contracts to Define Early (Interface-first)

1. Shared auth DTO schema (`AuthTokens`, `UserSession`, `AuthError`).
2. Backend route contracts (`/auth/signup`, `/auth/login`, `/auth/google/start`, `/auth/google/callback`, `/auth/refresh`, `/auth/me`, `/auth/logout`).
3. Frontend storage keys and refresh orchestration behavior.

---

## Risks and Mitigations in This Phase

1. **Token rotation bugs** → add explicit integration tests for one-time refresh token use.
2. **OAuth config missing in demo env** → fallback-first UX and automated smoke check.
3. **Local startup drift** → pin compose services + documented healthchecks.
4. **Decision drift from stack research** (Next/Supabase auth) → enforce D-01 and D-02 explicitly in tasks.

---

## Out of Scope for This Phase

- Email verification flow (D-04).
- Magic-link auth (D-04).
- VPS deploy automation (D-10).

---

## Validation Architecture

Phase 1 validation should run at two speeds:

### Fast loop (per task)
- Frontend static checks: `pnpm --dir senso typecheck` and `pnpm --dir senso lint`
- Backend targeted tests: `pytest api/tests/test_auth_endpoints.py -q`

### Wave/full loop
- `pytest api/tests -q`
- `pnpm --dir senso build`
- `docker compose config`
- optional smoke: `docker compose up -d && ./scripts/smoke-auth.sh && docker compose down`

### Required Nyquist coverage
- Every plan task must have an automated verify command.
- Wave 0 test scaffolding required where tests do not exist yet.
- No watch mode in verification commands.

---

## Research Conclusion

Phase 1 should be planned into 3 executable plans:
1. Backend auth/session contracts + endpoints + tests.
2. Frontend auth UI/session persistence + Google fallback wiring.
3. Docker Compose reproducible runtime + startup verification/documentation.

This structure covers all required IDs (`AUTH-01`, `AUTH-02`, `AUTH-03`, `DEMO-03`) while honoring locked decisions.
