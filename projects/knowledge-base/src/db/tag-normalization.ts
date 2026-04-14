import { eq } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema.ts';

type DB = BunSQLiteDatabase<typeof schema>;

export function toTagSlug(tag: string): string {
  return tag.toLowerCase().replace(/\s+/g, '-');
}

export function normalizeTag(db: DB, tag: string): string {
  const row = db.select({ canonical: schema.tagConsolidations.canonical })
    .from(schema.tagConsolidations)
    .where(eq(schema.tagConsolidations.variant, tag))
    .get();
  return row ? row.canonical : tag;
}

export function recordConsolidation(db: DB, variant: string, canonical: string): void {
  db.insert(schema.tagConsolidations)
    .values({ variant, canonical })
    .onConflictDoUpdate({
      target: schema.tagConsolidations.variant,
      set: { canonical },
    })
    .run();
}

export function normalizeTagsForItem(db: DB, tags: string[]): string[] {
  const normalized = tags.map((t) => normalizeTag(db, t));
  return [...new Set(normalized)];
}
