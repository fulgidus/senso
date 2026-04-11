# Phase 29: Profile sealed and unsealed data sections with goals/habits migration - Context

**Gathered:** 2026-04-11
**Revised:** 2026-04-11 (full rewrite — two-tier data architecture)
**Status:** Ready for planning

<domain>
## Phase Boundary

Establish a two-tier profile data architecture across the entire user profile:

1. **Unsealed tier** — data visible to the AI coach and eligible for anonymous statistical sampling. Includes demographic signals (age bracket, gender identity, household profile, employment status, region) plus the existing financial coaching preferences (goals, dos, donts). Stored as plaintext columns in `user_profiles`. The AI coach can read and use all unsealed fields.

2. **Sealed tier** — PII and identity data that is NaCl-encrypted client-side before storage. The backend stores only an opaque ciphertext blob. The AI coach has zero access. Contains: first name, last name, exact date of birth, email contact list, phone contact list, chat contact handles.

Supporting changes:
- `first_name` and `last_name` are removed from active use in `users` table. Display falls back to `username` everywhere.
- `ProfileSetupScreen.tsx` name step is removed; voice gender step remains.
- SettingsScreen loses both the name editing form and the preferences section — both redirect to the new Preferenze tab in ProfileScreen.
- A new **Preferenze** tab (6th tab) is added to ProfileScreen with two subsections: "Visibile all'AI" (unsealed) and "Solo per te" (sealed).

</domain>

<decisions>
## Implementation Decisions

### Data tiers

#### Sealed tier (new) — D-02
- **D-02:** Add `sealed_profile TEXT` column to `user_profiles`. Stores a base64 NaCl sealed-box ciphertext of a JSON object with the following shape:
  ```json
  {
    "first_name": "Mario",
    "last_name": "Rossi",
    "exact_dob": "1995-03-15",
    "emails": [{"value": "mario@example.com", "label": "Personale"}],
    "phones": [{"value": "+39 333 1234567", "label": "Mobile"}],
    "chat_contacts": [{"provider": "telegram", "username": "@mario", "additional": null}]
  }
  ```
  All fields are optional (null is valid). `chat_contacts[].provider` enum: `"telegram" | "whatsapp" | "signal" | "instagram" | "facebook" | "other"`.

- **D-03:** Backend stores and returns `sealed_profile` ciphertext opaquely — no JSON interpretation. Exposed via `GET /profile/sealed-profile` and `PATCH /profile/sealed-profile {ciphertext}`.

- **D-04:** AI coach MUST NOT receive `sealed_profile` or `first_name`/`last_name` in any tool call or context block. The `get_user_preferences` tool returns only `{goals, dos, donts}`. `get_welcome` is called without a name (passes `first_name=None`).

- **D-10:** Sealed profile is display-only on the client. No indexing or search.

- **D-08:** Client-side NaCl sealed-box (anonymous X25519 encryption): `sodium.crypto_box_seal(message, userPublicKey)`. Uses X25519 public key from `user.publicKeyB64`. Decrypt with `sodium.crypto_box_seal_open(ciphertext, publicKey, privateKey)` using `cryptoKeys.x25519PrivateKey`.

- **D-09:** If `cryptoKeys === null` or `user.publicKeyB64 === null`, the sealed section shows a locked state (no form rendered). User must re-authenticate to unlock.

- **D-14 (revised):** Sealed profile saves with an **explicit "Salva" button** (multi-field form; auto-save on blur is inappropriate for structured identity data). After successful PATCH, show a 2s "Salvato 🔒" indicator. If `exact_dob` changed, client also PATCHes `/profile/demographics` with the computed `age_bracket` immediately after.

#### Unsealed tier — demographics (new columns) — D-18
- **D-18:** Add unsealed demographic columns to `user_profiles`. All nullable:
  - `age_bracket VARCHAR(10)` — auto-assigned from sealed `exact_dob`; values: `"14-16"`, `"17-18"`, `"19-20"`, `"21-25"`, `"26-30"`, `"31-35"`, `"36-40"`, `"41-50"`, `"51-60"`, `"61+"`.
  - `gender_at_birth VARCHAR(20)` — enum: `"male"`, `"female"`, `"intersex"`, `"prefer_not_to_say"`.
  - `elected_gender VARCHAR(50)` — free-text or enum: `"uomo"`, `"donna"`, `"non-binario"`, `"altro"`, `"prefer_not_to_say"`.
  - `household_size SMALLINT` — number of people including user (1–8, 9+).
  - `has_dependents BOOLEAN` — true if user has financial dependents.
  - `employment_status VARCHAR(30)` — `"employed"`, `"self_employed"`, `"student"`, `"retired"`, `"unemployed"`, `"other"`.
  - `region_of_residence VARCHAR(50)` — Italian region name (free text or enum of 20 Italian regions).

