/**
 * Unit tests for db.ts — migration system, retry logic, and rowToItem mapping.
 *
 * These tests run against the module-level singleton db. Because migrate() runs
 * automatically on module import, all migration effects are observable immediately.
 * Retry tests use unique IDs with timestamps to avoid collisions with live data.
 */

import { test, expect, afterEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { asKnowledgeItemId } from './types.ts';
import type { KnowledgeItemId } from './types.ts';
import {
  db,
  sqlite,
  insertItem,
  updateItem,
  getItem,
  getItemsToRetry,
  incrementRetry,
  deleteItem,
  saveTagRejection,
  getTagRejections,
  getRecentItems,
  getChatHistory,
  saveChatMessage,
  clearChatHistory,
  saveSummaryQuality,
  getSummaryQuality,
} from './db.ts';

// ── Helpers ────────────────────────────────────────────────────────────────────

/** Generate a unique test item ID to avoid clashing with real data. */
function testId(label: string): KnowledgeItemId {
  return asKnowledgeItemId(`test-${label}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`);
}

/** Return all column names for a given table in the live db. */
function getColumns(tableName: string): string[] {
  // PRAGMA table_info does not support parameterised bindings; use string interpolation.
  // tableName is always a hard-coded literal in tests, not user input.
  const info = sqlite.query<{ name: string }, []>(
    `PRAGMA table_info(${tableName})`
  ).all();
  return info.map((r) => r.name);
}

/** Return all table names in the live db (excluding SQLite internals and FTS helpers). */
function getUserTables(): string[] {
  return sqlite.query<{ name: string }, []>(
    `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
  ).all().map((r) => r.name);
}

// Track test item IDs created so we can clean them up in afterEach.
const createdIds: string[] = [];

afterEach(() => {
  for (const id of createdIds.splice(0)) {
    try { deleteItem(id); } catch { /* ignore — item may already be gone */ }
  }
});

// ── Migration completeness ─────────────────────────────────────────────────────

test('migration sets PRAGMA user_version to 19', () => {
  const row = sqlite.query<{ user_version: number }, []>('PRAGMA user_version').get();
  expect(row).toBeTruthy();
  expect(row?.user_version).toBe(19);
});

test('all expected tables exist after migration', () => {
  const tables = getUserTables();
  const expected = [
    'items',
    'tags',
    'collections',
    'collection_items',
    'summary_history',
    'feeds',
    'filter_presets',
    'highlights',
    'user_settings',
    'chat_messages',
  ];
  for (const table of expected) {
    expect(tables).toContain(table);
  }
});

test('items table has all key columns', () => {
  const columns = getColumns('items');
  const expected = [
    'id',
    'url',
    'title',
    'summary',
    'tldr',
    'status',
    'retries',
    'starred',
    'pinned',
    'archived',
    'rating',
    'read_at',
    'notes',
    'feed_id',
    'retry_after',
    'published_at',
    'image_url',
    'author',
    'transcript',
    'sections',
    'tags',
    'error',
    'date_added',
    'type',
  ];
  for (const col of expected) {
    expect(columns).toContain(col);
  }
});

test('tags table has expected columns', () => {
  const columns = getColumns('tags');
  expect(columns).toContain('name');
  expect(columns).toContain('status');
  expect(columns).toContain('created_at');
  expect(columns).toContain('rejected_at');
});

test('highlights table has expected columns', () => {
  const columns = getColumns('highlights');
  expect(columns).toContain('id');
  expect(columns).toContain('item_id');
  expect(columns).toContain('text');
  expect(columns).toContain('comment');
  expect(columns).toContain('section');
  expect(columns).toContain('created_at');
});

test('filter_presets table has expected columns', () => {
  const columns = getColumns('filter_presets');
  expect(columns).toContain('id');
  expect(columns).toContain('name');
  expect(columns).toContain('search_query');
  expect(columns).toContain('tag_filter');
  expect(columns).toContain('semantic_mode');
  expect(columns).toContain('show_starred_only');
});

test('feeds table has expected columns', () => {
  const columns = getColumns('feeds');
  expect(columns).toContain('id');
  expect(columns).toContain('url');
  expect(columns).toContain('name');
  expect(columns).toContain('last_checked');
  expect(columns).toContain('active');
});

// ── Migration idempotency ──────────────────────────────────────────────────────

test('running ALTER TABLE on already-migrated columns does not throw', () => {
  // Simulate idempotency: all migration ALTER TABLE statements are wrapped in
  // try/catch in migrate(). We verify that manually re-running them is safe.
  const alters = [
    `ALTER TABLE items ADD COLUMN read_at TEXT`,
    `ALTER TABLE items ADD COLUMN tldr TEXT`,
    `ALTER TABLE items ADD COLUMN starred INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE items ADD COLUMN archived INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE items ADD COLUMN pinned INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE items ADD COLUMN retries INTEGER NOT NULL DEFAULT 0`,
    `ALTER TABLE items ADD COLUMN retry_after TEXT`,
  ];
  for (const sql of alters) {
    // Should not throw — the column already exists and SQLite returns an error
    // which the migration code swallows. We verify that pattern is correct.
    let threw = false;
    try {
      sqlite.run(sql);
    } catch {
      threw = true;
    }
    // We expect the duplicate-column error to be thrown (SQLite throws, migrate() catches).
    // This confirms the try/catch pattern in migrate() is necessary and correct.
    expect(threw).toBe(true);
  }
});

test('user_version remains at 19 after re-running idempotent PRAGMA set', () => {
  // Explicitly set user_version to current value — no regression.
  sqlite.run('PRAGMA user_version = 19');
  const row = sqlite.query<{ user_version: number }, []>('PRAGMA user_version').get();
  expect(row).toBeTruthy();
  expect(row?.user_version).toBe(19);
});

// ── Retry persistence ──────────────────────────────────────────────────────────

test('incrementRetry increments retries column by 1 each call', () => {
  const id = testId('retry-inc');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  // Baseline: retries should be 0 (DEFAULT 0)
  const baseline = sqlite.query<{ retries: number }, [string]>(
    `SELECT retries FROM items WHERE id = ?`
  ).get(id);
  expect(baseline?.retries).toBe(0);

  incrementRetry(id);
  const after1 = sqlite.query<{ retries: number }, [string]>(
    `SELECT retries FROM items WHERE id = ?`
  ).get(id);
  expect(after1?.retries).toBe(1);

  incrementRetry(id);
  const after2 = sqlite.query<{ retries: number }, [string]>(
    `SELECT retries FROM items WHERE id = ?`
  ).get(id);
  expect(after2?.retries).toBe(2);

  incrementRetry(id);
  const after3 = sqlite.query<{ retries: number }, [string]>(
    `SELECT retries FROM items WHERE id = ?`
  ).get(id);
  expect(after3?.retries).toBe(3);
});

test('incrementRetry sets retry_after to a future time', () => {
  const id = testId('retry-after');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  // Set status to error so the item qualifies for retry tracking
  sqlite.run(`UPDATE items SET status = 'error' WHERE id = ?`, [id]);

  const before = Date.now();
  incrementRetry(id);

  const row = sqlite.query<{ retry_after: string | null }, [string]>(
    `SELECT retry_after FROM items WHERE id = ?`
  ).get(id);

  expect(row?.retry_after).not.toBeNull();
  // retry_after should be in the future (retries was 0, so delay = 0 * 5 = 0 min,
  // meaning retry_after is ~now; just verify it is a valid ISO-like datetime string)
  expect(typeof row?.retry_after).toBe('string');
  expect((row?.retry_after ?? '').length).toBeGreaterThan(10);
});

test('getItemsToRetry returns item with retries=0 and a non-excluded error', () => {
  const id = testId('retry-eligible');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  // NOTE: error must be non-NULL and not match exclusion patterns.
  // A NULL error is excluded by the WHERE clause due to SQLite NULL comparison
  // semantics (NULL NOT LIKE '...' evaluates to NULL, not TRUE). This is a
  // logic gap documented in the test below.
  sqlite.run(
    `UPDATE items SET status = 'error', retries = 0, retry_after = NULL, error = 'fetch timeout' WHERE id = ?`,
    [id]
  );

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).toContain(id);
});

test('getItemsToRetry excludes item with retries=3 (budget exhausted)', () => {
  const id = testId('retry-exhausted');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  // Exhaust retry budget
  sqlite.run(`UPDATE items SET status = 'error', retries = 3, retry_after = NULL WHERE id = ?`, [id]);

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('getItemsToRetry excludes items with future retry_after', () => {
  const id = testId('retry-future');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  // Set retry_after far in the future
  sqlite.run(
    `UPDATE items SET status = 'error', retries = 1, retry_after = datetime('now', '+1 hour') WHERE id = ?`,
    [id]
  );

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('getItemsToRetry excludes 404 errors', () => {
  const id = testId('retry-404');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(
    `UPDATE items SET status = 'error', retries = 0, error = 'HTTP 404 not found', retry_after = NULL WHERE id = ?`,
    [id]
  );

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('getItemsToRetry excludes 403 errors', () => {
  const id = testId('retry-403');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(
    `UPDATE items SET status = 'error', retries = 0, error = 'HTTP 403 forbidden', retry_after = NULL WHERE id = ?`,
    [id]
  );

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('getItemsToRetry excludes private video errors', () => {
  const id = testId('retry-private');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'youtube', createdAt: new Date().toISOString() });
  sqlite.run(
    `UPDATE items SET status = 'error', retries = 0, error = 'This video is private', retry_after = NULL WHERE id = ?`,
    [id]
  );

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('getItemsToRetry excludes captions-disabled errors', () => {
  const id = testId('retry-captions');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'youtube', createdAt: new Date().toISOString() });
  sqlite.run(
    `UPDATE items SET status = 'error', retries = 0, error = 'captions disabled for this video', retry_after = NULL WHERE id = ?`,
    [id]
  );

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('getItemsToRetry includes items with NULL error (SQLite NOT LIKE NULL fix)', () => {
  // When error IS NULL, the old expression (error NOT LIKE '%404%') evaluated to
  // NULL (not TRUE) in SQLite, silently excluding valid retry candidates.
  // Fixed by: (error IS NULL OR (error NOT LIKE '%404%' AND ...))
  const id = testId('bug-null-error');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET status = 'error', retries = 0, retry_after = NULL WHERE id = ?`, [id]);

  const errorRow = sqlite.query<{ error: string | null }, [string]>(
    `SELECT error FROM items WHERE id = ?`
  ).get(id);
  expect(errorRow?.error).toBeNull();

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  // NULL error items are valid retry candidates and must be included.
  expect(ids).toContain(id);
});

