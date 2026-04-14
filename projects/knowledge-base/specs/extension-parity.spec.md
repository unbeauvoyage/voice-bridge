---
created: 2026-04-12T19:07:52
summary: Full feature parity between extension and web app reader. Extension is the primary interface.
---

# Extension Feature Parity

## Context

The extension is the primary interface. The web app is secondary. Every reader feature must be available in the extension popup. Currently the extension is too narrow and missing several features present in the web app reader.

## Acceptance Criteria

### 1. Larger popup size
- Body min-width: 680px, max-width: 720px
- Modal overlay fills the full popup width/height with scroll
- Closing popup does NOT stop background processing (Chrome MV3 service worker handles processing — no action needed, just verify no AbortSignal tied to popup lifecycle)

### 2. Star UI parity (MUST match web app exactly)
Current extension stars are plain unicode toggled in JS. Web app stars use CSS transitions.

Update `.modal-star-btn` in popup.html CSS to match `web/styles.css .reader-star-btn`:
```css
.modal-star-btn {
  background: none;
  border: none;
  cursor: pointer;
  font-size: 22px;
  color: #888; /* var(--text-faint) equivalent */
  padding: 0 2px;
  line-height: 1;
  transition: color 0.1s, transform 0.1s;
}
.modal-star-btn.filled { color: #f5c518; }
.modal-star-btn:hover { transform: scale(1.2); }
```
Stars must be toggled by adding/removing `.filled` class, not by changing textContent.

### 3. Model name — already present (modal-summary-model div). Keep as-is.

### 4. Full prompt view
After the model name line, add a collapsible `<details>` element showing the full prompt text used to generate the current summary.

Data source: `GET /items/:id/summary-history` returns versions with `promptId`. Then `GET /prompts/summary` returns all prompt versions. Match by `promptId` to show the full prompt text.

Alternatively, expose via the existing summary history response if `prompt` text is already included there.

Check `src/server.ts` GET `/items/:id/summary-history` response shape — if it includes `prompt` text directly, use that. Otherwise use the two-step fetch.

Display: `<details class="modal-prompt-details"><summary>Prompt used</summary><pre class="modal-prompt-text">…</pre></details>`

### 5. Tag rejection with reason
Currently extension calls `POST /tags/reject` with `{ tag, itemId }` and no `reason`.

Change: when user clicks reject (✗) on a tag badge, show an inline mini-form:
```
[Reason for rejection: ___________] [Confirm ✗] [Cancel]
```
On confirm, call `POST /tags/reject` with `{ tag, itemId, reason }`.
On cancel, dismiss without rejecting.

The reason input can be a small `<input type="text">` appearing inline in the tag badge row.

### 6. Summary quality rating — auto-save on star click (no separate Save button)
Currently requires clicking "Save rating". Change to: clicking a star immediately saves `{ rating, reason }` to the API. The reason textarea still requires explicit save (since typing is in-progress). Add a "Save reason" button that appears only after the reason textarea is modified.

OR keep the current save button but style it to match web app.

Keep the existing behavior if changing it would be complex — just ensure the style matches.

### 7. Tag consolidation
The extension has a "Tags" tab for pending tag approval. Ensure it is accessible and functional. No new work needed if already present.

### 8. Detachable window (instead of fixed popup)
Chrome popups are anchored to the toolbar and can't be moved/resized. Use `chrome.windows.create()` to open a standalone window.

- `manifest.json`: remove `default_popup`, add `background.service_worker: "background.js"`
- `background.js`: intercepts `chrome.action.onClicked`, opens/focuses a detachable window with saved position/size
- `popup.js`: saves window position/size on resize via `chrome.windows.getCurrent()`
- `popup.html`: body uses `width: 100%; height: 100%` instead of fixed min/max-width (window size drives layout)
- Window defaults: 720x900, position (100,100). Saved to `chrome.storage.local` keys: `winLeft`, `winTop`, `winWidth`, `winHeight`
- If window is already open, focus it instead of opening a second one

## Out of scope
- Chat improvements (already present)
- Settings/prompts editing (web app only for now)
- Feed management

### 9. Shared CSS between web app and extension
- `extension/shared.css` is the source of truth for all shared UI components
- Contains: color tokens (CSS variables), star/rating styles (`.reader-star-btn`), summary quality section (`.reader-summary-quality-*`), prompt details, tag badges, chat styles, quality save button
- `popup.html` links `shared.css` and only keeps extension-specific layout overrides inline
- `popup.js` uses the same class names as the web app (e.g., `.reader-star-btn` not `.modal-star-btn`)
- Comment in `shared.css`: `/* Shared with web/styles.css — keep in sync */`

## Files to modify
- `extension/popup.html` — CSS: extension-specific layout only (shared styles in shared.css)
- `extension/popup.js` — JS: prompt loading, tag rejection with reason, window size saving; uses shared class names
- `extension/shared.css` — shared component CSS (tokens, stars, tags, chat, quality, prompt)
- `extension/background.js` — detachable window logic
- `extension/manifest.json` — service worker, remove default_popup

## TDD
Write a `tests/extension-parity.spec.ts` Playwright test that:
1. Seeds a YouTube/web item with a summary
2. Opens a mock of the extension popup (or tests via the web app if extension testing is not supported in Playwright)
3. Verifies: model name visible, star buttons have correct CSS class behavior, prompt details section present

Note: If Chrome extension E2E testing is complex, test the web app equivalents and note the extension was manually verified with `node --check`.

## Commit message
`feat: extension feature parity — larger popup, prompt view, tag rejection reason, star UI parity`