- **D-19:** When user saves the sealed profile, if `exact_dob` is present, client computes `age_bracket` client-side and PATCHes `/profile/demographics` with `{age_bracket}`. Backend never sees exact_dob.

- **D-01 (unchanged):** `goals`, `dos`, `donts` remain in `user_profiles` as unsealed JSON arrays, AI-visible. No change to their storage or the `get_user_preferences` tool.

#### Unsealed tier — demographics API — D-17
- **D-17:** Expose unsealed demographics via `GET /profile/demographics` and `PATCH /profile/demographics`. Request body accepts any subset of the 7 demographic fields. Auto-saves per field onChange in the frontend.

### Identity and display

- **D-15:** `users.first_name` and `users.last_name` are nulled (not dropped from schema — column removal requires coordination with ORM and would break existing data). No new writes to these fields. The `UpdateMeRequest` schema removes `first_name` and `last_name` fields.

- **D-16:** Display name throughout the app: `getDisplayName(user)` → username-only fallback. `getInitials(user)` → username initial fallback. `User` type in TypeScript: `firstName` and `lastName` removed. `session.ts` stops mapping them from API responses.

- **D-20:** `ProfileSetupScreen.tsx` name step removed. Voice gender step remains. Two-step flow becomes one-step.

- **D-21:** `get_welcome` in `api/app/api/coaching.py` is called without `first_name` (pass `None` or omit). Welcome message says "Ciao!" or uses the persona's default greeting.

### Migrations — D-11
- **D-11:** All column additions via `_add_missing_columns()` in `session.py` (Round 23). No Alembic. `users.first_name`/`last_name` stay in schema (nullable) but are nulled via a back-fill UPDATE in Round 23.

### Tab bar layout — D-05, D-12, D-13
- **D-05:** Add "Preferenze" tab to ProfileScreen as the 6th tab.
- **D-12:** Desktop — horizontally scrollable tab strip (`overflow-x-auto`). All 6 tabs accessible via scroll.
- **D-13:** Mobile — carousel-style tab selector. Current tab centered; adjacent tabs peek. `[<]` / `[>]` arrow buttons + swipe gesture both work.

### SettingsScreen — D-06
- **D-06:** SettingsScreen removes both:
  - Name editing form (`firstName`/`lastName` state + inputs + Save button) → replaced with text "Il tuo nome è ora nella sezione privata del tuo Profilo".
  - Preferences section (`<PreferencesSection />`) → replaced with redirect card to `/profile` with `state: { tab: "preferences" }`.

### Agent's Discretion
- Exact icons for tab and section headings
- Error handling when libsodium is not yet initialised
- Exact Italian region enum vs. free-text
- Chat contact providers beyond the listed enum (open to "other" + notes field)
- Whether ProfileSetupScreen skips name entirely or shows a brief "you can add your name in Profile → Preferenze" hint

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Backend — files requiring changes
- `api/app/db/models.py` — `UserProfile` model (add sealed_profile + 7 demographic columns); `User` model (first_name/last_name nullable, no removal)
- `api/app/db/session.py` — `_add_missing_columns()` Round 23; back-fill UPDATE to null first_name/last_name
- `api/app/schemas/auth.py` — `UserDTO` (remove first_name/last_name or keep as nullable); `UpdateMeRequest` (remove first_name/last_name)
- `api/app/services/auth_service.py` — `update_me()` method: remove first_name/last_name update logic (lines ~267–270)
- `api/app/api/profile.py` — add `GET/PATCH /profile/sealed-profile` and `GET/PATCH /profile/demographics` endpoints
- `api/app/api/coaching.py` — `get_welcome` call at line ~467: remove `first_name=current_user.first_name` (pass `None`)
- `api/app/coaching/safety.py` — remove `first_name`/`last_name` from PII safety filter dict (lines ~202–203)

