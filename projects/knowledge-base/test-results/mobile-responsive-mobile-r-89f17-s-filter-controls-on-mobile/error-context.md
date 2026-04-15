# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: mobile-responsive.spec.ts >> mobile responsive layout >> hamburger toggle reveals filter controls on mobile
- Location: tests/mobile-responsive.spec.ts:99:3

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="mobile-menu-toggle"]')
Expected: visible
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 5000ms
  - waiting for locator('[data-testid="mobile-menu-toggle"]')

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
    - button "Export" [ref=e12] [cursor=pointer]
    - button "☀️" [ref=e13] [cursor=pointer]
    - button "📊" [ref=e14]
    - button "⚙" [ref=e15] [cursor=pointer]
    - button "⚙ Queue" [ref=e16] [cursor=pointer]
    - button "?" [ref=e17] [cursor=pointer]
  - generic [ref=e18]:
    - generic [ref=e19]: ⚠️ Ollama is not running — new items cannot be summarized. Start Ollama to resume processing.
    - button "Dismiss" [ref=e20] [cursor=pointer]
  - generic [ref=e21]:
    - generic [ref=e22] [cursor=pointer]:
      - generic [ref=e23]: 📚 26/3 today
      - generic [ref=e24]: 🔥 6 day streak
    - 'generic "Daily goal: 26 of 3" [ref=e25]'
    - generic [ref=e27] [cursor=pointer]: Sources
  - generic [ref=e29]:
    - generic [ref=e30]:
      - generic [ref=e31]: 25 items
      - combobox "Sort order" [ref=e32] [cursor=pointer]:
        - option "Newest first" [selected]
        - option "Oldest first"
        - option "Recently read"
        - option "Highest rated"
        - option "Most starred"
        - option "Title A→Z"
        - option "Title Z→A"
    - generic [ref=e33]:
      - generic [ref=e34]:
        - button "All" [ref=e35] [cursor=pointer]
        - button "YouTube" [ref=e36] [cursor=pointer]
        - button "Web" [ref=e37] [cursor=pointer]
        - button "PDF" [ref=e38] [cursor=pointer]
      - button "Unread" [ref=e39] [cursor=pointer]
    - generic [ref=e42] [cursor=pointer]:
      - generic [ref=e43]:
        - generic [ref=e44]: 🌐
        - generic [ref=e45]: Raise Popup Test Item
        - button "🔗" [ref=e46]
        - button "☆" [ref=e47]
        - button "📌" [ref=e48]
        - button "🗑" [ref=e49]
      - generic "Apr 18, 2026" [ref=e51]: "-2d ago"
    - generic [ref=e54] [cursor=pointer]:
      - generic [ref=e55]:
        - generic [ref=e56]: 🌐
        - generic [ref=e57]: Raise Popup Test Item
        - button "🔗" [ref=e58]
        - button "☆" [ref=e59]
        - button "📌" [ref=e60]
        - button "🗑" [ref=e61]
      - generic "Apr 18, 2026" [ref=e63]: "-2d ago"
    - generic [ref=e66] [cursor=pointer]:
      - generic [ref=e67]:
        - generic [ref=e68]: 🌐
        - generic [ref=e69]: Raise Popup Test Item
        - button "🔗" [ref=e70]
        - button "★" [ref=e71]
        - button "📌" [ref=e72]
        - button "🗑" [ref=e73]
      - generic "Apr 18, 2026" [ref=e75]: "-2d ago"
    - generic [ref=e78] [cursor=pointer]:
      - generic [ref=e79]:
        - generic [ref=e80]: 🌐
        - generic [ref=e81]: Raise Popup Test Item
        - button "🔗" [ref=e82]
        - button "☆" [ref=e83]
        - button "📌" [ref=e84]
        - button "🗑" [ref=e85]
      - generic "Apr 18, 2026" [ref=e87]: "-2d ago"
    - generic [ref=e90] [cursor=pointer]:
      - generic [ref=e91]:
        - generic [ref=e92]: ▶
        - generic [ref=e93]: How to Build Claude Agent Teams Better Than 99% of People
        - button "🔗" [ref=e94]
        - button "☆" [ref=e95]
        - button "📌" [ref=e96]
        - button "🗑" [ref=e97]
      - generic [ref=e98]:
        - generic "Mar 23, 2026" [ref=e99]: 3w ago
        - generic [ref=e100]: AI Development
    - generic [ref=e103] [cursor=pointer]:
      - generic [ref=e104]:
        - generic [ref=e105]: ▶
        - generic [ref=e106]: The REAL Reason Scientists Know We&#39;re In A Simulation
        - button "🔗" [ref=e107]
        - button "☆" [ref=e108]
        - button "📌" [ref=e109]
        - button "🗑" [ref=e110]
      - generic [ref=e111]:
        - generic "Dec 20, 2025" [ref=e112]: 3mo ago
        - generic [ref=e113]: Artificial Intelligence
    - generic [ref=e116] [cursor=pointer]:
      - generic [ref=e117]:
        - generic [ref=e118]: ▶
        - generic [ref=e119]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
        - button "🔗" [ref=e120]
        - button "☆" [ref=e121]
        - button "📌" [ref=e122]
        - button "🗑" [ref=e123]
      - generic [ref=e124]:
        - generic "Mar 23, 2026" [ref=e125]: 3w ago
        - generic [ref=e126]: Artificial Intelligence
    - generic [ref=e129] [cursor=pointer]:
      - generic [ref=e130]:
        - generic [ref=e131]: ▶
        - generic [ref=e132]: Claude Code is unusable now
        - button "🔗" [ref=e133]
        - button "☆" [ref=e134]
        - button "📌" [ref=e135]
        - button "🗑" [ref=e136]
      - generic [ref=e137]:
        - generic "Apr 5, 2026" [ref=e138]: 1w ago
        - generic [ref=e139]: AI
    - generic [ref=e142] [cursor=pointer]:
      - generic [ref=e143]:
        - generic [ref=e144]: ▶
        - generic [ref=e145]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
        - button "🔗" [ref=e146]
        - button "☆" [ref=e147]
        - button "📌" [ref=e148]
        - button "🗑" [ref=e149]
      - generic [ref=e150]:
        - generic "Apr 6, 2026" [ref=e151]: 1w ago
        - generic [ref=e152]: AI Development
    - generic [ref=e155] [cursor=pointer]:
      - generic [ref=e156]:
        - generic [ref=e157]: 🌐
        - generic [ref=e158]: Artificial intelligence | MIT Technology Review
        - button "🔗" [ref=e159]
        - button "☆" [ref=e160]
        - button "📌" [ref=e161]
        - button "🗑" [ref=e162]
      - generic "Apr 11, 2026" [ref=e164]: 5d ago
    - generic [ref=e167] [cursor=pointer]:
      - generic [ref=e168]:
        - generic [ref=e169]: 🌐
        - generic [ref=e170]: Tech
        - button "🔗" [ref=e171]
        - button "☆" [ref=e172]
        - button "📌" [ref=e173]
        - button "🗑" [ref=e174]
      - generic [ref=e175]:
        - generic "Apr 14, 2026" [ref=e176]: yesterday
        - generic [ref=e177]: Artificial Intelligence
    - generic [ref=e180] [cursor=pointer]:
      - generic [ref=e181]:
        - generic [ref=e182]: 🌐
        - generic [ref=e183]: "Category: AI"
        - button "🔗" [ref=e184]
        - button "☆" [ref=e185]
        - button "📌" [ref=e186]
        - button "🗑" [ref=e187]
      - generic "Apr 14, 2026" [ref=e189]: yesterday
    - generic [ref=e192] [cursor=pointer]:
      - generic [ref=e193]:
        - generic [ref=e194]: 🌐
        - generic [ref=e195]: AI News & Artificial Intelligence | TechCrunch
        - button "🔗" [ref=e196]
        - button "☆" [ref=e197]
        - button "📌" [ref=e198]
        - button "🗑" [ref=e199]
      - generic [ref=e200]:
        - generic "Apr 15, 2026" [ref=e201]: today
        - generic [ref=e202]: AI
    - generic [ref=e205] [cursor=pointer]:
      - generic [ref=e206]:
        - generic [ref=e207]: 🌐
        - generic [ref=e208]: BBC Technology | Technology, Health, Environment, AI
        - button "🔗" [ref=e209]
        - button "☆" [ref=e210]
        - button "📌" [ref=e211]
        - button "🗑" [ref=e212]
      - generic [ref=e213]:
        - generic "Apr 11, 2026" [ref=e214]: 5d ago
        - generic [ref=e215]: Artificial Intelligence
    - generic [ref=e218] [cursor=pointer]:
      - generic [ref=e219]:
        - generic [ref=e220]: 🌐
        - generic [ref=e221]: Artificial Intelligence
        - button "🔗" [ref=e222]
        - button "☆" [ref=e223]
        - button "📌" [ref=e224]
        - button "🗑" [ref=e225]
      - generic [ref=e226]:
        - generic "Apr 15, 2026" [ref=e227]: today
        - generic [ref=e228]: Artificial Intelligence
    - generic [ref=e231] [cursor=pointer]:
      - generic [ref=e232]:
        - generic [ref=e233]: 🌐
        - generic [ref=e234]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
        - button "🔗" [ref=e235]
        - button "☆" [ref=e236]
        - button "📌" [ref=e237]
        - button "🗑" [ref=e238]
      - generic [ref=e239]:
        - generic "Feb 18, 2026" [ref=e240]: 1mo ago
        - generic [ref=e241]: Claude Code
    - generic [ref=e244] [cursor=pointer]:
      - generic [ref=e245]:
        - generic [ref=e246]: 🌐
        - generic [ref=e247]: How and when to use subagents in Claude Code
        - button "🔗" [ref=e248]
        - button "☆" [ref=e249]
        - button "📌" [ref=e250]
        - button "🗑" [ref=e251]
      - generic [ref=e252]:
        - generic "Apr 7, 2020" [ref=e253]: 6y ago
        - generic [ref=e254]: AI Development
    - generic [ref=e257] [cursor=pointer]:
      - generic [ref=e258]:
        - generic [ref=e259]: ▶
        - generic [ref=e260]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
        - button "🔗" [ref=e261]
        - button "★" [ref=e262]
        - button "📌" [ref=e263]
        - button "🗑" [ref=e264]
      - generic "Apr 1, 2026" [ref=e266]: 2w ago
    - generic [ref=e269] [cursor=pointer]:
      - generic [ref=e270]:
        - generic [ref=e271]: ▶
        - generic [ref=e272]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
        - button "🔗" [ref=e273]
        - button "☆" [ref=e274]
        - button "📌" [ref=e275]
        - button "🗑" [ref=e276]
      - generic [ref=e277]:
        - generic "Jul 25, 2025" [ref=e278]: 8mo ago
        - generic [ref=e279]: Claude Code
    - generic [ref=e282] [cursor=pointer]:
      - generic [ref=e283]:
        - generic [ref=e284]: ▶
        - generic [ref=e285]: Elon Knew the Secret to AGI All Along
        - button "🔗" [ref=e286]
        - button "★" [ref=e287]
        - button "📌" [ref=e288]
        - button "🗑" [ref=e289]
      - generic [ref=e290]:
        - generic "Mar 29, 2026" [ref=e291]: 2w ago
        - generic [ref=e292]: Artificial Intelligence
    - generic [ref=e295] [cursor=pointer]:
      - generic [ref=e296]:
        - generic [ref=e297]: ▶
        - generic [ref=e298]: You&#39;re NOT Ready For What&#39;s Coming...
        - button "🔗" [ref=e299]
        - button "★" [ref=e300]
        - button "📌" [ref=e301]
        - button "🗑" [ref=e302]
      - generic "Mar 30, 2026" [ref=e304]: 2w ago
    - generic [ref=e307] [cursor=pointer]:
      - generic [ref=e308]:
        - generic [ref=e309]: ▶
        - generic [ref=e310]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
        - button "🔗" [ref=e311]
        - button "★" [ref=e312]
        - button "📌" [ref=e313]
        - button "🗑" [ref=e314]
      - generic [ref=e315]:
        - generic "Apr 1, 2026" [ref=e316]: 2w ago
        - generic [ref=e317]: AI Development
    - generic [ref=e320] [cursor=pointer]:
      - generic [ref=e321]:
        - generic [ref=e322]: ▶
        - generic [ref=e323]: Why You Should Bet Your Career on Local AI
        - button "🔗" [ref=e324]
        - button "☆" [ref=e325]
        - button "📌" [ref=e326]
        - button "🗑" [ref=e327]
      - generic [ref=e328]:
        - generic "Mar 30, 2026" [ref=e329]: 2w ago
        - generic [ref=e330]: AI
    - generic [ref=e333] [cursor=pointer]:
      - generic [ref=e334]:
        - generic [ref=e335]: ▶
        - generic [ref=e336]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
        - button "🔗" [ref=e337]
        - button "☆" [ref=e338]
        - button "📌" [ref=e339]
        - button "🗑" [ref=e340]
      - generic [ref=e341]:
        - generic "Apr 9, 2026" [ref=e342]: 6d ago
        - generic [ref=e343]: AI
    - generic [ref=e346] [cursor=pointer]:
      - generic [ref=e347]:
        - generic [ref=e348]: 🌐
        - generic [ref=e349]: Example Domain
        - button "🔗" [ref=e350]
        - button "☆" [ref=e351]
        - button "📌" [ref=e352]
        - button "🗑" [ref=e353]
      - generic [ref=e354]:
        - generic "Apr 10, 2026" [ref=e355]: 5d ago
        - generic [ref=e356]: Software Development
