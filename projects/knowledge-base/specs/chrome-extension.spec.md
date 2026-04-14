---
type: spec
feature: chrome-extension
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Manifest V3 Chrome extension popup that saves the active tab to the local knowledge base server, shows a processing queue with polling, and lets users browse and search their saved items.
---

## Overview

A browser action popup (`popup.html` / `popup.js`) that connects to the local server at `http://127.0.0.1:3737`. It provides save, browse, search, and tag-review functionality without leaving the browser.

## Manifest

- MV3 (`manifest_version: 3`)
- Permissions: `activeTab`, `tabs`, `clipboardRead`, `storage`
- No background service worker; all logic is in the popup

## Queue Persistence

Items submitted via the extension are tracked in `chrome.storage.local` under key `queueLog`.

### Entry shape

```js
{
  id: string,        // server-assigned item ID
  url: string,
  title: string,     // filled in after processing completes
  status: 'queued' | 'processing' | 'done' | 'error',
  submittedAt: number,  // Date.now()
  error?: string
}
```

Queue is capped at 50 entries (oldest entries beyond 50 are dropped).

## Deduplication

Before calling `POST /process`, the extension checks:
1. **Local queue dedup**: scans `queueLog` for a matching URL (case-insensitive). If found, shows "Already queued" and aborts.
2. **Server dedup**: `POST /process` returns `{ status: 'exists' }` if the URL is already in the database. Extension shows "Already saved".

## Save Flow

1. User clicks "Save to Knowledge Base".
2. Local dedup check (see above).
3. `POST /process` with `{ url: currentUrl }`.
4. On success: item added to `queueLog`, polling starts (`pollItem(id)`).
5. Button state: "Saved ✓" for 3 s, then resets.

## Polling

`pollItem(id)` polls `GET /status/:id` every 2 s, up to 120 checks (4 minutes total):
- On `done` or `error`: stops polling, updates `queueLog`, re-renders queue, refreshes item list.
- While processing: updates `title` in `queueLog` if the server returns one.

## Queue Reconciliation

On popup open, `reconcileQueue()` is called before rendering. It re-checks all non-terminal entries (`queued` or `processing`) against the server and updates their status. This handles the case where the server processed the item while the popup was closed.

## Items List

- Fetches `GET /items` on popup open (top 50 shown).
- Supports text search (debounced 300 ms) via `GET /search?q=`.
- Client-side tag filter (AND match) and date filter (today / last 2/3/4 days).
- Clicking a tag chip on an item adds it to the active tag filter.
- "Read" button on each item opens an inline modal with TL;DR, summary, sections, and tags.

## Item Modal

- Opens `GET /items/:id`, marks the item read via `POST /items/:id/read`.
- Shows TL;DR lines, summary paragraph, section headings with bullet points.
- Pending tags show inline approve (✓) and reject (✗) buttons that call `/tags/approve` and `/tags/reject`.
- Full transcript shown in a `<details>` element.

## Tag Pending Banner

- On load, `GET /tags` is called.
- If pending tags exist, a banner shows the count with a "Review →" link that opens `http://127.0.0.1:3737/` in a new tab.

## Server Health Check

On popup open, `GET /health` is called. If the server is not reachable, the save button is disabled and the items list shows a "Server not running — start with: `bun run server`" message.

## CORS

The server explicitly allows `chrome-extension://` origins in CORS headers (`Access-Control-Allow-Origin`). All popup fetch requests are covered.

## How to Test

1. Load the unpacked extension from `extension/`. Open on any HTTP/HTTPS page.
2. Click "Save to Knowledge Base". Expect "Queued — processing in background" status and the item to appear in the processing queue.
3. Click "Save" again for the same URL — expect "Already queued" without a server call.
4. Wait for processing to complete — expect item to appear in the items list.
5. Close popup, reopen — expect queue state to be reconciled against server.
6. Kill the server. Open popup — expect disabled save button and server error message.
7. Search for a term — expect filtered results within the popup.
