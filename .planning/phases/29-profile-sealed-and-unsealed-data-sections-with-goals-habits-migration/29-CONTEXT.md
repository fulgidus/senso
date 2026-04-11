# Phase 29: Profile sealed and unsealed data sections with goals/habits migration - Context

**Gathered:** 2026-04-11
**Status:** Ready for planning

<domain>
## Phase Boundary

Reorganize user profile data into two visibility tiers and move coaching preferences (goals/dos/donts) from SettingsScreen to ProfileScreen:

1. **Unsealed section** — data visible to the AI coach. Currently: `goals`, `dos`, `donts` in `user_profiles` (already fed to the coach via `get_user_preferences` tool). These should appear under a dedicated "Preferenze finanziarie" section in ProfileScreen.

2. **Sealed section** — private notes that are NaCl-encrypted client-side before storage; the backend stores only the ciphertext; the AI coach CANNOT access them. This section is new. Users can store personal notes they don't want the AI to see (e.g. health situations affecting finances, family circumstances, sensitive purchase motivations).

The key user-facing change is:
- Remove the preferences section from SettingsScreen (or keep a shortcut link to Profile).
- Add a new "Preferenze" tab to ProfileScreen with two subsections: "Visibile all'AI" (unsealed) and "Solo per te" (sealed).

</domain>

<decisions>
## Implementation Decisions

### Data model

#### Unsealed (existing, no change)
- **D-01:** `goals`, `dos`, `donts` in `user_profiles` — remain plaintext JSON in DB. AI coach accesses via `get_user_preferences` tool. No migration of values needed, only UI relocation.

#### Sealed (new)
- **D-02:** Add a single `sealed_notes: str | None` column to `user_profiles` for the encrypted blob. This is a base64 NaCl sealed-box ciphertext (client encrypts with own public key, only client can decrypt).
- **D-03:** The backend stores and returns the ciphertext opaquely — no JSON interpretation. The encrypted field is included in `GET /profile` response and updateable via `PATCH /profile/sealed-notes`.
- **D-04:** The AI coach MUST NOT receive `sealed_notes` in any tool call or context block. Explicitly excluded from the `get_user_preferences` tool response.

### Frontend UI location
- **D-05:** Add a "Preferenze" tab to ProfileScreen. This adds a 6th tab to the existing 5-tab bar (summary, charts, timeline, files, connectors).
- **D-06:** The SettingsScreen preferences section is removed (or replaced with a "→ Gestisci in Profilo" link). Agent has discretion on whether to remove entirely or add a redirect.
- **D-07:** In the Preferenze tab, two visual subsections:
  - "👁 Visibile all'AI" (unsealed): TagInput editors for goals, dos, donts (same UX as current SettingsScreen)
  - "🔒 Solo per te" (sealed): a free-text notes textarea; auto-saves on blur (encrypt → PATCH immediately when focus leaves the textarea)

### Tab bar layout (updated 2026-04-11)
- **D-12:** **Desktop** — horizontally scrollable tab strip. All 6 tabs accessible via scroll; no tabs are hidden.
- **D-13:** **Mobile** — carousel-style tab selector. Current tab is centered and fully visible; adjacent tabs peek in on left and right (showing partial label text as affordance). Navigation: explicit `[<]` / `[>]` arrow buttons AND swipe gesture (both work). This replaces the current full-width flat tab bar on mobile.

### Sealed notes save behavior (updated 2026-04-11)
- **D-14:** Sealed notes auto-save on blur. When the user's focus leaves the sealed textarea: encrypt with the user's public key → PATCH `/profile/sealed-notes` immediately. No explicit Save button required.

### Encryption for sealed notes
- **D-08:** Use the existing libsodium `sealedBox` (X25519 anonymous encryption) from Phase 13/15. Client-side: `nacl.box.keyPair()` already stored in `AuthContext`. Encrypt with user's own public key (`nacl.crypto_box_seal(message, publicKey)`).
- **D-09:** The sealed notes are decrypted on load using the private key from `AuthContext`. If the key is unavailable (key not yet initialized), the sealed section shows a locked state with a prompt to re-authenticate.
- **D-10:** No search/indexing of sealed notes. They are display-only on the client.

### Migration
- **D-11:** `sealed_notes` column added via `_add_missing_columns()` in `session.py` (existing migration pattern — no Alembic).

