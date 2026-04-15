# Feature Design Spec: Extension Semantic Search Toggle

**Status:** Draft  
**Priority:** High  
**Author:** phase4-coder-a  
**Date:** 2026-04-15  
**Project:** knowledge-base

---

## Problem / Why

The web app supports two search modes:
- **FTS (Full-Text Search):** Keyword/phrase matching, fast, recalls on page text
- **Semantic Search:** AI-powered, meaning-based, finds conceptually similar items

Currently, the extension only supports FTS — CEO cannot access semantic search from the extension (primary interface). This limits discovery of relevant items when keywords don't match exactly.

CEO needs to toggle between search modes without leaving the extension.

---

## Current State (what exists)

**Web app:**
- Search input + toggle switch labeled "Semantic"
- Toggle position: right of search input or in header
- FTS mode (default): `useFtsSearchQuery(searchQuery)` returns keyword matches
- Semantic mode: `useSemanticSearchQuery(searchQuery)` returns embedding-based matches
- Behavior:
  - FTS active: searches text, returns fast
  - Semantic active: calls embedding API, slower but meaning-aware
- Loading state: spinner shows while semantic search processes
- Results displayed same way (list of items)

**Extension:**
- Search input exists (allows typing)
- Only FTS search works (hardcoded)
- No semantic toggle
- No Ollama/embedding support detection

---

## Scope

**In scope:**
- Toggle switch near search input (on/off for semantic mode)
- Label: "AI Search" or "Semantic" (match web terminology)
- FTS (default) vs Semantic mode selection
- Reuse `useSemanticSearchQuery` from feature-first refactor
- Loading state: spinner while semantic search processes
- Results display same as current (no UI changes to list)

**Out of scope:**
- Ollama health check / unavailable state (assume available)
- Semantic search configuration (model selection, threshold tuning)
- Search history per mode
- Saved search preferences (can add in Phase 5+)

---

## Target UX

### Extension Search Header

**What CEO sees:**
- Search input (existing)
- Toggle switch to right of input: "AI Search" (off/on)
- When on: slight visual change (highlight, different color) to indicate semantic mode active
- Loading spinner appears during semantic search (while results load)
- Results list updates to show semantic matches when toggled

**What CEO can do:**
- Type search query
- Click toggle to switch modes (FTS ↔ Semantic)
- See results update immediately for new mode
- Results change as you type (debounced, same as current)

### Visual Behavior

| State | Display | Behavior |
|-------|---------|----------|
| FTS (off) | Toggle unselected, search icon | Keyword search, fast results |
| Semantic (on) | Toggle selected/highlighted, AI icon | Embedding search, slower |
| Loading | Spinner in search area | Query in flight, results updating |

---

## Acceptance Criteria

1. **Toggle exists:** Switch appears right of search input, labeled "AI Search"
2. **Default is FTS:** Toggle starts unselected, FTS search active
3. **Click toggles mode:** Toggle on → semantic queries start, toggle off → FTS resumes
4. **Results update:** Switching modes shows different results for same query
5. **Loading state:** Spinner appears while semantic search processes
6. **Parity:** Behavior matches web semantic toggle exactly (same hooks, same UX)
7. **Debounce:** Results still debounce as user types (same as current)
8. **Keyboard accessible:** Toggle focusable, Space/Enter toggles, label present
9. **Persists while modal open:** Toggle state stays on/off while searching (ephemeral, not stored)

---

## API Integration

**Queries to reuse:**
- `useSemanticSearchQuery(query)` — semantic (embedding-based) search (Phase 4c, Layer 1 hook)
- `useFtsSearchQuery(query)` — FTS (keyword) search (Phase 4c, Layer 1 hook)

**Behavior:**
- `semanticMode ? useSemanticSearchQuery(query) : useFtsSearchQuery(query)`
- Same conditional logic as web app (lines 220-221 of app.tsx)

**No new infrastructure needed** — Phase 4c migration provides both hooks.

---

## Test Strategy

**File:** `tests/extension-semantic-toggle.spec.ts` (named by capability: "toggling semantic search in extension")

**Test coverage:**
1. **Toggle visible:** Search input shows toggle switch labeled "AI Search"
2. **Default off:** Toggle starts unselected; FTS search active
3. **Click toggles:** Click toggle; icon changes, semantic mode activates
4. **Results differ:** Same query in FTS vs Semantic shows different results
5. **Loading state:** While semantic search processes, loading spinner appears
6. **Debounce works:** Typing multiple characters before result update (no spam requests)
7. **Toggle on/off:** Click toggle on, then off; results revert to FTS
8. **Keyboard nav:** Tab to toggle, Space/Enter toggles mode
9. **Accessibility:** Toggle has aria-label "Toggle semantic search"
10. **Mode persists:** Modal stays on same mode while searching; closes/reopens on modal toggle

---

## Implementation Notes

**Component location:** `web/chrome-extension/src/components/SearchInput.tsx` (or similar)

**State management:** Simple local state for `semanticMode` boolean (ephemeral, not persisted)

**Hooks:** Conditionally call `useSemanticSearchQuery` or `useFtsSearchQuery` based on toggle (Phase 4 provides both)

**Loading state:** Show spinner in search input while `useSemanticSearchQuery.isLoading` is true

**Icon:** Use brain icon (semantic) vs magnifying glass (FTS) to distinguish modes

**Styling:** Match web toggle styling (same color scheme, size, interaction feedback)

**No new queries required** — Phase 4c refactor provides both search hooks ready to use.

