import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const EXT_DIR = resolve(__dirname, '..', 'extension');
const BASE = 'http://127.0.0.1:3737';

// When an item is still processing (or failed before getting a title) the
// extension should NOT display the raw "https://example.com/very/long/path"
// URL — it's ugly and not meaningful. Instead, show a cleaned-up hostname +
// truncated path, or "(untitled)". Same rule for the web app.

test('processing items show cleaned URL when no title', async ({ page }) => {
  const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');

  await page.addInitScript(() => {
    (window as any).chrome = {
      storage: {
        local: {
          get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
          set: (_v: unknown, cb?: () => void) => cb && cb(),
        },
      },
      tabs: {
        query: async () => [{ url: 'https://example.com' }],
        create: (_: unknown) => {},
      },
    };
  });

  // Processing item with NO title — simulates the bug state
  const processingItems = [
    {
      id: 'proc-raw-url',
      url: 'https://example.com/duplicate-test-1776089201234/really/long/path',
      title: null,
      status: 'processing',
      created_at: new Date().toISOString(),
    },
  ];

  await page.route('**/health', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }),
  );
  await page.route('**/items/recent**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(processingItems),
    }),
  );
  await page.route('**/items?**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/tags/pending**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '[]' }),
  );
  await page.route('**/consider**', (route) =>
    route.fulfill({ status: 200, contentType: 'application/json', body: '{"raised":false}' }),
  );
  await page.route('**/status/**', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: '{"status":"processing"}',
    }),
  );

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

  const itemTitle = page.locator('#processing-list .processing-item-title').first();
  await expect(itemTitle).toBeVisible({ timeout: 10000 });

  const displayedText = (await itemTitle.textContent())?.trim() ?? '';

  // Must not contain the raw protocol prefix
  expect(displayedText).not.toMatch(/^https?:\/\//);
  // Must not contain the literal full URL
  expect(displayedText).not.toContain('https://example.com/duplicate-test-1776089201234');
  // Should be either "(untitled)" or a cleaned hostname+path form — something
  // reasonably short and starting with the hostname
  const looksCleaned =
    displayedText === '(untitled)' ||
    displayedText.startsWith('example.com');
  expect(looksCleaned, `displayed text "${displayedText}" should be cleaned`).toBeTruthy();
});

// The reader should never display literal unescaped HTML tag characters in
// text content fields (tldr, summary, sections). Historically innerHTML was
// used in some places without escaping.

test('no raw HTML tags visible in item content', async ({ page }) => {
  await page.goto(BASE);

  // Wait for at least one item card to appear, then open the reader
  const firstCard = page.locator('.item-card').first();
  await expect(firstCard).toBeVisible({ timeout: 10000 });
  await firstCard.click();

  // Reader must render
  await expect(page.locator('.reader-title')).toBeVisible({ timeout: 5000 });

  // Scan the main reader content areas for literal tag leakage. `textContent`
  // on these elements returns only rendered text — if a tag was escaped twice
  // or pushed through innerHTML without escaping, the raw `<tag>` string
  // would appear here.
  const selectors = [
    '.reader-title',
    '.reader-tldr',
    '.reader-summary',
    '.reader-sections',
  ];
  const tagRegex = /<\/?(p|div|span|br|strong|em|h[1-6]|ul|ol|li|a)\b[^>]*>/i;

  for (const sel of selectors) {
    const loc = page.locator(sel);
    const count = await loc.count();
    if (count === 0) continue;
    const text = (await loc.first().textContent()) ?? '';
    expect(text, `selector ${sel} should not contain literal HTML tags`).not.toMatch(tagRegex);
  }
});