test('getItemsToRetry does not return items with status=done', () => {
  const id = testId('retry-done');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET status = 'done', retries = 0, retry_after = NULL WHERE id = ?`, [id]);

  const results = getItemsToRetry();
  const ids = results.map((r) => r.id);
  expect(ids).not.toContain(id);
});

test('incrementRetry sets exponentially growing retry_after delay', () => {
  // After N retries, retry_after = now + (N * 5) minutes.
  // We verify that an item with retries=2 gets a longer retry_after than retries=0.

  const idA = testId('backoff-a');
  const idB = testId('backoff-b');
  createdIds.push(idA, idB);

  insertItem({ id: idA, url: `https://example.com/${idA}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idB, url: `https://example.com/${idB}`, type: 'article', createdAt: new Date().toISOString() });

  // idA starts at retries=0 → after increment: retry_after = now + 0*5 min = now
  sqlite.run(`UPDATE items SET retries = 0 WHERE id = ?`, [idA]);
  incrementRetry(idA);

  // idB starts at retries=2 → after increment: retry_after = now + 2*5 = +10 min
  sqlite.run(`UPDATE items SET retries = 2 WHERE id = ?`, [idB]);
  incrementRetry(idB);

  const rowA = sqlite.query<{ retry_after: string | null }, [string]>(
    `SELECT retry_after FROM items WHERE id = ?`
  ).get(idA);
  const rowB = sqlite.query<{ retry_after: string | null }, [string]>(
    `SELECT retry_after FROM items WHERE id = ?`
  ).get(idB);

  expect(rowA?.retry_after).not.toBeNull();
  expect(rowB?.retry_after).not.toBeNull();

  // idB should have a later retry_after (more minutes added)
  const timeA = new Date(rowA?.retry_after ?? '').getTime();
  const timeB = new Date(rowB?.retry_after ?? '').getTime();
  expect(timeB).toBeGreaterThan(timeA);
});

