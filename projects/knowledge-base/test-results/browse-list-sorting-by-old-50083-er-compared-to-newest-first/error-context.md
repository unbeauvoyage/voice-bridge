# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browse-list.spec.ts >> sorting by oldest first changes the order compared to newest first
- Location: tests/browse-list.spec.ts:126:1

# Error details

```
Error: expect(received).not.toBe(expected) // Object.is equality

Expected: not "Claude Code Subagents and Main-Agent Coordination: A Complete Guide to AI Agent Delegation Patterns"

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
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
    - generic [ref=e34] [cursor=pointer]:
      - generic [ref=e35]: 📚 26/3 today
      - generic [ref=e36]: 🔥 6 day streak
    - 'generic "Daily goal: 26 of 3" [ref=e37]'
    - generic [ref=e39] [cursor=pointer]: Sources
  - generic [ref=e40]:
    - generic [ref=e41]:
      - generic [ref=e42]:
        - generic [ref=e43]: 26 items
        - combobox "Sort order" [ref=e44] [cursor=pointer]:
          - option "Newest first"
          - option "Oldest first" [selected]
          - option "Recently read"
          - option "Highest rated"
          - option "Most starred"
          - option "Title A→Z"
          - option "Title Z→A"
      - generic [ref=e45]:
        - generic [ref=e46]:
          - button "All" [ref=e47] [cursor=pointer]
          - button "YouTube" [ref=e48] [cursor=pointer]
          - button "Web" [ref=e49] [cursor=pointer]
          - button "PDF" [ref=e50] [cursor=pointer]
        - button "Unread" [ref=e51] [cursor=pointer]
      - generic [ref=e54] [cursor=pointer]:
        - generic [ref=e55]:
          - generic [ref=e56]: 🌐
          - generic [ref=e57]: "Claude Code Subagents and Main-Agent Coordination: A Complete Guide to AI Agent Delegation Patterns"
          - button "🔗" [ref=e58]
          - button "★" [ref=e59]
          - button "📌" [ref=e60]
          - generic "Pinned": 📌
          - button "🗑" [ref=e61]
        - generic [ref=e62]:
          - generic "Mar 31, 2026" [ref=e63]: 2w ago
          - generic [ref=e64]: AI
      - generic [ref=e67] [cursor=pointer]:
        - generic [ref=e68]:
          - generic [ref=e69]: 🌐
          - generic [ref=e70]: Example Domain
          - button "🔗" [ref=e71]
          - button "☆" [ref=e72]
          - button "📌" [ref=e73]
          - button "🗑" [ref=e74]
        - generic [ref=e75]:
          - generic "Apr 10, 2026" [ref=e76]: 5d ago
          - generic [ref=e77]: Software Development
      - generic [ref=e80] [cursor=pointer]:
        - generic [ref=e81]:
          - generic [ref=e82]: ▶
          - generic [ref=e83]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e84]
          - button "☆" [ref=e85]
          - button "📌" [ref=e86]
          - button "🗑" [ref=e87]
        - generic [ref=e88]:
          - generic "Apr 9, 2026" [ref=e89]: 6d ago
          - generic [ref=e90]: AI
      - generic [ref=e93] [cursor=pointer]:
        - generic [ref=e94]:
          - generic [ref=e95]: ▶
          - generic [ref=e96]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e97]
          - button "☆" [ref=e98]
          - button "📌" [ref=e99]
          - button "🗑" [ref=e100]
        - generic [ref=e101]:
          - generic "Mar 30, 2026" [ref=e102]: 2w ago
          - generic [ref=e103]: AI
      - generic [ref=e106] [cursor=pointer]:
        - generic [ref=e107]:
          - generic [ref=e108]: ▶
          - generic [ref=e109]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e110]
          - button "★" [ref=e111]
          - button "📌" [ref=e112]
          - button "🗑" [ref=e113]
        - generic [ref=e114]:
          - generic "Apr 1, 2026" [ref=e115]: 2w ago
          - generic [ref=e116]: AI Development
      - generic [ref=e119] [cursor=pointer]:
        - generic [ref=e120]:
          - generic [ref=e121]: ▶
          - generic [ref=e122]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e123]
          - button "★" [ref=e124]
          - button "📌" [ref=e125]
          - button "🗑" [ref=e126]
        - generic "Mar 30, 2026" [ref=e128]: 2w ago
      - generic [ref=e131] [cursor=pointer]:
        - generic [ref=e132]:
          - generic [ref=e133]: ▶
          - generic [ref=e134]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e135]
          - button "★" [ref=e136]
          - button "📌" [ref=e137]
          - button "🗑" [ref=e138]
        - generic [ref=e139]:
          - generic "Mar 29, 2026" [ref=e140]: 2w ago
          - generic [ref=e141]: Artificial Intelligence
      - generic [ref=e144] [cursor=pointer]:
        - generic [ref=e145]:
          - generic [ref=e146]: ▶
          - generic [ref=e147]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e148]
          - button "☆" [ref=e149]
          - button "📌" [ref=e150]
          - button "🗑" [ref=e151]
        - generic [ref=e152]:
          - generic "Jul 25, 2025" [ref=e153]: 8mo ago
          - generic [ref=e154]: Claude Code
      - generic [ref=e157] [cursor=pointer]:
        - generic [ref=e158]:
          - generic [ref=e159]: ▶
          - generic [ref=e160]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e161]
          - button "★" [ref=e162]
          - button "📌" [ref=e163]
          - button "🗑" [ref=e164]
        - generic "Apr 1, 2026" [ref=e166]: 2w ago
      - generic [ref=e169] [cursor=pointer]:
        - generic [ref=e170]:
          - generic [ref=e171]: 🌐
          - generic [ref=e172]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e173]
          - button "☆" [ref=e174]
          - button "📌" [ref=e175]
          - button "🗑" [ref=e176]
        - generic [ref=e177]:
          - generic "Apr 7, 2020" [ref=e178]: 6y ago
          - generic [ref=e179]: AI Development
      - generic [ref=e182] [cursor=pointer]:
        - generic [ref=e183]:
          - generic [ref=e184]: 🌐
          - generic [ref=e185]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e186]
          - button "☆" [ref=e187]
          - button "📌" [ref=e188]
          - button "🗑" [ref=e189]
        - generic [ref=e190]:
          - generic "Feb 18, 2026" [ref=e191]: 1mo ago
          - generic [ref=e192]: Claude Code
      - generic [ref=e195] [cursor=pointer]:
        - generic [ref=e196]:
          - generic [ref=e197]: 🌐
          - generic [ref=e198]: Artificial Intelligence
          - button "🔗" [ref=e199]
          - button "☆" [ref=e200]
          - button "📌" [ref=e201]
          - button "🗑" [ref=e202]
        - generic [ref=e203]:
          - generic "Apr 15, 2026" [ref=e204]: today
          - generic [ref=e205]: Artificial Intelligence
      - generic [ref=e208] [cursor=pointer]:
        - generic [ref=e209]:
          - generic [ref=e210]: 🌐
          - generic [ref=e211]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e212]
          - button "☆" [ref=e213]
          - button "📌" [ref=e214]
          - button "🗑" [ref=e215]
        - generic [ref=e216]:
          - generic "Apr 11, 2026" [ref=e217]: 5d ago
          - generic [ref=e218]: Artificial Intelligence
      - generic [ref=e221] [cursor=pointer]:
        - generic [ref=e222]:
          - generic [ref=e223]: 🌐
          - generic [ref=e224]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e225]
          - button "☆" [ref=e226]
          - button "📌" [ref=e227]
          - button "🗑" [ref=e228]
        - generic [ref=e229]:
          - generic "Apr 15, 2026" [ref=e230]: today
          - generic [ref=e231]: AI
      - generic [ref=e234] [cursor=pointer]:
        - generic [ref=e235]:
          - generic [ref=e236]: 🌐
          - generic [ref=e237]: "Category: AI"
          - button "🔗" [ref=e238]
          - button "☆" [ref=e239]
          - button "📌" [ref=e240]
          - button "🗑" [ref=e241]
        - generic "Apr 14, 2026" [ref=e243]: yesterday
      - generic [ref=e246] [cursor=pointer]:
        - generic [ref=e247]:
          - generic [ref=e248]: 🌐
          - generic [ref=e249]: Tech
          - button "🔗" [ref=e250]
          - button "☆" [ref=e251]
          - button "📌" [ref=e252]
          - button "🗑" [ref=e253]
        - generic [ref=e254]:
          - generic "Apr 14, 2026" [ref=e255]: yesterday
          - generic [ref=e256]: Artificial Intelligence
      - generic [ref=e259] [cursor=pointer]:
        - generic [ref=e260]:
          - generic [ref=e261]: 🌐
          - generic [ref=e262]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e263]
          - button "☆" [ref=e264]
          - button "📌" [ref=e265]
          - button "🗑" [ref=e266]
        - generic "Apr 11, 2026" [ref=e268]: 5d ago
      - generic [ref=e271] [cursor=pointer]:
        - generic [ref=e272]:
          - generic [ref=e273]: ▶
          - generic [ref=e274]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e275]
          - button "☆" [ref=e276]
          - button "📌" [ref=e277]
          - button "🗑" [ref=e278]
        - generic [ref=e279]:
          - generic "Apr 6, 2026" [ref=e280]: 1w ago
          - generic [ref=e281]: AI Development
      - generic [ref=e284] [cursor=pointer]:
        - generic [ref=e285]:
          - generic [ref=e286]: ▶
          - generic [ref=e287]: Claude Code is unusable now
          - button "🔗" [ref=e288]
          - button "☆" [ref=e289]
          - button "📌" [ref=e290]
          - button "🗑" [ref=e291]
        - generic [ref=e292]:
          - generic "Apr 5, 2026" [ref=e293]: 1w ago
          - generic [ref=e294]: AI
      - generic [ref=e297] [cursor=pointer]:
        - generic [ref=e298]:
          - generic [ref=e299]: ▶
          - generic [ref=e300]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e301]
          - button "☆" [ref=e302]
          - button "📌" [ref=e303]
          - button "🗑" [ref=e304]
        - generic [ref=e305]:
          - generic "Mar 23, 2026" [ref=e306]: 3w ago
          - generic [ref=e307]: Artificial Intelligence
      - generic [ref=e310] [cursor=pointer]:
        - generic [ref=e311]:
          - generic [ref=e312]: ▶
          - generic [ref=e313]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e314]
          - button "☆" [ref=e315]
          - button "📌" [ref=e316]
          - button "🗑" [ref=e317]
        - generic [ref=e318]:
          - generic "Dec 20, 2025" [ref=e319]: 3mo ago
          - generic [ref=e320]: Artificial Intelligence
      - generic [ref=e323] [cursor=pointer]:
        - generic [ref=e324]:
          - generic [ref=e325]: ▶
          - generic [ref=e326]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e327]
          - button "☆" [ref=e328]
          - button "📌" [ref=e329]
          - button "🗑" [ref=e330]
        - generic [ref=e331]:
          - generic "Mar 23, 2026" [ref=e332]: 3w ago
          - generic [ref=e333]: AI Development
      - generic [ref=e336] [cursor=pointer]:
        - generic [ref=e337]:
          - generic [ref=e338]: 🌐
          - generic [ref=e339]: Raise Popup Test Item
          - button "🔗" [ref=e340]
          - button "☆" [ref=e341]
          - button "📌" [ref=e342]
          - button "🗑" [ref=e343]
        - generic "Apr 18, 2026" [ref=e345]: "-2d ago"
      - generic [ref=e348] [cursor=pointer]:
        - generic [ref=e349]:
          - generic [ref=e350]: 🌐
          - generic [ref=e351]: Raise Popup Test Item
          - button "🔗" [ref=e352]
          - button "★" [ref=e353]
          - button "📌" [ref=e354]
          - button "🗑" [ref=e355]
        - generic "Apr 18, 2026" [ref=e357]: "-2d ago"
      - generic [ref=e360] [cursor=pointer]:
        - generic [ref=e361]:
          - generic [ref=e362]: 🌐
          - generic [ref=e363]: Raise Popup Test Item
          - button "🔗" [ref=e364]
          - button "☆" [ref=e365]
          - button "📌" [ref=e366]
          - button "🗑" [ref=e367]
        - generic "Apr 18, 2026" [ref=e369]: "-2d ago"
      - generic [ref=e372] [cursor=pointer]:
        - generic [ref=e373]:
          - generic [ref=e374]: 🌐
          - generic [ref=e375]: Raise Popup Test Item
          - button "🔗" [ref=e376]
          - button "☆" [ref=e377]
          - button "📌" [ref=e378]
          - button "🗑" [ref=e379]
        - generic "Apr 18, 2026" [ref=e381]: "-2d ago"
    - generic [ref=e384]:
      - generic [ref=e385]: ←
      - text: Select an item to read
```

