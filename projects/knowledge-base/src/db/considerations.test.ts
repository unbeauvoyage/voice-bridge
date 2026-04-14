import { test, expect, describe } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import {
  raiseForConsiderationDb,
  getConsiderationsDb,
  updateConsiderationDb,
  isRaisedForConsiderationDb,
  getConsiderationForItemDb,
  updateConsiderationNoteByItemDb,
  deleteConsiderationByItemDb,
} from './considerations.ts';

type TestDb = ReturnType<typeof drizzle<typeof schema>>;

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}

function seedItem(db: TestDb, id: string, title = 'An item', url = `https://example.com/${id}`) {
  db.insert(schema.items).values({
    id,
    url,
    type: 'web',
    title,
    status: 'ready',
    createdAt: new Date().toISOString(),
    tldr: JSON.stringify(['first bullet', 'second bullet']),
    summary: 'A short summary of the content.',
  }).run();
}

describe('considerations', () => {
  test('raising an item for consideration creates a considerations record', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-1');

    const considerationId = raiseForConsiderationDb(db, 'item-1');
    expect(considerationId).toBeTruthy();

    const row = db.select().from(schema.considerations)
      .where(eq(schema.considerations.id, considerationId)).get();
    if (!row) throw new Error('row should be defined');
    expect(row.itemId).toBe('item-1');
    expect(row.status).toBe('pending');
    expect(row.raisedAt).toBeTruthy();
  });

  test('isRaisedForConsideration reflects state', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-2');
    expect(isRaisedForConsiderationDb(db, 'item-2')).toBe(false);
    raiseForConsiderationDb(db, 'item-2');
    expect(isRaisedForConsiderationDb(db, 'item-2')).toBe(true);
  });

  test('getConsiderations returns item metadata joined in', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-3', 'Title Three', 'https://three.example');
    raiseForConsiderationDb(db, 'item-3');

    const rows = getConsiderationsDb(db);
    expect(rows.length).toBe(1);
    const row0 = rows[0];
    if (!row0) throw new Error('expected a row');
    expect(row0.itemId).toBe('item-3');
    expect(row0.itemTitle).toBe('Title Three');
    expect(row0.itemUrl).toBe('https://three.example');
    expect(row0.status).toBe('pending');
  });

  test('raising with a CEO note stores it on the record', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-note');
    const id = raiseForConsiderationDb(db, 'item-note', 'Is this plugin worth it?');
    const row = db.select().from(schema.considerations)
      .where(eq(schema.considerations.id, id)).get();
    if (!row) throw new Error('row should be defined');
    expect(row.ceoNote).toBe('Is this plugin worth it?');
  });

  test('raising with an empty or whitespace-only note stores null', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-empty');
    const id = raiseForConsiderationDb(db, 'item-empty', '   ');
    const row = db.select().from(schema.considerations)
      .where(eq(schema.considerations.id, id)).get();
    if (!row) throw new Error('row should be defined');
    expect(row.ceoNote).toBeNull();
  });

  test('editing a raised note updates the stored ceoNote', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-edit');
    raiseForConsiderationDb(db, 'item-edit', 'first take');
    const changed = updateConsiderationNoteByItemDb(db, 'item-edit', 'revised take');
    expect(changed).toBe(true);
    const fetched = getConsiderationForItemDb(db, 'item-edit');
    expect(fetched?.ceoNote).toBe('revised take');
  });

  test('unraising an item deletes its consideration record', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-unraise');
    raiseForConsiderationDb(db, 'item-unraise', 'some note');
    expect(isRaisedForConsiderationDb(db, 'item-unraise')).toBe(true);
    const deleted = deleteConsiderationByItemDb(db, 'item-unraise');
    expect(deleted).toBe(true);
    expect(isRaisedForConsiderationDb(db, 'item-unraise')).toBe(false);
    expect(getConsiderationForItemDb(db, 'item-unraise')).toBeNull();
  });

  test('updateConsideration changes status and notes', () => {
    const { db } = createTestDb();
    seedItem(db, 'item-4');
    const id = raiseForConsiderationDb(db, 'item-4');

    updateConsiderationDb(db, id, 'reviewed', 'Looked good; applied.');
    const row = db.select().from(schema.considerations)
      .where(eq(schema.considerations.id, id)).get();
    if (!row) throw new Error('row should be defined');
    expect(row.status).toBe('reviewed');
    expect(row.agentNotes).toBe('Looked good; applied.');
  });
});
