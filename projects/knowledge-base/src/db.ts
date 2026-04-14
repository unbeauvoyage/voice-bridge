import { eq, sql, and, desc, asc, isNotNull, isNull, ne, inArray, like, or, not } from 'drizzle-orm';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import type { SQLQueryBindings } from 'bun:sqlite';
import type { Feed, KnowledgeItem, KnowledgeSection } from './types.ts';
import { asKnowledgeItemId } from './types.ts';
import { config } from './config.ts';
import { db, sqlite, schema } from './db/client.ts';
import { normalizeTagsForItem, recordConsolidation } from './db/tag-normalization.ts';
import { dbTypeToDomain, domainTypeToDb, isKnowledgeItemType } from './db-type-mapping.ts';

// Run Drizzle migrations
migrate(db, { migrationsFolder: './drizzle' });

// ── FTS5 full-text search (raw SQL — cannot be expressed in Drizzle) ────────

function initFts(): void {
  sqlite.run(`CREATE VIRTUAL TABLE IF NOT EXISTS items_fts USING fts5(
    title, summary, transcript,
    content=items,
    content_rowid=rowid
  )`);

  sqlite.run(`CREATE TRIGGER IF NOT EXISTS items_fts_insert AFTER INSERT ON items BEGIN
    INSERT INTO items_fts(rowid, title, summary, transcript)
    VALUES (new.rowid, new.title, COALESCE(new.summary,''), COALESCE(new.transcript,''));
  END`);

  sqlite.run(`CREATE TRIGGER IF NOT EXISTS items_fts_update AFTER UPDATE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, summary, transcript)
    VALUES ('delete', old.rowid, old.title, COALESCE(old.summary,''), COALESCE(old.transcript,''));
    INSERT INTO items_fts(rowid, title, summary, transcript)
    VALUES (new.rowid, new.title, COALESCE(new.summary,''), COALESCE(new.transcript,''));
  END`);

  sqlite.run(`CREATE TRIGGER IF NOT EXISTS items_fts_delete AFTER DELETE ON items BEGIN
    INSERT INTO items_fts(items_fts, rowid, title, summary, transcript)
    VALUES ('delete', old.rowid, old.title, COALESCE(old.summary,''), COALESCE(old.transcript,''));
  END`);
}

initFts();

// ── Default settings ─────────────────────────────────────────────────────────

const DEFAULTS: Record<string, string> = {
  summary_language: 'english',
  translate_terms: 'true',
  theme: 'dark',
  summary_detail: 'standard',
  daily_goal: '3',
  weekly_goal: '15',
  daily_reading_goal: '3',
  weekly_reading_goal: '15',
};

for (const [key, value] of Object.entries(DEFAULTS)) {
  sqlite.run(`INSERT OR IGNORE INTO user_settings (key, value) VALUES (?, ?)`, [key, value]);
}

// Re-export db and sqlite for any consumers that import them directly
export { db, sqlite };

// ── Raw row shape for complex queries ────────────────────────────────────────

const KNOWN_STATUSES = ['queued', 'processing', 'done', 'error'] as const;
type KnownStatus = (typeof KNOWN_STATUSES)[number];
function isKnownStatus(v: string): v is KnownStatus {
  return KNOWN_STATUSES.some((s) => s === v);
}
function toItemStatus(raw: string): KnownStatus {
  return isKnownStatus(raw) ? raw : 'error';
}

interface DBRow {
  id: string;
  url: string;
  type: string;
  title: string;
  author: string | null;
  status: string;
  transcript: string | null;
  summary: string | null;
  sections: string | null;
  tags: string | null;
  error: string | null;
  date_added: string;
  read_at: string | null;
  tldr: string | null;
  notes: string | null;
  starred: number;
  archived: number;
  published_at: string | null;
  pinned: number;
  feed_id: string | null;
  feed_name?: string | null;
  rating: number | null;
  image_url: string | null;
  study_later?: number;
  summary_model: string | null;
}

function rowToItem(row: DBRow, includeTranscript = true): KnowledgeItem {
  let sections: KnowledgeSection[] = [];
  try { sections = row.sections ? JSON.parse(row.sections) : []; } catch { sections = []; }
  let tags: string[] = [];
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { tags = []; }
  let tldr: string[] = [];
  try { tldr = row.tldr ? JSON.parse(row.tldr) : []; } catch { tldr = []; }
  const item: KnowledgeItem = {
    id: asKnowledgeItemId(row.id),
    url: row.url,
    type: dbTypeToDomain(row.type),
    title: row.title,
    createdAt: row.date_added,
    tags,
    tldr,
    summary: row.summary ?? '',
    sections,
    status: toItemStatus(row.status),
    starred: row.starred === 1,
    archived: row.archived === 1,
    pinned: row.pinned === 1,
    studyLater: Boolean(row.study_later ?? 0),
  };
  if (includeTranscript) item.transcript = row.transcript ?? '';
  if (row.author !== null) item.author = row.author;
  if (row.error !== null) item.error = row.error;
  if (row.read_at !== null) item.readAt = row.read_at;
  if (row.notes !== null) item.notes = row.notes;
  if (row.published_at !== null) item.publishedAt = row.published_at;
  if (row.feed_id !== null) item.feedId = row.feed_id;
  if (row.feed_name != null) item.feedName = row.feed_name;
  if (row.rating !== null) item.rating = row.rating;
  if (row.image_url !== null) item.imageUrl = row.image_url;
  if (row.summary_model !== null) item.summaryModel = row.summary_model;
  return item;
}

// ── Type-safe JSON parsing helpers ───────────────────────────────────────────

/**
 * Parses a JSON string as a string array.
 * Returns [] if the input is empty, invalid JSON, or not an array of strings.
 * Filters out any non-string elements rather than failing entirely.
 */
export function parseTagArray(raw: string): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((t): t is string => typeof t === 'string');
  } catch {
    return [];
  }
}

// ── Settings ─────────────────────────────────────────────────────────────────

export function getSetting(key: string): string | null {
  const row = db.select({ value: schema.userSettings.value })
    .from(schema.userSettings)
    .where(eq(schema.userSettings.key, key))
    .get();
  return row?.value ?? null;
}

