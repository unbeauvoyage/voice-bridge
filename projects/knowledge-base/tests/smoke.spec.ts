import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';
// Use a stable, always-resolving URL with simple HTML
const TEST_URL = 'https://example.com';

// ---------------------------------------------------------------------------
// Core loop: save URL → item appears in list
// ---------------------------------------------------------------------------

test('core loop: save URL → item appears in list → reader opens', async ({ page }) => {
  // Full pipeline (fetch → summarize via Ollama) can take a while
  test.setTimeout(180_000);

  // --- Step 1: Submit the URL via the quick-capture modal ---
  await page.goto(BASE);

  // Click body to ensure the page has keyboard focus before sending shortcut
  await page.locator('body').click();

  // Open quick-capture with Ctrl+L
  await page.keyboard.press('Control+l');
  const overlay = page.locator('.quick-capture-overlay');
  await expect(overlay).toBeVisible({ timeout: 5000 });

  // Fill in the URL and submit
  const captureInput = page.locator('.quick-capture-input');
  await captureInput.fill(TEST_URL);
  await page.locator('.quick-capture-btn').click();

  // The button text changes to 'Queued!' on success
  await expect(page.locator('.quick-capture-btn')).toHaveText('Queued!', { timeout: 5000 });

  // Close the modal (click overlay backdrop)
  await page.keyboard.press('Escape');
  // Wait for the modal to close before interacting with the main UI
  await expect(page.locator('.quick-capture-overlay')).not.toBeVisible({ timeout: 3000 }).catch(() => {});

  // --- Step 2: Wait for the item card to appear in the list ---
  // Processing via Ollama can be slow; allow up to 30s.
  // Search for the item by title to ensure it appears regardless of list length
  // (the item list virtualises to 30 items; searching brings any item into view).
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('Example Domain');

  const itemCard = page.locator('.item-card').filter({ hasText: /example\.com|Example Domain/i }).first();
  await expect(itemCard).toBeVisible({ timeout: 150_000 });

  // --- Step 3: Verify card content ---
  // Title must not be empty (item-card-title shows title or falls back to URL)
  const titleEl = itemCard.locator('.item-card-title');
  await expect(titleEl).toBeVisible();
  const titleText = await titleEl.innerText();
  expect(titleText.trim().length).toBeGreaterThan(0);

  // The card text contains at minimum the title or URL — verify it's non-trivial
  const cardText = await itemCard.innerText();
  expect(cardText.trim().length).toBeGreaterThan(0);

  // --- Step 4: Click the card — reader pane must open without error ---
  await itemCard.click();

  // Reader pane becomes active (reader-empty disappears)
  await expect(page.locator('.reader-empty')).not.toBeVisible({ timeout: 5000 });

  // Reader title is visible and non-empty
  const readerTitle = page.locator('.reader-title');
  await expect(readerTitle).toBeVisible({ timeout: 5000 });
  const readerTitleText = await readerTitle.innerText();
  expect(readerTitleText.trim().length).toBeGreaterThan(0);

  // Reader meta shows the original URL link (domain visible)
  const originalLink = page.locator('.reader-meta a[href*="example.com"]');
  await expect(originalLink).toBeVisible({ timeout: 5000 });

  // No error boundary rendered (would appear as text containing "Something went wrong")
  await expect(page.locator('text=Something went wrong')).toHaveCount(0);
});

// ---------------------------------------------------------------------------
// API-level smoke: POST /process queues item even without Ollama
// ---------------------------------------------------------------------------

test('POST /process enqueues item and returns id', async ({ request }) => {
  // Use a unique URL each run to avoid the "Already saved" shortcut
  const uniqueUrl = `https://example.com/smoke-test-${Date.now()}`;

  const res = await request.post(`${BASE}/process`, {
    data: { url: uniqueUrl },
    headers: { 'Content-Type': 'application/json' },
  });

  expect(res.ok()).toBeTruthy();
  const body = await res.json() as { id: string; status: string };
  expect(typeof body.id).toBe('string');
  expect(body.id.length).toBeGreaterThan(0);
  // Status is either 'queued', 'processing', or 'exists'
  expect(['queued', 'processing', 'exists']).toContain(body.status);

  // The item must now be retrievable by id
  const getRes = await request.get(`${BASE}/items/${body.id}`);
  expect(getRes.ok()).toBeTruthy();
  const item = await getRes.json() as { id: string; url: string; status: string };
  expect(item.id).toBe(body.id);
  expect(item.url).toBe(uniqueUrl);

  // Cleanup
  await request.delete(`${BASE}/items/${body.id}`);
});

