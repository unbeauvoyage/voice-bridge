import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('quick capture modal accepts a URL and transitions to queued state', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible();
  const input = page.locator('.quick-capture-input');
  const url = 'https://example.com/quick-capture-' + Date.now();
  await input.fill(url);
  await page.locator('.quick-capture-btn').click();
  // Button text flips to "Queued!" briefly, or the modal closes
  // Either is acceptable — capture the queued side effect via API
  await page.waitForTimeout(1200);
  const check = await page.request.get(BASE + '/items/check?url=' + encodeURIComponent(url));
  const body = await check.json();
  expect(body.exists).toBe(true);
  // Cleanup
  if (body.id) await page.request.delete(BASE + '/items/' + body.id);
});

test('quick capture modal closes on Escape key', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.locator('.quick-capture-overlay')).toHaveCount(0);
});

test('quick capture shows already-saved banner for a duplicate URL', async ({ page }) => {
  const url = 'https://example.com/duplicate-capture-' + Date.now();
  // Seed the item via API
  const createRes = await page.request.post(BASE + '/process', {
    data: { url },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(createRes.ok()).toBeTruthy();
  const { id } = await createRes.json();

  await page.goto(BASE + '/');
  await page.locator('body').click();
  await page.keyboard.press('Control+l');
  await expect(page.locator('.quick-capture-overlay')).toBeVisible();
  await page.locator('.quick-capture-input').fill(url);
  // The duplicate check has a 400ms debounce — wait for it
  await expect(page.locator('.quick-capture-duplicate')).toBeVisible({ timeout: 3000 });

  // Cleanup
  await page.keyboard.press('Escape');
  await page.request.delete(BASE + '/items/' + id);
});
