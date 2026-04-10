# Architecture Discussions

## Search & Vector DB Strategy
*2026-04-10 — raised by CEO*

### Current state
SQLite (`bun:sqlite`) with LIKE-based full-text search. Fast, zero infrastructure, single file. Works well for 100–10,000 items. Limitation: LIKE is dumb (no relevance ranking, no stemming, no semantic understanding).

---

### Option A — Stay SQLite, add sqlite-vec + FTS5

**SQLite FTS5** (built-in extension) replaces LIKE with proper full-text search:
- Relevance ranking (BM25)
- Stemming, tokenization
- Fast even at 1M+ rows
- Zero new infrastructure — just `CREATE VIRTUAL TABLE items_fts USING fts5(...)`

**sqlite-vec** adds vector/semantic search on top:
- Store embedding vectors alongside items
- `SELECT * FROM items ORDER BY vec_distance(embedding, ?) LIMIT 10`
- Embeddings generated locally via Ollama (`nomic-embed-text` model — 274MB, fast)
- Works fully offline

**Verdict:** This is the right first step. No new servers, no Docker, fully local. Sufficient for a personal knowledge base up to ~100K items. sqlite-vec is production-quality (maintained by Anthropic's Alex Garcia).

---

### Option B — PostgreSQL + pgvector

Full PostgreSQL for advanced SQL + pgvector extension for semantic search.

**Pros:**
- Best-in-class full-text search (`tsvector` / `tsquery`, ranked, multi-language)
- pgvector is the production standard for vector search
- Advanced queries (joins, CTEs, window functions) — useful when knowledge base grows complex
- Natural fit for productivitesse merge (productivitesse will likely need PG anyway)
- Single DB serves both apps when merged

**Cons:**
- Needs a running PG server (local install or Docker)
- More infrastructure to manage
- Overkill for personal use at <10K items

---

### Option C — Hybrid: SQLite now → PostgreSQL later

Start with **Option A** (sqlite-vec + FTS5), then migrate to PostgreSQL + pgvector when:
- Merging into productivitesse (which may already run PG)
- Item count exceeds ~50K
- Need multi-user access or remote access

Migration is straightforward: same schema, swap `bun:sqlite` for `Bun.sql` (PostgreSQL), add pgvector extension.

---

### Recommendation

**Phase 1 (now):** Add FTS5 + sqlite-vec to the existing SQLite setup.
- FTS5 for keyword search with ranking
- sqlite-vec + `nomic-embed-text` (via Ollama) for semantic search
- Zero new infrastructure

**Phase 2 (productivitesse merge):** Evaluate whether to migrate to PostgreSQL + pgvector. If productivitesse already runs PG, migrate everything then — one unified DB.

**Embedding model:** `nomic-embed-text` via Ollama — already running, free, offline, 768-dim embeddings. Pull with `ollama pull nomic-embed-text`.

---

### Implementation notes for when we build this

```typescript
// Generate embedding via Ollama
const res = await fetch("http://127.0.0.1:11434/api/embeddings", {
  method: "POST",
  body: JSON.stringify({ model: "nomic-embed-text", prompt: text })
});
const { embedding } = await res.json(); // float[]

// Store in sqlite-vec virtual table
// Query by cosine similarity
```

FTS5 setup:
```sql
CREATE VIRTUAL TABLE items_fts USING fts5(
  title, summary, transcript,
  content=items, content_rowid=rowid
);
-- Keep in sync via triggers on INSERT/UPDATE/DELETE
```

---

*Status: planned — tracked in .worklog/plan.md TODO section*
