# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ollama-status.spec.ts >> ollama status warning does not flash on initial slow response
- Location: tests/ollama-status.spec.ts:8:1

# Error details

```
Error: expect(locator).toHaveCount(expected) failed

Locator:  locator('.ollama-warning')
Expected: 0
Received: 1
Timeout:  5000ms

Call log:
  - Expect "toHaveCount" with timeout 5000ms
  - waiting for locator('.ollama-warning')
    9 × locator resolved to 1 element
      - unexpected value "1"

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
          - button "★" [ref=e62]
          - button "📌" [ref=e63]
          - button "🗑" [ref=e64]
        - generic "Apr 18, 2026" [ref=e66]: "-2d ago"
      - generic [ref=e69] [cursor=pointer]:
        - generic [ref=e70]:
          - generic [ref=e71]: 🌐
          - generic [ref=e72]: Raise Popup Test Item
          - button "🔗" [ref=e73]
          - button "☆" [ref=e74]
          - button "📌" [ref=e75]
          - button "🗑" [ref=e76]
        - generic "Apr 18, 2026" [ref=e78]: "-2d ago"
      - generic [ref=e81] [cursor=pointer]:
        - generic [ref=e82]:
          - generic [ref=e83]: 🌐
          - generic [ref=e84]: Raise Popup Test Item
          - button "🔗" [ref=e85]
          - button "★" [ref=e86]
          - button "📌" [ref=e87]
          - button "🗑" [ref=e88]
        - generic "Apr 18, 2026" [ref=e90]: "-2d ago"
      - generic [ref=e93] [cursor=pointer]:
        - generic [ref=e94]:
          - generic [ref=e95]: 🌐
          - generic [ref=e96]: Raise Popup Test Item
          - button "🔗" [ref=e97]
          - button "☆" [ref=e98]
          - button "📌" [ref=e99]
          - button "🗑" [ref=e100]
        - generic "Apr 18, 2026" [ref=e102]: "-2d ago"
      - generic [ref=e105] [cursor=pointer]:
        - generic [ref=e106]:
          - generic [ref=e107]: ▶
          - generic [ref=e108]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e109]
          - button "☆" [ref=e110]
          - button "📌" [ref=e111]
          - button "🗑" [ref=e112]
        - generic [ref=e113]:
          - generic "Mar 23, 2026" [ref=e114]: 3w ago
          - generic [ref=e115]: AI Development
      - generic [ref=e118] [cursor=pointer]:
        - generic [ref=e119]:
          - generic [ref=e120]: ▶
          - generic [ref=e121]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e122]
          - button "☆" [ref=e123]
          - button "📌" [ref=e124]
          - button "🗑" [ref=e125]
        - generic [ref=e126]:
          - generic "Dec 20, 2025" [ref=e127]: 3mo ago
          - generic [ref=e128]: Artificial Intelligence
      - generic [ref=e131] [cursor=pointer]:
        - generic [ref=e132]:
          - generic [ref=e133]: ▶
          - generic [ref=e134]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e135]
          - button "☆" [ref=e136]
          - button "📌" [ref=e137]
          - button "🗑" [ref=e138]
        - generic [ref=e139]:
          - generic "Mar 23, 2026" [ref=e140]: 3w ago
          - generic [ref=e141]: Artificial Intelligence
      - generic [ref=e144] [cursor=pointer]:
        - generic [ref=e145]:
          - generic [ref=e146]: ▶
          - generic [ref=e147]: Claude Code is unusable now
          - button "🔗" [ref=e148]
          - button "☆" [ref=e149]
          - button "📌" [ref=e150]
          - button "🗑" [ref=e151]
        - generic [ref=e152]:
          - generic "Apr 5, 2026" [ref=e153]: 1w ago
          - generic [ref=e154]: AI
      - generic [ref=e157] [cursor=pointer]:
        - generic [ref=e158]:
          - generic [ref=e159]: ▶
          - generic [ref=e160]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e161]
          - button "☆" [ref=e162]
          - button "📌" [ref=e163]
          - button "🗑" [ref=e164]
        - generic [ref=e165]:
          - generic "Apr 6, 2026" [ref=e166]: 1w ago
          - generic [ref=e167]: AI Development
      - generic [ref=e170] [cursor=pointer]:
        - generic [ref=e171]:
          - generic [ref=e172]: 🌐
          - generic [ref=e173]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e174]
          - button "☆" [ref=e175]
          - button "📌" [ref=e176]
          - button "🗑" [ref=e177]
        - generic "Apr 11, 2026" [ref=e179]: 5d ago
      - generic [ref=e182] [cursor=pointer]:
        - generic [ref=e183]:
          - generic [ref=e184]: 🌐
          - generic [ref=e185]: Tech
          - button "🔗" [ref=e186]
          - button "☆" [ref=e187]
          - button "📌" [ref=e188]
          - button "🗑" [ref=e189]
        - generic [ref=e190]:
          - generic "Apr 14, 2026" [ref=e191]: yesterday
          - generic [ref=e192]: Artificial Intelligence
      - generic [ref=e195] [cursor=pointer]:
        - generic [ref=e196]:
          - generic [ref=e197]: 🌐
          - generic [ref=e198]: "Category: AI"
          - button "🔗" [ref=e199]
          - button "☆" [ref=e200]
          - button "📌" [ref=e201]
          - button "🗑" [ref=e202]
        - generic "Apr 14, 2026" [ref=e204]: yesterday
      - generic [ref=e207] [cursor=pointer]:
        - generic [ref=e208]:
          - generic [ref=e209]: 🌐
          - generic [ref=e210]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e211]
          - button "☆" [ref=e212]
          - button "📌" [ref=e213]
          - button "🗑" [ref=e214]
        - generic [ref=e215]:
          - generic "Apr 15, 2026" [ref=e216]: today
          - generic [ref=e217]: AI
      - generic [ref=e220] [cursor=pointer]:
        - generic [ref=e221]:
          - generic [ref=e222]: 🌐
          - generic [ref=e223]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e224]
          - button "☆" [ref=e225]
          - button "📌" [ref=e226]
          - button "🗑" [ref=e227]
        - generic [ref=e228]:
          - generic "Apr 11, 2026" [ref=e229]: 5d ago
          - generic [ref=e230]: Artificial Intelligence
      - generic [ref=e233] [cursor=pointer]:
        - generic [ref=e234]:
          - generic [ref=e235]: 🌐
          - generic [ref=e236]: Artificial Intelligence
          - button "🔗" [ref=e237]
          - button "☆" [ref=e238]
          - button "📌" [ref=e239]
          - button "🗑" [ref=e240]
        - generic [ref=e241]:
          - generic "Apr 15, 2026" [ref=e242]: today
          - generic [ref=e243]: Artificial Intelligence
      - generic [ref=e246] [cursor=pointer]:
        - generic [ref=e247]:
          - generic [ref=e248]: 🌐
          - generic [ref=e249]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e250]
          - button "☆" [ref=e251]
          - button "📌" [ref=e252]
          - button "🗑" [ref=e253]
        - generic [ref=e254]:
          - generic "Feb 18, 2026" [ref=e255]: 1mo ago
          - generic [ref=e256]: Claude Code
      - generic [ref=e259] [cursor=pointer]:
        - generic [ref=e260]:
          - generic [ref=e261]: 🌐
          - generic [ref=e262]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e263]
          - button "☆" [ref=e264]
          - button "📌" [ref=e265]
          - button "🗑" [ref=e266]
        - generic [ref=e267]:
          - generic "Apr 7, 2020" [ref=e268]: 6y ago
          - generic [ref=e269]: AI Development
      - generic [ref=e272] [cursor=pointer]:
        - generic [ref=e273]:
          - generic [ref=e274]: ▶
          - generic [ref=e275]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e276]
          - button "★" [ref=e277]
          - button "📌" [ref=e278]
          - button "🗑" [ref=e279]
        - generic "Apr 1, 2026" [ref=e281]: 2w ago
      - generic [ref=e284] [cursor=pointer]:
        - generic [ref=e285]:
          - generic [ref=e286]: ▶
          - generic [ref=e287]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e288]
          - button "☆" [ref=e289]
          - button "📌" [ref=e290]
          - button "🗑" [ref=e291]
        - generic [ref=e292]:
          - generic "Jul 25, 2025" [ref=e293]: 8mo ago
          - generic [ref=e294]: Claude Code
      - generic [ref=e297] [cursor=pointer]:
        - generic [ref=e298]:
          - generic [ref=e299]: ▶
          - generic [ref=e300]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e301]
          - button "★" [ref=e302]
          - button "📌" [ref=e303]
          - button "🗑" [ref=e304]
        - generic [ref=e305]:
          - generic "Mar 29, 2026" [ref=e306]: 2w ago
          - generic [ref=e307]: Artificial Intelligence
      - generic [ref=e310] [cursor=pointer]:
        - generic [ref=e311]:
          - generic [ref=e312]: ▶
          - generic [ref=e313]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e314]
          - button "★" [ref=e315]
          - button "📌" [ref=e316]
          - button "🗑" [ref=e317]
        - generic "Mar 30, 2026" [ref=e319]: 2w ago
      - generic [ref=e322] [cursor=pointer]:
        - generic [ref=e323]:
          - generic [ref=e324]: ▶
          - generic [ref=e325]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e326]
          - button "★" [ref=e327]
          - button "📌" [ref=e328]
          - button "🗑" [ref=e329]
        - generic [ref=e330]:
          - generic "Apr 1, 2026" [ref=e331]: 2w ago
          - generic [ref=e332]: AI Development
      - generic [ref=e335] [cursor=pointer]:
        - generic [ref=e336]:
          - generic [ref=e337]: ▶
          - generic [ref=e338]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e339]
          - button "☆" [ref=e340]
          - button "📌" [ref=e341]
          - button "🗑" [ref=e342]
        - generic [ref=e343]:
          - generic "Mar 30, 2026" [ref=e344]: 2w ago
          - generic [ref=e345]: AI
      - generic [ref=e348] [cursor=pointer]:
        - generic [ref=e349]:
          - generic [ref=e350]: ▶
          - generic [ref=e351]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e352]
          - button "☆" [ref=e353]
          - button "📌" [ref=e354]
          - button "🗑" [ref=e355]
        - generic [ref=e356]:
          - generic "Apr 9, 2026" [ref=e357]: 6d ago
          - generic [ref=e358]: AI
      - generic [ref=e361] [cursor=pointer]:
        - generic [ref=e362]:
          - generic [ref=e363]: 🌐
          - generic [ref=e364]: Example Domain
          - button "🔗" [ref=e365]
          - button "☆" [ref=e366]
          - button "📌" [ref=e367]
          - button "🗑" [ref=e368]
        - generic [ref=e369]:
          - generic "Apr 10, 2026" [ref=e370]: 5d ago
          - generic [ref=e371]: Software Development
    - generic [ref=e374]:
      - generic [ref=e375]: ←
      - text: Select an item to read
```

