# app.tsx Feature Audit — 2026-04-15T05:41:46

**File:** `web/app.tsx`
**Lines:** 4,906
**Goal:** Identify natural feature boundaries for the feature-first refactor.

---

## Summary of Findings

`app.tsx` is a single-file monolith with clear section markers (`// ── Section ──`). Components are cleanly separated by comments but all co-located. The `App` component (~1,450 lines, lines 3438–4906) holds all application state and is the hardest piece to decompose.

---

## Identified Features

### 1. `knowledge-list` (lines 1729–1895)
**Components:** `ItemCard`
**Responsibilities:**
- Renders a single item in the sidebar list
- Handles star/archive/pin/study-later toggle actions
- Shows type badge, tags, read status, age class
- Emits click → triggers reader open
**Shared state needed:** `allItems`, selection state, tag filter clicks
**Extraction complexity:** Medium — needs callbacks from App

---

### 2. `knowledge-reader` (lines 1967–3003)
**Components:** `ReaderPane`, `ArticleChat`, plus helpers (`escapeHtml`, `buildTranscriptHtml`, `formatTranscript`, `countMatches`, `slugify`, `readingStats`)
**Responsibilities:**
- Full-article reading view (transcript, summary, sections, TLDR)
- In-transcript search with match highlighting and navigation
- Summary versions panel
- Notes editing
- Rating (star rating UI)
- Highlights panel
- Related items list
- Export button integration
- ArticleChat (discuss feature — embedded in reader)
**Shared state needed:** `selectedId`, `detailCache`, `allItems` (for related)
**Extraction complexity:** High — largest single component (~1,000 lines). Contains ArticleChat (discuss feature) inline.

---

### 3. `knowledge-search` (state in App, lines 3470–3758)
**Components:** No dedicated component — logic is inline in App + the search input in the header
**Responsibilities:**
- Text search input with debounce
- `#tag` shortcut → applies tag filter
- Semantic search mode toggle
- FTS (full-text search) via `/search` API
- Semantic search via `/search/semantic` API
- Search history (localStorage)
- Search result display (overrides `filteredItems`)
**Extraction complexity:** Medium — needs to extract into a `useSearch` hook + a `SearchBar` component

---

### 4. `knowledge-ingest` (lines 528–856 and 1404–1590)
**Components:** `BulkAddModal`, `QuickCaptureModal`, `PreviewsPanel`
**Responsibilities:**
- `BulkAddModal`: paste multiple URLs, import bookmarks (.html/.csv), manage RSS feeds
- `QuickCaptureModal`: single-URL quick entry with live preview and AI quick summary
- `PreviewsPanel`: shows ephemeral (in-memory, not yet saved) preview items
- Feed management (add/delete/refresh RSS feeds)
**Extraction complexity:** Low-Medium — these are already well-isolated modal components

---

### 5. `tags` (lines 968–1283 and 1651–1728)
**Components:** `TagCloudPanel`, `TagsPanel`
**Responsibilities:**
- `TagCloudPanel`: full tag browser — approve/reject/merge/rename tags, AI consolidation
- `TagsPanel`: compact tag list with approve/reject controls
- Tag suggestion workflow (AI-suggested tags per item)
**Shared state needed:** `tagStats`, `tagData`, `tagStatusMap` from App
**Extraction complexity:** Medium

---

### 6. `collections` (lines 3004–3222)
**Components:** `CollectionsPanel`, `AddToCollectionDropdown`
**Responsibilities:**
- Create/rename/delete collections
- Show items per collection with count
- Filter list by active collection
- Batch-add items to a collection
**Shared state needed:** `collections`, `activeCollectionId`, `itemsInCollections`
**Extraction complexity:** Medium

---

### 7. `queue` (lines 3258–3420)
**Components:** `QueuePanel`, `QueueLogEntry` type, `itemToQueueEntry` helper
**Responsibilities:**
- Shows recent URL submissions with processing status
- Retry failed items
- Clear completed items
- Poll queue via SSE (EventSource) for live status updates
**Shared state needed:** `queueLog`, `clearedIds`, `allItems` (for sync)
**Extraction complexity:** Medium

---

### 8. `stats` (lines 858–967)
**Components:** `StatsPanel`
**Responsibilities:**
- Aggregate reading stats (totals, by type, avg rating, top tags)
- Reading goals display
**Shared state needed:** None (loads its own data)
**Extraction complexity:** Low — already self-contained

---

### 9. `settings` (lines 167–526)
**Components:** `SettingsPanel`, `SystemStatusRow`
**Responsibilities:**
- Summary language settings
- Notifications toggle
- Reading goals (daily/weekly)
- System tool status (Ollama, yt-dlp, Whisper, pdftotext)
- Prompt version management (summary + chat prompts)
- Developer tools (clear test data, rebuild embeddings)
**Shared state needed:** None (loads its own data)
**Extraction complexity:** Low — already self-contained

---