```

# Test source

```ts
  2   | 
  3   | const BASE = 'http://127.0.0.1:3737';
  4   | const MOBILE = { width: 375, height: 812 }; // iPhone 13/14
  5   | 
  6   | // Ensure at least one done item exists so the list is non-empty and clickable.
  7   | async function ensureDoneItem(request: import('@playwright/test').APIRequestContext): Promise<string | null> {
  8   |   const res = await request.get(`${BASE}/items`);
  9   |   if (!res.ok()) return null;
  10  |   const all = await res.json() as Array<{ id: string; status: string }>;
  11  |   const done = all.find((it) => it.status === 'done');
  12  |   return done ? done.id : null;
  13  | }
  14  | 
  15  | test.describe('mobile responsive layout', () => {
  16  |   test.use({ viewport: MOBILE });
  17  | 
  18  |   test('item list is full width on mobile viewport', async ({ page }) => {
  19  |     await page.goto(BASE);
  20  |     const list = page.locator('[data-testid="item-list"]');
  21  |     await expect(list).toBeVisible();
  22  |     const box = await list.boundingBox();
  23  |     expect(box).not.toBeNull();
  24  |     // Full width means at least 360px on a 375px viewport (allow small scrollbar/padding)
  25  |     expect(box!.width).toBeGreaterThanOrEqual(360);
  26  |   });
  27  | 
  28  |   test('no horizontal scroll on mobile viewport', async ({ page }) => {
  29  |     await page.goto(BASE);
  30  |     await page.waitForSelector('[data-testid="item-list"]');
  31  |     const scrollWidth = await page.evaluate(() => document.documentElement.scrollWidth);
  32  |     expect(scrollWidth).toBeLessThanOrEqual(MOBILE.width);
  33  |   });
  34  | 
  35  |   test('opening an item hides the list and shows the reader full width on mobile', async ({ page, request }) => {
  36  |     const doneId = await ensureDoneItem(request);
  37  |     if (!doneId) {
  38  |       // No data — seed a minimal item via API
  39  |       const r = await request.post(`${BASE}/process`, {
  40  |         data: { url: `https://example.com/mobile-test-${Date.now()}` },
  41  |         headers: { 'Content-Type': 'application/json' },
  42  |       });
  43  |       expect(r.ok()).toBeTruthy();
  44  |     }
  45  |     await page.goto(BASE);
  46  |     const list = page.locator('[data-testid="item-list"]');
  47  |     await expect(list).toBeVisible();
  48  | 
  49  |     // Wait for at least one card to render
  50  |     const firstCard = page.locator('.item-card').first();
  51  |     await firstCard.waitFor({ state: 'visible', timeout: 10000 });
  52  |     await firstCard.click();
  53  | 
  54  |     // Reader pane visible full-width
  55  |     const reader = page.locator('.reader-pane').first();
  56  |     await expect(reader).toBeVisible();
  57  |     const readerBox = await reader.boundingBox();
  58  |     expect(readerBox).not.toBeNull();
  59  |     expect(readerBox!.width).toBeGreaterThanOrEqual(360);
  60  | 
  61  |     // Item list is hidden (display: none) on mobile when reader is open
  62  |     const listVisible = await list.evaluate((el) => {
  63  |       const style = window.getComputedStyle(el);
  64  |       return style.display !== 'none' && style.visibility !== 'hidden' && (el as HTMLElement).offsetWidth > 0;
  65  |     });
  66  |     expect(listVisible).toBe(false);
  67  |   });
  68  | 
  69  |   test('back button returns from reader to list on mobile', async ({ page, request }) => {
  70  |     const doneId = await ensureDoneItem(request);
  71  |     if (!doneId) {
  72  |       const r = await request.post(`${BASE}/process`, {
  73  |         data: { url: `https://example.com/mobile-back-${Date.now()}` },
  74  |         headers: { 'Content-Type': 'application/json' },
  75  |       });
  76  |       expect(r.ok()).toBeTruthy();
  77  |     }
  78  |     await page.goto(BASE);
  79  | 
  80  |     const firstCard = page.locator('.item-card').first();
  81  |     await firstCard.waitFor({ state: 'visible', timeout: 10000 });
  82  |     await firstCard.click();
  83  | 
  84  |     const backBtn = page.locator('.reader-back-btn').first();
  85  |     await expect(backBtn).toBeVisible();
  86  | 
  87  |     // Tap target — min 44px on mobile
  88  |     const bbox = await backBtn.boundingBox();
  89  |     expect(bbox).not.toBeNull();
  90  |     expect(bbox!.height).toBeGreaterThanOrEqual(44);
  91  | 
  92  |     await backBtn.click();
  93  | 
  94  |     // Item list is visible again, reader-empty or reader hidden
  95  |     const list = page.locator('[data-testid="item-list"]');
  96  |     await expect(list).toBeVisible();
  97  |   });
  98  | 
  99  |   test('hamburger toggle reveals filter controls on mobile', async ({ page }) => {
  100 |     await page.goto(BASE);
  101 |     const hamburger = page.locator('[data-testid="mobile-menu-toggle"]');
> 102 |     await expect(hamburger).toBeVisible();
      |                             ^ Error: expect(locator).toBeVisible() failed
  103 | 
  104 |     // Tap target — min 44px
  105 |     const bbox = await hamburger.boundingBox();
  106 |     expect(bbox).not.toBeNull();
  107 |     expect(bbox!.height).toBeGreaterThanOrEqual(44);
  108 |     expect(bbox!.width).toBeGreaterThanOrEqual(44);
  109 | 
  110 |     // Filter controls (date buttons) hidden by default on mobile
  111 |     const dateFilters = page.locator('[data-testid="date-filters"]');
  112 |     const hiddenBefore = await dateFilters.evaluate((el) => {
  113 |       const style = window.getComputedStyle(el);
  114 |       return style.display === 'none' || (el as HTMLElement).offsetHeight === 0;
  115 |     });
  116 |     expect(hiddenBefore).toBe(true);
  117 | 
  118 |     // Click hamburger to reveal filters
  119 |     await hamburger.click();
  120 |     await expect(dateFilters).toBeVisible();
  121 |   });
  122 | });
  123 | 
  124 | test.describe('desktop layout unchanged', () => {
  125 |   test.use({ viewport: { width: 1280, height: 800 } });
  126 | 
  127 |   test('hamburger button is hidden on desktop', async ({ page }) => {
  128 |     await page.goto(BASE);
  129 |     const hamburger = page.locator('[data-testid="mobile-menu-toggle"]');
  130 |     // Either not in DOM or display:none
  131 |     const count = await hamburger.count();
  132 |     if (count > 0) {
  133 |       const hidden = await hamburger.evaluate((el) => {
  134 |         const style = window.getComputedStyle(el);
  135 |         return style.display === 'none';
  136 |       });
  137 |       expect(hidden).toBe(true);
  138 |     }
  139 |   });
  140 | 
  141 |   test('desktop shows both list and reader side by side', async ({ page }) => {
  142 |     await page.goto(BASE);
  143 |     const list = page.locator('[data-testid="item-list"]');
  144 |     await expect(list).toBeVisible();
  145 |     const listBox = await list.boundingBox();
  146 |     expect(listBox).not.toBeNull();
  147 |     // On desktop the list is the narrow ~280px pane
  148 |     expect(listBox!.width).toBeLessThan(400);
  149 |   });
  150 | });
  151 | 
```