import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('GET /considerations returns an array', async ({ request }) => {
  const res = await request.get(BASE + '/considerations');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('raising an item creates a consideration that appears in GET /considerations', async ({ request }) => {
  // Seed a test item
  const createRes = await request.post(BASE + '/process', {
    data: { url: 'https://example.com/raise-consider-' + Date.now() },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id: itemId } = await createRes.json();

  try {
    const raise = await request.post(BASE + `/items/${itemId}/consider`, {
      data: { note: 'playwright consideration test' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(raise.ok()).toBeTruthy();
    const raiseBody = await raise.json();
    expect(raiseBody.ok).toBe(true);

    const list = await request.get(BASE + '/considerations');
    const rows = await list.json();
    const match = rows.find((r: any) => r.itemId === itemId);
    expect(match).toBeTruthy();
    expect(match.ceoNote).toBe('playwright consideration test');
  } finally {
    // Cleanup: unraise + delete item
    await request.delete(BASE + `/items/${itemId}/consider`);
    await request.delete(BASE + `/items/${itemId}`);
  }
});

test('PATCH /items/:id/consider updates an existing note', async ({ request }) => {
  const createRes = await request.post(BASE + '/process', {
    data: { url: 'https://example.com/raise-patch-' + Date.now() },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id: itemId } = await createRes.json();

  try {
    await request.post(BASE + `/items/${itemId}/consider`, {
      data: { note: 'original note' },
      headers: { 'Content-Type': 'application/json' },
    });
    const patch = await request.post(BASE + `/items/${itemId}/consider`, {
      data: { note: 'original note' },
      headers: { 'Content-Type': 'application/json' },
    });
    // Confirm raise is active via GET
    const check = await request.get(BASE + `/items/${itemId}/consider`);
    const checkBody = await check.json();
    expect(checkBody.raised).toBe(true);

    const updated = await request.fetch(BASE + `/items/${itemId}/consider`, {
      method: 'PATCH',
      data: { note: 'updated note' },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(updated.ok()).toBeTruthy();

    const after = await request.get(BASE + `/items/${itemId}/consider`);
    const afterBody = await after.json();
    expect(afterBody.note).toBe('updated note');
  } finally {
    await request.delete(BASE + `/items/${itemId}/consider`);
    await request.delete(BASE + `/items/${itemId}`);
  }
});
