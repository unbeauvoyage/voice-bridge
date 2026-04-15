# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bulk-retry.spec.ts >> POST /items/retry-failed returns the queued count
- Location: tests/bulk-retry.spec.ts:87:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "number"
Received: "undefined"
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { spawnSync } from 'node:child_process';
  3   | import { dirname, join } from 'node:path';
  4   | import { fileURLToPath } from 'node:url';
  5   | 
  6   | const BASE = 'http://127.0.0.1:3737';
  7   | const __filename = fileURLToPath(import.meta.url);
  8   | const __dirnameLocal = dirname(__filename);
  9   | const ROOT = join(__dirnameLocal, '..');
  10  | const DB_PATH = join(ROOT, 'knowledge', 'knowledge.db');
  11  | 
  12  | // Helpers --------------------------------------------------------------------
  13  | 
  14  | function seedErrorItems(urls: string[]): string[] {
  15  |   // Insert items directly into knowledge.db with status='error'. This skips
  16  |   // the queue entirely so we never race against background processing, and
  17  |   // Ollama does not have to be running for the test to pass.
  18  |   const ids = urls.map((_, i) => `test-bulk-retry-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`);
  19  |   // Use an ISO timestamp far in the future so the seeded rows always sort as
  20  |   // the newest in /items/recent (which orders by date_added DESC).
  21  |   const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  22  |   const rows = urls.map((url, i) => ({ id: ids[i], url, dateAdded: future }));
  23  |   const script = `
  24  |     const { Database } = require('bun:sqlite');
  25  |     const db = new Database(${JSON.stringify(DB_PATH)});
  26  |     db.exec("PRAGMA busy_timeout = 5000");
  27  |     const insert = db.prepare("INSERT INTO items (id, url, type, status, error, date_added, retries) VALUES (?, ?, 'web', 'error', 'seeded test failure', ?, 99)");
  28  |     for (const row of ${JSON.stringify(rows)}) insert.run(row.id, row.url, row.dateAdded);
  29  |     db.close();
  30  |   `;
  31  |   const result = spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  32  |   if (result.status !== 0) {
  33  |     throw new Error(`seedErrorItems failed: ${result.stderr || result.stdout}`);
  34  |   }
  35  |   return ids;
  36  | }
  37  | 
  38  | function deleteByIds(ids: string[]) {
  39  |   const script = `
  40  |     const { Database } = require('bun:sqlite');
  41  |     const db = new Database(${JSON.stringify(DB_PATH)});
  42  |     db.exec("PRAGMA busy_timeout = 5000");
  43  |     const del = db.prepare("DELETE FROM items WHERE id = ?");
  44  |     for (const id of ${JSON.stringify(ids)}) del.run(id);
  45  |     db.close();
  46  |   `;
  47  |   spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  48  | }
  49  | 
  50  | // ----------------------------------------------------------------------------
  51  | // Capability: the user can requeue all failed items with a single call.
  52  | // ----------------------------------------------------------------------------
  53  | 
  54  | test('POST /items/retry-failed requeues all error items', async ({ request }) => {
  55  |   const tag = Date.now();
  56  |   const urls = [
  57  |     `https://example.com/bulk-retry-a-${tag}`,
  58  |     `https://example.com/bulk-retry-b-${tag}`,
  59  |   ];
  60  |   const ids = seedErrorItems(urls);
  61  | 
  62  |   try {
  63  |     // Sanity: both items are in 'error' state
  64  |     for (const id of ids) {
  65  |       const res = await request.get(`${BASE}/status/${id}`);
  66  |       const body = await res.json();
  67  |       expect(body.status).toBe('error');
  68  |     }
  69  | 
  70  |     const retryRes = await request.post(`${BASE}/items/retry-failed`);
  71  |     if (!retryRes.ok()) {
  72  |       throw new Error(`retry-failed returned ${retryRes.status()}: ${await retryRes.text()}`);
  73  |     }
  74  | 
  75  |     // After retry, neither item should still be in 'error' state —
  76  |     // either queued, processing, or done (the real queue may pick them up).
  77  |     for (const id of ids) {
  78  |       const res = await request.get(`${BASE}/status/${id}`);
  79  |       const body = await res.json();
  80  |       expect(body.status).not.toBe('error');
  81  |     }
  82  |   } finally {
  83  |     deleteByIds(ids);
  84  |   }
  85  | });
  86  | 
  87  | test('POST /items/retry-failed returns the queued count', async ({ request }) => {
  88  |   const tag = Date.now() + 1;
  89  |   const urls = [
  90  |     `https://example.com/bulk-retry-count-a-${tag}`,
  91  |     `https://example.com/bulk-retry-count-b-${tag}`,
  92  |     `https://example.com/bulk-retry-count-c-${tag}`,
  93  |   ];
  94  |   const ids = seedErrorItems(urls);
  95  | 
  96  |   try {
  97  |     const res = await request.post(`${BASE}/items/retry-failed`);
  98  |     expect(res.ok()).toBeTruthy();
  99  |     const body = await res.json() as { queued: number };
> 100 |     expect(typeof body.queued).toBe('number');
      |                                ^ Error: expect(received).toBe(expected) // Object.is equality
  101 |     // At least our three seeded errors must be in the count. Other pre-existing
  102 |     // error rows in the running DB may inflate this — that's fine.
  103 |     expect(body.queued).toBeGreaterThanOrEqual(urls.length);
  104 |   } finally {
  105 |     deleteByIds(ids);
  106 |   }
  107 | });
  108 | 
  109 | test('Retry all failed button appears when error items exist', async ({ page }) => {
  110 |   const tag = Date.now() + 2;
  111 |   const url = `https://example.com/bulk-retry-ui-${tag}`;
  112 |   const ids = seedErrorItems([url]);
  113 | 
  114 |   try {
  115 |     await page.goto(BASE);
  116 | 
  117 |     // Open the queue panel via the processing indicator button
  118 |     const queueToggle = page.locator('[data-testid="queue-toggle"]');
  119 |     await expect(queueToggle).toBeVisible({ timeout: 10_000 });
  120 |     // Allow the initial refreshQueueLog() call to populate the log
  121 |     await page.waitForTimeout(500);
  122 |     await queueToggle.click();
  123 | 
  124 |     await expect(page.locator('.queue-panel')).toBeVisible({ timeout: 5000 });
  125 | 
  126 |     const retryAllBtn = page.locator('[data-testid="retry-all-failed"]');
  127 |     await expect(retryAllBtn).toBeVisible({ timeout: 5000 });
  128 |     await expect(retryAllBtn).toContainText(/Retry all failed/i);
  129 |   } finally {
  130 |     deleteByIds(ids);
  131 |   }
  132 | });
  133 | 
```