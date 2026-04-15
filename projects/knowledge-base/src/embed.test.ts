import { expect, test, describe, beforeEach, afterEach } from 'bun:test';
import { isEmbeddingResponse } from './embed.ts';

// Test the guard function directly — it validates the new /api/embed response shape

describe('embed API: /api/embed response shape', () => {
  test('isEmbeddingResponse accepts new embeddings[][] shape', () => {
    // New Ollama /api/embed returns: { embeddings: [[0.1, 0.2, ...]] }
    const valid = { embeddings: [[0.1, 0.2, 0.3]] };
    expect(isEmbeddingResponse(valid)).toBe(true);
  });

  test('isEmbeddingResponse rejects old embedding[] shape', () => {
    // Old /api/embeddings returned: { embedding: [0.1, 0.2, ...] }
    const old = { embedding: [0.1, 0.2, 0.3] };
    expect(isEmbeddingResponse(old)).toBe(false);
  });

  test('isEmbeddingResponse rejects empty embeddings array', () => {
    expect(isEmbeddingResponse({ embeddings: [] })).toBe(false);
  });

  test('isEmbeddingResponse rejects non-number values in inner array', () => {
    expect(isEmbeddingResponse({ embeddings: [['a', 'b']] })).toBe(false);
  });

  test('isEmbeddingResponse rejects null', () => {
    expect(isEmbeddingResponse(null)).toBe(false);
  });

  test('isEmbeddingResponse rejects missing embeddings field', () => {
    expect(isEmbeddingResponse({})).toBe(false);
  });
});

describe('generateEmbedding: uses correct URL and request shape', () => {
  let capturedUrl: string | undefined;
  let capturedBody: Record<string, unknown> | undefined;
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    capturedUrl = undefined;
    capturedBody = undefined;
    // Cast through unknown to satisfy TS — test mock only needs the subset fetch uses
    (globalThis as Record<string, unknown>)['fetch'] = async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      capturedUrl = typeof input === 'string' ? input : input instanceof URL ? input.toString() : input.url;
      if (init?.body) {
        const parsed: unknown = JSON.parse(init.body as string);
        if (typeof parsed === 'object' && parsed !== null) {
          capturedBody = parsed as Record<string, unknown>;
        }
      }
      // Return a valid new-style response
      return new Response(JSON.stringify({ embeddings: [[0.1, 0.2, 0.3]] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      });
    };
  });

  afterEach(() => {
    (globalThis as Record<string, unknown>)['fetch'] = originalFetch;
  });

  test('calls /api/embed (not /api/embeddings)', async () => {
    const { generateEmbedding } = await import('./embed.ts');
    await generateEmbedding('hello world');
    expect(capturedUrl).toContain('/api/embed');
    expect(capturedUrl).not.toContain('/api/embeddings');
  });

  test('sends input field (not prompt field)', async () => {
    const { generateEmbedding } = await import('./embed.ts');
    await generateEmbedding('hello world');
    expect(capturedBody).toBeDefined();
    expect('input' in (capturedBody ?? {})).toBe(true);
    expect('prompt' in (capturedBody ?? {})).toBe(false);
  });

  test('returns the first embedding vector', async () => {
    const { generateEmbedding } = await import('./embed.ts');
    const result = await generateEmbedding('hello world');
    expect(result).toEqual([0.1, 0.2, 0.3]);
  });
});
