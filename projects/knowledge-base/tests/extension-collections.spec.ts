import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');
const BASE = 'http://127.0.0.1:3737';

// Guards the extension collection filter: a dropdown above the item list lets
// CEO filter items by collection using GET /collections/:id/items.

async function loadPopup(page: import('@playwright/test').Page) {
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
        query: async () => [{ url: 'https://example.com/ext-collections-test' }],
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
  await page.goto(`${BASE}/health`);
  await page.setContent(rewritten, { waitUntil: 'load' });
}

test('collection filter in extension shows only items from selected collection', async ({
  page,
  request,
}) => {
  // --- Setup: create a collection and add a seeded item to it ---
  const colName = `ext-col-filter-${Date.now()}`;
  const createRes = await request.post(`${BASE}/collections`, {
    data: { name: colName },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id: colId } = await createRes.json() as { id: string };

  // Seed a real item and add it to the collection
  const itemUrl = `https://example.com/ext-col-item-${Date.now()}`;
  const saveRes = await request.post(`${BASE}/process`, {
    data: { url: itemUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(saveRes.ok()).toBeTruthy();
  const savedItem = await saveRes.json() as { id: string };
  const itemId = savedItem.id;

  await request.post(`${BASE}/collections/${colId}/items`, {
    data: { itemId },
    headers: { 'Content-Type': 'application/json' },
  });

  // --- Load the extension popup ---
  await loadPopup(page);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // --- The collection filter dropdown must exist ---
  const dropdown = page.locator('#collection-filter');
  await expect(dropdown).toBeVisible();

  // --- "All" option must be present (default) ---
  await expect(dropdown).toHaveValue('');

  // --- Collections loaded from API: our new collection should appear ---
  const option = page.locator(`#collection-filter option[value="${colId}"]`);
  await expect(option).toBeAttached({ timeout: 5000 });
  await expect(option).toHaveText(colName);

  // --- Selecting the collection filters the list ---
  const collectionCalls: string[] = [];
  await page.route(`**/${colId}/items*`, async (route) => {
    collectionCalls.push(route.request().url());
    await route.continue();
  });

  await dropdown.selectOption(colId);

  // The request to collection items endpoint must fire
  await expect.poll(() => collectionCalls.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(collectionCalls[0]).toContain(`/collections/${colId}/items`);

  // --- Selecting "All" restores full list ---
  const allItemsCalls: string[] = [];
  await page.route(`**/items*`, async (route) => {
    const url = route.request().url();
    if (!url.includes('/collections/')) allItemsCalls.push(url);
    await route.continue();
  });

  await dropdown.selectOption('');
  await expect.poll(() => allItemsCalls.length, { timeout: 5000 }).toBeGreaterThan(0);

  // --- Cleanup ---
  await request.delete(`${BASE}/collections/${colId}`);
  await request.delete(`${BASE}/items/${itemId}`).catch(() => {});
});
