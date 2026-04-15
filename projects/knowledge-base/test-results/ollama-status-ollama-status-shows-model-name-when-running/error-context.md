# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ollama-status.spec.ts >> ollama status shows model name when running
- Location: tests/ollama-status.spec.ts:43:1

# Error details

```
Error: expect(locator).toContainText(expected) failed

Locator: locator('.ollama-status')
Expected substring: "gemma4:26b"
Timeout: 5000ms
Error: element(s) not found

Call log:
  - Expect "toContainText" with timeout 5000ms
  - waiting for locator('.ollama-status')

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
        - generic [ref=e43]: 25 items
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
          - generic [ref=e57]: Raise Popup Test Item
          - button "🔗" [ref=e58]
          - button "★" [ref=e59]
          - button "📌" [ref=e60]
          - button "🗑" [ref=e61]
        - generic "Apr 18, 2026" [ref=e63]: "-2d ago"
      - generic [ref=e66] [cursor=pointer]:
        - generic [ref=e67]:
          - generic [ref=e68]: 🌐
          - generic [ref=e69]: Raise Popup Test Item
          - button "🔗" [ref=e70]
          - button "☆" [ref=e71]
          - button "📌" [ref=e72]
          - button "🗑" [ref=e73]
        - generic "Apr 18, 2026" [ref=e75]: "-2d ago"
      - generic [ref=e78] [cursor=pointer]:
        - generic [ref=e79]:
          - generic [ref=e80]: 🌐
          - generic [ref=e81]: Raise Popup Test Item
          - button "🔗" [ref=e82]
          - button "★" [ref=e83]
          - button "📌" [ref=e84]
          - button "🗑" [ref=e85]
        - generic "Apr 18, 2026" [ref=e87]: "-2d ago"
      - generic [ref=e90] [cursor=pointer]:
        - generic [ref=e91]:
          - generic [ref=e92]: 🌐
          - generic [ref=e93]: Raise Popup Test Item
          - button "🔗" [ref=e94]
          - button "☆" [ref=e95]
          - button "📌" [ref=e96]
          - button "🗑" [ref=e97]
        - generic "Apr 18, 2026" [ref=e99]: "-2d ago"
      - generic [ref=e102] [cursor=pointer]:
        - generic [ref=e103]:
          - generic [ref=e104]: ▶
          - generic [ref=e105]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e106]
          - button "☆" [ref=e107]
          - button "📌" [ref=e108]
          - button "🗑" [ref=e109]
        - generic [ref=e110]:
          - generic "Mar 23, 2026" [ref=e111]: 3w ago
          - generic [ref=e112]: AI Development
      - generic [ref=e115] [cursor=pointer]:
        - generic [ref=e116]:
          - generic [ref=e117]: ▶
          - generic [ref=e118]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e119]
          - button "☆" [ref=e120]
          - button "📌" [ref=e121]
          - button "🗑" [ref=e122]
        - generic [ref=e123]:
          - generic "Dec 20, 2025" [ref=e124]: 3mo ago
          - generic [ref=e125]: Artificial Intelligence
      - generic [ref=e128] [cursor=pointer]:
        - generic [ref=e129]:
          - generic [ref=e130]: ▶
          - generic [ref=e131]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e132]
          - button "☆" [ref=e133]
          - button "📌" [ref=e134]
          - button "🗑" [ref=e135]
        - generic [ref=e136]:
          - generic "Mar 23, 2026" [ref=e137]: 3w ago
          - generic [ref=e138]: Artificial Intelligence
      - generic [ref=e141] [cursor=pointer]:
        - generic [ref=e142]:
          - generic [ref=e143]: ▶
          - generic [ref=e144]: Claude Code is unusable now
          - button "🔗" [ref=e145]
          - button "☆" [ref=e146]
          - button "📌" [ref=e147]
          - button "🗑" [ref=e148]
        - generic [ref=e149]:
          - generic "Apr 5, 2026" [ref=e150]: 1w ago
          - generic [ref=e151]: AI
      - generic [ref=e154] [cursor=pointer]:
        - generic [ref=e155]:
          - generic [ref=e156]: ▶
          - generic [ref=e157]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e158]
          - button "☆" [ref=e159]
          - button "📌" [ref=e160]
          - button "🗑" [ref=e161]
        - generic [ref=e162]:
          - generic "Apr 6, 2026" [ref=e163]: 1w ago
          - generic [ref=e164]: AI Development
      - generic [ref=e167] [cursor=pointer]:
        - generic [ref=e168]:
          - generic [ref=e169]: 🌐
          - generic [ref=e170]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e171]
          - button "☆" [ref=e172]
          - button "📌" [ref=e173]
          - button "🗑" [ref=e174]
        - generic "Apr 11, 2026" [ref=e176]: 5d ago
      - generic [ref=e179] [cursor=pointer]:
        - generic [ref=e180]:
          - generic [ref=e181]: 🌐
          - generic [ref=e182]: Tech
          - button "🔗" [ref=e183]
          - button "☆" [ref=e184]
          - button "📌" [ref=e185]
          - button "🗑" [ref=e186]
        - generic [ref=e187]:
          - generic "Apr 14, 2026" [ref=e188]: yesterday
          - generic [ref=e189]: Artificial Intelligence
      - generic [ref=e192] [cursor=pointer]:
        - generic [ref=e193]:
          - generic [ref=e194]: 🌐
          - generic [ref=e195]: "Category: AI"
          - button "🔗" [ref=e196]
          - button "☆" [ref=e197]
          - button "📌" [ref=e198]
          - button "🗑" [ref=e199]
        - generic "Apr 14, 2026" [ref=e201]: yesterday
      - generic [ref=e204] [cursor=pointer]:
        - generic [ref=e205]:
          - generic [ref=e206]: 🌐
          - generic [ref=e207]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e208]
          - button "☆" [ref=e209]
          - button "📌" [ref=e210]
          - button "🗑" [ref=e211]
        - generic [ref=e212]:
          - generic "Apr 15, 2026" [ref=e213]: today
          - generic [ref=e214]: AI
      - generic [ref=e217] [cursor=pointer]:
        - generic [ref=e218]:
          - generic [ref=e219]: 🌐
          - generic [ref=e220]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e221]
          - button "☆" [ref=e222]
          - button "📌" [ref=e223]
          - button "🗑" [ref=e224]
        - generic [ref=e225]:
          - generic "Apr 11, 2026" [ref=e226]: 5d ago
          - generic [ref=e227]: Artificial Intelligence
      - generic [ref=e230] [cursor=pointer]:
        - generic [ref=e231]:
          - generic [ref=e232]: 🌐
          - generic [ref=e233]: Artificial Intelligence
          - button "🔗" [ref=e234]
          - button "☆" [ref=e235]
          - button "📌" [ref=e236]
          - button "🗑" [ref=e237]
        - generic [ref=e238]:
          - generic "Apr 15, 2026" [ref=e239]: today
          - generic [ref=e240]: Artificial Intelligence
      - generic [ref=e243] [cursor=pointer]:
        - generic [ref=e244]:
          - generic [ref=e245]: 🌐
          - generic [ref=e246]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e247]
          - button "☆" [ref=e248]
          - button "📌" [ref=e249]
          - button "🗑" [ref=e250]
        - generic [ref=e251]:
          - generic "Feb 18, 2026" [ref=e252]: 1mo ago
          - generic [ref=e253]: Claude Code
      - generic [ref=e256] [cursor=pointer]:
        - generic [ref=e257]:
          - generic [ref=e258]: 🌐
          - generic [ref=e259]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e260]
          - button "☆" [ref=e261]
          - button "📌" [ref=e262]
          - button "🗑" [ref=e263]
        - generic [ref=e264]:
          - generic "Apr 7, 2020" [ref=e265]: 6y ago
          - generic [ref=e266]: AI Development
      - generic [ref=e269] [cursor=pointer]:
        - generic [ref=e270]:
          - generic [ref=e271]: ▶
          - generic [ref=e272]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e273]
          - button "★" [ref=e274]
          - button "📌" [ref=e275]
          - button "🗑" [ref=e276]
        - generic "Apr 1, 2026" [ref=e278]: 2w ago
      - generic [ref=e281] [cursor=pointer]:
        - generic [ref=e282]:
          - generic [ref=e283]: ▶
          - generic [ref=e284]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e285]
          - button "☆" [ref=e286]
          - button "📌" [ref=e287]
          - button "🗑" [ref=e288]
        - generic [ref=e289]:
          - generic "Jul 25, 2025" [ref=e290]: 8mo ago
          - generic [ref=e291]: Claude Code
      - generic [ref=e294] [cursor=pointer]:
        - generic [ref=e295]:
          - generic [ref=e296]: ▶
          - generic [ref=e297]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e298]
          - button "★" [ref=e299]
          - button "📌" [ref=e300]
          - button "🗑" [ref=e301]
        - generic [ref=e302]:
          - generic "Mar 29, 2026" [ref=e303]: 2w ago
          - generic [ref=e304]: Artificial Intelligence
      - generic [ref=e307] [cursor=pointer]:
        - generic [ref=e308]:
          - generic [ref=e309]: ▶
          - generic [ref=e310]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e311]
          - button "★" [ref=e312]
          - button "📌" [ref=e313]
          - button "🗑" [ref=e314]
        - generic "Mar 30, 2026" [ref=e316]: 2w ago
      - generic [ref=e319] [cursor=pointer]:
        - generic [ref=e320]:
          - generic [ref=e321]: ▶
          - generic [ref=e322]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e323]
          - button "★" [ref=e324]
          - button "📌" [ref=e325]
          - button "🗑" [ref=e326]
        - generic [ref=e327]:
          - generic "Apr 1, 2026" [ref=e328]: 2w ago
          - generic [ref=e329]: AI Development
      - generic [ref=e332] [cursor=pointer]:
        - generic [ref=e333]:
          - generic [ref=e334]: ▶
          - generic [ref=e335]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e336]
          - button "☆" [ref=e337]
          - button "📌" [ref=e338]
          - button "🗑" [ref=e339]
        - generic [ref=e340]:
          - generic "Mar 30, 2026" [ref=e341]: 2w ago
          - generic [ref=e342]: AI
      - generic [ref=e345] [cursor=pointer]:
        - generic [ref=e346]:
          - generic [ref=e347]: ▶
          - generic [ref=e348]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e349]
          - button "☆" [ref=e350]
          - button "📌" [ref=e351]
          - button "🗑" [ref=e352]
        - generic [ref=e353]:
          - generic "Apr 9, 2026" [ref=e354]: 6d ago
          - generic [ref=e355]: AI
      - generic [ref=e358] [cursor=pointer]:
        - generic [ref=e359]:
          - generic [ref=e360]: 🌐
          - generic [ref=e361]: Example Domain
          - button "🔗" [ref=e362]
          - button "☆" [ref=e363]
          - button "📌" [ref=e364]
          - button "🗑" [ref=e365]
        - generic [ref=e366]:
          - generic "Apr 10, 2026" [ref=e367]: 5d ago
          - generic [ref=e368]: Software Development
    - generic [ref=e371]:
      - generic [ref=e372]: ←
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
  33 |   await expect(page.locator('.ollama-warning')).toHaveCount(0);
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
> 56 |   await expect(page.locator('.ollama-status')).toContainText('gemma4:26b', { timeout: 5000 });
     |                                                ^ Error: expect(locator).toContainText(expected) failed
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