export function setSetting(key: string, value: string): void {
  sqlite.run(
    `INSERT INTO user_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
    [key, value]
  );
}

export function getAllSettings(): Record<string, string> {
  const rows = db.select().from(schema.userSettings).all();
  const result: Record<string, string> = {};
  for (const row of rows) result[row.key] = row.value;
  return result;
}

// ── Item CRUD ────────────────────────────────────────────────────────────────

export function insertItem(item: Pick<KnowledgeItem, 'id' | 'url' | 'type' | 'createdAt'> & { feedId?: string }): void {
  sqlite.run(
    `INSERT OR IGNORE INTO items (id, url, type, date_added, feed_id) VALUES (?, ?, ?, ?, ?)`,
    [item.id, item.url, domainTypeToDb(item.type), item.createdAt, item.feedId ?? null]
  );
}

export function updateItem(id: string, fields: Partial<Omit<KnowledgeItem, 'id'>> & { study_later?: number }): void {
  const colMap: Record<string, string> = {
    title: 'title',
    author: 'author',
    status: 'status',
    transcript: 'transcript',
    summary: 'summary',
    sections: 'sections',
    tags: 'tags',
    error: 'error',
    type: 'type',
    readAt: 'read_at',
    tldr: 'tldr',
    publishedAt: 'published_at',
    imageUrl: 'image_url',
    study_later: 'study_later',
    summaryModel: 'summary_model',
  };
  const setClauses: string[] = [];
  const values: SQLQueryBindings[] = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      // fields is Partial<Omit<KnowledgeItem,'id'>> — dynamic key access returns a union of all field types
      type FieldValue = KnowledgeItem[keyof KnowledgeItem] | undefined;
      let val: FieldValue = Object.hasOwn(fields, key) ? Reflect.get(fields, key) : undefined;
      // Map domain type back to DB storage value before writing
      if (key === 'type' && typeof val === 'string' && isKnowledgeItemType(val)) {
        val = domainTypeToDb(val);
      }
      setClauses.push(`${col} = ?`);
      // Serialize arrays/objects to JSON; primitives pass through to SQLite
      const serialized = (Array.isArray(val) || (val !== null && typeof val === 'object')) ? JSON.stringify(val) : val;
      // isSQLBinding checks the runtime shape of the serialized value — parameter must be unknown
      // because serialized may be a string (JSON.stringify result) or any FieldValue union member
      const isSQLBinding = (v: unknown): v is SQLQueryBindings =>
        v === null || typeof v === 'string' || typeof v === 'number' ||
        typeof v === 'boolean' || typeof v === 'bigint' || v instanceof Uint8Array;
      if (isSQLBinding(serialized)) values.push(serialized);
      else values.push(null); // fallback: drop unserializable value
    }
  }
  if (!setClauses.length) return;
  values.push(id);
  sqlite.run(`UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`, values);
}

export function markRead(id: string): void {
  db.update(schema.items)
    .set({ readAt: new Date().toISOString() })
    .where(eq(schema.items.id, id))
    .run();
}

export function markUnread(id: string): void {
  db.update(schema.items)
    .set({ readAt: sql`NULL` })
    .where(eq(schema.items.id, id))
    .run();
}

export function rateItem(id: string, rating: number): void {
  if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
    throw new Error('Rating must be an integer between 1 and 5');
  }
  db.update(schema.items)
    .set({ rating })
    .where(eq(schema.items.id, id))
    .run();
}

export function getItem(id: string): KnowledgeItem | null {
  const row = sqlite.query<DBRow, [string]>(
    `SELECT i.*, f.name as feed_name FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.id = ?`
  ).get(id);
  return row ? rowToItem(row) : null;
}

export function getItemByUrl(url: string): KnowledgeItem | null {
  const row = sqlite.query<DBRow, [string]>(
    `SELECT i.*, f.name as feed_name FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.url = ?`
  ).get(url);
  return row ? rowToItem(row) : null;
}

export function listItems(sortBy?: 'rating'): KnowledgeItem[] {
  const orderClause = sortBy === 'rating'
    ? 'ORDER BY COALESCE(i.pinned, 0) DESC, i.rating DESC NULLS LAST, i.date_added DESC'
    : 'ORDER BY COALESCE(i.pinned, 0) DESC, i.date_added DESC';
  const rows = sqlite.query<DBRow, []>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name, i.rating, COALESCE(i.study_later, 0) as study_later, i.summary_model     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id
     WHERE i.status = 'done' AND COALESCE(i.archived, 0) = 0 ${orderClause}`
  ).all();
  return rows.map((row) => rowToItem(row, false));
}

export function listArchivedItems(): KnowledgeItem[] {
  const rows = sqlite.query<DBRow, []>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name, i.rating, COALESCE(i.study_later, 0) as study_later, i.summary_model     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id
     WHERE i.status = 'done' AND COALESCE(i.archived, 0) = 1 ORDER BY i.date_added DESC`
  ).all();
  return rows.map((row) => rowToItem(row, false));
}

export function getRecentItems(limit: number, includeAll: boolean): KnowledgeItem[] {
  const statusFilter = includeAll
    ? ''
    : "AND i.status = 'done'";
  const rows = sqlite.query<DBRow, [number]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript,
     i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr,
     i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at,
     COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name, i.rating,
     COALESCE(i.study_later, 0) as study_later
     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id
     WHERE COALESCE(i.archived, 0) = 0 ${statusFilter}
     ORDER BY i.date_added DESC LIMIT ?`
  ).all(limit);
  return rows.map((row) => rowToItem(row, false));
}

export function getAllItemsFull(): KnowledgeItem[] {
  const rows = sqlite.query<DBRow, []>(
    `SELECT i.*, f.name as feed_name FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.status = 'done' ORDER BY i.date_added DESC`
  ).all();
  return rows.map((row) => rowToItem(row, true));
}

export function itemExistsByUrl(url: string): boolean {
  const row = db.select({ id: schema.items.id })
    .from(schema.items)
    .where(eq(schema.items.url, url))
    .get();
  return row !== undefined;
}

// Escape LIKE special chars so user input matches literally
function escapeLike(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/%/g, '\\%').replace(/_/g, '\\_');
}

