---
plan: "20-03"
phase: "20"
status: complete
completed: "2026-04-07"
---

# Summary: 20-03 - User Preferences + get_user_preferences Tool

## What was built

- 3 JSONB columns on `user_profiles`: `goals`, `dos`, `donts` (Round 20 migration)
- GET/PATCH `/profile/preferences` API endpoints
- `_GET_USER_PREFERENCES_TOOL` LLM tool
- Frontend `PreferencesSection` with `TagInput` component in SettingsScreen — add/remove tags, auto-save on change
- i18n keys in both `it.json` and `en.json`

## Self-Check: PASSED — build clean, API compiles