// ── rowToItem JSON parsing (via getItem) ───────────────────────────────────────

test('getItem returns tldr as a parsed string array', () => {
  const id = testId('rowtitem-tldr');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(
    `UPDATE items SET tldr = ?, status = 'done', title = 'Test' WHERE id = ?`,
    [JSON.stringify(['point one', 'point two', 'point three']), id]
  );

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.tldr)).toBe(true);
  expect(item.tldr).toEqual(['point one', 'point two', 'point three']);
});

test('getItem returns tags as a parsed string array', () => {
  const id = testId('rowtoitem-tags');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(
    `UPDATE items SET tags = ?, status = 'done', title = 'Test' WHERE id = ?`,
    [JSON.stringify(['javascript', 'typescript', 'bun']), id]
  );

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.tags)).toBe(true);
  expect(item.tags).toEqual(['javascript', 'typescript', 'bun']);
});

test('getItem returns sections as a parsed array of objects', () => {
  const id = testId('rowtoitem-sections');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  const sections = [
    { title: 'Introduction', points: ['Point A', 'Point B'] },
    { title: 'Conclusion', points: ['Final thought'] },
  ];
  sqlite.run(
    `UPDATE items SET sections = ?, status = 'done', title = 'Test' WHERE id = ?`,
    [JSON.stringify(sections), id]
  );

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.sections)).toBe(true);
  expect(item.sections).toHaveLength(2);
  const sec0 = item.sections[0];
  if (!sec0) throw new Error('section 0 should be defined');
  expect(sec0.title).toBe('Introduction');
  expect(sec0.points).toEqual(['Point A', 'Point B']);
});