export function searchItems(q: string, tag: string): KnowledgeItem[] {
  const conditions: string[] = [`i.status = 'done'`, `COALESCE(i.archived, 0) = 0`];
  const values: SQLQueryBindings[] = [];

  if (q) {
    const likeVal = `%${escapeLike(q)}%`;
    conditions.push(`(i.title LIKE ? ESCAPE '\\' OR i.summary LIKE ? ESCAPE '\\' OR i.transcript LIKE ? ESCAPE '\\' OR i.sections LIKE ? ESCAPE '\\')`);
    values.push(likeVal, likeVal, likeVal, likeVal);
  }

  if (tag) {
    conditions.push(`i.tags LIKE ? ESCAPE '\\'`);
    values.push(`%"${escapeLike(tag)}"%`);
  }

  const rows = sqlite.query<DBRow, SQLQueryBindings[]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name, i.rating, COALESCE(i.study_later, 0) as study_later, i.summary_model     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE ${conditions.join(' AND ')} ORDER BY i.date_added DESC`
  ).all(...values);
  return rows.map((row) => rowToItem(row, false));
}

// ── Tag functions ─────────────────────────────────────────────────────────────

export function upsertTag(name: string, status: 'pending' | 'approved' | 'rejected'): void {
  const now = new Date().toISOString();
  const rejectedAt = status === 'rejected' ? now : null;
  sqlite.run(
    `INSERT INTO tags (name, status, created_at, rejected_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       status = CASE WHEN tags.status = 'approved' AND excluded.status = 'pending' THEN 'approved' ELSE excluded.status END,
       rejected_at = COALESCE(excluded.rejected_at, tags.rejected_at)`,
    [name, status, now, rejectedAt]
  );
}

export function approveTag(name: string): void {
  sqlite.run(
    `INSERT INTO tags (name, status, created_at) VALUES (?, 'approved', ?)
     ON CONFLICT(name) DO UPDATE SET status = 'approved'`,
    [name, new Date().toISOString()]
  );
}

export function rejectTag(name: string): void {
  const now = new Date().toISOString();
  sqlite.run(
    `INSERT INTO tags (name, status, created_at, rejected_at) VALUES (?, 'rejected', ?, ?)
     ON CONFLICT(name) DO UPDATE SET status = 'rejected', rejected_at = ?`,
    [name, now, now, now]
  );
}

export function deleteTag(name: string): void {
  sqlite.run(`DELETE FROM tags WHERE name = ?`, [name]);
  sqlite.run(`DELETE FROM tag_rejections WHERE tag = ?`, [name]);
}

export function renameTag(oldName: string, newName: string): void {
  const items = sqlite.query<{ id: string; tags: string | null }, [string]>(
    `SELECT id, tags FROM items WHERE tags LIKE ?`
  ).all(`%"${oldName}"%`);
  for (const item of items) {
    const tags = parseTagArray(item.tags || '[]');
    const newTags = tags.map((t) => t === oldName ? newName : t);
    sqlite.run('UPDATE items SET tags = ? WHERE id = ?', [JSON.stringify(newTags), item.id]);
  }
  sqlite.run('UPDATE tags SET name = ? WHERE name = ?', [newName, oldName]);
}

export function mergeTags(from: string, to: string): number {
  const items = sqlite.query<{ id: string; tags: string | null }, [string]>(
    `SELECT id, tags FROM items WHERE tags LIKE ?`
  ).all(`%"${from}"%`);
  let itemsUpdated = 0;
  for (const item of items) {
    const tags = parseTagArray(item.tags || '[]');
    if (!tags.includes(from)) continue;
    const newTags = [...new Set(tags.map((t) => (t === from ? to : t)))];
    sqlite.run('UPDATE items SET tags = ? WHERE id = ?', [JSON.stringify(newTags), item.id]);
    itemsUpdated++;
  }
  sqlite.run('DELETE FROM tags WHERE name = ?', [from]);
  return itemsUpdated;
}

export function getApprovedTags(): string[] {
  const rows = db.select({ name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.status, 'approved'))
    .orderBy(asc(schema.tags.name))
    .all();
  return rows.map((r) => r.name);
}

export function getRejectedTags(): string[] {
  const rows = db.select({ name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.status, 'rejected'))
    .orderBy(asc(schema.tags.name))
    .all();
  return rows.map((r) => r.name);
}

export function getPendingTagsWithItems(): { tag: string; itemId: string; itemTitle: string }[] {
  const pendingTags = db.select({ name: schema.tags.name })
    .from(schema.tags)
    .where(eq(schema.tags.status, 'pending'))
    .orderBy(desc(schema.tags.createdAt))
    .all()
    .map((r) => r.name);

  const results: { tag: string; itemId: string; itemTitle: string }[] = [];
  for (const tag of pendingTags) {
    const item = sqlite.query<{ id: string; title: string }, [string]>(
      `SELECT id, title FROM items WHERE status = 'done' AND tags LIKE ? ESCAPE '\\' LIMIT 1`
    ).get(`%"${escapeLike(tag)}"%`);
    results.push({ tag, itemId: item?.id ?? '', itemTitle: item?.title ?? '' });
  }
  return results;
}

// ── FTS5 search ───────────────────────────────────────────────────────────────

interface FtsRow extends DBRow {
  fts_snippet: string;
}

export function ftsSearch(q: string): Array<{ item: KnowledgeItem; snippet: string }> {
  const rows = sqlite.query<FtsRow, [string]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, fd.name as feed_name, i.rating, COALESCE(i.study_later, 0) as study_later, i.summary_model,
            snippet(items_fts, 1, '<mark>', '</mark>', '…', 20) AS fts_snippet
     FROM items_fts f
     JOIN items i ON i.rowid = f.rowid
     LEFT JOIN feeds fd ON fd.id = i.feed_id
     WHERE items_fts MATCH ? AND i.status = 'done' AND COALESCE(i.archived, 0) = 0
     ORDER BY rank`
  ).all(q);
  return rows.map((row) => ({ item: rowToItem(row, false), snippet: row.fts_snippet }));
}

export function backfillFts(): void {
  sqlite.run(`INSERT OR IGNORE INTO items_fts(rowid, title, summary, transcript)
    SELECT rowid, title, COALESCE(summary,''), COALESCE(transcript,'') FROM items`);
}

// ── Vector embedding functions ────────────────────────────────────────────────

function cosineSimilarity(a: Float32Array, b: Float32Array): number {
  let dot = 0, magA = 0, magB = 0;
  for (let i = 0; i < a.length; i++) {
    const ai = a.at(i) ?? 0;
    const bi = b.at(i) ?? 0;
    dot += ai * bi;
    magA += ai * ai;
    magB += bi * bi;
  }
  return dot / (Math.sqrt(magA) * Math.sqrt(magB) + 1e-10);
}

export function saveEmbedding(itemId: string, embedding: number[]): void {
  const blob = Buffer.from(new Float32Array(embedding).buffer);
  sqlite.run(
    `INSERT OR REPLACE INTO item_embeddings(item_id, embedding) VALUES (?, ?)`,
    [itemId, blob]
  );
}

