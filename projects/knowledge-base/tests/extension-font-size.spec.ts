import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Pins the popup font-size control: the A-small / A-large buttons step
// through FONT_SIZE_STEPS, update --font-size on <html>, update the label,
// and persist the preference to chrome.storage.local.

async function loadPopupCapturingStorage(page: import('@playwright/test').Page) {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  await page.addInitScript(() => {
    (window as any).__storageSets = [];
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (v: Record<string, unknown>, cb?: () => void) => {
            (window as any).__storageSets.push(v);
            if (cb) cb();
          },
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com/font-test' }],
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
}

async function getFontSize(page: import('@playwright/test').Page): Promise<number> {
  return page.evaluate(() => {
    const v = document.documentElement.style.getPropertyValue('--font-size');
    return parseInt(v, 10);
  });
}

test('font size decrease button reduces the CSS variable', async ({ page }) => {
  await loadPopupCapturingStorage(page);
  await expect(page.locator('#items-list')).toBeVisible({ timeout: 10000 });

  const before = await getFontSize(page);
  expect(before).toBe(15); // default

  await page.locator('#font-size-decrease').click();
  const after = await getFontSize(page);
  expect(after).toBeLessThan(before);
  expect(after).toBe(14);

  await expect(page.locator('#font-size-label')).toHaveText('14px');
});

test('font size increase button grows the CSS variable', async ({ page }) => {
  await loadPopupCapturingStorage(page);
  await expect(page.locator('#items-list')).toBeVisible({ timeout: 10000 });

  const before = await getFontSize(page);
  expect(before).toBe(15);

  await page.locator('#font-size-increase').click();
  const after = await getFontSize(page);
  expect(after).toBeGreaterThan(before);
  expect(after).toBe(16);

  await expect(page.locator('#font-size-label')).toHaveText('16px');
});

test('font size preference is persisted to chrome.storage.local', async ({ page }) => {
  await loadPopupCapturingStorage(page);
  await expect(page.locator('#items-list')).toBeVisible({ timeout: 10000 });

  await page.locator('#font-size-increase').click();
  await page.locator('#font-size-increase').click();

  const sets = await page.evaluate(() => (window as any).__storageSets as Array<Record<string, unknown>>);
  const fontSizeSets = sets.filter((s) => 'fontSizePreference' in s);
  expect(fontSizeSets.length).toBeGreaterThanOrEqual(2);
  // Most recent write should match the final on-screen value.
  const final = fontSizeSets[fontSizeSets.length - 1]!;
  expect(final.fontSizePreference).toBe(17);
});
