---
type: spec
feature: sort-ui
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Client-side sort dropdown, content-type filter pills (All / YouTube / Web / PDF), and unread-only toggle that together control which items appear in the list.
---

## Overview

All list filtering and sorting is done client-side on the full `allItems` array. Sort preference is persisted to `localStorage`. Type filter and unread toggle are session-only state.

## Sort Options

Controlled by a `<select>` element in the list toolbar. Selected value is stored in `localStorage` under key `kb-sort` and restored on mount.

| Value | Behaviour |
|---|---|
| `newest` (default) | `date_added DESC` |
| `oldest` | `date_added ASC` |
| `recently-read` | `read_at DESC` (unread items pushed to end, ordered by `date_added DESC`) |
| `highest-rated` | `rating DESC NULLS LAST`, then `date_added DESC` |
| `most-starred` | starred first, then `date_added DESC` |
| `title-az` | `title ASC` (locale-aware, falls back to URL) |
| `title-za` | `title DESC` |

Pinned items always float to the top regardless of sort option (pinned = 1 sorted first by `pinned DESC`).

The `GET /items?sort=rating` server endpoint exists and uses `ORDER BY rating DESC NULLS LAST` server-side, but the client does all sorting locally using `filteredItems` memo — the server sort is not used by the main list view.

## Type Filter Pills

Four pill buttons rendered inline in the list toolbar:

| Label | `typeFilter` value |
|---|---|
| All | `'all'` |
| YouTube | `'youtube'` |
| Web | `'web'` |
| PDF | `'pdf'` |

Active pill has class `type-pill active`. Clicking a pill sets `typeFilter` state.

Filter logic:
- `'youtube'` and `'web'`: match `item.type === typeFilter`
- `'pdf'`: matches `item.url.toLowerCase().endsWith('.pdf')` (no dedicated type field; PDFs are stored as type `'web'`)
- `'all'`: no filter applied

## Unread Toggle

A button labelled "Unread" (class `unread-toggle`, `active` when on). Toggling sets `unreadOnly` state.

When `unreadOnly` is true: `items.filter(it => !it.readAt)` — items without a `readAt` timestamp.

## Interaction with Other Filters

Sort, type filter, and unread toggle all participate in the same `filteredItems` memo. They stack with search query, tag filters, date filter, starred-only, and archived-only. `visibleCount` resets to 30 whenever any of these change (infinite scroll reset).

## How to Test

1. Add items of different types. Select "YouTube" pill — verify only YouTube items appear.
2. Select "PDF" pill — verify only items with `.pdf` URL suffix appear.
3. Mark one item as read. Enable "Unread" toggle — expect read item to disappear.
4. Change sort to "Title A→Z" — verify alphabetical order. Reload page — verify sort persists.
5. Pin an item. Change sort to "oldest" — verify pinned item still appears first.
6. Combine type filter + unread toggle + tag filter — verify all three apply simultaneously.
