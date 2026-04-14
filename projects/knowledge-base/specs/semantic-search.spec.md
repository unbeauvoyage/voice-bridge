---
type: spec
feature: semantic-search
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Embedding-based semantic search using Ollama (nomic-embed-text model) with cosine similarity, falling back to FTS5 full-text search and then LIKE search.
---

## Overview

Search has three tiers executed in order:
1. **Semantic** (opt-in): user enables "Semantic" toggle; queries Ollama for an embedding and compares against stored item embeddings.
2. **FTS5** (automatic): full-text search using SQLite's FTS5 virtual table; used when a text query is present without a tag filter and semantic mode is off.
3. **LIKE** (fallback): basic LIKE search on title, summary, transcript, and sections; used when FTS5 returns no results or fails.

## Data Model

### `item_embeddings` table

| Column | Type | Notes |
|---|---|---|
| `item_id` | TEXT PK | FK → `items(id)` (no cascade) |
| `embedding` | BLOB | `Float32Array` packed as raw bytes |

### `items_fts` virtual table

FTS5 content table mirroring `items(title, summary, transcript)`, kept in sync by INSERT/UPDATE/DELETE triggers.

## Embedding Generation

- Model: `nomic-embed-text` via Ollama at `http://127.0.0.1:11434`
- Function: `generateEmbedding(text: string): Promise<number[]>` in `src/embed.ts`
- Input text: `itemEmbedText(item)` — concatenates title, summary, TL;DR bullets, and tag names
- Embeddings are generated automatically after each item finishes processing (non-fatal — failure does not affect the item's status)
- Re-summarize also regenerates the embedding

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/search?q={query}&semantic=true` | Generates embedding for query, runs cosine similarity, returns top 20 items |
| GET | `/search?q={query}` | FTS5 first, LIKE fallback; returns items with optional `snippet` field |
| GET | `/search?q={query}&tag={tag}` | LIKE search filtered by tag (FTS5 not used when tag is present) |
| GET | `/embed/status` | Returns `{ total, embedded, pending }` — how many items have embeddings |

## Semantic Search Logic (`semanticSearch`)

1. Loads all rows from `item_embeddings`.
2. Computes cosine similarity between the query embedding and each stored vector.
3. Filters out items with score < 0.25.
4. Sorts descending by score; takes top `limit` (default 20).
5. Fetches item rows from `items` for those IDs, preserving score order.
6. Excludes archived items.

### Cosine similarity

```
score = dot(a, b) / (|a| * |b| + 1e-10)
```

## FTS5 Search (`ftsSearch`)

Uses SQLite's `MATCH` operator with `snippet()` function (20 tokens, `<mark>` tags). Results ordered by `rank` (relevance). Returns `{ item, snippet }[]` where `snippet` is the highlighted match context.

If FTS5 throws (e.g. malformed query syntax), the search falls through to LIKE.

## UI Behaviour

- A "Semantic" toggle button appears in the search bar area.
- When semantic mode is on and a query is typed (debounced), `api.semanticSearch(q)` is called.
- A loading spinner appears during the Ollama round-trip.
- If Ollama is unavailable, the server returns 503 and the UI shows an error.
- In non-semantic mode with a query, FTS results are stored in `ftsResults` state and shown directly. Items may include a `snippet` field with `<mark>` highlights.

## Related Items

`GET /items/:id/related` uses the same embedding infrastructure:
1. Looks up the item's embedding from `item_embeddings`.
2. Computes cosine similarity against all other embeddings.
3. Falls back to tag-overlap scoring if no embedding exists for the item.
4. Returns top `limit` (default 5, max 20) related items.

## How to Test

1. Ensure Ollama is running with `nomic-embed-text` pulled. Add several thematically related items.
2. Check `GET /embed/status` — confirm `embedded` count matches `total` after processing.
3. Enable semantic toggle. Search for a concept mentioned indirectly — expect thematically related items.
4. Disable semantic toggle. Search for a word present in transcript — expect FTS snippet in results.
5. Stop Ollama. Try semantic search — expect 503 response and error shown in UI.
6. Open an item, check "Related" section — expect semantically similar items.
