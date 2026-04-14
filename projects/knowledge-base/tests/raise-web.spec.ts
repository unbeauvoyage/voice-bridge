import { test, expect } from '@playwright/test';
import { spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = 'http://127.0.0.1:3737';
const __filename = fileURLToPath(import.meta.url);
const __dirnameLocal = dirname(__filename);
const ROOT = join(__dirnameLocal, '..');
const DB_PATH = join(ROOT, 'knowledge', 'knowledge.db');

// Web app "Raise to Consideration" parity with the extension:
// - Clicking 🚩 Raise in the reader opens an inline form (not a one-shot POST)
// - The form has a textarea for a note + Raise button
// - Once raised, the button stays clickable (not disabled), shows green/raised
// - Clicking the raised button reopens the form in edit mode with the note pre-filled
// - The form shows Update + Unraise in edit mode

// Seed a dedicated done item so tests don't race with other specs that mutate
// the "first done item" (e.g. raise-popup.spec.ts). Done items are inserted
// directly into SQLite so Ollama does not have to run and there is no queue race.
function seedDoneItem(): string {
  const id = `test-raise-web-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const url = `https://example.com/raise-web-${id}`;
  // Use current time. The card is found via data-id so ordering doesn't
  // matter for raise-web itself, but we want it near the top so the default
  // view renders it without scrolling/virtualization.
  const now = new Date().toISOString();
  const script = `
    const { Database } = require('bun:sqlite');
    const db = new Database(${JSON.stringify(DB_PATH)});
    db.exec("PRAGMA busy_timeout = 5000");
    db.prepare(\`INSERT INTO items (id, url, type, title, status, summary, date_added, retries)
                VALUES (?, ?, 'web', 'Raise Web Test Item', 'done', 'seeded for raise-web test', ?, 0)\`)
      .run(${JSON.stringify(id)}, ${JSON.stringify(url)}, ${JSON.stringify(now)});
    db.close();
  `;
  const result = spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  if (result.status !== 0) {
    throw new Error(`seedDoneItem failed: ${result.stderr || result.stdout}`);
  }
  return id;
}

function deleteItem(id: string): void {
  const script = `
    const { Database } = require('bun:sqlite');
    const db = new Database(${JSON.stringify(DB_PATH)});
    db.exec("PRAGMA busy_timeout = 5000");
    db.prepare("DELETE FROM considerations WHERE item_id = ?").run(${JSON.stringify(id)});
    db.prepare("DELETE FROM items WHERE id = ?").run(${JSON.stringify(id)});
    db.close();
  `;
  spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
}

async function openSeededItem(page: import('@playwright/test').Page, id: string): Promise<void> {
  // Clear any existing consideration so tests start clean.
  await page.request.delete(`${BASE}/items/${id}/consider`);
  await page.goto(`${BASE}/`);
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  const card = page.locator(`.item-card[data-id="${id}"]`);
  await expect(card).toBeVisible({ timeout: 5000 });
  await card.click();
  await expect(page.locator('[data-testid="reader-raise-btn"]')).toBeVisible({ timeout: 5000 });
}

test('clicking raise in the reader opens an inline form with a note textarea', async ({ page }) => {
  const id = seedDoneItem();
  try {
    await openSeededItem(page, id);
    const btn = page.locator('[data-testid="reader-raise-btn"]');
    await expect(btn).toHaveText(/Raise/);
    await btn.click();
    const form = page.locator('[data-testid="reader-raise-form"]');
    await expect(form).toBeVisible();
    const textarea = form.locator('textarea');
    await expect(textarea).toBeVisible();
    await textarea.fill('this is why I raised it');
    await expect(textarea).toHaveValue('this is why I raised it');
    // Submit
    await form.locator('button', { hasText: /^Raise$/ }).click();
    await expect(form).not.toBeVisible();
    await expect(btn).toHaveClass(/raised/);
    await expect(btn).toHaveText(/Raised/);
  } finally {
    deleteItem(id);
  }
});

test('the raised button stays clickable and reopens the form in edit mode with the note pre-filled', async ({ page }) => {
  const id = seedDoneItem();
  try {
    await openSeededItem(page, id);
    // Seed a raised state directly via API so we don't depend on the UI flow.
    await page.request.post(`${BASE}/items/${id}/consider`, {
      data: { note: 'seed note — pre-filled' },
    });
    // Reload so the reader re-fetches the consider state.
    await page.reload();
    await page.locator(`.item-card[data-id="${id}"]`).click();
    const btn = page.locator('[data-testid="reader-raise-btn"]');
    await expect(btn).toHaveClass(/raised/, { timeout: 5000 });
    // Must NOT be disabled.
    await expect(btn).not.toHaveAttribute('disabled', '');
    const disabled = await btn.getAttribute('disabled');
    expect(disabled).toBeNull();

    await btn.click();
    const form = page.locator('[data-testid="reader-raise-form"]');
    await expect(form).toBeVisible();
    const textarea = form.locator('textarea');
    await expect(textarea).toHaveValue('seed note — pre-filled');
    // In edit mode the confirm button reads Update and an Unraise link is present.
    await expect(form.locator('button', { hasText: /^Update$/ })).toBeVisible();
    await expect(form.locator('[data-testid="reader-raise-unraise"]')).toBeVisible();

    // Edit the note and update.
    await textarea.fill('updated note');
    await form.locator('button', { hasText: /^Update$/ }).click();
    await expect(form).not.toBeVisible();
    // Re-open to verify the update persisted.
    await btn.click();
    await expect(form.locator('textarea')).toHaveValue('updated note');

    // Unraise: button returns to 🚩 Raise state.
    await form.locator('[data-testid="reader-raise-unraise"]').click();
    await expect(form).not.toBeVisible();
    await expect(btn).not.toHaveClass(/raised/);
    await expect(btn).toHaveText(/Raise/);
  } finally {
    deleteItem(id);
  }
});
