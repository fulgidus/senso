# Phase 28: Auth token renewal flow fix - Context

**Gathered:** 2026-04-10
**Status:** Ready for planning

<domain>
## Phase Boundary

When a user navigates to any authenticated screen with an expired access token and the refresh token also fails (or is absent), they end up on a broken page with invalid credentials. The expected behavior is: `invalid access token + failed refresh = clear tokens + hard redirect to /auth`.

Phase 12.1 wired `onUnauthorized` into `apiRequest` via `makeOnUnauthorized(navigate)` and connected it in `useAuth.ts`. However, API calls made by library files (`senso/src/lib/profile-api.ts`, admin API modules, etc.) call `apiRequest()` **without** `onUnauthorized`, so their 401 errors bypass the refresh/redirect flow entirely.

</domain>

<decisions>
## Implementation Decisions

### Root cause
- **D-01:** `profile-api.ts` (and similar library files) call `apiRequest(base, path, { token })` without `onUnauthorized`. A 401 from these calls throws an error that bubbles up to the component — no refresh, no redirect.
- **D-02:** Affected modules: `senso/src/lib/profile-api.ts` (all ~12 API functions), `senso/src/features/admin/adminContentApi.ts` (2 calls without `onUnauthorized`), and potentially others.

### Fix approach
- **D-03:** Update `profile-api.ts` function signatures to accept an optional `onUnauthorized?: () => Promise<string | null>` parameter and pass it to every `apiRequest` call.
- **D-04:** Update all call sites in `ProfileScreen.tsx`, `ProcessingScreen.tsx`, `FilesTab.tsx` etc. to pass `onUnauthorized` obtained from `useAuth()`.
- **D-05:** For `adminContentApi.ts`, the same pattern: add `onUnauthorized` to the function signatures and pass it from the admin components.
- **D-06:** Do NOT use a global singleton/module-level variable for `onUnauthorized` — this avoids stale closure bugs and keeps the approach consistent with the existing pattern.

### BUG_BASH item 16 overlap
- **D-07:** "Most screens go into error — investigate root causes" (BUG_BASH item 16) is likely the same underlying bug — screens that call profile/admin APIs without `onUnauthorized` crash on token expiry. This phase covers both issues.

### Verification
- **D-08:** Done criteria: add a test that simulates a 401 response from profile API and confirms the user is redirected to `/auth` (mock the navigate function). Since this is frontend-only, vitest + react testing library or Playwright.

### Agent's Discretion
- Whether to add `onUnauthorized` to individual function parameters vs a shared API client instance that captures the callback at initialization.
- Which specific call sites to update (use grep to find all `profile-api.ts` import + call patterns).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files
- `senso/src/lib/profile-api.ts` — all `apiRequest` calls without `onUnauthorized` (primary target)
- `senso/src/lib/api-client.ts` — `apiRequest` signature: `onUnauthorized?: () => Promise<string | null>`
- `senso/src/features/auth/session.ts` — `makeOnUnauthorized(navigate?)` factory function
- `senso/src/features/auth/useAuth.ts` — line ~118: `onUnauthorized` is created here and passed to some calls
- `senso/src/features/profile/ProfileScreen.tsx` — primary consumer of profile-api.ts
- `senso/src/features/admin/adminContentApi.ts` — lines 203, 218: two `apiRequest` calls without `onUnauthorized`

### Pending todo
- `.planning/todos/pending/2026-04-01-fix-expired-token-navigation-should-redirect-to-login.md`

</canonical_refs>

<code_context>
## Existing Code Insights

### makeOnUnauthorized pattern
```typescript
// session.ts — already exists, works correctly
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

// useAuth.ts — correctly wired for coaching API calls
const onUnauthorized = useMemo(() => makeOnUnauthorized((to) => navigate(to)), [navigate])
```

### profile-api.ts — missing onUnauthorized
```typescript
// Current (MISSING onUnauthorized):
export async function fetchProfile(token: string): Promise<UserProfile> {
    return apiRequest<UserProfile>(API_BASE, "/profile", { token })
}

// Fixed:
export async function fetchProfile(
    token: string,
    onUnauthorized?: () => Promise<string | null>
): Promise<UserProfile> {
    return apiRequest<UserProfile>(API_BASE, "/profile", { token, onUnauthorized })
}
```

### How many functions need updating
```bash
grep -c "apiRequest" senso/src/lib/profile-api.ts
# ~12 calls — all need the optional onUnauthorized parameter added
```

</code_context>

<deferred>
## Deferred Ideas

- Global auth client singleton (would avoid prop-drilling `onUnauthorized`) — deferred as it's a larger refactor than the immediate fix requires.
- BUG_BASH item 8 (bottom toast z-index) — separate visual bug, unrelated to auth.

</deferred>

---

*Phase: 28-auth-token-renewal-flow-fix-broken-expiry-handling*
*Context gathered: 2026-04-10*
