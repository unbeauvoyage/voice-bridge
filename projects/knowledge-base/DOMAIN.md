# knowledge-base Domain

This app is the knowledge repository. It stores and surfaces processed content.

## Core Terms (from shared/domain)

| Term | Type | Description |
|---|---|---|
| `KnowledgeItemId` | branded string | Unique item identifier. Used in all API routes as path param. |
| `KnowledgeItemType` | union | `article \| video \| pdf \| note` |
| `KnowledgeItemStatus` | union | Processing lifecycle: `pending → processing → ready \| error` |
| `KnowledgeItemPreview` | interface | Summary card — used in lists, search results. |

## Local Extensions (src/types.ts, web/api.ts)

| Term | Where | Description |
|---|---|---|
| `KnowledgeItemDetail` | `src/types.ts` | Full item with content, highlights, summaries. |
| `Collection` | `src/types.ts` | Named group of items. |
| `Highlight` | `src/types.ts` | User annotation on a passage. |
| `SummaryVersion` | `src/types.ts` | Versioned AI summary of an item. |
| `TagStats` | `src/types.ts` | Tag usage counts for consolidation UI. |
| `Feed` | `src/types.ts` | RSS/Atom feed subscription. |

## Invariants

- Items always move forward through status: never `ready → pending`
- `KnowledgeItemId` is a content-addressed hash — same URL always produces same ID
- Tags are lowercase, trimmed — enforced at write time
