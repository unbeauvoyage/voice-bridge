import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:3737';
const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const ROOT = join(__dirnameLocal, '..');
const DB_PATH = join(ROOT, 'knowledge', 'knowledge.db');

// Helpers --------------------------------------------------------------------

function seedErrorItems(urls: string[]): string[] {
  // Insert items directly into knowledge.db with status='error'. This skips
  // the queue entirely so we never race against background processing, and
  // Ollama does not have to be running for the test to pass.
  const ids = urls.map((_, i) => `test-bulk-retry-${Date.now()}-${i}-${Math.random().toString(36).slice(2, 7)}`);
  // Use an ISO timestamp far in the future so the seeded rows always sort as
  // the newest in /items/recent (which orders by date_added DESC).
  const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  const rows = urls.map((url, i) => ({ id: ids[i], url, dateAdded: future }));
  const script = `
    const { Database } = require('bun:sqlite');
    const db = new Database(${JSON.stringify(DB_PATH)});
    db.exec("PRAGMA busy_timeout = 5000");
    const insert = db.prepare("INSERT INTO items (id, url, type, status, error, date_added, retries) VALUES (?, ?, 'web', 'error', 'seeded test failure', ?, 99)");
    for (const row of ${JSON.stringify(rows)}) insert.run(row.id, row.url, row.dateAdded);
    db.close();
  `;
  const result = spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`seedErrorItems failed: ${result.stderr || result.stdout}`);
  }
  return ids;
}

function deleteByIds(ids: string[]) {
  const script = `
    const { Database } = require('bun:sqlite');
    const db = new Database(${JSON.stringify(DB_PATH)});
    db.exec("PRAGMA busy_timeout = 5000");
    const del = db.prepare("DELETE FROM items WHERE id = ?");
    for (const id of ${JSON.stringify(ids)}) del.run(id);
    db.close();
  `;
  spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
}

// ----------------------------------------------------------------------------
// Capability: the user can requeue all failed items with a single call.
// ----------------------------------------------------------------------------

test('POST /items/retry-failed requeues all error items', async ({ request }) => {
  const tag = Date.now();
  const urls = [
    `https://example.com/bulk-retry-a-${tag}`,
    `https://example.com/bulk-retry-b-${tag}`,
  ];
  const ids = seedErrorItems(urls);

  try {
    // Sanity: both items are in 'error' state
    for (const id of ids) {
      const res = await request.get(`${BASE}/status/${id}`);
      const body = await res.json();
      expect(body.status).toBe('error');
    }

    const retryRes = await request.post(`${BASE}/items/retry-failed`);
    if (!retryRes.ok()) {
      throw new Error(`retry-failed returned ${retryRes.status()}: ${await retryRes.text()}`);
    }

    // After retry, neither item should still be in 'error' state —
    // either queued, processing, or done (the real queue may pick them up).
    for (const id of ids) {
      const res = await request.get(`${BASE}/status/${id}`);
      const body = await res.json();
      expect(body.status).not.toBe('error');
    }
  } finally {
    deleteByIds(ids);
  }
});

test('POST /items/retry-failed returns the queued count', async ({ request }) => {
  const tag = Date.now() + 1;
  const urls = [
    `https://example.com/bulk-retry-count-a-${tag}`,
    `https://example.com/bulk-retry-count-b-${tag}`,
    `https://example.com/bulk-retry-count-c-${tag}`,
  ];
  const ids = seedErrorItems(urls);

  try {
    const res = await request.post(`${BASE}/items/retry-failed`);
    expect(res.ok()).toBeTruthy();
    const body = await res.json() as { queued: number };
    expect(typeof body.queued).toBe('number');
    // At least our three seeded errors must be in the count. Other pre-existing
    // error rows in the running DB may inflate this — that's fine.
    expect(body.queued).toBeGreaterThanOrEqual(urls.length);
  } finally {
    deleteByIds(ids);
  }
});

test('Retry all failed button appears when error items exist', async ({ page }) => {
  const tag = Date.now() + 2;
  const url = `https://example.com/bulk-retry-ui-${tag}`;
  const ids = seedErrorItems([url]);

  try {
    await page.goto(BASE);

    // Open the queue panel via the processing indicator button
    const queueToggle = page.locator('[data-testid="queue-toggle"]');
    await expect(queueToggle).toBeVisible({ timeout: 10_000 });
    // Allow the initial refreshQueueLog() call to populate the log
    await page.waitForTimeout(500);
    await queueToggle.click();

    await expect(page.locator('.queue-panel')).toBeVisible({ timeout: 5000 });

    const retryAllBtn = page.locator('[data-testid="retry-all-failed"]');
    await expect(retryAllBtn).toBeVisible({ timeout: 5000 });
    await expect(retryAllBtn).toContainText(/Retry all failed/i);
  } finally {
    deleteByIds(ids);
  }
});
