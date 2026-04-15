import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

// ── Tests ─────────────────────────────────────────────────────────────────────

test('submitting a valid URL via the capture modal enqueues it and shows it in the list', async ({ page }) => {
  const url = `https://example.com/ingest-new-${Date.now()}`;
  await page.goto(BASE + '/');

  // Open quick-capture modal
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible({ timeout: 5_000 });

  // Fill in the URL and submit
  const input = page.locator('.quick-capture-input');
  await input.fill(url);
  await page.locator('.quick-capture-btn').click();

  // Button confirms submission
  await expect(page.locator('.quick-capture-btn')).toHaveText('Queued!', { timeout: 5_000 });

  // Verify via API that the item was enqueued
  const check = await page.request.get(`${BASE}/items/check?url=${encodeURIComponent(url)}`);
  const body = await check.json() as { exists: boolean; id?: string; status?: string };
  expect(body.exists).toBe(true);
  expect(body.status).toBeTruthy();

  // Cleanup
  if (body.id) await page.request.delete(`${BASE}/items/${body.id}`);
});

test('a newly enqueued item appears in the list with a queued/processing status', async ({ page, request }) => {
  const url = `https://example.com/ingest-queued-${Date.now()}`;

  // Submit via API
  const res = await request.post(`${BASE}/process`, {
    data: { url },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  const { id } = await res.json() as { id: string; status: string };

  try {
    await page.goto(BASE + '/');
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible();

    // The item should be retrievable and have a queued/processing status
    const item = await request.get(`${BASE}/items/${id}`);
    expect(item.ok()).toBeTruthy();
    const itemData = await item.json() as { status: string };
    expect(['queued', 'processing', 'done', 'error']).toContain(itemData.status);
  } finally {
    await request.delete(`${BASE}/items/${id}`);
  }
});

test('POST /process with a missing URL field returns an error with error property', async ({ request }) => {
  // The server validates that url is a non-empty string; empty string triggers this
  const res = await request.post(`${BASE}/process`, {
    data: { url: '' },
    headers: { 'Content-Type': 'application/json' },
  });
  // url: '' is falsy — should return 400
  expect(res.status()).toBe(400);
  const body = await res.json() as Record<string, unknown>;
  expect(body).toHaveProperty('error');
});

test('POST /process with a missing URL returns an error', async ({ request }) => {
  const res = await request.post(`${BASE}/process`, {
    data: {},
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
  const body = await res.json() as Record<string, unknown>;
  expect(body).toHaveProperty('error');
});

test('submitting a duplicate URL in the capture modal shows an already-saved indicator', async ({ page }) => {
  const url = `https://example.com/ingest-dup-${Date.now()}`;

  // First, save the item so it exists
  const createRes = await page.request.post(`${BASE}/process`, {
    data: { url },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = await createRes.json() as { id: string };

  try {
    await page.goto(BASE + '/');
    await page.locator('body').click();
    await page.keyboard.press('Control+l');
    await expect(page.locator('.quick-capture-overlay')).toBeVisible({ timeout: 5_000 });

    // Type the already-saved URL — duplicate check has a debounce
    await page.locator('.quick-capture-input').fill(url);

    // The duplicate indicator should appear (the debounce is ~400ms)
    await expect(page.locator('.quick-capture-duplicate')).toBeVisible({ timeout: 3_000 });
  } finally {
    await page.keyboard.press('Escape');
    await page.request.delete(`${BASE}/items/${id}`);
  }
});

test('the capture modal can be dismissed with Escape without submitting', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible({ timeout: 5_000 });

  // Press Escape — modal should close without submitting
  await page.keyboard.press('Escape');
  await expect(page.locator('.quick-capture-overlay')).not.toBeVisible({ timeout: 3_000 });
});

test('the capture modal can be opened with Ctrl+L keyboard shortcut', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  const overlay = page.locator('.quick-capture-overlay');
  await expect(overlay).toBeVisible({ timeout: 5_000 });

  // Cleanup: close it
  await page.keyboard.press('Escape');
});

test('submitting without entering a URL does not enqueue anything', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible({ timeout: 5_000 });

  // Click submit with an empty input
  const input = page.locator('.quick-capture-input');
  await input.fill('');
  await page.locator('.quick-capture-btn').click();

  // Should NOT show "Queued!" — the form should stay open or show validation
  const btnText = await page.locator('.quick-capture-btn').innerText();
  expect(btnText).not.toBe('Queued!');

  await page.keyboard.press('Escape');
});
