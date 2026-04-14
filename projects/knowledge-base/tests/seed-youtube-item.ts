import { Database } from 'bun:sqlite';
import { join } from 'path';

const [,, action, id, url, title] = process.argv;

const dbPath = join(import.meta.dir, '..', 'knowledge', 'knowledge.db');
const db = new Database(dbPath);

if (action === 'seed') {
  db.run(
    `INSERT OR IGNORE INTO items (id, url, type, title, status, summary, date_added) VALUES (?, ?, 'youtube', ?, 'done', 'Test summary for YouTube embed test.', datetime('now'))`,
    [id, url, title]
  );
} else if (action === 'cleanup') {
  db.run(`DELETE FROM items WHERE id = ?`, [id]);
}

db.close();
