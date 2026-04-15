# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: extension-save-flow.spec.ts >> save button submits current tab URL to /process
- Location: tests/extension-save-flow.spec.ts:48:1

# Error details

```
Error: expect(received).toBeGreaterThan(expected)

Expected: > 0
Received:   0

Call Log:
- Timeout 5000ms exceeded while waiting on the predicate
```

# Page snapshot

```yaml
- generic [ref=e1]:
  - generic [ref=e2]:
    - generic [ref=e3]:
      - heading "Knowledge Base" [level=1] [ref=e4]
      - generic [ref=e5]: 6 processing
      - generic "https://example.com/save-flow-test-1776271516657" [ref=e6]
    - generic [ref=e7]:
      - generic [ref=e8]: Processing
      - generic [ref=e9]:
        - generic [ref=e10]:
          - generic "example.com/fts-test-1776271506440" [ref=e12]
          - generic [ref=e13]: Queued
        - generic [ref=e14]:
          - generic "example.com/fts-test-1776270041140" [ref=e16]
          - generic [ref=e17]: Queued
        - generic [ref=e18]:
          - generic "example.com/fts-test-1776269871248" [ref=e20]
          - generic [ref=e21]: Queued
        - generic [ref=e22]:
          - generic "example.com/fts-test-1776269828997" [ref=e24]
          - generic [ref=e25]: Queued
        - button "Show 6 more ▾" [ref=e26]
    - generic [ref=e27]:
      - button "Save to Knowledge Base" [active] [ref=e28] [cursor=pointer]
      - button "Quick Summary" [ref=e29] [cursor=pointer]
    - generic [ref=e31]:
      - generic [ref=e32]: ⚑
      - generic [ref=e33]: 230 tags pending review
      - button "Review →" [ref=e34] [cursor=pointer]
    - generic [ref=e36]:
      - generic [ref=e37]: ⌕
      - textbox "Search titles, summaries, transcripts…" [ref=e38]
      - generic "AI-powered meaning search" [ref=e39] [cursor=pointer]:
        - checkbox "Toggle semantic search" [ref=e40]
        - generic [ref=e41]: AI Search
    - generic [ref=e43]:
      - button "All" [ref=e44] [cursor=pointer]
      - button "Today" [ref=e45] [cursor=pointer]
      - button "2d" [ref=e46] [cursor=pointer]
      - button "3d" [ref=e47] [cursor=pointer]
      - button "4d" [ref=e48] [cursor=pointer]
    - generic [ref=e49]:
      - generic [ref=e50]: "Collection:"
      - combobox "Collection:" [ref=e51] [cursor=pointer]:
        - option "All" [selected]
        - option "col-test-del-col-1776093035278-g6qq"
        - option "debug-coll-1776093997"
        - option "ext-col-filter-1776263509854"
    - generic [ref=e52]:
      - generic [ref=e53]:
        - heading "Recent Items" [level=2] [ref=e54]
        - button "↻" [ref=e55] [cursor=pointer]
      - generic [ref=e56]:
        - generic [ref=e57]:
          - generic "Read" [ref=e58]
          - generic [ref=e59]:
            - link "Raise Popup Test Item" [ref=e60] [cursor=pointer]
            - generic [ref=e61]: Invalid Date
          - button "🚩" [ref=e62] [cursor=pointer]
          - button "↗" [ref=e63] [cursor=pointer]
        - generic [ref=e64]:
          - generic "Read" [ref=e65]
          - generic [ref=e66]:
            - link "Raise Popup Test Item" [ref=e67] [cursor=pointer]
            - generic [ref=e68]: Invalid Date
          - button "🚩" [ref=e69] [cursor=pointer]
          - button "↗" [ref=e70] [cursor=pointer]
        - generic [ref=e71]:
          - generic "Read" [ref=e72]
          - generic [ref=e73]:
            - link "Raise Popup Test Item" [ref=e74] [cursor=pointer]
            - generic [ref=e75]: Invalid Date
          - button "🚩" [ref=e76] [cursor=pointer]
          - button "↗" [ref=e77] [cursor=pointer]
        - generic [ref=e78]:
          - generic "Read" [ref=e79]
          - generic [ref=e80]:
            - link "Raise Popup Test Item" [ref=e81] [cursor=pointer]
            - generic [ref=e82]: Invalid Date
          - button "🚩" [ref=e83] [cursor=pointer]
          - button "↗" [ref=e84] [cursor=pointer]
        - generic [ref=e85]:
          - generic "Read" [ref=e86]
          - generic [ref=e87]:
            - link "How to Build Claude Agent Teams Better Than 99% of People" [ref=e88] [cursor=pointer]
            - generic [ref=e89]: Invalid Date
            - generic [ref=e90]: Published Mar 23, 2026
          - button "🚩" [ref=e91] [cursor=pointer]
          - button "↗" [ref=e92] [cursor=pointer]
        - generic [ref=e93]:
          - generic "Read" [ref=e94]
          - generic [ref=e95]:
            - link "The REAL Reason Scientists Know We&#39;re In A Simulation" [ref=e96] [cursor=pointer]
            - generic [ref=e97]: Invalid Date
            - generic [ref=e98]: Published Dec 20, 2025
          - button "🚩" [ref=e99] [cursor=pointer]
          - button "↗" [ref=e100] [cursor=pointer]
        - generic [ref=e101]:
          - generic "Read" [ref=e102]
          - generic [ref=e103]:
            - 'link "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI" [ref=e104] [cursor=pointer]'
            - generic [ref=e105]: Invalid Date
            - generic [ref=e106]: Published Mar 23, 2026
          - button "🚩" [ref=e107] [cursor=pointer]
          - button "↗" [ref=e108] [cursor=pointer]
        - generic [ref=e109]:
          - generic "Read" [ref=e110]
          - generic [ref=e111]:
            - link "Claude Code is unusable now" [ref=e112] [cursor=pointer]
            - generic [ref=e113]: Invalid Date
            - generic [ref=e114]: Published Apr 5, 2026
          - button "🚩" [ref=e115] [cursor=pointer]
          - button "↗" [ref=e116] [cursor=pointer]
        - generic [ref=e117]:
          - generic "Read" [ref=e118]
          - generic [ref=e119]:
            - link "How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO" [ref=e120] [cursor=pointer]
            - generic [ref=e121]: Invalid Date
            - generic [ref=e122]: Published Apr 6, 2026
          - button "🚩" [ref=e123] [cursor=pointer]
          - button "↗" [ref=e124] [cursor=pointer]
        - generic [ref=e125]:
          - generic "Read" [ref=e126]
          - generic [ref=e127]:
            - link "Artificial intelligence | MIT Technology Review" [ref=e128] [cursor=pointer]
            - generic [ref=e129]: Invalid Date
          - button "🚩" [ref=e130] [cursor=pointer]
          - button "↗" [ref=e131] [cursor=pointer]
        - generic [ref=e132]:
          - generic "Read" [ref=e133]
          - generic [ref=e134]:
            - link "Tech" [ref=e135] [cursor=pointer]
            - generic [ref=e136]: Invalid Date
            - generic [ref=e137]: Published Apr 14, 2026
          - button "🚩" [ref=e138] [cursor=pointer]
          - button "↗" [ref=e139] [cursor=pointer]
        - generic [ref=e140]:
          - generic "Read" [ref=e141]
          - generic [ref=e142]:
            - 'link "Category: AI" [ref=e143] [cursor=pointer]'
            - generic [ref=e144]: Invalid Date
            - generic [ref=e145]: Published Apr 14, 2026
          - button "🚩" [ref=e146] [cursor=pointer]
          - button "↗" [ref=e147] [cursor=pointer]
        - generic [ref=e148]:
          - generic "Read" [ref=e149]
          - generic [ref=e150]:
            - link "AI News & Artificial Intelligence | TechCrunch" [ref=e151] [cursor=pointer]
            - generic [ref=e152]: Invalid Date
            - generic [ref=e153]: Published Apr 15, 2026
          - button "🚩" [ref=e154] [cursor=pointer]
          - button "↗" [ref=e155] [cursor=pointer]
        - generic [ref=e156]:
          - generic "Read" [ref=e157]
          - generic [ref=e158]:
            - link "BBC Technology | Technology, Health, Environment, AI" [ref=e159] [cursor=pointer]
            - generic [ref=e160]: Invalid Date
          - button "🚩" [ref=e161] [cursor=pointer]
          - button "↗" [ref=e162] [cursor=pointer]
        - generic [ref=e163]:
          - generic "Read" [ref=e164]
          - generic [ref=e165]:
            - link "Artificial Intelligence" [ref=e166] [cursor=pointer]
            - generic [ref=e167]: Invalid Date
            - generic [ref=e168]: Published Apr 15, 2026
          - button "🚩" [ref=e169] [cursor=pointer]
          - button "↗" [ref=e170] [cursor=pointer]
        - generic [ref=e171]:
          - generic "Read" [ref=e172]
          - generic [ref=e173]:
            - link "50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026" [ref=e174] [cursor=pointer]
            - generic [ref=e175]: Invalid Date
            - generic [ref=e176]: Published Feb 18, 2026
          - button "🚩" [ref=e177] [cursor=pointer]
          - button "↗" [ref=e178] [cursor=pointer]
        - generic [ref=e179]:
          - generic "Read" [ref=e180]
          - generic [ref=e181]:
            - link "How and when to use subagents in Claude Code" [ref=e182] [cursor=pointer]
            - generic [ref=e183]: Invalid Date
            - generic [ref=e184]: Published Apr 7, 2020
          - button "🚩" [ref=e185] [cursor=pointer]
          - button "↗" [ref=e186] [cursor=pointer]
        - generic [ref=e187]:
          - generic "Read" [ref=e188]
          - generic [ref=e189]:
            - link "1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?" [ref=e190] [cursor=pointer]
            - generic [ref=e191]: Invalid Date
            - generic [ref=e192]: Published Apr 1, 2026
          - button "🚩" [ref=e193] [cursor=pointer]
          - button "↗" [ref=e194] [cursor=pointer]
        - generic [ref=e195]:
          - generic "Read" [ref=e196]
          - generic [ref=e197]:
            - link "【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！" [ref=e198] [cursor=pointer]
            - generic [ref=e199]: Invalid Date
            - generic [ref=e200]: Published Jul 25, 2025
          - button "🚩" [ref=e201] [cursor=pointer]
          - button "↗" [ref=e202] [cursor=pointer]
        - generic [ref=e203]:
          - generic "Read" [ref=e204]
          - generic [ref=e205]:
            - link "Elon Knew the Secret to AGI All Along" [ref=e206] [cursor=pointer]
            - generic [ref=e207]: Invalid Date
            - generic [ref=e208]: Published Mar 29, 2026
          - button "🚩" [ref=e209] [cursor=pointer]
          - button "↗" [ref=e210] [cursor=pointer]
        - generic [ref=e211]:
          - generic "Read" [ref=e212]
          - generic [ref=e213]:
            - link "You&#39;re NOT Ready For What&#39;s Coming..." [ref=e214] [cursor=pointer]
            - generic [ref=e215]: Invalid Date
            - generic [ref=e216]: Published Mar 30, 2026
          - button "🚩" [ref=e217] [cursor=pointer]
          - button "↗" [ref=e218] [cursor=pointer]
        - generic [ref=e219]:
          - generic "Read" [ref=e220]
          - generic [ref=e221]:
            - link "Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)" [ref=e222] [cursor=pointer]
            - generic [ref=e223]: Invalid Date
            - generic [ref=e224]: Published Apr 1, 2026
          - button "🚩" [ref=e225] [cursor=pointer]
          - button "↗" [ref=e226] [cursor=pointer]
        - generic [ref=e227]:
          - generic "Read" [ref=e228]
          - generic [ref=e229]:
            - link "Why You Should Bet Your Career on Local AI" [ref=e230] [cursor=pointer]
            - generic [ref=e231]: Invalid Date
            - generic [ref=e232]: Published Mar 30, 2026
          - button "🚩" [ref=e233] [cursor=pointer]
          - button "↗" [ref=e234] [cursor=pointer]
        - generic [ref=e235]:
          - generic "Read" [ref=e236]
          - generic [ref=e237]:
            - link "What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS" [ref=e238] [cursor=pointer]
            - generic [ref=e239]: Invalid Date
            - generic [ref=e240]: Published Apr 9, 2026
          - button "🚩" [ref=e241] [cursor=pointer]
          - button "↗" [ref=e242] [cursor=pointer]
        - generic [ref=e243]:
          - generic "Read" [ref=e244]
          - generic [ref=e245]:
            - link "Example Domain" [ref=e246] [cursor=pointer]
            - generic [ref=e247]: Invalid Date
          - button "🚩" [ref=e248] [cursor=pointer]
          - button "↗" [ref=e249] [cursor=pointer]
    - generic [ref=e250]:
      - button "A" [ref=e251] [cursor=pointer]
      - generic [ref=e252]: 15px
      - button "A" [ref=e253] [cursor=pointer]
  - generic "Drag to resize" [ref=e254]
```