# Test source

```ts
  1  | import { test, expect } from '@playwright/test';
  2  | 
  3  | const BASE = 'http://127.0.0.1:3737';
  4  | 
  5  | // Regression: a single slow/failed /ollama/status response must NOT flash the
  6  | // warning banner. Only after two consecutive failures should the UI report
  7  | // "Ollama is not running".
  8  | test('ollama status warning does not flash on initial slow response', async ({ page }) => {
  9  |   let callCount = 0;
  10 |   await page.route('**/ollama/status', async (route) => {
  11 |     callCount += 1;
  12 |     if (callCount === 1) {
  13 |       await route.fulfill({
  14 |         status: 200,
  15 |         contentType: 'application/json',
  16 |         body: JSON.stringify({ ok: false, url: 'http://localhost:11434' }),
  17 |       });
  18 |     } else {
  19 |       await route.fulfill({
  20 |         status: 200,
  21 |         contentType: 'application/json',
  22 |         body: JSON.stringify({ ok: true, url: 'http://localhost:11434', model: 'gemma4:26b' }),
  23 |       });
  24 |     }
  25 |   });
  26 | 
  27 |   // Speed up polling so we don't wait 30s for the second check.
  28 |   await page.goto(`${BASE}?ollamaPollMs=300`);
  29 | 
  30 |   // Wait past the first poll completion — the warning must NOT be shown
  31 |   // despite ok:false, because only one failure has occurred.
  32 |   await page.waitForTimeout(600);
> 33 |   await expect(page.locator('.ollama-warning')).toHaveCount(0);
     |                                                 ^ Error: expect(locator).toHaveCount(expected) failed
  34 | 
  35 |   // Wait for the second poll to run with ok:true. The status pill should
  36 |   // reflect the running state.
  37 |   await expect.poll(() => callCount, { timeout: 5000 }).toBeGreaterThanOrEqual(2);
  38 | 
  39 |   // Still no warning.
  40 |   await expect(page.locator('.ollama-warning')).toHaveCount(0);
  41 | });
  42 | 
  43 | test('ollama status shows model name when running', async ({ page }) => {
  44 |   await page.route('**/ollama/status', async (route) => {
  45 |     await route.fulfill({
  46 |       status: 200,
  47 |       contentType: 'application/json',
  48 |       body: JSON.stringify({ ok: true, url: 'http://localhost:11434', model: 'gemma4:26b' }),
  49 |     });
  50 |   });
  51 | 
  52 |   await page.goto(BASE);
  53 | 
  54 |   // The UI must surface the active model name somewhere (status indicator /
  55 |   // tooltip / pill). Look for the literal model string.
  56 |   await expect(page.locator('.ollama-status')).toContainText('gemma4:26b', { timeout: 5000 });
  57 | });
  58 | 
  59 | test('GET /ollama/status includes model field', async ({ request }) => {
  60 |   const res = await request.get(`${BASE}/ollama/status`);
  61 |   expect(res.ok()).toBeTruthy();
  62 |   const body = await res.json() as { ok: boolean; url: string; model?: string };
  63 |   expect(typeof body.ok).toBe('boolean');
  64 |   expect(typeof body.url).toBe('string');
  65 |   expect(typeof body.model).toBe('string');
  66 |   expect((body.model ?? '').length).toBeGreaterThan(0);
  67 | });
  68 | 
```