export function semanticSearch(queryEmbedding: number[], limit = 20): KnowledgeItem[] {
  const queryVec = new Float32Array(queryEmbedding);

  interface EmbedRow { item_id: string; embedding: Buffer }
  const embedRows = sqlite.query<EmbedRow, []>(
    `SELECT item_id, embedding FROM item_embeddings`
  ).all();

  const scored = embedRows.map((row) => {
    const bytes = row.embedding instanceof Uint8Array ? row.embedding : new Uint8Array(row.embedding);
    const safeBuf = new ArrayBuffer(bytes.byteLength);
    new Uint8Array(safeBuf).set(bytes);
    const vec = new Float32Array(safeBuf);
    return { item_id: row.item_id, score: cosineSimilarity(queryVec, vec) };
  }).filter(r => r.score >= 0.45);

  scored.sort((a, b) => b.score - a.score);
  const topIds = scored.slice(0, limit).map((r) => r.item_id);
  if (topIds.length === 0) return [];

  const placeholders = topIds.map(() => '?').join(', ');
  const rows = sqlite.query<DBRow, string[]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name, i.rating, COALESCE(i.study_later, 0) as study_later, i.summary_model     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.id IN (${placeholders}) AND i.status = 'done' AND COALESCE(i.archived, 0) = 0`
  ).all(...topIds);

  const rowMap = new Map(rows.map((r) => [r.id, r]));
  return topIds.flatMap((id) => {
    const row = rowMap.get(id);
    return row ? [rowToItem(row, false)] : [];
  });
}

export function getEmbedStatus(): { total: number; embedded: number; pending: number } {
  const total = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done'`).get()?.count) ?? 0;
  const embedded = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM item_embeddings`).get()?.count) ?? 0;
  return { total, embedded, pending: total - embedded };
}

// ── Notes ─────────────────────────────────────────────────────────────────────

export function saveNote(id: string, notes: string): void {
  db.update(schema.items)
    .set({ notes: notes || null })
    .where(eq(schema.items.id, id))
    .run();
}

// ── Re-summarize ──────────────────────────────────────────────────────────────

export function updateSummary(id: string, fields: { summary: string; tldr: string[]; sections: KnowledgeSection[]; tags: string[]; publishedAt?: string; summaryModel?: string }): void {
  const normalizedTags = normalizeTagsForItem(db, fields.tags);
  sqlite.run(
    `UPDATE items SET summary = ?, tldr = ?, sections = ?, tags = ?, published_at = COALESCE(?, published_at), summary_model = COALESCE(?, summary_model), status = 'done' WHERE id = ?`,
    [fields.summary, JSON.stringify(fields.tldr), JSON.stringify(fields.sections), JSON.stringify(normalizedTags), fields.publishedAt ?? null, fields.summaryModel ?? null, id]
  );
}

// ── Summary version history ───────────────────────────────────────────────────

export interface SummaryVersion {
  id: number;
  summary: string;
  tldr: string[];
  sections: KnowledgeSection[];
  createdAt: string;
  model?: string;
  promptId?: number;
}

export function saveSummaryVersion(itemId: string, summary: string, tldr: string[], sections: KnowledgeSection[], model?: string, promptId?: number): void {
  sqlite.run(
    `INSERT INTO summary_history (item_id, summary, tldr, sections, created_at, model, prompt_id) VALUES (?, ?, ?, ?, datetime('now'), ?, ?)`,
    [itemId, summary, JSON.stringify(tldr), JSON.stringify(sections), model ?? null, promptId ?? null]
  );
  sqlite.run(
    `DELETE FROM summary_history WHERE item_id = ? AND id NOT IN (
      SELECT id FROM summary_history WHERE item_id = ? ORDER BY id DESC LIMIT 5
    )`,
    [itemId, itemId]
  );
}

export function getSummaryHistory(itemId: string): SummaryVersion[] {
  const rows = sqlite.query<{ id: number; summary: string | null; tldr: string | null; sections: string | null; created_at: string; model: string | null; prompt_id: number | null }, [string]>(
    `SELECT id, summary, tldr, sections, created_at, model, prompt_id FROM summary_history WHERE item_id = ? ORDER BY id DESC`
  ).all(itemId);
  return rows.map((r) => {
    let tldr: string[] = [];
    let sections: KnowledgeSection[] = [];
    try { tldr = r.tldr ? JSON.parse(r.tldr) : []; } catch { tldr = []; }
    try { sections = r.sections ? JSON.parse(r.sections) : []; } catch { sections = []; }
    const v: SummaryVersion = { id: r.id, summary: r.summary ?? '', tldr, sections, createdAt: r.created_at };
    if (r.model !== null) v.model = r.model;
    if (r.prompt_id !== null) v.promptId = r.prompt_id;
    return v;
  });
}

// ── Summary quality rating ────────────────────────────────────────────────────

export function saveSummaryQuality(id: string, rating: number, reason?: string): void {
  const existing = db.select({ id: schema.summaryQuality.id })
    .from(schema.summaryQuality)
    .where(eq(schema.summaryQuality.itemId, id))
    .get();

  const now = new Date().toISOString();
  if (existing) {
    db.update(schema.summaryQuality)
      .set({ rating, reason: reason ?? null, ratedAt: now })
      .where(eq(schema.summaryQuality.id, existing.id))
      .run();
  } else {
    db.insert(schema.summaryQuality)
      .values({ itemId: id, rating, reason: reason ?? null, ratedAt: now })
      .run();
  }
}

export function getSummaryQuality(id: string): { rating: number | null; reason: string | null; ratedAt: string | null } {
  const row = db.select({
    rating: schema.summaryQuality.rating,
    reason: schema.summaryQuality.reason,
    ratedAt: schema.summaryQuality.ratedAt,
  })
    .from(schema.summaryQuality)
    .where(eq(schema.summaryQuality.itemId, id))
    .get();

  return row
    ? { rating: row.rating, reason: row.reason ?? null, ratedAt: row.ratedAt }
    : { rating: null, reason: null, ratedAt: null };
}

// ── Prompt template versioning ───────────────────────────────────────────────

export type PromptTemplateTable = 'summary_prompt_templates' | 'chat_prompt_templates';

export function getActivePromptTemplate(table: PromptTemplateTable): { id: number; template: string; created_at: string } | null {
  const row = sqlite.query<{ id: number; template: string; created_at: string }, []>(
    `SELECT id, template, created_at FROM ${table} WHERE is_active = 1 LIMIT 1`
  ).get();
  return row ?? null;
}

export function upsertPromptTemplate(table: PromptTemplateTable, templateText: string): number {
  const active = getActivePromptTemplate(table);
  if (active && active.template === templateText) return active.id;
  sqlite.run(`UPDATE ${table} SET is_active = 0 WHERE is_active = 1`);
  sqlite.run(
    `INSERT INTO ${table} (template, is_active) VALUES (?, 1)`,
    [templateText]
  );
  const row = sqlite.query<{ id: number }, []>(`SELECT last_insert_rowid() as id`).get();
  return row?.id ?? 0;
}

export function listPromptTemplates(table: PromptTemplateTable): { id: number; template: string; created_at: string; is_active: number }[] {
  return sqlite.query<{ id: number; template: string; created_at: string; is_active: number }, []>(
    `SELECT id, template, created_at, is_active FROM ${table} ORDER BY id DESC`
  ).all();
}

// ── Tag stats ─────────────────────────────────────────────────────────────────

export interface TagStats {
  approved: { name: string; count: number }[];
  pending: { tag: string; itemId: string; itemTitle: string }[];
  rejected: string[];
  totalItems: number;
}

export function getTagStats(): TagStats {
  const totalItems = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done'`).get()?.count) ?? 0;
  const rejected = getRejectedTags();
  const pending = getPendingTagsWithItems();

  const approvedTagNames = getApprovedTags();
  const tagCounts: Record<string, number> = {};
  for (const name of approvedTagNames) tagCounts[name] = 0;

  const doneItemTags = sqlite.query<{ tags: string | null }, []>(
    `SELECT tags FROM items WHERE status = 'done' AND tags IS NOT NULL`
  ).all();

  for (const row of doneItemTags) {
    let tags: string[] = [];
    try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { continue; }
    for (const tag of tags) {
      if (tag in tagCounts) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }

  const approved = Object.entries(tagCounts)
    .map(([name, count]) => ({ name, count }))
    .sort((a, b) => b.count - a.count);

  return { approved, pending, rejected, totalItems };
}

