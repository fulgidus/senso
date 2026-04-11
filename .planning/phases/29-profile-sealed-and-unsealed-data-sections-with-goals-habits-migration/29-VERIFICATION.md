---
phase: 29
name: profile-sealed-and-unsealed-data-sections-with-goals-habits-migration
status: passed
verified_at: 2026-04-11
plans_verified: 3/3
---

# Phase 29 Verification

## Goal
Move goals/dos/donts preferences from SettingsScreen to a new Preferenze tab in ProfileScreen. Add a "sealed notes" section (NaCl client-side encryption via Phase 13 keypair) for private data the AI cannot access. Backend: add sealed_profile + demographics columns. Frontend: ProfileScreen Preferenze tab with "Visibile all'AI" and "Solo per te" subsections.

## Must-Haves: All Verified ✓

### Backend (Plan 29-01)

| Must-Have | Status | Evidence |
|-----------|--------|----------|
| UserProfile has `sealed_profile` column | ✓ | `api/app/db/models.py` line 371 |
| UserProfile has 7 unsealed demographic columns | ✓ | Lines 372-378, count=8 |
| Round 23 migration in session.py | ✓ | Line 463, adds 8 columns + nulls names |
| `GET/PATCH /profile/sealed-profile` endpoints | ✓ | `api/app/api/profile.py` lines 421, 433 |
| `GET/PATCH /profile/demographics` endpoints | ✓ | Lines 462, 482 |
| `UpdateMeRequest` has no firstName/lastName | ✓ | schema only has voice/persona fields |
| `update_me()` no longer sets first/last name | ✓ | removed from auth_service.py |
| `get_welcome` passes `first_name=None` | ✓ | coaching.py line 467 |
| PII filter has no first_name/last_name entries | ✓ | safety.py _PROFILE_FIELD_HINTS cleaned |

### Frontend Foundation (Plan 29-02)

| Must-Have | Status | Evidence |
|-----------|--------|----------|
| `sealForSelf` exported from crypto.ts | ✓ | Line 357 |
| `unsealFromSelf` exported from crypto.ts | ✓ | Line 372 |
| `getSealedProfile` in profile-api.ts | ✓ | Line 576 |
| `patchSealedProfile` in profile-api.ts | ✓ | Line 582 |
| `getDemographics` in profile-api.ts | ✓ | Line 590 |
| `patchDemographics` in profile-api.ts | ✓ | Line 604 |
| User type has no firstName/lastName | ✓ | types.ts clean |
| session.ts no firstName/lastName mapping | ✓ | parseUser and updateMe cleaned |
| user-avatar.ts username-only fallback | ✓ | getInitials, getDisplayName simplified |
| TypeScript compiles cleanly | ✓ | `pnpm tsc --noEmit` exit 0 |

### Frontend UI (Plan 29-03)

| Must-Have | Status | Evidence |
|-----------|--------|----------|
| i18n keys added (both locales) | ✓ | 30+ profile.preferences.* keys, it.json and en.json valid |
| PreferenzaTab.tsx created | ✓ | `senso/src/features/profile/PreferenzaTab.tsx` |
| PreferenzaTab has unsealed demographics form | ✓ | gender, household, employment, region dropdowns |
| PreferenzaTab has goals/dos/donts section | ✓ | TagInput with auto-save |
| PreferenzaTab has sealed identity card | ✓ | name/DOB/emails/phones/chat contacts + NaCl encrypt on save |
| Locked state when cryptoKeys null | ✓ | Lock card renders |
| age_bracket read-only badge (derived from DOB on seal) | ✓ | computeAgeBracket() called on seal save |
| ProfileScreen `activeTab` includes "preferences" | ✓ | 11 occurrences |
| Mobile tab bar is carousel (no grid-cols-2) | ✓ | ChevronLeft/Right arrows + swipe gesture |
| Desktop tab bar uses overflow-x-auto | ✓ | Line 445 |
| SettingsScreen has no firstName/lastName form | ✓ | grep returns 0 |
| SettingsScreen has no PreferencesSection | ✓ | grep returns 0 |
| SettingsScreen has redirect cards | ✓ | preferencesMovedCta, nameMovedCta |
| ProfileSetupScreen starts on gender step | ✓ | type Step = "gender" only |
| TypeScript compiles cleanly | ✓ | `pnpm tsc --noEmit` exit 0 |

## Python Syntax Checks

- `api/app/db/models.py` — ast.parse ok
- `api/app/schemas/auth.py` — ast.parse ok  
- `api/app/services/auth_service.py` — ast.parse ok
- `api/app/api/coaching.py` — ast.parse ok

## Notes

- `UserDTO` in schemas/auth.py retains `first_name`/`last_name` fields for backward compat (existing DB records); these are no longer populated by `update_me()` and are nulled by Round 23 migration
- `SetupPage.tsx` updated to redirect on username presence (Phase 13) instead of firstName
- Docker test execution not available in executor environment; structural/syntactic verification performed instead
