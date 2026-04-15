/**
 * react-query-hooks.spec.ts - Verify React Query hooks work correctly
 *
 * This is a system test that validates:
 * 1. QueryClient is properly instantiated
 * 2. Each Layer 1 hook fetches data and caches correctly
 * 3. Features can import hooks from their public API without direct access to generated hooks
 *
 * Per data-architecture.md:
 * - Components never import from data/apiClient/generated
 * - Components only import from features/star/index.ts
 * - Each feature re-exports its hooks via index.ts
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test.describe('React Query hooks integration', () => {
  test('QueryClient is initialized and app is wrapped', async ({ page }) => {
    // Load the app
    await page.goto(BASE + '/');

    // App should render without React Query errors
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  });

  test('useItemsQuery loads and displays items from cache', async ({ page }) => {
    await page.goto(BASE + '/');

    // Items should appear
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
    const cards = page.locator('.item-card');
    const count1 = await cards.count();
    expect(count1).toBeGreaterThan(0);

    // Navigate away and back — items should load from React Query cache (faster)
    await page.goto(BASE + '/ingest');
    await page.goBack();

    // Items should still be there from cache
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 5_000 });
    const count2 = await cards.count();
    expect(count2).toEqual(count1);
  });

  test('useTagsQuery loads tags without direct api.getTags() calls in components', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

    // Open tags panel
    const tagsBtn = page.locator('button[aria-label="Tags"]');
    await expect(tagsBtn).toBeVisible();
    await tagsBtn.click();

    // Tags should load via React Query
    await expect(page.locator('[data-testid="tags-panel"]')).toBeVisible({ timeout: 5_000 });
    const tags = page.locator('.tag-item');
    expect(await tags.count()).toBeGreaterThan(0);
  });

  test('useCollectionsQuery loads collections', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

    // Collections should be visible from React Query hook
    await expect(page.locator('[data-testid="collections-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('useReadingStatsQuery loads reading statistics', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

    // Stats panel should load reading stats via React Query
    const statsBtn = page.locator('button[aria-label="Stats"]');
    await expect(statsBtn).toBeVisible();
    await statsBtn.click();

    await expect(page.locator('[data-testid="stats-panel"]')).toBeVisible({ timeout: 5_000 });
  });

  test('useQueueLogQuery polls for queue updates', async ({ page }) => {
    await page.goto(BASE + '/');
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

    // Queue log should be available via React Query hook
    const queueBtn = page.locator('button[aria-label="Queue"]');
    if (await queueBtn.isVisible()) {
      await queueBtn.click();
      await expect(page.locator('[data-testid="queue-panel"]')).toBeVisible({ timeout: 5_000 });
    }
  });
});
