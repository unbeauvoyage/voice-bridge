---
feature: knowledge-base
version: 1.0
---

# Knowledge Base — Behavior Specification

## Overview

A personal knowledge base that saves web pages and YouTube videos, extracts their content, summarizes them with a local Ollama LLM, and presents them through a browser extension popup and a React web app. Everything runs locally at `http://127.0.0.1:3737`.

---

## 1. URL Ingestion

### 1.1 Browser Extension — Save Button

**Behavior:** The popup displays the active tab's URL and a "Save to Knowledge Base" button. Clicking it POSTs the URL to `POST /process`. The button is disabled while the request is in flight and re-enabled afterward.

**Acceptance criteria:**
- Button is disabled and shows a server error message if `GET /health` returns non-ok or times out (2 s timeout).
- On success, displays "Queued — processing in background" in green.
- On HTTP error, displays `Error: <message>` in red.
- If `currentUrl` is empty (no active tab), shows "No URL to save." and does not POST.
- Uses a 5 s timeout on the POST request.

**Edge cases:**
- Duplicate URL: server returns the existing item's `{ id, status }` without re-processing. Extension shows "Queued — processing in background" on any successful 200 response (it does not inspect the returned status).
- Server not running: button is permanently disabled; items list shows "Server not running — start with: `bun run server`".

### 1.2 `urls.txt` Watcher

**Behavior:** On server startup, `urls.txt` is read and all non-comment, non-empty lines are enqueued. A `node:fs` watcher fires on every file change and re-runs the same logic.

**Acceptance criteria:**
- Lines starting with `#` are ignored.
- Blank lines are ignored.
- URLs already in the DB (`itemExistsByUrl`) are skipped silently.
- New URLs are enqueued immediately; processing starts asynchronously.
- Missing `urls.txt` is silently skipped (no error).

**Out of scope:** Hot-reload of already-queued items; watching for URL removals.

### 1.3 `POST /process`

**Request:** `{ "url": "<string>" }`

**Response (immediate):** `{ "id": "<string>", "status": "<queued|processing|done|error>" }`

**Acceptance criteria:**
- Missing or non-string `url` → `400 { error: "Missing url field" }`.
- Unparseable JSON body → `400 { error: "Invalid JSON body" }`.
- Valid URL → item is inserted (status `queued`) and processing starts asynchronously; response is returned immediately with status `queued`.
- Duplicate URL (URL already in DB) → response returns the existing item's `{ id, status }` immediately; no extraction or summarization is triggered. If the item is already fully processed, status will be `done`. This is intentional dedup — URLs are never re-processed.

**ID format:** `item-<timestamp>-<5-char random alphanum>`

---

## 2. YouTube Transcript Extraction

**Entry point:** `src/extract/youtube.ts` — `extractYoutube(url)`

**Behavior:** Extracts the 11-character video ID, fetches the page title from `youtube.com`, then fetches the transcript via `youtube-transcript`.

**Supported URL formats:**
- `youtube.com/watch?v=<id>`
- `youtu.be/<id>`
- `youtube.com/shorts/<id>`
- `youtube.com/embed/<id>`

**Acceptance criteria:**
- Valid URL with transcript → returns `{ title, content: "<joined transcript text>", url }`.
- Valid URL, captions disabled or private video → returns `{ title, content: '', url, extractionError: "No transcript available — video may be private or captions disabled" }`. Server saves item as status `error` with that message.
- Unrecognized URL format → throws `Error("Could not extract video ID from URL: <url>")`.
- Title fetch failure → falls back to `"YouTube Video <videoId>"`.

**Edge cases:**
- Transcript segments are joined with a single space.
- Title has " - YouTube" suffix stripped.

---

## 3. Web Page Extraction

**Entry point:** `src/extract/web.ts` — `extractWeb(url)`

**Behavior:** Fetches the URL with a browser-like `User-Agent`, parses HTML with `linkedom`, extracts readable content with `@mozilla/readability`.

