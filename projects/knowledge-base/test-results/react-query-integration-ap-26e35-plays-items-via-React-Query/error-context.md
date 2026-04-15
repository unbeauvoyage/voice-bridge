# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: react-query-integration.spec.ts >> app loads and displays items via React Query
- Location: tests/react-query-integration.spec.ts:16:1

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
  2  |  * react-query-integration.spec.ts — Verify React Query is properly integrated
  3  |  *
  4  |  * Tests that the app uses React Query for server state management instead of
  5  |  * useEffect-based fetching in app.tsx, following the data-architecture module.
  6  |  *
  7  |  * Phase 3b validates that:
  8  |  * 1. QueryClientProvider wraps the app
  9  |  * 2. Features import data hooks from feature index.ts (Layer 2/3)
  10 |  * 3. Server state flows through React Query, not useState
  11 |  */
  12 | import { test, expect } from '@playwright/test';
  13 | 
  14 | const BASE = 'http://127.0.0.1:3737';
  15 | 
  16 | test('app loads and displays items via React Query', async ({ page }) => {
  17 |   await page.goto(BASE + '/');
  18 | 
  19 |   // App should be interactive after items load via React Query
  20 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  21 | 
  22 |   // Verify at least one item card renders
  23 |   const itemCards = page.locator('.item-card');
  24 |   const cardCount = await itemCards.count();
> 25 |   expect(cardCount).toBeGreaterThan(0);
     |                     ^ Error: expect(received).toBeGreaterThan(expected)
  26 | });
  27 | 
  28 | test('tags panel loads tags via React Query', async ({ page }) => {
  29 |   await page.goto(BASE + '/');
  30 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  31 | 
  32 |   // Open tags panel
  33 |   const tagsBtn = page.locator('button[aria-label="Tags"]');
  34 |   await expect(tagsBtn).toBeVisible();
  35 |   await tagsBtn.click();
  36 | 
  37 |   // Tags should load and display
  38 |   await expect(page.locator('[data-testid="tags-panel"]')).toBeVisible({ timeout: 5_000 });
  39 |   const tags = page.locator('.tag-item');
  40 |   const tagCount = await tags.count();
  41 |   expect(tagCount).toBeGreaterThan(0);
  42 | });
  43 | 
  44 | test('collections load via React Query and display in sidebar', async ({ page }) => {
  45 |   await page.goto(BASE + '/');
  46 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  47 | 
  48 |   // Collections should be visible in sidebar after React Query load
  49 |   const collectionsPanel = page.locator('[data-testid="collections-panel"]');
  50 |   await expect(collectionsPanel).toBeVisible({ timeout: 5_000 });
  51 | });
  52 | 
  53 | test('reading stats load via React Query', async ({ page }) => {
  54 |   await page.goto(BASE + '/');
  55 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  56 | 
  57 |   // Stats panel should load reading stats
  58 |   const statsBtn = page.locator('button[aria-label="Stats"]');
  59 |   await expect(statsBtn).toBeVisible();
  60 |   await statsBtn.click();
  61 | 
  62 |   await expect(page.locator('[data-testid="stats-panel"]')).toBeVisible({ timeout: 5_000 });
  63 | });
  64 | 
  65 | test('search via React Query hook', async ({ page }) => {
  66 |   await page.goto(BASE + '/');
  67 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 });
  68 | 
  69 |   // Perform a search — should use React Query hook, not useEffect
  70 |   const searchInput = page.locator('[data-testid="search-input"]');
  71 |   await expect(searchInput).toBeVisible();
  72 |   await searchInput.fill('test');
  73 | 
  74 |   // Results should update via React Query
  75 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 5_000 });
  76 | });
  77 | 
```