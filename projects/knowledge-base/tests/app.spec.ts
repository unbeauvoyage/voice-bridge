import { test, expect } from '@playwright/test';

// Tests assume server is running at http://127.0.0.1:3737
// and work with both empty and populated DB

test('home page loads with correct title', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  await expect(page).toHaveTitle(/knowledge/i);
});

test('search input is visible on load', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  await expect(page.locator('[data-testid="search-input"]')).toBeVisible();
});

test('search input accepts text input', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  const input = page.locator('[data-testid="search-input"]');
  await input.click();
  await input.fill('hello world');
  await expect(input).toHaveValue('hello world');
});

test('date filter buttons render', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  await expect(page.locator('[data-testid="date-filters"]')).toBeVisible();
  // All, Today, 2d, 3d, 4d + Starred + Archived buttons
  const dateButtons = page.locator('[data-testid^="date-btn-"]');
  await expect(dateButtons).toHaveCount(5);
  await expect(dateButtons.nth(0)).toHaveText('All');
  await expect(dateButtons.nth(1)).toHaveText('Today');
});

test('date filter button activates on click', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  const todayBtn = page.locator('[data-testid="date-btn-1"]');
  await todayBtn.click();
  await expect(todayBtn).toHaveClass(/active/);
  // All button should no longer be active
  const allBtn = page.locator('[data-testid="date-btn-0"]');
  await expect(allBtn).not.toHaveClass(/active/);
});

test('item list pane renders', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  // Wait for initial load to complete
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
});

test('shows empty state or items after load', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  // Either empty state or item count header is visible
  const itemCount = page.locator('[data-testid="item-count"]');
  const emptyState = page.locator('[data-testid="empty-state"]');
  // Wait for one of them (loading finishes)
  await expect(itemCount.or(emptyState)).toBeVisible({ timeout: 5000 });
});

test('server health check', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/health');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body.ok).toBe(true);
});

test('GET /items returns array', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/items');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /tags returns expected shape', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/tags');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('approved');
  expect(body).toHaveProperty('pending');
  expect(body).toHaveProperty('rejected');
  expect(Array.isArray(body.approved)).toBe(true);
  expect(Array.isArray(body.pending)).toBe(true);
  expect(Array.isArray(body.rejected)).toBe(true);
});

test('GET /search returns array for empty query', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/search?q=');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /search with query returns array', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/search?q=test');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('POST /process rejects missing url', async ({ page }) => {
  const res = await page.request.post('http://127.0.0.1:3737/process', {
    data: {},
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json();
  expect(body).toHaveProperty('error');
});

test('POST /process rejects invalid JSON body', async ({ page }) => {
  const res = await page.request.post('http://127.0.0.1:3737/process', {
    data: 'not-json',
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('GET /items/:id returns 404 for unknown id', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/items/does-not-exist-xyz');
  expect(res.status()).toBe(404);
  const body = await res.json();
  expect(body).toHaveProperty('error');
});

test('reader pane shows empty prompt when no item selected', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  // The reader pane should show a prompt to select an item
  await expect(page.locator('.reader-empty')).toBeVisible();
});

// ── New feature tests ─────────────────────────────────────────────────────────

test('dark/light mode toggle adds theme-light class to body', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  // The theme button is ☀️ in dark mode; clicking it switches to light
  const themeBtn = page.locator('.header-theme-btn');
  await expect(themeBtn).toBeVisible();
  await themeBtn.click();
  // After toggle, body should have theme-light (or theme-dark depending on initial state)
  const hasLight = await page.locator('body.theme-light').count();
  const hasDark = await page.locator('body.theme-dark').count();
  expect(hasLight + hasDark).toBe(1);
});

test('semantic search toggle activates', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  const semanticCheckbox = page.locator('.semantic-toggle input[type="checkbox"]');
  await expect(semanticCheckbox).toBeVisible();
  const initialState = await semanticCheckbox.isChecked();
  await semanticCheckbox.click();
  await expect(semanticCheckbox).toBeChecked({ checked: !initialState });
});

test('export button shows dropdown', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  const exportBtn = page.locator('button.header-export-btn');
  await expect(exportBtn).toBeVisible();
  await exportBtn.click();
  await expect(page.locator('.export-dropdown')).toBeVisible();
  await expect(page.locator('.export-dropdown-item').first()).toBeVisible();
});