**Acceptance criteria:**
- Successful fetch and parse → returns `{ title, author?, content, url }`.
- HTTP error (non-2xx) → throws `Error("HTTP <status> fetching <url>")`.
- Readability cannot extract article → throws `Error("Readability could not parse content from <url>")`.
- `author` is `undefined` when `byline` is null.

**Out of scope:** JavaScript-rendered pages (no headless browser); authentication-gated URLs.

---

## 4. Ollama Summarization

**Entry point:** `src/summarize.ts`

### 4.1 `summarize(extracted, approvedTags, rejectedTags)`

**Behavior:** Truncates content to 12,000 characters (appends `[Content truncated for summarization]`), sends a structured JSON prompt to `http://127.0.0.1:11434/api/chat`, parses the response.

**Model:** `OLLAMA_MODEL` env var, default `llama3.2`.

**Timeout:** `OLLAMA_TIMEOUT` env var (ms), default `60000`. Uses `AbortController`.

**Prompt contract — expected JSON response:**
```json
{
  "tldr": ["<3–5 punchy sentences>"],
  "summary": "<2–3 sentence overview>",
  "sections": [{ "title": "<string>", "points": ["<string>"] }],
  "tags": ["<general>", "...", "<specific>"]
}
```

**Acceptance criteria:**
- Valid JSON response → parsed and returned.
- Response contains JSON buried in prose → extracted via `/\{[\s\S]*\}/` regex.
- JSON parse failure → returns `{ tldr: [], summary: "<first 200 chars>", sections: [], tags: [] }`.
- No JSON match at all → same fallback.
- Ollama ECONNREFUSED → throws `Error("Ollama not running — start with: ollama serve")`.
- Ollama AbortError (timeout) → throws `Error("Ollama timed out — is it still running?")`.
- Ollama non-2xx HTTP → throws `Error("Ollama returned HTTP <status>")`.
- `approvedTags` injected into prompt as preferred tags (reuse hint).
- `rejectedTags` injected as never-use list.

### 4.2 `suggestTags(transcript, approvedTags, rejectedTags)`

**Behavior:** Sends a shorter prompt requesting only 3–6 tags as a JSON array. Used during re-tagging after a tag rejection.

**Acceptance criteria:**
- Valid JSON array response → returns `string[]` filtered to string elements.
- No array found in response → returns `[]`.
- Parse error → returns `[]`.
- Same approved/rejected guidance injected as in `summarize`.

---

## 5. SQLite Storage

**Location:** `knowledge/knowledge.db` (created on startup).

### 5.1 Schema

**`items` table:**

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `item-<ts>-<rand>` |
| `url` | TEXT UNIQUE | |
| `type` | TEXT | `youtube` or `web` |
| `title` | TEXT | default `''` |
| `author` | TEXT | nullable |
| `status` | TEXT | `queued / processing / done / error` |
| `transcript` | TEXT | nullable |
| `summary` | TEXT | nullable |
| `sections` | TEXT | JSON array, nullable |
| `tags` | TEXT | JSON array, nullable |
| `error` | TEXT | nullable |
| `date_added` | TEXT | ISO 8601 |
| `read_at` | TEXT | nullable, ISO 8601 |
| `tldr` | TEXT | JSON array, nullable |

**`tags` table:**

| Column | Type | Notes |
|---|---|---|
| `name` | TEXT PK | |
| `status` | TEXT | `pending / approved / rejected` |
| `created_at` | TEXT | ISO 8601 |
| `rejected_at` | TEXT | nullable, set on rejection |

### 5.2 Persistence behavior

**Acceptance criteria:**
- `insertItem` uses `INSERT OR IGNORE` — duplicate URLs are silently skipped.
- `updateItem` serializes arrays and objects to JSON strings automatically.
- `listItems` excludes transcript (returns `NULL`) for performance; only `status = 'done'` rows returned, ordered by `date_added DESC`.
- `getItem` returns full row including transcript.
- `searchItems` also excludes transcript from the row, ordered `date_added DESC`.
- Migration: `read_at` and `tldr` columns added via `ALTER TABLE ... IF NOT EXISTS` (catches errors for pre-existing DBs).

