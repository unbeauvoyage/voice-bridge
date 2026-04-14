import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// The CEO wants the processing list in the popup to show only 4 items by
// default, with a "Show N more" toggle revealing the rest. This test pins
// that behavior against the real popup.html + popup.js.

test('processing list shows 4 items with expand toggle when more exist', async ({ page }) => {
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

  // Mock every network endpoint popup.js hits so we get a deterministic
  // processing list of exactly 7 items.
  const processingItems = Array.from({ length: 7 }, (_, i) => ({
    id: `proc-${i + 1}`,
    url: `https://example.com/article-${i + 1}`,
    title: `Processing Article ${i + 1}`,
    status: 'processing',
    created_at: new Date().toISOString(),
  }));

  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await page.route('**/items/recent**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(processingItems),
    }),
  );
  await page.route('**/items?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/tags/pending**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/consider**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"raised":false}' }),
  );
  await page.route('**/status/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"status":"processing"}',
    }),
  );

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

  // Wait until the processing list is populated.
  await expect(page.locator('#processing-list .processing-item').first()).toBeVisible({
    timeout: 10000,
  });

  // Exactly 4 items should be visible by default.
  const visibleItems = page.locator('#processing-list .processing-item:visible');
  await expect(visibleItems).toHaveCount(4);

  // Toggle button should be present and say "Show 3 more".
  const toggle = page.locator('#processing-list .processing-toggle');
  await expect(toggle).toBeVisible();
  await expect(toggle).toContainText('Show 3 more');

  // Click the toggle — all 7 should become visible.
  await toggle.click();
  await expect(page.locator('#processing-list .processing-item:visible')).toHaveCount(7);
  await expect(toggle).toContainText('Show less');
});
