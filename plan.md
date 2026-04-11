Three plan files have been written:

---

## Output Summary

**Plans created** in `.planning/phases/29-profile-sealed-and-unsealed-data-sections-with-goals-habits-migration/`:

### `29-01-PLAN.md` — Wave 1, Backend DB + API
- **Task 1**: `models.py` — add `sealed_notes: str | None = Column(Text, nullable=True, default=None)` after `donts`
- **Task 2**: `session.py` — add Round 23 SQL migration (`ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS sealed_notes TEXT`)
- **Task 3**: `profile.py` — add `SealedNotesBody` + `GET/PATCH /profile/sealed-notes` endpoints

### `29-02-PLAN.md` — Wave 1, Frontend Crypto + API Client
- **Task 1**: `crypto.ts` — append `sealForSelf` + `unsealFromSelf` exports (using `sodium.crypto_box_seal` / `sodium.crypto_box_seal_open`)
- **Task 2**: `profile-api.ts` — add `getSealedNotes` + `patchSealedNotes` to `createProfileApi` factory

### `29-03-PLAN.md` — Wave 2, Frontend UI (depends on both Wave 1 plans)
- **Task 1**: i18n — add 12 new keys across `it.json` and `en.json`
- **Task 2**: Create `PreferenzaTab.tsx` — unsealed TagInput section + sealed notes textarea with auto-save on blur and locked state
- **Task 3**: `ProfileScreen.tsx` — expand tab type, replace mobile grid with carousel (swipe + arrows), replace desktop flex-wrap with scrollable strip, add location.state routing, render `PreferenzaTab`
- **Task 4**: `SettingsScreen.tsx` — remove `TagInput`/`PreferencesSection`, add redirect card

Every task includes concrete `<read_first>`, `<action>` (exact code values), and grep-verifiable `<acceptance_criteria>`. All 14 requirements (D-01–D-14) are covered.