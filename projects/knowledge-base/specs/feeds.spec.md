---
type: spec
feature: feeds
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: RSS/Atom feed subscriptions that auto-fetch new items on a 30-minute interval and attribute items to their source feed.
---

## Overview

Users subscribe to RSS or Atom feeds by URL. The server polls all active feeds at startup (after 5 s delay) and then every 30 minutes. New items found in feeds are inserted and processed the same way as manually submitted URLs. Items track which feed they came from via `feed_id`.

## Data Model

### `feeds` table

| Column | Type | Notes |
|---|---|---|
| `id` | TEXT PK | `feed-{timestamp}-{random}` |
| `url` | TEXT NOT NULL UNIQUE | Feed URL |
| `name` | TEXT | Optional display name |
| `last_checked` | TEXT | ISO timestamp of last poll |
| `last_item_date` | TEXT | `pubDate` of most recent item seen |
| `item_count` | INTEGER | Cumulative count of items ingested |
| `active` | INTEGER | 0 or 1 (soft disable; currently only 1 is used) |
| `created_at` | TEXT | ISO timestamp |

### `items` table extension

- `feed_id TEXT` — references the feed that sourced the item (nullable; NULL for manual submissions)
- `feed_name` — joined from `feeds.name` in all list/detail queries

## API Endpoints

| Method | Path | Description |
|---|---|---|
| GET | `/feeds` | Returns `Feed[]` ordered by `created_at ASC` |
| POST | `/feeds` | Body: `{ url, name? }`. Creates feed, immediately triggers `checkFeed`. Returns `{ id }` (201). 409 if URL exists. |
| DELETE | `/feeds/:id` | Deletes feed record (does not delete ingested items). |
| POST | `/feeds/:id/check` | Manually triggers `checkFeed(id)`. Returns `{ ok: true }`. Non-blocking. |

### `Feed` shape

```ts
{
  id: string;
  url: string;
  name: string | null;
  lastChecked: string | null;
  lastItemDate: string | null;
  itemCount: number;
  active: boolean;
  createdAt: string;
}
```

## Feed Check Logic (`checkFeed`)

1. Fetches the feed via `parseFeed(feed.url)` (supports RSS 2.0 and Atom).
2. Loads existing item URLs for that feed via `getFeedItemUrls(feedId)`.
3. For each parsed item not already in the database: inserts it with `feedId` set and submits to the processing worker.
4. Updates `last_checked`, `last_item_date`, and `item_count` in the `feeds` table.
5. Errors per feed are caught independently — one bad feed does not block others.

## Polling Schedule

```
setTimeout(checkAllFeeds, 5000)        // once, 5 s after server start
setInterval(checkAllFeeds, 30 * 60 * 1000)  // every 30 minutes
```

`checkAllFeeds` iterates all feeds with `active = 1`.

## Deduplication

`getFeedItemUrls(feedId)` returns all URLs already associated with that feed. Items with matching URLs are skipped. The underlying `insertItem` also uses `INSERT OR IGNORE` as a secondary guard.

## UI Behaviour

- A "Feeds" section in the settings panel (or feeds panel) shows all subscribed feeds with their `lastChecked` timestamp and `itemCount`.
- Users can add a feed URL with an optional name.
- A "Check now" button calls `api.checkFeed(id)`.
- Deleting a feed removes it from the list but leaves its ingested items in the library (they lose the `feed_id` reference after the feed row is deleted, but no cascade is configured).

## Edge Cases

- Feed items with no URL are skipped by the parser.
- Items are inserted with the feed's `id`; if the same URL appears in two different feeds, the second insert is ignored (URL unique constraint).
- Feed deletion does not orphan item `feed_id` at the DB level (no FK constraint on `items.feed_id`).

## How to Test

1. POST `/feeds` with a valid RSS URL. Expect `{ id }` response and items to start appearing within seconds.
2. POST `/feeds` with the same URL again — expect 409.
3. POST `/feeds/:id/check` — expect `{ ok: true }` and new items if any exist.
4. DELETE `/feeds/:id` — expect feed gone from GET `/feeds`; prior items still in GET `/items`.
5. Confirm `feed_name` is populated on items list when feed has a `name`.
