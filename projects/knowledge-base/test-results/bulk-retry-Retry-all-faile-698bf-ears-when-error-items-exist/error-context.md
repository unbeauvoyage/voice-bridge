# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: bulk-retry.spec.ts >> Retry all failed button appears when error items exist
- Location: tests/bulk-retry.spec.ts:109:1

# Error details

```
Error: expect(locator).toBeVisible() failed

Locator: locator('[data-testid="queue-toggle"]')
Expected: visible
Timeout: 10000ms
Error: element(s) not found

Call log:
  - Expect "toBeVisible" with timeout 10000ms
  - waiting for locator('[data-testid="queue-toggle"]')

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
          - option "Newest first" [selected]
          - option "Oldest first"
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
          - generic [ref=e70]: Raise Popup Test Item
          - button "🔗" [ref=e71]
          - button "☆" [ref=e72]
          - button "📌" [ref=e73]
          - button "🗑" [ref=e74]
        - generic "Apr 18, 2026" [ref=e76]: "-2d ago"
      - generic [ref=e79] [cursor=pointer]:
        - generic [ref=e80]:
          - generic [ref=e81]: 🌐
          - generic [ref=e82]: Raise Popup Test Item
          - button "🔗" [ref=e83]
          - button "☆" [ref=e84]
          - button "📌" [ref=e85]
          - button "🗑" [ref=e86]
        - generic "Apr 18, 2026" [ref=e88]: "-2d ago"
      - generic [ref=e91] [cursor=pointer]:
        - generic [ref=e92]:
          - generic [ref=e93]: 🌐
          - generic [ref=e94]: Raise Popup Test Item
          - button "🔗" [ref=e95]
          - button "★" [ref=e96]
          - button "📌" [ref=e97]
          - button "🗑" [ref=e98]
        - generic "Apr 18, 2026" [ref=e100]: "-2d ago"
      - generic [ref=e103] [cursor=pointer]:
        - generic [ref=e104]:
          - generic [ref=e105]: 🌐
          - generic [ref=e106]: Raise Popup Test Item
          - button "🔗" [ref=e107]
          - button "☆" [ref=e108]
          - button "📌" [ref=e109]
          - button "🗑" [ref=e110]
        - generic "Apr 18, 2026" [ref=e112]: "-2d ago"
      - generic [ref=e115] [cursor=pointer]:
        - generic [ref=e116]:
          - generic [ref=e117]: ▶
          - generic [ref=e118]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e119]
          - button "☆" [ref=e120]
          - button "📌" [ref=e121]
          - button "🗑" [ref=e122]
        - generic [ref=e123]:
          - generic "Mar 23, 2026" [ref=e124]: 3w ago
          - generic [ref=e125]: AI Development
      - generic [ref=e128] [cursor=pointer]:
        - generic [ref=e129]:
          - generic [ref=e130]: ▶
          - generic [ref=e131]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e132]
          - button "☆" [ref=e133]
          - button "📌" [ref=e134]
          - button "🗑" [ref=e135]
        - generic [ref=e136]:
          - generic "Dec 20, 2025" [ref=e137]: 3mo ago
          - generic [ref=e138]: Artificial Intelligence
      - generic [ref=e141] [cursor=pointer]:
        - generic [ref=e142]:
          - generic [ref=e143]: ▶
          - generic [ref=e144]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e145]
          - button "☆" [ref=e146]
          - button "📌" [ref=e147]
          - button "🗑" [ref=e148]
        - generic [ref=e149]:
          - generic "Mar 23, 2026" [ref=e150]: 3w ago
          - generic [ref=e151]: Artificial Intelligence
      - generic [ref=e154] [cursor=pointer]:
        - generic [ref=e155]:
          - generic [ref=e156]: ▶
          - generic [ref=e157]: Claude Code is unusable now
          - button "🔗" [ref=e158]
          - button "☆" [ref=e159]
          - button "📌" [ref=e160]
          - button "🗑" [ref=e161]
        - generic [ref=e162]:
          - generic "Apr 5, 2026" [ref=e163]: 1w ago
          - generic [ref=e164]: AI
      - generic [ref=e167] [cursor=pointer]:
        - generic [ref=e168]:
          - generic [ref=e169]: ▶
          - generic [ref=e170]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e171]
          - button "☆" [ref=e172]
          - button "📌" [ref=e173]
          - button "🗑" [ref=e174]
        - generic [ref=e175]:
          - generic "Apr 6, 2026" [ref=e176]: 1w ago
          - generic [ref=e177]: AI Development
      - generic [ref=e180] [cursor=pointer]:
        - generic [ref=e181]:
          - generic [ref=e182]: 🌐
          - generic [ref=e183]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e184]
          - button "☆" [ref=e185]
          - button "📌" [ref=e186]
          - button "🗑" [ref=e187]
        - generic "Apr 11, 2026" [ref=e189]: 5d ago
      - generic [ref=e192] [cursor=pointer]:
        - generic [ref=e193]:
          - generic [ref=e194]: 🌐
          - generic [ref=e195]: Tech
          - button "🔗" [ref=e196]
          - button "☆" [ref=e197]
          - button "📌" [ref=e198]
          - button "🗑" [ref=e199]
        - generic [ref=e200]:
          - generic "Apr 14, 2026" [ref=e201]: yesterday
          - generic [ref=e202]: Artificial Intelligence
      - generic [ref=e205] [cursor=pointer]:
        - generic [ref=e206]:
          - generic [ref=e207]: 🌐
          - generic [ref=e208]: "Category: AI"
          - button "🔗" [ref=e209]
          - button "☆" [ref=e210]
          - button "📌" [ref=e211]
          - button "🗑" [ref=e212]
        - generic "Apr 14, 2026" [ref=e214]: yesterday
      - generic [ref=e217] [cursor=pointer]:
        - generic [ref=e218]:
          - generic [ref=e219]: 🌐
          - generic [ref=e220]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e221]
          - button "☆" [ref=e222]
          - button "📌" [ref=e223]
          - button "🗑" [ref=e224]
        - generic [ref=e225]:
          - generic "Apr 15, 2026" [ref=e226]: today
          - generic [ref=e227]: AI
      - generic [ref=e230] [cursor=pointer]:
        - generic [ref=e231]:
          - generic [ref=e232]: 🌐
          - generic [ref=e233]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e234]
          - button "☆" [ref=e235]
          - button "📌" [ref=e236]
          - button "🗑" [ref=e237]
        - generic [ref=e238]:
          - generic "Apr 11, 2026" [ref=e239]: 5d ago
          - generic [ref=e240]: Artificial Intelligence
      - generic [ref=e243] [cursor=pointer]:
        - generic [ref=e244]:
          - generic [ref=e245]: 🌐
          - generic [ref=e246]: Artificial Intelligence
          - button "🔗" [ref=e247]
          - button "☆" [ref=e248]
          - button "📌" [ref=e249]
          - button "🗑" [ref=e250]
        - generic [ref=e251]:
          - generic "Apr 15, 2026" [ref=e252]: today
          - generic [ref=e253]: Artificial Intelligence
      - generic [ref=e256] [cursor=pointer]:
        - generic [ref=e257]:
          - generic [ref=e258]: 🌐
          - generic [ref=e259]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e260]
          - button "☆" [ref=e261]
          - button "📌" [ref=e262]
          - button "🗑" [ref=e263]
        - generic [ref=e264]:
          - generic "Feb 18, 2026" [ref=e265]: 1mo ago
          - generic [ref=e266]: Claude Code
      - generic [ref=e269] [cursor=pointer]:
        - generic [ref=e270]:
          - generic [ref=e271]: 🌐
          - generic [ref=e272]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e273]
          - button "☆" [ref=e274]
          - button "📌" [ref=e275]
          - button "🗑" [ref=e276]
        - generic [ref=e277]:
          - generic "Apr 7, 2020" [ref=e278]: 6y ago
          - generic [ref=e279]: AI Development
      - generic [ref=e282] [cursor=pointer]:
        - generic [ref=e283]:
          - generic [ref=e284]: ▶
          - generic [ref=e285]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e286]
          - button "★" [ref=e287]
          - button "📌" [ref=e288]
          - button "🗑" [ref=e289]
        - generic "Apr 1, 2026" [ref=e291]: 2w ago
      - generic [ref=e294] [cursor=pointer]:
        - generic [ref=e295]:
          - generic [ref=e296]: ▶
          - generic [ref=e297]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e298]
          - button "☆" [ref=e299]
          - button "📌" [ref=e300]
          - button "🗑" [ref=e301]
        - generic [ref=e302]:
          - generic "Jul 25, 2025" [ref=e303]: 8mo ago
          - generic [ref=e304]: Claude Code
      - generic [ref=e307] [cursor=pointer]:
        - generic [ref=e308]:
          - generic [ref=e309]: ▶
          - generic [ref=e310]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e311]
          - button "★" [ref=e312]
          - button "📌" [ref=e313]
          - button "🗑" [ref=e314]
        - generic [ref=e315]:
          - generic "Mar 29, 2026" [ref=e316]: 2w ago
          - generic [ref=e317]: Artificial Intelligence
      - generic [ref=e320] [cursor=pointer]:
        - generic [ref=e321]:
          - generic [ref=e322]: ▶
          - generic [ref=e323]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e324]
          - button "★" [ref=e325]
          - button "📌" [ref=e326]
          - button "🗑" [ref=e327]
        - generic "Mar 30, 2026" [ref=e329]: 2w ago
      - generic [ref=e332] [cursor=pointer]:
        - generic [ref=e333]:
          - generic [ref=e334]: ▶
          - generic [ref=e335]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e336]
          - button "★" [ref=e337]
          - button "📌" [ref=e338]
          - button "🗑" [ref=e339]
        - generic [ref=e340]:
          - generic "Apr 1, 2026" [ref=e341]: 2w ago
          - generic [ref=e342]: AI Development
      - generic [ref=e345] [cursor=pointer]:
        - generic [ref=e346]:
          - generic [ref=e347]: ▶
          - generic [ref=e348]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e349]
          - button "☆" [ref=e350]
          - button "📌" [ref=e351]
          - button "🗑" [ref=e352]
        - generic [ref=e353]:
          - generic "Mar 30, 2026" [ref=e354]: 2w ago
          - generic [ref=e355]: AI
      - generic [ref=e358] [cursor=pointer]:
        - generic [ref=e359]:
          - generic [ref=e360]: ▶
          - generic [ref=e361]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e362]
          - button "☆" [ref=e363]
          - button "📌" [ref=e364]
          - button "🗑" [ref=e365]
        - generic [ref=e366]:
          - generic "Apr 9, 2026" [ref=e367]: 6d ago
          - generic [ref=e368]: AI
      - generic [ref=e371] [cursor=pointer]:
        - generic [ref=e372]:
          - generic [ref=e373]: 🌐
          - generic [ref=e374]: Example Domain
          - button "🔗" [ref=e375]
          - button "☆" [ref=e376]
          - button "📌" [ref=e377]
          - button "🗑" [ref=e378]
        - generic [ref=e379]:
          - generic "Apr 10, 2026" [ref=e380]: 5d ago
          - generic [ref=e381]: Software Development
    - generic [ref=e384]:
      - generic [ref=e385]: ←
      - text: Select an item to read
```

