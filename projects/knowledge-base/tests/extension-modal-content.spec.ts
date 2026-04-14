import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { execSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');
const SEED_SCRIPT = join(__dirname, 'seed-youtube-item.ts');

// These tests load the real popup.html against the real server and exercise
// the modal content the CEO sees when clicking an item. They guard the pieces
// of the extension UI that have no dedicated test today: TL;DR rendering,
// section titles / key points, approved tag chips, the "Read in app" button
// URL, and DELETE via the modal trash icon.

type DoneItem = {
  id: string;
  title: string;
  url: string;
  status: string;
  tags: string[];
  tldr: string[];
  sections?: Array<{ title: string; points: string[] }>;
  summary?: string;
};

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

async function pickDoneItem(
  request: import('@playwright/test').APIRequestContext,
  pred: (i: DoneItem) => boolean = () => true,
): Promise<DoneItem> {
  // Retry GET /items — SQLITE_BUSY can briefly 500 when parallel workers write.
  let items: DoneItem[] = [];
  for (let i = 0; i < 5; i++) {
    const r = await request.get('http://127.0.0.1:3737/items');
    if (r.ok()) { items = (await r.json()) as DoneItem[]; break; }
    await new Promise((res) => setTimeout(res, 300));
  }
  const match = items.find(
    (i) => i.status === 'done' && pred(i),
  );
  if (!match) throw new Error('No suitable done item found');
  // Fetch full item to get sections/tldr populated
  const full = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(match.id)}`);
  expect(full.ok()).toBeTruthy();
  return (await full.json()) as DoneItem;
}

test('modal shows TLDR bullets for a done item', async ({ page, request }) => {
  const item = await pickDoneItem(request, (i) => Array.isArray(i.tldr) && i.tldr.length > 0);
  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${item.id}"]`).click();

  const overlay = page.locator('#modal-overlay');
  await expect(overlay).toHaveClass(/visible/);
  await expect(page.locator('#modal-title')).toHaveText(item.title, { timeout: 5000 });

  const tldrLines = page.locator('.modal-tldr .modal-tldr-line');
  await expect(tldrLines.first()).toBeVisible();
  expect(await tldrLines.count()).toBe(item.tldr.length);
  await expect(tldrLines.first()).toHaveText(item.tldr[0]!);
});

test('modal shows section titles and key points for a done item', async ({ page, request }) => {
  const item = await pickDoneItem(
    request,
    (i) => Array.isArray(i.sections) && (i.sections?.length ?? 0) > 0,
  );
  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${item.id}"]`).click();

  const sectionTitles = page.locator('.modal-section-title');
  await expect(sectionTitles.first()).toBeVisible({ timeout: 5000 });
  const firstSection = item.sections![0]!;
  await expect(sectionTitles.first()).toHaveText(firstSection.title);

  // First section's first point is rendered in the following <ul.modal-points>
  const firstPoints = page.locator('.modal-points').first().locator('li');
  await expect(firstPoints.first()).toHaveText(firstSection.points[0]!);
});

test('modal shows approved tag chips on a done item', async ({ page, request }) => {
  const item = await pickDoneItem(request, (i) => Array.isArray(i.tags) && i.tags.length > 0);
  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${item.id}"]`).click();

  const modalTags = page.locator('#modal-body .modal-tag');
  await expect(modalTags.first()).toBeVisible({ timeout: 5000 });
  // At least one chip rendered
  expect(await modalTags.count()).toBeGreaterThan(0);
});

test('modal Read in app button opens the correct item URL', async ({ page, request }) => {
  const item = await pickDoneItem(request);
  await loadPopup(page);

  await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  await page.locator(`.item-title[data-id="${item.id}"]`).click();

  const readInApp = page.locator('#modal-read-in-app');
  await expect(readInApp).toBeVisible();

  // Clear any tab opens from rendering (quick-summary title link doesn't fire
  // on load, but we normalize for robustness).
  await page.evaluate(() => ((window as any).__tabCreates = []));
  await readInApp.click();

  const created = await page.evaluate(() => (window as any).__tabCreates as string[]);
  expect(created.length).toBe(1);
  expect(created[0]).toBe(`http://127.0.0.1:3737/?item=${encodeURIComponent(item.id)}`);
});

test('modal delete button removes the item from the list', async ({ page, request }) => {
  // Seed a done item directly into the DB so it renders in /items immediately.
  const seedId = `modal-delete-test-${Date.now()}`;
  const seedUrl = `https://example.com/modal-delete-${Date.now()}`;
  const seedTitle = 'Modal Delete Test Item';
  // SQLite write from a second process can race with the server — retry on BUSY.
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
  if (!seeded) throw new Error('Failed to seed modal delete test item after retries');

  try {
    await loadPopup(page);
    await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });

    // Auto-accept the browser confirm() dialog.
    page.on('dialog', (d) => d.accept());

    const titleSelector = `.item-title[data-id="${seedId}"]`;
    await expect(page.locator(titleSelector)).toBeVisible({ timeout: 10000 });
    await page.locator(titleSelector).click();

    const deleteBtn = page.locator('#modal-delete');
    await expect(deleteBtn).toBeVisible();
    await deleteBtn.click();

    // Verify server-side deletion — the item must be gone.
    await expect.poll(async () => {
      const r = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(seedId)}`);
      return r.status();
    }, { timeout: 5000 }).toBe(404);
  } finally {
    // Defensive cleanup in case the test failed before delete fired.
    try { execSync(`bun ${SEED_SCRIPT} cleanup "${seedId}"`, { timeout: 5000 }); } catch {}
  }
});
