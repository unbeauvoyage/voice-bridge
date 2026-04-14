---
type: spec
feature: copy-export
status: implemented
created: 2026-04-11T00:00:00
updated: 2026-04-11T00:00:00
summary: Per-item and bulk copy/export actions including copy TL;DR bullets, copy summary text, copy as Markdown, download Markdown file, and share-link copy; plus bulk JSON/Markdown export for the whole library.
---

## Overview

Content can be exported or copied at two levels: per-item (from the reader pane) and library-wide (from the Export button in the header). The share dropdown in the reader is the central entry point for per-item actions.

## Per-Item Actions

### Share Dropdown (reader pane header)

A button (↑) opens a dropdown with three options:

| Option | Behaviour |
|---|---|
| Copy link | Copies `http://127.0.0.1:3737/?id={itemId}` to clipboard; shows a share toast |
| Download Markdown | Navigates to `GET /items/:id/export/markdown` which triggers a file download |
| Copy as Markdown | Builds markdown in the client via `buildMarkdownText()` and writes it to clipboard. Button label changes to "✓ Copied" for 1.5 s. |

### Copy TL;DR

A copy icon button appears next to the TL;DR section header. Clicking it copies all TL;DR lines as a bullet list (`- line\n- line…`) to the clipboard. Label changes to "✓ Copied" for 1.5 s.

### Copy Summary

A copy icon button appears next to the summary text. Clicking it copies the raw summary string to clipboard.

### `buildMarkdownText()` format

Client-side markdown builder produces:

```
# {title or url}
URL: {url}
Date: {publishedAt or dateAdded}
Tags: {approved tags, comma-separated}

## TL;DR
- bullet
…

## Summary
{summary text}

## Key Points
### {section title}
- point
…
```

Consecutive blank lines are collapsed to one.

## Server-Side: `GET /items/:id/export/markdown`

Uses same structure as `buildMarkdownText()` but includes all tags (not filtered by approval). Response headers:
- `Content-Type: text/markdown; charset=utf-8`
- `Content-Disposition: attachment; filename="{slugified-title}.md"`

Slug: lowercase, alphanumeric + hyphens, max 80 chars.

## Library-Wide Export

Accessible from the header's Export button (opens a sub-menu).

| Endpoint | Description |
|---|---|
| `GET /export/json` | All `done` items with full transcript as JSON array. Filename: `knowledge-base-{date}.json` |
| `GET /export/markdown` | All `done` items formatted as markdown sections. Filename: `knowledge-base-{date}.md` |

Both use `getAllItemsFull()` which includes transcript text.

## Client API

```ts
api.exportJson()        // window.open /export/json
api.exportMarkdown()    // window.open /export/markdown
```

Clipboard copy uses `navigator.clipboard.writeText`.

## How to Test

1. Open an item. Click ↑ (share). Click "Copy as Markdown". Paste into a text editor — verify heading, TL;DR, summary, and key points sections.
2. Click "Download Markdown". Expect a `.md` file download with slugified filename.
3. Click "Copy link". Paste URL — expect `?id=` param pointing to the item.
4. Click the copy icon on TL;DR. Verify bullet-list format in clipboard.
5. Header → Export → Export JSON. Expect JSON file download with array of items including transcript.
6. Header → Export → Export Markdown. Expect markdown file with `## Title` blocks per item.
