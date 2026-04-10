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
  date_added  TEXT NOT NULL
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
}

function rowToItem(row: DBRow): KnowledgeItem {
  let sections: KnowledgeSection[] = [];
  try { sections = row.sections ? JSON.parse(row.sections) : []; } catch { sections = []; }
  let tags: string[] = [];
  try { tags = row.tags ? JSON.parse(row.tags) : []; } catch { tags = []; }
  return {
    id: row.id,
    url: row.url,
    type: row.type as 'youtube' | 'web',
    title: row.title,
    author: row.author ?? undefined,
    dateAdded: row.date_added,
    tags,
    summary: row.summary ?? '',
    sections,
    transcript: row.transcript ?? '',
    status: row.status as KnowledgeItem['status'],
    error: row.error ?? undefined,
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
  };
  const setClauses: string[] = [];
  const values: unknown[] = [];
  for (const [key, col] of Object.entries(colMap)) {
    if (key in fields) {
      const val = (fields as Record<string, unknown>)[key];
      setClauses.push(`${col} = ?`);
      // Serialize arrays/objects to JSON
      values.push(Array.isArray(val) || (val && typeof val === 'object') ? JSON.stringify(val) : val);
    }
  }
  if (!setClauses.length) return;
  values.push(id);
  db.run(`UPDATE items SET ${setClauses.join(', ')} WHERE id = ?`, values);
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
  // Return done items newest-first, without transcript (keep list fast)
  const rows = db.query<DBRow, []>(
    `SELECT id, url, type, title, author, status, NULL as transcript, summary, sections, tags, error, date_added
     FROM items WHERE status = 'done' ORDER BY date_added DESC`
  ).all();
  return rows.map(rowToItem);
}

export function itemExistsByUrl(url: string): boolean {
  const row = db.query<{ id: string }, [string]>('SELECT id FROM items WHERE url = ?').get(url);
  return row !== null;
}
