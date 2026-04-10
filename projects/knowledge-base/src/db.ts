import { Database } from 'bun:sqlite';
import { mkdirSync } from 'node:fs';
import { join } from 'path';
import type { KnowledgeItem, KnowledgeSection } from './types.ts';

const KNOWLEDGE_DIR = join(import.meta.dir, '..', 'knowledge');
mkdirSync(KNOWLEDGE_DIR, { recursive: true });

export const db = new Database(join(KNOWLEDGE_DIR, 'knowledge.db'), { create: true });

db.run(`CREATE TABLE IF NOT EXISTS items (
  id          TEXT PRIMARY KEY,
  url         TEXT UNIQUE NOT NULL,
  type        TEXT NOT NULL DEFAULT 'web',
  title       TEXT NOT NULL DEFAULT '',
  author      TEXT,
  status      TEXT NOT NULL DEFAULT 'queued',
  transcript  TEXT,
  summary     TEXT,
  sections    TEXT,
  tags        TEXT,
  error       TEXT,
  date_added  TEXT NOT NULL,
  read_at     TEXT,
  tldr        TEXT
)`);

// Add columns to existing DBs that predate them
try { db.run(`ALTER TABLE items ADD COLUMN read_at TEXT`); } catch { /* already exists */ }
try { db.run(`ALTER TABLE items ADD COLUMN tldr TEXT`); } catch { /* already exists */ }

db.run(`CREATE TABLE IF NOT EXISTS tags (
  name        TEXT PRIMARY KEY,
  status      TEXT NOT NULL DEFAULT 'pending',
  created_at  TEXT NOT NULL,
  rejected_at TEXT
)`);

// Raw row shape returned by SQLite
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
}

function rowToItem(row: DBRow): KnowledgeItem {
  let sections: KnowledgeSection[] = [];
  try { sections = row.sections ? JSON.parse(row.sections) : []; } catch { sections = []; }
  let tags: string[] = [];
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { tags = []; }
  let tldr: string[] = [];
  try { tldr = row.tldr ? JSON.parse(row.tldr) : []; } catch { tldr = []; }
  return {
    id: row.id,
    url: row.url,
    type: row.type as 'youtube' | 'web',
    title: row.title,
    author: row.author ?? undefined,
    dateAdded: row.date_added,
    tags,
    tldr,
    summary: row.summary ?? '',
    sections,
    transcript: row.transcript ?? '',
    status: row.status as KnowledgeItem['status'],
    error: row.error ?? undefined,
    readAt: row.read_at ?? undefined,
  };
}

export function insertItem(item: Pick<KnowledgeItem, 'id' | 'url' | 'type' | 'dateAdded'>): void {
  db.run(
    `INSERT OR IGNORE INTO items (id, url, type, date_added) VALUES (?, ?, ?, ?)`,
    [item.id, item.url, item.type, item.dateAdded]
  );
}

export function updateItem(id: string, fields: Partial<Omit<KnowledgeItem, 'id'>>): void {
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
  };
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      const val = (fields as Record<string, unknown>)[key];
      setClauses.push(`${col} = ?`);
      values.push(Array.isArray(val) || (val && typeof val === 'object') ? JSON.stringify(val) : val);
    }
  }
  if (!setClauses.length) return;
  values.push(id);
  db.run(`UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`, values);
}

export function markRead(id: string): void {
  db.run(`UPDATE items SET read_at = ? WHERE id = ?`, [new Date().toISOString(), id]);
}

export function getItem(id: string): KnowledgeItem | null {
  const row = db.query<DBRow, [string]>('SELECT * FROM items WHERE id = ?').get(id);
  return row ? rowToItem(row) : null;
}

export function getItemByUrl(url: string): KnowledgeItem | null {
  const row = db.query<DBRow, [string]>('SELECT * FROM items WHERE url = ?').get(url);
  return row ? rowToItem(row) : null;
}

export function listItems(): KnowledgeItem[] {
  const rows = db.query<DBRow, []>(
    `SELECT id, url, type, title, author, status, NULL as transcript, summary, sections, tags, error, date_added, read_at, tldr
     FROM items WHERE status = 'done' ORDER BY date_added DESC`
  ).all();
  return rows.map(rowToItem);
}

export function itemExistsByUrl(url: string): boolean {
  const row = db.query<{ id: string }, [string]>('SELECT id FROM items WHERE url = ?').get(url);
  return row !== null;
}

export function searchItems(q: string, tag: string): KnowledgeItem[] {
  const conditions: string[] = [`status = 'done'`];
  const values: unknown[] = [];

  if (q) {
    const like = `%${q}%`;
    conditions.push(`(title LIKE ? OR summary LIKE ? OR transcript LIKE ? OR sections LIKE ?)`);
    values.push(like, like, like, like);
  }

  if (tag) {
    // tags is a JSON array — match exact tag name as a JSON string value
    conditions.push(`tags LIKE ?`);
    values.push(`%"${tag}"%`);
  }

  const rows = db.query<DBRow, unknown[]>(
    `SELECT id, url, type, title, author, status, NULL as transcript, summary, sections, tags, error, date_added, read_at, tldr
     FROM items WHERE ${conditions.join(' AND ')} ORDER BY date_added DESC`
  ).all(...values);
  return rows.map(rowToItem);
}

// ── Tag functions ─────────────────────────────────────────────────────────────

export function upsertTag(name: string, status: 'pending' | 'approved' | 'rejected'): void {
  const now = new Date().toISOString();
  const rejectedAt = status === 'rejected' ? now : null;
  // Don't downgrade approved tags back to pending
  db.run(
    `INSERT INTO tags (name, status, created_at, rejected_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(name) DO UPDATE SET
       status = CASE WHEN tags.status = 'approved' AND excluded.status = 'pending' THEN 'approved' ELSE excluded.status END,
       rejected_at = COALESCE(excluded.rejected_at, tags.rejected_at)`,
    [name, status, now, rejectedAt]
  );
}

export function approveTag(name: string): void {
  db.run(`UPDATE tags SET status = 'approved' WHERE name = ?`, [name]);
}

export function rejectTag(name: string): void {
  db.run(`UPDATE tags SET status = 'rejected', rejected_at = ? WHERE name = ?`, [new Date().toISOString(), name]);
}

export function getApprovedTags(): string[] {
  return db.query<{ name: string }, []>(
    `SELECT name FROM tags WHERE status = 'approved' ORDER BY name`
  ).all().map((r) => r.name);
}

export function getRejectedTags(): string[] {
  return db.query<{ name: string }, []>(
    `SELECT name FROM tags WHERE status = 'rejected' ORDER BY name`
  ).all().map((r) => r.name);
}

export function getPendingTagsWithItems(): { tag: string; itemId: string; itemTitle: string }[] {
  const pendingTags = db.query<{ name: string }, []>(
    `SELECT name FROM tags WHERE status = 'pending' ORDER BY created_at DESC`
  ).all().map((r) => r.name);

  const results: { tag: string; itemId: string; itemTitle: string }[] = [];
  for (const tag of pendingTags) {
    const item = db.query<{ id: string; title: string }, [string]>(
      `SELECT id, title FROM items WHERE status = 'done' AND tags LIKE ? LIMIT 1`
    ).get(`%"${tag}"%`);
    results.push({ tag, itemId: item?.id ?? '', itemTitle: item?.title ?? '' });
  }
  return results;
}
