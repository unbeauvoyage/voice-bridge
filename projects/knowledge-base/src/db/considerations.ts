import { eq, desc } from 'drizzle-orm';
import type { BunSQLiteDatabase } from 'drizzle-orm/bun-sqlite';
import * as schema from './schema.ts';

type DB = BunSQLiteDatabase<typeof schema>;

export interface ConsiderationRow {
  id: string;
  itemId: string;
  raisedAt: string;
  status: string;
  agentNotes: string | null;
  ceoNote: string | null;
  itemTitle: string;
  itemUrl: string;
  itemTldr: string | null;
}

export function raiseForConsiderationDb(db: DB, itemId: string, ceoNote?: string): string {
  const id = `consideration-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const trimmed = ceoNote?.trim();
  db.insert(schema.considerations).values({
    id,
    itemId,
    raisedAt: new Date().toISOString(),
    status: 'pending',
    agentNotes: null,
    ceoNote: trimmed ? trimmed : null,
  }).run();
  return id;
}

export function isRaisedForConsiderationDb(db: DB, itemId: string): boolean {
  const row = db.select({ id: schema.considerations.id })
    .from(schema.considerations)
    .where(eq(schema.considerations.itemId, itemId))
    .get();
  return !!row;
}

export function getConsiderationsDb(db: DB): ConsiderationRow[] {
  const rows = db
    .select({
      id: schema.considerations.id,
      itemId: schema.considerations.itemId,
      raisedAt: schema.considerations.raisedAt,
      status: schema.considerations.status,
      agentNotes: schema.considerations.agentNotes,
      ceoNote: schema.considerations.ceoNote,
      itemTitle: schema.items.title,
      itemUrl: schema.items.url,
      itemTldr: schema.items.tldr,
    })
    .from(schema.considerations)
    .innerJoin(schema.items, eq(schema.considerations.itemId, schema.items.id))
    .orderBy(desc(schema.considerations.raisedAt))
    .all();
  return rows;
}

export function updateConsiderationDb(
  db: DB,
  id: string,
  status: string,
  agentNotes?: string,
): void {
  const patch: { status: string; agentNotes?: string | null } = { status };
  if (agentNotes !== undefined) patch.agentNotes = agentNotes;
  db.update(schema.considerations)
    .set(patch)
    .where(eq(schema.considerations.id, id))
    .run();
}

export function getConsiderationForItemDb(
  db: DB,
  itemId: string,
): { id: string; ceoNote: string | null } | null {
  const row = db.select({
    id: schema.considerations.id,
    ceoNote: schema.considerations.ceoNote,
  })
    .from(schema.considerations)
    .where(eq(schema.considerations.itemId, itemId))
    .get();
  return row ?? null;
}

export function updateConsiderationNoteByItemDb(
  db: DB,
  itemId: string,
  ceoNote: string,
): boolean {
  const existing = db.select({ id: schema.considerations.id })
    .from(schema.considerations)
    .where(eq(schema.considerations.itemId, itemId))
    .get();
  if (!existing) return false;
  const trimmed = ceoNote.trim();
  db.update(schema.considerations)
    .set({ ceoNote: trimmed ? trimmed : null })
    .where(eq(schema.considerations.itemId, itemId))
    .run();
  return true;
}

export function deleteConsiderationByItemDb(db: DB, itemId: string): boolean {
  const existing = db.select({ id: schema.considerations.id })
    .from(schema.considerations)
    .where(eq(schema.considerations.itemId, itemId))
    .get();
  if (!existing) return false;
  db.delete(schema.considerations)
    .where(eq(schema.considerations.itemId, itemId))
    .run();
  return true;
}
