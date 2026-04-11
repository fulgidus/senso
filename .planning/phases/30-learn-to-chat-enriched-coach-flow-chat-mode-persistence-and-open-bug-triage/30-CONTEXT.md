---
phase: "30"
slug: learn-to-chat-enriched-coach-flow-chat-mode-persistence-and-open-bug-triage
created: "2026-04-11"
status: ready-to-execute
---

# Phase 30 Context — Learn-to-Chat Enriched Coach Flow, Chat Mode Persistence, and Open Bug Triage

## Why This Phase Exists

Three independent UX and quality improvements:

1. **Learn→Chat flow is a glorified autofill** — `/learn/:slug` "Discuss with coach" button navigates to `/chat/about/:slug` which just pre-fills the input text box with the decoded slug. The user still has to manually send it, no content context is injected into the AI, and the chat title has nothing to do with the content. The experience should be: click → coach immediately starts a conversation about the selected content with full title/summary context injected, session URL becomes `/chat/:id`.

2. **Chat mode (text/voice) resets on every page load** — `useVoiceMode.ts` initializes `isVoiceMode` from `useState(false)` every time. If a user switches to voice mode and navigates away, it resets. This should persist via `localStorage`.

3. **Open bugs from STATE.md pending todos** — Several bugs accumulated since Phase 12.1 and subsequent phases were never confirmed fixed or have no regression tests. The most impactful ones are triaged here.

## Current State Analysis

### Feature 1: Learn→Chat (ContentDetailPage + ChatRoutes)

**Current flow:**
- `ContentDetailPage` has a `<Link to="/chat/about/:slug">` CTA button
- `AboutChatPage` in `ChatRoutes.tsx` renders `<ChatScreen initialTopic={slug}>` 
- `ChatScreen` pre-fills input with decoded slug text: `decodeURIComponent(slug).replace(/-/g, ' ')`
- User must manually send the message; coach doesn't know what the content is about

**Desired flow:**
1. User clicks "Discuss with coach" on `/learn/budgeting-for-beginners`
2. Navigates to `/chat/about/budgeting-for-beginners`
3. `AboutChatPage` fetches the content item via `fetchContentItemBySlug(slug)`
4. Builds enriched user message using title + summary + type context
5. Auto-sends it to `POST /coaching/chat` (no session_id → creates new session)
6. Coach responds immediately in context
7. URL navigates to `/chat/{sessionId}` (replace, so back button goes to /learn not /chat/about)
8. Session is renamed to the content item title

**APIs available:**
- `fetchContentItemBySlug(slug)` — public, no auth required
- `sendMessage(message, locale, personaId)` — returns `CoachingResponse` with `session_id`
- `renameSession(sessionId, name)` — renames session to content title
- `createCoachingApi(onUnauthorized).sendMessage(...)` — auth-aware version

**Message template (IT locale):**
```
Ho appena letto questa risorsa: «{title}»

{summary}

Tipo: {type_label} | Argomenti: {topics.join(', ')}

Puoi aiutarmi a capire come si applica alla mia situazione finanziaria? Cosa dovrei fare concretamente?
```

**Message template (EN locale):**
```
I just read this resource: "{title}"

{summary}

Type: {type_label} | Topics: {topics.join(', ')}

Can you help me understand how this applies to my financial situation? What should I do concretely?
```

### Feature 2: Chat Mode Persistence

**Current state:**
- `useVoiceMode.ts` line 70: `const [isVoiceMode, setIsVoiceMode] = useState(false)`
- Mode resets to text on every page load/navigation

**Fix:**
- Read initial: `localStorage.getItem("senso:chatMode") === "voice"`
- Write on toggle: `localStorage.setItem("senso:chatMode", isVoiceMode ? "text" : "voice")`
- Storage key: `"senso:chatMode"` (consistent with other `senso:*` keys)

### Feature 3: Open Bug Triage

Cross-referencing STATE.md pending todos with Phase 22 VERIFICATION.md (all 22 fixes applied):

**Already CONFIRMED FIXED (Phase 22):**
- #2 PWA manifest standalone ✓
- #3 Pull-to-refresh ✓  
- #11 Spending graph = pie chart ✓
- #15 Tables → card layout on mobile ✓
- #21 TTS voice output ✓
- #23 Coach picker dark theme ✓
- #24 Coach picker non-default persona ✓

**PRIORITY bugs for this phase (actionable, impactful):**

**Bug A: Nuke endpoint doesn't fully reset user state** (todo #14)
- Backend `/debug/nuke` deletes ChatMessage, ExtractedDocument, Upload
- MISSING: ChatSession records remain (orphaned sessions in UI list)
- MISSING: UserProfile confirmed flag remains True (user bypasses upload flow)
- MISSING: UserProfile financial data remains (income, expenses, balance, etc.)
- Fix: Add ChatSession cascade + UserProfile reset (set confirmed=False, clear financial fields) in `api/app/api/debug.py`

**Bug B: Content management missing i18n** (todo #17/18)
- Admin content table column headers: `colLocale` and `colActions` still use raw text or icon not from i18n
- Partially fixed (duplicate JSON keys removed); icon replacement pending
- Fix: Replace remaining hardcoded column headers with i18n keys + icon-only variants

**Bug C: STT Chromium regression prevention** (todo #27)
- Fix was applied (isRecording guard in useVoiceInput), human verify pending
- Fix: Add a unit test to `useVoiceInput.test.ts` verifying the guard prevents double-start

**Bug D: Content management pagination** (todo #20 - quick win for admin UX)
- AdminContentPage table has no pagination; loads all items
- Already has state for `page` and `pageSize` in profile-api.ts
- Fix: Add pagination controls to `AdminContentPage`

## File Map

### Feature 1
- `senso/src/routes/ChatRoutes.tsx` — Replace `AboutChatPage` implementation
- `senso/src/features/content/contentApi.ts` — Already has `fetchContentItemBySlug`
- `senso/src/features/coaching/coachingApi.ts` — Already has `sendMessage`, `renameSession`

### Feature 2  
- `senso/src/features/coaching/useVoiceMode.ts` — Add localStorage read/write

### Feature 3
- `api/app/api/debug.py` — Fix nuke to reset profile + delete sessions
- `senso/src/features/admin/AdminContentPage.tsx` (or ContentAdminPage) — Add pagination
- `senso/src/features/coaching/useVoiceInput.test.ts` — Add guard regression test

## Requirements

- D-1: `/chat/about/:slug` → fetch content → send enriched message → navigate to `/chat/:id`
- D-2: Session URL is `/chat/:id` after About flow (not stuck on `/chat/about/:slug`)
- D-3: Session is renamed to content title after first message
- D-4: Loading state shown while fetching content + sending message
- D-5: Error state falls back to `/chat/new` with a toast
- D-6: `isVoiceMode` persists across page loads via `localStorage.getItem("senso:chatMode")`
- D-7: Mode toggle writes to localStorage on every change
- D-8: Nuke endpoint deletes ChatSession records for the user
- D-9: Nuke endpoint resets UserProfile confirmed=False + clears financial fields
- D-10: All content management column headers use i18n keys
- D-11: Unit test covers `isRecording` guard in `useVoiceInput`