# Test source

```ts
  36  | test('filtering by type YouTube shows only YouTube items', async ({ page, request }) => {
  37  |   const res = await request.get(`${BASE}/items`);
  38  |   const items: Array<{ id: string; type: string; status: string }> = await res.json();
  39  |   const done = items.filter((i) => i.status === 'done');
  40  |   const yt = done.filter((i) => i.type === 'youtube');
  41  |   const web = done.filter((i) => i.type !== 'youtube');
  42  | 
  43  |   await page.goto(BASE + '/');
  44  |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  45  |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  46  | 
  47  |   const ytPill = page.locator('.type-pill', { hasText: 'YouTube' });
  48  |   await expect(ytPill).toBeVisible();
  49  |   await ytPill.click();
  50  |   await expect(ytPill).toHaveClass(/active/);
  51  | 
  52  |   if (yt.length > 0 && web.length > 0) {
  53  |     await expect(page.locator(`.item-card[data-id="${yt[0].id}"]`)).toBeVisible({ timeout: 5_000 });
  54  |     await expect(page.locator(`.item-card[data-id="${web[0].id}"]`)).not.toBeVisible();
  55  |   } else {
  56  |     await expect(page.locator('[data-testid="item-count"]').or(page.locator('[data-testid="empty-state"]'))).toBeVisible({ timeout: 5_000 });
  57  |   }
  58  | });
  59  | 
  60  | test('filtering by type Web shows only web article items', async ({ page, request }) => {
  61  |   const res = await request.get(`${BASE}/items`);
  62  |   const items: Array<{ id: string; type: string; status: string }> = await res.json();
  63  |   const done = items.filter((i) => i.status === 'done');
  64  |   const web = done.filter((i) => i.type === 'web' || i.type === 'article');
  65  |   const yt = done.filter((i) => i.type === 'youtube');
  66  | 
  67  |   await page.goto(BASE + '/');
  68  |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  69  |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  70  | 
  71  |   const webPill = page.locator('.type-pill', { hasText: 'Web' });
  72  |   await expect(webPill).toBeVisible();
  73  |   await webPill.click();
  74  |   await expect(webPill).toHaveClass(/active/);
  75  | 
  76  |   if (web.length > 0 && yt.length > 0) {
  77  |     await expect(page.locator(`.item-card[data-id="${web[0].id}"]`)).toBeVisible({ timeout: 5_000 });
  78  |     await expect(page.locator(`.item-card[data-id="${yt[0].id}"]`)).not.toBeVisible();
  79  |   } else {
  80  |     await expect(page.locator('[data-testid="item-count"]').or(page.locator('[data-testid="empty-state"]'))).toBeVisible({ timeout: 5_000 });
  81  |   }
  82  | });
  83  | 
  84  | test('clicking All type pill restores the full list after filtering', async ({ page }) => {
  85  |   await page.goto(BASE + '/');
  86  |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  87  |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  88  |   const totalBefore = await page.locator('.item-card').count();
  89  | 
  90  |   await page.locator('.type-pill', { hasText: 'YouTube' }).click();
  91  |   const allPill = page.locator('.type-pill', { hasText: 'All' });
  92  |   await allPill.click();
  93  |   await expect(allPill).toHaveClass(/active/);
  94  |   await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThanOrEqual(totalBefore);
  95  | });
  96  | 
  97  | test('filtering by starred status shows only starred items', async ({ page, request }) => {
  98  |   const res = await request.get(`${BASE}/items`);
  99  |   const items: Array<{ id: string; starred: boolean; status: string }> = await res.json();
  100 |   const done = items.filter((i) => i.status === 'done');
  101 |   const starred = done.filter((i) => i.starred);
  102 |   const unstarred = done.filter((i) => !i.starred);
  103 | 
  104 |   await page.goto(BASE + '/');
  105 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  106 |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  107 | 
  108 |   const starredBtn = page.locator('.starred-filter-btn');
  109 |   await expect(starredBtn).toBeVisible();
  110 |   await starredBtn.click();
  111 |   await expect(starredBtn).toHaveClass(/active/);
  112 | 
  113 |   // After clicking starred filter, the list must show ONLY starred items (or empty state)
  114 |   if (starred.length > 0 && unstarred.length > 0) {
  115 |     await expect(page.locator(`.item-card[data-id="${starred[0].id}"]`)).toBeVisible({ timeout: 5_000 });
  116 |     await expect(page.locator(`.item-card[data-id="${unstarred[0].id}"]`)).not.toBeVisible();
  117 |   } else if (starred.length === 0) {
  118 |     // No starred items — empty state should appear
  119 |     await expect(page.locator('[data-testid="empty-state"]')).toBeVisible({ timeout: 5_000 });
  120 |   } else {
  121 |     // All items are starred — they all remain visible, just unstarred items are filtered out (none to filter)
  122 |     await expect(page.locator('[data-testid="item-count"]')).toBeVisible({ timeout: 5_000 });
  123 |   }
  124 | });
  125 | 
  126 | test('sorting by oldest first changes the order compared to newest first', async ({ page }) => {
  127 |   await page.goto(BASE + '/');
  128 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  129 |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  130 |   await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThan(1);
  131 | 
  132 |   const titlesBefore = await page.locator('.item-card .item-card-title').allInnerTexts();
  133 |   const firstNewest = titlesBefore[0];
  134 | 
  135 |   await page.locator('select.sort-select').selectOption('oldest');
> 136 |   await expect
      |   ^ Error: expect(received).not.toBe(expected) // Object.is equality
  137 |     .poll(async () => page.locator('.item-card .item-card-title').first().innerText(), { timeout: 5_000 })
  138 |     .not.toBe(firstNewest);
  139 | });
  140 | 
  141 | test('sorting by title A to Z produces a different order than newest-first', async ({ page }) => {
  142 |   await page.goto(BASE + '/');
  143 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  144 |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 10_000 });
  145 |   await expect.poll(async () => page.locator('.item-card').count(), { timeout: 5_000 }).toBeGreaterThan(1);
  146 | 
  147 |   // Capture first title in default newest-first order
  148 |   const titlesDefault = await page.locator('.item-card .item-card-title').allInnerTexts();
  149 |   const defaultFirst = titlesDefault[0];
  150 | 
  151 |   await page.locator('select.sort-select').selectOption('title-az');
  152 | 
  153 |   // After switching to title-az, the first title should reflect alphabetical ordering.
  154 |   // We verify the sort was applied by confirming the title-az first differs from newest-first
  155 |   // AND that the title-az first item begins alphabetically before the default-first item
  156 |   // (unless the newest item happens to be alphabetically first too, which is rare with real data).
  157 |   await expect.poll(async () => {
  158 |     const titles = await page.locator('.item-card .item-card-title').allInnerTexts();
  159 |     return titles.length;
  160 |   }, { timeout: 5_000 }).toBeGreaterThan(0);
  161 | 
  162 |   const titlesAz = await page.locator('.item-card .item-card-title').allInnerTexts();
  163 |   expect(titlesAz.length).toBeGreaterThan(0);
  164 | 
  165 |   // Verify title-az and newest-first produce different orders when there are multiple items
  166 |   if (titlesAz.length > 1 && titlesDefault.length > 1) {
  167 |     // The sorted list should match the localeCompare sort
  168 |     const expectedFirstAz = [...titlesDefault].sort((a, b) => a.localeCompare(b))[0];
  169 |     expect(titlesAz[0]).toBe(expectedFirstAz);
  170 |   }
  171 | });
  172 | 
  173 | test('sort dropdown renders with Newest first Oldest first and Title A to Z options', async ({ page }) => {
  174 |   await page.goto(BASE + '/');
  175 |   await expect(page.locator('[data-testid="item-list"]')).toBeVisible();
  176 |   const sortSelect = page.locator('select.sort-select');
  177 |   await expect(sortSelect).toBeVisible();
  178 |   await expect(sortSelect.locator('option[value="newest"]')).toBeAttached();
  179 |   await expect(sortSelect.locator('option[value="oldest"]')).toBeAttached();
  180 |   await expect(sortSelect.locator('option[value="title-az"]')).toBeAttached();
  181 | });
  182 | 
```