---

## 6. Tag Management

See `specs/tags.spec.md` for full tag lifecycle specification.

**Summary:**
- Tags start as `pending` when the LLM generates them.
- Users approve or reject tags via the popup or web app.
- Approved tags are fed back into future summarization prompts.
- Rejected tags are excluded from future prompts (LLM will not reuse them).
- Rejecting a tag on an item triggers re-tagging that item via `suggestTags`.

---

## 7. Read Indicator

**Behavior:** Opening an item's reader marks it as read (`POST /items/:id/read`). The read state is stored as `read_at` (ISO timestamp).

**Acceptance criteria:**
- Read items display a green dot (`read-dot`) in the list.
- Read item titles display at 55% opacity (`is-read` class).
- Extension popup: read state is applied optimistically (before server confirms).
- Web app: `readAt` set optimistically in local state, then confirmed by re-fetching the full item.
- `read_at` is set to the current UTC ISO timestamp on every call to `markRead`; re-reading an already-read item updates the timestamp.
- `POST /items/:id/read` for unknown id → `404 { error: "Item not found" }`.

---

## 8. Search

### 8.1 `GET /search?q=<text>&tag=<tag>`

**Behavior:** Returns `status = 'done'` items matching all provided criteria. If neither `q` nor `tag` is provided, returns `[]`.

**`q` matching:** LIKE `%q%` against `title`, `summary`, `transcript`, `sections` (JSON string).

**`tag` matching:** LIKE `%"<tag>"%` against the `tags` JSON column. Matches exact tag name as a JSON string value.

**Acceptance criteria:**
- `q` only → full-text LIKE match across 4 columns.
- `tag` only → exact tag match in JSON array.
- Both → AND combination.
- Neither → empty array, no DB query.
- Results ordered `date_added DESC`, transcript excluded from row.

### 8.2 Extension popup search

- 300 ms debounce on input.
- Hits `GET /search?q=<text>` server-side, then applies client-side tag and date filters on top of the result.
- Empty query clears search and shows full filtered list.

### 8.3 Web app search

- 300 ms debounce (client-side `useMemo` on `allItems`).
- Filters in memory: `title`, `summary`, `transcript` (lowercase includes).
- Combined with tag and date filters in the same `useMemo`.
- Does not call the server search endpoint.

---

## 9. Filtering

### 9.1 Tag filters (multi-tag AND)

**Behavior:** Active tag filters are stored as a string array. Items must include all active tags to be shown.

**Acceptance criteria:**
- Adding a tag filter appends to the list (no duplicates).
- Removing a tag filter removes it from the list.
- Multi-tag AND: item must contain every active filter tag.
- Tag chips in item rows are only shown for approved tags.
- Clicking an approved tag chip in the list adds it as a filter.

### 9.2 Date quick filters

**Options:** All (0), Today (1), 2d, 3d, 4d — expressed as "last N × 24 h".

**Acceptance criteria:**
- `activeDays = 0` means no date restriction.
- `activeDays = N` means `dateAdded >= now - N * 86400000 ms`.
- Only one date filter active at a time; clicking a new one replaces the previous.
- "All" button is active by default.

### 9.3 Clear all

**Behavior:** Resets search text, tag filters, and date filter to defaults.

---

## 10. REST API Reference

| Method | Path | Description |
|---|---|---|
| GET | `/health` | `{ ok: true }` |
| GET | `/items` | All `done` items (no transcript) |
| GET | `/items/:id` | Single item with full transcript |
| POST | `/items/:id/read` | Mark item read |
| GET | `/status/:id` | `{ id, status, title, summary, error? }` |
| POST | `/process` | Enqueue URL for processing |
| GET | `/search?q=&tag=` | Full-text + tag search |
| GET | `/tags` | `{ approved[], pending[{tag,itemId,itemTitle}], rejected[] }` |
| POST | `/tags/approve` | `{ tag }` → approve tag |
| POST | `/tags/reject` | `{ tag, itemId? }` → reject tag, optionally re-tag item |

