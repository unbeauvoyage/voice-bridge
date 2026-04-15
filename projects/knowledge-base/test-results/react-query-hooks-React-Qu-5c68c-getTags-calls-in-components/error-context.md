# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: react-query-hooks.spec.ts >> React Query hooks integration >> useTagsQuery loads tags without direct api.getTags() calls in components
- Location: tests/react-query-hooks.spec.ts:46:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('button[aria-label="Tags"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('button[aria-label="Tags"]')

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
      - generic [ref=e38]: 📚 26/3 today
      - generic [ref=e39]: 🔥 6 day streak
    - 'generic "Daily goal: 26 of 3" [ref=e40]'
    - generic [ref=e42] [cursor=pointer]: Sources
  - generic [ref=e43]:
    - generic [ref=e44]:
      - generic [ref=e45]:
        - generic [ref=e46]: 26 items
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
          - generic "Unread" [ref=e61]
          - button "🔗" [ref=e62]
          - button "☆" [ref=e63]
          - button "📌" [ref=e64]
          - button "🗑" [ref=e65]
        - generic "Apr 18, 2026" [ref=e67]: "-2d ago"
      - generic [ref=e70] [cursor=pointer]:
        - generic [ref=e71]:
          - generic [ref=e72]: 🌐
          - generic [ref=e73]: Raise Popup Test Item
          - button "🔗" [ref=e74]
          - button "★" [ref=e75]
          - button "📌" [ref=e76]
          - button "🗑" [ref=e77]
        - generic "Apr 18, 2026" [ref=e79]: "-2d ago"
      - generic [ref=e82] [cursor=pointer]:
        - generic [ref=e83]:
          - generic [ref=e84]: 🌐
          - generic [ref=e85]: Raise Popup Test Item
          - button "🔗" [ref=e86]
          - button "☆" [ref=e87]
          - button "📌" [ref=e88]
          - button "🗑" [ref=e89]
        - generic "Apr 18, 2026" [ref=e91]: "-2d ago"
      - generic [ref=e94] [cursor=pointer]:
        - generic [ref=e95]:
          - generic [ref=e96]: 🌐
          - generic [ref=e97]: Raise Popup Test Item
          - button "🔗" [ref=e98]
          - button "★" [ref=e99]
          - button "📌" [ref=e100]
          - button "🗑" [ref=e101]
        - generic "Apr 18, 2026" [ref=e103]: "-2d ago"
      - generic [ref=e106] [cursor=pointer]:
        - generic [ref=e107]:
          - generic [ref=e108]: 🌐
          - generic [ref=e109]: Raise Popup Test Item
          - button "🔗" [ref=e110]
          - button "☆" [ref=e111]
          - button "📌" [ref=e112]
          - button "🗑" [ref=e113]
        - generic "Apr 18, 2026" [ref=e115]: "-2d ago"
      - generic [ref=e118] [cursor=pointer]:
        - generic [ref=e119]:
          - generic [ref=e120]: ▶
          - generic [ref=e121]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e122]
          - button "☆" [ref=e123]
          - button "📌" [ref=e124]
          - button "🗑" [ref=e125]
        - generic [ref=e126]:
          - generic "Mar 23, 2026" [ref=e127]: 3w ago
          - generic [ref=e128]: AI Development
      - generic [ref=e131] [cursor=pointer]:
        - generic [ref=e132]:
          - generic [ref=e133]: ▶
          - generic [ref=e134]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e135]
          - button "☆" [ref=e136]
          - button "📌" [ref=e137]
          - button "🗑" [ref=e138]
        - generic [ref=e139]:
          - generic "Dec 20, 2025" [ref=e140]: 3mo ago
          - generic [ref=e141]: Artificial Intelligence
      - generic [ref=e144] [cursor=pointer]:
        - generic [ref=e145]:
          - generic [ref=e146]: ▶
          - generic [ref=e147]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e148]
          - button "☆" [ref=e149]
          - button "📌" [ref=e150]
          - button "🗑" [ref=e151]
        - generic [ref=e152]:
          - generic "Mar 23, 2026" [ref=e153]: 3w ago
          - generic [ref=e154]: Artificial Intelligence
      - generic [ref=e157] [cursor=pointer]:
        - generic [ref=e158]:
          - generic [ref=e159]: ▶
          - generic [ref=e160]: Claude Code is unusable now
          - button "🔗" [ref=e161]
          - button "☆" [ref=e162]
          - button "📌" [ref=e163]
          - button "🗑" [ref=e164]
        - generic [ref=e165]:
          - generic "Apr 5, 2026" [ref=e166]: 1w ago
          - generic [ref=e167]: AI
      - generic [ref=e170] [cursor=pointer]:
        - generic [ref=e171]:
          - generic [ref=e172]: ▶
          - generic [ref=e173]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e174]
          - button "☆" [ref=e175]
          - button "📌" [ref=e176]
          - button "🗑" [ref=e177]
        - generic [ref=e178]:
          - generic "Apr 6, 2026" [ref=e179]: 1w ago
          - generic [ref=e180]: AI Development
      - generic [ref=e183] [cursor=pointer]:
        - generic [ref=e184]:
          - generic [ref=e185]: 🌐
          - generic [ref=e186]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e187]
          - button "☆" [ref=e188]
          - button "📌" [ref=e189]
          - button "🗑" [ref=e190]
        - generic "Apr 11, 2026" [ref=e192]: 5d ago
      - generic [ref=e195] [cursor=pointer]:
        - generic [ref=e196]:
          - generic [ref=e197]: 🌐
          - generic [ref=e198]: Tech
          - button "🔗" [ref=e199]
          - button "☆" [ref=e200]
          - button "📌" [ref=e201]
          - button "🗑" [ref=e202]
        - generic [ref=e203]:
          - generic "Apr 14, 2026" [ref=e204]: yesterday
          - generic [ref=e205]: Artificial Intelligence
      - generic [ref=e208] [cursor=pointer]:
        - generic [ref=e209]:
          - generic [ref=e210]: 🌐
          - generic [ref=e211]: "Category: AI"
          - button "🔗" [ref=e212]
          - button "☆" [ref=e213]
          - button "📌" [ref=e214]
          - button "🗑" [ref=e215]
        - generic "Apr 14, 2026" [ref=e217]: yesterday
      - generic [ref=e220] [cursor=pointer]:
        - generic [ref=e221]:
          - generic [ref=e222]: 🌐
          - generic [ref=e223]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e224]
          - button "☆" [ref=e225]
          - button "📌" [ref=e226]
          - button "🗑" [ref=e227]
        - generic [ref=e228]:
          - generic "Apr 15, 2026" [ref=e229]: today
          - generic [ref=e230]: AI
      - generic [ref=e233] [cursor=pointer]:
        - generic [ref=e234]:
          - generic [ref=e235]: 🌐
          - generic [ref=e236]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e237]
          - button "☆" [ref=e238]
          - button "📌" [ref=e239]
          - button "🗑" [ref=e240]
        - generic [ref=e241]:
          - generic "Apr 11, 2026" [ref=e242]: 5d ago
          - generic [ref=e243]: Artificial Intelligence
      - generic [ref=e246] [cursor=pointer]:
        - generic [ref=e247]:
          - generic [ref=e248]: 🌐
          - generic [ref=e249]: Artificial Intelligence
          - button "🔗" [ref=e250]
          - button "☆" [ref=e251]
          - button "📌" [ref=e252]
          - button "🗑" [ref=e253]
        - generic [ref=e254]:
          - generic "Apr 15, 2026" [ref=e255]: today
          - generic [ref=e256]: Artificial Intelligence
      - generic [ref=e259] [cursor=pointer]:
        - generic [ref=e260]:
          - generic [ref=e261]: 🌐
          - generic [ref=e262]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e263]
          - button "☆" [ref=e264]
          - button "📌" [ref=e265]
          - button "🗑" [ref=e266]
        - generic [ref=e267]:
          - generic "Feb 18, 2026" [ref=e268]: 1mo ago
          - generic [ref=e269]: Claude Code
      - generic [ref=e272] [cursor=pointer]:
        - generic [ref=e273]:
          - generic [ref=e274]: 🌐
          - generic [ref=e275]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e276]
          - button "☆" [ref=e277]
          - button "📌" [ref=e278]
          - button "🗑" [ref=e279]
        - generic [ref=e280]:
          - generic "Apr 7, 2020" [ref=e281]: 6y ago
          - generic [ref=e282]: AI Development
      - generic [ref=e285] [cursor=pointer]:
        - generic [ref=e286]:
          - generic [ref=e287]: ▶
          - generic [ref=e288]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e289]
          - button "★" [ref=e290]
          - button "📌" [ref=e291]
          - button "🗑" [ref=e292]
        - generic "Apr 1, 2026" [ref=e294]: 2w ago
      - generic [ref=e297] [cursor=pointer]:
        - generic [ref=e298]:
          - generic [ref=e299]: ▶
          - generic [ref=e300]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e301]
          - button "☆" [ref=e302]
          - button "📌" [ref=e303]
          - button "🗑" [ref=e304]
        - generic [ref=e305]:
          - generic "Jul 25, 2025" [ref=e306]: 8mo ago
          - generic [ref=e307]: Claude Code
      - generic [ref=e310] [cursor=pointer]:
        - generic [ref=e311]:
          - generic [ref=e312]: ▶
          - generic [ref=e313]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e314]
          - button "★" [ref=e315]
          - button "📌" [ref=e316]
          - button "🗑" [ref=e317]
        - generic [ref=e318]:
          - generic "Mar 29, 2026" [ref=e319]: 2w ago
          - generic [ref=e320]: Artificial Intelligence
      - generic [ref=e323] [cursor=pointer]:
        - generic [ref=e324]:
          - generic [ref=e325]: ▶
          - generic [ref=e326]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e327]
          - button "★" [ref=e328]
          - button "📌" [ref=e329]
          - button "🗑" [ref=e330]
        - generic "Mar 30, 2026" [ref=e332]: 2w ago
      - generic [ref=e335] [cursor=pointer]:
        - generic [ref=e336]:
          - generic [ref=e337]: ▶
          - generic [ref=e338]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e339]
          - button "★" [ref=e340]
          - button "📌" [ref=e341]
          - button "🗑" [ref=e342]
        - generic [ref=e343]:
          - generic "Apr 1, 2026" [ref=e344]: 2w ago
          - generic [ref=e345]: AI Development
      - generic [ref=e348] [cursor=pointer]:
        - generic [ref=e349]:
          - generic [ref=e350]: ▶
          - generic [ref=e351]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e352]
          - button "☆" [ref=e353]
          - button "📌" [ref=e354]
          - button "🗑" [ref=e355]
        - generic [ref=e356]:
          - generic "Mar 30, 2026" [ref=e357]: 2w ago
          - generic [ref=e358]: AI
      - generic [ref=e361] [cursor=pointer]:
        - generic [ref=e362]:
          - generic [ref=e363]: ▶
          - generic [ref=e364]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e365]
          - button "☆" [ref=e366]
          - button "📌" [ref=e367]
          - button "🗑" [ref=e368]
        - generic [ref=e369]:
          - generic "Apr 9, 2026" [ref=e370]: 6d ago
          - generic [ref=e371]: AI
      - generic [ref=e374] [cursor=pointer]:
        - generic [ref=e375]:
          - generic [ref=e376]: 🌐
          - generic [ref=e377]: Example Domain
          - button "🔗" [ref=e378]
          - button "☆" [ref=e379]
          - button "📌" [ref=e380]
          - button "🗑" [ref=e381]
        - generic [ref=e382]:
          - generic "Apr 10, 2026" [ref=e383]: 5d ago
          - generic [ref=e384]: Software Development
    - generic [ref=e387]:
      - generic [ref=e388]: ←
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
  34 |     expect(count1).toBeGreaterThan(0);
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
> 52 |     await expect(tagsBtn).toBeVisible();
     |                           ^ Error: expect(locator).toBeVisible() failed
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