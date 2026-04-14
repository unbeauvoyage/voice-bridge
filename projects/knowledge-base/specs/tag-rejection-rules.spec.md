---
type: spec
feature: tag-rejection-rules
status: approved
created: 2026-04-11T18:40:20
updated: 2026-04-11T18:40:20
summary: Tag rejections now capture a user-supplied reason. A background LLM job derives a persistent ruleset from accumulated rejections and injects those rules into future tag suggestions.
---

## Overview

When a user rejects a tag, they can optionally explain why. These rejection reasons accumulate in a `tag_rejections` table. After each rejection, a background `derive-rules` job runs: it reads all rejection examples and asks the LLM to produce a concise ruleset (≤20 rules) governing naming conventions, granularity, and grouping logic. The ruleset is stored in the `tag_rules` setting and injected into every future `suggestTags()` call, so tagging becomes more consistent over time without manual curation.

---

## 1. DB Changes (`src/db.ts`)

### 1.1 New table: `tag_rejections`

```sql
CREATE TABLE IF NOT EXISTS tag_rejections (
  id         TEXT PRIMARY KEY,
  tag        TEXT NOT NULL,
  reason     TEXT NOT NULL DEFAULT '',
  item_id    TEXT,
  created_at TEXT NOT NULL
)
```

- `id`: `rejection-{timestamp}-{random}` (same pattern as item IDs)
- `reason`: free-text user input; may be empty string if user skipped the reason
- `item_id`: nullable — the item the rejected tag appeared on (for future audit UI)

### 1.2 New setting key: `tag_rules`

Stored in `user_settings` with key `tag_rules`. Initial value is empty string (`''`). No default entry added to `DEFAULTS` — the key is absent until the first `derive-rules` job completes.

### 1.3 New functions

```ts
saveTagRejection(tag: string, reason: string, itemId?: string): void
getTagRejections(): Array<{ id: string; tag: string; reason: string; item_id: string | null; created_at: string }>
getTagRules(): string   // returns '' if key absent
saveTagRules(rules: string): void
```

### 1.4 Migration bump

`CURRENT_VERSION` → **17**

Migration block `version < 17`:
```sql
CREATE TABLE IF NOT EXISTS tag_rejections (
  id TEXT PRIMARY KEY, tag TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '',
  item_id TEXT, created_at TEXT NOT NULL
)
```

---

## 2. `derive-rules` Job (`src/queue.ts`)

### 2.1 New exported function

```ts
export async function deriveTagRules(): Promise<void>
```

This function is **not** enqueued through the item queue (which is URL-based). It runs as a standalone async call, gated by a module-level boolean semaphore (`deriveRulesRunning`) to prevent concurrent runs.

**Steps:**

1. If `deriveRulesRunning === true`, return immediately (debounce concurrent triggers).
2. Set `deriveRulesRunning = true`.
3. Read all tag rejections from `getTagRejections()`.
4. If zero rejections, set `deriveRulesRunning = false` and return.
5. Read existing rules from `getTagRules()`.
6. Build prompt (see §2.2).
7. Call `llmQuery(prompt)`.
8. Extract the rules text from the LLM response (trim whitespace).
9. `saveTagRules(result)`.
10. Set `deriveRulesRunning = false`.
11. On error: log to stderr, set `deriveRulesRunning = false`, do not throw (caller uses `.catch(() => {})`).

### 2.2 Prompt

```
You are a tagging policy assistant. Based on the tag rejections below, produce a concise set of tagging rules (maximum 20 rules) for consistent tag generation.

Rules should cover:
- Naming conventions (case, format — e.g. lowercase, hyphenated, no spaces)
- Granularity (not too broad like "technology", not too specific like "2024-apple-keynote")
- Grouping logic (when to split topics into separate tags vs. combine them)

Existing rules (may be empty):
{existing_rules}

Tag rejections (tag → reason):
{rejection_lines}

Respond with ONLY the ruleset as a numbered list. No preamble, no explanation.
```

Where `{rejection_lines}` is each rejection formatted as `- "{tag}": {reason || "(no reason given)"}`, and `{existing_rules}` is the current rules text or `(none)` if empty.

### 2.3 Trigger

`deriveTagRules()` is called (fire-and-forget via `.catch(() => {})`) from the `POST /tags/reject` handler immediately after saving the rejection to DB.

---

## 3. API Changes (`src/server.ts`)

### 3.1 Modified: `POST /tags/reject`

**Request body:** `{ tag: string, reason?: string, itemId?: string }`

Additions to existing handler:
1. Extract `reason` from body (defaults to `''` if absent).
2. Call `saveTagRejection(tag, reason, itemId)` after `rejectTag(tag)`.
3. Call `deriveTagRules().catch(() => {})` — fire-and-forget.

Existing behavior unchanged: `rejectTag(tag)` still runs, re-tagging still fires if `itemId` present.

**Response:** `{ ok: true }` (unchanged)

### 3.2 New: `GET /tag-rules`

**Response:**
```json
{ "rules": "<ruleset text or empty string>" }
```

Returns `getTagRules()` wrapped in a JSON object.

### 3.3 New: `GET /tags/rejections`

**Response:** array of all rejection records, ordered by `created_at DESC`:
```json
[
  { "id": "rejection-...", "tag": "ai", "reason": "too broad", "itemId": null, "createdAt": "2026-04-11T..." },
  ...
]
```

