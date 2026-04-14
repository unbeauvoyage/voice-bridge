---
type: spec
feature: filter-presets
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Named snapshots of the current filter state (search query, tags, date range, type, semantic mode, starred-only) that can be saved and loaded in one click.
---

## Overview

Filter presets let users freeze a combination of active filters under a name and restore them instantly. They are displayed in a "Presets" dropdown in the header. The "Save current filters" option only appears when at least one filter is active.

## Data Model

Table: `filter_presets` (added in migration v14)

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `preset-{timestamp}-{random}` |
| `name` | TEXT NOT NULL | User-supplied name |
| `search_query` | TEXT | Nullable |
| `tag_filter` | TEXT | JSON array of tag strings, nullable |
| `date_filter` | TEXT | Days as string (e.g. `"7"`), nullable |
| `type_filter` | TEXT | `'youtube'`, `'web'`, `'pdf'`, or NULL |
| `semantic_mode` | INTEGER | 0 or 1 |
| `show_starred_only` | INTEGER | 0 or 1 |
| `created_at` | TEXT | ISO timestamp |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/filter-presets` | Returns `FilterPreset[]` ordered by `created_at ASC` |
| POST | `/filter-presets` | Body: `{ name, searchQuery?, tagFilter?, dateFilter?, typeFilter?, semanticMode?, showStarredOnly? }`. Returns `{ id }` (201). 400 if `name` missing. |
| DELETE | `/filter-presets/:id` | Deletes preset. Returns `{ ok: true }`. |

### FilterPreset shape (client)

```ts
{
  id: string;
  name: string;
  searchQuery: string | null;
  tagFilter: string[];
  dateFilter: string | null;
  typeFilter: string | null;
  semanticMode: boolean;
  showStarredOnly: boolean;
  createdAt: string;
}
```

## UI Behaviour

1. On app mount, `api.getFilterPresets()` is called and results stored in `filterPresets` state.
2. A "Presets" button in the header opens a dropdown listing all saved presets.
3. Each preset row shows its name, a "Load" button, and a delete (×) button.
4. Clicking "Load" calls `handleLoadPreset(preset)` which sets `searchText`, `activeTagFilters`, `activeDays`, `semanticMode`, and `showStarredOnly` from the preset fields. The dropdown closes.
5. If `hasActiveFilters` is true (any of `searchText`, `activeTagFilters`, `activeDays`, or `showStarredOnly` is set), a "+ Save current filters" button appears in the dropdown.
6. Clicking it shows a name input inline. Pressing Enter or clicking "Save" calls `handleSavePreset()`:
   - Calls `api.saveFilterPreset(name, { searchQuery, tagFilter, dateFilter, semanticMode, showStarredOnly })`
   - Refreshes preset list from server
   - Closes input
7. Clicking × on a preset calls `api.deleteFilterPreset(id)` and removes it from local state.
8. `typeFilter` and `unreadOnly` are captured in the data model but `handleSavePreset` does **not** currently persist them (they are not included in the `api.saveFilterPreset` call).

## Edge Cases

- Empty name is rejected client-side (save button disabled when input is blank).
- `tagFilter` is stored as JSON in SQLite; parsing errors fall back to `[]`.
- `dateFilter` is stored as a numeric string; parsed with `parseInt` on load.

## How to Test

1. Set a search query + tag filter. Open Presets dropdown — expect "+ Save current filters" to be visible.
2. Save with name "My preset". Expect it to appear in the list.
3. Clear all filters. Load the preset. Expect search input and tag filters to be restored.
4. Delete the preset. Expect it to disappear from the dropdown.
5. Reload page. Expect persisted preset to still be listed (fetched from server on mount).