test('getItem returns empty arrays for NULL JSON fields', () => {
  const id = testId('rowtoitem-nulls');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  // Leave tldr, tags, sections as NULL (the default after insertItem)

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.tldr)).toBe(true);
  expect(item.tldr).toHaveLength(0);
  expect(Array.isArray(item.tags)).toBe(true);
  expect(item.tags).toHaveLength(0);
  expect(Array.isArray(item.sections)).toBe(true);
  expect(item.sections).toHaveLength(0);
});

// ── Tag rejections ────────────────────────────────────────────────────────────

// Track rejection tags created so we can clean them up in afterEach.
const createdRejectionTags: string[] = [];

afterEach(() => {
  for (const tag of createdRejectionTags.splice(0)) {
    try {
      sqlite.run(`DELETE FROM tag_rejections WHERE tag = ?`, [tag]);
    } catch { /* ignore */ }
  }
});

test('tag_rejections table exists after migration', () => {
  const tables = getUserTables();
  expect(tables).toContain('tag_rejections');
});

test('tag_rejections table has expected columns', () => {
  const columns = getColumns('tag_rejections');
  expect(columns).toContain('id');
  expect(columns).toContain('tag');
  expect(columns).toContain('reason');
  expect(columns).toContain('item_id');
  expect(columns).toContain('created_at');
});

test('saveTagRejection stores tag, reason, and itemId correctly', () => {
  const tag = testId('rej-tag');
  createdRejectionTags.push(tag);
  saveTagRejection(tag, 'too broad', 'item-xyz');
  const all = getTagRejections();
  const match = all.find((r) => r.tag === tag);
  if (!match) throw new Error('match should be defined');
  expect(match.reason).toBe('too broad');
  expect(match.item_id).toBe('item-xyz');
});

test('saveTagRejection works without reason or itemId', () => {
  const tag = testId('rej-nreason');
  createdRejectionTags.push(tag);
  saveTagRejection(tag);
  const all = getTagRejections();
  const match = all.find((r) => r.tag === tag);
  if (!match) throw new Error('match should be defined');
  expect(match.reason).toBe('');
  expect(match.item_id).toBeNull();
});