Field names are camelCase in the JSON response (same convention as other endpoints).

---

## 4. Tag Suggestion Injection (`src/summarize.ts`)

### 4.1 `suggestTags()` change

Before building the prompt, call `getTagRules()`. If non-empty, prepend to the prompt:

```
Follow these tagging rules:
{rules}

```

The rules block is inserted before the existing tag guidance lines (approved/rejected lists).

### 4.2 `summarize()` — no change

Rules are not injected into the full summarize prompt. Tag suggestions in `summarize()` are governed by the approved/rejected lists only. Only `suggestTags()` (used for re-tagging) gets the rules injection. This keeps the summarize prompt focused and avoids inflating token usage on every save.

---

## 5. UI: Reject-with-Reason (`web/app.tsx`)

### 5.1 Location

Reader pane tag pills — the inline pending-tag review row. Currently shows ✓ and ✗ buttons per pending tag.

### 5.2 Interaction

**Before this change:** clicking ✗ immediately calls `POST /tags/reject`.

**After this change:**
1. Clicking ✗ on a pending tag pill reveals an inline reason input (a small `<input type="text">` + "Reject" submit button) directly below the tag pill row. The ✗ button changes to a cancel (×) affordance to allow dismissing without rejecting.
2. User types a reason (optional — submitting with empty input is allowed).
3. Clicking "Reject" (or pressing Enter) calls `POST /tags/reject` with `{ tag, reason, itemId }`.
4. On success: tag pill is removed, same as current behavior.

The reason input is inline — no modal. Only one tag can be in the "reason entry" state at a time; opening another collapses the previous one.

### 5.3 Approved tags

Approved tags (green pills) do not get a reject button. Out of scope for this feature — rejecting an already-approved tag would require a separate "demote" affordance. Left for a future spec.

---

## 6. Tests (`src/db.test.ts` and `src/server.test.ts`)

### 6.1 DB tests (`src/db.test.ts`)

```ts
test('saveTagRejection stores correctly', () => {
  saveTagRejection('ai', 'too broad', 'item-123');
  const all = getTagRejections();
  const match = all.find(r => r.tag === 'ai' && r.reason === 'too broad');
  expect(match).toBeDefined();
  expect(match!.item_id).toBe('item-123');
});

test('saveTagRejection works without reason or itemId', () => {
  saveTagRejection('technology');
  const all = getTagRejections();
  const match = all.find(r => r.tag === 'technology');
  expect(match).toBeDefined();
  expect(match!.reason).toBe('');
  expect(match!.item_id).toBeNull();
});

test('getTagRejections returns all rejections', () => {
  const before = getTagRejections().length;
  saveTagRejection('test-tag-a', 'reason a');
  saveTagRejection('test-tag-b', 'reason b');
  const after = getTagRejections();
  expect(after.length).toBe(before + 2);
});
```

Cleanup: delete test rejections in `afterEach` by tag name prefix (e.g. `DELETE FROM tag_rejections WHERE tag LIKE 'test-%' OR tag IN ('ai', 'technology')`), or use unique tag names per test with timestamp suffix.

### 6.2 API tests (`src/server.test.ts`)

```ts
test('POST /tags/reject with reason returns 200', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag: 'test-reject-tag', reason: 'too vague' }),
  });
  expect(res.status).toBe(200);
  const body = await res.json() as { ok: boolean };
  expect(body.ok).toBe(true);
});

test('GET /tag-rules returns text field', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tag-rules`);
  expect(res.status).toBe(200);
  const body = await res.json() as { rules: string };
  expect(typeof body.rules).toBe('string');
});

test('GET /tags/rejections returns array', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags/rejections`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});
```

---

## 7. UI Behaviour Table

### Extension popup

No change — the popup's reject button (✗ in modal inline review) calls `POST /tags/reject` without a reason. Reason capture is web app only for now.

### Web reader pane

| State | What user sees |
|---|---|
| Tag pending, idle | Tag pill with ✓ and ✗ buttons |
| ✗ clicked | Inline reason `<input>` + "Reject" + × (cancel) appear below the pill |
| "Reject" submitted | `POST /tags/reject { tag, reason, itemId }` → pill removed |
| × (cancel) clicked | Reason input collapses, ✗ button restored |

---

## 8. Edge Cases

| Scenario | Behavior |
|---|---|
| `reason` omitted from `POST /tags/reject` | `saveTagRejection` called with `''`; still triggers `deriveTagRules` |
| `deriveTagRules` called while already running | Second call is a no-op (semaphore guard) |
| LLM returns no useful text for rules | `saveTagRules('')` — empty string stored; no rules injected on next tag suggestion |
| `getTagRules()` returns `''` | No rules block prepended to `suggestTags` prompt |
| Zero rejections when `deriveTagRules` runs | Early return, existing rules unchanged |
| `tag_rules` key absent from `user_settings` | `getTagRules()` returns `''` (treated as no rules) |

---

## 9. Out of Scope

- Viewing/editing derived rules in the UI (future: settings panel)
- Injecting rules into the full `summarize()` prompt
- Per-item rejection history UI
- Reason capture in the Chrome extension
- Undo rejection with reason
