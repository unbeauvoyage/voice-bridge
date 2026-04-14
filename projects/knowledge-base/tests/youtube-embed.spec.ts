import { test, expect } from '@playwright/test';
import { execSync } from 'child_process';
import { fileURLToPath } from 'url';
import * as path from 'path';

const BASE = 'http://127.0.0.1:3737';
const TEST_VIDEO_ID = 'dQw4w9WgXcQ';
const TEST_YT_URL = `https://www.youtube.com/watch?v=${TEST_VIDEO_ID}`;
const SEED_SCRIPT = path.join(path.dirname(fileURLToPath(import.meta.url)), 'seed-youtube-item.ts');

function seedYoutubeItem(id: string, url: string, title: string): void {
  execSync(`bun ${SEED_SCRIPT} seed "${id}" "${url}" "${title}"`, { timeout: 5000 });
}

function cleanupItem(id: string): void {
  execSync(`bun ${SEED_SCRIPT} cleanup "${id}"`, { timeout: 5000 });
}

test('YouTube item shows embedded video player in reader pane', async ({ page }) => {
  const itemId = `yt-embed-test-${Date.now()}`;
  const title = 'Test YouTube Video for Embed';

  seedYoutubeItem(itemId, TEST_YT_URL, title);

  try {
    await page.goto(BASE);
    await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 5000 });

    // Search for our test item
    const searchInput = page.locator('[data-testid="search-input"]');
    await searchInput.fill(title);

    // Find and click the item card
    const itemCard = page.locator('.item-card').filter({ hasText: title }).first();
    await expect(itemCard).toBeVisible({ timeout: 10_000 });
    await itemCard.click();

    // Reader pane should open
    await expect(page.locator('.reader-pane .reader-title')).toBeVisible({ timeout: 5000 });

    // Assert: an iframe with YouTube embed src is visible
    const youtubeEmbed = page.locator(`iframe[src*="youtube.com/embed/${TEST_VIDEO_ID}"]`);
    await expect(youtubeEmbed).toBeVisible({ timeout: 5000 });
  } finally {
    cleanupItem(itemId);
  }
});
