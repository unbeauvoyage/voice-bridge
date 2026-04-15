# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: react-query-cache-and-stores.spec.ts >> items load via React Query on mount
- Location: tests/react-query-cache-and-stores.spec.ts:14:1

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
  2  |  * react-query-cache-and-stores.spec.ts - Validate app uses React Query cache + Zustand stores
  3  |  *
  4  |  * This test asserts that:
  5  |  * 1. App loads items via React Query (no useState + useEffect)
  6  |  * 2. Filtering state lives in Zustand stores, not useState
  7  |  * 3. React Query cache serves instant results on re-navigation (no refetch)
  8  |  * 4. Filter state persists in Zustand but doesn't trigger fresh data fetches
  9  |  */
  10 | import { test, expect } from '@playwright/test'
  11 | 
  12 | const BASE = 'http://127.0.0.1:3737'
  13 | 
  14 | test('items load via React Query on mount', async ({ page }) => {
  15 |   // Items should load via React Query hook on app mount
  16 |   await page.goto(BASE + '/')
  17 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 })
  18 |   const cards = page.locator('.item-card')
  19 |   const count = await cards.count()
> 20 |   expect(count).toBeGreaterThan(0)
     |                 ^ Error: expect(received).toBeGreaterThan(expected)
  21 | })
  22 | 
  23 | test('filter state lives in Zustand, not useState', async ({ page }) => {
  24 |   await page.goto(BASE + '/')
  25 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 })
  26 | 
  27 |   // Apply a type filter
  28 |   const youtubePill = page.locator('.type-pill', { hasText: 'YouTube' })
  29 |   if (await youtubePill.isVisible()) {
  30 |     await youtubePill.click()
  31 |     // After clicking, pill should be marked as active
  32 |     await expect(youtubePill).toHaveClass(/active/, { timeout: 2_000 })
  33 | 
  34 |     // Items should be filtered in the list
  35 |     const itemCards = page.locator('.item-card')
  36 |     const itemCount = await itemCards.count()
  37 |     expect(itemCount).toBeGreaterThan(0)
  38 |   }
  39 | })
  40 | 
  41 | test('tag filtering updates without full page refetch', async ({ page }) => {
  42 |   await page.goto(BASE + '/')
  43 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible({ timeout: 10_000 })
  44 | 
  45 |   const itemsContainer = page.locator('[data-testid="item-list"]')
  46 |   const countBefore = await page.locator('.item-card').count()
  47 | 
  48 |   // Open tags panel
  49 |   const tagsBtn = page.locator('button[aria-label="Tags"]')
  50 |   if (await tagsBtn.isVisible()) {
  51 |     await tagsBtn.click()
  52 |     await expect(page.locator('[data-testid="tags-panel"]')).toBeVisible({ timeout: 5_000 })
  53 | 
  54 |     // Click first tag to filter
  55 |     const firstTag = page.locator('.tag-item').first()
  56 |     if (await firstTag.isVisible()) {
  57 |       await firstTag.click()
  58 | 
  59 |       // List should update without navigation
  60 |       await expect(itemsContainer).toBeVisible()
  61 |       // Filtered list may have fewer items
  62 |       const countAfter = await page.locator('.item-card').count()
  63 |       // Count may be less (filtered) or equal (no items with that tag)
  64 |       expect(countAfter).toBeLessThanOrEqual(countBefore)
  65 |     }
  66 |   }
  67 | })
  68 | 
```