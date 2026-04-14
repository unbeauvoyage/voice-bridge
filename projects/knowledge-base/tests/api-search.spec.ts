import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const BASE = 'http://127.0.0.1:3737';
const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-item.ts');
const ID_PREFIX = 'api-search-test-';
const UNIQUE_TAG = `apisearchtag${Date.now()}`;
const UNIQUE_WORD = `xylophonebanana${Date.now()}`;

test.describe('search endpoint behavior', () => {
  const ITEM_ID = `${ID_PREFIX}${Date.now()}`;
  const ITEM_URL = `https://example.com/api-search-${Date.now()}`;
  const TITLE = `Search fixture ${UNIQUE_WORD}`;

  test.beforeAll(() => {
    execSync(`bun ${SEED_SCRIPT} seed "${ITEM_ID}" "${ITEM_URL}" "${TITLE}" "${UNIQUE_TAG}"`, { timeout: 5000 });
  });

  test.afterAll(() => {
    execSync(`bun ${SEED_SCRIPT} cleanup "${ID_PREFIX}"`, { timeout: 5000 });
  });

  test('GET /search?q=<word> returns items whose title contains that word', async ({ request }) => {
    const res = await request.get(`${BASE}/search?q=${encodeURIComponent(UNIQUE_WORD)}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    expect((body as Array<{ id: string }>).some((i) => i.id === ITEM_ID)).toBe(true);
  });

  test('GET /search?tag=<tag> filters results by tag', async ({ request }) => {
    const res = await request.get(`${BASE}/search?tag=${encodeURIComponent(UNIQUE_TAG)}`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
    const seeded = (body as Array<{ id: string; tags?: string[] }>).find((i) => i.id === ITEM_ID);
    expect(seeded).toBeDefined();
    expect(seeded!.tags).toContain(UNIQUE_TAG);
  });

  test('GET /search results have expected shape', async ({ request }) => {
    const res = await request.get(`${BASE}/search?q=${encodeURIComponent(UNIQUE_WORD)}`);
    const body = await res.json();
    expect(body.length).toBeGreaterThan(0);
    const first = body[0] as Record<string, unknown>;
    expect(typeof first.id).toBe('string');
    expect(typeof first.url).toBe('string');
    expect(typeof first.type).toBe('string');
    expect(typeof first.title).toBe('string');
  });
});
