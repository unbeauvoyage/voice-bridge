import { test, expect, describe, beforeEach } from 'bun:test';
import { Database } from 'bun:sqlite';
import { drizzle } from 'drizzle-orm/bun-sqlite';
import { migrate } from 'drizzle-orm/bun-sqlite/migrator';
import { eq } from 'drizzle-orm';
import * as schema from './schema.ts';
import { toTagSlug, normalizeTag, recordConsolidation, normalizeTagsForItem } from './tag-normalization.ts';

function createTestDb() {
  const sqlite = new Database(':memory:');
  const db = drizzle(sqlite, { schema });
  migrate(db, { migrationsFolder: './drizzle' });
  return { db, sqlite };
}

describe('toTagSlug', () => {
  test('converts Title Case with spaces to lowercase hyphenated slug', () => {
    expect(toTagSlug('Unreal Engine')).toBe('unreal-engine');
  });

  // Acronyms intentionally lose casing in slugs — slugs are for URLs only, never stored.
  // The canonical Title Case form ("AI") is the source of truth. Do not "fix" this.
  test('converts uppercase acronym to lowercase', () => {
    expect(toTagSlug('AI')).toBe('ai');
  });

  test('handles multiple spaces by collapsing to single hyphen', () => {
    expect(toTagSlug('Game   Development')).toBe('game-development');
  });

  test('handles already-slugified input', () => {
    expect(toTagSlug('machine-learning')).toBe('machine-learning');
  });
});

// normalizeTag: the consolidation map is the memory of past LLM decisions.
// Once "ai" → "AI" is recorded, future items with "ai" are silently converted
// without an LLM call. Non-destructive: unknown tags pass through unchanged.
describe('normalizeTag', () => {
  test('returns canonical when variant exists in consolidation table', () => {
    const { db, sqlite } = createTestDb();
    db.insert(schema.tagConsolidations).values({ variant: 'ai', canonical: 'AI' }).run();
    expect(normalizeTag(db, 'ai')).toBe('AI');
  });

  test('returns tag unchanged when no consolidation exists', () => {
    const { db } = createTestDb();
    expect(normalizeTag(db, 'Machine Learning')).toBe('Machine Learning');
  });
});

describe('recordConsolidation', () => {
  test('inserts a new variant-canonical mapping', () => {
    const { db } = createTestDb();
    recordConsolidation(db, 'artificial intelligence', 'AI');
    const row = db.select().from(schema.tagConsolidations)
      .where(eq(schema.tagConsolidations.variant, 'artificial intelligence')).get();
    if (!row) throw new Error('row should be defined');
    expect(row.canonical).toBe('AI');
  });

  // Upsert: the latest consolidation decision always wins.
  // Re-running consolidation can refine decisions (e.g. "ml" → "ML" replaces "Machine Learning").
  test('updates canonical when variant already exists (upsert)', () => {
    const { db } = createTestDb();
    recordConsolidation(db, 'ml', 'Machine Learning');
    recordConsolidation(db, 'ml', 'ML');
    const row = db.select().from(schema.tagConsolidations)
      .where(eq(schema.tagConsolidations.variant, 'ml')).get();
    if (!row) throw new Error('row should be defined');
    expect(row.canonical).toBe('ML');
  });
});

describe('normalizeTagsForItem', () => {
  test('tags saved to items go through normalization', () => {
    const { db } = createTestDb();
    recordConsolidation(db, 'ai', 'AI');
    recordConsolidation(db, 'game dev', 'Game Development');

    const input = ['ai', 'Unreal Engine', 'game dev'];
    const result = normalizeTagsForItem(db, input);
    expect(result).toEqual(['AI', 'Unreal Engine', 'Game Development']);
  });

  // Deduplication happens after normalization — "AI" and "artificial intelligence"
  // would both resolve to "AI", producing a duplicate without this step.
  test('deduplicates tags after normalization', () => {
    const { db } = createTestDb();
    recordConsolidation(db, 'artificial intelligence', 'AI');

    const input = ['AI', 'artificial intelligence', 'VR'];
    const result = normalizeTagsForItem(db, input);
    expect(result).toEqual(['AI', 'VR']);
  });
});
