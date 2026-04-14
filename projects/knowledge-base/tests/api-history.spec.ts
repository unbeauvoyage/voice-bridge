import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const BASE = 'http://127.0.0.1:3737';
const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-item.ts');
const ID_PREFIX = 'api-history-test-';

test.describe('summary history and prompt templates', () => {
  const ITEM_ID = `${ID_PREFIX}${Date.now()}`;
  const ITEM_URL = `https://example.com/api-history-${Date.now()}`;
  const MODEL = 'history-test-model';

  test.beforeAll(() => {
    execSync(`bun ${SEED_SCRIPT} seed "${ITEM_ID}" "${ITEM_URL}" "History fixture"`, { timeout: 5000 });
    execSync(`bun ${SEED_SCRIPT} seed-history "${ITEM_ID}" "${MODEL}"`, { timeout: 5000 });
  });

  test.afterAll(() => {
    execSync(`bun ${SEED_SCRIPT} cleanup "${ID_PREFIX}"`, { timeout: 5000 });
  });

  test('GET /items/:id/history returns versions array', async ({ request }) => {
    const res = await request.get(`${BASE}/items/${ITEM_ID}/history`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    expect(body.length).toBeGreaterThan(0);
  });

  test('history version has model and createdAt fields', async ({ request }) => {
    const res = await request.get(`${BASE}/items/${ITEM_ID}/history`);
    const body = await res.json();
    const version = body[0] as Record<string, unknown>;
    expect(typeof version.id).toBe('number');
    expect(typeof version.summary).toBe('string');
    expect(Array.isArray(version.tldr)).toBe(true);
    expect(Array.isArray(version.sections)).toBe(true);
    expect(version.model).toBe(MODEL);
    expect(typeof version.createdAt).toBe('string');
  });

  test('GET /items/:id/history returns 404 for unknown item', async ({ request }) => {
    const res = await request.get(`${BASE}/items/nonexistent-history-xyz/history`);
    expect(res.status()).toBe(404);
  });

  test('GET /prompt-templates/summary returns template list', async ({ request }) => {
    const res = await request.get(`${BASE}/prompt-templates/summary`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    // May be empty on a fresh DB — shape check on any present entry
    for (const t of body as Array<Record<string, unknown>>) {
      expect(typeof t.id).toBe('number');
      expect(typeof t.template).toBe('string');
    }
  });

  test('GET /prompt-templates/chat returns template list', async ({ request }) => {
    const res = await request.get(`${BASE}/prompt-templates/chat`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json();
    expect(Array.isArray(body)).toBe(true);
    for (const t of body as Array<Record<string, unknown>>) {
      expect(typeof t.id).toBe('number');
      expect(typeof t.template).toBe('string');
    }
  });
});
