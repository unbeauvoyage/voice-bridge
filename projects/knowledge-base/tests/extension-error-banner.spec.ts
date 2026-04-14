import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Regression test: when checkDuplicate() sees a previously-processed URL whose
// status is "error", the duplicate banner must indicate failure — NOT say
// "Already saved" (the item is not saved; it errored out).
test('error status shows failure message not already-saved', async ({ page }) => {
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
        query: async () => [{ url: 'https://example.com/broken-article' }],
        create: (_: unknown) => {},
      },
    };
  });

  // Intercept the /items/check call and return an errored record for the
  // current tab URL. Let everything else pass through to the real server so
  // init() can finish rendering.
  await page.route('**/items/check**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        exists: true,
        id: 'err-1',
        status: 'error',
        title: '',
      }),
    });
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

  const banner = page.locator('#duplicate-banner');
  await expect(banner).toBeVisible({ timeout: 5000 });

  const bannerText = await page.locator('#duplicate-banner-text').textContent();
  if (!bannerText) {
    console.log('POPUP CONSOLE OUTPUT:');
    for (const l of logs) console.log(l);
  }
  expect(bannerText ?? '').not.toContain('Already saved');
  expect((bannerText ?? '').toLowerCase()).toMatch(/fail|error|retry/);
});
