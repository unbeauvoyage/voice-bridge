# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension-notes.spec.ts >> adding a note in extension modal persists to server
- Location: tests/extension-notes.spec.ts:48:1

# Error details

```
Error: Failed to seed notes test item after retries
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { readFileSync } from 'node:fs';
  3   | import { resolve, dirname, join } from 'node:path';
  4   | import { fileURLToPath } from 'node:url';
  5   | import { execSync } from 'node:child_process';
  6   | 
  7   | const __dirname = dirname(fileURLToPath(import.meta.url));
  8   | // EXT_DIR points to the worktree extension; SEED_SCRIPT uses the main project
  9   | // seed helper so it can resolve the shared knowledge/ DB directory.
  10  | const EXT_DIR = resolve(__dirname, '..', 'extension');
  11  | // __dirname = .../knowledge-base/.claude/worktrees/p5-notes/tests
  12  | // main project = 4 levels up: tests → p5-notes → worktrees → .claude → knowledge-base
  13  | const MAIN_PROJECT = resolve(__dirname, '..', '..', '..', '..');
  14  | const SEED_SCRIPT = join(MAIN_PROJECT, 'tests', 'seed-youtube-item.ts');
  15  | 
  16  | async function loadPopup(page: import('@playwright/test').Page) {
  17  |   const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  18  |   await page.addInitScript(() => {
  19  |     (window as any).__tabCreates = [];
  20  |     (window as any).chrome = {
  21  |       storage: {
  22  |         local: {
  23  |           get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
  24  |           set: (_v: unknown, cb?: () => void) => cb && cb(),
  25  |         },
  26  |       },
  27  |       tabs: {
  28  |         query: async () => [{ url: 'https://example.com/unsaved-test-url' }],
  29  |         create: (opts: { url?: string }) => {
  30  |           (window as any).__tabCreates.push(opts?.url || '');
  31  |         },
  32  |       },
  33  |     };
  34  |   });
  35  |   const rewritten = popupHtml
  36  |     .replace(
  37  |       '<script src="raise-form.js"></script>',
  38  |       `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
  39  |     )
  40  |     .replace(
  41  |       '<script src="popup.js"></script>',
  42  |       `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
  43  |     );
  44  |   await page.goto('http://127.0.0.1:3737/health');
  45  |   await page.setContent(rewritten, { waitUntil: 'load' });
  46  | }
  47  | 
  48  | test('adding a note in extension modal persists to server', async ({ page, request }) => {
  49  |   const seedId = `notes-test-${Date.now()}`;
  50  |   const seedUrl = `https://example.com/notes-test-${Date.now()}`;
  51  |   const seedTitle = 'Notes Test Item';
  52  | 
  53  |   // Seed a done item
  54  |   let seeded = false;
  55  |   for (let attempt = 0; attempt < 5; attempt++) {
  56  |     try {
  57  |       execSync(`bun ${SEED_SCRIPT} seed "${seedId}" "${seedUrl}" "${seedTitle}"`, { timeout: 5000 });
  58  |       seeded = true;
  59  |       break;
  60  |     } catch {
  61  |       await new Promise((r) => setTimeout(r, 300));
  62  |     }
  63  |   }
> 64  |   if (!seeded) throw new Error('Failed to seed notes test item after retries');
      |                      ^ Error: Failed to seed notes test item after retries
  65  | 
  66  |   try {
  67  |     await loadPopup(page);
  68  |     await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  69  | 
  70  |     // Open modal for the seeded item
  71  |     const titleSelector = `.item-title[data-id="${seedId}"]`;
  72  |     await expect(page.locator(titleSelector)).toBeVisible({ timeout: 10000 });
  73  |     await page.locator(titleSelector).click();
  74  | 
  75  |     const overlay = page.locator('#modal-overlay');
  76  |     await expect(overlay).toHaveClass(/visible/);
  77  |     await expect(page.locator('#modal-title')).toHaveText(seedTitle, { timeout: 5000 });
  78  | 
  79  |     // Notes section should be present in the modal
  80  |     const notesToggle = page.locator('.modal-notes-toggle');
  81  |     await expect(notesToggle).toBeVisible({ timeout: 5000 });
  82  | 
  83  |     // Open the details element to reveal the textarea
  84  |     await notesToggle.click();
  85  | 
  86  |     const notesInput = page.locator('#modal-notes-input');
  87  |     await expect(notesInput).toBeVisible();
  88  | 
  89  |     // Type a note
  90  |     const noteText = `Test note at ${Date.now()}`;
  91  |     await notesInput.fill(noteText);
  92  | 
  93  |     // Click Save note
  94  |     const saveBtn = page.locator('#modal-notes-save');
  95  |     await expect(saveBtn).toBeVisible();
  96  |     await saveBtn.click();
  97  | 
  98  |     // Status should show Saved
  99  |     const status = page.locator('#modal-notes-status');
  100 |     await expect(status).toContainText('Saved', { timeout: 5000 });
  101 | 
  102 |     // Verify server persisted the note
  103 |     const itemRes = await request.get(`http://127.0.0.1:3737/items/${encodeURIComponent(seedId)}`);
  104 |     expect(itemRes.ok()).toBeTruthy();
  105 |     const item = (await itemRes.json()) as { notes?: string };
  106 |     expect(item.notes).toBe(noteText);
  107 |   } finally {
  108 |     try { execSync(`bun ${SEED_SCRIPT} cleanup "${seedId}"`, { timeout: 5000 }); } catch {}
  109 |   }
  110 | });
  111 | 
```