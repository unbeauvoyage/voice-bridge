---
title: Delete Article
status: implemented
created_at: 2026-04-11T20:39:05
---

## Overview

Allow users to permanently delete a single article from the reader pane. This is a destructive, irreversible action — the feature requires explicit confirmation before the delete is committed.

---

## Backend

### Endpoint

`DELETE /items/:id` — already exists in `src/server.ts`.

Returns `{ ok: true }` on success, `{ error: "Item not found" }` with status 404 if the id does not exist.

### Data removal scope

When `deleteItem(id)` is called, the following rows must be removed:

| Table | Condition |
|---|---|
| `item_embeddings` | `item_id = id` |
| `collection_items` | `item_id = id` |
| `summary_history` | `item_id = id` |
| `tag_rejections` | `item_id = id` |
| `highlights` | cascades via `ON DELETE CASCADE` on `item_id → items(id)` |
| `items` | `id = id` (FTS delete trigger fires automatically) |

The `tags` table is **not** touched — approved tags are shared vocabulary and must survive item deletion. The item's tag associations are stored as a JSON column on the item row itself, which is removed with the item.

---

## UI — Reader Pane

### Delete button

- Location: sticky header toolbar, after the archive button and before the fullscreen button
- Icon: trash can emoji (`🗑`) with tooltip "Delete article"
- Class: `reader-delete-btn`

### Confirmation flow

1. User clicks the delete button — the button label changes to show inline "Are you sure?" with two inline buttons: **Delete** (confirm) and **Cancel**
2. If the user clicks elsewhere (blur/document click), the confirmation auto-cancels
3. On confirm: call `DELETE /items/:id`, close the reader pane (`setSelectedId(null)`), remove the item from the list (`setAllItems(prev => prev.filter(it => it.id !== id))`)
4. No browser `alert()`, no modal — inline only

### Props change

`ReaderPane` receives a new prop:
```ts
onDelete: (id: string) => Promise<void>
```

---

## Tests

File: `src/db.test.ts`

1. `deleteItem removes item and associated rows` — inserts an item with a `collection_items` row and a `summary_history` row, calls `deleteItem`, then asserts: item is gone, `collection_items` row is gone, `summary_history` row is gone.
