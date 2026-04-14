---
type: question
created: 2026-04-11T16:40:22
answered: 2026-04-11T21:32:48
status: answered
summary: Should knowledge-base embeddings use article body instead of summary for better semantic relatedness?
project: knowledge-base
answer: Switched to option 2 — embed title + first 6000 chars of transcript. Falls back to title+summary+tldr for items without transcript. Re-embed button added to settings panel. Commit a7749c4.
---

## Question

Should the knowledge-base switch from embedding the **summary** to embedding the **article body** (first ~1500 tokens) for more accurate related-item matching?

## Context

Currently: `title + tags + summary + tldr` is sent to `nomic-embed-text` to generate the embedding stored per item.

Problem: summaries are lossy — the LLM flattens nuanced topics, which causes unrelated articles to appear in the Related section (e.g. an Unreal Engine article showing up under a neuroscience article).

## Options

1. **Keep summary** — simpler, faster, good enough for small libraries
2. **Embed article body** (first ~1500 tokens) — more accurate, `nomic-embed-text` handles raw text well, needs re-embed job for existing items
3. **Chunk + multi-vector** — embed overlapping chunks, store multiple vectors per article, max similarity at query time — production RAG approach, more complex

## To Discuss

- At what library size does option 1 break down noticeably?
- Is re-embedding existing articles worth the Ollama compute cost?
- Should the embedding strategy be configurable per-item or global?
