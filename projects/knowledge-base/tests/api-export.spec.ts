import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const BASE = 'http://127.0.0.1:3737';
const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-item.ts');
const ID_PREFIX = 'api-export-test-';

test.describe('export endpoints', () => {
  const ITEM_ID = `${ID_PREFIX}${Date.now()}`;
  const ITEM_URL = `https://example.com/api-export-${Date.now()}`;
  const TITLE = 'Export fixture';

  test.beforeAll(() => {
    execSync(`bun ${SEED_SCRIPT} seed "${ITEM_ID}" "${ITEM_URL}" "${TITLE}"`, { timeout: 5000 });
  });

  test.afterAll(() => {
    execSync(`bun ${SEED_SCRIPT} cleanup "${ID_PREFIX}"`, { timeout: 5000 });
  });

  test('GET /export/json includes seeded done item with full shape', async ({ request }) => {
    const res = await request.get(`${BASE}/export/json`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);

    const seeded = (body as Array<Record<string, unknown>>).find((i) => i.id === ITEM_ID);
    expect(seeded).toBeDefined();
    expect(seeded!.url).toBe(ITEM_URL);
    expect(seeded!.title).toBe(TITLE);
    expect(Array.isArray(seeded!.tldr)).toBe(true);
    expect(Array.isArray(seeded!.sections)).toBe(true);
  });

  test('GET /export/json sets attachment content-disposition header', async ({ request }) => {
    const res = await request.get(`${BASE}/export/json`);
    expect(res.ok()).toBeTruthy();
    const disposition = res.headers()['content-disposition'];
    expect(disposition).toContain('attachment');
    expect(disposition).toContain('knowledge-base-');
    expect(disposition).toContain('.json');
  });

  test('GET /export/markdown returns a markdown document containing seeded title', async ({ request }) => {
    const res = await request.get(`${BASE}/export/markdown`);
    expect(res.ok()).toBeTruthy();
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/markdown');
    const text = await res.text();
    expect(text.length).toBeGreaterThan(0);
    expect(text).toContain(TITLE);
    expect(text).toContain(ITEM_URL);
  });

  test('GET /items/:id/export/markdown returns markdown for a single item', async ({ request }) => {
    const res = await request.get(`${BASE}/items/${ITEM_ID}/export/markdown`);
    expect(res.ok()).toBeTruthy();
    const contentType = res.headers()['content-type'] ?? '';
    expect(contentType).toContain('text/markdown');
    const text = await res.text();
    expect(text).toContain(TITLE);
    expect(text).toContain(ITEM_URL);
    // Sections header from our seeded sections
    expect(text).toMatch(/Key Points|Summary|TL;DR/);
  });
});