### Agent's Discretion
- Exact tab name and icon for the Preferenze tab
- Error handling when libsodium is not yet initialized (e.g. first load before key derivation completes)
- Whether SettingsScreen shows a redirect link or removes the preferences section entirely

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Source files requiring changes
- `senso/src/features/settings/SettingsScreen.tsx` — preferences section at line ~63–113; remove or replace with link
- `senso/src/features/profile/ProfileScreen.tsx` — add Preferenze tab; implement carousel tab bar for mobile (D-12/D-13); current `activeTab` type is `"summary" | "charts" | "timeline" | "files" | "connectors"`
- `api/app/db/models.py` — `UserProfile` model; add `sealed_notes` column after `donts`
- `api/app/db/session.py` — `_add_missing_columns()` pattern; add `sealed_notes` migration
- `api/app/api/profile.py` — existing `GET /profile/preferences`, `PATCH /profile/preferences`; add `GET/PATCH /profile/sealed-notes`
- `senso/src/lib/profile-api.ts` — add `getSealedNotes` and `patchSealedNotes` API functions

### Crypto reference
- `senso/src/features/messages/crypto.ts` — existing libsodium helpers from Phase 15; reuse `seal`/`unseal` patterns; check available exports before adding new primitives
- `senso/src/features/auth/AuthContext.tsx` — `keyPair` available in context after libsodium init; gate sealed section on key availability

### i18n
- `senso/src/i18n/locales/it.json` — existing keys under `preferences.*`; add new keys under `profile.preferences` and `profile.sealed`
- `senso/src/i18n/locales/en.json` — mirror

</canonical_refs>

<code_context>
## Existing Code Insights

### UserProfile model (unsealed fields already exist)
```python
# api/app/db/models.py
goals: list = Column(JSON, nullable=False, default=list)
dos: list = Column(JSON, nullable=False, default=list)
donts: list = Column(JSON, nullable=False, default=list)
# Add:
sealed_notes: str | None = Column(Text, nullable=True, default=None)  # NaCl sealed-box ciphertext
```

### Session migration pattern
```python
# api/app/db/session.py _add_missing_columns():
("user_profiles", "sealed_notes", "TEXT", None),
```

### Current preferences UI in SettingsScreen (to be migrated)
```tsx
// Lines 63–113: goals/dos/donts TagInput editors + save()
// These move to ProfileScreen Preferenze tab, same logic
```

### Current ProfileScreen tab bar
```tsx
// activeTab: "summary" | "charts" | "timeline" | "files" | "connectors"
// Mobile: flat tab bar with rounded-lg px-3 py-2.5 min-h-[44px] buttons
// Desktop: rounded-full px-4 py-1.5 pill tabs
// Adding "preferences" = 6th tab; implement D-12/D-13 carousel for mobile
```

### Sealed notes encryption (client-side)
```typescript
// Encrypt on save:
import nacl from "libsodium-wrappers"
const ciphertext = nacl.crypto_box_seal(
    nacl.from_string(notes),
    userPublicKey  // from AuthContext keyPair.publicKey
)
const encoded = nacl.to_base64(ciphertext)

// Decrypt on load:
const decoded = nacl.from_base64(encoded)
const plaintext = nacl.crypto_box_seal_open(decoded, publicKey, privateKey)
const notes = nacl.to_string(plaintext)
```

### Reusable assets
- `PreferencesSection` component in `SettingsScreen.tsx` — lift and reuse in PreferenzaTab
- Existing `TagInput` component (used for goals/dos/donts chips) — no changes needed
- `usePullToRefresh` hook already imported in ProfileScreen

### Integration points
- `AuthContext` → `keyPair` for sealed encrypt/decrypt; gate on `keyPair !== null`
- `profile-api.ts` → extend with `getSealedNotes()` / `patchSealedNotes()` following existing `createProfileApi` pattern
- Backend `get_user_preferences` tool → ensure `sealed_notes` is explicitly excluded (D-04)

</code_context>

<specifics>
## Specific Ideas

- Mobile tab bar should use a carousel pattern: `[<][...prev-tab][CURRENT TAB][next-tab...][>]` — peeking tab names act as visual affordance; arrow buttons + swipe both navigate.
- Auto-save on blur for sealed notes means no explicit Save button; a brief "Salvato 🔒" toast/indicator after successful PATCH is appropriate UX feedback.

</specifics>

<deferred>
## Deferred Ideas

- Sealed notes sharing with another user (E2E-encrypted DM via Phase 15 mechanism) — deferred.
- Multiple sealed note categories — deferred; single textarea for now.
- Unsealed goals sync back to SettingsScreen (shortcut link is sufficient) — deferred.

</deferred>

---

*Phase: 29-profile-sealed-and-unsealed-data-sections-with-goals-habits-migration*
*Context gathered: 2026-04-11*
