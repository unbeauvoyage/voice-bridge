import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');
const BASE = 'http://127.0.0.1:3737';

// Guards the semantic search toggle in the extension: the "AI Search" checkbox
// appends semantic=true to the /search query when enabled.

async function loadPopup(page: import('@playwright/test').Page, storedState: Record<string, unknown> = {}) {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  await page.addInitScript((state) => {
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb(state),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com/semantic-toggle-test' }],
        create: (_: unknown) => {},
      },
    };
  }, storedState);
  const rewritten = popupHtml
    .replace(
      '<script src="raise-form.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
    )
    .replace(
      '<script src="popup.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
    );
  await page.goto(`${BASE}/health`);
  await page.setContent(rewritten, { waitUntil: 'load' });
}

test('semantic search toggle in extension sends semantic query to server', async ({ page }) => {
  await loadPopup(page);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // --- Toggle must exist ---
  const toggle = page.locator('#semantic-toggle');
  await expect(toggle).toBeVisible();

  // --- Default state is unchecked (FTS mode) ---
  await expect(toggle).not.toBeChecked();

  // --- Enable semantic mode ---
  await toggle.check();
  await expect(toggle).toBeChecked();

  // --- Type a search query — should send semantic=true ---
  const semanticCalls: string[] = [];
  await page.route('**/search*', async (route) => {
    semanticCalls.push(route.request().url());
    await route.continue();
  });

  await page.locator('#search-input').fill('knowledge');
  await expect.poll(() => semanticCalls.length, { timeout: 5000 }).toBeGreaterThan(0);

  const lastCall = semanticCalls[semanticCalls.length - 1];
  expect(lastCall).toContain('semantic=true');
  expect(lastCall).toContain('q=knowledge');

  // --- Disable semantic toggle — next search should NOT have semantic=true ---
  await toggle.uncheck();
  await expect(toggle).not.toBeChecked();

  const ftsCalls: string[] = [];
  await page.route('**/search*', async (route) => {
    ftsCalls.push(route.request().url());
    await route.continue();
  });

  // Modify the query slightly to trigger a new search
  await page.locator('#search-input').fill('knowledge base');
  await expect.poll(() => ftsCalls.length, { timeout: 5000 }).toBeGreaterThan(0);

  const ftsCall = ftsCalls[ftsCalls.length - 1];
  expect(ftsCall).not.toContain('semantic=true');
  expect(ftsCall).toContain('q=knowledge');
});

test('semantic toggle persists state via chrome.storage.local', async ({ page }) => {
  // Start with semanticSearch: true stored
  await loadPopup(page, { semanticSearch: true });
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  const toggle = page.locator('#semantic-toggle');
  await expect(toggle).toBeChecked({ timeout: 3000 });
});