# Test source

```ts
  1   | import { test, expect } from '@playwright/test';
  2   | import { readFileSync } from 'node:fs';
  3   | import { resolve, dirname } from 'node:path';
  4   | import { fileURLToPath } from 'node:url';
  5   | 
  6   | const __dirname = dirname(fileURLToPath(import.meta.url));
  7   | const EXT_DIR = resolve(__dirname, '..', 'extension');
  8   | 
  9   | // Pins the save button behavior: POSTing to /process with the current tab URL,
  10  | // showing the "already saved" banner for duplicates, and hiding the save
  11  | // button once a duplicate is detected.
  12  | 
  13  | async function loadPopupWithUrl(
  14  |   page: import('@playwright/test').Page,
  15  |   tabUrl: string,
  16  | ) {
  17  |   const popupHtml = readFileSync(resolve(EXT_DIR, 'popup.html'), 'utf8');
  18  |   await page.addInitScript((url) => {
  19  |     (window as any).__tabCreates = [];
  20  |     (window as any).chrome = {
  21  |       storage: {
  22  |         local: {
  23  |           get: (_keys: unknown, cb: (v: Record<string, unknown>) => void) => cb({}),
  24  |           set: (_v: unknown, cb?: () => void) => cb && cb(),
  25  |         },
  26  |       },
  27  |       tabs: {
  28  |         query: async () => [{ url }],
  29  |         create: (opts: { url?: string }) => {
  30  |           (window as any).__tabCreates.push(opts?.url || '');
  31  |         },
  32  |       },
  33  |     };
  34  |   }, tabUrl);
  35  |   const rewritten = popupHtml
  36  |     .replace(
  37  |       '<script src="raise-form.js"></script>',
  38  |       `<script>${readFileSync(resolve(EXT_DIR, 'raise-form.js'), 'utf8')}</script>`,
  39  |     )
  40  |     .replace(
  41  |       '<script src="popup.js"></script>',
  42  |       `<script>${readFileSync(resolve(EXT_DIR, 'popup.js'), 'utf8')}</script>`,
  43  |     );
  44  |   await page.goto('http://127.0.0.1:3737/health');
  45  |   await page.setContent(rewritten, { waitUntil: 'load' });
  46  | }
  47  | 
  48  | test('save button submits current tab URL to /process', async ({ page, request }) => {
  49  |   const uniqueUrl = `https://example.com/save-flow-test-${Date.now()}`;
  50  | 
  51  |   // Capture outbound /process calls from the popup.
  52  |   const processCalls: string[] = [];
  53  |   await page.route('**/process', async (route) => {
  54  |     if (route.request().method() === 'POST') {
  55  |       processCalls.push(route.request().postData() || '');
  56  |     }
  57  |     await route.continue();
  58  |   });
  59  | 
  60  |   await loadPopupWithUrl(page, uniqueUrl);
  61  |   await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  62  | 
  63  |   const saveBtn = page.locator('#save-btn');
  64  |   await expect(saveBtn).toBeVisible();
  65  |   await saveBtn.click();
  66  | 
