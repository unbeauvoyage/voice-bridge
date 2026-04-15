# Test Coverage Spec: Article Chat Feature

**Status:** Draft  
**Priority:** High  
**Author:** phase4-coder-a  
**Date:** 2026-04-15  
**Project:** knowledge-base

---

## Problem / Why

From the Phase 4 test coverage audit (#26), article-chat is the **only feature without a dedicated E2E test spec**. This creates a coverage gap for one of the core reader experiences.

CEO reads items and asks questions about them via AI chat. This flow needs automated E2E verification.

---

## Feature Scope

**Article Chat** (web/src/features/article-chat/):
- Chat interface in reader pane ("Discuss" section)
- Textarea input + send button (Enter to send, Shift+Enter for newline)
- Chat history display (user messages + assistant replies)
- Loading state while awaiting response
- Persisted chat history (save/load from DB)
- Clear history button

**Two modes:**
1. **Saved item chat** (`/items/:id/discuss`) — uses item's full transcript + summary as context
2. **Preview chat** (quick preview) — uses preview content

---

## Current Implementation

**Component:** `ArticleChat.tsx`
- State: `messages` (chat history), `input` (textarea value), `loading` (awaiting response)
- Lifecycle: Load persisted history on `itemId` change
- Message flow: User input → trim → API call → append response → scroll to bottom
- Error handling: Catch errors, display error message in chat
- Clear history: Button clears messages + calls API to persist

**API endpoints:**
- `POST /items/:id/discuss { message, messages }` → returns `{ reply }`
- `GET /items/:id/chat-history` → returns `{ messages: ChatMessage[] }`
- `DELETE /items/:id/chat-history` → clears history
- `POST /preview-chat { content, messages }` → for ingest preview

---

## Test Strategy

**File:** `tests/article-chat.spec.ts`
(Named by capability: "discussing an article via AI chat")

**Test coverage:**

### Core flow
1. **Chat history loads:** Open an item with prior chat history; messages appear in chat window
2. **Send message:** Type question → press Enter → message appears, loading shows, response appends
3. **Shift+Enter for newline:** Type multi-line input → Shift+Enter adds newline (doesn't send)
4. **Auto-scroll:** Message sends; scroll auto-positions to latest response
5. **Error handling:** API error → error message displays in chat (red styling)

### Interaction details
6. **Empty state:** New item shows "Ask anything about..." placeholder; no messages
7. **Role labels:** User messages labeled "You", assistant labeled "Assistant"
8. **Loading state:** While response pending, shows "Thinking…" placeholder
9. **Clear button:** Shows only when chat has history; click clears all messages
10. **Disabled on load:** Textarea disabled while response loading (prevent duplicate sends)

### Persistence
11. **History persisted:** Clear browser cache; reopen item; history still present (API load)
12. **Clear persists:** Click "Clear"; reload page; history gone (API delete worked)
13. **Preview mode:** Preview chat uses `/preview-chat` endpoint (different from saved item)

### Edge cases
14. **Empty message:** Type spaces only → send disabled, no API call
15. **Network error:** API returns 500 → error message in chat, textarea re-enabled
16. **Long messages:** Multi-paragraph response → renders fully, scroll works
17. **Special chars:** Emoji, code blocks, markdown → render as plain text (no parsing)
18. **Concurrent sends:** Send message, send again before response → second send ignored (disabled)

### Accessibility
19. **Keyboard accessible:** Tab to textarea, Tab to send/clear buttons, Enter sends
20. **ARIA labels:** Textarea has placeholder, buttons have title attributes

---

## Acceptance Criteria

1. **Full flow works:** User sends question → assistant replies → history persists
2. **All interactions** in test strategy above pass
3. **No flakes:** Timing-sensitive tests (scroll, async) use proper waits
4. **Parity with web:** Extension and web use same `ArticleChat` component
5. **API verified:** Each test confirms the right API endpoint was called
6. **Error recovery:** API failures don't break the UI; user can retry

---

## Implementation Notes

**Hook location:** Use existing React Query hooks once available (chat history could use RQ)

**Component:** `ArticleChat.tsx` is already built and in use — spec covers existing behavior

**API:** All endpoints already exist in `src/server.ts`:
- POST `/items/:id/discuss`
- GET `/items/:id/chat-history`
- DELETE `/items/:id/chat-history`
- POST `/preview-chat`

**No code changes needed** — spec documents what's already implemented. Tests verify existing feature.

**Test server setup:** Ensure Ollama is running (AI responses require model). If unavailable, tests can mock responses.

