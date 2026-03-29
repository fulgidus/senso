# Phase 7: Streaming & Nice-to-Have Polish - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in `07-CONTEXT.md` - this log preserves the alternatives considered.

**Date:** 2026-03-29T18:15:44Z
**Phase:** 07-streaming-nice-to-have-polish
**Areas discussed:** Streaming behavior, Persona selection and persistence, Conversation restoration UX, PII safety cross-check behavior, Structured content reveal timing, Persona visibility in chat history, Restored-session framing

---

## Streaming behavior

| Option | Description | Selected |
| --- | --- | --- |
| Live typing bubble | Show one assistant bubble immediately and fill it in progressively | ✓ |
| Skeleton then swap | Keep a loading skeleton first, then swap to real content | |
| Partial lines blocks | Render coarse chunk blocks as they arrive | |

**User's choice:** Live typing bubble with token-by-token stream and polished char-by-char feel for the normal/spoken text only. Non-text UI like cards or A2UI should not fake streaming because final markup shape is unpredictable.
**Notes:** User explicitly wanted streaming discussion to include UI/UX, and asked what SSE means. SSE was clarified as Server-Sent Events: incremental chunks over one open HTTP response.

---

## Streaming fallback

| Option | Description | Selected |
| --- | --- | --- |
| Auto full reply | Silently fall back to the existing full-response path | ✓ |
| Retry then full reply | Retry streaming once, then fall back | |
| Show error only | Surface a streaming failure and require manual retry | |

**User's choice:** Auto full reply.
**Notes:** Failure handling should preserve the answer rather than making streaming fragility user-visible.

---

## Voice sync during streaming

| Option | Description | Selected |
| --- | --- | --- |
| After full text ready | Visual stream first, begin TTS only when final spoken text is complete | ✓ |
| Start speaking mid-stream | Begin TTS while content is still arriving | |
| User taps play only | Disable auto-play for streamed voice replies | |

**User's choice:** After full text ready.
**Notes:** Streaming improves perceived speed visually, but audio should remain natural and not start from partial text.

---

## Persona UI

| Option | Description | Selected |
| --- | --- | --- |
| Inline chat picker | Quick persona switcher in chat only | |
| Settings only | Persona selection lives only in settings | |
| Both chat and settings | Quick switching in chat + durable default in settings | ✓ |

**User's choice:** Both chat and settings.
**Notes:** User wants fast switching in the flow plus a persistent preference model.

---

## Persona switch scope

| Option | Description | Selected |
| --- | --- | --- |
| New messages only | Switch affects future replies, not old history | ✓ |
| Whole conversation retroactively | Treat old history as if it belonged to the new persona | |
| Ask every time | Prompt for temporary vs session-wide behavior on each switch | |

**User's choice:** New messages only.
**Notes:** This preserves readable history and avoids rewriting the meaning of prior turns.

---

## New conversation default persona

| Option | Description | Selected |
| --- | --- | --- |
| Saved default | Start new chats with the saved persona preference | ✓ |
| Last used in chat | Carry over the most recent ad hoc choice | |
| Always mentore-saggio | Reset every new conversation to the original coach | |

**User's choice:** Saved default.
**Notes:** Persistence should come from settings, not incidental chat state.

---

## Return-to-chat behavior

| Option | Description | Selected |
| --- | --- | --- |
| Reopen last session | Immediately reopen the most recent conversation | ✓ |
| Show conversation list first | Ask the user to choose before entering chat | |
| Always start fresh | Start with a new empty conversation every time | |

**User's choice:** Reopen last session.
**Notes:** User marked restoration as very important.

---

## Reopened history depth

| Option | Description | Selected |
| --- | --- | --- |
| Full visible history | Load the whole conversation into the main chat view | ✓ |
| Recent chunk only | Load only the latest messages first | |
| Summary plus latest turns | Compress earlier content into a summary | |

**User's choice:** Full visible history.
**Notes:** The restored conversation should feel continuous, not partially reconstructed.

---

## Older conversation access

| Option | Description | Selected |
| --- | --- | --- |
| Keep current history button | Reuse the current history modal entry point | ✓ |
| Permanent sidebar/list | Keep all sessions visible alongside chat | |
| Dropdown only | Replace history browsing with a compact switcher | |

**User's choice:** Keep current history button.
**Notes:** Restoration should improve, but the history-management surface does not need a full navigation redesign.

---

## PII safety cross-check behavior

| Option | Description | Selected |
| --- | --- | --- |
| Warn and rewrite | Soft-check unsolicited profile mentions and trim/rewrite risky parts | ✓ |
| Log only, allow through | Observe but never modify output | |
| Block only clear leaks | Allow most responses, hard-block only obvious cases | |

**User's choice:** Warn and rewrite.
**Notes:** User described Phase 7 safety as something that can be relatively lax, and did not want overly strict blocking behavior. Soft rewriting is the preferred compromise.

---

## Structured content reveal timing

| Option | Description | Selected |
| --- | --- | --- |
| Reserve skeleton slots | Keep placeholders for future structured UI while text streams | |
| Insert only when ready | Add cards / A2UI only when the final payload is ready | ✓ |
| Show one generic placeholder | Display a single generic 'details incoming' block | |

**User's choice:** Insert when ready.
**Notes:** User explicitly asked to avoid locking in skeletons for unpredictable final markup. Layout shift should still be softened with tasteful animation.

---

## Persona visibility in history

| Option | Description | Selected |
| --- | --- | --- |
| Subtle per-message label | Small name/icon cue per assistant message | ✓ |
| Header-only current persona | Show only the currently selected persona globally | |
| Strong full persona chrome | Make every assistant bubble loudly persona-branded | |

**User's choice:** Subtle per-message label.
**Notes:** User said the existing subtle avatar/name pattern is already right, and specifically suggested adding persona-configured colors or gradients for the bubble and avatar background without making the chat overwhelming.

---

## Restored-session framing

| Option | Description | Selected |
| --- | --- | --- |
| Subtle restore cue | Small self-dismissing cue acknowledging the restored chat | ✓ |
| No cue at all | Restore silently with no acknowledgment | |
| Strong restore banner | Show an obvious restore message/banner | |

**User's choice:** Subtle restore cue.
**Notes:** User specifically wanted a tasteful animated toast that disappears by itself without bothering the user.

---

## the agent's Discretion

- Exact streaming event framing and client buffering approach.
- Exact animation curves and timing for typing, structured-content insertion, and restore toast.
- Exact settings/control layout for durable persona default.

## Deferred Ideas

- LLM-side no-retention support.
- Cryptography / encryption at rest for stronger privacy posture.
