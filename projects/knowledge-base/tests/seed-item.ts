import { Database } from 'bun:sqlite';
import { join } from 'path';

// Usage:
//   bun tests/seed-item.ts seed <id> <url> <title> [tagsCsv]
//   bun tests/seed-item.ts cleanup <idPrefix>
//
// Seeds a fully-formed "done" item with transcript, summary, tldr, sections,
// and test_data=1 so clearTestData() can purge it. For tests that need a real
// item but don't want to wait on the processing queue.

const [, , action, arg1, arg2, arg3, arg4] = process.argv;

const dbPath = join(import.meta.dir, '..', 'knowledge', 'knowledge.db');
const db = new Database(dbPath);
db.exec('PRAGMA journal_mode = WAL;');
db.exec('PRAGMA busy_timeout = 10000;');

if (action === 'seed') {
  const id = arg1!;
  const url = arg2!;
  const title = arg3!;
  const tagsCsv = arg4 ?? '';
  const tags = tagsCsv ? tagsCsv.split(',').map((t) => t.trim()).filter(Boolean) : [];
  const transcript = 'The quick brown fox jumps over the lazy dog. This is seeded transcript content for end-to-end testing of the knowledge base pipeline.';
  const summary = 'Seeded summary covering the quick brown fox scenario for tests.';
  const tldr = ['Test bullet one about foxes', 'Test bullet two about dogs', 'Third key insight'];
  const sections = [
    { title: 'Opening', points: ['Intro point A', 'Intro point B'] },
    { title: 'Conclusion', points: ['Wrap up point'] },
  ];
  db.run(
    `INSERT OR REPLACE INTO items
     (id, url, type, title, status, transcript, summary, tldr, sections, tags, date_added, test_data)
     VALUES (?, ?, 'web', ?, 'done', ?, ?, ?, ?, ?, datetime('now'), 1)`,
    [id, url, title, transcript, summary, JSON.stringify(tldr), JSON.stringify(sections), JSON.stringify(tags)]
  );
  // Ensure tags exist as approved so /search?tag=... has something to match
  for (const tag of tags) {
    db.run(
      `INSERT OR IGNORE INTO tags (name, status, created_at) VALUES (?, 'approved', datetime('now'))`,
      [tag]
    );
  }
} else if (action === 'seed-history') {
  const itemId = arg1!;
  const model = arg2 ?? 'test-model-1';
  db.run(
    `INSERT INTO summary_history (item_id, summary, tldr, sections, created_at, model)
     VALUES (?, ?, ?, ?, datetime('now'), ?)`,
    [
      itemId,
      'Previous summary version for history test',
      JSON.stringify(['old bullet one', 'old bullet two']),
      JSON.stringify([{ title: 'Old section', points: ['old point'] }]),
      model,
    ]
  );
} else if (action === 'cleanup') {
  const idPrefix = arg1!;
  const ids = db.query<{ id: string }, [string]>(`SELECT id FROM items WHERE id LIKE ?`).all(`${idPrefix}%`).map((r) => r.id);
  for (const id of ids) {
    db.run(`DELETE FROM summary_history WHERE item_id = ?`, [id]);
  }
  db.run(`DELETE FROM items WHERE id LIKE ?`, [`${idPrefix}%`]);
}

db.close();