### Frontend — files requiring changes
- `senso/src/features/auth/types.ts` — `User` type: remove `firstName`, `lastName` fields (or mark as always `null` and deprecated)
- `senso/src/features/auth/session.ts` — remove `firstName`/`lastName` mapping from API response; remove from `updateMe()` body type
- `senso/src/lib/user-avatar.ts` — `getInitials`/`getDisplayName`: remove firstName/lastName branches, use username-only fallback
- `senso/src/features/profile/ProfileSetupScreen.tsx` — remove name step ("name" step in step machine); voice gender step remains
- `senso/src/features/settings/SettingsScreen.tsx` — remove firstName/lastName state + form; remove `<PreferencesSection />`; add two redirect cards
- `senso/src/features/profile/ProfileScreen.tsx` — add "preferences" tab, carousel mobile tab bar, scrollable desktop strip, render `<PreferenzaTab>`
- `senso/src/lib/profile-api.ts` — add `getSealedProfile`, `patchSealedProfile`, `getDemographics`, `patchDemographics` to `createProfileApi` factory

### Frontend — new files
- `senso/src/features/profile/PreferenzaTab.tsx` — new component

### Crypto reference
- `senso/src/features/messages/crypto.ts` — add `sealForSelf(plaintext: string, publicKeyB64: string): string` and `unsealFromSelf(ciphertextB64: string, publicKeyB64: string, privateKey: Uint8Array): string | null` using `sodium.crypto_box_seal` / `sodium.crypto_box_seal_open`
- `senso/src/features/auth/AuthContext.tsx` — `cryptoKeys: CryptoKeyMaterial | null`; `user.publicKeyB64: string | null`

### i18n
- `senso/src/i18n/locales/it.json` — add keys under `profile.preferences.*`, `profile.tabs.*`, `profile.sealed.*`, `settings.*`
- `senso/src/i18n/locales/en.json` — mirror

</canonical_refs>

<code_context>
## Existing Code Insights

### UserProfile model (before this phase)
```python
# api/app/db/models.py
goals: list = Column(JSON, nullable=False, default=list)
dos: list = Column(JSON, nullable=False, default=list)
donts: list = Column(JSON, nullable=False, default=list)
# ADD:
sealed_profile: str | None = Column(Text, nullable=True, default=None)
age_bracket: str | None = Column(String(10), nullable=True, default=None)
gender_at_birth: str | None = Column(String(20), nullable=True, default=None)
elected_gender: str | None = Column(String(50), nullable=True, default=None)
household_size: int | None = Column(SmallInteger, nullable=True, default=None)
has_dependents: bool | None = Column(Boolean, nullable=True, default=None)
employment_status: str | None = Column(String(30), nullable=True, default=None)
region_of_residence: str | None = Column(String(50), nullable=True, default=None)
```

### Session Round 23 (add to migrations list, after Round 22 at line ~465)
```python
# ── Round 23: Phase 29 — two-tier profile data ───────────────────────────────
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sealed_profile TEXT",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS age_bracket VARCHAR(10)",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gender_at_birth VARCHAR(20)",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS elected_gender VARCHAR(50)",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS household_size SMALLINT",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS has_dependents BOOLEAN",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS employment_status VARCHAR(30)",
"ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS region_of_residence VARCHAR(50)",
# Null out the PII name fields in users — names now live in the sealed profile
"UPDATE users SET first_name = NULL, last_name = NULL WHERE first_name IS NOT NULL OR last_name IS NOT NULL",
```

### UpdateMeRequest (remove first_name/last_name)
```python
# api/app/schemas/auth.py
class UpdateMeRequest(BaseModel):
    # Remove: first_name, last_name
    voice_gender: VoiceGender | None = None
    voice_auto_listen: bool | None = None
    default_persona_id: str | None = None
    strict_privacy_mode: bool | None = None
```

### Profile API endpoints pattern (follow existing Phase 20 pattern in api/app/api/profile.py)
```python
class DemographicsBody(BaseModel):
    age_bracket: str | None = None
    gender_at_birth: str | None = None
    elected_gender: str | None = None
    household_size: int | None = None
    has_dependents: bool | None = None
    employment_status: str | None = None
    region_of_residence: str | None = None

@router.get("/profile/demographics")  # returns all 7 fields
@router.patch("/profile/demographics")  # updates provided fields

class SealedProfileBody(BaseModel):
    ciphertext: str | None = None

@router.get("/profile/sealed-profile")  # returns {ciphertext}
@router.patch("/profile/sealed-profile")  # stores ciphertext
```

