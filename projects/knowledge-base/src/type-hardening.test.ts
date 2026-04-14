import { test, expect } from 'bun:test';

// ── Test: assertObj narrows unknown to Record<string,unknown> ─────────────────

function assertObj(v: unknown): asserts v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error('Expected object, got: ' + typeof v);
  }
}

function assertArr(v: unknown): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new Error('Expected array, got: ' + typeof v);
}

test('assertObj narrows valid object', () => {
  const raw: unknown = { ok: true, count: 42 };
  assertObj(raw);
  expect(raw.ok).toBe(true);
  expect(raw.count).toBe(42);
});

test('assertObj throws on null', () => {
  expect(() => assertObj(null)).toThrow('Expected object');
});

test('assertObj throws on array', () => {
  expect(() => assertObj([1, 2, 3])).toThrow('Expected object');
});

test('assertObj throws on string', () => {
  expect(() => assertObj('hello')).toThrow('Expected object');
});

test('assertArr narrows valid array', () => {
  const raw: unknown = [{ id: '1' }, { id: '2' }];
  assertArr(raw);
  expect(raw.length).toBe(2);
});

test('assertArr throws on object', () => {
  expect(() => assertArr({ length: 3 })).toThrow('Expected array');
});

// ── Test: isKnowledgeItemDetail type guard ────────────────────────────────────

interface PreviewLike { id: string; url: string; summary: string }
interface DetailLike extends PreviewLike { transcript: string; summaryModel?: string; dateAdded: string }

function isDetail(item: PreviewLike | DetailLike): item is DetailLike {
  return 'transcript' in item;
}

test('isDetail returns true when transcript field present', () => {
  const detail: DetailLike = { id: '1', url: 'https://example.com', summary: 'sum', transcript: 'text', dateAdded: '2024-01-01' };
  expect(isDetail(detail)).toBe(true);
});

test('isDetail returns false when transcript field absent', () => {
  const preview: PreviewLike = { id: '1', url: 'https://example.com', summary: 'sum' };
  expect(isDetail(preview)).toBe(false);
});

test('isDetail allows safe access to transcript without cast', () => {
  const item: PreviewLike | DetailLike = { id: '1', url: 'https://example.com', summary: 'sum', transcript: 'the transcript', dateAdded: '2024-01-01' };
  const transcript = isDetail(item) ? item.transcript : undefined;
  expect(transcript).toBe('the transcript');
});

test('isDetail returns undefined transcript for preview', () => {
  const item: PreviewLike | DetailLike = { id: '1', url: 'https://example.com', summary: 'sum' };
  const transcript = isDetail(item) ? item.transcript : undefined;
  expect(transcript).toBeUndefined();
});

// ── Test: isOpenAICompatibleResponse type guard (llm.ts) ──────────────────────

import { isOpenAICompatibleResponse } from './llm.ts';

test('isOpenAICompatibleResponse returns true for valid shape', () => {
  const response = {
    model: 'gpt-4',
    choices: [{ message: { content: 'Hello world' } }],
  };
  expect(isOpenAICompatibleResponse(response)).toBe(true);
});

test('isOpenAICompatibleResponse returns false for missing choices', () => {
  expect(isOpenAICompatibleResponse({ model: 'gpt-4' })).toBe(false);
});

test('isOpenAICompatibleResponse returns false for non-string content', () => {
  expect(isOpenAICompatibleResponse({
    model: 'gpt-4',
    choices: [{ message: { content: 42 } }],
  })).toBe(false);
});

test('isOpenAICompatibleResponse returns false for null', () => {
  expect(isOpenAICompatibleResponse(null)).toBe(false);
});

test('isOpenAICompatibleResponse returns false for empty choices', () => {
  expect(isOpenAICompatibleResponse({ model: 'gpt-4', choices: [] })).toBe(false);
});

// ── Test: isEmbeddingResponse type guard (embed.ts) ───────────────────────────

import { isEmbeddingResponse } from './embed.ts';

test('isEmbeddingResponse returns true for valid embedding array', () => {
  expect(isEmbeddingResponse({ embedding: [0.1, 0.2, 0.3] })).toBe(true);
});

test('isEmbeddingResponse returns false for missing embedding', () => {
  expect(isEmbeddingResponse({ model: 'test' })).toBe(false);
});

test('isEmbeddingResponse returns false when embedding contains non-numbers', () => {
  expect(isEmbeddingResponse({ embedding: ['a', 'b'] })).toBe(false);
});

test('isEmbeddingResponse returns false for null', () => {
  expect(isEmbeddingResponse(null)).toBe(false);
});

// ── Test: parseTagArray (db.ts) ───────────────────────────────────────────────

import { parseTagArray } from './db.ts';

test('parseTagArray returns string array for valid JSON', () => {
  const result = parseTagArray('["AI", "TypeScript"]');
  expect(result).toEqual(['AI', 'TypeScript']);
});

test('parseTagArray returns empty array for empty string', () => {
  expect(parseTagArray('')).toEqual([]);
});

test('parseTagArray returns empty array for invalid JSON', () => {
  expect(parseTagArray('not-json')).toEqual([]);
});

test('parseTagArray filters non-string elements', () => {
  expect(parseTagArray('[1, "valid", null, "also-valid"]')).toEqual(['valid', 'also-valid']);
});

// ── Test: getString helper (server.ts) ────────────────────────────────────────

import { getString } from './body-helpers.ts';

test('getString returns string value when key exists', () => {
  const body: Record<string, unknown> = { url: 'https://example.com', count: 5 };
  expect(getString(body, 'url')).toBe('https://example.com');
});

test('getString returns undefined when value is not a string', () => {
  const body: Record<string, unknown> = { count: 5 };
  expect(getString(body, 'count')).toBeUndefined();
});

test('getString returns undefined when key is absent', () => {
  const body: Record<string, unknown> = {};
  expect(getString(body, 'url')).toBeUndefined();
});

// ── Test: SummaryVersion.sections is KnowledgeSection[] (web/api.ts) ──────────

import type { SummaryVersion } from '../web/api.ts';
import type { KnowledgeSection } from './types.ts';

test('SummaryVersion.sections accepts KnowledgeSection[]', () => {
  const sections: KnowledgeSection[] = [
    { title: 'Intro', points: ['Point 1', 'Point 2'] },
  ];
  const version: SummaryVersion = {
    id: 1,
    summary: 'summary text',
    tldr: ['short'],
    sections,
    createdAt: '2024-01-01T00:00:00',
  };
  expect(version.sections[0]?.title).toBe('Intro');
  expect(version.sections[0]?.points[0]).toBe('Point 1');
});
