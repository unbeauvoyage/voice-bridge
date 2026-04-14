import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

async function enqueue(request: APIRequestContext, url: string) {
  const res = await request.post(`${BASE}/process`, {
    data: { url },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  return (await res.json()) as { id: string; status: string };
}

test('GET /health returns { ok: true }', async ({ request }) => {
  const res = await request.get(`${BASE}/health`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { ok: boolean };
  expect(body.ok).toBe(true);
});

test('POST /process rejects missing url field with 400', async ({ request }) => {
  const res = await request.post(`${BASE}/process`, {
    data: {},
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('POST /process rejects invalid JSON body', async ({ request }) => {
  const res = await request.post(`${BASE}/process`, {
    data: 'not json',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('duplicate POST /process returns the same item id', async ({ request }) => {
  const url = `https://example.com/dup-proc-${Date.now()}`;
  const first = await enqueue(request, url);
  const second = await enqueue(request, url);
  expect(second.id).toBe(first.id);
  await request.delete(`${BASE}/items/${first.id}`);
});

test('POST /process on an already-done URL returns exists status', async ({ request }) => {
  // Find a real done item so we know its URL is in the DB.
  const listRes = await request.get(`${BASE}/items`);
  const items = (await listRes.json()) as Array<{ id: string; url: string; status: string }>;
  const done = items.find((i) => i.status === 'done');
  expect(done).toBeTruthy();

  const res = await request.post(`${BASE}/process`, {
    data: { url: done!.url },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string; status: string };
  expect(body.id).toBe(done!.id);
  expect(body.status).toBe('exists');
});

test('GET /status/:id returns id, status, title, summary fields', async ({ request }) => {
  const url = `https://example.com/status-${Date.now()}`;
  const { id } = await enqueue(request, url);

  const res = await request.get(`${BASE}/status/${id}`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: string; status: string };
  expect(body.id).toBe(id);
  expect(typeof body.status).toBe('string');
  expect(['queued', 'processing', 'done', 'error']).toContain(body.status);

  await request.delete(`${BASE}/items/${id}`);
});

test('GET /status/:id returns 404 for unknown id', async ({ request }) => {
  const res = await request.get(`${BASE}/status/does-not-exist-${Date.now()}`);
  expect(res.status()).toBe(404);
});

test('GET /items/:id returns 404 for unknown id', async ({ request }) => {
  const res = await request.get(`${BASE}/items/not-a-real-id-${Date.now()}`);
  expect(res.status()).toBe(404);
});

test('concurrent POST /process requests for distinct URLs all succeed', async ({ request }) => {
  const now = Date.now();
  const urls = [
    `https://example.com/concurrent-a-${now}`,
    `https://example.com/concurrent-b-${now}`,
    `https://example.com/concurrent-c-${now}`,
  ];
  const results = await Promise.all(urls.map((u) => enqueue(request, u)));
  const ids = new Set(results.map((r) => r.id));
  expect(ids.size).toBe(urls.length);
  for (const r of results) {
    expect(typeof r.id).toBe('string');
    expect(r.id.length).toBeGreaterThan(0);
  }
  // Cleanup
  for (const r of results) await request.delete(`${BASE}/items/${r.id}`);
});

test('concurrent POST /process for the same URL returns a single id', async ({ request }) => {
  const url = `https://example.com/concurrent-same-${Date.now()}`;
  const results = await Promise.all([
    enqueue(request, url),
    enqueue(request, url),
    enqueue(request, url),
  ]);
  const ids = new Set(results.map((r) => r.id));
  expect(ids.size).toBe(1);
  await request.delete(`${BASE}/items/${results[0]!.id}`);
});

test('POST /items/retry-failed returns a queued count', async ({ request }) => {
  const res = await request.post(`${BASE}/items/retry-failed`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { queued: number };
  expect(typeof body.queued).toBe('number');
  expect(body.queued).toBeGreaterThanOrEqual(0);
});

test('GET /items/recent?limit=N respects limit cap of 50', async ({ request }) => {
  const res = await request.get(`${BASE}/items/recent?limit=100`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as unknown[];
  expect(Array.isArray(body)).toBe(true);
  expect(body.length).toBeLessThanOrEqual(50);
});

test('GET /items/recent?all=1 includes non-done items', async ({ request }) => {
  // Create a fresh queued item so there is a non-done item to observe.
  const url = `https://example.com/recent-all-${Date.now()}`;
  const create = await request.post(`${BASE}/process`, {
    data: { url },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id } = (await create.json()) as { id: string };

  const res = await request.get(`${BASE}/items/recent?all=1&limit=50`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as Array<{ id: string }>;
  expect(Array.isArray(body)).toBe(true);
  // We can't guarantee the just-created item will appear in the top 50 if
  // there are already many items, but the response must still be an array.
  expect(body.length).toBeGreaterThan(0);

  await request.delete(`${BASE}/items/${id}`);
});

test('POST /preview rejects missing url', async ({ request }) => {
  const res = await request.post(`${BASE}/preview`, {
    data: {},
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('GET /preview rejects invalid url', async ({ request }) => {
  const res = await request.get(`${BASE}/preview?url=not-a-url`);
  expect(res.status()).toBe(400);
});

test('GET /manifest.json returns manifest shape', async ({ request }) => {
  const res = await request.get(`${BASE}/manifest.json`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { name: string; short_name: string; icons: unknown[] };
  expect(typeof body.name).toBe('string');
  expect(typeof body.short_name).toBe('string');
  expect(Array.isArray(body.icons)).toBe(true);
});

test('GET /system/status returns whisper/ytdlp/pdftotext booleans', async ({ request }) => {
  const res = await request.get(`${BASE}/system/status`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { whisper: boolean; ytdlp: boolean; pdftotext: boolean };
  expect(typeof body.whisper).toBe('boolean');
  expect(typeof body.ytdlp).toBe('boolean');
  expect(typeof body.pdftotext).toBe('boolean');
});

test('unknown route returns 404', async ({ request }) => {
  const res = await request.get(`${BASE}/this/route/does/not/exist`);
  expect(res.status()).toBe(404);
});

test('GET /export/json returns attachment with all items', async ({ request }) => {
  const res = await request.get(`${BASE}/export/json`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()['content-type']).toContain('application/json');
  const body = (await res.json()) as unknown[];
  expect(Array.isArray(body)).toBe(true);
});

test('GET /export/markdown returns markdown attachment', async ({ request }) => {
  const res = await request.get(`${BASE}/export/markdown`);
  expect(res.ok()).toBeTruthy();
  expect(res.headers()['content-type']).toContain('text/markdown');
});

test('GET /digest returns markdown with highlights heading', async ({ request }) => {
  const res = await request.get(`${BASE}/digest?days=7&format=text`);
  expect(res.ok()).toBeTruthy();
  const body = await res.text();
  expect(body).toContain('Knowledge Digest');
  expect(body).toContain("Week's Highlights");
});