// ── Delete item ───────────────────────────────────────────────────────────────

export function deleteItem(id: string): void {
  sqlite.run('DELETE FROM item_embeddings WHERE item_id = ?', [id]);
  sqlite.run('DELETE FROM collection_items WHERE item_id = ?', [id]);
  sqlite.run('DELETE FROM summary_history WHERE item_id = ?', [id]);
  sqlite.run('DELETE FROM tag_rejections WHERE item_id = ?', [id]);
  sqlite.run('DELETE FROM chat_messages WHERE item_id = ?', [id]);
  sqlite.run('DELETE FROM considerations WHERE item_id = ?', [id]);
  sqlite.run('DELETE FROM items WHERE id = ?', [id]);
}

// ── Auto-retry ────────────────────────────────────────────────────────────────

export function getItemsToRetry(): { id: string }[] {
  return sqlite.query<{ id: string }, []>(
    `SELECT id FROM items
     WHERE status = 'error'
       AND retries < ${config.maxRetries}
       AND (retry_after IS NULL OR retry_after < datetime('now'))
       AND (error IS NULL OR (
         error NOT LIKE '%404%' AND
         error NOT LIKE '%403%' AND
         error NOT LIKE '%private%' AND
         error NOT LIKE '%captions disabled%'
       ))`
  ).all();
}

export function incrementRetry(id: string): void {
  sqlite.run(
    `UPDATE items
     SET retries = retries + 1,
         retry_after = datetime('now', '+' || (retries * 5) || ' minutes')
     WHERE id = ?`,
    [id]
  );
}

// ── Star / Favorite ───────────────────────────────────────────────────────────

export function toggleStar(id: string): boolean {
  const row = db.select({ starred: schema.items.starred })
    .from(schema.items)
    .where(eq(schema.items.id, id))
    .get();
  if (!row) return false;
  const newVal = row.starred === 1 ? 0 : 1;
  db.update(schema.items)
    .set({ starred: newVal })
    .where(eq(schema.items.id, id))
    .run();
  return newVal === 1;
}

export function getStarredItems(): KnowledgeItem[] {
  const rows = sqlite.query<DBRow, []>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name, i.rating, COALESCE(i.study_later, 0) as study_later, i.summary_model     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.status = 'done' AND i.starred = 1 ORDER BY i.date_added DESC`
  ).all();
  return rows.map((row) => rowToItem(row, false));
}

// ── Reading stats ─────────────────────────────────────────────────────────────

export interface ReadingStats {
  totalRead: number;
  readToday: number;
  readThisWeek: number;
  currentStreak: number;
  dailyGoal: number;
  weeklyGoal: number;
  dailyProgress: number;
  weeklyProgress: number;
}

export function getReadingStats(): ReadingStats {
  interface ReadRow { read_at: string }
  const rows = sqlite.query<ReadRow, []>(
    `SELECT read_at FROM items WHERE read_at IS NOT NULL ORDER BY read_at DESC`
  ).all();

  const now = new Date();
  const todayStr = now.toISOString().slice(0, 10);
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

  let readToday = 0;
  let readThisWeek = 0;
  const readDays = new Set<string>();

  for (const row of rows) {
    const d = row.read_at.slice(0, 10);
    readDays.add(d);
    if (d === todayStr) readToday++;
    if (new Date(row.read_at) >= weekAgo) readThisWeek++;
  }

  let streak = 0;
  const check = new Date(now);
  if (!readDays.has(check.toISOString().slice(0, 10))) {
    check.setDate(check.getDate() - 1);
  }
  while (readDays.has(check.toISOString().slice(0, 10))) {
    streak++;
    check.setDate(check.getDate() - 1);
  }

  const dailyGoal = parseInt(getSetting('daily_reading_goal') ?? getSetting('daily_goal') ?? '3', 10) || 3;
  const weeklyGoal = parseInt(getSetting('weekly_reading_goal') ?? getSetting('weekly_goal') ?? '15', 10) || 15;

  return {
    totalRead: rows.length,
    readToday,
    readThisWeek,
    currentStreak: streak,
    dailyGoal,
    weeklyGoal,
    dailyProgress: Math.min(readToday / dailyGoal, 1),
    weeklyProgress: Math.min(readThisWeek / weeklyGoal, 1),
  };
}

export function getRelatedItems(itemId: string, limit = 5): KnowledgeItem[] {
  interface EmbedRow { item_id: string; embedding: Buffer }
  const myEmbedRow = sqlite.query<{ embedding: Buffer }, [string]>(
    'SELECT embedding FROM item_embeddings WHERE item_id = ?'
  ).get(itemId);

  if (myEmbedRow) {
    const myBytes = myEmbedRow.embedding instanceof Uint8Array ? myEmbedRow.embedding : new Uint8Array(myEmbedRow.embedding);
    const myBuf = new ArrayBuffer(myBytes.byteLength);
    new Uint8Array(myBuf).set(myBytes);
    const myVec = new Float32Array(myBuf);

    const others = sqlite.query<EmbedRow, [string]>(
      'SELECT item_id, embedding FROM item_embeddings WHERE item_id != ?'
    ).all(itemId);

    const embedScored = others.map((row) => {
      const bytes = row.embedding instanceof Uint8Array ? row.embedding : new Uint8Array(row.embedding);
      const safeBuf = new ArrayBuffer(bytes.byteLength);
      new Uint8Array(safeBuf).set(bytes);
      const vec = new Float32Array(safeBuf);
      return { item_id: row.item_id, score: cosineSimilarity(myVec, vec) };
    });
    embedScored.sort((a, b) => b.score - a.score);
    const topIds = embedScored.slice(0, limit).map((r) => r.item_id);
    if (topIds.length > 0) {
      const placeholders = topIds.map(() => '?').join(', ');
      const embedRows = sqlite.query<DBRow, string[]>(
        `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name
         FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.id IN (${placeholders}) AND i.status = 'done' AND COALESCE(i.archived, 0) = 0`
      ).all(...topIds);
      const rowMap = new Map(embedRows.map((r) => [r.id, r]));
      const result = topIds.flatMap((id) => {
        const row = rowMap.get(id);
        return row ? [rowToItem(row, false)] : [];
      });
      if (result.length > 0) return result;
    }
  }

  const source = sqlite.query<{ tags: string | null }, [string]>('SELECT tags FROM items WHERE id = ?').get(itemId);
  if (!source) return [];

  let sourceTags: string[] = [];
  try { sourceTags = source.tags ? JSON.parse(source.tags) : []; } catch { sourceTags = []; }
  if (!sourceTags.length) return [];

  const rows = sqlite.query<DBRow, string[]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name
     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.status = 'done' AND i.id != ? AND i.tags IS NOT NULL`
  ).all(itemId);

  const sourceSet = new Set(sourceTags);
  const tagScored = rows.map((row) => {
    let tags: string[] = [];
    try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { tags = []; }
    const score = tags.filter((t) => sourceSet.has(t)).length;
    return { row, score };
  }).filter((x) => x.score > 0);

  tagScored.sort((a, b) => b.score - a.score);
  return tagScored.slice(0, limit).map((x) => rowToItem(x.row, false));
}

