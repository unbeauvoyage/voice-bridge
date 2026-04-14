import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

async function cleanupFeed(request: APIRequestContext, id: string) {
  await request.delete(`${BASE}/feeds/${id}`);
}

test('GET /feeds returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/feeds`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('POST /feeds creates a feed and returns id', async ({ request }) => {
  const feedUrl = `https://example.com/feed-${Date.now()}.xml`;
  const res = await request.post(`${BASE}/feeds`, {
    data: { url: feedUrl, name: 'Test Feed' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: string };
  expect(typeof body.id).toBe('string');
  expect(body.id.length).toBeGreaterThan(0);
  await cleanupFeed(request, body.id);
});

test('GET /feeds includes newly created feed with expected shape', async ({ request }) => {
  const feedUrl = `https://example.com/feed-shape-${Date.now()}.xml`;
  const feedName = 'Shape Test Feed';
  const createRes = await request.post(`${BASE}/feeds`, {
    data: { url: feedUrl, name: feedName },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = (await createRes.json()) as { id: string };

  const listRes = await request.get(`${BASE}/feeds`);
  expect(listRes.ok()).toBeTruthy();
  const feeds = (await listRes.json()) as Array<{ id: string; url: string; name: string | null }>;
  const created = feeds.find((f) => f.id === id);
  expect(created).toBeTruthy();
  expect(created!.url).toBe(feedUrl);
  expect(created!.name).toBe(feedName);

  await cleanupFeed(request, id);
});

test('POST /feeds rejects missing url', async ({ request }) => {
  const res = await request.post(`${BASE}/feeds`, {
    data: {},
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('POST /feeds rejects duplicate url with 409', async ({ request }) => {
  const feedUrl = `https://example.com/dup-feed-${Date.now()}.xml`;
  const first = await request.post(`${BASE}/feeds`, {
    data: { url: feedUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(first.ok()).toBeTruthy();
  const { id } = (await first.json()) as { id: string };

  const second = await request.post(`${BASE}/feeds`, {
    data: { url: feedUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(second.status()).toBe(409);

  await cleanupFeed(request, id);
});

test('DELETE /feeds/:id removes the feed', async ({ request }) => {
  const feedUrl = `https://example.com/delete-feed-${Date.now()}.xml`;
  const createRes = await request.post(`${BASE}/feeds`, {
    data: { url: feedUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id } = (await createRes.json()) as { id: string };

  const del = await request.delete(`${BASE}/feeds/${id}`);
  expect(del.ok()).toBeTruthy();

  const listRes = await request.get(`${BASE}/feeds`);
  const feeds = (await listRes.json()) as Array<{ id: string }>;
  expect(feeds.find((f) => f.id === id)).toBeUndefined();
});

test('POST /feeds/:id/check triggers a non-blocking check', async ({ request }) => {
  const feedUrl = `https://example.com/check-feed-${Date.now()}.xml`;
  const createRes = await request.post(`${BASE}/feeds`, {
    data: { url: feedUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id } = (await createRes.json()) as { id: string };

  const check = await request.post(`${BASE}/feeds/${id}/check`);
  expect(check.ok()).toBeTruthy();
  const body = (await check.json()) as { ok: boolean };
  expect(body.ok).toBe(true);

  await cleanupFeed(request, id);
});
