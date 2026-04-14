import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Pins the save button behavior: POSTing to /process with the current tab URL,
// showing the "already saved" banner for duplicates, and hiding the save
// button once a duplicate is detected.

async function loadPopupWithUrl(
  page: import('@playwright/test').Page,
  tabUrl: string,
) {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  await page.addInitScript((url) => {
    (window as any).__tabCreates = [];
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url }],
        create: (opts: { url?: string }) => {
          (window as any).__tabCreates.push(opts?.url || '');
        },
      },
    };
  }, tabUrl);
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
}

test('save button submits current tab URL to /process', async ({ page, request }) => {
  const uniqueUrl = `https://example.com/save-flow-test-${Date.now()}`;

  // Capture outbound /process calls from the popup.
  const processCalls: string[] = [];
  await page.route('**/process', async (route) => {
    if (route.request().method() === 'POST') {
      processCalls.push(route.request().postData() || '');
    }
    await route.continue();
  });

  await loadPopupWithUrl(page, uniqueUrl);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const saveBtn = page.locator('#save-btn');
  await expect(saveBtn).toBeVisible();
  await saveBtn.click();

  await expect.poll(() => processCalls.length, { timeout: 5000 }).toBeGreaterThan(0);
  const payload = JSON.parse(processCalls[0]!);
  expect(payload.url).toBe(uniqueUrl);

  // The real server accepted it, so cleanup: delete what we just created.
  const check = await request.get(`http://127.0.0.1:3737/items/check?url=${encodeURIComponent(uniqueUrl)}`);
  if (check.ok()) {
    const data = (await check.json()) as { exists?: boolean; id?: string };
    if (data.exists && data.id) {
      await request.delete(`http://127.0.0.1:3737/items/${encodeURIComponent(data.id)}`);
    }
  }
});

test('duplicate URL shows already-saved banner and hides the save button', async ({ page, request }) => {
  // Find a real saved URL from the DB so the duplicate check is genuine.
  let items: Array<{ status: string; url: string }> = [];
  for (let i = 0; i < 5; i++) {
    const r = await request.get('http://127.0.0.1:3737/items');
    if (r.ok()) { items = (await r.json()) as Array<{ status: string; url: string }>; break; }
    await new Promise((res) => setTimeout(res, 300));
  }
  expect(items.length).toBeGreaterThan(0);
  const existing = items.find((i) => i.status === 'done' && i.url?.startsWith('http'));
  if (!existing) throw new Error('No existing done item with http URL in DB');

  await loadPopupWithUrl(page, existing.url);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const banner = page.locator('#duplicate-banner');
  await expect(banner).toBeVisible({ timeout: 5000 });
  await expect(banner).not.toHaveClass(/hidden/);

  const bannerText = page.locator('#duplicate-banner-text');
  await expect(bannerText).toContainText(/Already saved|Currently being processed|Summarization failed/);

  // Save button hidden once duplicate is detected.
  await expect(page.locator('#save-btn')).toHaveClass(/hidden/);
});