### 10. `article-chat` (lines 1285–1403)
**Components:** `ArticleChat`
**Responsibilities:**
- Chat/discuss interface per article (or for ephemeral previews)
- Persists chat history via API
- Clear history
**Shared state needed:** None (passed via props)
**Extraction complexity:** Low — already well-isolated, just embedded in ReaderPane

---

## Shared / Cross-Cutting

These live in App and will become shared context/hooks:

| Concern | Current location | Target |
|---|---|---|
| Type guards (`isKnowledgeItemDetail`, etc.) | Lines 13–25 | `web/src/shared/types.ts` |
| Helper functions (`formatDate`, `timeAgo`, etc.) | Lines 116–165 | `web/src/shared/utils.ts` |
| `ErrorBoundary` class | Lines 84–112 | `web/src/shared/ErrorBoundary.tsx` |
| `EphemeralItem` type + `makeEphemeralItem` | Lines 29–76 | `web/src/features/knowledge-ingest/` |
| App-level state | Lines 3438–3895 | To be split into per-feature hooks |

---

## Extraction Order (recommended)

Priority: low-risk items first to build confidence, then the big ones.

1. **`settings`** — self-contained, no shared state. Single file move.
2. **`stats`** — self-contained, no shared state. Single file move.
3. **`article-chat`** — clean props interface already. Single file move.
4. **`knowledge-ingest`** — 3 modal components, already well-isolated.
5. **`tags`** — moderate complexity, needs `tagStats` lifted or passed.
6. **`queue`** — needs SSE logic, moderate.
7. **`collections`** — moderate.
8. **`knowledge-list`** — `ItemCard` + its callbacks.
9. **`knowledge-search`** — extract `useSearch` hook first.
10. **`knowledge-reader`** — largest, save for last. Split `ReaderPane` into sub-components inside the feature folder.

---

## Proposed Directory Structure

```
web/src/
  features/
    settings/
      components/
        SettingsPanel.tsx
        SystemStatusRow.tsx
      index.ts
    stats/
      components/
        StatsPanel.tsx
      index.ts
    article-chat/
      components/
        ArticleChat.tsx
      index.ts
    knowledge-ingest/
      components/
        BulkAddModal.tsx
        QuickCaptureModal.tsx
        PreviewsPanel.tsx
      types.ts          (EphemeralItem, BulkUrlResult)
      index.ts
    tags/
      components/
        TagCloudPanel.tsx
        TagsPanel.tsx
      index.ts
    queue/
      components/
        QueuePanel.tsx
      types.ts          (QueueLogEntry)
      utils.ts          (itemToQueueEntry)
      index.ts
    collections/
      components/
        CollectionsPanel.tsx
        AddToCollectionDropdown.tsx
      index.ts
    knowledge-list/
      components/
        ItemCard.tsx
      index.ts
    knowledge-search/
      hooks/
        useSearch.ts
      components/
        SearchBar.tsx
      index.ts
    knowledge-reader/
      components/
        ReaderPane.tsx
        ReaderSummary.tsx
        ReaderTranscript.tsx
        ReaderHighlights.tsx
        ReaderRelated.tsx
      utils.ts          (escapeHtml, buildTranscriptHtml, formatTranscript, etc.)
      index.ts
  shared/
    ErrorBoundary.tsx
    types.ts
    utils.ts            (formatDate, timeAgo, ageClass, etc.)
```

---

## Existing Test Coverage

The project has ~40 Playwright spec files covering:
- `smoke.spec.ts` — core loop (save URL → list → reader)
- `app.spec.ts` — search input, date filters, item list, reader pane
- `tag-management.spec.ts`, `api-tags.spec.ts` — tag flows
- `quick-capture.spec.ts` — ingest flow
- `reader-content.spec.ts` — reader pane
- `api-search.spec.ts` — search API
- `feeds.spec.ts` — RSS feeds
- `statistics.spec.ts` — stats panel
- `settings.spec.ts` — settings panel
- Many more covering API boundaries, collections, export, history

These tests use CSS class selectors and `data-testid` attributes. The refactor must preserve all class names and `data-testid` values to keep tests passing.

---

## Risk Assessment

**Low risk:** Modal components (settings, stats, ingest modals) — already have clean props interfaces.

**Medium risk:** `ItemCard` — depends on many callbacks passed from App; these must be preserved as props.

**High risk:** `ReaderPane` — ~1,000 lines; uses `detailCache` ref from App; touches reading stats, highlights, notes, chat — needs careful sub-component splitting before extraction.

**Critical constraint:** All CSS class names and `data-testid` attributes must be preserved verbatim. The test suite uses them as selectors.

---

## Out of Scope (Phase 1.2)

- Zustand/React Query migration (Phase 2)
- `src/` (Bun server) — untouched
- `web/api.ts` — not modified
- ESLint boundaries enforcement (install tooling but enforce progressively)
- Extension (`extension/`) — separate concern