// ── Archive ───────────────────────────────────────────────────────────────────

export function archiveItem(id: string, archived: boolean): void {
  db.update(schema.items)
    .set({ archived: archived ? 1 : 0 })
    .where(eq(schema.items.id, id))
    .run();
}

// ── Pin ───────────────────────────────────────────────────────────────────────

export function togglePin(id: string): boolean {
  const row = db.select({ pinned: schema.items.pinned })
    .from(schema.items)
    .where(eq(schema.items.id, id))
    .get();
  if (!row) return false;
  const newVal = row.pinned === 1 ? 0 : 1;
  db.update(schema.items)
    .set({ pinned: newVal })
    .where(eq(schema.items.id, id))
    .run();
  return newVal === 1;
}

// ── Collections ───────────────────────────────────────────────────────────────

export interface CollectionSummary {
  id: string;
  name: string;
  itemCount: number;
}

export function createCollection(name: string): string {
  const id = `col-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  db.insert(schema.collections).values({ id, name, createdAt: now }).run();
  return id;
}

export function deleteCollection(id: string): void {
  db.delete(schema.collectionItems).where(eq(schema.collectionItems.collectionId, id)).run();
  db.delete(schema.collections).where(eq(schema.collections.id, id)).run();
}

export function renameCollection(id: string, name: string): void {
  db.update(schema.collections)
    .set({ name })
    .where(eq(schema.collections.id, id))
    .run();
}

export function addItemToCollection(collectionId: string, itemId: string): void {
  const now = new Date().toISOString();
  sqlite.run(
    `INSERT OR IGNORE INTO collection_items (collection_id, item_id, added_at) VALUES (?, ?, ?)`,
    [collectionId, itemId, now]
  );
}

export function removeItemFromCollection(collectionId: string, itemId: string): void {
  db.delete(schema.collectionItems)
    .where(and(
      eq(schema.collectionItems.collectionId, collectionId),
      eq(schema.collectionItems.itemId, itemId),
    ))
    .run();
}

export function listCollections(): CollectionSummary[] {
  const rows = sqlite.query<{ id: string; name: string; item_count: number }, []>(
    `SELECT c.id, c.name, COUNT(ci.item_id) AS item_count
     FROM collections c
     LEFT JOIN collection_items ci ON ci.collection_id = c.id
     GROUP BY c.id
     ORDER BY c.created_at ASC`
  ).all();
  return rows.map((r) => ({ id: r.id, name: r.name, itemCount: r.item_count }));
}

export function getCollectionItems(collectionId: string): KnowledgeItem[] {
  const rows = sqlite.query<DBRow, [string]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary,
            i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes,
            i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, fd.name as feed_name
     FROM collection_items ci
     JOIN items i ON i.id = ci.item_id
     LEFT JOIN feeds fd ON fd.id = i.feed_id
     WHERE ci.collection_id = ?
     ORDER BY ci.added_at DESC`
  ).all(collectionId);
  return rows.map((row) => rowToItem(row, false));
}

export function getItemCollections(itemId: string): { id: string; name: string }[] {
  const rows = sqlite.query<{ id: string; name: string }, [string]>(
    `SELECT c.id, c.name
     FROM collection_items ci
     JOIN collections c ON c.id = ci.collection_id
     WHERE ci.item_id = ?
     ORDER BY c.name ASC`
  ).all(itemId);
  return rows;
}

// ── Digest ────────────────────────────────────────────────────────────────────

export function getItemsInRange(fromDate: string, toDate: string): KnowledgeItem[] {
  const rows = sqlite.query<DBRow, [string, string]>(
    `SELECT i.id, i.url, i.type, i.title, i.author, i.status, NULL as transcript, i.summary, i.sections, i.tags, i.error, i.date_added, i.read_at, i.tldr, i.notes, i.starred, COALESCE(i.archived, 0) as archived, i.published_at, COALESCE(i.pinned, 0) as pinned, i.feed_id, f.name as feed_name
     FROM items i LEFT JOIN feeds f ON f.id = i.feed_id WHERE i.date_added BETWEEN ? AND ? AND i.status = 'done' ORDER BY i.date_added DESC`
  ).all(fromDate, toDate);
  return rows.map((row) => rowToItem(row, false));
}

// ── Domain stats ──────────────────────────────────────────────────────────────

export function getDomainStats(): { domain: string; count: number; lastSaved: string }[] {
  const rows = sqlite.query<{ url: string; date_added: string }, []>(
    `SELECT url, date_added FROM items WHERE status = 'done' ORDER BY date_added DESC`
  ).all();

  const domainMap = new Map<string, { count: number; lastSaved: string }>();
  for (const row of rows) {
    let hostname: string;
    try {
      hostname = new URL(row.url).hostname;
    } catch {
      continue;
    }
    const existing = domainMap.get(hostname);
    if (!existing) {
      domainMap.set(hostname, { count: 1, lastSaved: row.date_added });
    } else {
      existing.count++;
    }
  }

  return Array.from(domainMap.entries())
    .map(([domain, { count, lastSaved }]) => ({ domain, count, lastSaved }))
    .sort((a, b) => b.count - a.count);
}

// ── Feeds ─────────────────────────────────────────────────────────────────────

interface FeedRow {
  id: string;
  url: string;
  name: string | null;
  last_checked: string | null;
  last_item_date: string | null;
  item_count: number;
  active: number;
  created_at: string;
}

function feedRowToFeed(row: FeedRow): Feed {
  return {
    id: row.id,
    url: row.url,
    name: row.name,
    lastChecked: row.last_checked,
    lastItemDate: row.last_item_date,
    itemCount: row.item_count,
    active: row.active === 1,
    createdAt: row.created_at,
  };
}

