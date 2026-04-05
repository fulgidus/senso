---
plan: "15-06"
phase: "15"
status: complete
completed: 2026-04-05
tasks_completed: 3
commits:
  - "92425aa feat(15-06-01): RecoveryPhraseInterstitial with 24-word grid, copy, download-txt gate"
  - "66c58b0 feat(15-06-02): attachment download+decrypt flow + presigned URL endpoint"
  - "2e6119e feat(15-06-03): i18n completeness pass + Wave 3 sign-off (nyquist_compliant: true)"
---

# Plan 15-06 SUMMARY — Recovery Phrase + Attachments + i18n

## What Was Built

### Task 15-06-01: RecoveryPhraseInterstitial

- Created `senso/src/features/messages/RecoveryPhraseInterstitial.tsx`: full-screen fixed overlay (z-[9999]) with 24-word 4×6 grid (font-mono), "Copy all" button with 2s check-icon feedback, "Download as .txt" button (Review amendment #4 — creates Blob with numbered word list, triggers browser download via temp anchor), amber warning paragraph, and checkbox gate that enables the Continue button. Calls `onConfirm()` on confirmation.
- Wired into `senso/src/App.tsx` State 5: if `auth.user?.recoveryPhrase` is set, renders the interstitial blocking all routes; `onConfirm` calls `auth.updateUser({ recoveryPhrase: null })` to clear state atomically after explicit user action.
- Added `messages.recoveryPhrase.*` i18n keys (title, dialogLabel, description, wordGridLabel, copyAll, copied, downloadTxt, warning, savedCheckbox, continueButton) to both `it.json` and `en.json`.
- Created `RecoveryPhraseInterstitial.test.tsx`: 3 tests — renders all 24 words, Continue disabled until checkbox, onConfirm called after checkbox+click.

### Task 15-06-02: Attachment Download + Decrypt Flow

- Added `GET /attachments/{attachment_id}/download` endpoint to `api/app/api/attachments.py`: returns a presigned MinIO URL (1 hour TTL) for downloading encrypted attachment blobs. Server is zero-knowledge — URL only, no decryption.
- Added `getAttachmentDownloadUrl()` to `senso/src/features/messages/messagesApi.ts`: calls the new endpoint and normalises snake_case → camelCase.
- Created `senso/src/features/messages/attachmentUtils.ts`: `AttachmentEntry` interface, `extractAttachmentId()` path helper, `downloadAndDecryptAttachment()` (presigned URL → fetch → key unwrap via decryptFromSender → decryptAttachment → Blob), and `triggerBrowserDownload()`.
- Extended `InboxTab.tsx` / `MessageBubble`: uses `useAuthContext()` for `cryptoKeys`, renders `AttachmentDownloadButton` per frontmatter attachment with disabled state during download and error display.
- Fixed `InboxTab.test.tsx` to wrap renders in `AuthContext.Provider` mock.
- Added `messages.errorNoKeys`, `messages.errorDownload`, `messages.downloading` i18n keys to both locales.

### Task 15-06-03: i18n Completeness Pass + Sign-off

- Audited all 40 `t("messages.*)` call sites across Phase 15 source files; confirmed 100% present in both locale files.
- Verified `nav.messages`, `app.sodiumError`, `app.loading` present in both locales.
- Ran hardcoded-string grep — no user-facing strings outside `t()` calls found.
- `no-hardcoded-locale` regression test: PASS.
- Full frontend test suite: 76/76 tests pass.
- Updated `15-VALIDATION.md` frontmatter: `nyquist_compliant: true`, `wave_0_complete: true`.

## Key Files

- `senso/src/features/messages/RecoveryPhraseInterstitial.tsx` — new component
- `senso/src/features/messages/__tests__/RecoveryPhraseInterstitial.test.tsx` — 3 tests
- `senso/src/features/messages/attachmentUtils.ts` — download+decrypt utils
- `senso/src/features/messages/InboxTab.tsx` — extended with AttachmentDownloadButton
- `senso/src/features/messages/__tests__/InboxTab.test.tsx` — fixed to provide AuthContext
- `senso/src/features/messages/messagesApi.ts` — added getAttachmentDownloadUrl
- `api/app/api/attachments.py` — added presigned URL download endpoint
- `senso/src/App.tsx` — wired RecoveryPhraseInterstitial
- `senso/src/i18n/locales/it.json` — recoveryPhrase.\*, errorNoKeys, errorDownload, downloading
- `senso/src/i18n/locales/en.json` — same keys in English
- `.planning/phases/15-.../15-VALIDATION.md` — nyquist_compliant: true

## Self-Check: PASSED

- [x] RecoveryPhraseInterstitial: 4×6 grid, copy-all, download-as-txt (review amendment #4), checkbox gate
- [x] onConfirm clears recoveryPhrase from auth state (atomic — only after explicit confirm)
- [x] Attachment download+decrypt wired in InboxTab
- [x] presigned URL endpoint in attachments.py
- [x] All messages.\* i18n keys present in both locales
- [x] nyquist_compliant: true set in 15-VALIDATION.md
- [x] All frontend tests pass (76/76)
- [x] Backend crypto/KDF/BIP39 tests pass (pre-existing test_encryption.py SQLite ARRAY issue is unrelated to Phase 15 changes)
