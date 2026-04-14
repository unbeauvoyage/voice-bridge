import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

async function findDoneItem(
  request: any,
  predicate: (i: any) => boolean = () => true
): Promise<any | null> {
  const res = await request.get(BASE + '/items');
  const items = await res.json();
  return items.find((i: any) => i.status === 'done' && predicate(i)) ?? null;
}

async function openItemInReader(page: any, item: any) {
  // Click the exact card by data-id — robust against FTS quirks with titles
  // that contain punctuation (e.g. "?", "-") and against parallel tests
  // seeding cards that happen to land at the top of the list.
  const card = page.locator(`.item-card[data-id="${item.id}"]`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
}

test('reader pane shows TLDR bullets for a done item', async ({ page, request }) => {
  const item = await findDoneItem(
    request,
    (i) => Array.isArray(i.tldr) && i.tldr.length > 0 && i.type !== 'youtube'
  );
  expect(item, 'no done item with tldr in DB').toBeTruthy();
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await openItemInReader(page, item);
  await expect(page.locator('.reader-tldr').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.reader-tldr-line').first()).toBeVisible();
});

test('reader pane shows key points sections for a done item that has them', async ({ page, request }) => {
  const item = await findDoneItem(
    request,
    (i) => Array.isArray(i.sections) && i.sections.length > 0 && i.type !== 'youtube'
  );
  expect(item, 'no done item with sections in DB').toBeTruthy();
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await openItemInReader(page, item);
  await expect(page.locator('.reader-section-points').first()).toBeVisible({ timeout: 10000 });
  await expect(page.locator('.reader-section-title').first()).toBeVisible();
});

test('reader pane shows tag chips when the item has tags', async ({ page, request }) => {
  const item = await findDoneItem(
    request,
    (i) => Array.isArray(i.tags) && i.tags.length > 0
  );
  expect(item, 'no done item with tags in DB').toBeTruthy();
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  await openItemInReader(page, item);
  await expect(page.locator('.reader-tag').first()).toBeVisible({ timeout: 10000 });
});
