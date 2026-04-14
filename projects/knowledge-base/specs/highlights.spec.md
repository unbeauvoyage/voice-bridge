---
type: spec
feature: highlights
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Text annotation system allowing users to select and save passages from item summaries, TL;DR bullets, and section points inside the reader pane.
---

## Overview

Users can select any text in the reader pane (TL;DR, summary, key-point sections) and save it as a highlight. Highlights are stored per item, shown inline with `.user-highlight` styling, and collected in a "Highlights" panel at the bottom of the reader. Clicking a saved highlight deletes it.

## Data Model

Table: `highlights` (added in migration v15)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `crypto.randomUUID()` |
| `item_id` | TEXT | FK → `items(id)` ON DELETE CASCADE |
| `text` | TEXT NOT NULL | Selected text |
| `comment` | TEXT | Optional annotation (field exists; UI does not currently populate it) |
| `section` | TEXT NOT NULL | Logical section: `'tldr'`, `'summary'`, or section title string |
| `created_at` | TEXT | ISO timestamp |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/items/:id/highlights` | Returns `Highlight[]` ordered by `created_at ASC` |
| POST | `/items/:id/highlights` | Body: `{ text, section, comment? }`. Returns `{ id }` (201). 400 if `text` or `section` missing. |
| DELETE | `/highlights/:id` | Deletes highlight. Returns `{ ok: true }`. |

## UI Behaviour

1. When the reader pane loads an item, `api.getHighlights(item.id)` is called and results stored in `highlights` state.
2. Any `mouseup` inside a section element (`handleSectionMouseUp(section)`) checks `window.getSelection()`. If non-empty text is selected, a floating "Highlight" tooltip button appears near the cursor (`highlightTooltip` state with `{ x, y, section }`).
3. Clicking the tooltip calls `api.saveHighlight` and appends the new `Highlight` to local state. The tooltip is dismissed.
4. `renderWithHighlights(text, section)` splits the text string around all saved highlight ranges for that section and wraps matched ranges in `<span className="user-highlight">`. Highlights are matched by substring position in text insertion order; overlapping ranges are skipped.
5. Clicking a `.user-highlight` span calls `handleDeleteHighlight(id)` which calls `api.deleteHighlight` and removes it from state.
6. If `highlights.length > 0`, a "Highlights" panel renders below notes/transcript showing all saved texts with a delete button per row.
7. Highlights are cleared from local state when the selected item changes.

## Edge Cases

- If the same text appears multiple times in a section, the first un-overlapping occurrence is matched.
- If `comment` is not provided in the POST body, the column is stored as NULL.
- Cascade delete: deleting the parent item also deletes all its highlights (FK constraint).

## How to Test

1. Open an item with summary text. Select some words. Expect the "Highlight" tooltip to appear.
2. Click "Highlight". Expect selected text to be styled and the Highlights panel to appear at bottom.
3. Reload the page and open the same item. Expect highlight to persist (fetched from server).
4. Click a highlighted span. Expect it to be removed from the Highlights panel and inline styling to disappear.
5. Delete the parent item. Confirm `GET /items/:id/highlights` returns 404 or empty after re-creation.
