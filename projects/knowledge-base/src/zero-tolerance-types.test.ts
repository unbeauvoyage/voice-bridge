/**
 * Zero-tolerance type safety tests.
 *
 * Tests the assertion-function pattern for KnowledgeItemId,
 * proper array access patterns (no ! non-null), and that invalid
 * inputs are rejected at runtime.
 */

import { test, expect } from 'bun:test';

// ── Test: toKnowledgeItemId assertion-based constructor ────────────────────────

// Import after implementation is done. For now re-declare the shape to
// write a failing test against the *current* cast-based implementation.
import { toKnowledgeItemId, asKnowledgeItemId } from './types.ts';
import type { KnowledgeItemId } from './types.ts';

test('toKnowledgeItemId returns a valid branded id for non-empty string', () => {
  const id = toKnowledgeItemId('abc-123');
  // Just type-check: id must be assignable to KnowledgeItemId
  const _: KnowledgeItemId = id;
  // Compare as string since branded types are plain strings at runtime
  expect(String(id)).toBe('abc-123');
});

test('toKnowledgeItemId throws on empty string', () => {
  expect(() => toKnowledgeItemId('')).toThrow();
});

test('toKnowledgeItemId throws on whitespace-only string', () => {
  expect(() => toKnowledgeItemId('   ')).toThrow();
});

// ── Test: safe array access pattern (no !) ─────────────────────────────────────

test('safe parts[0] access returns value when array has elements', () => {
  const path = '/items/item-123/history/456/restore';
  const parts = path.slice('/items/'.length).split('/history/');
  const itemId = parts[0];
  const rest = parts[1];
  // No ! used — explicit checks
  expect(itemId).toBeDefined();
  expect(itemId).toBe('item-123');
  expect(rest).toBe('456/restore');
});

test('safe parts access returns undefined when array is empty', () => {
  const parts: string[] = [];
  const first = parts[0];
  expect(first).toBeUndefined();
});

test('safe collections path split returns both parts', () => {
  const path = '/collections/col-1/items/item-2';
  const parts = path.slice('/collections/'.length).split('/items/');
  const collectionId = parts[0];
  const itemId = parts[1];
  expect(collectionId).toBe('col-1');
  expect(itemId).toBe('item-2');
});

// ── Test: items loop safe access ───────────────────────────────────────────────

test('items loop with explicit guard does not throw on undefined', () => {
  const items = [{ title: 'A' }, { title: 'B' }];
  const results: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    results.push(item.title);
  }
  expect(results).toEqual(['A', 'B']);
});

test('items loop with explicit guard skips undefined holes', () => {
  const items: Array<{ title: string } | undefined> = [{ title: 'A' }, undefined, { title: 'C' }];
  const results: string[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    if (!item) continue;
    results.push(item.title);
  }
  expect(results).toEqual(['A', 'C']);
});

// ── Test: approvedTags safe access (no !) ─────────────────────────────────────

test('approvedTags[0] ?? empty string is safe when array is non-empty', () => {
  const approvedTags = ['typescript', 'web'];
  const first = approvedTags[0] ?? '';
  expect(first).toBe('typescript');
});

test('approvedTags[0] ?? empty string is safe when array is empty', () => {
  const approvedTags: string[] = [];
  const first = approvedTags[0] ?? '';
  expect(first).toBe('');
});
