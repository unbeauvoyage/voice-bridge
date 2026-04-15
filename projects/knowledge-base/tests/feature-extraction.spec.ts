/**
 * Feature extraction verification tests.
 *
 * These tests assert that extracted feature modules are importable from
 * their target locations and that the app still renders correctly after
 * the refactor.  They must FAIL before the extraction is done and PASS
 * after.
 */

import { test, expect } from '@playwright/test';
import * as fs from 'node:fs';
import { fileURLToPath } from 'node:url';
import * as path from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../web');

// ---------------------------------------------------------------------------
// Utility: file-system existence checks (run in-process, no browser needed)
// ---------------------------------------------------------------------------

test('shared/utils/dates.ts exists and exports date helpers', () => {
  const filePath = path.join(ROOT, 'src/shared/utils/dates.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('formatDate');
  expect(src).toContain('timeAgo');
  expect(src).toContain('ageClass');
  expect(src).toContain('formatRelativeDate');
});

test('shared/utils/strings.ts exists and exports string helpers', () => {
  const filePath = path.join(ROOT, 'src/shared/utils/strings.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('escapeHtml');
  expect(src).toContain('slugify');
});

test('shared/utils/text.ts exists and exports readingStats', () => {
  const filePath = path.join(ROOT, 'src/shared/utils/text.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('readingStats');
});

test('shared/utils/type-guards.ts exists and exports type guards', () => {
  const filePath = path.join(ROOT, 'src/shared/utils/type-guards.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  // These guards are in web/src/types.ts — the task says to move them here
  // For now just verify the file exists and has content
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src.length).toBeGreaterThan(0);
});

test('knowledge-ingest/components/BulkAddModal.tsx exists', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-ingest/components/BulkAddModal.tsx');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('BulkAddModal');
});

test('knowledge-ingest/index.ts exports BulkAddModal', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-ingest/index.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('BulkAddModal');
});

test('tags/components/TagCloudPanel.tsx exists', () => {
  const filePath = path.join(ROOT, 'src/features/tags/components/TagCloudPanel.tsx');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('TagCloudPanel');
});

test('tags/index.ts exports TagCloudPanel', () => {
  const filePath = path.join(ROOT, 'src/features/tags/index.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('TagCloudPanel');
});

test('knowledge-reader/components/ExportButton.tsx exists', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-reader/components/ExportButton.tsx');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('ExportButton');
});

test('knowledge-reader/index.ts exports ExportButton', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-reader/index.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('ExportButton');
});

test('knowledge-reader/domain/transcript.ts exists with transcript helpers', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-reader/domain/transcript.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('buildTranscriptHtml');
  expect(src).toContain('formatTranscript');
  expect(src).toContain('countMatches');
  expect(src).toContain('TIMESTAMP_RE');
});

test('knowledge-reader/domain/related.ts exists with computeRelated', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-reader/domain/related.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('computeRelated');
});

test('knowledge-ingest/domain/ephemeral.ts exists with makeEphemeralItem', () => {
  const filePath = path.join(ROOT, 'src/features/knowledge-ingest/domain/ephemeral.ts');
  expect(fs.existsSync(filePath), `Expected ${filePath} to exist`).toBe(true);
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).toContain('makeEphemeralItem');
});

test('app.tsx does not define BulkAddModal inline', () => {
  const filePath = path.join(ROOT, 'app.tsx');
  const src = fs.readFileSync(filePath, 'utf-8');
  // Should not have a local function definition — it must import from feature
  expect(src).not.toMatch(/^function BulkAddModal/m);
});

test('app.tsx does not define TagCloudPanel inline', () => {
  const filePath = path.join(ROOT, 'app.tsx');
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).not.toMatch(/^function TagCloudPanel/m);
});

test('app.tsx does not define ReaderPane inline', () => {
  const filePath = path.join(ROOT, 'app.tsx');
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).not.toMatch(/^function ReaderPane/m);
});

test('app.tsx does not define ExportButton inline', () => {
  const filePath = path.join(ROOT, 'app.tsx');
  const src = fs.readFileSync(filePath, 'utf-8');
  expect(src).not.toMatch(/^function ExportButton/m);
});

// ---------------------------------------------------------------------------
// Browser-level smoke check: app still loads and renders correctly
// ---------------------------------------------------------------------------

test('app renders item list and reader pane after extraction', async ({ page }) => {
  await page.goto('http://127.0.0.1:3737');

  // Item list container is visible
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({
    timeout: 15_000,
  });

  // Reader empty state is present
  await expect(page.locator('.reader-empty')).toBeVisible({ timeout: 5_000 });
});

test('BulkAddModal opens correctly from the extracted feature', async ({
  page,
}) => {
  await page.goto('http://127.0.0.1:3737');

  // Wait for the page to load
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({
    timeout: 15_000,
  });

  // The "+ Bulk Add" button in the header
  const addBtn = page.locator('.header-bulk-btn');
  await expect(addBtn).toBeVisible({ timeout: 5_000 });
  await addBtn.click();

  // Modal appears — the panel is rendered by the extracted BulkAddModal
  await expect(page.locator('.modal-panel')).toBeVisible({ timeout: 5_000 });
  // Modal has the tab "Paste URLs"
  await expect(page.locator('.modal-tab').first()).toBeVisible();
});
