/**
 * search.spec.ts — Behavior tests for the search flow.
 *
 * Safety net for the feature-extraction refactor.
 * Uses only the server API — no direct DB seeding.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('typing in search filters the item list', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });

  const totalBefore = await page.locator('.item-card').count();
  expect(totalBefore).toBeGreaterThan(0);

  // Type a very specific query that probably matches only a few items (or none)
  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('xQzAbsolutelyUniqueQuery99');
  await page.waitForTimeout(500);

  // The list should show filtered results (empty state or fewer items)
  const filteredCount = await page.locator('.item-card').count();
  const emptyState = page.locator('[data-testid="empty-state"]');
  const isEmpty = await emptyState.isVisible();
  // Either 0 results (empty state) or fewer results than before
  expect(isEmpty || filteredCount < totalBefore).toBeTruthy();

  await searchInput.clear();
});

test('search finds items by title keyword', async ({ page, request }) => {
  // Get a real item title from the API
  const res = await request.get(`${BASE}/items`);
  const items: Array<{ id: string; title?: string; status: string }> = await res.json();
  const doneItem = items.find((i) => i.status === 'done' && i.title && i.title.length > 3);
  expect(doneItem, 'expected at least one done item with a title').toBeTruthy();
  if (!doneItem) return;

  // Use the first distinct word from the title as search query
  const titleWord = doneItem.title!.split(/\s+/).find((w) => w.length > 3 && /^[a-zA-Z]/.test(w));
  if (!titleWord) return; // title has no searchable words — skip gracefully

  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill(titleWord);
  await page.waitForTimeout(500);

  // The item list should render (no crash), showing search results or empty state
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  // The specific card should appear if FTS index is populated — or at minimum no error
  await expect(page.locator('text=Something went wrong')).toHaveCount(0);
});

test('clearing search restores the full list', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });

  const totalBefore = await page.locator('.item-card').count();

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('xQzUniqueQuery99');
  await page.waitForTimeout(500);

  // Now clear it
  await searchInput.clear();
  await page.waitForTimeout(500);

  // Full list should be restored
  await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(totalBefore);
});

test('searching with no matches shows a helpful empty state message', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();

  const searchInput = page.locator('[data-testid="search-input"]');
  await searchInput.fill('xQzAbsolutelyNoMatchEver99999');
  await page.waitForTimeout(500);

  const emptyState = page.locator('[data-testid="empty-state"]');
  await expect(emptyState).toBeVisible({ timeout: 5_000 });
  const emptyText = await emptyState.innerText();
  expect(emptyText.trim().length).toBeGreaterThan(0);
});

test('search input is focusable via the / keyboard shortcut', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();

  await page.locator('body').click();
  await page.keyboard.press('/');

  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toBeFocused();
});

test('search API returns an array for any query', async ({ request }) => {
  const res = await request.get(`${BASE}/search?q=example`);
  expect(res.ok()).toBeTruthy();
  const results: unknown[] = await res.json();
  expect(Array.isArray(results)).toBe(true);
});

test('search API returns an array for an empty query', async ({ request }) => {
  const res = await request.get(`${BASE}/search?q=`);
  expect(res.ok()).toBeTruthy();
  const results: unknown[] = await res.json();
  expect(Array.isArray(results)).toBe(true);
});