**CORS:** All responses include `Access-Control-Allow-Origin: *`. `OPTIONS` preflight returns `204`.

**Server:** Binds to `127.0.0.1:3737` only (localhost, no external access).

**Static route:** `GET /` serves the React web app (`web/index.html`).

---

## 11. Browser Extension Popup

**Width:** 640 px, max-height 80vh (scrollable).

**Sections (top to bottom):**
1. Header — title + current tab URL (truncated).
2. Save section — "Save to Knowledge Base" button + status message.
3. Pending tags bar — hidden when 0 pending; shows count + "Review →" button (opens web app).
4. Search bar — debounced 300 ms.
5. Filter bar — tag chips (hidden when empty) + date buttons (All/Today/2d/3d/4d).
6. Items list — max 50 items; each row has title link, date, approved tag chips, visit button (↗), and Read button.
7. Modal overlay — full-popup reader showing TL;DR, summary, sections, tags (with inline approve/reject for pending), "Open original" link, collapsible transcript.

**Acceptance criteria:**
- Items list capped at 50.
- Only approved tags shown as clickable chips on item rows.
- Pending tags shown in modal with inline approve/reject buttons.
- Rejected tags hidden in modal.
- "Review →" button opens `http://127.0.0.1:3737/` in a new tab.
- Title link and visit button open URL in new tab.
- Modal opened via "Read" button; closes via × button.
- Refresh button (↻) re-fetches items list.

---

## 12. React Web App

**URL:** `http://127.0.0.1:3737/`

**Layout:** Two-column — left pane (item list) + right pane (reader). Full-page header with search, filters, and tags button.

### 12.1 Item list pane

- Shows count of filtered items.
- Each `ItemCard`: read dot, title, type badge (YT/WEB), date, approved tag chips.
- Clicking a tag chip adds it as an active filter.
- Clicking a card selects it, marks it read, and fetches the full item.
- Active card is highlighted (`.active` class).

### 12.2 Reader pane

- Empty state: "Select an item to read."
- When item selected: title, meta (date, author, "Open original →"), TL;DR, Summary, Key Points (sections), Tags, Related, Transcript (collapsible).
- Tags: approved shown green; pending shown with inline approve/reject buttons; rejected hidden.
- Related items: up to 3 items with the most tag overlap, showing shared tags. Clicking navigates to that item.

### 12.3 Tags panel

- Opened by header "Tags" / "⚑ N pending" button.
- Shows all pending tags with associated item title.
- Per-row approve (✓) and reject (✗) buttons.
- Closed by × button or clicking the backdrop.
- Empty state: "No pending tags — all clear."

### 12.4 Search (web app)

- Search is client-side against `allItems` in memory (title, summary, transcript).
- Combined with tag/date filters in a single `useMemo`.
- 300 ms debounce from input to `searchQuery` state update.

---

## 13. Error Handling

| Scenario | Behavior |
|---|---|
| Ollama not running | Item saved as `error` with message "Ollama not running — start with: ollama serve" |
| Ollama timeout | Item saved as `error` with message "Ollama timed out — is it still running?" |
| Ollama HTTP error | Item saved as `error` with "Ollama returned HTTP <N>" |
| YouTube no transcript | Item saved as `error` with "No transcript available — video may be private or captions disabled" |
| Web fetch non-2xx | Item saved as `error` with "HTTP <N> fetching <url>" |
| Readability parse fail | Item saved as `error` with "Readability could not parse content from <url>" |
| LLM returns no JSON | `summarize` returns `{ tldr: [], summary: "<first 200 chars>", sections: [], tags: [] }` — item is saved as `done` with partial data |
| Extension server down | Save button disabled; items list replaced with error message |
| Extension search/fetch error | Items list shows "Could not load items." or "Search failed." |
| Modal fetch error | Modal body shows "Error loading item: <message>" in red |
| `GET /items/:id` unknown id | `404 { error: "Item not found" }` |
| `GET /status/:id` unknown id | `404 { error: "Item not found" }` |
| `POST /process` bad body | `400 { error: ... }` |
| `POST /tags/approve` missing tag | `400 { error: "Missing tag field" }` |
| `POST /tags/reject` missing tag | `400 { error: "Missing tag field" }` |
| Unknown route | `404 { error: "Not found" }` |

