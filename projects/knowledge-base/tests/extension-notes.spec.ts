import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
// EXT_DIR points to the worktree extension; SEED_SCRIPT uses the main project
// seed helper so it can resolve the shared knowledge/ DB directory.
const EXT_DIR = resolve(__dirname, '..', 'extension');
// __dirname = .../knowledge-base/.claude/worktrees/p5-notes/tests
// main project = 4 levels up: tests → p5-notes → worktrees → .claude → knowledge-base
const MAIN_PROJECT = resolve(__dirname, '..', '..', '..', '..');
const SEED_SCRIPT = join(MAIN_PROJECT, 'tests', 'seed-youtube-item.ts');

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

test('adding a note in extension modal persists to server', async ({ page, request }) => {
  const seedId = `notes-test-${Date.now()}`;
  const seedUrl = `https://example.com/notes-test-${Date.now()}`;
  const seedTitle = 'Notes Test Item';

  // Seed a done item
  let seeded = false;
  for (let attempt = 0; attempt < 5; attempt++) {
    try {
      execSync(`bun ${SEED_SCRIPT} seed "${seedId}" "${seedUrl}" "${seedTitle}"`, { timeout: 5000 });
      seeded = true;
      break;
    } catch {
      await new Promise((r) => setTimeout(r, 300));
    }
  }
  if (!seeded) throw new Error('Failed to seed notes test item after retries');

  try {
    await loadPopup(page);
    await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

    // Open modal for the seeded item
    const titleSelector = `.item-title[data-id="${seedId}"]`;
    await expect(page.locator(titleSelector)).toBeVisible({ timeout: 10000 });
    await page.locator(titleSelector).click();

    const overlay = page.locator('#modal-overlay');
    await expect(overlay).toHaveClass(/visible/);
    await expect(page.locator('#modal-title')).toHaveText(seedTitle, { timeout: 5000 });

    // Notes section should be present in the modal
    const notesToggle = page.locator('.modal-notes-toggle');
    await expect(notesToggle).toBeVisible({ timeout: 5000 });

    // Open the details element to reveal the textarea
    await notesToggle.click();

    const notesInput = page.locator('#modal-notes-input');
    await expect(notesInput).toBeVisible();

    // Type a note
    const noteText = `Test note at ${Date.now()}`;
    await notesInput.fill(noteText);

    // Click Save note
    const saveBtn = page.locator('#modal-notes-save');
    await expect(saveBtn).toBeVisible();
    await saveBtn.click();

    // Status should show Saved
    const status = page.locator('#modal-notes-status');
    await expect(status).toContainText('Saved', { timeout: 5000 });

    // Verify server persisted the note
    const itemRes = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(seedId)}`);
    expect(itemRes.ok()).toBeTruthy();
    const item = (await itemRes.json()) as { notes?: string };
    expect(item.notes).toBe(noteText);
  } finally {
    try { execSync(`bun ${SEED_SCRIPT} cleanup "${seedId}"`, { timeout: 5000 }); } catch {}
  }
});
