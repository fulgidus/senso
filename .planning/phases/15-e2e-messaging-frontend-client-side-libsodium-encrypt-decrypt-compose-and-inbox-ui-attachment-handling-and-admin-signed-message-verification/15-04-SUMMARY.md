---
plan: "15-04"
phase: "15"
status: complete
completed: 2026-04-05
tasks_completed: 3
commits:
  - 1d931f9 feat(15-04-01): create messagesApi.ts with poll/send/keys/upload endpoints
  - ce3a50f feat(15-04-02): MessagesPage + InboxTab + parseMessage with JSON_SCHEMA yaml
  - 048fb9d feat(15-04-03): ContactsTab + contacts.ts + nav badge + poll-at-login integration
---

# Plan 15-04 SUMMARY — Inbox + Contacts + Poll Integration

## What Was Built

### Task 15-04-01: messagesApi.ts

Created `senso/src/features/messages/messagesApi.ts` with all required exports:

- `PolledMessageDTO`, `RecipientPublicKeysDTO`, `SendMessageRequest`, `SendMessageResponse`,
  `DecryptedMessage`, `UploadedAttachment` interfaces
- `pollMessages()` → POST /messages/poll
- `getRecipientPublicKeys(username)` → GET /messages/users/{username}/public-keys (URL-encoded)
- `sendMessage(recipientHashes, encryptedPayload)` → POST /messages/send (snake_case body)
- `uploadAttachment(encryptedBlob, filename)` → POST /attachments/upload (FormData, raw fetch)

Note: Merged with Plan 15-05's concurrent modifications to the same file (15-05 added
`UploadedAttachment` and changed API_BASE to function-call pattern). Added `DecryptedMessage`
and `SendMessageRequest` back which 15-05 had removed.

### Task 15-04-02: MessagesPage + InboxTab + parseMessage

- `parseMessage.ts`: decrypts `PolledMessageDTO` using `decryptFromSender`, parses YAML
  frontmatter with mandatory `yaml.JSON_SCHEMA`, verifies Ed25519 signatures, returns
  `DecryptedMessage` with catch-all fallback on error
- `MessagesPage.tsx`: full tab implementation (`?tab=inbox|contacts`) consuming
  `polledMessages` and `isPolling` from `AuthContext` (never calls `pollMessages()` directly)
- `InboxTab.tsx`: message list with loading/error/empty states, `MessageBubble` with
  `ShieldCheck` verified badge (clickable → signature detail panel), `AlertTriangle` for
  invalid signatures, `ReactMarkdown` body rendering
- `MessagesPage.tsx` integrates `ComposeMessage` (from Plan 15-05's parallel work) without
  `useEncryptAndSend` dependency (placeholder callback until 15-05 wires it)
- Updated `AuthContext.tsx` to add `pendingMessageCount`, `setPendingMessageCount`,
  `polledMessages`, `setPolledMessages` to the context shape
- Updated `App.tsx` to pass new context values
- All i18n keys added to both `it.json` and `en.json` under `messages.*`

### Task 15-04-03: ContactsTab + contacts.ts + nav badge + poll-at-login

- `contacts.ts`: localStorage persistence under `senso:contacts` with `loadContacts()`,
  `saveContacts()`, `upsertContact()`, `deleteContact()`, `populateContactsFromMessages()`
- `ContactsTab.tsx`: contact list with delete button (`Trash2`), empty state, `useEffect` load
- `useAuth.ts`: added `pendingMessageCount` and `polledMessages` state; bootstrap poll-at-login
  wrapped in `setIsPolling(true/false)` so MessagesPage doesn't show false empty state
- `AppShell.tsx`: added `Mail` icon nav item for `/messages` with pending count badge;
  reads `pendingMessageCount` from `useAuthContext()`
- `nav.messages` and `contacts.*` i18n keys added to both locale files
- Also fixed `useEncryptAndSend.ts` (15-05 file) TypeScript error (`Uint8Array → ArrayBuffer`)
  and `ComposeMessage.test.tsx` (15-05 test) broken button queries (emoji in button text)

## Key Files

### New files

- `senso/src/features/messages/messagesApi.ts` — API client (task 01)
- `senso/src/features/messages/parseMessage.ts` — decrypt + parse (task 02)
- `senso/src/features/messages/InboxTab.tsx` — inbox tab component (task 02)
- `senso/src/features/messages/contacts.ts` — localStorage contacts (task 03)
- `senso/src/features/messages/ContactsTab.tsx` — contacts tab component (task 03)
- `senso/src/features/messages/__tests__/InboxTab.test.tsx` — inbox tests (task 02)
- `senso/src/features/messages/__tests__/ContactsTab.test.tsx` — contacts tests (task 03)

### Modified files

- `senso/src/features/messages/MessagesPage.tsx` — full tab + compose implementation
- `senso/src/features/auth/AuthContext.tsx` — added pendingMessageCount + polledMessages
- `senso/src/features/auth/useAuth.ts` — bootstrap poll + new state
- `senso/src/components/AppShell.tsx` — /messages nav item with badge
- `senso/src/App.tsx` — pass new context values to AuthContext.Provider
- `senso/src/i18n/locales/it.json` — messages.\* + nav.messages i18n keys
- `senso/src/i18n/locales/en.json` — messages.\* + nav.messages i18n keys

## Self-Check: PASSED

- [x] pollMessages() never called in MessagesPage (uses context polledMessages)
- [x] yaml.JSON_SCHEMA used in parseMessage.ts
- [x] isPolling used in MessagesPage to prevent false empty state (review amendment #1)
- [x] pendingMessageCount badge in AppShell nav
- [x] All frontend tests pass (73 tests, 15 test files)
- [x] Merged cleanly with Plan 15-05's parallel changes (ComposeMessage, useEncryptAndSend)
- [x] Fixed 15-05 TS error in useEncryptAndSend.ts and broken test in ComposeMessage.test.tsx
