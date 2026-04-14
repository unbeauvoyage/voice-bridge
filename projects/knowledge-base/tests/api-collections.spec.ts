import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const BASE = 'http://127.0.0.1:3737';
const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-item.ts');
const ID_PREFIX = 'api-collections-test-';

test.describe('collections CRUD', () => {
  const SEEDED_ITEM_ID = `${ID_PREFIX}${Date.now()}`;

  test.beforeAll(() => {
    execSync(
      `bun ${SEED_SCRIPT} seed "${SEEDED_ITEM_ID}" "https://example.com/col-${Date.now()}" "Collections fixture"`,
      { timeout: 5000 }
    );
  });

  test.afterAll(() => {
    execSync(`bun ${SEED_SCRIPT} cleanup "${ID_PREFIX}"`, { timeout: 5000 });
  });

  test('POST /collections creates a collection and returns an id', async ({ request }) => {
    const name = `test-collection-${Date.now()}`;
    const res = await request.post(`${BASE}/collections`, {
      data: { name },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(typeof body.id).toBe('string');
    expect(body.id.length).toBeGreaterThan(0);

    // cleanup
    await request.delete(`${BASE}/collections/${body.id}`);
  });

  test('GET /collections lists a created collection', async ({ request }) => {
    const name = `listable-collection-${Date.now()}`;
    const createRes = await request.post(`${BASE}/collections`, {
      data: { name },
      headers: { 'Content-Type': 'application/json' },
    });
    const { id } = await createRes.json();
    try {
      const listRes = await request.get(`${BASE}/collections`);
      expect(listRes.ok()).toBeTruthy();
      const list = await listRes.json();
      const found = (list as Array<Record<string, unknown>>).find((c) => c.id === id);
      expect(found).toBeDefined();
      expect(found!.name).toBe(name);
    } finally {
      await request.delete(`${BASE}/collections/${id}`);
    }
  });

  test('DELETE /collections/:id removes the collection', async ({ request }) => {
    const createRes = await request.post(`${BASE}/collections`, {
      data: { name: `ephemeral-${Date.now()}` },
      headers: { 'Content-Type': 'application/json' },
    });
    const { id } = await createRes.json();

    const delRes = await request.delete(`${BASE}/collections/${id}`);
    expect(delRes.ok()).toBeTruthy();

    const list = await (await request.get(`${BASE}/collections`)).json();
    expect((list as Array<{ id: string }>).some((c) => c.id === id)).toBe(false);
  });

  test('POST /collections/:id/items adds an item to a collection', async ({ request }) => {
    const createRes = await request.post(`${BASE}/collections`, {
      data: { name: `with-items-${Date.now()}` },
      headers: { 'Content-Type': 'application/json' },
    });
    const { id: collectionId } = await createRes.json();
    try {
      const addRes = await request.post(`${BASE}/collections/${collectionId}/items`, {
        data: { itemId: SEEDED_ITEM_ID },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(addRes.ok()).toBeTruthy();

      const itemsRes = await request.get(`${BASE}/collections/${collectionId}/items`);
      expect(itemsRes.ok()).toBeTruthy();
      const items = await itemsRes.json();
      expect(Array.isArray(items)).toBe(true);
      expect((items as Array<{ id: string }>).some((i) => i.id === SEEDED_ITEM_ID)).toBe(true);
    } finally {
      await request.delete(`${BASE}/collections/${collectionId}`);
    }
  });

  test('POST /collections rejects duplicate collection names', async ({ request }) => {
    const name = `dup-name-${Date.now()}`;
    const first = await request.post(`${BASE}/collections`, {
      data: { name },
      headers: { 'Content-Type': 'application/json' },
    });
    expect(first.ok()).toBeTruthy();
    const { id } = await first.json();
    try {
      const second = await request.post(`${BASE}/collections`, {
        data: { name },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(second.status()).toBe(409);
    } finally {
      await request.delete(`${BASE}/collections/${id}`);
    }
  });
});
