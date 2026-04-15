import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');

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

const SEED_ITEM_ID = `archive-test-${Date.now()}`;
const SEED_ITEM_URL = `https://example.com/archive-test-${Date.now()}`;
const SEED_ITEM_TITLE = 'Archive Toggle Test Item';

test.beforeAll(() => {
  execSync(
    `bun ${resolve(__dirname, 'seed-youtube-item.ts')} seed "${SEED_ITEM_ID}" "${SEED_ITEM_URL}" "${SEED_ITEM_TITLE}"`,
    { timeout: 5000 },
  );
  // Ensure item starts unarchived
  execSync(
    `bun -e "const {Database}=require('bun:sqlite');const db=new Database('${resolve(__dirname, '..', 'knowledge', 'knowledge.db')}');db.run('UPDATE items SET archived=0 WHERE id=?',['${SEED_ITEM_ID}']);db.close()"`,
    { timeout: 5000 },
  );
});

test.afterAll(() => {
  try {
    execSync(
      `bun ${resolve(__dirname, 'seed-youtube-item.ts')} cleanup "${SEED_ITEM_ID}"`,
      { timeout: 5000 },
    );
  } catch {}
});

test('archiving an item from extension modal persists archived state', async ({ page, request }) => {
  // Confirm item starts unarchived
  const initialRes = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
  expect(initialRes.ok()).toBeTruthy();
  const initialItem = await initialRes.json();
  expect(initialItem.archived).toBeFalsy();

  await loadPopup(page);

  // Wait for item list to load
  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

  // Open the modal for our test item
  await page.locator(`.item-title[data-id="${SEED_ITEM_ID}"]`).click();
  const overlay = page.locator('#modal-overlay');
  await expect(overlay).toHaveClass(/visible/);
  await expect(page.locator('#modal-title')).toHaveText(SEED_ITEM_TITLE, { timeout: 5000 });

  // Archive button is visible in modal header
  const archiveBtn = page.locator('#modal-archive');
  await expect(archiveBtn).toBeVisible();

  // Initially shows "archive" state (not archived)
  await expect(archiveBtn).not.toHaveClass(/archived/);
  await expect(archiveBtn).toHaveAttribute('aria-label', 'Toggle archive');

  // Click to archive
  await archiveBtn.click();

  // Optimistic update: button switches to "unarchive" state
  await expect(archiveBtn).toHaveClass(/archived/, { timeout: 2000 });
  await expect(archiveBtn).toHaveAttribute('aria-label', 'Unarchive');

  // Verify API persisted the change
  await expect.poll(async () => {
    const r = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
    if (!r.ok()) return null;
    const data = await r.json();
    return data.archived;
  }, { timeout: 5000 }).toBeTruthy();

  // Click again to unarchive
  await archiveBtn.click();

  // Optimistic update: button switches back to "archive" state
  await expect(archiveBtn).not.toHaveClass(/archived/, { timeout: 2000 });
  await expect(archiveBtn).toHaveAttribute('aria-label', 'Toggle archive');

  // Verify API persisted the unarchive
  await expect.poll(async () => {
    const r = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
    if (!r.ok()) return null;
    const data = await r.json();
    return data.archived;
  }, { timeout: 5000 }).toBeFalsy();
});

test('archive button toggles to unarchive state after click', async ({ page, request }) => {
  // Ensure item is unarchived to start
  const unarchiveSetup = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}`);
  const itemData = await unarchiveSetup.json();
  if (itemData.archived) {
    // Unarchive it so it shows up in the list
    await request.post(`http://127.0.0.1:3737/items/${encodeURIComponent(SEED_ITEM_ID)}/archive`);
  }

  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${SEED_ITEM_ID}"]`).click();

  await expect(page.locator('#modal-overlay')).toHaveClass(/visible/);
  await expect(page.locator('#modal-title')).toHaveText(SEED_ITEM_TITLE, { timeout: 5000 });

  const archiveBtn = page.locator('#modal-archive');
  await expect(archiveBtn).toBeVisible();
  // Starts unarchived
  await expect(archiveBtn).not.toHaveClass(/archived/);

  // Click to archive — button should immediately switch to "unarchive" mode
  await archiveBtn.click();
  await expect(archiveBtn).toHaveClass(/archived/, { timeout: 2000 });
  await expect(archiveBtn).toHaveAttribute('aria-label', 'Unarchive');
  await expect(archiveBtn).toHaveAttribute('title', 'Unarchive');

  // Click again — button switches back to "archive" mode
  await archiveBtn.click();
  await expect(archiveBtn).not.toHaveClass(/archived/, { timeout: 2000 });
  await expect(archiveBtn).toHaveAttribute('aria-label', 'Toggle archive');
  await expect(archiveBtn).toHaveAttribute('title', 'Archive');
});

test('archive button in extension modal has correct accessibility attributes', async ({ page }) => {
  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${SEED_ITEM_ID}"]`).click();

  await expect(page.locator('#modal-overlay')).toHaveClass(/visible/);

  const archiveBtn = page.locator('#modal-archive');
  await expect(archiveBtn).toBeVisible();
  await expect(archiveBtn).toHaveAttribute('title', 'Archive');
  await expect(archiveBtn).toHaveAttribute('aria-label', 'Toggle archive');
});
