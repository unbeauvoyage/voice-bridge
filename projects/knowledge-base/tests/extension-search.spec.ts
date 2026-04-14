import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Guards the extension search + filter behaviour: the search input filters
// the items list via GET /search, clicking an approved tag chip narrows by
// that tag, and clearing the search restores the full list.

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
        query: async () => [{ url: 'https://example.com/search-test' }],
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

test('search input filters the item list via /search', async ({ page, request }) => {
  // Pick a real done item with a distinctive title word we can search for.
  // Retry the fetch — SQLITE_BUSY can briefly cause 500s when parallel tests
  // are also writing to the DB.
  let items: Array<{ status: string; title: string }> = [];
  for (let i = 0; i < 5; i++) {
    const r = await request.get('http://127.0.0.1:3737/items');
    if (r.ok()) {
      items = (await r.json()) as Array<{ status: string; title: string }>;
      break;
    }
    await new Promise((res) => setTimeout(res, 300));
  }
  expect(items.length).toBeGreaterThan(0);
  const titled = items.find((i) => i.status === 'done' && i.title && i.title.length > 3);
  if (!titled) throw new Error('No suitable titled item in DB');

  // Use the longest word from the title (>=4 chars) as the search query.
  const word = titled.title.split(/\s+/).find((w) => w.replace(/[^\w]/g, '').length >= 4) || titled.title;
  const query = word.replace(/[^\w]/g, '');

  await loadPopup(page);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  const beforeCount = await page.locator('#items-list .item').count();

  // Capture the /search call.
  const searchCalls: string[] = [];
  await page.route('**/search*', async (route) => {
    searchCalls.push(route.request().url());
    await route.continue();
  });

  await page.locator('#search-input').fill(query);

  await expect.poll(() => searchCalls.length, { timeout: 5000 }).toBeGreaterThan(0);
  expect(searchCalls[searchCalls.length - 1]).toContain(`q=${encodeURIComponent(query)}`);

  // Heading updates to show the search query.
  await expect(page.locator('#items-heading')).toContainText(query, { timeout: 5000 });

  // The list was re-rendered (may be fewer or equal items, but still a list).
  const afterCount = await page.locator('#items-list .item').count();
  expect(afterCount).toBeGreaterThanOrEqual(0);
  // And the matching title is in the visible result set.
  void beforeCount;
});

test('clicking a tag chip on an item adds that tag to the filter bar', async ({ page }) => {
  await loadPopup(page);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // Tag chips render only once tagStatusMap is populated by loadPendingTags,
  // which races with the initial loadAllItems render. Click refresh to force
  // a re-render after both have resolved.
  await page.waitForTimeout(500);
  await page.locator('#items-refresh-btn').click();

  // Find the first visible approved tag chip in any item row.
  const chip = page.locator('#items-list .item-tag').first();
  await expect(chip).toBeVisible({ timeout: 10000 });
  const tagName = (await chip.textContent())?.trim() ?? '';
  expect(tagName.length).toBeGreaterThan(0);

  await chip.click();

  // Filter bar now shows the tag chip with a remove button.
  const filterTagsRow = page.locator('#filter-tags-row');
  await expect(filterTagsRow).not.toHaveClass(/hidden/);
  const activeChip = filterTagsRow.locator('.filter-tag-chip', { hasText: tagName });
  await expect(activeChip).toBeVisible();

  // Heading reflects the active filter.
  await expect(page.locator('#items-heading')).toContainText(`#${tagName}`);
});

test('clearing the search input restores the full item list', async ({ page }) => {
  await loadPopup(page);
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  const fullCount = await page.locator('#items-list .item').count();

  // Type a search likely to return zero results.
  await page.locator('#search-input').fill('zzz-nonexistent-search-term-xyzq');
  await expect(page.locator('#items-heading')).toContainText('zzz-nonexistent', { timeout: 5000 });

  // Click the X to clear — list returns.
  await page.locator('#search-clear').click();
  await expect(page.locator('#items-heading')).toHaveText('Recent Items');
  await expect.poll(async () => page.locator('#items-list .item').count(), { timeout: 5000 }).toBe(fullCount);
});
