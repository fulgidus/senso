---
plan: 29-02
status: complete
wave: 1
completed_at: 2026-04-11
commits:
  - 19f51342
key-files:
  created:
    - senso/src/features/messages/crypto.ts
    - senso/src/lib/profile-api.ts
    - senso/src/features/auth/types.ts
    - senso/src/features/auth/session.ts
    - senso/src/lib/user-avatar.ts
    - senso/src/components/UserAvatar.tsx
---

# Plan 29-02 Summary: Frontend Foundation — Crypto, API Client, User Type, Display Utilities

## What was built

- **sealForSelf** / **unsealFromSelf** added to crypto.ts using `sodium.crypto_box_seal` / `sodium.crypto_box_seal_open` (anonymous sealed-box)
- **4 new profile API methods** added to `createProfileApi` factory: `getSealedProfile`, `patchSealedProfile`, `getDemographics`, `patchDemographics`
- **User type** in `types.ts`: removed `firstName` / `lastName` fields
- **session.ts**: removed firstName/lastName from `parseUser()` mapping and `updateMe()` input type + request body
- **user-avatar.ts**: `getInitials` and `getDisplayName` now use username-only fallback (no firstName/lastName branches)
- **UserAvatar.tsx**: aria-label uses `user.username` instead of `user.firstName`

## Self-Check: PASSED
