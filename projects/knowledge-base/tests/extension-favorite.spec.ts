import { test, expect } from '@playwright/test';
import { readFileSync, existsSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

// Resolve project root: works from main project dir and from worktrees
// (.../knowledge-base/tests/ OR .../knowledge-base/.claude/worktrees/X/tests/)
function findProjectRoot(start: string): string {
  // Try parent dir first (normal case: knowledge-base/tests/ -> knowledge-base/)
  const candidate1 = resolve(start, '..');
  if (existsSync(resolve(candidate1, 'knowledge', 'knowledge.db'))) return candidate1;
  // Try 4 levels up (worktree case: worktrees/X/tests/ -> knowledge-base/)
  const candidate2 = resolve(start, '../../../..');
  if (existsSync(resolve(candidate2, 'knowledge', 'knowledge.db'))) return candidate2;
  // Fallback to parent
  return candidate1;
}
const PROJECT_ROOT = findProjectRoot(__dirname);
const SEED_SCRIPT = resolve(PROJECT_ROOT, 'tests', 'seed-youtube-item.ts');
const DB_PATH = resolve(PROJECT_ROOT, 'knowledge', 'knowledge.db');

async function loadPopup(page: import('@playwright/test').Page) {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  await page.addInitScript(() => {
    (window as any).__tabCreates = [];
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com/unsaved-test-url' }],
        create: (opts: { url?: string }) => {
          (window as any).__tabCreates.push(opts?.url || '');
        },
      },
    };
  });
  const rewritten = popupHtml
    .replace(
      '<script src="raise-form.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
    )
    .replace(
      '<script src="popup.js"></script>',
      `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
    );
  await page.goto('http://127.0.0.1:3737/health');
  await page.setContent(rewritten, { waitUntil: 'load' });
}

const SEED_ITEM_ID = `fav-test-${Date.now()}`;
const SEED_ITEM_URL = `https://example.com/fav-test-${Date.now()}`;
const SEED_ITEM_TITLE = 'Favorite Star Test Item';

test.beforeAll(() => {
  execSync(
    `bun ${SEED_SCRIPT} seed "${SEED_ITEM_ID}" "${SEED_ITEM_URL}" "${SEED_ITEM_TITLE}"`,
    { timeout: 5000 },
  );
  // Ensure item starts with starred=0
  execSync(
    `bun -e "const {Database}=require('bun:sqlite');const db=new Database('${DB_PATH}');db.run('UPDATE items SET starred=0 WHERE id=?',['${SEED_ITEM_ID}']);db.close()"`,
    { timeout: 5000 },
  );
});

test.afterAll(() => {
  try {
    execSync(
      `bun ${SEED_SCRIPT} cleanup "${SEED_ITEM_ID}"`,
      { timeout: 5000 },
    );
  } catch {}
});

test('toggling favorite in extension modal persists starred state', async ({ page, request }) => {
  // Confirm item starts unstarred
  const initialRes = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
  expect(initialRes.ok()).toBeTruthy();
  const initialItem = await initialRes.json();
  expect(initialItem.starred).toBeFalsy();

  await loadPopup(page);

  // Wait for item list to load
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // Open the modal for our test item
  await page.locator(`.item-title[data-id="${SEED_ITEM_ID}"]`).click();
  const overlay = page.locator('#modal-overlay');
  await expect(overlay).toHaveClass(/visible/);
  await expect(page.locator('#modal-title')).toHaveText(SEED_ITEM_TITLE, { timeout: 5000 });

  // Star button is visible in modal header
  const starBtn = page.locator('#modal-star');
  await expect(starBtn).toBeVisible();

  // Initially not filled (item is unstarred)
  await expect(starBtn).not.toHaveClass(/filled/);

  // Click the star button to favorite it
  await starBtn.click();

  // Optimistic update: icon fills immediately
  await expect(starBtn).toHaveClass(/filled/, { timeout: 2000 });

  // Verify API persisted the change
  await expect.poll(async () => {
    const r = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
    if (!r.ok()) return null;
    const data = await r.json();
    return data.starred;
  }, { timeout: 5000 }).toBeTruthy();

  // Click again to unstar
  await starBtn.click();

  // Optimistic update: icon becomes unfilled
  await expect(starBtn).not.toHaveClass(/filled/, { timeout: 2000 });

  // Verify API persisted the unstar
  await expect.poll(async () => {
    const r = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
    if (!r.ok()) return null;
    const data = await r.json();
    return data.starred;
  }, { timeout: 5000 }).toBeFalsy();
});

test('extension modal shows filled star for a pre-starred item', async ({ page, request }) => {
  // Star the item first via API
  const starRes = await request.post(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}/star`);
  expect(starRes.ok()).toBeTruthy();
  const starData = await starRes.json();
  expect(starData.starred).toBeTruthy();

  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${SEED_ITEM_ID}"]`).click();

  await expect(page.locator('#modal-overlay')).toHaveClass(/visible/);
  await expect(page.locator('#modal-title')).toHaveText(SEED_ITEM_TITLE, { timeout: 5000 });

  const starBtn = page.locator('#modal-star');
  await expect(starBtn).toBeVisible();
  // Pre-starred item shows filled star
  await expect(starBtn).toHaveClass(/filled/, { timeout: 3000 });

  // Cleanup: unstar
  await request.post(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}/star`);
});

test('star button in extension modal has correct accessibility attributes', async ({ page }) => {
  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${SEED_ITEM_ID}"]`).click();

  await expect(page.locator('#modal-overlay')).toHaveClass(/visible/);

  const starBtn = page.locator('#modal-star');
  await expect(starBtn).toBeVisible();
  await expect(starBtn).toHaveAttribute('aria-label', 'Toggle favorite');
  await expect(starBtn).toHaveAttribute('title', 'Favorite');
});
