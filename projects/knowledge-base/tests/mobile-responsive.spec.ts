import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';
const MOBILE = { width: 375, height: 812 }; // iPhone 13/14

// Ensure at least one done item exists so the list is non-empty and clickable.
async function ensureDoneItem(request: import('@playwright/test').APIRequestContext): Promise<string | null> {
  const res = await request.get(`${BASE}/items`);
  if (!res.ok()) return null;
  const all = await res.json() as Array<{ id: string; status: string }>;
  const done = all.find((it) => it.status === 'done');
  return done ? done.id : null;
}

test.describe('mobile responsive layout', () => {
  test.use({ viewport: MOBILE });

  test('item list is full width on mobile viewport', async ({ page }) => {
    await page.goto(BASE);
    const list = page.locator('[data-testid="item-list"]');
    await expect(list).toBeVisible();
    const box = await list.boundingBox();
    expect(box).not.toBeNull();
    // Full width means at least 360px on a 375px viewport (allow small scrollbar/padding)
    expect(box!.width).toBeGreaterThanOrEqual(360);
  });

  test('no horizontal scroll on mobile viewport', async ({ page }) => {
    await page.goto(BASE);
    await page.waitForSelector('[data-testid="item-list"]');
    const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
    expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width);
  });

  test('opening an item hides the list and shows the reader full width on mobile', async ({ page, request }) => {
    const doneId = await ensureDoneItem(request);
    if (!doneId) {
      // No data — seed a minimal item via API
      const r = await request.post(`${BASE}/process`, {
        data: { url: `https://example.com/mobile-test-${Date.now()}` },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(r.ok()).toBeTruthy();
    }
    await page.goto(BASE);
    const list = page.locator('[data-testid="item-list"]');
    await expect(list).toBeVisible();

    // Wait for at least one card to render
    const firstCard = page.locator('.item-card').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();

    // Reader pane visible full-width
    const reader = page.locator('.reader-pane').first();
    await expect(reader).toBeVisible();
    const readerBox = await reader.boundingBox();
    expect(readerBox).not.toBeNull();
    expect(readerBox!.width).toBeGreaterThanOrEqual(360);

    // Item list is hidden (display: none) on mobile when reader is open
    const listVisible = await list.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetWidth > 0;
    });
    expect(listVisible).toBe(false);
  });

  test('back button returns from reader to list on mobile', async ({ page, request }) => {
    const doneId = await ensureDoneItem(request);
    if (!doneId) {
      const r = await request.post(`${BASE}/process`, {
        data: { url: `https://example.com/mobile-back-${Date.now()}` },
        headers: { 'Content-Type': 'application/json' },
      });
      expect(r.ok()).toBeTruthy();
    }
    await page.goto(BASE);

    const firstCard = page.locator('.item-card').first();
    await firstCard.waitFor({ state: 'visible', timeout: 10000 });
    await firstCard.click();

    const backBtn = page.locator('.reader-back-btn').first();
    await expect(backBtn).toBeVisible();

    // Tap target — min 44px on mobile
    const bbox = await backBtn.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox!.height).toBeGreaterThanOrEqual(44);

    await backBtn.click();

    // Item list is visible again, reader-empty or reader hidden
    const list = page.locator('[data-testid="item-list"]');
    await expect(list).toBeVisible();
  });

  test('hamburger toggle reveals filter controls on mobile', async ({ page }) => {
    await page.goto(BASE);
    const hamburger = page.locator('[data-testid="mobile-menu-toggle"]');
    await expect(hamburger).toBeVisible();

    // Tap target — min 44px
    const bbox = await hamburger.boundingBox();
    expect(bbox).not.toBeNull();
    expect(bbox!.height).toBeGreaterThanOrEqual(44);
    expect(bbox!.width).toBeGreaterThanOrEqual(44);

    // Filter controls (date buttons) hidden by default on mobile
    const dateFilters = page.locator('[data-testid="date-filters"]');
    const hiddenBefore = await dateFilters.evaluate((el) => {
      const style = window.getComputedStyle(el);
      return style.display === 'none' || (el as HTMLElement).offsetHeight === 0;
    });
    expect(hiddenBefore).toBe(true);

    // Click hamburger to reveal filters
    await hamburger.click();
    await expect(dateFilters).toBeVisible();
  });
});

test.describe('desktop layout unchanged', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  test('hamburger button is hidden on desktop', async ({ page }) => {
    await page.goto(BASE);
    const hamburger = page.locator('[data-testid="mobile-menu-toggle"]');
    // Either not in DOM or display:none
    const count = await hamburger.count();
    if (count > 0) {
      const hidden = await hamburger.evaluate((el) => {
        const style = window.getComputedStyle(el);
        return style.display === 'none';
      });
      expect(hidden).toBe(true);
    }
  });

  test('desktop shows both list and reader side by side', async ({ page }) => {
    await page.goto(BASE);
    const list = page.locator('[data-testid="item-list"]');
    await expect(list).toBeVisible();
    const listBox = await list.boundingBox();
    expect(listBox).not.toBeNull();
    // On desktop the list is the narrow ~280px pane
    expect(listBox!.width).toBeLessThan(400);
  });
});
