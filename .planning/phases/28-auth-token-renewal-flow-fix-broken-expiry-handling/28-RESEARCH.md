# Phase 28: Research — Auth token renewal flow fix

**Researched:** 2026-04-11
**Status:** Complete

---

## Summary

Phase 28 wires `onUnauthorized` callbacks across 8 API modules + fixes 3 remaining
component-level direct `apiRequest` calls. The implementation is well-understood; this
research surfaces the integration gaps, call-count verification, token-access patterns,
and the critical `AuthContext` missing-field blocker that the CONTEXT.md doesn't fully
address.

---

## 1. `apiRequest` — Verified Signature

```typescript
// senso/src/lib/api-client.ts
type RequestOptions = {
  token?: string
  onUnauthorized?: () => Promise<string | null>
  _isRetry?: boolean   // internal — never set from call sites
  ...
}
export async function apiRequest<T>(baseUrl, path, options): Promise<T>
```

- On 401: calls `onUnauthorized()`, if returns new token → retries once with `_isRetry: true`.
- If `onUnauthorized` returns `null` (refresh failed) → throws `ApiClientError(401)`.
- If no `onUnauthorized` set → throws immediately on 401.

✓ No changes to `api-client.ts` needed.

---

## 2. Verified `apiRequest` Call Counts

| Module | File | Calls |
|--------|------|-------|
| profile-api | `senso/src/lib/profile-api.ts` | 12 |
| coachingApi | `senso/src/features/coaching/coachingApi.ts` | 10 |
| adminContentApi | `senso/src/features/admin/adminContentApi.ts` | 11 |
| adminMerchantApi | `senso/src/features/admin/adminMerchantApi.ts` | 7 |
| ingestionFilesApi | `senso/src/api/ingestionFilesApi.ts` | 6 |
| ingestion/api | `senso/src/features/ingestion/api.ts` | 7 |
| messagesApi | `senso/src/features/messages/messagesApi.ts` | 5 |
| notificationsApi | `senso/src/api/notificationsApi.ts` | 4 |

**Total: 62 `apiRequest` calls** to wire with `onUnauthorized`.

Note: `coachingApi.ts` has `sendMessageStream` using **native `fetch`** (not `apiRequest`) for SSE streaming — this is out of scope for this phase. It also has `fetchTTSAudio` using native fetch. Both are noted as intentional exclusions.

---

## 3. Critical Integration Gap: `AuthContext` Missing `onUnauthorized`

**Root cause of the wiring gap:**

`onUnauthorized` is created in `useAuth()` and returned as part of its result. However,
`AuthContext` (used by most components via `useAuthContext()`) does NOT include `onUnauthorized`:

```typescript
// AuthContext.tsx — current AuthContextValue (NO onUnauthorized)
export type AuthContextValue = {
  user: User;
  signOut: () => Promise<void>;
  updateUser: (updated: Partial<User>) => void;
  cryptoKeys: CryptoKeyMaterial | null;
  // ... isPolling, pendingMessageCount, polledMessages
  // ← onUnauthorized NOT PRESENT
};
```

```typescript
// App.tsx — AuthContext.Provider (NOT passing onUnauthorized from auth)
<AuthContext.Provider value={{
  user,
  signOut: auth.signOut,
  updateUser: auth.updateUser,
  // ...
  // ← auth.onUnauthorized NOT PASSED
}}>
```

**Impact:** These consumers use `useAuthContext()` and have NO way to get `onUnauthorized`:
- `AppShell.tsx` → calls `getNotifications()` (notificationsApi)
- `ChatScreen.tsx` → calls `sendMessage()`, `listSessions()`, etc. (coachingApi)
- `ChatRoutes.tsx` → calls `getProfile()`, `listSessions()`
- `RootResolver.tsx` → calls `getProfileStatus()`, `getProfile()`
- `SettingsScreen.tsx` → calls `getPersonas()`, direct `apiRequest` for claim-handle
- `OnboardingRoutes.tsx` → calls `getProfileStatus()`, `triggerCategorization()`, direct `apiRequest`
- `ProfileScreen.tsx` → calls `getProfile()`, `getProfileStatus()` (12 calls)
- `ContentAdminPage.tsx` → adminContentApi consumers
- `FilesTab.tsx`, `AdminInspectorDrawer.tsx` → ingestionFilesApi consumers

**Required fix (prerequisite to all else):**
1. Add `onUnauthorized: () => Promise<string | null>` to `AuthContextValue`
2. Pass `auth.onUnauthorized` in `App.tsx`'s `<AuthContext.Provider value={{...}}>`

This unblocks all consumers to call `useAuthContext()` and get `onUnauthorized`.

---

## 4. Token-Access Patterns by Module

