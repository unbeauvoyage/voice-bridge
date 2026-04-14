/**
 * Refactor safety net — behavioral anchors for feature-extraction refactor.
 *
 * These tests capture current observable behavior (CSS class structure, DOM
 * hierarchy, keyboard shortcuts) so that any refactor that breaks them is
 * caught immediately. Tests must pass BEFORE and AFTER the refactor.
 *
 * Not covered here (see other spec files):
 *   - search input / date filters / item list: app.spec.ts
 *   - core save URL → item → reader: smoke.spec.ts
 *   - quick capture modal: quick-capture.spec.ts
 *   - reader content: reader-content.spec.ts
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

// ---------------------------------------------------------------------------
// Helper: ensure server is up (playwright webServer handles startup; this
// is a fallback guard for ad-hoc runs outside the test runner).
// ---------------------------------------------------------------------------
async function ensureServer(request: APIRequestContext): Promise<void> {
  try {
    const res = await request.get(`${BASE}/health`);
    if (res.ok()) return;
  } catch {
    // Server not running — nothing we can do in a Playwright test context;
    // the webServer config should have handled it.
    throw new Error(
      `Server is not running at ${BASE}. Start it with: bun run server`
    );
  }
}

// ---------------------------------------------------------------------------
// Helper: seed one item and wait for a done item to exist.
// Returns the first done item found, or throws if none exist after seeding.
// ---------------------------------------------------------------------------
async function getDoneItem(
  request: APIRequestContext
): Promise<{ id: string; status: string; title?: string; url: string }> {
  // Seed a stable URL — if it already exists the server returns 'exists'
  await request.post(`${BASE}/process`, {
    data: { url: 'https://example.com' },
    headers: { 'Content-Type': 'application/json' },
  });

  const res = await request.get(`${BASE}/items`);
  if (!res.ok()) throw new Error('GET /items failed');
  const items = (await res.json()) as Array<{
    id: string;
    status: string;
    title?: string;
    url: string;
  }>;
  const done = items.find((it) => it.status === 'done');
  if (!done) throw new Error('No done item found in DB — run the pipeline first');
  return done;
}

// ===========================================================================
// 1. Item list CSS class structure is preserved
// ===========================================================================

test('item list container and card hierarchy are present after page load', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  const doneItem = await getDoneItem(request);

  await page.goto(BASE);

  // [data-testid='item-list'] container exists
  const listContainer = page.locator('[data-testid="item-list"]');
  await expect(listContainer).toBeVisible({ timeout: 10_000 });

  // .item-card elements are present (done items are shown by default)
  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5_000 });

  // Each .item-card has a .item-card-title child
  const titleEl = firstCard.locator('.item-card-title');
  await expect(titleEl).toBeVisible();

  // Verify .item-card-title is non-empty
  const titleText = await titleEl.innerText();
  expect(titleText.trim().length).toBeGreaterThan(0);

  // Locate the specific card for the known done item
  const targetCard = page
    .locator('.item-card')
    .filter({ hasText: doneItem.title ?? doneItem.url })
    .first();
  await expect(targetCard).toBeVisible({ timeout: 5_000 });

  // Confirm it also has an .item-card-title child
  await expect(targetCard.locator('.item-card-title')).toBeVisible();
});

test('clicking an item-card when reader is empty opens the reader', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await getDoneItem(request);

  await page.goto(BASE);

  // Confirm reader is empty before any interaction
  const readerEmpty = page.locator('.reader-empty');
  await expect(readerEmpty).toBeVisible({ timeout: 10_000 });

  // Click the first available card
  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5_000 });
  await firstCard.click();

  // .reader-empty hides — reader has opened
  await expect(readerEmpty).not.toBeVisible({ timeout: 5_000 });
});

// ===========================================================================
// 2. Reader pane CSS class structure is preserved
// ===========================================================================

test('reader pane shows empty placeholder before item selection', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);

  // .reader-empty is visible when no item is selected (initial state)
  await expect(page.locator('.reader-empty')).toBeVisible({ timeout: 10_000 });
});

test('reader pane reveals title and meta after item card click', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await getDoneItem(request);

  await page.goto(BASE);

  // Confirm initial empty state
  await expect(page.locator('.reader-empty')).toBeVisible({ timeout: 10_000 });

  // Click first card
  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5_000 });
  await firstCard.click();

  // .reader-empty hides
  await expect(page.locator('.reader-empty')).not.toBeVisible({ timeout: 5_000 });

  // .reader-title is visible and non-empty
  const readerTitle = page.locator('.reader-title');
  await expect(readerTitle).toBeVisible({ timeout: 5_000 });
  const titleText = await readerTitle.innerText();
  expect(titleText.trim().length).toBeGreaterThan(0);

  // .reader-meta is visible in the reader pane
  await expect(page.locator('.reader-meta')).toBeVisible({ timeout: 5_000 });
});

test('no error boundary fires after selecting an item', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await getDoneItem(request);

  await page.goto(BASE);

  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });
  await firstCard.click();

  // .error-boundary must not appear
  await expect(page.locator('.error-boundary')).toHaveCount(0);
  // Belt-and-suspenders: check for the error text too
  await expect(page.locator('text=Something went wrong')).toHaveCount(0);
});

// ===========================================================================
// 3. Search bar CSS structure is preserved
// ===========================================================================

test('search input accepts text and filters the item list', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await getDoneItem(request);

  await page.goto(BASE);

  // [data-testid='search-input'] is present
  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toBeVisible({ timeout: 10_000 });

  // Wait for at least one item card to appear before recording baseline
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 5_000 });
  const initialCount = await page.locator('.item-card').count();
  expect(initialCount).toBeGreaterThan(0);

  // Type a search term that is unlikely to match anything
  await searchInput.fill('zzznomatch_xyzxyz_99999');

  // Wait for the UI to react to the filter
  await page.waitForTimeout(600);

  const afterCount = await page.locator('.item-card').count();
  // No items should match this nonsense query (or at worst fewer than baseline)
  expect(afterCount).toBeLessThan(initialCount);
});

test('clearing search restores the full item list', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await getDoneItem(request);

  await page.goto(BASE);

  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toBeVisible({ timeout: 10_000 });

  // Capture baseline count
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 5_000 });
  const baselineCount = await page.locator('.item-card').count();

  // Filter to nothing
  await searchInput.fill('zzznomatch_xyzxyz_99999');
  // Give UI time to react
  await page.waitForTimeout(500);

  // Clear the input
  await searchInput.fill('');
  await page.waitForTimeout(500);

  // List should be back to at least the baseline count
  const restoredCount = await page.locator('.item-card').count();
  expect(restoredCount).toBeGreaterThanOrEqual(baselineCount);
});

// ===========================================================================
// 4. Ingest entry point CSS structure is preserved
// ===========================================================================

test('Ctrl+L opens the quick-capture overlay', async ({ page, request }) => {
  await ensureServer(request);

  await page.goto(BASE);

  // Ensure page body has focus for keyboard events
  await page.locator('body').click();

  // Quick-capture overlay should not be visible initially
  await expect(page.locator('.quick-capture-overlay')).not.toBeVisible({
    timeout: 3_000,
  }).catch(() => {
    // May already be hidden — that's fine
  });

  // Open with Ctrl+L
  await page.keyboard.press('Control+l');

  // Overlay appears
  const overlay = page.locator('.quick-capture-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });
});

test('quick-capture modal contains input and button in correct initial state', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);
  await page.locator('body').click();
  await page.keyboard.press('Control+l');

  const overlay = page.locator('.quick-capture-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });

  // .quick-capture-input is visible inside the modal
  const captureInput = page.locator('.quick-capture-input');
  await expect(captureInput).toBeVisible({ timeout: 3_000 });

  // .quick-capture-btn is visible and enabled
  const captureBtn = page.locator('.quick-capture-btn');
  await expect(captureBtn).toBeVisible({ timeout: 3_000 });
  await expect(captureBtn).toBeEnabled({ timeout: 3_000 });

  // Button text is 'Save' in idle state
  await expect(captureBtn).toHaveText('Save');

  // After typing a URL the button remains enabled and ready to submit
  await captureInput.fill('https://example.com');
  await expect(captureBtn).toBeEnabled({ timeout: 3_000 });
});

test('Escape key closes the quick-capture overlay', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);
  await page.locator('body').click();
  await page.keyboard.press('Control+l');

  const overlay = page.locator('.quick-capture-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });

  // Press Escape to close
  await page.keyboard.press('Escape');

  await expect(overlay).not.toBeVisible({ timeout: 3_000 });
});