export function addFeed(url: string, name?: string): string {
  const id = `feed-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  db.insert(schema.feeds).values({
    id,
    url,
    name: name ?? null,
    itemCount: 0,
    active: 1,
    createdAt: now,
  }).run();
  return id;
}

export function deleteFeed(id: string): void {
  db.delete(schema.feeds).where(eq(schema.feeds.id, id)).run();
}

export function listFeeds(): Feed[] {
  return sqlite.query<FeedRow, []>(
    `SELECT * FROM feeds ORDER BY created_at ASC`
  ).all().map(feedRowToFeed);
}

export function updateFeedChecked(id: string, lastItemDate: string, count: number): void {
  const now = new Date().toISOString();
  db.update(schema.feeds)
    .set({ lastChecked: now, lastItemDate, itemCount: count })
    .where(eq(schema.feeds.id, id))
    .run();
}

export function getFeedItemUrls(id: string): string[] {
  const rows = db.select({ url: schema.items.url })
    .from(schema.items)
    .where(eq(schema.items.feedId, id))
    .all();
  return rows.map((r) => r.url);
}

// ── Stats summary ─────────────────────────────────────────────────────────────

export interface StatsSummary {
  totalItems: number;
  totalRead: number;
  totalStarred: number;
  totalPinned: number;
  totalNotes: number;
  avgRating: number;
  topTags: { tag: string; count: number }[];
  byType: { youtube: number; article: number; video: number; pdf: number };
  savedThisWeek: number;
  savedThisMonth: number;
  mostReadDomain: string;
  avgReadingTime: number;
}

export function getStatsSummary(): StatsSummary {
  const now = new Date();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const totalItems = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND COALESCE(archived, 0) = 0`).get()?.count) ?? 0;
  const totalRead = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND read_at IS NOT NULL AND COALESCE(archived, 0) = 0`).get()?.count) ?? 0;
  const totalStarred = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND starred = 1 AND COALESCE(archived, 0) = 0`).get()?.count) ?? 0;
  const totalPinned = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND COALESCE(pinned, 0) = 1 AND COALESCE(archived, 0) = 0`).get()?.count) ?? 0;
  const totalNotes = (sqlite.query<{ count: number }, []>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND notes IS NOT NULL AND notes != '' AND COALESCE(archived, 0) = 0`).get()?.count) ?? 0;

  const ratingRow = sqlite.query<{ avg: number | null }, []>(`SELECT AVG(rating) as avg FROM items WHERE status = 'done' AND rating IS NOT NULL AND COALESCE(archived, 0) = 0`).get();
  const avgRating = ratingRow?.avg != null ? Math.round(ratingRow.avg * 10) / 10 : 0;

  const savedThisWeek = (sqlite.query<{ count: number }, [string]>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND date_added >= ?`).get(weekAgo)?.count) ?? 0;
  const savedThisMonth = (sqlite.query<{ count: number }, [string]>(`SELECT COUNT(*) as count FROM items WHERE status = 'done' AND date_added >= ?`).get(monthAgo)?.count) ?? 0;

  const typeRows = sqlite.query<{ type: string; count: number }, []>(`SELECT type, COUNT(*) as count FROM items WHERE status = 'done' AND COALESCE(archived, 0) = 0 GROUP BY type`).all();
  const byType = { youtube: 0, article: 0, video: 0, pdf: 0 };
  for (const r of typeRows) {
    const domainType = dbTypeToDomain(r.type);
    if (domainType === 'youtube' || domainType === 'article' || domainType === 'video' || domainType === 'pdf') {
      byType[domainType] = (byType[domainType] ?? 0) + r.count;
    }
  }

  const approvedTagNames = getApprovedTags();
  const tagCounts: Record<string, number> = {};
  for (const name of approvedTagNames) tagCounts[name] = 0;
  const doneItemTags = sqlite.query<{ tags: string | null }, []>(`SELECT tags FROM items WHERE status = 'done' AND COALESCE(archived, 0) = 0 AND tags IS NOT NULL`).all();
  for (const row of doneItemTags) {
    let tags: string[] = [];
    try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { continue; }
    for (const tag of tags) {
      if (tag in tagCounts) tagCounts[tag] = (tagCounts[tag] ?? 0) + 1;
    }
  }
  const topTags = Object.entries(tagCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([tag, count]) => ({ tag, count }));

  const readUrlRows = sqlite.query<{ url: string }, []>(`SELECT url FROM items WHERE status = 'done' AND read_at IS NOT NULL`).all();
  const domainReadCount = new Map<string, number>();
  for (const row of readUrlRows) {
    let hostname: string;
    try { hostname = new URL(row.url).hostname; } catch { continue; }
    domainReadCount.set(hostname, (domainReadCount.get(hostname) ?? 0) + 1);
  }
  let mostReadDomain = '';
  let maxReads = 0;
  for (const [domain, count] of domainReadCount.entries()) {
    if (count > maxReads) { maxReads = count; mostReadDomain = domain; }
  }

  const wordCountRows = sqlite.query<{ transcript: string | null; summary: string | null }, []>(
    `SELECT transcript, summary FROM items WHERE status = 'done' AND COALESCE(archived, 0) = 0`
  ).all();
  let totalWordCount = 0;
  let itemsWithContent = 0;
  for (const row of wordCountRows) {
    const text = row.transcript ?? row.summary ?? '';
    const wc = text.trim() ? text.trim().split(/\s+/).length : 0;
    if (wc > 0) { totalWordCount += wc; itemsWithContent++; }
  }
  const avgReadingTime = itemsWithContent > 0 ? Math.round((totalWordCount / itemsWithContent) / 200) : 0;

  return {
    totalItems,
    totalRead,
    totalStarred,
    totalPinned,
    totalNotes,
    avgRating,
    topTags,
    byType,
    savedThisWeek,
    savedThisMonth,
    mostReadDomain,
    avgReadingTime,
  };
}

// ── Tag suggestions (items with unapproved tags) ───────────────────────────────

export function getItemsWithUnapprovedTags(): { id: string; title: string; rawTags: string[] }[] {
  const approvedSet = new Set(getApprovedTags());
  const rejectedSet = new Set(getRejectedTags());
  const rows = sqlite.query<{ id: string; title: string; tags: string | null }, []>(
    `SELECT id, title, tags FROM items WHERE status = 'done' AND tags IS NOT NULL AND COALESCE(archived, 0) = 0`
  ).all();

  const results: { id: string; title: string; rawTags: string[] }[] = [];
  for (const row of rows) {
    let tags: string[] = [];
    try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { continue; }
    const unapproved = tags.filter((t) => !approvedSet.has(t) && !rejectedSet.has(t));
    if (unapproved.length > 0) results.push({ id: row.id, title: row.title, rawTags: unapproved });
  }
  return results;
}

// ── Test data cleanup ─────────────────────────────────────────────────────────

export function getTestDataCount(): number {
  return (sqlite.query<{ count: number }, []>('SELECT COUNT(*) as count FROM items WHERE test_data = 1').get()?.count) ?? 0;
}

export function clearTestData(): number {
  const ids = sqlite.query<{ id: string }, []>('SELECT id FROM items WHERE test_data = 1').all().map((r) => r.id);
  if (ids.length === 0) return 0;
  const placeholders = ids.map(() => '?').join(',');
  sqlite.run(`DELETE FROM item_embeddings WHERE item_id IN (${placeholders})`, ids);
  sqlite.run(`DELETE FROM items WHERE test_data = 1`);
  return ids.length;
}

// ── Filter presets ────────────────────────────────────────────────────────────

export interface FilterPresetData {
  searchQuery?: string;
  tagFilter?: string[];
  dateFilter?: string;
  typeFilter?: string;
  semanticMode?: boolean;
  showStarredOnly?: boolean;
}

export interface FilterPreset {
  id: string;
  name: string;
  searchQuery: string | null;
  tagFilter: string[];
  dateFilter: string | null;
  typeFilter: string | null;
  semanticMode: boolean;
  showStarredOnly: boolean;
  createdAt: string;
}

export function saveFilterPreset(name: string, filters: FilterPresetData): string {
  const id = `preset-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  db.insert(schema.filterPresets).values({
    id,
    name,
    searchQuery: filters.searchQuery ?? null,
    tagFilter: filters.tagFilter ? JSON.stringify(filters.tagFilter) : null,
    dateFilter: filters.dateFilter ?? null,
    typeFilter: filters.typeFilter ?? null,
    semanticMode: filters.semanticMode ? 1 : 0,
    showStarredOnly: filters.showStarredOnly ? 1 : 0,
    createdAt: now,
  }).run();
  return id;
}

