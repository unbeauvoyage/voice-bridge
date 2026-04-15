# Feature Design Spec: Extension Collections Filter

**Status:** Draft  
**Priority:** High  
**Author:** phase4-coder-a  
**Date:** 2026-04-15  
**Project:** knowledge-base

---

## Problem / Why

CEO uses collections in the web app to organize items by project, topic, or workflow. The extension is the primary interface but currently cannot filter items by collection — forcing context-switch to web to view collection-specific items.

CEO needs to quickly filter extension item list by collection without leaving the extension modal.

---

## Current State (what exists)

**Web app:**
- Collections panel in sidebar (add, rename, delete, filter)
- Collection filter dropdown: "All" + collection names
- Clicking a collection filters item list to that collection
- Query: `useCollectionsQuery()` fetches all collections
- Query: `useItemsInCollectionsQuery()` returns items grouped by collection
- Filter state: stored in Zustand `activeCollectionId` (P4e will move to Zustand UI store)
- Visual: collection name highlighted when active, click to clear filter

**Extension:**
- Modal displays item detail
- Extension list shows all items regardless of collection
- No collection filter UI

---

## Scope (MVP)

**In scope:**
- Collection filter dropdown above extension item list
- Dropdown options: "All" + collection names (sorted alphabetically)
- Click option to filter list to that collection
- Visual indicator of active collection (highlight, check mark)
- Click active collection to clear filter (return to "All")

**Out of scope:**
- Collection management (create, rename, delete) — Phase 5+
- Collection item count badges — can add in Phase 5
- Bulk add-to-collection action — separate feature
- Drag-drop to reorder collections — not in extension

---

## Target UX

### Extension List Header

**What CEO sees:**
- Item list at top of extension modal
- Above list: "Collection:" label + dropdown button showing "All" (or active collection name)
- Dropdown opens on click, shows dropdown menu: "All" + list of collection names (alphabetical)
- Active collection has check mark or highlight
- Clicking option updates list immediately

**What CEO can do:**
- Click dropdown to open menu
- Click "All" to see all items
- Click collection name to filter to that collection
- List updates without modal close

### Visual Behavior

| State | Display | Interaction |
|-------|---------|-------------|
| No filter | "All" with neutral style | Click to open menu |
| Active filter | Collection name with highlight | Click to open menu or clear |
| Menu open | Dropdown menu visible | Click option to select |

---

## Acceptance Criteria

1. **UI exists:** Dropdown control appears above extension item list, shows "All" or active collection name
2. **Options populated:** Dropdown menu shows "All" + all collection names from API, sorted alphabetically
3. **Click filters:** Selecting a collection filters item list to items in that collection only
4. **Visual feedback:** Active collection highlighted/checked in dropdown menu
5. **Clear filter:** Clicking "All" or clicking active collection again clears the filter
6. **Parity:** Behavior matches web collection filter (same API queries, same filtering logic)
7. **List updates:** Item count badge updates (if shown) to reflect filtered items
8. **Keyboard accessible:** Dropdown focusable, arrow keys navigate options, Enter selects

---

## API Integration

**Queries to reuse:**
- `useCollectionsQuery()` — fetch all collections (List 1 hook)
- `useItemsInCollectionsQuery()` — items grouped by collection ID (already works in extension)

**Filtering logic:**
- When `activeCollectionId` is set, filter items to those in that collection
- Reuse `itemsInCollections` Set from Zustand store (already available)

**No new queries needed** — extension already has `useItemsInCollectionsQuery` via Phase 4b migration.

---

## Test Strategy

**File:** `tests/extension-collections.spec.ts` (named by capability: "filtering items by collection in extension")

**Test coverage:**
1. **Dropdown visible:** Extension list shows "Collection:" dropdown, initially set to "All"
2. **Menu opens:** Click dropdown button; menu appears with "All" + collection names
3. **Collections loaded:** Menu shows actual collections from API (e.g., "Q2 Planning", "Archive", "Research")
4. **Click filters:** Select "Q2 Planning"; list updates to show only items in that collection
5. **Active indicator:** Selected collection shows check mark or highlight
6. **Clear filter:** Click "All" or click active collection again; list returns to all items
7. **Sorted:** Collection names appear alphabetically in dropdown
8. **Item count:** List item count badge updates to reflect filtered items (e.g., "Showing 3 of 12")
9. **Keyboard nav:** Arrow keys navigate menu, Enter selects, Escape closes
10. **Persistence:** Filter persists while modal is open; clears on modal close (ephemeral, not stored)

---

## Implementation Notes

**Component location:** `web/chrome-extension/src/components/ItemList.tsx` or similar

**State management:** Reuse `activeCollectionId` from existing Zustand store (will be moved to Zustand UI store in P4e)

**Hook:** Use `useCollectionsQuery()` + existing `itemsInCollections` from `useItemsInCollectionsQuery()`

**Styling:** Match web dropdown styling (neutral background, highlight on active/hover)

**No new queries required** — all hooks already available post-Phase-4

