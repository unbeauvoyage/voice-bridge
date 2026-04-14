import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// This test pins the CEO bug: clicking an article title in the extension popup
// used to open a new browser tab (chrome.tabs.create). It must instead open the
// in-extension Read modal. Also verifies the modal has a "Read in app" button.

test('clicking article title opens in-extension modal', async ({ page }) => {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');

  const tabCreates: string[] = [];
  await page.addInitScript(() => {
    (window as any).__tabCreates = [];
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com' }],
        create: (opts: { url?: string }) => {
          (window as any).__tabCreates.push(opts?.url || '');
        },
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

  const logs: string[] = [];
  page.on('console', (msg) => logs.push(`[${msg.type()}] ${msg.text()}`));
  page.on('pageerror', (err) => logs.push(`[pageerror] ${err.message}`));

  await page.goto('http://127.0.0.1:3737/health');
  await page.setContent(rewritten, { waitUntil: 'load' });

  const firstItem = page.locator('#items-list .item').first();
  await expect(firstItem).toBeVisible({ timeout: 10000 });

  // Clicking the title must NOT create a new tab — it must open the modal.
  const title = firstItem.locator('.item-title');
  await expect(title).toBeVisible();
  await title.click();

  const overlay = page.locator('#modal-overlay');
  await expect(overlay).toHaveClass(/visible/, { timeout: 5000 });

  // No new tab was opened as a side effect of the title click.
  const createdTabs = await page.evaluate(() => (window as any).__tabCreates as string[]);
  expect(createdTabs.length).toBe(0);

  // The modal must expose a "Read in app" button that opens the web app tab.
  const readInApp = page.locator('#modal-read-in-app');
  await expect(readInApp).toBeVisible();
  await readInApp.click();

  const afterClick = await page.evaluate(() => (window as any).__tabCreates as string[]);
  expect(afterClick.length).toBe(1);
  expect(afterClick[0]).toContain('/?item=');
});
