/**
 * refactor-extracted-components.spec.ts
 * 
 * Verifies that the extracted KnowledgeListHeader and KnowledgeSearchBar
 * components are properly exported and functional.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('search bar component is rendered and functional', async ({ page }) => {
  await page.goto(BASE + '/');
  
  // Search input should be visible (part of the search bar component)
  const searchInput = page.locator('[data-testid="search-input"]');
  await expect(searchInput).toBeVisible();
  
  // Should have the semantic toggle (part of search bar)
  const semanticToggle = page.locator('.semantic-toggle');
  await expect(semanticToggle).toBeVisible();
  
  // Clear button should appear when search text is entered
  await searchInput.fill('test');
  const clearBtn = page.locator('.header-clear-btn');
  await expect(clearBtn).toBeVisible();
});

test('header filters and sort component is rendered', async ({ page }) => {
  await page.goto(BASE + '/');
  
  // Date filter buttons should be present (part of header component)
  const dateFilters = page.locator('[data-testid="date-filters"]');
  await expect(dateFilters).toBeVisible();
  
  // Starred button should be present
  const starredBtn = page.locator('.starred-filter-btn');
  await expect(starredBtn).toBeVisible();
  
  // Sort dropdown should be present
  const sortSelect = page.locator('.sort-select');
  await expect(sortSelect).toBeVisible();
  
  // Presets button should be present
  const presetsBtn = page.locator('.header-presets-btn');
  await expect(presetsBtn).toBeVisible();
});

test('presets and bulk add buttons are rendered', async ({ page }) => {
  await page.goto(BASE + '/');

  // Presets button should be visible and functional
  const presetsBtn = page.locator('.header-presets-btn');
  await expect(presetsBtn).toBeVisible();

  // Bulk Add button should be visible
  const bulkAddBtn = page.locator('.header-bulk-btn');
  await expect(bulkAddBtn).toBeVisible();

  // Collections button should be visible
  const collectionsBtn = page.locator('.header-collections-btn');
  await expect(collectionsBtn).toBeVisible();

  // Tags button should be visible
  const tagsBtn = page.locator('.header-tags-btn');
  await expect(tagsBtn).toBeVisible();
});

