# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: browse-list.spec.ts >> sorting by title A to Z produces a different order than newest-first
- Location: tests/browse-list.spec.ts:141:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！"
Received: "Claude Code Subagents and Main-Agent Coordination: A Complete Guide to AI Agent Delegation Patterns"
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
      - generic [ref=e38]: 📚 27/3 today
      - generic [ref=e39]: 🔥 6 day streak
    - 'generic "Daily goal: 27 of 3" [ref=e40]'
    - generic [ref=e42] [cursor=pointer]: Sources
  - generic [ref=e43]:
    - generic [ref=e44]:
      - generic [ref=e45]:
        - generic [ref=e46]: 27 items
        - combobox "Sort order" [ref=e47] [cursor=pointer]:
          - option "Newest first"
          - option "Oldest first"
          - option "Recently read"
          - option "Highest rated"
          - option "Most starred"
          - option "Title A→Z" [selected]
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
          - generic [ref=e60]: "Claude Code Subagents and Main-Agent Coordination: A Complete Guide to AI Agent Delegation Patterns"
          - button "🔗" [ref=e61]
          - button "★" [ref=e62]
          - button "📌" [ref=e63]
          - generic "Pinned": 📌
          - button "🗑" [ref=e64]
        - generic [ref=e65]:
          - generic "Mar 31, 2026" [ref=e66]: 2w ago
          - generic [ref=e67]: AI
      - generic [ref=e70] [cursor=pointer]:
        - generic [ref=e71]:
          - generic [ref=e72]: ▶
          - generic [ref=e73]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e74]
          - button "☆" [ref=e75]
          - button "📌" [ref=e76]
          - button "🗑" [ref=e77]
        - generic [ref=e78]:
          - generic "Jul 25, 2025" [ref=e79]: 8mo ago
          - generic [ref=e80]: Claude Code
      - generic [ref=e83] [cursor=pointer]:
        - generic [ref=e84]:
          - generic [ref=e85]: ▶
          - generic [ref=e86]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e87]
          - button "★" [ref=e88]
          - button "📌" [ref=e89]
          - button "🗑" [ref=e90]
        - generic "Apr 1, 2026" [ref=e92]: 2w ago
      - generic [ref=e95] [cursor=pointer]:
        - generic [ref=e96]:
          - generic [ref=e97]: 🌐
          - generic [ref=e98]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e99]
          - button "☆" [ref=e100]
          - button "📌" [ref=e101]
          - button "🗑" [ref=e102]
        - generic [ref=e103]:
          - generic "Feb 18, 2026" [ref=e104]: 1mo ago
          - generic [ref=e105]: Claude Code
      - generic [ref=e108] [cursor=pointer]:
        - generic [ref=e109]:
          - generic [ref=e110]: 🌐
          - generic [ref=e111]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e112]
          - button "☆" [ref=e113]
          - button "📌" [ref=e114]
          - button "🗑" [ref=e115]
        - generic [ref=e116]:
          - generic "Apr 15, 2026" [ref=e117]: today
          - generic [ref=e118]: AI
      - generic [ref=e121] [cursor=pointer]:
        - generic [ref=e122]:
          - generic [ref=e123]: 🌐
          - generic [ref=e124]: Artificial Intelligence
          - button "🔗" [ref=e125]
          - button "☆" [ref=e126]
          - button "📌" [ref=e127]
          - button "🗑" [ref=e128]
        - generic [ref=e129]:
          - generic "Apr 15, 2026" [ref=e130]: today
          - generic [ref=e131]: Artificial Intelligence
      - generic [ref=e134] [cursor=pointer]:
        - generic [ref=e135]:
          - generic [ref=e136]: 🌐
          - generic [ref=e137]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e138]
          - button "☆" [ref=e139]
          - button "📌" [ref=e140]
          - button "🗑" [ref=e141]
        - generic "Apr 11, 2026" [ref=e143]: 5d ago
      - generic [ref=e146] [cursor=pointer]:
        - generic [ref=e147]:
          - generic [ref=e148]: 🌐
          - generic [ref=e149]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e150]
          - button "☆" [ref=e151]
          - button "📌" [ref=e152]
          - button "🗑" [ref=e153]
        - generic [ref=e154]:
          - generic "Apr 11, 2026" [ref=e155]: 5d ago
          - generic [ref=e156]: Artificial Intelligence
      - generic [ref=e159] [cursor=pointer]:
        - generic [ref=e160]:
          - generic [ref=e161]: 🌐
          - generic [ref=e162]: "Category: AI"
          - button "🔗" [ref=e163]
          - button "☆" [ref=e164]
          - button "📌" [ref=e165]
          - button "🗑" [ref=e166]
        - generic "Apr 14, 2026" [ref=e168]: yesterday
      - generic [ref=e171] [cursor=pointer]:
        - generic [ref=e172]:
          - generic [ref=e173]: ▶
          - generic [ref=e174]: Claude Code is unusable now
          - button "🔗" [ref=e175]
          - button "☆" [ref=e176]
          - button "📌" [ref=e177]
          - button "🗑" [ref=e178]
        - generic [ref=e179]:
          - generic "Apr 5, 2026" [ref=e180]: 1w ago
          - generic [ref=e181]: AI
      - generic [ref=e184] [cursor=pointer]:
        - generic [ref=e185]:
          - generic [ref=e186]: ▶
          - generic [ref=e187]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e188]
          - button "★" [ref=e189]
          - button "📌" [ref=e190]
          - button "🗑" [ref=e191]
        - generic [ref=e192]:
          - generic "Apr 1, 2026" [ref=e193]: 2w ago
          - generic [ref=e194]: AI Development
      - generic [ref=e197] [cursor=pointer]:
        - generic [ref=e198]:
          - generic [ref=e199]: ▶
          - generic [ref=e200]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e201]
          - button "★" [ref=e202]
          - button "📌" [ref=e203]
          - button "🗑" [ref=e204]
        - generic [ref=e205]:
          - generic "Mar 29, 2026" [ref=e206]: 2w ago
          - generic [ref=e207]: Artificial Intelligence
      - generic [ref=e210] [cursor=pointer]:
        - generic [ref=e211]:
          - generic [ref=e212]: 🌐
          - generic [ref=e213]: Example Domain
          - button "🔗" [ref=e214]
          - button "☆" [ref=e215]
          - button "📌" [ref=e216]
          - button "🗑" [ref=e217]
        - generic [ref=e218]:
          - generic "Apr 10, 2026" [ref=e219]: 5d ago
          - generic [ref=e220]: Software Development
      - generic [ref=e223] [cursor=pointer]:
        - generic [ref=e224]:
          - generic [ref=e225]: ▶
          - generic [ref=e226]: Favorite Star Test Item
          - button "🔗" [ref=e227]
          - button "★" [ref=e228]
          - button "📌" [ref=e229]
          - button "🗑" [ref=e230]
        - generic "Apr 15, 2026" [ref=e232]: today
      - generic [ref=e235] [cursor=pointer]:
        - generic [ref=e236]:
          - generic [ref=e237]: 🌐
          - generic [ref=e238]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e239]
          - button "☆" [ref=e240]
          - button "📌" [ref=e241]
          - button "🗑" [ref=e242]
        - generic [ref=e243]:
          - generic "Apr 7, 2020" [ref=e244]: 6y ago
          - generic [ref=e245]: AI Development
      - generic [ref=e248] [cursor=pointer]:
        - generic [ref=e249]:
          - generic [ref=e250]: ▶
          - generic [ref=e251]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e252]
          - button "☆" [ref=e253]
          - button "📌" [ref=e254]
          - button "🗑" [ref=e255]
        - generic [ref=e256]:
          - generic "Mar 23, 2026" [ref=e257]: 3w ago
          - generic [ref=e258]: AI Development
      - generic [ref=e261] [cursor=pointer]:
        - generic [ref=e262]:
          - generic [ref=e263]: ▶
          - generic [ref=e264]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e265]
          - button "☆" [ref=e266]
          - button "📌" [ref=e267]
          - button "🗑" [ref=e268]
        - generic [ref=e269]:
          - generic "Apr 6, 2026" [ref=e270]: 1w ago
          - generic [ref=e271]: AI Development
      - generic [ref=e274] [cursor=pointer]:
        - generic [ref=e275]:
          - generic [ref=e276]: ▶
          - generic [ref=e277]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e278]
          - button "☆" [ref=e279]
          - button "📌" [ref=e280]
          - button "🗑" [ref=e281]
        - generic [ref=e282]:
          - generic "Mar 23, 2026" [ref=e283]: 3w ago
          - generic [ref=e284]: Artificial Intelligence
      - generic [ref=e287] [cursor=pointer]:
        - generic [ref=e288]:
          - generic [ref=e289]: 🌐
          - generic [ref=e290]: Raise Popup Test Item
          - button "🔗" [ref=e291]
          - button "☆" [ref=e292]
          - button "📌" [ref=e293]
          - button "🗑" [ref=e294]
        - generic "Apr 18, 2026" [ref=e296]: "-2d ago"
      - generic [ref=e299] [cursor=pointer]:
        - generic [ref=e300]:
          - generic [ref=e301]: 🌐
          - generic [ref=e302]: Raise Popup Test Item
          - button "🔗" [ref=e303]
          - button "☆" [ref=e304]
          - button "📌" [ref=e305]
          - button "🗑" [ref=e306]
        - generic "Apr 18, 2026" [ref=e308]: "-2d ago"
      - generic [ref=e311] [cursor=pointer]:
        - generic [ref=e312]:
          - generic [ref=e313]: 🌐
          - generic [ref=e314]: Raise Popup Test Item
          - button "🔗" [ref=e315]
          - button "★" [ref=e316]
          - button "📌" [ref=e317]
          - button "🗑" [ref=e318]
        - generic "Apr 18, 2026" [ref=e320]: "-2d ago"
      - generic [ref=e323] [cursor=pointer]:
        - generic [ref=e324]:
          - generic [ref=e325]: 🌐
          - generic [ref=e326]: Raise Popup Test Item
          - button "🔗" [ref=e327]
          - button "☆" [ref=e328]
          - button "📌" [ref=e329]
          - button "🗑" [ref=e330]
        - generic "Apr 18, 2026" [ref=e332]: "-2d ago"
      - generic [ref=e335] [cursor=pointer]:
        - generic [ref=e336]:
          - generic [ref=e337]: 🌐
          - generic [ref=e338]: Tech
          - button "🔗" [ref=e339]
          - button "☆" [ref=e340]
          - button "📌" [ref=e341]
          - button "🗑" [ref=e342]
        - generic [ref=e343]:
          - generic "Apr 14, 2026" [ref=e344]: yesterday
          - generic [ref=e345]: Artificial Intelligence
      - generic [ref=e348] [cursor=pointer]:
        - generic [ref=e349]:
          - generic [ref=e350]: ▶
          - generic [ref=e351]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e352]
          - button "☆" [ref=e353]
          - button "📌" [ref=e354]
          - button "🗑" [ref=e355]
        - generic [ref=e356]:
          - generic "Dec 20, 2025" [ref=e357]: 3mo ago
          - generic [ref=e358]: Artificial Intelligence
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
          - generic [ref=e376]: ▶
          - generic [ref=e377]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e378]
          - button "☆" [ref=e379]
          - button "📌" [ref=e380]
          - button "🗑" [ref=e381]
        - generic [ref=e382]:
          - generic "Mar 30, 2026" [ref=e383]: 2w ago
          - generic [ref=e384]: AI
      - generic [ref=e387] [cursor=pointer]:
        - generic [ref=e388]:
          - generic [ref=e389]: ▶
          - generic [ref=e390]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e391]
          - button "★" [ref=e392]
          - button "📌" [ref=e393]
          - button "🗑" [ref=e394]
        - generic "Mar 30, 2026" [ref=e396]: 2w ago
    - generic [ref=e399]:
      - generic [ref=e400]: ←
      - text: Select an item to read
```

# Test source

```ts
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
  136 |   await expect
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
> 169 |     expect(titlesAz[0]).toBe(expectedFirstAz);
      |                         ^ Error: expect(received).toBe(expected) // Object.is equality
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