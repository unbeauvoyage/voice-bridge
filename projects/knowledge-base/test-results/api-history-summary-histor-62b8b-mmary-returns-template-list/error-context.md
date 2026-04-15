# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: api-history.spec.ts >> summary history and prompt templates >> GET /prompt-templates/summary returns template list
- Location: tests/api-history.spec.ts:49:3

# Error details

```
Error: expect(received).toBeTruthy()

Received: false
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | import { execSync } from 'child_process';
  3  | import { fileURLToPath } from 'url';
  4  | import * as path from 'path';
  5  | 
  6  | const BASE = 'http://127.0.0.1:3737';
  7  | const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-item.ts');
  8  | const ID_PREFIX = 'api-history-test-';
  9  | 
  10 | test.describe('summary history and prompt templates', () => {
  11 |   const ITEM_ID = `${ID_PREFIX}${Date.now()}`;
  12 |   const ITEM_URL = `https://example.com/api-history-${Date.now()}`;
  13 |   const MODEL = 'history-test-model';
  14 | 
  15 |   test.beforeAll(() => {
  16 |     execSync(`bun ${SEED_SCRIPT} seed "${ITEM_ID}" "${ITEM_URL}" "History fixture"`, { timeout: 5000 });
  17 |     execSync(`bun ${SEED_SCRIPT} seed-history "${ITEM_ID}" "${MODEL}"`, { timeout: 5000 });
  18 |   });
  19 | 
  20 |   test.afterAll(() => {
  21 |     execSync(`bun ${SEED_SCRIPT} cleanup "${ID_PREFIX}"`, { timeout: 5000 });
  22 |   });
  23 | 
  24 |   test('GET /items/:id/history returns versions array', async ({ request }) => {
  25 |     const res = await request.get(`${BASE}/items/${ITEM_ID}/history`);
  26 |     expect(res.ok()).toBeTruthy();
  27 |     const body = await res.json();
  28 |     expect(Array.isArray(body)).toBe(true);
  29 |     expect(body.length).toBeGreaterThan(0);
  30 |   });
  31 | 
  32 |   test('history version has model and createdAt fields', async ({ request }) => {
  33 |     const res = await request.get(`${BASE}/items/${ITEM_ID}/history`);
  34 |     const body = await res.json();
  35 |     const version = body[0] as Record<string, unknown>;
  36 |     expect(typeof version.id).toBe('number');
  37 |     expect(typeof version.summary).toBe('string');
  38 |     expect(Array.isArray(version.tldr)).toBe(true);
  39 |     expect(Array.isArray(version.sections)).toBe(true);
  40 |     expect(version.model).toBe(MODEL);
  41 |     expect(typeof version.createdAt).toBe('string');
  42 |   });
  43 | 
  44 |   test('GET /items/:id/history returns 404 for unknown item', async ({ request }) => {
  45 |     const res = await request.get(`${BASE}/items/nonexistent-history-xyz/history`);
  46 |     expect(res.status()).toBe(404);
  47 |   });
  48 | 
  49 |   test('GET /prompt-templates/summary returns template list', async ({ request }) => {
  50 |     const res = await request.get(`${BASE}/prompt-templates/summary`);
> 51 |     expect(res.ok()).toBeTruthy();
     |                      ^ Error: expect(received).toBeTruthy()
  52 |     const body = await res.json();
  53 |     expect(Array.isArray(body)).toBe(true);
  54 |     // May be empty on a fresh DB — shape check on any present entry
  55 |     for (const t of body as Array<Record<string, unknown>>) {
  56 |       expect(typeof t.id).toBe('number');
  57 |       expect(typeof t.template).toBe('string');
  58 |     }
  59 |   });
  60 | 
  61 |   test('GET /prompt-templates/chat returns template list', async ({ request }) => {
  62 |     const res = await request.get(`${BASE}/prompt-templates/chat`);
  63 |     expect(res.ok()).toBeTruthy();
  64 |     const body = await res.json();
  65 |     expect(Array.isArray(body)).toBe(true);
  66 |     for (const t of body as Array<Record<string, unknown>>) {
  67 |       expect(typeof t.id).toBe('number');
  68 |       expect(typeof t.template).toBe('string');
  69 |     }
  70 |   });
  71 | });
  72 | 
```