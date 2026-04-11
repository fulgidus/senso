# Phase 28: Auth token renewal flow fix - Context

**Gathered:** 2026-04-11 (updated)
**Status:** Ready for planning

<domain>
## Phase Boundary

When a user navigates to any authenticated screen with an expired access token and the refresh token also fails (or is absent), they end up on a broken page with invalid credentials. The expected behavior is: `invalid access token + failed refresh = clear tokens + hard redirect to /auth`.

Phase 12.1 wired `onUnauthorized` into `apiRequest` via `makeOnUnauthorized(navigate)` and connected it in `useAuth.ts`. However, **no API module or component** actually passes `onUnauthorized` to `apiRequest` — every authenticated call silently drops 401 errors to the component level with no refresh/redirect.

This phase is a **full sweep**: every authenticated API module gets a per-module factory that captures `onUnauthorized` at construction time. All 4 direct component `apiRequest` calls are migrated to the appropriate module factory.

</domain>

<decisions>
## Implementation Decisions

### Root cause
- **D-01:** Every API module (`profile-api.ts`, `coachingApi.ts`, `adminContentApi.ts`, `adminMerchantApi.ts`, `ingestionFilesApi.ts`, `ingestion/api.ts`, `messagesApi.ts`, `notificationsApi.ts`) calls `apiRequest()` without `onUnauthorized`. A 401 from any of these throws an unhandled error — no refresh, no redirect.
- **D-02:** Scope: **8 API modules (66+ calls)** + **4 direct component calls** (SettingsScreen, AdminHandleGateModal, DebugScreen, OnboardingRoutes). All need fixing. This supersedes original D-02 which only listed profile-api.ts and 2 calls in adminContentApi.ts.

### Fix strategy — per-module factory pattern
- **D-03:** Each API module exports a **factory function** (`createProfileApi(onUnauthorized)`, `createCoachingApi(onUnauthorized)`, etc.) that returns an object containing all module functions bound to the provided `onUnauthorized` callback.
- **D-04:** Hooks/components that need an API module call the factory once: `const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized])`. This eliminates per-call prop threading.
- **D-05:** Do NOT use a global singleton/module-level variable for `onUnauthorized` (stale closure risk, inconsistent with React lifecycle). Per-module factory instantiated inside hooks is the correct boundary.
- **D-06:** `session.ts` is **explicitly excluded** from the factory pattern — its `apiRequest` calls are auth primitives (login, refresh, logout, me). They must NOT auto-redirect on 401 because a 401 from `/auth/refresh` is an expected terminal condition, not a broken session. Add an explicit `/* no onUnauthorized — auth primitive */` comment to each call in `session.ts` to document the exclusion.

### Component direct calls
- **D-07:** The 4 direct `apiRequest` calls in components (SettingsScreen, AdminHandleGateModal, DebugScreen, OnboardingRoutes) are **migrated to the appropriate module factory** rather than threaded inline:
  - `SettingsScreen` + `AdminHandleGateModal` (claim-handle) → `createAdminApi` factory
  - `DebugScreen` → `createDebugApi` factory (or inline with explicit null if one-off)
  - `OnboardingRoutes` (confirm-all ingestion) → `createIngestionApi` factory

### Testing
- **D-08:** Vitest + React Testing Library. Every module factory gets at least one test that: mocks `fetch` to return 401, calls a factory function, asserts `onUnauthorized` was called and the navigate mock received `/auth`.
- **D-09:** No Playwright E2E required for this phase — unit coverage across all module factories is sufficient.

### Agent's Discretion
- Factory return type shape (named object vs array vs class instance — whatever is idiomatic with existing codebase patterns).
- Whether `DebugScreen` gets its own micro-factory or stays inline with `onUnauthorized` threaded from `useAuth()` (since it may be truly one-off).
- Exact file structure for factory exports — co-located in each module file or separate `*-client.ts` file.

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Core auth plumbing
- `senso/src/lib/api-client.ts` — `apiRequest` signature: `onUnauthorized?: () => Promise<string | null>`, internal retry logic
- `senso/src/features/auth/session.ts` — `makeOnUnauthorized(navigate?)` factory; contains all auth-primitive `apiRequest` calls that must NOT get onUnauthorized
- `senso/src/features/auth/useAuth.ts` — `onUnauthorized` created at line ~118, returned from hook but currently never passed to any API module

