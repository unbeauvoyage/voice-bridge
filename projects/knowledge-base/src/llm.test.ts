import { test, expect } from 'bun:test';
import { llmComplete } from './llm.ts';

// Use the smallest available model for speed
const TEST_MODEL = process.env['OLLAMA_MODEL'] ?? 'llama3.2:latest';
const LIVE_TIMEOUT = 120_000; // gemma4:26b can be slow on first load

test('llmComplete returns a non-empty string', async () => {
  const result = await llmComplete(
    [{ role: 'user', content: 'Say exactly: hello' }],
    { model: TEST_MODEL }
  );
  expect(typeof result.content).toBe('string');
  expect(result.content.length).toBeGreaterThan(0);
}, LIVE_TIMEOUT);

test('llmComplete returns the model name from the API response', async () => {
  const result = await llmComplete(
    [{ role: 'user', content: 'Say exactly: hello' }],
    { model: TEST_MODEL }
  );
  expect(typeof result.model).toBe('string');
  expect(result.model.length).toBeGreaterThan(0);
}, LIVE_TIMEOUT);

test('llmComplete works with a system message', async () => {
  const result = await llmComplete([
    { role: 'system', content: 'You are a helpful assistant. Always respond briefly.' },
    { role: 'user', content: 'Say exactly: hello' },
  ], { model: TEST_MODEL });
  expect(result.content.length).toBeGreaterThan(0);
}, LIVE_TIMEOUT);

test('llmComplete throws a clear error for invalid model', async () => {
  await expect(
    llmComplete([{ role: 'user', content: 'hello' }], { model: 'nonexistent-model-xyz-404' })
  ).rejects.toThrow();
}, LIVE_TIMEOUT);

test('llmComplete timeout aborts and throws descriptive error', async () => {
  await expect(
    llmComplete([{ role: 'user', content: 'hello' }], { timeoutMs: 1 })
  ).rejects.toThrow(/timed out/i);
}, 5_000);
