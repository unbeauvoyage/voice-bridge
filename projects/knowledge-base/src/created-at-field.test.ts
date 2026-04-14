/**
 * Verifies that KnowledgeItem and related types use `createdAt` (not `dateAdded`)
 * to match the shared cross-service domain contract.
 */
import { test, expect } from 'bun:test';
import type { KnowledgeItem, KnowledgeItemPreview } from './types.ts';
import type { KnowledgeItemId } from './types.ts';

test('KnowledgeItem has createdAt field (not dateAdded)', () => {
  // Construct a minimal KnowledgeItem — TS errors at compile time if
  // createdAt is missing or dateAdded is required instead.
  const item: KnowledgeItem = {
    id: 'test-id' as KnowledgeItemId,
    url: 'https://example.com',
    type: 'article',
    title: 'Test',
    createdAt: new Date().toISOString(),
    tags: [],
    tldr: [],
    summary: '',
    sections: [],
    status: 'done',
  };
  expect(item.createdAt).toBeDefined();
  expect(String(item.createdAt).length).toBeGreaterThan(0);
});

test('KnowledgeItemPreview has createdAt field (not dateAdded)', () => {
  const preview: KnowledgeItemPreview = {
    id: 'test-id' as KnowledgeItemId,
    url: 'https://example.com',
    type: 'article',
    title: 'Test',
    createdAt: new Date().toISOString(),
    tags: [],
    tldr: [],
    summary: '',
    sections: [],
    status: 'done',
    starred: false,
  };
  expect(preview.createdAt).toBeDefined();
  expect(String(preview.createdAt).length).toBeGreaterThan(0);
});
