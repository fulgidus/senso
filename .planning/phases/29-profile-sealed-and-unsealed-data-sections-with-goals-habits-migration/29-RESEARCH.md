# Phase 29 Research: Profile Sealed and Unsealed Data Sections

**Date:** 2026-04-11
**Researcher:** Direct codebase analysis
**Status:** RESEARCH COMPLETE

---

## Executive Summary

Phase 29 is a well-scoped feature split into three independent workstreams:
1. **Backend DB + API** — add `sealed_notes TEXT` column + 2 new endpoints
2. **Frontend crypto** — add sealed-box helper functions to crypto.ts
3. **Frontend UI** — ProfileScreen carousel tab bar + new PreferenzaTab + SettingsScreen redirect

All implementation decisions are locked in CONTEXT.md. Key surprises discovered in research:
- **Crypto gap**: `crypto.ts` has `encryptForRecipient` (X25519 DH box) but NOT `crypto_box_seal` (anonymous sealed-box). New helpers must be added.
- **Key availability**: X25519 public key is on `user.publicKeyB64` (User object), private key is in `cryptoKeys.x25519PrivateKey` (CryptoKeyMaterial). Gate sealed section on both `user.publicKeyB64 !== null && cryptoKeys !== null`.
- **Mobile tab bar**: Currently a 2-column grid (`sm:hidden grid grid-cols-2`), not a flex row. The carousel replaces this entire block.
- **Session migration Round**: Last round is Round 22 (Phase 27). New `sealed_notes` goes into Round 23.
- **get_user_preferences already safe**: Returns only `{goals, dos, donts}` — sealed_notes auto-excluded from AI context (D-04 satisfied by omission).
- **SettingsScreen PreferencesSection**: Self-contained component at lines 63–113 using `readAccessToken()` + fetch() directly — does NOT use `createProfileApi`. Replace entirely with redirect card.

---

## Workstream 1: Backend

### 1.1 DB Model (api/app/db/models.py)

**Current UserProfile model ends at:**
```python
# User financial preferences (Phase 20) — lines 366–369
goals: list = Column(JSON, nullable=False, default=list)
dos: list = Column(JSON, nullable=False, default=list)
donts: list = Column(JSON, nullable=False, default=list)
```

**Addition required** (after `donts`):
```python
# Sealed notes (Phase 29) — NaCl sealed-box ciphertext; AI cannot access
sealed_notes: str | None = Column(Text, nullable=True, default=None)
```

Must also add `Text` to SQLAlchemy imports if not already present (check existing `Column(Text, ...)` usages - `Text` is already used in models.py for other columns).

### 1.2 Session Migration (api/app/db/session.py)

**Current last round:** Round 22 (Phase 27) at line 465.

**Add Round 23 block** inside the `migrations` list (before the `with engine.begin() as conn:` loop):
```python
# ── Round 23: Phase 29 - sealed notes column ───────────────────────────────
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sealed_notes TEXT",
```

Plain SQL string, no DO$$ block needed (TEXT column with no FK/index).

### 1.3 Profile API (api/app/api/profile.py)

**Existing pattern** (Phase 20, lines 365–413): `PreferencesBody` Pydantic model + `@router.get` + `@router.patch`. Follow exact same pattern.

**New model + 2 endpoints to add** after line 413:
```python
# ── Phase 29: Sealed notes ────────────────────────────────────────────────────

class SealedNotesBody(BaseModel):
    ciphertext: str | None = None  # base64 NaCl sealed-box ciphertext; None = clear

@router.get("/profile/sealed-notes", tags=["profile"])
def get_sealed_notes(
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.db.models import UserProfile  # noqa: PLC0415
    profile = db.query(UserProfile).filter_by(user_id=current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"ciphertext": getattr(profile, "sealed_notes", None)}

@router.patch("/profile/sealed-notes", tags=["profile"])
def patch_sealed_notes(
    body: SealedNotesBody,
    current_user: UserDTO = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    from app.db.models import UserProfile  # noqa: PLC0415
    from datetime import datetime, UTC as _UTC  # noqa: PLC0415
    profile = db.query(UserProfile).filter_by(user_id=current_user.id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    profile.sealed_notes = body.ciphertext
    profile.updated_at = datetime.now(_UTC)
    db.commit()
    return {"ciphertext": profile.sealed_notes}
```