Different modules access tokens in different ways — the factory signature varies:

### Pattern A: Token passed as argument (caller holds token)
- `profile-api.ts` — most functions take `token: string` as explicit param
- `ingestionFilesApi.ts` — all functions take `token: string` as explicit param
- `ingestion/api.ts` — all functions take `token: string` as explicit param

**Factory pattern for A:**
```typescript
export function createProfileApi(onUnauthorized?: () => Promise<string | null>) {
  return {
    getProfile: (token: string) => apiRequest(API_BASE, "/profile", { token, onUnauthorized }),
    // ...
  }
}
```
Callers still pass `token` explicitly. Factory only adds `onUnauthorized`.

### Pattern B: Token read internally via `requireToken()` / `readAccessToken()`
- `adminContentApi.ts` — `requireToken()` helper called inside each function
- `adminMerchantApi.ts` — `requireToken()` helper  
- `notificationsApi.ts` — `requireToken()` helper
- `messagesApi.ts` — `requireToken()` helper

**Factory pattern for B:**
```typescript
export function createAdminContentApi(onUnauthorized?: () => Promise<string | null>) {
  function req<T>(path: string, opts = {}) {
    return apiRequest<T>(API_BASE, path, { ...opts, token: requireToken(), onUnauthorized })
  }
  return {
    listAdminContent: (params?) => req("/admin/content", { ... }),
    // ...
  }
}
```
Internal `requireToken()` still used. Factory adds `onUnauthorized`.

### Pattern C: Mixed (some functions use token arg, some use readAccessToken internally)
- `coachingApi.ts` — most use `requireToken()` internally; some (`sendMessage`) take token as param but also use `requireToken()` fallback

**Recommendation:** Homogenize to `requireToken()` internally within the factory.

---

## 5. Component Direct Calls — Updated Scope

**DebugScreen is already fixed** — it already calls `useAuth()` directly and passes `onUnauthorized`:
```typescript
// senso/src/features/debug/DebugScreen.tsx — ALREADY CORRECT
const { onUnauthorized, user } = useAuth()
// ...
{ method, token: readAccessToken() ?? "", onUnauthorized }
```

**Remaining 3 component direct calls needing factory migration:**

1. **`SettingsScreen.tsx` ~line 172** — Dynamic import of `apiRequest` for `/admin/claim-handle`:
   ```typescript
   const { apiRequest } = await import("@/lib/api-client")  // no onUnauthorized
   ```
   → Migrate to `createAdminMerchantApi` (or a new `createAdminHandleApi`) factory.

2. **`AdminHandleGateModal.tsx` ~line 37** — Same pattern, same endpoint:
   ```typescript
   const { apiRequest } = await import("@/lib/api-client")  // no onUnauthorized
   ```
   → Same factory.

3. **`OnboardingRoutes.tsx` ~line 166** — `apiRequest` for `/ingestion/confirm-all`:
   ```typescript
   await apiRequest(API_BASE, "/ingestion/confirm-all", { method: "POST", token })  // no onUnauthorized
   ```
   → Add to `createIngestionApi` factory from `ingestion/api.ts`.

**Note:** The `/admin/claim-handle` endpoint doesn't currently exist in `adminMerchantApi.ts`.
It may need to be added to `adminMerchantApi` or a dedicated `adminHandleApi` module.
Check `adminMerchantApi.ts` exports before deciding.

---

## 6. Additional Consumers Needing Factory Instantiation

Beyond the CONTEXT.md list, research found these additional consumers:

| Consumer | Module | Notes |
|----------|--------|-------|
| `senso/src/routes/ChatRoutes.tsx` | profile-api, coachingApi | uses `useAuthContext()` |
| `senso/src/routes/RootResolver.tsx` | profile-api | uses `useAuthContext()` |
| `senso/src/components/AppShell.tsx` | notificationsApi | uses `useAuthContext()` |
| `senso/src/features/profile/FilesTab.tsx` | ingestionFilesApi | no auth context at all |
| `senso/src/features/profile/AdminInspectorDrawer.tsx` | ingestionFilesApi | no auth context at all |

---

## 7. Test Infrastructure

**Test framework:** `vite-plus/test` (Vitest-compatible API — `describe`, `it`, `vi`, `expect`)
**Environment:** `jsdom` (vitest.config.ts)
**Setup file:** `senso/src/test/setup.ts` — localStorage mock + `beforeEach` clear

**Existing fetch mock pattern** (from `auth-session.test.ts`):
```typescript
vi.mock("@/lib/config", () => ({
  getBackendBaseUrl: () => "http://localhost:8000",
}));

vi.spyOn(globalThis, "fetch").mockResolvedValueOnce(
  new Response(JSON.stringify({ detail: "expired" }), { status: 401 })
)
```

