import { test, expect, describe, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq, sql } from 'drizzle-orm';
import * as schema from './schema.ts';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}

describe('drizzle schema', () => {
  test('drizzle schema loads and items table is queryable', () => {
    const { db } = createTestDb();
    const rows = db.select().from(schema.items).all();
    expect(rows).toEqual([]);
  });

  test('inserting and retrieving an item round-trips all fields', () => {
    const { db } = createTestDb();
    const now = new Date().toISOString();

    db.insert(schema.items).values({
      id: 'test-1',
      url: 'https://example.com/article',
      type: 'web',
      title: 'Test Article',
      author: 'Author Name',
      status: 'done',
      transcript: 'Some transcript text',
      summary: 'A summary',
      sections: JSON.stringify([{ title: 'Intro', points: ['point1'] }]),
      tags: JSON.stringify(['tag1', 'tag2']),
      error: null,
      createdAt: now,
      readAt: null,
      tldr: JSON.stringify(['bullet1']),
      notes: 'my notes',
      starred: 1,
      archived: 0,
      publishedAt: now,
      pinned: 0,
      feedId: null,
      rating: 4,
      imageUrl: 'https://example.com/image.png',
      retries: 0,
      retryAfter: null,
      testData: 0,
      studyLater: 0,
      summaryModel: 'gpt-4',
    }).run();

    const rows = db.select().from(schema.items).where(eq(schema.items.id, 'test-1')).all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('row should be defined');
    expect(row.id).toBe('test-1');
    expect(row.url).toBe('https://example.com/article');
    expect(row.type).toBe('web');
    expect(row.title).toBe('Test Article');
    expect(row.author).toBe('Author Name');
    expect(row.status).toBe('done');
    expect(row.transcript).toBe('Some transcript text');
    expect(row.summary).toBe('A summary');
    expect(row.tags).toBe(JSON.stringify(['tag1', 'tag2']));
    expect(row.notes).toBe('my notes');
    expect(row.starred).toBe(1);
    expect(row.archived).toBe(0);
    expect(row.pinned).toBe(0);
    expect(row.rating).toBe(4);
    expect(row.imageUrl).toBe('https://example.com/image.png');
    expect(row.summaryModel).toBe('gpt-4');
  });

  test('deleting an item cascades to highlights via foreign key', () => {
    const { db, sqlite } = createTestDb();
    sqlite.run('PRAGMA foreign_keys = ON');
    const now = new Date().toISOString();

    db.insert(schema.items).values({
      id: 'cascade-1',
      url: 'https://example.com/cascade',
      type: 'web',
      title: 'Cascade Test',
      status: 'done',
      createdAt: now,
    }).run();

    db.insert(schema.highlights).values({
      id: 'hl-1',
      itemId: 'cascade-1',
      text: 'highlighted text',
      section: 'intro',
      createdAt: now,
    }).run();

    // Verify highlights has a row
    const before = db.select().from(schema.highlights).where(eq(schema.highlights.itemId, 'cascade-1')).all();
    expect(before).toHaveLength(1);

    // Delete item — should cascade to highlights
    db.delete(schema.items).where(eq(schema.items.id, 'cascade-1')).run();

    const after = db.select().from(schema.highlights).where(eq(schema.highlights.itemId, 'cascade-1')).all();
    expect(after).toHaveLength(0);
  });

  test('summary_quality table stores and retrieves ratings', () => {
    const { db } = createTestDb();
    const now = new Date().toISOString();

    db.insert(schema.items).values({
      id: 'sq-1',
      url: 'https://example.com/sq',
      type: 'web',
      title: 'Quality Test',
      status: 'done',
      createdAt: now,
    }).run();

    db.insert(schema.summaryQuality).values({
      itemId: 'sq-1',
      rating: 4,
      reason: 'Missing key technical details',
      ratedAt: now,
    }).run();

    const rows = db.select().from(schema.summaryQuality).where(eq(schema.summaryQuality.itemId, 'sq-1')).all();
    expect(rows).toHaveLength(1);
    const sq0 = rows[0];
    if (!sq0) throw new Error('rows[0] should be defined');
    expect(sq0.rating).toBe(4);
    expect(sq0.reason).toBe('Missing key technical details');
  });

  test('summary_prompt_templates creates new row when template text changes', () => {
    const { db } = createTestDb();

    // Insert first template
    db.insert(schema.summaryPromptTemplates).values({
      template: 'template v1',
      isActive: 1,
    }).run();

    const v1 = db.select().from(schema.summaryPromptTemplates)
      .where(eq(schema.summaryPromptTemplates.isActive, 1)).all();
    expect(v1).toHaveLength(1);
    const v1row = v1[0];
    if (!v1row) throw new Error('v1[0] should be defined');
    expect(v1row.template).toBe('template v1');

    // Deactivate old, insert new
    db.update(schema.summaryPromptTemplates)
      .set({ isActive: 0 })
      .where(eq(schema.summaryPromptTemplates.isActive, 1))
      .run();
    db.insert(schema.summaryPromptTemplates).values({
      template: 'template v2',
      isActive: 1,
    }).run();

    const all = db.select().from(schema.summaryPromptTemplates).all();
    expect(all).toHaveLength(2);

    const active = db.select().from(schema.summaryPromptTemplates)
      .where(eq(schema.summaryPromptTemplates.isActive, 1)).all();
    expect(active).toHaveLength(1);
    const activeRow = active[0];
    if (!activeRow) throw new Error('active[0] should be defined');
    expect(activeRow.template).toBe('template v2');
  });

  test("row with type='web' maps to domain type 'article' via DB_TO_DOMAIN", () => {
    const { db, sqlite } = createTestDb();
    const now = new Date().toISOString();

    // Insert a row with legacy 'web' type
    sqlite.run(
      `INSERT INTO items (id, url, type, title, status, date_added) VALUES (?, ?, ?, ?, ?, ?)`,
      ['web-to-article-1', 'https://example.com/test', 'web', 'Test', 'done', now]
    );

    // Import and apply the mapping
    const { dbTypeToDomain } = require('../db-type-mapping.ts');
    const rows = db.select().from(schema.items).where(eq(schema.items.id, 'web-to-article-1')).all();
    expect(rows).toHaveLength(1);
    const row = rows[0];
    if (!row) throw new Error('row should be defined');
    expect(row.type).toBe('web');
    const domainType = dbTypeToDomain(row.type);
    expect(domainType).toBe('article');
  });

  test('summary and chat prompt_templates are independent tables', () => {
    const { db } = createTestDb();

    db.insert(schema.summaryPromptTemplates).values({ template: 'sum v1', isActive: 1 }).run();
    db.insert(schema.chatPromptTemplates).values({ template: 'chat v1', isActive: 1 }).run();

    const activeSummary = db.select().from(schema.summaryPromptTemplates)
      .where(eq(schema.summaryPromptTemplates.isActive, 1)).all();
    const activeChat = db.select().from(schema.chatPromptTemplates)
      .where(eq(schema.chatPromptTemplates.isActive, 1)).all();

    expect(activeSummary).toHaveLength(1);
    expect(activeChat).toHaveLength(1);
    const asRow = activeSummary[0];
    const acRow = activeChat[0];
    if (!asRow || !acRow) throw new Error('active row(s) should be defined');
    expect(asRow.template).toBe('sum v1');
    expect(acRow.template).toBe('chat v1');
  });
});
