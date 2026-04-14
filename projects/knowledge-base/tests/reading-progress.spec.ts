import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('POST /items/:id/read marks an item as read', async ({ request }) => {
  // Create a throw-away item
  const createRes = await request.post(BASE + '/process', {
    data: { url: 'https://example.com/read-test-' + Date.now() },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = await createRes.json();

  const readRes = await request.post(BASE + `/items/${id}/read`);
  expect(readRes.ok()).toBeTruthy();

  const after = await request.get(BASE + `/items/${id}`);
  expect(after.ok()).toBeTruthy();
  const body = await after.json();
  expect(body.readAt).toBeTruthy();

  // Cleanup
  await request.delete(BASE + `/items/${id}`);
});

test('POST /items/:id/unread clears the read flag', async ({ request }) => {
  const createRes = await request.post(BASE + '/process', {
    data: { url: 'https://example.com/unread-test-' + Date.now() },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id } = await createRes.json();
  await request.post(BASE + `/items/${id}/read`);
  const unreadRes = await request.post(BASE + `/items/${id}/unread`);
  expect(unreadRes.ok()).toBeTruthy();
  const after = await request.get(BASE + `/items/${id}`);
  const body = await after.json();
  expect(body.readAt == null || body.readAt === '').toBe(true);
  await request.delete(BASE + `/items/${id}`);
});

test('GET /stats/summary reflects total item count', async ({ request }) => {
  const stats = await request.get(BASE + '/stats/summary');
  expect(stats.ok()).toBeTruthy();
  const body = await stats.json();
  expect(typeof body.totalItems).toBe('number');
  expect(body.totalItems).toBeGreaterThan(0);
  expect(typeof body.totalRead).toBe('number');
});
