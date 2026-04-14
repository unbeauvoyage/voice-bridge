---
type: spec
feature: retries
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Automatic retry of failed queue items with exponential backoff, a cap of 3 attempts, and exclusion of permanent errors (404, 403, private, captions disabled).
---

## Overview

Items that fail processing are automatically retried up to 3 times on a 10-minute polling interval with per-attempt backoff delays. Permanent errors are excluded from retries.

## Data Model

Two columns on `items` (added in migrations v12–v16):

| Column | Type | Notes |
|---|---|---|
| `retries` | INTEGER DEFAULT 0 | Attempt count (renamed from `retry_count` in v16) |
| `retry_after` | TEXT | ISO datetime; item is not eligible until after this time |

## Retry Eligibility Query (`getItemsToRetry`)

```sql
SELECT id FROM items
WHERE status = 'error'
  AND retries < 3
  AND (retry_after IS NULL OR retry_after < datetime('now'))
  AND error NOT LIKE '%404%'
  AND error NOT LIKE '%403%'
  AND error NOT LIKE '%private%'
  AND error NOT LIKE '%captions disabled%'
```

Permanent failure patterns (404, 403, private, captions disabled) are excluded — retrying them would be futile.

## Backoff Calculation (`incrementRetry`)

```sql
UPDATE items
SET retries = retries + 1,
    retry_after = datetime('now', '+' || (retries * 5) || ' minutes')
WHERE id = ?
```

The backoff uses the **current** `retries` value before incrementing:

| Attempt | Current `retries` | Backoff |
|---|---|---|
| 1st retry | 0 | 0 min (immediate on next poll) |
| 2nd retry | 1 | 5 min |
| 3rd retry | 2 | 10 min |

After 3 retries (`retries = 3`), the item is no longer eligible and stays in `error` status permanently.

## Retry Scheduler

A `setInterval` runs every 10 minutes on the server:

```
getItemsToRetry()
  → incrementRetry(id)     // writes new retries count and retry_after
  → updateItem(id, { status: 'queued' })
  → runWithSemaphore(() => processItem(id, url))
```

The item re-enters the normal processing pipeline (semaphore-controlled, max 2 concurrent).

## Startup Recovery

On server start, `recoverQueue()` is called:
1. All items with `status = 'processing'` are reset to `'queued'` (they were interrupted by a server crash).
2. All `'queued'` items (including just-reset ones) are re-submitted to the worker.

This recovery is distinct from the retry logic — it handles abrupt shutdowns, not errors.

## Manual Retry (Extension)

The Chrome extension exposes a retry button for error items in the queue panel. It calls `POST /items/:id/resummarize` (re-summarize endpoint), sets the item back to `'queued'` in local storage, and resumes polling.

The web app's `api.retryItem(id)` does the same: checks status, then calls `/resummarize` if in error state.

## How to Test

1. Submit a URL that will fail (e.g. a private YouTube video). Confirm it lands in `error` with `retries = 0`.
2. Wait for the 10-minute interval (or manually call `getItemsToRetry()`). Confirm `retries` increments and `retry_after` is set.
3. After 3 retries, confirm item remains in `error` and `getItemsToRetry()` returns nothing for it.
4. Submit a 404 URL. Confirm the error message contains "404" and the item is never retried (stays `retries = 0`).
5. Kill the server while an item is `processing`. Restart — confirm it resets to `queued` and re-enters processing.
