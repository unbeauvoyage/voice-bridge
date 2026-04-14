import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');
const ROOT = resolve(__dirname, '..');
const DB_PATH = join(ROOT, 'knowledge', 'knowledge.db');

// Seed a dedicated done item that sorts to the top of GET /items so popup.js
// will render it first. Using a dedicated seeded item instead of mutating the
// first real item prevents races with raise-web.spec.ts running in parallel.
function seedTopDoneItem(): string {
  const id = `test-raise-popup-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const url = `https://example.com/raise-popup-${id}`;
  const future = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
  const script = `
    const { Database } = require('bun:sqlite');
    const db = new Database(${JSON.stringify(DB_PATH)});
    db.exec("PRAGMA busy_timeout = 5000");
    db.prepare(\`INSERT INTO items (id, url, type, title, status, summary, date_added, retries)
                VALUES (?, ?, 'web', 'Raise Popup Test Item', 'done', 'seeded for raise-popup test', ?, 0)\`)
      .run(${JSON.stringify(id)}, ${JSON.stringify(url)}, ${JSON.stringify(future)});
    db.close();
  `;
  const result = spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`seedTopDoneItem failed: ${result.stderr || result.stdout}`);
  }
  return id;
}

function deletePopupItem(id: string): void {
  const script = `
    const { Database } = require('bun:sqlite');
    const db = new Database(${JSON.stringify(DB_PATH)});
    db.exec("PRAGMA busy_timeout = 5000");
    db.prepare("DELETE FROM considerations WHERE item_id = ?").run(${JSON.stringify(id)});
    db.prepare("DELETE FROM items WHERE id = ?").run(${JSON.stringify(id)});
    db.close();
  `;
  spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
}

// Serialize tests in this file — they share global DB state (raising items)
// and race with other parallel test files that POST /process.
test.describe.configure({ mode: 'serial' });

// This test loads the REAL extension popup.html (with its real popup.js)
// against the running server, stubbing just enough of the chrome.* API that
// popup.js's init() can run. It exercises the bug the CEO reported: clicking
// the 🚩 raise button in the items list must actually show the inline form.

test('clicking the raise button injects an inline form into the items list', async ({ page }) => {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');

  // Stub chrome.* BEFORE popup.js runs.
  await page.addInitScript(() => {
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com' }],
        create: (_: unknown) => {},
      },
    };
  });

  // Serve the popup HTML from the test server's origin so fetch() calls to
  // http://127.0.0.1:3737 are same-origin-ish (the test uses absolute URLs
  // which will work cross-origin to the dev server anyway).
  // Simplest path: set content directly, rewriting the <script src> to absolute
  // file URLs so the real files load.
  const rewritten = popupHtml
    .replace(
      '<script src="raise-form.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
    )
    .replace(
      '<script src="popup.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
    );

  // Capture console logs/errors from the popup.
  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto('http://127.0.0.1:3737/health'); // establish an origin
  await page.setContent(rewritten, { waitUntil: 'load' });

  // Wait for items list to populate (popup.js loads from real server).
  const firstItem = page.locator('#items-list .item').first();
  await expect(firstItem).toBeVisible({ timeout: 10000 });

  // Let the per-item GET /consider state checks finish before clicking, so
  // the raised-state class is settled on already-raised items.
  await page.waitForTimeout(1500);
  // Click the very first raise button regardless of raised state — clicking
  // a raised item must still show the form (that's the bug we're fixing).
  const raiseBtn = firstItem.locator('.raise-btn');
  await expect(raiseBtn).toBeVisible();
  await raiseBtn.click();

  // The form must appear.
  const form = page.locator('.raise-form');
  if ((await form.count()) === 0) {
    console.log('POPUP CONSOLE OUTPUT:');
    for (const l of logs) console.log(l);
  }
  await expect(form).toHaveCount(1);
  await expect(form).toBeVisible();

  // The textarea must exist and be focusable.
  const textarea = form.locator('.raise-note');
  await expect(textarea).toBeVisible();
  await textarea.fill('test note from the CEO');
  await expect(textarea).toHaveValue('test note from the CEO');
});

test('clicking an already-raised button still opens the form (not disabled)', async ({ page, request }) => {
  // Seed a dedicated done item (sorts to top of /items via future date) and
  // raise it. This avoids racing with other specs that mutate "first item".
  const seedId = seedTopDoneItem();
  await request.post(`http://127.0.0.1:3737/items/${seedId}/consider`, {
    data: { note: 'raised by raise-popup test' },
    headers: { 'Content-Type': 'application/json' },
  });

  // Root cause of the CEO's bug: popup.js was setting `btn.disabled = true`
  // on already-raised items. Disabled buttons silently swallow clicks, so to
  // the CEO it looked like "the form isn't showing up". This test pins the
  // fix: the raised-state button must remain clickable and open the form.
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');

  await page.addInitScript(() => {
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com' }],
        create: (_: unknown) => {},
      },
    };
  });

  const rewritten = popupHtml
    .replace(
      '<script src="raise-form.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
    )
    .replace(
      '<script src="popup.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
    );

  await page.goto('http://127.0.0.1:3737/health');
  await page.setContent(rewritten, { waitUntil: 'load' });
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // Find a raised button — we seeded one above, so this must exist after the
  // popup's per-item GET /consider fetches complete.
  const raisedBtn = page.locator('.raise-btn.raised').first();
  await expect(raisedBtn).toBeVisible({ timeout: 15000 });

  // The button must NOT be disabled — regression guard.
  const disabled = await raisedBtn.getAttribute('disabled');
  expect(disabled).toBeNull();

  await raisedBtn.click();
  await expect(page.locator('.raise-form')).toHaveCount(1);
  await expect(page.locator('.raise-form .raise-note')).toBeVisible();

  // Cleanup: delete the seeded item (also removes its consideration row).
  deletePopupItem(seedId);
});