export function getFilterPresets(): FilterPreset[] {
  interface PresetRow {
    id: string;
    name: string;
    search_query: string | null;
    tag_filter: string | null;
    date_filter: string | null;
    type_filter: string | null;
    semantic_mode: number;
    show_starred_only: number;
    created_at: string;
  }
  const rows = sqlite.query<PresetRow, []>(
    `SELECT id, name, search_query, tag_filter, date_filter, type_filter, semantic_mode, show_starred_only, created_at
     FROM filter_presets ORDER BY created_at ASC`
  ).all();
  return rows.map((r) => {
    let tagFilter: string[] = [];
    try { tagFilter = r.tag_filter ? JSON.parse(r.tag_filter) : []; } catch { tagFilter = []; }
    return {
      id: r.id,
      name: r.name,
      searchQuery: r.search_query,
      tagFilter,
      dateFilter: r.date_filter,
      typeFilter: r.type_filter,
      semanticMode: r.semantic_mode === 1,
      showStarredOnly: r.show_starred_only === 1,
      createdAt: r.created_at,
    };
  });
}

export function deleteFilterPreset(id: string): void {
  db.delete(schema.filterPresets).where(eq(schema.filterPresets.id, id)).run();
}


// ── Highlights ────────────────────────────────────────────────────────────────

export interface Highlight {
  id: string;
  item_id: string;
  text: string;
  comment?: string;
  section: string;
  created_at: string;
}

export function saveHighlight(itemId: string, text: string, section: string, comment?: string): string {
  const id = crypto.randomUUID();
  db.insert(schema.highlights).values({
    id,
    itemId,
    text,
    comment: comment ?? null,
    section,
    createdAt: new Date().toISOString(),
  }).run();
  return id;
}

export function getHighlights(itemId: string): Highlight[] {
  return sqlite.query<Highlight, [string]>(
    `SELECT id, item_id, text, comment, section, created_at FROM highlights WHERE item_id = ? ORDER BY created_at ASC`
  ).all(itemId);
}

export function deleteHighlight(id: string): void {
  db.delete(schema.highlights).where(eq(schema.highlights.id, id)).run();
}

// ── Tag rejections + derived rules ────────────────────────────────────────────

export interface TagRejection {
  id: string;
  tag: string;
  reason: string;
  item_id: string | null;
  created_at: string;
}

export function saveTagRejection(tag: string, reason = '', itemId?: string): void {
  const id = `rejection-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const now = new Date().toISOString();
  db.insert(schema.tagRejections).values({
    id,
    tag,
    reason,
    itemId: itemId ?? null,
    createdAt: now,
  }).run();
}

export function getTagRejections(): TagRejection[] {
  return sqlite.query<TagRejection, []>(
    `SELECT id, tag, reason, item_id, created_at FROM tag_rejections ORDER BY created_at DESC`
  ).all();
}

// ── Chat history ──────────────────────────────────────────────────────────────

export function getChatHistory(itemId: string): Array<{ role: 'user' | 'assistant'; content: string }> {
  interface Row { role: string; content: string }
  return sqlite.query<Row, [string]>(
    `SELECT role, content FROM chat_messages WHERE item_id = ? ORDER BY created_at ASC`
  ).all(itemId).flatMap(r => {
    if (r.role !== 'user' && r.role !== 'assistant') return [];
    return [{ role: r.role, content: r.content }];
  });
}

export function saveChatMessage(itemId: string, role: 'user' | 'assistant', content: string): void {
  const id = `chat-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  db.insert(schema.chatMessages).values({
    id,
    itemId,
    role,
    content,
    createdAt: new Date().toISOString(),
  }).run();
}

export function clearChatHistory(itemId: string): void {
  db.delete(schema.chatMessages).where(eq(schema.chatMessages.itemId, itemId)).run();
}

export function getTagRules(): string {
  return getSetting('tag_rules') ?? '';
}

export function saveTagRules(rules: string): void {
  setSetting('tag_rules', rules);
}

// ── Considerations ──────────────────────────────────────────────────────────

import {
  raiseForConsiderationDb,
  getConsiderationsDb,
  updateConsiderationDb,
  isRaisedForConsiderationDb,
  getConsiderationForItemDb,
  updateConsiderationNoteByItemDb,
  deleteConsiderationByItemDb,
  type ConsiderationRow,
} from './db/considerations.ts';
import { writeConsiderationProposal } from './considerations-proposal.ts';

export type { ConsiderationRow };

export function raiseForConsideration(itemId: string, ceoNote?: string): { id: string; alreadyRaised: boolean } {
  if (isRaisedForConsiderationDb(db, itemId)) {
    const existing = db.select({ id: schema.considerations.id })
      .from(schema.considerations)
      .where(eq(schema.considerations.itemId, itemId))
      .get();
    return { id: existing?.id ?? itemId, alreadyRaised: true };
  }
  const id = raiseForConsiderationDb(db, itemId, ceoNote);
  // Fire-and-forget proposal file write
  const item = getItem(itemId);
  if (item) {
    writeConsiderationProposal(item, ceoNote).catch(() => { /* logged inside writer */ });
  }
  return { id, alreadyRaised: false };
}

export function getConsiderations(): ConsiderationRow[] {
  return getConsiderationsDb(db);
}

export function updateConsideration(id: string, status: string, agentNotes?: string): void {
  updateConsiderationDb(db, id, status, agentNotes);
}

export function isRaisedForConsideration(itemId: string): boolean {
  return isRaisedForConsiderationDb(db, itemId);
}

export function getConsiderationForItem(itemId: string): { id: string; ceoNote: string | null } | null {
  return getConsiderationForItemDb(db, itemId);
}

export function updateConsiderationNoteByItem(itemId: string, ceoNote: string): boolean {
  return updateConsiderationNoteByItemDb(db, itemId, ceoNote);
}

export function deleteConsiderationByItem(itemId: string): boolean {
  return deleteConsiderationByItemDb(db, itemId);
}