---

## 14. Out of Scope

- Multi-user / authentication
- Cloud sync or remote storage
- Pagination (list capped at 50 in popup; web app renders all)
- Manual transcript upload
- JavaScript-rendered pages
- Scheduling / batch re-summarization

---

## 15. Semantic Search

**Entry point:** `GET /search?q=<text>&semantic=true`

**Behavior:** Generates a vector embedding for the query using the local Ollama embedding model, then returns items ranked by cosine similarity against stored embeddings.

**Acceptance criteria:**
- `semantic=true` with a query → embedding generated via `generateEmbedding(q)`, results returned from `semanticSearch(embedding)`.
- Similarity threshold: 0.25 (items below threshold excluded).
- Falls back to 503 `{ error: "Semantic search unavailable" }` if embedding generation fails.
- `GET /embed/status` returns `{ total, embedded, pending }` showing how many items have been embedded.
- Embeddings are generated asynchronously after item processing completes and stored in `item_embeddings` table.
- Web app: "Semantic" checkbox in header toggles `semanticMode` state; when active, search queries use `semantic=true`.

**FTS fallback:** When `semantic=false` (default), FTS via `ftsSearch(q)` is tried first; if FTS returns results they are returned (each item gets a `snippet` field with highlighted match). Falls through to LIKE search if FTS fails or returns no results.

---

## 16. Collections

**Behavior:** Items can be organized into named collections. Collections are independent of tags.

**API:**

| Method | Path | Description |
|---|---|---|
| GET | `/collections` | List all collections |
| POST | `/collections` | `{ name }` → create collection, returns `{ id }` (201) |
| DELETE | `/collections/:id` | Delete collection (items are not deleted) |
| PATCH | `/collections/:id` | `{ name }` → rename collection |
| GET | `/collections/:id/items` | List items in collection |
| POST | `/collections/:id/items` | `{ itemId }` → add item to collection |
| DELETE | `/collections/:id/items/:itemId` | Remove item from collection |
| POST | `/collections/:id/items/batch` | `{ itemIds[] }` → add multiple items |
| GET | `/items/:id/collections` | List collections containing item |

**Acceptance criteria:**
- Duplicate collection name → 409.
- Deleting a collection does not delete its items.
- Items can belong to multiple collections.
- `listCollections()` returns all collections with `id`, `name`, `createdAt`.

---

## 17. Export

**Behavior:** Users can export their full knowledge base in multiple formats.

**Endpoints:**

| Method | Path | Description |
|---|---|---|
| GET | `/export/json` | Download all items as JSON array (attachment) |
| GET | `/export/markdown` | Download all items as Markdown file (attachment) |
| GET | `/digest?days=N&format=text` | Generate reading digest for last N days |

**Acceptance criteria:**
- `/export/json` → `Content-Type: application/json`, `Content-Disposition: attachment; filename="knowledge-base-<date>.json"`, body is JSON array of all items.
- `/export/markdown` → `Content-Type: text/markdown`, attachment, body has `## <title>` sections with URL, date, tags, TL;DR, summary.
- `/digest` → Markdown digest with highlights; `format=text` returns `text/plain` (no attachment).
- Export includes all items (not filtered by status).
- Web app ExportButton shows dropdown with JSON, Markdown, Weekly Digest, Monthly Digest options.

---

## 18. Tag Management

**Full lifecycle:** Tags start `pending` → user approves or rejects → approved tags fed back to LLM prompts; rejected tags excluded.

**Extended operations:**

