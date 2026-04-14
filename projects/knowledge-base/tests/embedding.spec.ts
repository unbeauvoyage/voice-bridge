import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('GET /embed/status reports total, embedded, and pending counts', async ({ request }) => {
  const res = await request.get(`${BASE}/embed/status`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { total: number; embedded: number; pending: number };
  expect(typeof body.total).toBe('number');
  expect(typeof body.embedded).toBe('number');
  expect(typeof body.pending).toBe('number');
  expect(body.total).toBeGreaterThanOrEqual(0);
  expect(body.embedded).toBeGreaterThanOrEqual(0);
});

test('POST /embed/rebuild returns ok and starts background job', async ({ request }) => {
  const res = await request.post(`${BASE}/embed/rebuild`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { ok: boolean; message?: string };
  expect(body.ok).toBe(true);
});

test('GET /search?q=test returns an array (lexical search)', async ({ request }) => {
  const res = await request.get(`${BASE}/search?q=test`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /search with empty q and no tag returns empty array', async ({ request }) => {
  const res = await request.get(`${BASE}/search?q=`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  expect((body as unknown[]).length).toBe(0);
});

test('GET /search?q=...&semantic=true returns results array or 503', async ({ request }) => {
  const res = await request.get(`${BASE}/search?q=artificial%20intelligence&semantic=true`);
  // Semantic search requires Ollama to be reachable — accept either a successful
  // array response or the documented 503 when the embed model isn't available.
  if (res.status() === 503) {
    const err = (await res.json()) as { error: string };
    expect(err.error).toBeDefined();
    return;
  }
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /search by tag filter returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/search?tag=AI`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});
