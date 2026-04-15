# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: react-query-hooks.spec.ts >> React Query hooks integration >> useItemsQuery loads and displays items from cache
- Location: tests/react-query-hooks.spec.ts:27:3

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0
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
    - button "Tags" [ref=e20] [cursor=pointer]
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
    - generic [ref=e34]:
      - generic [ref=e35]:
        - generic [ref=e36]: Loading…
        - combobox "Sort order" [ref=e37] [cursor=pointer]:
          - option "Newest first" [selected]
          - option "Oldest first"
          - option "Recently read"
          - option "Highest rated"
          - option "Most starred"
          - option "Title A→Z"
          - option "Title Z→A"
      - generic [ref=e38]:
        - generic [ref=e39]:
          - button "All" [ref=e40] [cursor=pointer]
          - button "YouTube" [ref=e41] [cursor=pointer]
          - button "Web" [ref=e42] [cursor=pointer]
          - button "PDF" [ref=e43] [cursor=pointer]
        - button "Unread" [ref=e44] [cursor=pointer]
    - generic [ref=e49]:
      - generic [ref=e50]: ←
      - text: Select an item to read
```

# Test source

```ts
  1  | /**
  2  |  * react-query-hooks.spec.ts - Verify React Query hooks work correctly
  3  |  *
  4  |  * This is a system test that validates:
  5  |  * 1. QueryClient is properly instantiated
  6  |  * 2. Each Layer 1 hook fetches data and caches correctly
  7  |  * 3. Features can import hooks from their public API without direct access to generated hooks
  8  |  *
  9  |  * Per data-architecture.md:
  10 |  * - Components never import from data/apiClient/generated
  11 |  * - Components only import from features/star/index.ts
  12 |  * - Each feature re-exports its hooks via index.ts
  13 |  */
  14 | import { test, expect } from '@playwright/test';
  15 | 
  16 | const BASE = 'http://127.0.0.1:3737';
  17 | 
  18 | test.describe('React Query hooks integration', () => {
  19 |   test('QueryClient is initialized and app is wrapped', async ({ page }) => {
  20 |     // Load the app
  21 |     await page.goto(BASE + '/');
  22 | 
  23 |     // App should render without React Query errors
  24 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  25 |   });
  26 | 
  27 |   test('useItemsQuery loads and displays items from cache', async ({ page }) => {
  28 |     await page.goto(BASE + '/');
  29 | 
  30 |     // Items should appear
  31 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  32 |     const cards = page.locator('.item-card');
  33 |     const count1 = await cards.count();
> 34 |     expect(count1).toBeGreaterThan(0);
     |                    ^ Error: expect(received).toBeGreaterThan(expected)
  35 | 
  36 |     // Navigate away and back — items should load from React Query cache (faster)
  37 |     await page.goto(BASE + '/ingest');
  38 |     await page.goBack();
  39 | 
  40 |     // Items should still be there from cache
  41 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 5_000 });
  42 |     const count2 = await cards.count();
  43 |     expect(count2).toEqual(count1);
  44 |   });
  45 | 
  46 |   test('useTagsQuery loads tags without direct api.getTags() calls in components', async ({ page }) => {
  47 |     await page.goto(BASE + '/');
  48 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  49 | 
  50 |     // Open tags panel
  51 |     const tagsBtn = page.locator('button[aria-label="Tags"]');
  52 |     await expect(tagsBtn).toBeVisible();
  53 |     await tagsBtn.click();
  54 | 
  55 |     // Tags should load via React Query
  56 |     await expect(page.locator('[data-testid="tags-panel"]')).toBeVisible({ timeout: 5_000 });
  57 |     const tags = page.locator('.tag-item');
  58 |     expect(await tags.count()).toBeGreaterThan(0);
  59 |   });
  60 | 
  61 |   test('useCollectionsQuery loads collections', async ({ page }) => {
  62 |     await page.goto(BASE + '/');
  63 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  64 | 
  65 |     // Collections should be visible from React Query hook
  66 |     await expect(page.locator('[data-testid="collections-panel"]')).toBeVisible({ timeout: 5_000 });
  67 |   });
  68 | 
  69 |   test('useReadingStatsQuery loads reading statistics', async ({ page }) => {
  70 |     await page.goto(BASE + '/');
  71 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  72 | 
  73 |     // Stats panel should load reading stats via React Query
  74 |     const statsBtn = page.locator('button[aria-label="Stats"]');
  75 |     await expect(statsBtn).toBeVisible();
  76 |     await statsBtn.click();
  77 | 
  78 |     await expect(page.locator('[data-testid="stats-panel"]')).toBeVisible({ timeout: 5_000 });
  79 |   });
  80 | 
  81 |   test('useQueueLogQuery polls for queue updates', async ({ page }) => {
  82 |     await page.goto(BASE + '/');
  83 |     await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  84 | 
  85 |     // Queue log should be available via React Query hook
  86 |     const queueBtn = page.locator('button[aria-label="Queue"]');
  87 |     if (await queueBtn.isVisible()) {
  88 |       await queueBtn.click();
  89 |       await expect(page.locator('[data-testid="queue-panel"]')).toBeVisible({ timeout: 5_000 });
  90 |     }
  91 |   });
  92 | });
  93 | 
```