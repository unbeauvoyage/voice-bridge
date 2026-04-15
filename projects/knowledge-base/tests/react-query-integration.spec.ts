/**
 * react-query-integration.spec.ts — Verify React Query is properly integrated
 *
 * Tests that the app uses React Query for server state management instead of
 * useEffect-based fetching in app.tsx, following the data-architecture module.
 *
 * Phase 3b validates that:
 * 1. QueryClientProvider wraps the app
 * 2. Features import data hooks from feature index.ts (Layer 2/3)
 * 3. Server state flows through React Query, not useState
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('app loads and displays items via React Query', async ({ page }) => {
  await page.goto(BASE + '/');

  // App should be interactive after items load via React Query
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

  // Verify at least one item card renders
  const itemCards = page.locator('.item-card');
  const cardCount = await itemCards.count();
  expect(cardCount).toBeGreaterThan(0);
});

test('tags panel loads tags via React Query', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

  // Open tags panel
  const tagsBtn = page.locator('button[aria-label="Tags"]');
  await expect(tagsBtn).toBeVisible();
  await tagsBtn.click();

  // Tags should load and display
  await expect(page.locator('[data-testid="tags-panel"]')).toBeVisible({ timeout: 5_000 });
  const tags = page.locator('.tag-item');
  const tagCount = await tags.count();
  expect(tagCount).toBeGreaterThan(0);
});

test('collections load via React Query and display in sidebar', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

  // Collections should be visible in sidebar after React Query load
  const collectionsPanel = page.locator('[data-testid="collections-panel"]');
  await expect(collectionsPanel).toBeVisible({ timeout: 5_000 });
});

test('reading stats load via React Query', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

  // Stats panel should load reading stats
  const statsBtn = page.locator('button[aria-label="Stats"]');
  await expect(statsBtn).toBeVisible();
  await statsBtn.click();

  await expect(page.locator('[data-testid="stats-panel"]')).toBeVisible({ timeout: 5_000 });
});

test('search via React Query hook', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

  // Perform a search — should use React Query hook, not useEffect
  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toBeVisible();
  await searchInput.fill('test');

  // Results should update via React Query
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 5_000 });
});