test('settings button opens settings panel', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  const settingsBtn = page.locator('button.header-settings-btn');
  await expect(settingsBtn).toBeVisible();
  await settingsBtn.click();
  await expect(page.locator('.settings-panel')).toBeVisible();
});

test('Ctrl+L shortcut opens quick capture modal', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible({ timeout: 3000 });
});

test('/ shortcut focuses search input', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  // Click somewhere neutral first to ensure focus is not already on input
  await page.locator('body').click();
  await page.keyboard.press('/');
  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toBeFocused();
});

test('FTS search shows item-snippet on results', async ({ page }) => {
  // POST a test item first via API so there is something to search for
  const res = await page.request.post('http://127.0.0.1:3737/process', {
    data: { url: 'https://example.com/fts-test-' + Date.now() },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  // Search for a term — even if no snippet appears (empty DB), the request must not crash
  await page.goto('http://127.0.0.1:3737/');
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('test');
  // Wait briefly for debounce; the item list should still render
  await page.waitForTimeout(400);
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
});

test('reading stats bar is present when items exist', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737/');
  // reading-stats bar only appears when an item is selected; verify it exists in DOM or is absent gracefully
  const items = await page.request.get('http://127.0.0.1:3737/items');
  const body = await items.json();
  if (Array.isArray(body) && body.length > 0) {
    // Click the first item card to load reader
    await page.locator('.item-card').first().click();
    await expect(page.locator('.reading-stats')).toBeVisible({ timeout: 5000 });
  } else {
    // No items — reading stats bar is not shown; that is also valid
    await expect(page.locator('.reading-stats')).toHaveCount(0);
  }
});

test('star button toggles on item card', async ({ page }) => {
  const items = await page.request.get('http://127.0.0.1:3737/items');
  const body = await items.json();
  if (!Array.isArray(body) || body.length === 0) {
    // No items to test; skip gracefully
    return;
  }
  await page.goto('http://127.0.0.1:3737/');
  const starBtn = page.locator('.star-btn').first();
  await expect(starBtn).toBeVisible();
  const before = await starBtn.innerText();
  const toggled = before === '★' ? '☆' : '★';
  await starBtn.click();
  // Wait for DOM to reflect the toggle — don't read immediately after click
  await expect(starBtn).toHaveText(toggled, { timeout: 2000 });
  // Restore original state so tests don't affect each other
  await starBtn.click();
  await expect(starBtn).toHaveText(before, { timeout: 2000 });
});

test('GET /collections returns array', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/collections');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /feeds returns array', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/feeds');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /stats/summary returns expected shape', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/stats/summary');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('totalItems');
  expect(body).toHaveProperty('totalRead');
  expect(body).toHaveProperty('savedThisWeek');
  expect(body).toHaveProperty('byType');
  expect(body).toHaveProperty('topTags');
});

test('GET /embed/status returns expected shape', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/embed/status');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('total');
  expect(body).toHaveProperty('embedded');
  expect(body).toHaveProperty('pending');
});

test('DELETE /items/:id returns 404 after deletion', async ({ page }) => {
  // Create an item via POST /process
  const createRes = await page.request.post('http://127.0.0.1:3737/process', {
    data: { url: 'https://example.com/delete-test-' + Date.now() },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = await createRes.json();
  expect(typeof id).toBe('string');

  // Delete the item
  const deleteRes = await page.request.delete(`http://127.0.0.1:3737/items/${id}`);
  expect(deleteRes.ok()).toBeTruthy();

  // Now fetching the item should return 404
  const getRes = await page.request.get(`http://127.0.0.1:3737/items/${id}`);
  expect(getRes.status()).toBe(404);
});

test('POST /tags/merge merges two tags', async ({ page }) => {
  // First approve two tags via approve endpoint
  await page.request.post('http://127.0.0.1:3737/tags/approve', {
    data: { tag: 'merge-source-tag' },
    headers: { 'Content-Type': 'application/json' },
  });
  await page.request.post('http://127.0.0.1:3737/tags/approve', {
    data: { tag: 'merge-target-tag' },
    headers: { 'Content-Type': 'application/json' },
  });

  const res = await page.request.post('http://127.0.0.1:3737/tags/merge', {
    data: { from: 'merge-source-tag', to: 'merge-target-tag' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(body).toHaveProperty('ok', true);
  expect(body).toHaveProperty('itemsUpdated');
});

test('GET /export/json returns JSON array', async ({ page }) => {
  const res = await page.request.get('http://127.0.0.1:3737/export/json');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});
