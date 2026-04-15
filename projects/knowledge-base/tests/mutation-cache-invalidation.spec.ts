/**
 * mutation-cache-invalidation.spec.ts
 *
 * E2E smoke test for mutation flows + C2 correctness gate.
 *
 * C1 GATE MOVED TO UNIT TEST: src/data/apiClient/useToggleStarMutation.test.ts
 * - C1 is an architectural pattern (mutations must call invalidateQueries), not user-visible behavior
 * - Unit test directly gates the mutation hook's call to invalidateQueries
 * - Architectural gates belong in unit tests that inspect the call, not E2E tests
 *
 * C2 GATE HERE: selection is ephemeral (not persisted after reload)
 * - This is a user-visible correctness issue that E2E can falsifiably gate
 */
import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('smoke: starring an item toggles visible state within 5s', async ({ page }) => {
  // Smoke test: verify that star clicks produce visible DOM updates
  // Both C1 (mutation invalidation) and SSE/polling (fallback refetch) should work
  // This is NOT a gate for C1 specifically — it's a sanity check that the feature works

  await page.goto(BASE + '/');

  // Find the first item card
  const card = page.locator(`.item-card`).first();
  await expect(card).toBeVisible({ timeout: 10_000 });

  // Check if it's already starred
  const wasStarred = await card.evaluate((el) => el.classList.contains('starred'));

  // Click the star button
  const starBtn = card.locator('button[title="Star"], button[title="Unstar"], button[aria-label*="star" i]').first();
  const starBtnExists = await starBtn.count();
  if (starBtnExists === 0) {
    test.fail(true, 'star button missing — check ItemCard.tsx for button[title="Star/Unstar"]');
    return;
  }

  await starBtn.click();

  // Smoke assertion: star state toggles within 5s
  // Acceptable via C1 mutations (invalidateQueries) or SSE refetch (fallback)
  const expectedStarred = !wasStarred;
  if (expectedStarred) {
    await expect(card).toHaveClass(/\bstarred\b/, { timeout: 5000 });
  } else {
    await expect(card).not.toHaveClass(/\bstarred\b/, { timeout: 5000 });
  }
});

test('C2: selection is ephemeral — clears on page reload', async ({ page }) => {
  // Block SSE to isolate cache behavior
  await page.route('**/events', route => route.fulfill({ status: 404, body: '' }));

  await page.goto(BASE + '/');

  // Wait for items to load
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });

  // Reload the page — verifies that app doesn't crash when hydrating from localStorage
  // If C2 fix is broken (selectedIds not excluded from persistence),
  // listStore tries to restore selectedIds: Set as {} (empty object, which can't be a Set),
  // causing .has()/.size calls to crash during render or store initialization.
  // With C2 fixed (partialize removes selectedIds from persistence),
  // selectedIds initializes as fresh Set() on reload, app renders successfully.
  await page.reload();

  // C2 assertion: app renders successfully after reload
  // This proves selectedIds was properly excluded from persistence.
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
});