### API modules to refactor (full list)
- `senso/src/lib/profile-api.ts` — 12 `apiRequest` calls, all without `onUnauthorized`
- `senso/src/features/coaching/coachingApi.ts` — 10 calls
- `senso/src/features/admin/adminContentApi.ts` — 11 calls
- `senso/src/features/admin/adminMerchantApi.ts` — 7 calls
- `senso/src/api/ingestionFilesApi.ts` — 6 calls
- `senso/src/features/ingestion/api.ts` — 7 calls
- `senso/src/features/messages/messagesApi.ts` — 5 calls
- `senso/src/api/notificationsApi.ts` — 4 calls

### Component direct calls to migrate
- `senso/src/features/settings/SettingsScreen.tsx` — line 172, claim-handle call
- `senso/src/components/AdminHandleGateModal.tsx` — line 37, claim-handle call
- `senso/src/features/debug/DebugScreen.tsx` — line 27, debug endpoint
- `senso/src/routes/OnboardingRoutes.tsx` — line 166, confirm-all ingestion

### Consumers of API modules (call sites that need factory instantiation)
- `senso/src/features/profile/ProfileScreen.tsx`
- `senso/src/features/profile/ProcessingScreen.tsx`
- `senso/src/features/profile/QuestionnaireScreen.tsx`
- `senso/src/features/profile/TimelineTab.tsx`
- `senso/src/features/profile/UncategorizedScreen.tsx`
- `senso/src/features/profile/useProfileStatus.ts`

### Pending todo
- `.planning/todos/pending/2026-04-01-fix-expired-token-navigation-should-redirect-to-login.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### makeOnUnauthorized — already works, just not used
```typescript
// session.ts — correct implementation, never called from API modules
export function makeOnUnauthorized(navigate?: (to: string) => void) {
    return async () => {
        const storedRefreshToken = readRefreshToken()
        if (!storedRefreshToken) { clearTokens(); navigate?.("/auth"); return null }
        try {
            const payload = await refresh(storedRefreshToken)
            return payload.accessToken
        } catch {
            clearTokens(); navigate?.("/auth"); return null
        }
    }
}

// useAuth.ts — creates it, exposes via hook, but no module consumes it
const onUnauthorized = useMemo(() => makeOnUnauthorized((to) => navigate(to)), [navigate])
```

### Target factory shape (profile-api example)
```typescript
// Before:
export async function fetchProfile(token: string): Promise<UserProfile> {
    return apiRequest<UserProfile>(API_BASE, "/profile", { token })
}

// After — factory pattern:
export function createProfileApi(onUnauthorized?: () => Promise<string | null>) {
    return {
        fetchProfile: (token: string) =>
            apiRequest<UserProfile>(API_BASE, "/profile", { token, onUnauthorized }),
        // ... all 12 functions bound to onUnauthorized
    }
}

// Hook usage:
const profileApi = useMemo(() => createProfileApi(onUnauthorized), [onUnauthorized])
```

### session.ts exclusion comment pattern
```typescript
// In session.ts — document every auth-primitive call:
const raw = await apiRequest<RawUser>(backendBaseUrl, "/auth/me", {
    token,
    /* no onUnauthorized — auth primitive, 401 is terminal here */
})
```

### Established Patterns
- `useMemo` with dependency on `onUnauthorized` is the correct React pattern for stable factory instances
- `onUnauthorized` reference from `useAuth()` is already stable (wrapped in `useMemo` with `[navigate]` dep)

### Integration Points
- Every hook/component that calls an API module needs to: `const { onUnauthorized } = useAuth()`, then `useMemo(() => createXxxApi(onUnauthorized), [onUnauthorized])`
- `useAuth()` already returns `onUnauthorized` — no changes to the hook API needed

</code_context>

<deferred>
## Deferred Ideas

- Global auth client singleton (would avoid per-hook factory instantiation) — deferred as it introduces stale closure risk and module coupling.
- BUG_BASH item 8 (bottom toast z-index) — separate visual bug, unrelated to auth.

</deferred>

---

*Phase: 28-auth-token-renewal-flow-fix-broken-expiry-handling*
*Context gathered: 2026-04-11*