### Crypto helpers to add to crypto.ts
```typescript
export function sealForSelf(plaintext: string, userPublicKeyB64: string): string {
    const publicKey = base64ToBytes(userPublicKeyB64);
    const message = sodium.from_string(plaintext);
    const ciphertext = sodium.crypto_box_seal(message, publicKey);
    return bytesToBase64(ciphertext);
}

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

### User type change (TypeScript)
```typescript
// Remove from User type in senso/src/features/auth/types.ts:
firstName: string | null;   // ← remove
lastName?: string | null;   // ← remove

// getDisplayName (senso/src/lib/user-avatar.ts) becomes:
export function getDisplayName(user: User): string {
    if (user.username) return stripUsernamePrefix(user.username);
    return "Utente";
}

// getInitials becomes:
export function getInitials(user: User): string {
    if (user.username) {
        const stripped = stripUsernamePrefix(user.username);
        return (stripped[0] ?? "U").toUpperCase();
    }
    if (user.email) return user.email[0].toUpperCase();
    return "U";
}
```

### ProfileSetupScreen change
```tsx
// Remove "name" step entirely.
// type Step = "name" | "gender"  → type Step = "gender"
// Component starts directly on voice gender selection.
// handleGenderSubmit no longer sends firstName/lastName to updateMe().
```

### age_bracket computation (client-side, from exact_dob)
```typescript
function computeAgeBracket(dob: string): string {
    const birth = new Date(dob);
    const age = Math.floor((Date.now() - birth.getTime()) / (365.25 * 24 * 3600 * 1000));
    if (age <= 16) return "14-16";
    if (age <= 18) return "17-18";
    if (age <= 20) return "19-20";
    if (age <= 25) return "21-25";
    if (age <= 30) return "26-30";
    if (age <= 35) return "31-35";
    if (age <= 40) return "36-40";
    if (age <= 50) return "41-50";
    if (age <= 60) return "51-60";
    return "61+";
}
```

### PreferenzaTab structure
- **UnsealedSection** ("Visibile all'AI"):
  - Demographics form: age_bracket (display-only, auto-assigned), gender_at_birth (select), elected_gender (select/text), household_size (select 1–8, 9+), has_dependents (toggle), employment_status (select), region_of_residence (select Italian regions)
  - Each field: onChange → immediate PATCH /profile/demographics
  - Goals/dos/donts: TagInput editors (same as existing SettingsScreen, same onChange→PATCH /profile/preferences logic)
- **SealedSection** ("Solo per te"):
  - first_name, last_name (text inputs)
  - exact_dob (date input, ISO YYYY-MM-DD; on change → compute and show age_bracket preview, but don't save age_bracket until "Salva" is clicked)
  - emails[] (dynamic list: add/remove rows, each with value + optional label)
  - phones[] (dynamic list: same pattern)
  - chat_contacts[] (dynamic list: provider dropdown + username text + optional notes)
  - Explicit "Salva" button at bottom → encrypt JSON → PATCH sealed-profile → if dob changed PATCH demographics age_bracket
  - Load: GET sealed-profile → decrypt → populate form
  - Locked state: if cryptoKeys null, show lock card (no form)

</code_context>

<specifics>
## Specific Ideas

- age_bracket is read-only in the unsealed section — auto-assigned from exact_dob in the sealed section; show it as a badge/chip, not an editable field.
- Chat contact providers: Telegram, WhatsApp, Signal, Instagram, Facebook, Other. "Other" shows an additional notes field.
- The emails[] and phones[] lists support multiple entries (user may have work + personal). Each entry: text input + optional label input + remove button.
- The "Salva" button for the sealed section is disabled when nothing has changed (compare form state vs. loaded decrypted state).

</specifics>

<deferred>
## Deferred Ideas

- Searching sealed profile (client-side search across decrypted data)
- Sharing sealed profile with a trusted person via E2E messaging (Phase 15 mechanism)
- Anonymous statistical sampling pipeline on unsealed demographics (backend analytics job)
- Structured employer information in sealed profile (company name, role)
- Migration wizard prompt: "You previously had a name set — move it to your private profile"

</deferred>

---

*Phase: 29-profile-sealed-and-unsealed-data-sections-with-goals-habits-migration*
*Context revised: 2026-04-11 — full two-tier architecture*
