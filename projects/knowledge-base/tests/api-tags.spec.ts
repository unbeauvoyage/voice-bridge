import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('GET /tags/rejections returns expected shape', async ({ request }) => {
  // Seed one rejection so we can assert shape
  const tag = `reject-shape-${Date.now()}`;
  await request.post(`${BASE}/tags/reject`, {
    data: { tag, reason: 'shape test' },
    headers: { 'Content-Type': 'application/json' },
  });

  const res = await request.get(`${BASE}/tags/rejections`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  const match = (body as Array<Record<string, unknown>>).find((r) => r.tag === tag);
  expect(match).toBeDefined();
  expect(typeof match!.id).toBe('string');
  expect(match!.tag).toBe(tag);
  expect(typeof match!.reason).toBe('string');
  expect(typeof match!.createdAt).toBe('string');
});

test('GET /tag-rules returns rules string', async ({ request }) => {
  const res = await request.get(`${BASE}/tag-rules`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('rules');
  expect(typeof body.rules).toBe('string');
});

test('DELETE /tags/:tag removes tag from approved list', async ({ request }) => {
  const tag = `delete-me-tag-${Date.now()}`;

  // Approve it first so it appears in approved list
  const approveRes = await request.post(`${BASE}/tags/approve`, {
    data: { tag },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(approveRes.ok()).toBeTruthy();

  const before = await (await request.get(`${BASE}/tags`)).json();
  expect((before.approved as string[]).includes(tag)).toBe(true);

  const delRes = await request.delete(`${BASE}/tags/${encodeURIComponent(tag)}`);
  expect(delRes.ok()).toBeTruthy();

  const after = await (await request.get(`${BASE}/tags`)).json();
  expect((after.approved as string[]).includes(tag)).toBe(false);
});