### 1.4 get_user_preferences — Already Safe

`api/app/coaching/service.py` line 797–811: returns only `{goals, dos, donts}`. The `sealed_notes` column will never appear in this dict. D-04 is satisfied without any code change.

---

## Workstream 2: Frontend Crypto

### 2.1 Current State of crypto.ts

`encryptForRecipient` uses `sodium.crypto_box_easy` with an **ephemeral keypair** (X25519 DH). This is NOT anonymous sealed-box.

**For sealed notes we need `sodium.crypto_box_seal` / `sodium.crypto_box_seal_open`** — the anonymous variant where the sender is the recipient (self-encryption).

### 2.2 Key Material Available for Sealed Notes

From `AuthContext` via `useAuthContext()`:
- `user.publicKeyB64: string | null` — user's X25519 public key (base64), from `User` type (types.ts line 15)
- `cryptoKeys: CryptoKeyMaterial | null` — unlocked after login; contains `x25519PrivateKey: Uint8Array`

**Gate condition**: `user.publicKeyB64 !== null && cryptoKeys !== null`

### 2.3 New Helpers to Add to crypto.ts

Add two functions after the existing `decryptFromSender` export:

```typescript
// ── Sealed-box for self-encryption (sealed notes, Phase 29) ──────────────────

/**
 * Encrypt plaintext for self using NaCl anonymous sealed-box.
 * Only the user can decrypt (requires their private key).
 * Returns base64-encoded ciphertext.
 *
 * @param plaintext - UTF-8 string to encrypt
 * @param userPublicKeyB64 - user's X25519 public key (base64) from user.publicKeyB64
 */
export function sealForSelf(plaintext: string, userPublicKeyB64: string): string {
    const publicKey = base64ToBytes(userPublicKeyB64);
    const message = sodium.from_string(plaintext);
    const ciphertext = sodium.crypto_box_seal(message, publicKey);
    return bytesToBase64(ciphertext);
}

/**
 * Decrypt a sealed-box ciphertext using the user's private key.
 * Returns null if decryption fails (wrong key or tampered data).
 *
 * @param ciphertextB64 - base64-encoded sealed-box ciphertext
 * @param userPublicKeyB64 - user's X25519 public key (base64) from user.publicKeyB64
 * @param privateKey - user's X25519 private key (32 bytes) from cryptoKeys.x25519PrivateKey
 */
export function unsealFromSelf(
    ciphertextB64: string,
    userPublicKeyB64: string,
    privateKey: Uint8Array,
): string | null {
    try {
        const ciphertext = base64ToBytes(ciphertextB64);
        const publicKey = base64ToBytes(userPublicKeyB64);
        const plaintext = sodium.crypto_box_seal_open(ciphertext, publicKey, privateKey);
        if (!plaintext) return null;
        return sodium.to_string(plaintext);
    } catch {
        return null;
    }
}
```

**Libsodium function availability**: `sodium.crypto_box_seal` and `sodium.crypto_box_seal_open` are part of standard `libsodium-wrappers`. The existing import `import sodium from "libsodium-wrappers"` already provides them. `sodium.from_string` and `sodium.to_string` are also standard libsodium-wrappers utilities (confirmed by existing use of `sodium.from_string`-equivalent via `nacl.from_string` in the CONTEXT.md snippet — use `sodium.from_string` to match the actual import alias in crypto.ts).

---

## Workstream 3: Frontend UI

### 3.1 ProfileScreen Tab Bar — Current Structure

**Mobile (sm:hidden)**: `grid grid-cols-2 gap-1 mb-4` with 5 buttons (3+2 layout). Timeline button has a notification badge dot. **This entire block must be replaced** with the carousel.