| Endpoint | Body | Description |
|---|---|---|
| POST `/tags/approve` | `{ tag }` | Approve a tag |
| POST `/tags/reject` | `{ tag, itemId? }` | Reject tag; optionally re-tag item |
| POST `/tags/rename` | `{ from, to }` | Rename an approved tag (404 if not found) |
| POST `/tags/merge` | `{ from, to }` | Merge `from` into `to`; returns `{ ok, itemsUpdated }` |
| POST `/tags/consolidate/suggest` | — | LLM suggests synonym groups for deduplication |
| POST `/tags/consolidate/apply` | `{ groups[] }` | Apply suggested merges |
| GET `/tags/stats` | — | Per-tag item counts |
| GET `/tags/suggestions` | — | Items with unapproved (raw LLM) tags |

**Acceptance criteria:**
- `POST /tags/merge` replaces `from` in all items' `tags` JSON arrays with `to`, removes the `from` tag row, returns count of updated items.
- `POST /tags/rename` fails with 404 if `from` is not in the approved list.
- Tag consolidation uses Ollama to find synonym clusters; apply endpoint iterates groups and calls `mergeTags` for each pair.

---

## 19. RSS Feeds

**Behavior:** Users subscribe to RSS/Atom feeds. The server auto-checks all active feeds every 30 minutes and enqueues new items.

**API:**

| Method | Path | Description |
|---|---|---|
| GET | `/feeds` | List all feeds |
| POST | `/feeds` | `{ url, name? }` → subscribe to feed |
| DELETE | `/feeds/:id` | Unsubscribe |
| POST | `/feeds/:id/check` | Manually trigger a feed check |

**Acceptance criteria:**
- Duplicate feed URL → 409.
- On subscription, feed is checked immediately (non-blocking).
- New feed items are enqueued via the standard processing pipeline.
- Items already in the DB (by URL) are skipped; `feedId` is stored on each item.
- Feed check tracks `lastItemDate` and `itemCount`.
- Auto-check fires 5 seconds after startup, then every 30 minutes.
- Missing/erroring feeds are logged and skipped without crashing the server.

---

## 20. Queue Reliability

**Startup recovery:**
- On server start, items with `status = 'processing'` are reset to `queued` (they were abandoned mid-flight when the server died).
- Items with `status = 'queued'` and `retries < MAX_RETRIES` are re-enqueued.

**Retry on error:**
- When item processing fails, `retries` is incremented.
- Items with `retries >= MAX_RETRIES` (default 3) are not re-enqueued.
- `GET /stats/summary` exposes error counts.

**Concurrency:**
- Processing semaphore limits concurrent extractions to avoid overwhelming Ollama.
- Items are processed in FIFO order within the semaphore.

**Acceptance criteria:**
- Crashed items (stuck in `processing`) are recovered within 5 seconds of restart.
- Failed items with retry budget remaining are automatically retried.
- Retry count is persisted in the `retries` column of the `items` table.

---

## 21. Content Extraction

### 21.1 YouTube (`src/extract/youtube.ts`)

Extracts video ID, fetches page title from youtube.com, fetches transcript via `youtube-transcript`.

**Supported URL formats:** `youtube.com/watch?v=`, `youtu.be/`, `youtube.com/shorts/`, `youtube.com/embed/`

**Returns:** `{ title, content: "<joined transcript>", url }` or `{ title, content: '', url, extractionError }`.

### 21.2 Web (`src/extract/web.ts`)

Fetches URL with browser User-Agent, parses HTML with `linkedom`, extracts article with `@mozilla/readability`.

**Returns:** `{ title, author?, content, url }`. Throws on HTTP error or Readability failure.

### 21.3 PDF (`src/extract/pdf.ts`)

Detects PDF by URL extension or Content-Type. Runs `pdftotext` (poppler) as a subprocess.

**Returns:** `{ title, content, url }`. `title` derived from filename if metadata unavailable.

### 21.4 Video (`src/extract/video.ts`)

