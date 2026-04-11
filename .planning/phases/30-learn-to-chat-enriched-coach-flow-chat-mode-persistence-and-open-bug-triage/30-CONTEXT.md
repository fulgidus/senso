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

**PRIORITY bugs for this phase (actionable, confirmed by user):**

**Bug A: STT broken on Firefox/LibreWolf** (#21 TTS works, STT is the issue)
- Root cause 1: `useVoiceInput.ts` uses `useState("none")` + `useEffect` to detect backend.
  On Firefox (no Web Speech API), first render has `isSttAvailable=false` → mic disabled.
- Root cause 2: Firefox MediaRecorder falls back to `audio/ogg;codecs=opus`. ElevenLabs
  Scribe does NOT support OGG (supports: mp3, mp4, mpeg, mpga, m4a, wav, webm). Backend
  sends OGG directly → `stt_failed`.
- Fix 1: `useState(() => detectBackend())` lazy init — eliminates false-unavailable flash
- Fix 2: Backend strips codec params + remaps `audio/ogg` → `audio/webm` content-type

**Bug B: Settings coach picker dark mode colors** (#23 — settings picker, not chat picker)
- `const theme = persona.theme?.light` — hardcoded to light theme in Settings
- Chat picker correctly uses `getPersonaTheme(persona, resolvedTheme)`
- Fix: import `getPersonaTheme` in SettingsScreen; use `resolvedTheme` derived from `useTheme()`

**Bug C: Settings coach picker doesn't persist** (#24 — requires Save click)
- Selecting a coach only updates local state; user must click Save
- Counter-intuitive: looks like a radio group but isn't
- `strictPrivacyMode` in same screen already does immediate API save (correct pattern)
- Fix: `handlePersonaSelect` callback calls `updateMe` + `updateUser` immediately on click;
  remove `defaultPersonaId` from the Save form entirely

**Bug D: STT Chromium guard regression test** (#27 — fix applied, no test)
- Fix was applied (`if (isRecording) return` guard in startRecording)
- Add unit test to confirm guard works (no double-start)

**Confirmed NOT broken (do not re-fix):**
- #14 Nuke button: works correctly
- #21 TTS: works; STT is the broken part on Firefox
- #15 Tables mobile / #2 PWA / #11 Spending pie / #3 Pull-to-refresh: all Phase 22 done

## File Map

### Feature 1 (Plan 30-01)
- `senso/src/routes/ChatRoutes.tsx` — Replace `AboutChatPage` implementation
- `senso/src/features/content/contentApi.ts` — Already has `fetchContentItemBySlug`
- `senso/src/features/coaching/coachingApi.ts` — Already has `sendMessage`, `renameSession`

### Feature 2 (Plan 30-02)
- `senso/src/features/coaching/useVoiceInput.ts` — Lazy backend detection (Firefox fix)
- `senso/src/features/coaching/useVoiceMode.ts` — localStorage persistence
- `api/app/api/coaching.py` — Normalize OGG content-type for ElevenLabs
- `senso/src/features/coaching/useVoiceInput.test.ts` — Guard regression test

### Feature 3 (Plan 30-03)
- `senso/src/features/settings/SettingsScreen.tsx` — Coach picker: dark mode colors + auto-save

## Requirements

### Plan 30-01 (Learn-to-Chat)
- D-1: `/chat/about/:slug` → fetch content → send enriched message → navigate to `/chat/:id`
- D-2: Session URL is `/chat/:id` after About flow (replace navigation, not stack)
- D-3: Session is renamed to content title (fire-and-forget after first message)
- D-4: Loading state shown while fetching + sending
- D-5: Error state falls back to `/chat/new` (no dead end)

### Plan 30-02 (STT Firefox + Mode Persistence)
- D-6: `useVoiceInput.ts` uses lazy init `useState(() => detectBackend())` — no flash
- D-7: Backend STT normalizes OGG content-type before ElevenLabs call
- D-8: `isVoiceMode` persists across page loads via `localStorage.getItem("senso:chatMode")`
- D-9: Mode toggle writes to localStorage
- D-10: Unit test confirms `isRecording` guard prevents double-start

### Plan 30-03 (Settings Coach Picker)
- D-11: Settings coach picker uses `getPersonaTheme(persona, resolvedTheme)` — correct dark mode colors
- D-12: Clicking a coach in Settings auto-saves immediately (no Save button needed)
- D-13: `defaultPersonaId` removed from `isDirty` / `handleSave` / `handleReset`