# Test source

```ts
  19  |   // Use an ISO timestamp far in the future so the seeded rows always sort as
  20  |   // the newest in /items/recent (which orders by date_added DESC).
  21  |   const future = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  22  |   const rows = urls.map((url, i) => ({ id: ids[i], url, dateAdded: future }));
  23  |   const script = `
  24  |     const { Database } = require('bun:sqlite');
  25  |     const db = new Database(${JSON.stringify(DB_PATH)});
  26  |     db.exec("PRAGMA busy_timeout = 5000");
  27  |     const insert = db.prepare("INSERT INTO items (id, url, type, status, error, date_added, retries) VALUES (?, ?, 'web', 'error', 'seeded test failure', ?, 99)");
  28  |     for (const row of ${JSON.stringify(rows)}) insert.run(row.id, row.url, row.dateAdded);
  29  |     db.close();
  30  |   `;
  31  |   const result = spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  32  |   if (result.status !== 0) {
  33  |     throw new Error(`seedErrorItems failed: ${result.stderr || result.stdout}`);
  34  |   }
  35  |   return ids;
  36  | }
  37  | 
  38  | function deleteByIds(ids: string[]) {
  39  |   const script = `
  40  |     const { Database } = require('bun:sqlite');
  41  |     const db = new Database(${JSON.stringify(DB_PATH)});
  42  |     db.exec("PRAGMA busy_timeout = 5000");
  43  |     const del = db.prepare("DELETE FROM items WHERE id = ?");
  44  |     for (const id of ${JSON.stringify(ids)}) del.run(id);
  45  |     db.close();
  46  |   `;
  47  |   spawnSync('bun', ['-e', script], { cwd: ROOT, encoding: 'utf8' });
  48  | }
  49  | 
  50  | // ----------------------------------------------------------------------------
  51  | // Capability: the user can requeue all failed items with a single call.
  52  | // ----------------------------------------------------------------------------
  53  | 
  54  | test('POST /items/retry-failed requeues all error items', async ({ request }) => {
  55  |   const tag = Date.now();
  56  |   const urls = [
  57  |     `https://example.com/bulk-retry-a-${tag}`,
  58  |     `https://example.com/bulk-retry-b-${tag}`,
  59  |   ];
  60  |   const ids = seedErrorItems(urls);
  61  | 
  62  |   try {
  63  |     // Sanity: both items are in 'error' state
  64  |     for (const id of ids) {
  65  |       const res = await request.get(`${BASE}/status/${id}`);
  66  |       const body = await res.json();
  67  |       expect(body.status).toBe('error');
  68  |     }
  69  | 
  70  |     const retryRes = await request.post(`${BASE}/items/retry-failed`);
  71  |     if (!retryRes.ok()) {
  72  |       throw new Error(`retry-failed returned ${retryRes.status()}: ${await retryRes.text()}`);
  73  |     }
  74  | 
  75  |     // After retry, neither item should still be in 'error' state —
  76  |     // either queued, processing, or done (the real queue may pick them up).
  77  |     for (const id of ids) {
  78  |       const res = await request.get(`${BASE}/status/${id}`);
  79  |       const body = await res.json();
  80  |       expect(body.status).not.toBe('error');
  81  |     }
  82  |   } finally {
  83  |     deleteByIds(ids);
  84  |   }
  85  | });
  86  | 
  87  | test('POST /items/retry-failed returns the queued count', async ({ request }) => {
  88  |   const tag = Date.now() + 1;
  89  |   const urls = [
  90  |     `https://example.com/bulk-retry-count-a-${tag}`,
  91  |     `https://example.com/bulk-retry-count-b-${tag}`,
  92  |     `https://example.com/bulk-retry-count-c-${tag}`,
  93  |   ];
  94  |   const ids = seedErrorItems(urls);
  95  | 
  96  |   try {
  97  |     const res = await request.post(`${BASE}/items/retry-failed`);
  98  |     expect(res.ok()).toBeTruthy();
  99  |     const body = await res.json() as { queued: number };
  100 |     expect(typeof body.queued).toBe('number');
  101 |     // At least our three seeded errors must be in the count. Other pre-existing
  102 |     // error rows in the running DB may inflate this — that's fine.
  103 |     expect(body.queued).toBeGreaterThanOrEqual(urls.length);
  104 |   } finally {
  105 |     deleteByIds(ids);
  106 |   }
  107 | });
  108 | 
  109 | test('Retry all failed button appears when error items exist', async ({ page }) => {
  110 |   const tag = Date.now() + 2;
  111 |   const url = `https://example.com/bulk-retry-ui-${tag}`;
  112 |   const ids = seedErrorItems([url]);
  113 | 
  114 |   try {
  115 |     await page.goto(BASE);
  116 | 
  117 |     // Open the queue panel via the processing indicator button
  118 |     const queueToggle = page.locator('[data-testid="queue-toggle"]');
> 119 |     await expect(queueToggle).toBeVisible({ timeout: 10_000 });
      |                               ^ Error: expect(locator).toBeVisible() failed
  120 |     // Allow the initial refreshQueueLog() call to populate the log
  121 |     await page.waitForTimeout(500);
  122 |     await queueToggle.click();
  123 | 
  124 |     await expect(page.locator('.queue-panel')).toBeVisible({ timeout: 5000 });
  125 | 
  126 |     const retryAllBtn = page.locator('[data-testid="retry-all-failed"]');
  127 |     await expect(retryAllBtn).toBeVisible({ timeout: 5000 });
  128 |     await expect(retryAllBtn).toContainText(/Retry all failed/i);
  129 |   } finally {
  130 |     deleteByIds(ids);
  131 |   }
  132 | });
  133 | 
```