> 67  |   await expect.poll(() => processCalls.length, { timeout: 5000 }).toBeGreaterThan(0);
      |   ^ Error: expect(received).toBeGreaterThan(expected)
  68  |   const payload = JSON.parse(processCalls[0]!);
  69  |   expect(payload.url).toBe(uniqueUrl);
  70  | 
  71  |   // The real server accepted it, so cleanup: delete what we just created.
  72  |   const check = await request.get(`http://127.0.0.1:3737/items/check?url=${encodeURIComponent(uniqueUrl)}`);
  73  |   if (check.ok()) {
  74  |     const data = (await check.json()) as { exists?: boolean; id?: string };
  75  |     if (data.exists && data.id) {
  76  |       await request.delete(`http://127.0.0.1:3737/items/${encodeURIComponent(data.id)}`);
  77  |     }
  78  |   }
  79  | });
  80  | 
  81  | test('duplicate URL shows already-saved banner and hides the save button', async ({ page, request }) => {
  82  |   // Find a real saved URL from the DB so the duplicate check is genuine.
  83  |   let items: Array<{ status: string; url: string }> = [];
  84  |   for (let i = 0; i < 5; i++) {
  85  |     const r = await request.get('http://127.0.0.1:3737/items');
  86  |     if (r.ok()) { items = (await r.json()) as Array<{ status: string; url: string }>; break; }
  87  |     await new Promise((res) => setTimeout(res, 300));
  88  |   }
  89  |   expect(items.length).toBeGreaterThan(0);
  90  |   const existing = items.find((i) => i.status === 'done' && i.url?.startsWith('http'));
  91  |   if (!existing) throw new Error('No existing done item with http URL in DB');
  92  | 
  93  |   await loadPopupWithUrl(page, existing.url);
  94  |   await expect(page.locator('#items-list .item').first()).toBeVisible({ timeout: 10000 });
  95  | 
  96  |   const banner = page.locator('#duplicate-banner');
  97  |   await expect(banner).toBeVisible({ timeout: 5000 });
  98  |   await expect(banner).not.toHaveClass(/hidden/);
  99  | 
  100 |   const bannerText = page.locator('#duplicate-banner-text');
  101 |   await expect(bannerText).toContainText(/Already saved|Currently being processed|Summarization failed/);
  102 | 
  103 |   // Save button hidden once duplicate is detected.
  104 |   await expect(page.locator('#save-btn')).toHaveClass(/hidden/);
  105 | });
  106 | 
```