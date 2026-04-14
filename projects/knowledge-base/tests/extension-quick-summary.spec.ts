import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Pins the "You've saved this page" quick-summary card: it must appear when
// the current tab URL matches a saved item and stay hidden otherwise.

async function loadPopupWithUrl(
  page: import('@playwright/test').Page,
  tabUrl: string,
) {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  await page.addInitScript((url) => {
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url }],
        create: (_: unknown) => {},
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

test('quick summary card appears when current tab URL matches a saved item', async ({ page, request }) => {
  let items: Array<{ status: string; url: string; title: string }> = [];
  for (let i = 0; i < 5; i++) {
    const r = await request.get('http://127.0.0.1:3737/items');
    if (r.ok()) {
      items = (await r.json()) as Array<{ status: string; url: string; title: string }>;
      break;
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  expect(items.length).toBeGreaterThan(0);
  const match = items.find(
    (i) => i.status === 'done' && i.url && i.url.startsWith('http') && i.title,
  );
  if (!match) throw new Error('No saved done item with http URL');

  await loadPopupWithUrl(page, match.url);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const card = page.locator('#quick-summary-card');
  await expect(card).not.toHaveClass(/hidden/, { timeout: 5000 });
  await expect(page.locator('#quick-summary-title')).toHaveText(match.title);
});

test('quick summary card stays hidden when current tab URL is not saved', async ({ page }) => {
  const uniqueUrl = `https://example.com/definitely-not-saved-${Date.now()}`;
  await loadPopupWithUrl(page, uniqueUrl);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // Give any late render a moment — loadAllItems finishes, then
  // renderQuickSummaryForCurrentUrl runs. The card should remain hidden.
  await page.waitForTimeout(500);
  await expect(page.locator('#quick-summary-card')).toHaveClass(/hidden/);
});
