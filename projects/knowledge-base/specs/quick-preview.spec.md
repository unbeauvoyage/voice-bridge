---
title: Quick Summary / Preview
status: approved
created: 2026-04-11T20:39:58
---

# Quick Summary Feature

Allow users to get an AI-generated summary of any URL without saving it to the knowledge base. The quick preview panel is an ephemeral workspace — users get a summary, can chat with the LLM about the article, and can save to KB if they decide it's worth keeping. Nothing persists. Close the panel and it's gone.

## Motivation

Users often want to evaluate whether a URL is worth saving before committing it to their KB. The existing flow forces a full save/queue cycle. Quick Summary lets them preview content instantly with zero commitment.

---

## Backend

### `POST /preview`

Runs the same fetch → extract → summarize pipeline as `/process`, but does **not** insert anything into the database.

**Request body:**
```json
{ "url": "https://example.com/article" }
```

**Response (200):**
```json
{
  "url": "https://example.com/article",
  "title": "Article Title",
  "summary": "Full summary paragraph.",
  "tldr": ["Key point 1", "Key point 2"],
  "tags": ["tag-a", "tag-b"],
  "content": "<extracted article text — passed back by client for chat>"
}
```

**Error responses:**
- `400` — missing or invalid URL
- `502` — fetch/extract failed
- `503` — Ollama unavailable

**Behavior:**
- Runs inline (synchronous request/response — user is waiting)
- No queue, no DB writes
- Respects the same Ollama timeout as normal processing
- Returns approved + pending tags (same logic as `summarize()`)
- Returns `content` (extracted article text) so the client can pass it back for stateless chat

### `POST /preview/chat`

Stateless chat endpoint — all history is managed client-side and sent with each request.

**Request body:**
```json
{
  "content": "<article text from POST /preview response>",
  "messages": [
    { "role": "user", "content": "What is the main argument?" },
    { "role": "assistant", "content": "The author argues..." },
    { "role": "user", "content": "Follow-up question" }
  ]
}
```

**Response (200):**
```json
{ "reply": "Assistant response text" }
```

- `content` is passed as an Ollama system message: "You are discussing this article..."
- `messages` is the full conversation so far; last entry must be a user message
- Returns `503` if Ollama is unavailable

---

## Client API (`web/api.ts`)

New types and functions:

```ts
export interface QuickPreviewResult {
  url: string;
  title: string;
  summary: string;
  tldr: string[];
  tags: string[];
  content: string;
}

previewQuick(url: string): Promise<QuickPreviewResult>
previewChat(content: string, messages: { role: 'user' | 'assistant'; content: string }[]): Promise<{ reply: string }>
```

---

## In-Memory Preview State (`web/app.tsx`)

Previews are stored in React state only — no persistence. When the tab closes, they are gone.

```ts
const [previews, setPreviews] = useState<QuickPreviewResult[]>([]);
```

- Max 10 previews in memory; oldest are dropped when limit is exceeded
- Deduped by URL on insert (existing entry for same URL is replaced)
- State is managed at the top-level App component and passed down via props

---

## Web UI (`web/app.tsx`)

### Quick-Capture Modal (Ctrl+L)

Add a **"Quick Summary"** button alongside the existing "Save" button. When clicked:
1. Calls `POST /preview` with the URL
2. Shows an inline loading spinner inside the modal
3. On success: displays title, TL;DR bullets, and tags in the modal
4. One action button on the result:
   - **"Dismiss"** — adds result to in-memory previews state, closes modal
5. Below the summary: a chat input ("Ask something about this article…")
   - User types a question → `POST /preview/chat` with article content + full message history
   - Response shown as a back-and-forth thread above the input
   - Enter sends (Shift+Enter for newline)
   - Chat history stored in local React state alongside the preview; gone on dismiss

### Previews Panel

A "Previews" button in the nav (with count badge) opens a panel showing all in-memory previews. Each entry shows:
- Title (linked to original URL)
- TL;DR bullets
- Tags
- "Save to KB" button — triggers normal save, removes from previews state
- "Delete" button — removes from previews state

---

## Extension (`extension/popup.js` + `popup.html`)

Add a **"Quick Summary"** button below "Save to Knowledge Base" in the save section.

When clicked:
1. Calls `POST /preview` for the current tab URL
2. Replaces the save section content with a loading indicator
3. On success: shows title + TL;DR in the popup
4. One action button:
   - **"Dismiss"** — hides the preview result, restores original save button

The extension does not persist previews. The result lives in the popup DOM only — when the popup closes it is gone. The popup always starts fresh with no stored state.

---

## Constraints

- Preview and chat do not write to DB at any point
- No background queue — both endpoints run inline and block until Ollama responds
- Chat is stateless server-side — full history sent with every request
- In-memory previews capped at 10 entries; oldest evicted silently on insert
- Previews and chat history are not persisted — closing the tab clears everything
- Extension preview is DOM-only — no storage of any kind; popup always starts fresh (no chat in extension)