For non-YouTube video URLs (`.mp4`, `.mkv`, etc.). Downloads audio with `yt-dlp`, transcribes with `Whisper`.

**Returns:** `{ title, content: "<transcript>", url }`. Falls back to empty content with `extractionError` if tools are unavailable.

**Acceptance criteria (all extractors):**
- `isPdfUrl(url)` checked before type detection; PDF takes priority.
- Extraction errors set item `status = 'error'` with the error message stored in `error` column.
- `GET /system/status` reports which tools (`whisper`, `yt-dlp`, `pdftotext`, `ollama`) are available.

---

## 22. User Settings

**Stored in `settings` table as key-value pairs.**

| Key | Values | Default | Description |
|---|---|---|---|
| `language` | `english`, `original` | `english` | Summarization language |
| `keep_original_terms` | `1`, `0` | `1` | Include original terms in parentheses |
| `theme` | `dark`, `light` | `dark` | UI theme |
| `summary_detail` | `brief`, `standard`, `detailed` | `standard` | Summary verbosity |
| `notifications_enabled` | `1`, `0` | `0` | Browser notifications on item completion |
| `daily_reading_goal` | integer string | `5` | Items per day goal |
| `weekly_reading_goal` | integer string | `20` | Items per week goal |

**API:**
- `GET /settings` → `{ [key]: value }` map of all settings.
- `POST /settings` → `{ key, value }` → update a setting. Returns 400 if `key` or `value` missing.

**Web app:**
- Settings panel opened via gear button (⚙) in header.
- Theme toggle (☀️/🌙 button) updates `theme` setting and toggles `theme-light` / `theme-dark` class on `<body>`.
- Settings changes are persisted to the server immediately.

---

## 23. Star / Pin / Archive / Rate

**Item state fields stored in the `items` table:**

| Field | Type | Description |
|---|---|---|
| `starred` | INTEGER (0/1) | User-starred item |
| `pinned` | INTEGER (0/1) | Pinned to top of list |
| `archived` | INTEGER (0/1) | Hidden from main list |
| `rating` | INTEGER (1–5, nullable) | User rating |

**API:**

| Method | Path | Description |
|---|---|---|
| POST | `/items/:id/star` | Toggle star; returns `{ starred }` |
| POST | `/items/:id/pin` | Toggle pin; returns `{ pinned }` |
| POST | `/items/:id/archive` | Toggle archive; returns `{ archived }` |
| POST | `/items/:id/rate` | `{ rating: 1–5 }` → set rating; 400 if out of range |
| GET | `/items/archived` | List archived items |

**Web app:**
- Star (☆/★) and pin (📌) buttons on each `ItemCard`.
- Archived items excluded from main `listItems()` query (`COALESCE(archived, 0) = 0`).
- Rating widget in reader pane (1–5 stars, clickable).
- Starred items show ★ filled; pinned items float to top of sorted list.

**Acceptance criteria:**
- `POST /items/:id/star` for unknown id → 404.
- `POST /items/:id/rate` with rating outside 1–5 → 400 `{ error: "Rating must be an integer between 1 and 5" }`.

---

## 24. Chrome Extension Queue Persistence

**File:** `extension/popup.js`

**Behavior:** The extension maintains a local queue of URLs pending save, stored in `chrome.storage.local` under the key `kb_queue`. This survives browser restarts and extension reloads.

**Queue lifecycle:**
1. User clicks "Save" → URL appended to `kb_queue` in storage.
2. Background processing loop reads queue, calls `POST /process` for each URL.
3. Successfully processed URLs are removed from the queue.
4. On popup open, queue is checked and pending items are shown.

**Acceptance criteria:**
- Queue persists across popup close/open cycles.
- If `POST /process` fails (server down), URL remains in queue and is retried on next popup open.
- Queue is deduped — same URL is not added twice.
- Queue state is shown in popup UI with count of pending items.
- `chrome.storage.local` is used (not `localStorage`), so the queue is not cleared by private browsing mode.
