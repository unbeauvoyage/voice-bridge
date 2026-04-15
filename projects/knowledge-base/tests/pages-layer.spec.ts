/**
 * Pages layer — verifies that KnowledgePage is a composition shell that
 * correctly wires feature components into a working UI.
 *
 * These tests verify the page layer contract:
 *   - App renders through KnowledgePage (not raw JSX)
 *   - All feature regions are present in the rendered output
 *   - Layout structure (header, body, reader) is intact
 *   - Modals triggered from the page still appear
 */

import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

async function ensureServer(request: APIRequestContext): Promise<void> {
  const res = await request.get(`${BASE}/health`);
  if (!res.ok()) throw new Error(`Server not running at ${BASE}`);
}

async function seedItem(request: APIRequestContext): Promise<void> {
  await request.post(`${BASE}/process`, {
    data: { url: 'https://example.com' },
    headers: { 'Content-Type': 'application/json' },
  });
}

// ---------------------------------------------------------------------------
// 1. KnowledgePage renders the header region
// ---------------------------------------------------------------------------

test('KnowledgePage renders the app header with search input', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);

  // App header must be present
  await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });

  // Search input must be present inside the header
  await expect(page.locator('[data-testid="search-input"]')).toBeVisible({
    timeout: 5_000,
  });
});

// ---------------------------------------------------------------------------
// 2. KnowledgePage renders the item list pane
// ---------------------------------------------------------------------------

test('KnowledgePage renders the item list pane', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await seedItem(request);

  await page.goto(BASE);

  // Item list container must exist
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({
    timeout: 10_000,
  });
});

// ---------------------------------------------------------------------------
// 3. KnowledgePage renders the reader pane in empty state
// ---------------------------------------------------------------------------

test('KnowledgePage renders the reader pane empty state on load', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);

  // ReaderPane empty state
  await expect(page.locator('.reader-empty')).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// 4. KnowledgePage wires item selection: clicking a card opens the reader
// ---------------------------------------------------------------------------

test('KnowledgePage wires item selection through to the reader', async ({
  page,
  request,
}) => {
  await ensureServer(request);
  await seedItem(request);

  await page.goto(BASE);

  // Wait for item cards to appear
  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 10_000 });

  // Click the card
  await firstCard.click();

  // Reader empty state disappears — reader has opened
  await expect(page.locator('.reader-empty')).not.toBeVisible({ timeout: 5_000 });
});

// ---------------------------------------------------------------------------
// 5. KnowledgePage wires the Bulk Add modal trigger
// ---------------------------------------------------------------------------

test('KnowledgePage wires the Bulk Add button to show the modal', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);

  await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });

  // Click the Bulk Add button in the header
  const bulkAddBtn = page.locator('button', { hasText: '+ Bulk Add' });
  await expect(bulkAddBtn).toBeVisible({ timeout: 5_000 });
  await bulkAddBtn.click();

  // BulkAddModal should appear (uses modal-overlay / modal-panel classes)
  await expect(page.locator('.modal-overlay')).toBeVisible({
    timeout: 5_000,
  });
});

// ---------------------------------------------------------------------------
// 6. KnowledgePage wires the Tags panel trigger
// ---------------------------------------------------------------------------

test('KnowledgePage wires the Tags button to show the panel', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);

  await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });

  // Click the Tags panel button (the first one — distinct from the cloud button)
  const tagsBtn = page.locator('button.header-tags-btn').first();
  await expect(tagsBtn).toBeVisible({ timeout: 5_000 });
  await tagsBtn.click();

  // TagsPanel should appear
  await expect(page.locator('.tags-panel, [data-testid="tags-panel"]')).toBeVisible({
    timeout: 5_000,
  });
});

// ---------------------------------------------------------------------------
// 7. KnowledgePage layout: app-body is present with correct structure
// ---------------------------------------------------------------------------

test('KnowledgePage app-body layout exists with list and reader panes', async ({
  page,
  request,
}) => {
  await ensureServer(request);

  await page.goto(BASE);

  // app-body wraps both panes
  await expect(page.locator('.app-body')).toBeVisible({ timeout: 10_000 });

  // item-list-pane exists inside app-body
  await expect(page.locator('.app-body .item-list-pane')).toBeVisible({
    timeout: 5_000,
  });

  // reader pane container exists inside app-body (reader-empty is inside reader-pane)
  await expect(page.locator('.app-body .reader-pane').first()).toBeVisible({
    timeout: 5_000,
  });
});
