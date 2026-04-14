---
type: spec
feature: duplicate-url-warning
status: implemented
created: 2026-04-11T17:33:42
updated: 2026-04-11T18:08:16
summary: When saving a URL that already exists in the knowledge base, show an immediate inline warning with options to dismiss or save again, rather than silently queuing again.
---

## Overview

Before the user submits a URL to save, the app checks whether that URL is already in the knowledge base and shows an inline warning. This prevents accidental duplicate saves and surfaces the save-again option clearly.

The check happens proactively (as the user types or on popup load), not only after submit.

## Where It Appears

### Extension popup (`extension/popup.js`)

On popup load, if the current tab's URL already exists in the knowledge base:
- Show a yellow/amber banner above the save button
- Banner text depends on item status:
  - `done`: "Already saved: [title] · [Save again]"
  - `queued` / `processing`: "Currently being processed…"
  - `error`: "Saved previously but processing failed · [Retry]"
- Dismiss button (×) on the banner to hide it; dismissing restores the save button
- "Save again" calls `POST /items/:id/resummarize`
- Save button is hidden while the banner is visible (avoids two conflicting actions on screen)

### Web quick-capture modal (`web/app.tsx` → `QuickCaptureModal`)

When the user types a valid URL into the quick-capture input:
- After 400 ms debounce, call `GET /items/check?url=...`
- If `exists: true` and status `done`: show inline message below input — "Already saved: [title]" with a "Save again" button
- If status `queued` / `processing`: show "Currently being processed…"
- If `exists: false`: no message shown
- Submit still works — `POST /process` returns `{ status: 'exists' }` which is handled gracefully

## API

### `GET /items/check?url={url}`

New dedicated endpoint. Returns:

```json
{ "exists": false }
```

or:

```json
{
  "exists": true,
  "id": "item-...",
  "status": "done",
  "title": "Page Title"
}
```

Response shape is minimal — only what the UI needs. Does not return full item body.

Uses the existing `getItemByUrl()` DB function internally.

## UI Behaviour

### Extension

| Item state | Banner text | Actions | Save button |
|---|---|---|---|
| `done` | Already saved: {title} | Save again, Dismiss | Hidden (restored on dismiss) |
| `queued` / `processing` | Currently being processed… | Dismiss | Hidden (restored on dismiss) |
| `error` | Saved previously, processing failed | Retry, Dismiss | Hidden (restored on dismiss) |
| Not found | (no banner) | — | Visible |

### Quick-capture

| Item state | Inline hint text |
|---|---|
| `done` | Already saved: {title} · [Save again] |
| `queued` / `processing` | Currently being processed… |
| Not found | (no hint) |

"Save again" in the quick-capture modal calls `POST /items/:id/resummarize` and then closes the modal.

## How to Test

1. Save any URL (e.g. `https://example.com`) and wait for it to reach `done` status.
2. **Extension:** Open popup on that same URL — expect the amber "Already saved" banner to appear automatically.
3. **Extension:** Click "Save again" — expect the item to re-enter processing. Banner should update to "Currently being processed…".
4. **Extension:** Click Dismiss (×) on the banner — expect it to hide.
5. **Web quick-capture:** Open with Ctrl+L and paste the same URL — expect "Already saved: [title]" to appear below the input after ~400 ms.
6. **Web quick-capture:** Click "Save again" — expect modal to close and item to re-enter processing.
7. **API:** `GET /items/check?url=https://example.com` → `{ exists: true, id: "...", status: "done", title: "..." }`.
8. **API:** `GET /items/check?url=https://not-saved.example.com` → `{ exists: false }`.
