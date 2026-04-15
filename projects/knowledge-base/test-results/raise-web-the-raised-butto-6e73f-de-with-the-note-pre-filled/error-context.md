# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: raise-web.spec.ts >> the raised button stays clickable and reopens the form in edit mode with the note pre-filled
- Location: tests/raise-web.spec.ts:91:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="reader-raise-btn"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-testid="reader-raise-btn"]')

```

# Page snapshot

```yaml
- generic [ref=e2]:
  - banner [ref=e3]:
    - heading "Knowledge Base" [level=1] [ref=e4]
    - generic [ref=e5]:
      - generic [ref=e6]: ⌕
      - 'textbox "Search… or #tag" [ref=e7]'
      - generic [ref=e8] [cursor=pointer]:
        - checkbox "Semantic" [ref=e9]
        - generic [ref=e10]: Semantic
    - generic [ref=e11]:
      - button "All" [ref=e12] [cursor=pointer]
      - button "Today" [ref=e13] [cursor=pointer]
      - button "2d" [ref=e14] [cursor=pointer]
      - button "3d" [ref=e15] [cursor=pointer]
      - button "4d" [ref=e16] [cursor=pointer]
      - button "★ Starred" [ref=e17] [cursor=pointer]
      - button "📚 Study Later" [ref=e18]
      - button "📦 Archived" [ref=e19] [cursor=pointer]
    - button "⚑ 230 pending (+ 17 suggestions)" [ref=e20] [cursor=pointer]
    - button "+ Bulk Add" [ref=e21] [cursor=pointer]
    - button "Tags" [ref=e22] [cursor=pointer]
    - button "📁 Collections" [ref=e23] [cursor=pointer]
    - button "🔖 Presets" [ref=e25] [cursor=pointer]
    - button "Export" [ref=e27] [cursor=pointer]
    - button "☀️" [ref=e28] [cursor=pointer]
    - button "📊" [ref=e29]
    - button "⚙" [ref=e30] [cursor=pointer]
    - button "⚙ Queue" [ref=e31] [cursor=pointer]
    - button "?" [ref=e32] [cursor=pointer]
  - generic [ref=e33]:
    - generic [ref=e34]: ⚠️ Ollama is not running — new items cannot be summarized. Start Ollama to resume processing.
    - button "Dismiss" [ref=e35] [cursor=pointer]
  - generic [ref=e36]:
    - generic [ref=e37] [cursor=pointer]:
      - generic [ref=e38]: 📚 28/3 today
      - generic [ref=e39]: 🔥 6 day streak
    - 'generic "Daily goal: 28 of 3" [ref=e40]'
    - generic [ref=e42] [cursor=pointer]: Sources
  - generic [ref=e44]:
    - generic [ref=e45]:
      - generic [ref=e46]:
        - button "←" [ref=e47] [cursor=pointer]
        - heading "Raise Web Test Item" [level=1] [ref=e48]
        - button "⬆" [ref=e50] [cursor=pointer]
        - button "↻" [disabled] [ref=e51]
        - button "🕐" [ref=e53] [cursor=pointer]
        - button "📖" [ref=e54] [cursor=pointer]
        - button "📦" [ref=e55] [cursor=pointer]
        - button "🗑 Delete" [ref=e56] [cursor=pointer]
        - button "⛶" [ref=e57] [cursor=pointer]
      - generic [ref=e58]: ~4 words · 1 min read
    - generic [ref=e59]:
      - generic [ref=e60]: "Saved: Apr 16, 2026"
      - link "Open original →" [ref=e61] [cursor=pointer]:
        - /url: https://example.com/raise-web-test-raise-web-1776271547346-xxano
    - generic [ref=e63]:
      - generic [ref=e64]: Summary
      - button "Copy" [ref=e65] [cursor=pointer]
    - paragraph [ref=e66]: seeded for raise-web test
    - generic [ref=e68]:
      - generic [ref=e70]: Discuss
      - generic [ref=e72]: Ask anything about this article — the model has the full transcript and summary as context.
      - generic [ref=e73]:
        - textbox "Ask a question about this article…" [ref=e74]
        - button "Send" [disabled] [ref=e75]
    - generic [ref=e77]:
      - generic [ref=e78]: My Notes
      - textbox "Click to add notes..." [ref=e79]
      - button "Save Note" [ref=e81] [cursor=pointer]
    - generic [ref=e84]:
      - generic [ref=e85]: Summary quality
      - generic [ref=e86]:
        - button "☆" [ref=e87] [cursor=pointer]
        - button "☆" [ref=e88] [cursor=pointer]
        - button "☆" [ref=e89] [cursor=pointer]
        - button "☆" [ref=e90] [cursor=pointer]
        - button "☆" [ref=e91] [cursor=pointer]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { spawnSync } from 'node:child_process';
  3   | import { dirname, join } from 'node:path';
  4   | import { fileURLToPath } from 'node:url';
  5   | 
  6   | const BASE = 'http://127.0.0.1:3737';
  7   | const __filename = fileURLToPath(import.meta.url);
  8   | const __dirnameLocal = dirname(__filename);
  9   | const ROOT = join(__dirnameLocal, '..');
  10  | const DB_PATH = join(ROOT, 'knowledge', 'knowledge.db');
  11  | 
  12  | // Web app "Raise to Consideration" parity with the extension:
  13  | // - Clicking 🚩 Raise in the reader opens an inline form (not a one-shot POST)
  14  | // - The form has a textarea for a note + Raise button
  15  | // - Once raised, the button stays clickable (not disabled), shows green/raised
  16  | // - Clicking the raised button reopens the form in edit mode with the note pre-filled
  17  | // - The form shows Update + Unraise in edit mode
  18  | 
  19  | // Seed a dedicated done item so tests don't race with other specs that mutate
  20  | // the "first done item" (e.g. raise-popup.spec.ts). Done items are inserted
  21  | // directly into SQLite so Ollama does not have to run and there is no queue race.
  22  | function seedDoneItem(): string {
  23  |   const id = `test-raise-web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  24  |   const url = `https://example.com/raise-web-${id}`;
  25  |   // Use current time. The card is found via data-id so ordering doesn't
  26  |   // matter for raise-web itself, but we want it near the top so the default
  27  |   // view renders it without scrolling/virtualization.
  28  |   const now = new Date().toISOString();
  29  |   const script = `
  30  |     const { Database } = require('bun:sqlite');
  31  |     const db = new Database(${JSON.stringify(DB_PATH)});
  32  |     db.exec("PRAGMA busy_timeout = 5000");
  33  |     db.prepare(\`INSERT INTO items (id, url, type, title, status, summary, date_added, retries)
  34  |                 VALUES (?, ?, 'web', 'Raise Web Test Item', 'done', 'seeded for raise-web test', ?, 0)\`)
  35  |       .run(${JSON.stringify(id)}, ${JSON.stringify(url)}, ${JSON.stringify(now)});
  36  |     db.close();
  37  |   `;
  38  |   const result = spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  39  |   if (result.status !== 0) {
  40  |     throw new Error(`seedDoneItem failed: ${result.stderr || result.stdout}`);
  41  |   }
  42  |   return id;
  43  | }
  44  | 
  45  | function deleteItem(id: string): void {
  46  |   const script = `
  47  |     const { Database } = require('bun:sqlite');
  48  |     const db = new Database(${JSON.stringify(DB_PATH)});
  49  |     db.exec("PRAGMA busy_timeout = 5000");
  50  |     db.prepare("DELETE FROM considerations WHERE item_id = ?").run(${JSON.stringify(id)});
  51  |     db.prepare("DELETE FROM items WHERE id = ?").run(${JSON.stringify(id)});
  52  |     db.close();
  53  |   `;
  54  |   spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  55  | }
  56  | 
  57  | async function openSeededItem(page: import('@playwright/test').Page, id: string): Promise<void> {
  58  |   // Clear any existing consideration so tests start clean.
  59  |   await page.request.delete(`${BASE}/items/${id}/consider`);
  60  |   await page.goto(`${BASE}/`);
  61  |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  62  |   const card = page.locator(`.item-card[data-id="${id}"]`);
  63  |   await expect(card).toBeVisible({ timeout: 5000 });
  64  |   await card.click();
> 65  |   await expect(page.locator('[data-testid="reader-raise-btn"]')).toBeVisible({ timeout: 5000 });
      |                                                                  ^ Error: expect(locator).toBeVisible() failed
  66  | }
  67  | 
  68  | test('clicking raise in the reader opens an inline form with a note textarea', async ({ page }) => {
  69  |   const id = seedDoneItem();
  70  |   try {
  71  |     await openSeededItem(page, id);
  72  |     const btn = page.locator('[data-testid="reader-raise-btn"]');
  73  |     await expect(btn).toHaveText(/Raise/);
  74  |     await btn.click();
  75  |     const form = page.locator('[data-testid="reader-raise-form"]');
  76  |     await expect(form).toBeVisible();
  77  |     const textarea = form.locator('textarea');
  78  |     await expect(textarea).toBeVisible();
  79  |     await textarea.fill('this is why I raised it');
  80  |     await expect(textarea).toHaveValue('this is why I raised it');
  81  |     // Submit
  82  |     await form.locator('button', { hasText: /^Raise$/ }).click();
  83  |     await expect(form).not.toBeVisible();
  84  |     await expect(btn).toHaveClass(/raised/);
  85  |     await expect(btn).toHaveText(/Raised/);
  86  |   } finally {
  87  |     deleteItem(id);
  88  |   }
  89  | });
  90  | 
  91  | test('the raised button stays clickable and reopens the form in edit mode with the note pre-filled', async ({ page }) => {
  92  |   const id = seedDoneItem();
  93  |   try {
  94  |     await openSeededItem(page, id);
  95  |     // Seed a raised state directly via API so we don't depend on the UI flow.
  96  |     await page.request.post(`${BASE}/items/${id}/consider`, {
  97  |       data: { note: 'seed note — pre-filled' },
  98  |     });
  99  |     // Reload so the reader re-fetches the consider state.
  100 |     await page.reload();
  101 |     await page.locator(`.item-card[data-id="${id}"]`).click();
  102 |     const btn = page.locator('[data-testid="reader-raise-btn"]');
  103 |     await expect(btn).toHaveClass(/raised/, { timeout: 5000 });
  104 |     // Must NOT be disabled.
  105 |     await expect(btn).not.toHaveAttribute('disabled', '');
  106 |     const disabled = await btn.getAttribute('disabled');
  107 |     expect(disabled).toBeNull();
  108 | 
  109 |     await btn.click();
  110 |     const form = page.locator('[data-testid="reader-raise-form"]');
  111 |     await expect(form).toBeVisible();
  112 |     const textarea = form.locator('textarea');
  113 |     await expect(textarea).toHaveValue('seed note — pre-filled');
  114 |     // In edit mode the confirm button reads Update and an Unraise link is present.
  115 |     await expect(form.locator('button', { hasText: /^Update$/ })).toBeVisible();
  116 |     await expect(form.locator('[data-testid="reader-raise-unraise"]')).toBeVisible();
  117 | 
  118 |     // Edit the note and update.
  119 |     await textarea.fill('updated note');
  120 |     await form.locator('button', { hasText: /^Update$/ }).click();
  121 |     await expect(form).not.toBeVisible();
  122 |     // Re-open to verify the update persisted.
  123 |     await btn.click();
  124 |     await expect(form.locator('textarea')).toHaveValue('updated note');
  125 | 
  126 |     // Unraise: button returns to 🚩 Raise state.
  127 |     await form.locator('[data-testid="reader-raise-unraise"]').click();
  128 |     await expect(form).not.toBeVisible();
  129 |     await expect(btn).not.toHaveClass(/raised/);
  130 |     await expect(btn).toHaveText(/Raise/);
  131 |   } finally {
  132 |     deleteItem(id);
  133 |   }
  134 | });
  135 | 
```