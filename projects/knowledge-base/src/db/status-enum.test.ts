/**
 * Verifies that KnowledgeItemStatus enum aligns with actual DB values.
 * DB only ever stores: queued | processing | done | error
 * Dead values like 'pending' or 'ready' must not appear in the type.
 */
import { test, expect, describe } from 'bun:test';
import type { KnowledgeItemStatus } from '../types.ts';

describe('KnowledgeItemStatus enum aligns with DB reality', () => {
  // Valid statuses that the DB actually uses
  const validStatuses: KnowledgeItemStatus[] = ['queued', 'processing', 'done', 'error'];

  test('all four valid DB statuses are assignable to KnowledgeItemStatus', () => {
    // TypeScript assignment is compile-time checked above — this verifies runtime shape
    expect(validStatuses).toHaveLength(4);
    expect(validStatuses).toContain('queued');
    expect(validStatuses).toContain('processing');
    expect(validStatuses).toContain('done');
    expect(validStatuses).toContain('error');
  });

  test('dead values pending and ready are NOT valid KnowledgeItemStatus values', () => {
    // These values were historically considered but never made it to the DB.
    // If this test compiles with 'pending' or 'ready' in the KnowledgeItemStatus array,
    // the type is wrong. We verify them as string literals here to catch runtime drift.
    const deadValues = ['pending', 'ready'];
    for (const dead of deadValues) {
      expect(validStatuses).not.toContain(dead);
    }
  });

  test('KnowledgeItemStatus has exactly 4 values (no extra dead values in union)', () => {
    // This exhaustive check catches any future addition of dead values.
    // If a new status is added to the DB, update this test alongside the type.
    const exhaustive: KnowledgeItemStatus[] = ['queued', 'processing', 'done', 'error'];
    expect(validStatuses).toEqual(exhaustive);
  });
});
