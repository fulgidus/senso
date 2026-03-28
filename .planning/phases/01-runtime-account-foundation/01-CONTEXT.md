# Phase 1: Runtime & Account Foundation - Context

**Gathered:** 2026-03-23
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver reliable app access with persistent sessions and a reproducible local runtime for judging: email/password signup/login, Google OAuth sign-in, session persistence across refresh, and one-command local startup.

</domain>

<decisions>
## Implementation Decisions

### Frontend Foundation
- **D-01:** Lock frontend foundation to Vite + React for this project (do not use Next.js as the primary frontend framework).

### Authentication Ownership and Flows
- **D-02:** Auth/session logic is FastAPI-owned (not Supabase-owned auth flows).
- **D-03:** Email auth in Phase 1 includes email + password signup/login only.
- **D-04:** Email verification and magic-link are explicitly deferred beyond Phase 1.
- **D-05:** Google OAuth remains required in Phase 1; if provider is unavailable, users are routed to email/password fallback.

### Session Policy
- **D-06:** Session persistence strategy uses JWT stored in localStorage.
- **D-07:** JWT policy must include short-lived access token + refresh rotation guardrail.
- **D-08:** Session duration policy is 7-day rolling renewal.

### Runtime and Delivery Scope
- **D-09:** Reproducible local setup for judges is Docker Compose one-command startup.
- **D-10:** VPS deployment automation is deferred and not included in Phase 1 scope.

### the agent's Discretion
- Exact token TTL values and refresh cadence (as long as short-lived access + refresh rotation is respected).
- Exact error message wording and UI styling for auth fallback states.
- Compose service naming and startup script ergonomics, provided one-command reproducibility is preserved.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope and Acceptance
- `.planning/ROADMAP.md` - Phase 1 boundary, requirements list, and success criteria.
- `.planning/REQUIREMENTS.md` - `AUTH-01`, `AUTH-02`, `AUTH-03`, `DEMO-03` acceptance targets.
- `.planning/PROJECT.md` - non-negotiables (one-day demo reliability, AI-central product constraints).

### Existing Project Configuration
- `config.json` - current app/backend endpoints, feature flags, and provider defaults used as implementation baseline.

### Prior Research Inputs
- `.planning/research/STACK.md` - stack recommendation context; frontend choice is overridden here by D-01.
- `.planning/research/ARCHITECTURE.md` - modular architecture guidance and integration boundaries for auth/runtime foundation.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `config.json`: central runtime/provider configuration scaffold (backend URL, feature toggles, provider defaults) that can anchor Phase 1 environment wiring.
- `personas/config.json` and `personas/*`: existing project data assets already versioned and available for mount/read checks in local runtime.

### Established Patterns
- Planning/docs indicate Docker-first local reproducibility and service composition as the expected execution style for demo reliability.
- Configuration-first pattern is already present (single root `config.json` with environment-sensitive fields).

### Integration Points
- Frontend runtime should integrate against `api.backendUrl` from `config.json` for auth requests.
- FastAPI auth/session endpoints become the source of truth for both email/password and Google OAuth completion.
- Compose topology should provide app + API + data services in one start command to satisfy `DEMO-03`.

</code_context>

<specifics>
## Specific Ideas

- Keep authentication usable even during Google provider disruption by visibly falling back to email/password.
- Preserve hackathon velocity by locking local reproducibility first; VPS automation can be added after foundation is stable.

</specifics>

<deferred>
## Deferred Ideas

- VPS deployment automation scripts/pipeline - move to later phase once Phase 1 local reliability is complete.
- Email verification and magic link auth variants - not part of Phase 1 runtime/account foundation scope.

</deferred>

---

*Phase: 01-runtime-account-foundation*
*Context gathered: 2026-03-23*
