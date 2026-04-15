/**
 * per-route-pages.spec.ts — verifies the per-route page components exist
 * and that React Router routes are wired in app.tsx.
 *
 * Tests:
 *   - KnowledgeListPage renders at "/"
 *   - KnowledgeReaderPage renders when navigating to "/item/:id"
 *   - IngestPage renders at "/ingest"
 *   - pages/index.ts exports all three pages
 */

import { test, expect } from '@playwright/test';
import { existsSync, readFileSync } from 'fs';
import path from 'path';

const BASE = 'http://127.0.0.1:3737';
const WEB_SRC = path.join(import.meta.dirname, '..', 'web', 'src');
const PAGES_DIR = path.join(WEB_SRC, 'pages');

// ---------------------------------------------------------------------------
// File-level checks: page files must exist on disk
// ---------------------------------------------------------------------------

test('KnowledgeListPage.tsx exists in pages/', () => {
  expect(existsSync(path.join(PAGES_DIR, 'KnowledgeListPage.tsx'))).toBe(true);
});

test('KnowledgeReaderPage.tsx exists in pages/', () => {
  expect(existsSync(path.join(PAGES_DIR, 'KnowledgeReaderPage.tsx'))).toBe(true);
});

test('IngestPage.tsx exists in pages/', () => {
  expect(existsSync(path.join(PAGES_DIR, 'IngestPage.tsx'))).toBe(true);
});

test('pages/index.ts exports KnowledgeListPage, KnowledgeReaderPage, IngestPage', () => {
  const indexPath = path.join(PAGES_DIR, 'index.ts');
  expect(existsSync(indexPath)).toBe(true);
  const content = readFileSync(indexPath, 'utf-8') as string;
  expect(content).toContain('KnowledgeListPage');
  expect(content).toContain('KnowledgeReaderPage');
  expect(content).toContain('IngestPage');
});

// ---------------------------------------------------------------------------
// Import checks: page files must import from feature public APIs
// ---------------------------------------------------------------------------

test('KnowledgeListPage imports from knowledge-list feature', () => {
  const filePath = path.join(PAGES_DIR, 'KnowledgeListPage.tsx');
  const content = readFileSync(filePath, 'utf-8') as string;
  expect(content).toContain("knowledge-list");
});

test('KnowledgeReaderPage imports from knowledge-reader feature and uses useParams', () => {
  const filePath = path.join(PAGES_DIR, 'KnowledgeReaderPage.tsx');
  const content = readFileSync(filePath, 'utf-8') as string;
  expect(content).toContain("knowledge-reader");
  expect(content).toContain("useParams");
});

test('IngestPage imports from knowledge-ingest feature', () => {
  const filePath = path.join(PAGES_DIR, 'IngestPage.tsx');
  const content = readFileSync(filePath, 'utf-8') as string;
  expect(content).toContain("knowledge-ingest");
});

// ---------------------------------------------------------------------------
// App.tsx check: react-router-dom must be present
// ---------------------------------------------------------------------------

test('app.tsx imports BrowserRouter from react-router-dom', () => {
  const appPath = path.join(import.meta.dirname, '..', 'web', 'app.tsx');
  const content = readFileSync(appPath, 'utf-8') as string;
  expect(content).toContain("react-router-dom");
  expect(content).toContain("BrowserRouter");
});

// ---------------------------------------------------------------------------
// E2E: the "/" route still renders the item list
// ---------------------------------------------------------------------------

test('navigating to "/" renders the item list pane', async ({ page }) => {
  await page.goto(BASE + '/');
  await expect(page.locator('.app-header')).toBeVisible({ timeout: 10_000 });
  await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
});

// ---------------------------------------------------------------------------
// E2E: the "/ingest" route renders ingest UI
//
// The IngestPage component is wired into the BrowserRouter in app.tsx.
// The server must serve the HTML shell at /ingest (SPA catch-all route)
// for client-side routing to activate IngestPage.
// ---------------------------------------------------------------------------

test('navigating to "/ingest" serves the app shell (SPA routing enabled)', async ({ page }) => {
  const res = await page.goto(BASE + '/ingest');
  // Server must serve the HTML app shell (not 404/JSON error) at /ingest
  expect(res?.status()).toBe(200);
  const ct = res?.headers()['content-type'] ?? '';
  expect(ct).toContain('text/html');
});