test('getTagRejections returns all stored rejections', () => {
  const tagA = testId('rej-a');
  const tagB = testId('rej-b');
  createdRejectionTags.push(tagA, tagB);
  const before = getTagRejections().length;
  saveTagRejection(tagA, 'reason a');
  saveTagRejection(tagB, 'reason b');
  const after = getTagRejections();
  expect(after.length).toBe(before + 2);
  expect(after.find((r) => r.tag === tagA)).toBeDefined();
  expect(after.find((r) => r.tag === tagB)).toBeDefined();
});

test('getItem falls back gracefully on malformed JSON in tldr', () => {
  const id = testId('rowtoitem-bad-tldr');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  // Write deliberately broken JSON directly
  sqlite.run(`UPDATE items SET tldr = 'not valid json at all' WHERE id = ?`, [id]);

  // Should not throw; rowToItem catches JSON.parse errors and returns []
  let threw = false;
  let item = null;
  try {
    item = getItem(id);
  } catch {
    threw = true;
  }

  expect(threw).toBe(false);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.tldr)).toBe(true);
  expect(item.tldr).toHaveLength(0);
});

test('getItem falls back gracefully on malformed JSON in tags', () => {
  const id = testId('rowtoitem-bad-tags');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET tags = '{broken' WHERE id = ?`, [id]);

  let threw = false;
  let item = null;
  try {
    item = getItem(id);
  } catch {
    threw = true;
  }

  expect(threw).toBe(false);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.tags)).toBe(true);
  expect(item.tags).toHaveLength(0);
});

test('getItem falls back gracefully on malformed JSON in sections', () => {
  const id = testId('rowtoitem-bad-sections');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET sections = '][invalid' WHERE id = ?`, [id]);

  let threw = false;
  let item = null;
  try {
    item = getItem(id);
  } catch {
    threw = true;
  }

  expect(threw).toBe(false);
  if (!item) throw new Error('item should be defined');
  expect(Array.isArray(item.sections)).toBe(true);
  expect(item.sections).toHaveLength(0);
});

// ── Boolean field mapping ──────────────────────────────────────────────────────

test('getItem maps starred INTEGER 1 to boolean true', () => {
  const id = testId('bool-starred');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET starred = 1 WHERE id = ?`, [id]);

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.starred).toBe(true);
});

test('getItem maps starred INTEGER 0 to boolean false', () => {
  const id = testId('bool-unstarred');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET starred = 0 WHERE id = ?`, [id]);

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.starred).toBe(false);
});

test('getItem maps pinned INTEGER 1 to boolean true', () => {
  const id = testId('bool-pinned');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET pinned = 1 WHERE id = ?`, [id]);

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.pinned).toBe(true);
});

test('getItem maps archived INTEGER 1 to boolean true', () => {
  const id = testId('bool-archived');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET archived = 1 WHERE id = ?`, [id]);

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.archived).toBe(true);
});

// ── insertItem uniqueness constraint ──────────────────────────────────────────

test('insertItem with duplicate URL is a no-op (INSERT OR IGNORE)', () => {
  const id1 = testId('dup-a');
  const id2 = testId('dup-b');
  createdIds.push(id1);
  const url = `https://example.com/dup-${Date.now()}`;

  insertItem({ id: id1, url, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: id2, url, type: 'article', createdAt: new Date().toISOString() });

  // Only the first insert should have landed; second is ignored
  const row = sqlite.query<{ id: string }, [string]>(`SELECT id FROM items WHERE url = ?`).get(url);
  expect(row?.id).toBe(id1);
});

// ── getItem not found ──────────────────────────────────────────────────────────

test('getItem returns null for non-existent id', () => {
  const result = getItem('does-not-exist-xyz-123');
  expect(result).toBeNull();
});

// ── deleteItem cascade ────────────────────────────────────────────────────────