// ---------------------------------------------------------------------------
// GET /items/check — duplicate URL check endpoint
// ---------------------------------------------------------------------------

test('GET /items/check returns exists:false for unknown URL', async ({ request }) => {
  const res = await request.get(`${BASE}/items/check?url=https://definitely-not-saved-${Date.now()}.example.com`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json() as { exists: boolean };
  expect(body.exists).toBe(false);
});

test('GET /items/check returns exists:true with id/status/title for known URL', async ({ request }) => {
  // Enqueue a unique URL so it exists in the DB
  const uniqueUrl = `https://example.com/check-test-${Date.now()}`;
  const processRes = await request.post(`${BASE}/process`, {
    data: { url: uniqueUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(processRes.ok()).toBeTruthy();
  const processBody = await processRes.json() as { id: string };

  // Now check it
  const checkRes = await request.get(`${BASE}/items/check?url=${encodeURIComponent(uniqueUrl)}`);
  expect(checkRes.ok()).toBeTruthy();
  const checkBody = await checkRes.json() as { exists: boolean; id?: string; status?: string; title?: string };
  expect(checkBody.exists).toBe(true);
  expect(checkBody.id).toBe(processBody.id);
  expect(typeof checkBody.status).toBe('string');
  expect(typeof checkBody.title).toBe('string');

  // Cleanup
  await request.delete(`${BASE}/items/${processBody.id}`);
});

test('GET /items/check returns 400 when url param is missing', async ({ request }) => {
  const res = await request.get(`${BASE}/items/check`);
  expect(res.status()).toBe(400);
});

// ---------------------------------------------------------------------------
// /ollama/status endpoint shape
// ---------------------------------------------------------------------------

test('GET /ollama/status returns expected shape', async ({ request }) => {
  const res = await request.get(`${BASE}/ollama/status`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json() as { ok: boolean; url: string };
  expect(typeof body.ok).toBe('boolean');
  expect(typeof body.url).toBe('string');
});

// ---------------------------------------------------------------------------
// UI smoke: done item appears in item list and reader pane opens correctly
// Note: only items with status='done' appear in the default list view.
// This test requires at least one done item in the DB; skips gracefully if none.
// ---------------------------------------------------------------------------

test('done item is visible in item list and reader pane opens', async ({ page, request }) => {
  // Ensure at least one done item exists — seed example.com (already processed in
  // real-world use) so the test is deterministic on a fresh DB too.
  await request.post(`${BASE}/process`, {
    data: { url: 'https://example.com' },
    headers: { 'Content-Type': 'application/json' },
  });

  // Fetch all items and find a done one
  const res = await request.get(`${BASE}/items`);
  expect(res.ok()).toBeTruthy();
  const allItems = await res.json() as Array<{ id: string; status: string; title?: string; url: string }>;
  const doneItem = allItems.find((it) => it.status === 'done');
  expect(doneItem, 'expected at least one done item in DB').toBeTruthy();
  if (!doneItem) return; // satisfies TypeScript

  await page.goto(BASE);

  // Wait for item list to render
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();

  // At least one item card should be present
  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 5000 });

  // Find the specific card for our known done item
  const targetCard = page.locator(`.item-card`).filter({ hasText: doneItem.title ?? doneItem.url }).first();
  await expect(targetCard).toBeVisible({ timeout: 5000 });

  // Title element is present and non-empty
  const titleEl = targetCard.locator('.item-card-title');
  await expect(titleEl).toBeVisible();
  const titleText = await titleEl.innerText();
  expect(titleText.trim().length).toBeGreaterThan(0);

  // Click card — reader pane opens
  await targetCard.click();
  await expect(page.locator('.reader-empty')).not.toBeVisible({ timeout: 5000 });
  const readerTitle = page.locator('.reader-title');
  await expect(readerTitle).toBeVisible({ timeout: 5000 });

  // No error boundary
  await expect(page.locator('text=Something went wrong')).toHaveCount(0);
});
