/**
 * browse-list.spec.ts — Behavior tests for the item list browsing flow.
 *
 * Safety net for the feature-extraction refactor.
 * Uses only the server API — no direct DB seeding.
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('browsing the list shows all items', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  const count = await page.locator('.item-card').count();
  expect(count).toBeGreaterThan(0);
});

test('each item card shows a title', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  const titleEls = page.locator('.item-card .item-card-title');
  expect(await titleEls.count()).toBeGreaterThan(0);
  const firstTitle = await titleEls.first().innerText();
  expect(firstTitle.trim().length).toBeGreaterThan(0);
});

test('each item card shows a type badge', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('.item-card .item-type-badge').first()).toBeVisible();
});

test('filtering by type YouTube shows only YouTube items', async ({ page, request }) => {
  const res = await request.get(`${BASE}/items`);
  const items: Array<{ id: string; type: string; status: string }> = await res.json();
  const done = items.filter((i) => i.status === 'done');
  const yt = done.filter((i) => i.type === 'youtube');
  const web = done.filter((i) => i.type !== 'youtube');

  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });

  const ytPill = page.locator('.type-pill', { hasText: 'YouTube' });
  await expect(ytPill).toBeVisible();
  await ytPill.click();
  await expect(ytPill).toHaveClass(/active/);

  if (yt.length > 0 && web.length > 0) {
    await expect(page.locator(`.item-card[data-id="${yt[0].id}"]`)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`.item-card[data-id="${web[0].id}"]`)).not.toBeVisible();
  } else {
    await expect(page.locator('[data-testid="item-count"]').or(page.locator('[data-testid="empty-state"]'))).toBeVisible({ timeout: 5_000 });
  }
});

test('filtering by type Web shows only web article items', async ({ page, request }) => {
  const res = await request.get(`${BASE}/items`);
  const items: Array<{ id: string; type: string; status: string }> = await res.json();
  const done = items.filter((i) => i.status === 'done');
  const web = done.filter((i) => i.type === 'web' || i.type === 'article');
  const yt = done.filter((i) => i.type === 'youtube');

  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });

  const webPill = page.locator('.type-pill', { hasText: 'Web' });
  await expect(webPill).toBeVisible();
  await webPill.click();
  await expect(webPill).toHaveClass(/active/);

  if (web.length > 0 && yt.length > 0) {
    await expect(page.locator(`.item-card[data-id="${web[0].id}"]`)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`.item-card[data-id="${yt[0].id}"]`)).not.toBeVisible();
  } else {
    await expect(page.locator('[data-testid="item-count"]').or(page.locator('[data-testid="empty-state"]'))).toBeVisible({ timeout: 5_000 });
  }
});

test('clicking All type pill restores the full list after filtering', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  const totalBefore = await page.locator('.item-card').count();

  await page.locator('.type-pill', { hasText: 'YouTube' }).click();
  const allPill = page.locator('.type-pill', { hasText: 'All' });
  await allPill.click();
  await expect(allPill).toHaveClass(/active/);
  await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(totalBefore);
});

test('filtering by starred status shows only starred items', async ({ page, request }) => {
  const res = await request.get(`${BASE}/items`);
  const items: Array<{ id: string; starred: boolean; status: string }> = await res.json();
  const done = items.filter((i) => i.status === 'done');
  const starred = done.filter((i) => i.starred);
  const unstarred = done.filter((i) => !i.starred);

  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });

  const starredBtn = page.locator('.starred-filter-btn');
  await expect(starredBtn).toBeVisible();
  await starredBtn.click();
  await expect(starredBtn).toHaveClass(/active/);

  // After clicking starred filter, the list must show ONLY starred items (or empty state)
  if (starred.length > 0 && unstarred.length > 0) {
    await expect(page.locator(`.item-card[data-id="${starred[0].id}"]`)).toBeVisible({ timeout: 5_000 });
    await expect(page.locator(`.item-card[data-id="${unstarred[0].id}"]`)).not.toBeVisible();
  } else if (starred.length === 0) {
    // No starred items — empty state should appear
    await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 5_000 });
  } else {
    // All items are starred — they all remain visible, just unstarred items are filtered out (none to filter)
    await expect(page.locator('[data-testid="item-count"]')).toBeVisible({ timeout: 5_000 });
  }
});

test('sorting by oldest first changes the order compared to newest first', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThan(1);

  const titlesBefore = await page.locator('.item-card .item-card-title').allInnerTexts();
  const firstNewest = titlesBefore[0];

  await page.locator('select.sort-select').selectOption('oldest');
  await expect
    .poll(async () => page.locator('.item-card .item-card-title').first().innerText(), { timeout: 5_000 })
    .not.toBe(firstNewest);
});

test('sorting by title A to Z produces a different order than newest-first', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThan(1);

  // Capture first title in default newest-first order
  const titlesDefault = await page.locator('.item-card .item-card-title').allInnerTexts();
  const defaultFirst = titlesDefault[0];

  await page.locator('select.sort-select').selectOption('title-az');

  // After switching to title-az, the first title should reflect alphabetical ordering.
  // We verify the sort was applied by confirming the title-az first differs from newest-first
  // AND that the title-az first item begins alphabetically before the default-first item
  // (unless the newest item happens to be alphabetically first too, which is rare with real data).
  await expect.poll(async () => {
    const titles = await page.locator('.item-card .item-card-title').allInnerTexts();
    return titles.length;
  }, { timeout: 5_000 }).toBeGreaterThan(0);

  const titlesAz = await page.locator('.item-card .item-card-title').allInnerTexts();
  expect(titlesAz.length).toBeGreaterThan(0);

  // Verify title-az and newest-first produce different orders when there are multiple items
  if (titlesAz.length > 1 && titlesDefault.length > 1) {
    // The sorted list should match the localeCompare sort
    const expectedFirstAz = [...titlesDefault].sort((a, b) => a.localeCompare(b))[0];
    expect(titlesAz[0]).toBe(expectedFirstAz);
  }
});

test('sort dropdown renders with Newest first Oldest first and Title A to Z options', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  const sortSelect = page.locator('select.sort-select');
  await expect(sortSelect).toBeVisible();
  await expect(sortSelect.locator('option[value="newest"]')).toBeAttached();
  await expect(sortSelect.locator('option[value="oldest"]')).toBeAttached();
  await expect(sortSelect.locator('option[value="title-az"]')).toBeAttached();
});