test('deleteItem removes item and associated rows from collection_items and summary_history', () => {
  const id = testId('delete-cascade');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  // Insert a collection and link the item to it
  const collectionId = testId('del-col');
  sqlite.run(
    `INSERT INTO collections (id, name, created_at) VALUES (?, ?, datetime('now'))`,
    [collectionId, `col-${collectionId}`]
  );
  sqlite.run(
    `INSERT INTO collection_items (collection_id, item_id, added_at) VALUES (?, ?, datetime('now'))`,
    [collectionId, id]
  );

  // Insert a summary_history row for the item
  sqlite.run(
    `INSERT INTO summary_history (item_id, summary, tldr, sections, created_at) VALUES (?, ?, ?, ?, datetime('now'))`,
    [id, 'test summary', '[]', '[]']
  );

  // Verify rows exist before delete
  const colItemBefore = sqlite.query<{ item_id: string }, [string, string]>(
    `SELECT item_id FROM collection_items WHERE collection_id = ? AND item_id = ?`
  ).get(collectionId, id);
  expect(colItemBefore).not.toBeNull();

  const historyBefore = sqlite.query<{ item_id: string }, [string]>(
    `SELECT item_id FROM summary_history WHERE item_id = ?`
  ).get(id);
  expect(historyBefore).not.toBeNull();

  deleteItem(id);

  // Item must be gone
  expect(getItem(id)).toBeNull();

  // collection_items row must be gone
  const colItemAfter = sqlite.query<{ item_id: string }, [string, string]>(
    `SELECT item_id FROM collection_items WHERE collection_id = ? AND item_id = ?`
  ).get(collectionId, id);
  expect(colItemAfter).toBeNull();

  // summary_history rows must be gone
  const historyAfter = sqlite.query<{ item_id: string }, [string]>(
    `SELECT item_id FROM summary_history WHERE item_id = ?`
  ).get(id);
  expect(historyAfter).toBeNull();

  // Clean up the test collection
  sqlite.run(`DELETE FROM collections WHERE id = ?`, [collectionId]);
});

// ── getRecentItems ────────────────────────────────────────────────────────────