**Desktop (hidden sm:flex)**: `hidden sm:flex mb-6 gap-2 flex-wrap` with 5 pill buttons. Timeline button has notification badge. **This block must be replaced** with scrollable strip (`overflow-x-auto`).

**Both blocks** must gain the 6th "preferences" tab.

### 3.2 New activeTab Type

```typescript
// Before:
const [activeTab, setActiveTab] = useState<"summary" | "charts" | "timeline" | "files" | "connectors">("summary")

// After:
const [activeTab, setActiveTab] = useState<"summary" | "charts" | "timeline" | "files" | "connectors" | "preferences">("summary")
```

### 3.3 Location Routing Support

The UI-SPEC specifies the SettingsScreen redirect uses `<Link to="/profile" state={{ tab: "preferences" }}>`. ProfileScreen must read this location state on mount:

```typescript
import { useLocation } from "react-router-dom"
// In component:
const location = useLocation()
useEffect(() => {
    const state = location.state as { tab?: string } | null
    if (state?.tab === "preferences") {
        setActiveTab("preferences")
    }
}, [])
```

### 3.4 Touch Swipe State

Carousel needs touch tracking at the ProfileScreen level (wrapping the mobile tab bar):
```typescript
const [touchStartX, setTouchStartX] = useState<number | null>(null)
```

### 3.5 PreferenzaTab Component — New File

`senso/src/features/profile/PreferenzaTab.tsx` — new file. Contains:
- `UnsealedPreferencesSection` (lifted from SettingsScreen, adapted to use `createProfileApi` pattern instead of raw fetch + `readAccessToken()`)
- `SealedNotesSection` (new, auto-save on blur, locked state if no cryptoKeys)
- Both sections as `<section>` cards inside the tab

**Key difference from SettingsScreen**: Use `createProfileApi(onUnauthorized)` pattern from AuthContext, not raw `fetch` + `readAccessToken()`. Profile already uses this pattern.

### 3.6 profile-api.ts — New Methods

Add to the `createProfileApi` factory (follow existing pattern):

```typescript
getSealedNotes: (token: string) =>
    apiRequest<{ ciphertext: string | null }>(API_BASE, "/profile/sealed-notes", {
        token,
        onUnauthorized,
    }),

patchSealedNotes: (token: string, ciphertext: string | null) =>
    apiRequest<{ ciphertext: string | null }>(API_BASE, "/profile/sealed-notes", {
        method: "PATCH",
        token,
        body: { ciphertext },
        onUnauthorized,
    }),
```

