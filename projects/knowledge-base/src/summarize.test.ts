/**
 * Tests for summarize.ts — verifies the model name stored per-item is the one
 * Ollama actually reports in its API response, not the config value (they can
 * differ when Ollama resolves aliases/tags).
 */

import { test, expect, afterEach, beforeEach } from 'bun:test';
import { summarize } from './summarize.ts';
import { config } from './config.ts';
import type { ExtractedContent } from './types.ts';

const originalFetch = globalThis.fetch;
const originalModel = config.ollamaModel;

afterEach(() => {
  globalThis.fetch = originalFetch;
  config.ollamaModel = originalModel;
});

beforeEach(() => {
  config.ollamaModel = 'config-model-alias:latest';
});

function mockOllamaResponse(body: unknown): void {
  const fn = async () =>
    new Response(JSON.stringify(body), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    });
  globalThis.fetch = fn as unknown as typeof fetch;
}

const extracted: ExtractedContent = {
  title: 'Test',
  content: 'Some article content to summarize.',
  url: 'https://example.com/test',
};

const validSummaryJson = JSON.stringify({
  tldr: ['point one'],
  summary: 'a summary',
  sections: [],
  tags: ['Test'],
  publishedAt: null,
});

test('summarize uses model name from LLM response not from config', async () => {
  mockOllamaResponse({
    model: 'gemma4:26b-actual',
    choices: [{ message: { content: validSummaryJson } }],
  });

  const result = await summarize(extracted);

  expect(result.model).toBe('gemma4:26b-actual');
  expect(result.model).not.toBe(config.ollamaModel);
});

test('summarize falls back to config model when response omits model field', async () => {
  mockOllamaResponse({
    choices: [{ message: { content: validSummaryJson } }],
  });

  const result = await summarize(extracted);

  expect(result.model).toBe(config.ollamaModel);
});