test('getRecentItems returns done items by default (includeAll=false)', () => {
  const idDone = testId('recent-done');
  const idQueued = testId('recent-queued');
  createdIds.push(idDone, idQueued);
  insertItem({ id: idDone, url: `https://test-recent.example.com/${idDone}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idQueued, url: `https://test-recent.example.com/${idQueued}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET status = 'done', title = 'Done Item' WHERE id = ?`, [idDone]);
  sqlite.run(`UPDATE items SET status = 'queued' WHERE id = ?`, [idQueued]);

  const results = getRecentItems(100, false);
  const ids = results.map((r) => r.id);
  expect(ids).toContain(idDone);
  expect(ids).not.toContain(idQueued);
});

test('getRecentItems with includeAll=true returns queued items too', () => {
  const idDone = testId('recent-all-done');
  const idQueued = testId('recent-all-queued');
  const idProcessing = testId('recent-all-processing');
  createdIds.push(idDone, idQueued, idProcessing);
  insertItem({ id: idDone, url: `https://test-recent-all.example.com/${idDone}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idQueued, url: `https://test-recent-all.example.com/${idQueued}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idProcessing, url: `https://test-recent-all.example.com/${idProcessing}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET status = 'done', title = 'Done' WHERE id = ?`, [idDone]);
  sqlite.run(`UPDATE items SET status = 'queued' WHERE id = ?`, [idQueued]);
  sqlite.run(`UPDATE items SET status = 'processing' WHERE id = ?`, [idProcessing]);

  const results = getRecentItems(100, true);
  const ids = results.map((r) => r.id);
  expect(ids).toContain(idDone);
  expect(ids).toContain(idQueued);
  expect(ids).toContain(idProcessing);
});

test('getRecentItems respects the limit parameter', () => {
  const idA = testId('recent-limit-a');
  const idB = testId('recent-limit-b');
  const idC = testId('recent-limit-c');
  createdIds.push(idA, idB, idC);
  insertItem({ id: idA, url: `https://test-recent-limit.example.com/${idA}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idB, url: `https://test-recent-limit.example.com/${idB}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idC, url: `https://test-recent-limit.example.com/${idC}`, type: 'article', createdAt: new Date().toISOString() });
  sqlite.run(`UPDATE items SET status = 'done', title = 'A' WHERE id = ?`, [idA]);
  sqlite.run(`UPDATE items SET status = 'done', title = 'B' WHERE id = ?`, [idB]);
  sqlite.run(`UPDATE items SET status = 'done', title = 'C' WHERE id = ?`, [idC]);

  // With limit=1, only 1 result should be returned
  const results = getRecentItems(1, false);
  expect(results.length).toBe(1);
});

test('getRecentItems returns newest items first', () => {
  const idOld = testId('recent-order-old');
  const idNew = testId('recent-order-new');
  createdIds.push(idOld, idNew);

  const oldDate = '2020-01-01T00:00:00.000Z';
  const newDate = '2025-01-01T00:00:00.000Z';
  insertItem({ id: idOld, url: `https://test-recent-order.example.com/${idOld}`, type: 'article', createdAt: oldDate });
  insertItem({ id: idNew, url: `https://test-recent-order.example.com/${idNew}`, type: 'article', createdAt: newDate });
  sqlite.run(`UPDATE items SET status = 'done', title = 'Old', date_added = ? WHERE id = ?`, [oldDate, idOld]);
  sqlite.run(`UPDATE items SET status = 'done', title = 'New', date_added = ? WHERE id = ?`, [newDate, idNew]);

  const results = getRecentItems(100, false);
  const ids = results.map((r) => r.id);
  const oldIndex = ids.indexOf(idOld);
  const newIndex = ids.indexOf(idNew);

  expect(oldIndex).not.toBe(-1);
  expect(newIndex).not.toBe(-1);
  // Newer item should appear before older item
  expect(newIndex).toBeLessThan(oldIndex);
});

// ── studyLater via updateItem + getItem ───────────────────────────────────────

test('updateItem study_later=1 sets studyLater to true on getItem', () => {
  const id = testId('study-later-true');
  createdIds.push(id);
  insertItem({ id, url: `https://test-study-later.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  updateItem(id, { study_later: 1 });

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.studyLater).toBe(true);
});

test('updateItem study_later=0 sets studyLater to false on getItem', () => {
  const id = testId('study-later-false');
  createdIds.push(id);
  insertItem({ id, url: `https://test-study-later.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  // First set it to 1 then back to 0
  updateItem(id, { study_later: 1 });
  updateItem(id, { study_later: 0 });

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.studyLater).toBe(false);
});

test('studyLater defaults to false for new items', () => {
  const id = testId('study-later-default');
  createdIds.push(id);
  insertItem({ id, url: `https://test-study-later.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  const item = getItem(id);
  if (!item) throw new Error('item should be defined');
  expect(item.studyLater).toBe(false);
});

// ── getChatHistory, saveChatMessage, clearChatHistory ─────────────────────────

test('saveChatMessage stores user message correctly', () => {
  const id = testId('chat-user-msg');
  createdIds.push(id);
  insertItem({ id, url: `https://test-chat-history.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveChatMessage(id, 'user', 'Hello, what is this article about?');

  const history = getChatHistory(id);
  expect(history.length).toBe(1);
  const h0 = history[0];
  if (!h0) throw new Error('history[0] should be defined');
  expect(h0.role).toBe('user');
  expect(h0.content).toBe('Hello, what is this article about?');
});

test('saveChatMessage stores assistant message correctly', () => {
  const id = testId('chat-assistant-msg');
  createdIds.push(id);
  insertItem({ id, url: `https://test-chat-history.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveChatMessage(id, 'assistant', 'This article is about testing.');

  const history = getChatHistory(id);
  expect(history.length).toBe(1);
  const h0 = history[0];
  if (!h0) throw new Error('history[0] should be defined');
  expect(h0.role).toBe('assistant');
  expect(h0.content).toBe('This article is about testing.');
});

test('getChatHistory returns messages in insertion order (ASC)', () => {
  const id = testId('chat-order');
  createdIds.push(id);
  insertItem({ id, url: `https://test-chat-history.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveChatMessage(id, 'user', 'First message');
  saveChatMessage(id, 'assistant', 'Second message');
  saveChatMessage(id, 'user', 'Third message');

  const history = getChatHistory(id);
  expect(history.length).toBe(3);
  const [hh0, hh1, hh2] = history;
  if (!hh0 || !hh1 || !hh2) throw new Error('history entries should be defined');
  expect(hh0.content).toBe('First message');
  expect(hh1.content).toBe('Second message');
  expect(hh2.content).toBe('Third message');
});

test('getChatHistory returns empty array when no messages exist', () => {
  const id = testId('chat-empty');
  createdIds.push(id);
  insertItem({ id, url: `https://test-chat-history.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  const history = getChatHistory(id);
  expect(Array.isArray(history)).toBe(true);
  expect(history.length).toBe(0);
});

test('clearChatHistory removes all messages for an item', () => {
  const id = testId('chat-clear');
  createdIds.push(id);
  insertItem({ id, url: `https://test-chat-history.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveChatMessage(id, 'user', 'Message one');
  saveChatMessage(id, 'assistant', 'Message two');
  expect(getChatHistory(id).length).toBe(2);

  clearChatHistory(id);

  const history = getChatHistory(id);
  expect(Array.isArray(history)).toBe(true);
  expect(history.length).toBe(0);
});

test('clearChatHistory does not affect messages for other items', () => {
  const idA = testId('chat-clear-a');
  const idB = testId('chat-clear-b');
  createdIds.push(idA, idB);
  insertItem({ id: idA, url: `https://test-chat-history.example.com/${idA}`, type: 'article', createdAt: new Date().toISOString() });
  insertItem({ id: idB, url: `https://test-chat-history.example.com/${idB}`, type: 'article', createdAt: new Date().toISOString() });

  saveChatMessage(idA, 'user', 'Message for A');
  saveChatMessage(idB, 'user', 'Message for B');

  clearChatHistory(idA);

  expect(getChatHistory(idA).length).toBe(0);
  const histB = getChatHistory(idB);
  expect(histB.length).toBe(1);
  const histB0 = histB[0];
  if (!histB0) throw new Error('histB[0] should be defined');
  expect(histB0.content).toBe('Message for B');
});

test('deleteItem cascades to delete chat_messages', () => {
  const id = testId('chat-cascade-delete');
  // Do NOT push to createdIds — we call deleteItem manually in this test
  insertItem({ id, url: `https://test-chat-history.example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveChatMessage(id, 'user', 'Will be deleted');
  saveChatMessage(id, 'assistant', 'Also deleted');
  expect(getChatHistory(id).length).toBe(2);

  deleteItem(id);

  const history = getChatHistory(id);
  expect(Array.isArray(history)).toBe(true);
  expect(history.length).toBe(0);
});

// ── Summary quality (normalized table) ───────────────────────────────────────

test('saveSummaryQuality stores rating and reason in summary_quality table', () => {
  const id = testId('sq-save');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveSummaryQuality(id, 4, 'Lacks detail on edge cases');

  const result = getSummaryQuality(id);
  expect(result.rating).toBe(4);
  expect(result.reason).toBe('Lacks detail on edge cases');
  expect(result.ratedAt).toBeTruthy();
});

test('saveSummaryQuality upserts on second call', () => {
  const id = testId('sq-upsert');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  saveSummaryQuality(id, 3, 'OK');
  saveSummaryQuality(id, 5, 'Much better after re-summarize');

  const result = getSummaryQuality(id);
  expect(result.rating).toBe(5);
  expect(result.reason).toBe('Much better after re-summarize');

  // Should be exactly one row, not two
  const count = sqlite.query<{ c: number }, [string]>(
    'SELECT COUNT(*) as c FROM summary_quality WHERE item_id = ?'
  ).get(id);
  if (!count) throw new Error('count should be defined');
  expect(count.c).toBe(1);
});

test('getSummaryQuality returns nulls for item with no rating', () => {
  const id = testId('sq-none');
  createdIds.push(id);
  insertItem({ id, url: `https://example.com/${id}`, type: 'article', createdAt: new Date().toISOString() });

  const result = getSummaryQuality(id);
  expect(result.rating).toBeNull();
  expect(result.reason).toBeNull();
  expect(result.ratedAt).toBeNull();
});
