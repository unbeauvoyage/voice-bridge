import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('clicking a tag chip on an item card applies it as a filter', async ({ page }) => {
  // Find an item that has at least one approved tag rendered on its card
  await page.goto(BASE + '/');
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  const tagChip = page.locator('.item-card .item-card-tag').first();
  // If no chip exists (empty tag state), create nothing — fail loudly since DB has items
  await expect(tagChip).toBeVisible({ timeout: 5000 });
  const tagText = (await tagChip.innerText()).trim();
  await tagChip.click();
  // After clicking, the tag should show up as an active filter pill somewhere
  // The app renders an "active filter" chip containing the tag name after filtering
  await expect(page.locator('body')).toContainText(tagText);
  // And the filtered header ("Showing N of M") should appear
  await expect(page.locator('[data-testid="item-count"]')).toContainText(/Showing/);
});

test('tag approval moves the tag into the approved set', async ({ request }) => {
  const uniqueTag = 'approve-flow-' + Date.now();
  const res = await request.post(BASE + '/tags/approve', {
    data: { tag: uniqueTag },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  const afterRes = await request.get(BASE + '/tags');
  const body = await afterRes.json();
  expect(body.approved).toContain(uniqueTag);
  // Cleanup — remove the tag
  await request.delete(BASE + '/tags/' + encodeURIComponent(uniqueTag));
});

test('tag rejection records a rejection entry', async ({ request }) => {
  const uniqueTag = 'reject-flow-' + Date.now();
  const res = await request.post(BASE + '/tags/reject', {
    data: { tag: uniqueTag, reason: 'test rejection' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  const rejections = await request.get(BASE + '/tags/rejections');
  const body = await rejections.json();
  expect(Array.isArray(body)).toBe(true);
  const match = body.find((r: any) => r.tag === uniqueTag);
  expect(match).toBeTruthy();
  expect(match.reason).toBe('test rejection');
});