**Target test pattern for each module factory:**
```typescript
// e.g., profile-api.test.ts
describe("createProfileApi — onUnauthorized wiring", () => {
  beforeEach(() => vi.restoreAllMocks())

  it("on 401, calls onUnauthorized and retries", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue("new-token")
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))
      .mockResolvedValueOnce(new Response(JSON.stringify({ /* valid data */ }), { status: 200 }))

    const api = createProfileApi(onUnauthorized)
    await api.getProfile("old-token")

    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })

  it("calls onUnauthorized with null when refresh fails, throws", async () => {
    const onUnauthorized = vi.fn().mockResolvedValue(null)
    vi.spyOn(globalThis, "fetch")
      .mockResolvedValueOnce(new Response(JSON.stringify({}), { status: 401 }))

    const api = createProfileApi(onUnauthorized)
    await expect(api.getProfile("bad-token")).rejects.toThrow()
    expect(onUnauthorized).toHaveBeenCalledTimes(1)
  })
})
```

---

## 8. `session.ts` — Exclusion Verified

Confirmed exclusion scope (auth-primitive calls that must NOT get `onUnauthorized`):
- `signup()` → `POST /auth/signup` — no token, no onUnauthorized
- `login()` → `POST /auth/login` — no token, no onUnauthorized  
- `refresh()` → `POST /auth/refresh` — already has comment about no infinite loops
- `getMe()` → `GET /auth/me` — token from arg, no onUnauthorized
- `updateMe()` → `PATCH /auth/me` — token from arg, no onUnauthorized
- `startGoogle()` → `GET /auth/google/start` — public, no token
- `signout()` → `POST /auth/logout` — best-effort, clear local regardless

All session.ts calls already lack onUnauthorized. Adding explicit comments (`/* no onUnauthorized — auth primitive */`) to `refresh()` and `getMe()` is the only change needed here.

---

## 9. `useAuth.ts` — `pollMessages` Wrapping

`useAuth.ts` calls `pollMessages()` directly (from `messagesApi`):
```typescript
import { pollMessages, type PolledMessageDTO } from "@/features/messages/messagesApi"
// ...
pollMessages()  // line ~161
```

`pollMessages` will need `onUnauthorized` via the factory. Since `useAuth.ts` already has `onUnauthorized` defined (it creates it), the fix is:
```typescript
const messagesApi = useMemo(() => createMessagesApi(onUnauthorized), [onUnauthorized])
// ...
messagesApi.pollMessages()
```

This is a consumer outside the CONTEXT.md list that must be addressed.

---

## Validation Architecture

### Test coverage requirements (Dimension 8):
- **8 module factories** each need at minimum: 
  - ✓ 401 → `onUnauthorized` called → retry succeeds
  - ✓ 401 → `onUnauthorized` returns null → throws
- **`AuthContext` extension**: Type test or compile-check that `onUnauthorized` is present
- **Component migration** (`SettingsScreen`, `AdminHandleGateModal`, `OnboardingRoutes`): Unit test using factory mocks confirming no raw `apiRequest` import

### Commands to verify:
```bash
# Run all new tests
docker compose run --rm frontend pnpm test -- --reporter=verbose 2>&1 | grep -E "PASS|FAIL|onUnauthorized"

# Verify no raw apiRequest in component direct calls
grep -n "import.*apiRequest" senso/src/features/settings/SettingsScreen.tsx senso/src/components/AdminHandleGateModal.tsx senso/src/routes/OnboardingRoutes.tsx
# Expected: no output (all migrated to factories)

# Verify session.ts exclusion comments
grep -n "no onUnauthorized" senso/src/features/auth/session.ts
# Expected: at least 2 matches (refresh + getMe)

# TypeScript compile check
docker compose run --rm frontend pnpm tsc --noEmit
```

---

## RESEARCH COMPLETE

**Key findings not in CONTEXT.md:**

1. `AuthContext` must be extended with `onUnauthorized` before factory consumers work (blocking prerequisite)
2. `DebugScreen` is already fixed — scope is 3 component calls, not 4
3. `sendMessageStream` uses native `fetch` for SSE — explicitly out of scope
4. `useAuth.ts` itself calls `pollMessages()` and needs factory wiring
5. `RootResolver.tsx` and `ChatRoutes.tsx` also call profile-api without `onUnauthorized`
6. `FilesTab.tsx` and `AdminInspectorDrawer.tsx` use `ingestionFilesApi` and have no auth context hook at all — factory token must come from props
7. Test pattern: `vite-plus/test` + `vi.spyOn(globalThis, "fetch")` is the established mock approach
