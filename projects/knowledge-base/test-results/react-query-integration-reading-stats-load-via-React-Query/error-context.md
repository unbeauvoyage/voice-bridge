# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: react-query-integration.spec.ts >> reading stats load via React Query
- Location: tests/react-query-integration.spec.ts:53:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button[aria-label="Stats"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button[aria-label="Stats"]')

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
    - button "⚑ 230 pending (+ 16 suggestions)" [ref=e20] [cursor=pointer]
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
      - generic [ref=e38]: 📚 27/3 today
      - generic [ref=e39]: 🔥 6 day streak
    - 'generic "Daily goal: 27 of 3" [ref=e40]'
    - generic [ref=e42] [cursor=pointer]: Sources
  - generic [ref=e43]:
    - generic [ref=e44]:
      - generic [ref=e45]:
        - generic [ref=e46]: 25 items
        - combobox "Sort order" [ref=e47] [cursor=pointer]:
          - option "Newest first" [selected]
          - option "Oldest first"
          - option "Recently read"
          - option "Highest rated"
          - option "Most starred"
          - option "Title A→Z"
          - option "Title Z→A"
      - generic [ref=e48]:
        - generic [ref=e49]:
          - button "All" [ref=e50] [cursor=pointer]
          - button "YouTube" [ref=e51] [cursor=pointer]
          - button "Web" [ref=e52] [cursor=pointer]
          - button "PDF" [ref=e53] [cursor=pointer]
        - button "Unread" [ref=e54] [cursor=pointer]
      - generic [ref=e57] [cursor=pointer]:
        - generic [ref=e58]:
          - generic [ref=e59]: 🌐
          - generic [ref=e60]: Raise Popup Test Item
          - button "🔗" [ref=e61]
          - button "☆" [ref=e62]
          - button "📌" [ref=e63]
          - button "🗑" [ref=e64]
        - generic "Apr 18, 2026" [ref=e66]: "-2d ago"
      - generic [ref=e69] [cursor=pointer]:
        - generic [ref=e70]:
          - generic [ref=e71]: 🌐
          - generic [ref=e72]: Raise Popup Test Item
          - button "🔗" [ref=e73]
          - button "★" [ref=e74]
          - button "📌" [ref=e75]
          - button "🗑" [ref=e76]
        - generic "Apr 18, 2026" [ref=e78]: "-2d ago"
      - generic [ref=e81] [cursor=pointer]:
        - generic [ref=e82]:
          - generic [ref=e83]: 🌐
          - generic [ref=e84]: Raise Popup Test Item
          - button "🔗" [ref=e85]
          - button "☆" [ref=e86]
          - button "📌" [ref=e87]
          - button "🗑" [ref=e88]
        - generic "Apr 18, 2026" [ref=e90]: "-2d ago"
      - generic [ref=e93] [cursor=pointer]:
        - generic [ref=e94]:
          - generic [ref=e95]: 🌐
          - generic [ref=e96]: Raise Popup Test Item
          - button "🔗" [ref=e97]
          - button "★" [ref=e98]
          - button "📌" [ref=e99]
          - button "🗑" [ref=e100]
        - generic "Apr 18, 2026" [ref=e102]: "-2d ago"
      - generic [ref=e105] [cursor=pointer]:
        - generic [ref=e106]:
          - generic [ref=e107]: 🌐
          - generic [ref=e108]: Raise Popup Test Item
          - button "🔗" [ref=e109]
          - button "☆" [ref=e110]
          - button "📌" [ref=e111]
          - button "🗑" [ref=e112]
        - generic "Apr 18, 2026" [ref=e114]: "-2d ago"
      - generic [ref=e117] [cursor=pointer]:
        - generic [ref=e118]:
          - generic [ref=e119]: ▶
          - generic [ref=e120]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e121]
          - button "☆" [ref=e122]
          - button "📌" [ref=e123]
          - button "🗑" [ref=e124]
        - generic [ref=e125]:
          - generic "Dec 20, 2025" [ref=e126]: 3mo ago
          - generic [ref=e127]: Artificial Intelligence
      - generic [ref=e130] [cursor=pointer]:
        - generic [ref=e131]:
          - generic [ref=e132]: ▶
          - generic [ref=e133]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e134]
          - button "☆" [ref=e135]
          - button "📌" [ref=e136]
          - button "🗑" [ref=e137]
        - generic [ref=e138]:
          - generic "Mar 23, 2026" [ref=e139]: 3w ago
          - generic [ref=e140]: Artificial Intelligence
      - generic [ref=e143] [cursor=pointer]:
        - generic [ref=e144]:
          - generic [ref=e145]: ▶
          - generic [ref=e146]: Claude Code is unusable now
          - button "🔗" [ref=e147]
          - button "☆" [ref=e148]
          - button "📌" [ref=e149]
          - button "🗑" [ref=e150]
        - generic [ref=e151]:
          - generic "Apr 5, 2026" [ref=e152]: 1w ago
          - generic [ref=e153]: AI
      - generic [ref=e156] [cursor=pointer]:
        - generic [ref=e157]:
          - generic [ref=e158]: ▶
          - generic [ref=e159]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e160]
          - button "☆" [ref=e161]
          - button "📌" [ref=e162]
          - button "🗑" [ref=e163]
        - generic [ref=e164]:
          - generic "Apr 6, 2026" [ref=e165]: 1w ago
          - generic [ref=e166]: AI Development
      - generic [ref=e169] [cursor=pointer]:
        - generic [ref=e170]:
          - generic [ref=e171]: 🌐
          - generic [ref=e172]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e173]
          - button "☆" [ref=e174]
          - button "📌" [ref=e175]
          - button "🗑" [ref=e176]
        - generic "Apr 11, 2026" [ref=e178]: 5d ago
      - generic [ref=e181] [cursor=pointer]:
        - generic [ref=e182]:
          - generic [ref=e183]: 🌐
          - generic [ref=e184]: Tech
          - button "🔗" [ref=e185]
          - button "☆" [ref=e186]
          - button "📌" [ref=e187]
          - button "🗑" [ref=e188]
        - generic [ref=e189]:
          - generic "Apr 14, 2026" [ref=e190]: yesterday
          - generic [ref=e191]: Artificial Intelligence
      - generic [ref=e194] [cursor=pointer]:
        - generic [ref=e195]:
          - generic [ref=e196]: 🌐
          - generic [ref=e197]: "Category: AI"
          - button "🔗" [ref=e198]
          - button "☆" [ref=e199]
          - button "📌" [ref=e200]
          - button "🗑" [ref=e201]
        - generic "Apr 14, 2026" [ref=e203]: yesterday
      - generic [ref=e206] [cursor=pointer]:
        - generic [ref=e207]:
          - generic [ref=e208]: 🌐
          - generic [ref=e209]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e210]
          - button "☆" [ref=e211]
          - button "📌" [ref=e212]
          - button "🗑" [ref=e213]
        - generic [ref=e214]:
          - generic "Apr 15, 2026" [ref=e215]: today
          - generic [ref=e216]: AI
      - generic [ref=e219] [cursor=pointer]:
        - generic [ref=e220]:
          - generic [ref=e221]: 🌐
          - generic [ref=e222]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e223]
          - button "☆" [ref=e224]
          - button "📌" [ref=e225]
          - button "🗑" [ref=e226]
        - generic [ref=e227]:
          - generic "Apr 11, 2026" [ref=e228]: 5d ago
          - generic [ref=e229]: Artificial Intelligence
      - generic [ref=e232] [cursor=pointer]:
        - generic [ref=e233]:
          - generic [ref=e234]: 🌐
          - generic [ref=e235]: Artificial Intelligence
          - button "🔗" [ref=e236]
          - button "☆" [ref=e237]
          - button "📌" [ref=e238]
          - button "🗑" [ref=e239]
        - generic [ref=e240]:
          - generic "Apr 15, 2026" [ref=e241]: today
          - generic [ref=e242]: Artificial Intelligence
      - generic [ref=e245] [cursor=pointer]:
        - generic [ref=e246]:
          - generic [ref=e247]: 🌐
          - generic [ref=e248]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e249]
          - button "☆" [ref=e250]
          - button "📌" [ref=e251]
          - button "🗑" [ref=e252]
        - generic [ref=e253]:
          - generic "Feb 18, 2026" [ref=e254]: 1mo ago
          - generic [ref=e255]: Claude Code
      - generic [ref=e258] [cursor=pointer]:
        - generic [ref=e259]:
          - generic [ref=e260]: 🌐
          - generic [ref=e261]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e262]
          - button "☆" [ref=e263]
          - button "📌" [ref=e264]
          - button "🗑" [ref=e265]
        - generic [ref=e266]:
          - generic "Apr 7, 2020" [ref=e267]: 6y ago
          - generic [ref=e268]: AI Development
      - generic [ref=e271] [cursor=pointer]:
        - generic [ref=e272]:
          - generic [ref=e273]: ▶
          - generic [ref=e274]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e275]
          - button "★" [ref=e276]
          - button "📌" [ref=e277]
          - button "🗑" [ref=e278]
        - generic "Apr 1, 2026" [ref=e280]: 2w ago
      - generic [ref=e283] [cursor=pointer]:
        - generic [ref=e284]:
          - generic [ref=e285]: ▶
          - generic [ref=e286]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e287]
          - button "☆" [ref=e288]
          - button "📌" [ref=e289]
          - button "🗑" [ref=e290]
        - generic [ref=e291]:
          - generic "Jul 25, 2025" [ref=e292]: 8mo ago
          - generic [ref=e293]: Claude Code
      - generic [ref=e296] [cursor=pointer]:
        - generic [ref=e297]:
          - generic [ref=e298]: ▶
          - generic [ref=e299]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e300]
          - button "★" [ref=e301]
          - button "📌" [ref=e302]
          - button "🗑" [ref=e303]
        - generic [ref=e304]:
          - generic "Mar 29, 2026" [ref=e305]: 2w ago
          - generic [ref=e306]: Artificial Intelligence
      - generic [ref=e309] [cursor=pointer]:
        - generic [ref=e310]:
          - generic [ref=e311]: ▶
          - generic [ref=e312]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e313]
          - button "★" [ref=e314]
          - button "📌" [ref=e315]
          - button "🗑" [ref=e316]
        - generic "Mar 30, 2026" [ref=e318]: 2w ago
      - generic [ref=e321] [cursor=pointer]:
        - generic [ref=e322]:
          - generic [ref=e323]: ▶
          - generic [ref=e324]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e325]
          - button "★" [ref=e326]
          - button "📌" [ref=e327]
          - button "🗑" [ref=e328]
        - generic [ref=e329]:
          - generic "Apr 1, 2026" [ref=e330]: 2w ago
          - generic [ref=e331]: AI Development
      - generic [ref=e334] [cursor=pointer]:
        - generic [ref=e335]:
          - generic [ref=e336]: ▶
          - generic [ref=e337]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e338]
          - button "☆" [ref=e339]
          - button "📌" [ref=e340]
          - button "🗑" [ref=e341]
        - generic [ref=e342]:
          - generic "Mar 30, 2026" [ref=e343]: 2w ago
          - generic [ref=e344]: AI
      - generic [ref=e347] [cursor=pointer]:
        - generic [ref=e348]:
          - generic [ref=e349]: ▶
          - generic [ref=e350]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e351]
          - button "☆" [ref=e352]
          - button "📌" [ref=e353]
          - button "🗑" [ref=e354]
        - generic [ref=e355]:
          - generic "Apr 9, 2026" [ref=e356]: 6d ago
          - generic [ref=e357]: AI
      - generic [ref=e360] [cursor=pointer]:
        - generic [ref=e361]:
          - generic [ref=e362]: 🌐
          - generic [ref=e363]: Example Domain
          - button "🔗" [ref=e364]
          - button "☆" [ref=e365]
          - button "📌" [ref=e366]
          - button "🗑" [ref=e367]
        - generic [ref=e368]:
          - generic "Apr 10, 2026" [ref=e369]: 5d ago
          - generic [ref=e370]: Software Development
    - generic [ref=e373]:
      - generic [ref=e374]: ←
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
  25 |   expect(cardCount).toBeGreaterThan(0);
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
> 59 |   await expect(statsBtn).toBeVisible();
     |                          ^ Error: expect(locator).toBeVisible() failed
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