Also update the `UserProfile` type (or keep it separate — `sealed_notes` is NOT part of `UserProfile` as the profile endpoint doesn't expose it; use the dedicated sealed-notes endpoints).

### 3.7 SettingsScreen Redirect Card

Replace the `<PreferencesSection />` JSX call in `SettingsScreen.tsx` with the redirect card from UI-SPEC. The `TagInput`, `PreferencesSection` function, and related state variables (`goals`, `dos`, `donts`, `loaded`, `saved`) in `SettingsScreen.tsx` become unused and should be removed.

**Import additions needed**: `ArrowRight` from lucide-react (check if already imported — `Shield`, `AtSign`, `Target` are already there; `ArrowRight` is new). `Link` is already imported from `react-router-dom`.

### 3.8 i18n File Structure

i18n files use **nested objects**, not flat keys:
```json
{
  "profile": { "heading": "...", ... },
  "settings": { "title": "...", ... },
  "preferences": { "sectionTitle": "...", ... }
}
```

New keys for Phase 29 are added **inside** the `"profile"` and `"settings"` top-level objects:
- `profile.preferences.tabLabel`, `profile.preferences.unsealedHeading`, etc. → added inside `"profile": { "preferences": { ... } }`
- `profile.tabs.prev`, `profile.tabs.next` → added inside `"profile": { "tabs": { ... } }`
- `settings.preferencesMovedBody`, `settings.preferencesMovedCta` → added inside `"settings": { ... }`

---

## Validation Architecture

### Unit-level
- Backend: `GET /profile/sealed-notes` returns `{ciphertext: null}` for new users; `PATCH` stores and returns the value
- Backend: `GET /profile/preferences` still returns `{goals, dos, donts}` (no `sealed_notes`)
- Frontend: `sealForSelf` + `unsealFromSelf` roundtrip test — seal then unseal returns original string

### Integration-level
- ProfileScreen renders "Preferenze" tab button on desktop + carousel
- PreferenzaTab shows UnsealedPreferencesSection (data loads from `/api/profile/preferences`) and SealedNotesSection
- Sealed notes: type → blur → PATCH fires → "Salvato 🔒" indicator appears → backend stores ciphertext
- Decrypt on load: `GET /profile/sealed-notes` → decrypt → textarea shows plaintext
- Locked state: if `cryptoKeys === null`, sealed section shows lock card (no textarea)
- SettingsScreen: redirect card visible, no TagInput editors, clicking link navigates to ProfileScreen#preferences tab

### Regression
- Existing ProfileScreen tabs (summary, charts, timeline, files, connectors) still render correctly after tab type expansion
- `get_user_preferences` tool still returns only `{goals, dos, donts}` (no `sealed_notes`)

---

## File Change Map

| File | Change Type | What |
|------|-------------|------|
| `api/app/db/models.py` | Modify | Add `sealed_notes: str \| None = Column(Text, nullable=True, default=None)` |
| `api/app/db/session.py` | Modify | Add Round 23: `ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sealed_notes TEXT` |
| `api/app/api/profile.py` | Modify | Add `SealedNotesBody` + `GET/PATCH /profile/sealed-notes` endpoints |
| `senso/src/features/messages/crypto.ts` | Modify | Add `sealForSelf` + `unsealFromSelf` exports |
| `senso/src/lib/profile-api.ts` | Modify | Add `getSealedNotes` + `patchSealedNotes` to `createProfileApi` factory |
| `senso/src/features/profile/ProfileScreen.tsx` | Modify | Expand `activeTab` type; replace mobile grid + desktop flex with carousel/scrollable; add preferences tab render; add location.state routing; add touch handlers |
| `senso/src/features/profile/PreferenzaTab.tsx` | New | UnsealedPreferencesSection + SealedNotesSection |
| `senso/src/features/settings/SettingsScreen.tsx` | Modify | Replace `<PreferencesSection />` with redirect card; remove unused state + TagInput + PreferencesSection function |
| `senso/src/i18n/locales/it.json` | Modify | Add profile.preferences.*, profile.tabs.*, settings.preferencesMovedBody/Cta |
| `senso/src/i18n/locales/en.json` | Modify | Mirror same keys in English |

---

## Risk Register

| Risk | Severity | Mitigation |
|------|----------|------------|
| `crypto_box_seal` not available in libsodium-wrappers | LOW | Standard libsodium function; already imported as `sodium`; confirmed in libsodium-wrappers docs |
| AuthContext `user.publicKeyB64` is null for users who haven't derived keys | MEDIUM | Locked state already specified in D-09/UI-SPEC; gate sealed section on `cryptoKeys !== null && user.publicKeyB64 != null` |
| Mobile carousel touch handler conflicts with pull-to-refresh | LOW | Pull-to-refresh uses vertical drag (`deltaY > 50`); carousel uses horizontal delta (`> 40px`); directions orthogonal |
| ProfileScreen location.state not read on mount | LOW | Add `useLocation()` + `useEffect` on mount; only runs once |
| Unsealed section in PreferenzaTab: save triggers on every chip change | INFO | Match existing SettingsScreen behavior (save on each onChange); no debounce needed |
| backend `Text` import in models.py | LOW | `Text` is used in other models (confirmed by existing `TEXT` column types); import already present |

---

## ## RESEARCH COMPLETE

All implementation targets identified. No blockers. Proceed to planning.
