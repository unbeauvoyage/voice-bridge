import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Guards the search history dropdown in the extension:
// - After prior searches, focusing the empty search input shows a dropdown
// - Clicking a history item fills the search input and dismisses the dropdown
// - "Clear history" removes all entries

async function loadPopupWithHistory(
  page: import('@playwright/test').Page,
  history: string[],
) {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  await page.addInitScript((hist) => {
    (window as any).chrome = {
      storage: {
        local: {
          _data: { searchHistory: hist } as Record<string, unknown>,
          get(keys: string | string[], cb: (v: Record<string, unknown>) => void) {
            const result: Record<string, unknown> = {};
            const ks = Array.isArray(keys) ? keys : [keys];
            for (const k of ks) {
              if (k in (this as any)._data) result[k] = (this as any)._data[k];
            }
            cb(result);
          },
          set(vals: Record<string, unknown>, cb?: () => void) {
            Object.assign((this as any)._data, vals);
            cb?.();
          },
          remove(key: string, cb?: () => void) {
            delete (this as any)._data[key];
            cb?.();
          },
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com/test' }],
        create: (_: unknown) => {},
      },
    };
  }, history);

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

test('search history appears in extension search dropdown after prior searches', async ({ page }) => {
  const priorSearches = ['typescript', 'machine learning', 'playwright'];
  await loadPopupWithHistory(page, priorSearches);

  // Wait for items list to load
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // The search input should be empty
  const searchInput = page.locator('#search-input');
  await expect(searchInput).toHaveValue('');

  // Focus the search input — dropdown should appear with history items
  await searchInput.focus();

  const dropdown = page.locator('#search-history-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 3000 });

  // All prior searches should appear in the dropdown
  for (const query of priorSearches) {
    await expect(dropdown.locator(`li`, { hasText: query })).toBeVisible();
  }

  // "Clear history" option should be present
  await expect(dropdown.locator('#clear-history')).toBeVisible();
});

test('clicking a search history item fills the input and dismisses the dropdown', async ({ page }) => {
  const priorSearches = ['typescript', 'machine learning'];
  await loadPopupWithHistory(page, priorSearches);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const searchInput = page.locator('#search-input');
  await searchInput.focus();

  const dropdown = page.locator('#search-history-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 3000 });

  // Click the first history item
  const firstItem = dropdown.locator('.search-history-item').first();
  const itemText = await firstItem.textContent();
  await firstItem.click();

  // Input should be filled with the clicked history item
  await expect(searchInput).toHaveValue(itemText!.trim());

  // Dropdown should be hidden
  await expect(dropdown).toBeHidden();
});

test('clearing search history removes the dropdown entries', async ({ page }) => {
  const priorSearches = ['typescript', 'machine learning'];
  await loadPopupWithHistory(page, priorSearches);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const searchInput = page.locator('#search-input');
  await searchInput.focus();

  const dropdown = page.locator('#search-history-dropdown');
  await expect(dropdown).toBeVisible({ timeout: 3000 });

  // Click "Clear history"
  await dropdown.locator('#clear-history').click();

  // Dropdown should be hidden after clearing
  await expect(dropdown).toBeHidden();

  // Re-focus — no dropdown should appear (history is empty)
  await searchInput.focus();
  await page.waitForTimeout(500);
  await expect(dropdown).toBeHidden();
});

test('search history is not shown when input has text', async ({ page }) => {
  const priorSearches = ['typescript'];
  await loadPopupWithHistory(page, priorSearches);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const searchInput = page.locator('#search-input');
  // Type something — dropdown must not appear
  await searchInput.fill('some query');
  await searchInput.focus();

  await page.waitForTimeout(500);
  const dropdown = page.locator('#search-history-dropdown');
  await expect(dropdown).toBeHidden();
});
