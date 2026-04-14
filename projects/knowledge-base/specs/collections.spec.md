---
type: spec
feature: collections
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Manual collections that group items into named sets, with single-item and batch-add flows and per-collection filtering in the list view.
---

## Overview

Collections are user-created named groups of items. There is no "smart" collection logic — membership is always set explicitly. Viewing a collection filters the main list to only its members.

## Data Model

### `collections` table

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `col-{timestamp}-{random}` |
| `name` | TEXT NOT NULL UNIQUE | |
| `created_at` | TEXT | ISO timestamp |

### `collection_items` table

| Column | Type | Notes |
|---|---|---|
| `collection_id` | TEXT | FK (no DB-level constraint declared) |
| `item_id` | TEXT | |
| `added_at` | TEXT | ISO timestamp |
| PK | (collection_id, item_id) | Composite |

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/collections` | Returns `CollectionSummary[]` with `itemCount` |
| POST | `/collections` | Body: `{ name }`. Returns `{ id }` (201). 409 if name exists. |
| DELETE | `/collections/:id` | Deletes collection and all its membership rows. |
| PATCH | `/collections/:id` | Body: `{ name }`. Rename. 409 if name exists. |
| GET | `/collections/:id/items` | Returns `KnowledgeItem[]` ordered by `added_at DESC` |
| POST | `/collections/:id/items` | Body: `{ itemId }`. Add one item. Uses `INSERT OR IGNORE`. |
| DELETE | `/collections/:id/items/:itemId` | Remove one item. |
| POST | `/collections/:id/items/batch` | Body: `{ itemIds: string[] }`. Add multiple items. |
| GET | `/items/:id/collections` | Returns `{ id, name }[]` — which collections an item belongs to. |

### `CollectionSummary` shape

```ts
{ id: string; name: string; itemCount: number }
```

## UI Behaviour

### Collections Panel

A "Collections" button in the header opens a side panel (`showCollectionsPanel`). The panel lists all collections with their item counts.

- Clicking a collection name sets `activeCollectionId` in state and closes the panel. The header button shows the active collection name.
- An "All items" option clears `activeCollectionId`.
- Create: type a name and press Enter or click "+". 409 responses show "name already exists".
- Rename: inline edit (not yet implemented in visible code — PATCH endpoint exists server-side).
- Delete: × button on each collection row.

### Filtering by Collection

When `activeCollectionId` is set:
1. On panel open, `api.getCollectionItems(id)` fetches all items in the collection.
2. Their IDs are stored in `itemsInCollections` (a `Set<string>`).
3. `filteredItems` memo applies `items.filter(it => itemsInCollections.has(it.id))`.

### Adding Items to a Collection

- From the item card action menu or reader pane: a collection picker shows all collections; clicking one calls `api.addItemToCollection`.
- Batch: selecting multiple items in selection mode and choosing a collection calls `api.batchAddToCollection`.

## Edge Cases

- Duplicate adds are silently ignored (`INSERT OR IGNORE`).
- Deleting a collection does not delete the items, only membership rows.
- `itemCount` in the list response is from a LEFT JOIN COUNT — it may lag if items are deleted without removing memberships.

## How to Test

1. Create a collection named "Research". Expect it to appear in the panel with count 0.
2. Add 2 items to it. Click "Research" — expect list to show only those 2 items.
3. Click "All items" — expect full list to return.
4. Batch-add 3 more items. Expect collection count to update to 5.
5. Delete the collection. Expect it to disappear; items remain in the library.
6. Try creating a duplicate name — expect 409 / error message.
