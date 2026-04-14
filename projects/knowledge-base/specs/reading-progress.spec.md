---
type: spec
feature: reading-progress
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Per-item scroll position memory using localStorage and a progress bar on item cards showing how far the user has read.
---

## Overview

When a user scrolls inside the reader pane, their scroll position and percentage progress are saved to `localStorage`. On reopening the same item the pane scrolls back to the saved position. Item cards show a progress bar for items read between 5% and 95%.

## Storage Keys

Both keys are stored in `localStorage` (browser-local, not synced to server):

| Key | Value | Description |
|---|---|---|
| `kb_scroll_{itemId}` | Integer (pixels) | Raw `scrollTop` of the reader pane |
| `kb_scroll_progress_{itemId}` | Integer (0–100) | Progress as a percentage |

## How Progress is Saved

An event listener on the reader pane's `scroll` event (passive) fires on every scroll. A 500 ms debounce prevents excessive writes.

```
progress = Math.min(100, Math.round((scrollTop / (scrollHeight - clientHeight)) * 100))
```

If `scrollHeight === clientHeight` (no overflow), progress is set to 0.

## How Position is Restored

When the selected item changes (`useEffect` on `item?.id`):
1. `scrollProgress` and `showBackToTop` states reset to 0 / false.
2. `localStorage.getItem('kb_scroll_' + item.id)` is read.
3. If `saved > 0`, after a 50 ms delay `paneRef.current.scrollTop = saved` is applied (delay allows DOM to paint).
4. If no saved position, `scrollTop` is set to 0.

## Card Progress Bar

On item cards in the list pane, a thin bar is rendered at the bottom of the card:

```tsx
{readingProgress > 5 && readingProgress < 95 && (
  <div className="item-card-progress" style={{ width: `${readingProgress}%` }} />
)}
```

`readingProgress` is read from `localStorage.getItem('kb_scroll_progress_' + item.id)` at card render time (parsed as integer, defaults to 0).

The bar is hidden when progress is ≤ 5% (not meaningfully started) or ≥ 95% (effectively done).

## Scroll Progress Indicator (Reader Pane)

A `scrollProgress` float (0–1) is tracked in state and drives a thin progress bar at the top of the reader pane (`reader-progress-bar`). This is a real-time visual indicator and is not persisted.

## Limitations

- Data lives in `localStorage` — cleared on browser data wipe; not shared across devices or browser profiles.
- No server-side `reading_progress` column exists; the server only tracks binary `read_at` (when marked read).
- Progress bar on cards reflects the last time the item was scrolled; it does not update live while another tab has it open.

## How to Test

1. Open an item with long content. Scroll to ~50%. Close the reader. Reopen the item — expect pane to restore to ~50%.
2. Check the item card in the list — expect a progress bar roughly at 50% width.
3. Scroll to the very top — expect card progress bar to disappear (≤5%).
4. Scroll to >95% — expect card progress bar to disappear.
5. Clear `localStorage`. Reopen item — expect scroll to start at top with no card progress bar.
