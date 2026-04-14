import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('sort dropdown reorders the item list when changed to oldest', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  // Wait for at least one card to render
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10000 });
  // Wait until we see multiple cards (sorting requires ≥2 items to assert reorder)
  await expect.poll(async () => (await page.locator('.item-card').count()), { timeout: 5000 }).toBeGreaterThan(1);
  const cardsBefore = await page.locator('.item-card .item-card-title').allInnerTexts();
  const firstNewest = cardsBefore[0];

  // Change sort
  await page.locator('select.sort-select').selectOption('oldest');
  // Poll until first card title changes
  await expect
    .poll(async () => (await page.locator('.item-card .item-card-title').first().innerText()), { timeout: 5000 })
    .not.toBe(firstNewest);
  const cardsAfter = await page.locator('.item-card .item-card-title').allInnerTexts();
  expect(cardsAfter.length).toBeGreaterThan(0);
  const firstOldest = cardsAfter[0];
  // With enough items, newest-first and oldest-first should differ
  expect(firstOldest).not.toBe(firstNewest);
});

test('Today date filter applies without error and shows filtered or empty state', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  const todayBtn = page.locator('[data-testid="date-btn-1"]');
  await todayBtn.click();
  await expect(todayBtn).toHaveClass(/active/);
  // Either the item-count shows a number (potentially 0) or empty state is shown
  const count = page.locator('[data-testid="item-count"]');
  const empty = page.locator('[data-testid="empty-state"]');
  await expect(count.or(empty)).toBeVisible();
});
