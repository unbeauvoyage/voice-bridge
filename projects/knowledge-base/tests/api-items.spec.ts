import { test, expect, type APIRequestContext } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const BASE = 'http://127.0.0.1:3737';
const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-item.ts');
const ID_PREFIX = 'api-items-test-';

function seed(id: string, url: string, title: string, tagsCsv = ''): void {
  execSync(`bun ${SEED_SCRIPT} seed "${id}" "${url}" "${title}" "${tagsCsv}"`, { timeout: 5000 });
}

function cleanup(): void {
  execSync(`bun ${SEED_SCRIPT} cleanup "${ID_PREFIX}"`, { timeout: 5000 });
}

test.describe('item detail and lifecycle endpoints', () => {
  const ITEM_ID = `${ID_PREFIX}${Date.now()}`;
  const ITEM_URL = `https://example.com/api-items-${Date.now()}`;

  test.beforeAll(() => {
    seed(ITEM_ID, ITEM_URL, 'API items lifecycle fixture', 'api-test-tag');
  });

  test.afterAll(() => {
    cleanup();
  });

  test('GET /items/:id returns full item with transcript', async ({ request }) => {
    const res = await request.get(`${BASE}/items/${ITEM_ID}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(body.id).toBe(ITEM_ID);
    expect(typeof body.transcript).toBe('string');
    expect(body.transcript.length).toBeGreaterThan(0);
  });

  test('GET /items/:id includes sections array', async ({ request }) => {
    const res = await request.get(`${BASE}/items/${ITEM_ID}`);
    const body = await res.json();
    expect(Array.isArray(body.sections)).toBe(true);
    expect(body.sections.length).toBeGreaterThan(0);
    expect(typeof body.sections[0].title).toBe('string');
    expect(Array.isArray(body.sections[0].points)).toBe(true);
  });

  test('GET /items/:id includes tldr array', async ({ request }) => {
    const res = await request.get(`${BASE}/items/${ITEM_ID}`);
    const body = await res.json();
    expect(Array.isArray(body.tldr)).toBe(true);
    expect(body.tldr.length).toBeGreaterThan(0);
    for (const line of body.tldr) expect(typeof line).toBe('string');
  });

  test('list endpoint excludes transcript field', async ({ request }) => {
    const res = await request.get(`${BASE}/items`);
    const body = await res.json();
    const match = (body as Array<Record<string, unknown>>).find((i) => i.id === ITEM_ID);
    expect(match).toBeDefined();
    // transcript must NOT leak into the list response (it's huge)
    expect(match!.transcript).toBeUndefined();
  });

  test('POST /items/:id/read marks item as read and GET /items reflects readAt', async ({ request }) => {
    const readRes = await request.post(`${BASE}/items/${ITEM_ID}/read`);
    expect(readRes.ok()).toBeTruthy();

    const listRes = await request.get(`${BASE}/items`);
    const list = await listRes.json();
    const found = (list as Array<Record<string, unknown>>).find((i) => i.id === ITEM_ID);
    expect(found).toBeDefined();
    expect(typeof found!.readAt).toBe('string');
    expect((found!.readAt as string).length).toBeGreaterThan(0);
  });

  test('DELETE /items/:id actually removes item from GET /items', async ({ request }) => {
    const deletableId = `${ID_PREFIX}deletable-${Date.now()}`;
    const deletableUrl = `https://example.com/api-items-del-${Date.now()}`;
    seed(deletableId, deletableUrl, 'Delete me');

    // Confirm it exists before deletion
    const before = await request.get(`${BASE}/items/${deletableId}`);
    expect(before.ok()).toBeTruthy();

    const delRes = await request.delete(`${BASE}/items/${deletableId}`);
    expect(delRes.ok()).toBeTruthy();

    // Confirm individual lookup 404s
    const getRes = await request.get(`${BASE}/items/${deletableId}`);
    expect(getRes.status()).toBe(404);

    // Confirm it's no longer in the /items list
    const listRes = await request.get(`${BASE}/items`);
    expect(listRes.ok()).toBeTruthy();
    const body = await listRes.text();
    // Defensive: ensure we got JSON back, not an HTML shell
    expect(body.trimStart().startsWith('[')).toBe(true);
    const list = JSON.parse(body);
    expect((list as Array<{ id: string }>).some((i) => i.id === deletableId)).toBe(false);
  });
});
