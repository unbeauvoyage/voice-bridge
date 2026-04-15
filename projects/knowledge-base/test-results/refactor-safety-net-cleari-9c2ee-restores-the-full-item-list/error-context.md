# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: refactor-safety-net.spec.ts >> clearing search restores the full item list
- Location: tests/refactor-safety-net.spec.ts:222:1

# Error details

```
Error: expect(received).toBeGreaterThanOrEqual(expected)

Expected: >= 26
Received:    0
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
        - generic [ref=e12] [cursor=pointer]:
          - generic [ref=e13]: 🕑
          - generic [ref=e14]: zzznomatch_xyzxyz_99999
          - button "×" [ref=e15]
        - button "Clear history" [ref=e17] [cursor=pointer]
    - generic [ref=e18]:
      - button "All" [ref=e19] [cursor=pointer]
      - button "Today" [ref=e20] [cursor=pointer]
      - button "2d" [ref=e21] [cursor=pointer]
      - button "3d" [ref=e22] [cursor=pointer]
      - button "4d" [ref=e23] [cursor=pointer]
      - button "★ Starred" [ref=e24] [cursor=pointer]
      - button "📚 Study Later" [ref=e25]
      - button "📦 Archived" [ref=e26] [cursor=pointer]
    - button "⚑ 230 pending (+ 17 suggestions)" [ref=e27] [cursor=pointer]
    - button "+ Bulk Add" [ref=e28] [cursor=pointer]
    - button "Tags" [ref=e29] [cursor=pointer]
    - button "📁 Collections" [ref=e30] [cursor=pointer]
    - button "🔖 Presets" [ref=e32] [cursor=pointer]
    - button "Export" [ref=e34] [cursor=pointer]
    - button "☀️" [ref=e35] [cursor=pointer]
    - button "📊" [ref=e36]
    - button "⚙" [ref=e37] [cursor=pointer]
    - button "⚙ Queue" [ref=e38] [cursor=pointer]
    - button "?" [ref=e39] [cursor=pointer]
  - generic [ref=e40]:
    - generic [ref=e41]: ⚠️ Ollama is not running — new items cannot be summarized. Start Ollama to resume processing.
    - button "Dismiss" [ref=e42] [cursor=pointer]
  - generic [ref=e43]:
    - generic [ref=e44] [cursor=pointer]:
      - generic [ref=e45]: 📚 27/3 today
      - generic [ref=e46]: 🔥 6 day streak
    - 'generic "Daily goal: 27 of 3" [ref=e47]'
    - generic [ref=e49] [cursor=pointer]: Sources
  - generic [ref=e50]:
    - generic [ref=e51]:
      - generic [ref=e52]:
        - generic [ref=e53]: 26 items
        - combobox "Sort order" [ref=e54] [cursor=pointer]:
          - option "Newest first" [selected]
          - option "Oldest first"
          - option "Recently read"
          - option "Highest rated"
          - option "Most starred"
          - option "Title A→Z"
          - option "Title Z→A"
      - generic [ref=e55]:
        - generic [ref=e56]:
          - button "All" [ref=e57] [cursor=pointer]
          - button "YouTube" [ref=e58] [cursor=pointer]
          - button "Web" [ref=e59] [cursor=pointer]
          - button "PDF" [ref=e60] [cursor=pointer]
        - button "Unread" [ref=e61] [cursor=pointer]
      - generic [ref=e64] [cursor=pointer]:
        - generic [ref=e65]:
          - generic [ref=e66]: 🌐
          - generic [ref=e67]: Raise Popup Test Item
          - button "🔗" [ref=e68]
          - button "☆" [ref=e69]
          - button "📌" [ref=e70]
          - button "🗑" [ref=e71]
        - generic "Apr 18, 2026" [ref=e73]: "-2d ago"
      - generic [ref=e76] [cursor=pointer]:
        - generic [ref=e77]:
          - generic [ref=e78]: 🌐
          - generic [ref=e79]: Raise Popup Test Item
          - button "🔗" [ref=e80]
          - button "★" [ref=e81]
          - button "📌" [ref=e82]
          - button "🗑" [ref=e83]
        - generic "Apr 18, 2026" [ref=e85]: "-2d ago"
      - generic [ref=e88] [cursor=pointer]:
        - generic [ref=e89]:
          - generic [ref=e90]: 🌐
          - generic [ref=e91]: Raise Popup Test Item
          - button "🔗" [ref=e92]
          - button "☆" [ref=e93]
          - button "📌" [ref=e94]
          - button "🗑" [ref=e95]
        - generic "Apr 18, 2026" [ref=e97]: "-2d ago"
      - generic [ref=e100] [cursor=pointer]:
        - generic [ref=e101]:
          - generic [ref=e102]: 🌐
          - generic [ref=e103]: Raise Popup Test Item
          - button "🔗" [ref=e104]
          - button "★" [ref=e105]
          - button "📌" [ref=e106]
          - button "🗑" [ref=e107]
        - generic "Apr 18, 2026" [ref=e109]: "-2d ago"
      - generic [ref=e112] [cursor=pointer]:
        - generic [ref=e113]:
          - generic [ref=e114]: 🌐
          - generic [ref=e115]: Raise Popup Test Item
          - button "🔗" [ref=e116]
          - button "☆" [ref=e117]
          - button "📌" [ref=e118]
          - button "🗑" [ref=e119]
        - generic "Apr 18, 2026" [ref=e121]: "-2d ago"
      - generic [ref=e124] [cursor=pointer]:
        - generic [ref=e125]:
          - generic [ref=e126]: ▶
          - generic [ref=e127]: How to Build Claude Agent Teams Better Than 99% of People
          - button "🔗" [ref=e128]
          - button "☆" [ref=e129]
          - button "📌" [ref=e130]
          - button "🗑" [ref=e131]
        - generic [ref=e132]:
          - generic "Mar 23, 2026" [ref=e133]: 3w ago
          - generic [ref=e134]: AI Development
      - generic [ref=e137] [cursor=pointer]:
        - generic [ref=e138]:
          - generic [ref=e139]: ▶
          - generic [ref=e140]: The REAL Reason Scientists Know We&#39;re In A Simulation
          - button "🔗" [ref=e141]
          - button "☆" [ref=e142]
          - button "📌" [ref=e143]
          - button "🗑" [ref=e144]
        - generic [ref=e145]:
          - generic "Dec 20, 2025" [ref=e146]: 3mo ago
          - generic [ref=e147]: Artificial Intelligence
      - generic [ref=e150] [cursor=pointer]:
        - generic [ref=e151]:
          - generic [ref=e152]: ▶
          - generic [ref=e153]: "INDUSTRY ALERT: Apple co-founder drops BLUNT warning on the future of AI"
          - button "🔗" [ref=e154]
          - button "☆" [ref=e155]
          - button "📌" [ref=e156]
          - button "🗑" [ref=e157]
        - generic [ref=e158]:
          - generic "Mar 23, 2026" [ref=e159]: 3w ago
          - generic [ref=e160]: Artificial Intelligence
      - generic [ref=e163] [cursor=pointer]:
        - generic [ref=e164]:
          - generic [ref=e165]: ▶
          - generic [ref=e166]: Claude Code is unusable now
          - button "🔗" [ref=e167]
          - button "☆" [ref=e168]
          - button "📌" [ref=e169]
          - button "🗑" [ref=e170]
        - generic [ref=e171]:
          - generic "Apr 5, 2026" [ref=e172]: 1w ago
          - generic [ref=e173]: AI
      - generic [ref=e176] [cursor=pointer]:
        - generic [ref=e177]:
          - generic [ref=e178]: ▶
          - generic [ref=e179]: How to Reverse Engineer Your Competitor&#39;s ASO Strategy With RespectASO
          - button "🔗" [ref=e180]
          - button "☆" [ref=e181]
          - button "📌" [ref=e182]
          - button "🗑" [ref=e183]
        - generic [ref=e184]:
          - generic "Apr 6, 2026" [ref=e185]: 1w ago
          - generic [ref=e186]: AI Development
      - generic [ref=e189] [cursor=pointer]:
        - generic [ref=e190]:
          - generic [ref=e191]: 🌐
          - generic [ref=e192]: Artificial intelligence | MIT Technology Review
          - button "🔗" [ref=e193]
          - button "☆" [ref=e194]
          - button "📌" [ref=e195]
          - button "🗑" [ref=e196]
        - generic "Apr 11, 2026" [ref=e198]: 5d ago
      - generic [ref=e201] [cursor=pointer]:
        - generic [ref=e202]:
          - generic [ref=e203]: 🌐
          - generic [ref=e204]: Tech
          - button "🔗" [ref=e205]
          - button "☆" [ref=e206]
          - button "📌" [ref=e207]
          - button "🗑" [ref=e208]
        - generic [ref=e209]:
          - generic "Apr 14, 2026" [ref=e210]: yesterday
          - generic [ref=e211]: Artificial Intelligence
      - generic [ref=e214] [cursor=pointer]:
        - generic [ref=e215]:
          - generic [ref=e216]: 🌐
          - generic [ref=e217]: "Category: AI"
          - button "🔗" [ref=e218]
          - button "☆" [ref=e219]
          - button "📌" [ref=e220]
          - button "🗑" [ref=e221]
        - generic "Apr 14, 2026" [ref=e223]: yesterday
      - generic [ref=e226] [cursor=pointer]:
        - generic [ref=e227]:
          - generic [ref=e228]: 🌐
          - generic [ref=e229]: AI News & Artificial Intelligence | TechCrunch
          - button "🔗" [ref=e230]
          - button "☆" [ref=e231]
          - button "📌" [ref=e232]
          - button "🗑" [ref=e233]
        - generic [ref=e234]:
          - generic "Apr 15, 2026" [ref=e235]: today
          - generic [ref=e236]: AI
      - generic [ref=e239] [cursor=pointer]:
        - generic [ref=e240]:
          - generic [ref=e241]: 🌐
          - generic [ref=e242]: BBC Technology | Technology, Health, Environment, AI
          - button "🔗" [ref=e243]
          - button "☆" [ref=e244]
          - button "📌" [ref=e245]
          - button "🗑" [ref=e246]
        - generic [ref=e247]:
          - generic "Apr 11, 2026" [ref=e248]: 5d ago
          - generic [ref=e249]: Artificial Intelligence
      - generic [ref=e252] [cursor=pointer]:
        - generic [ref=e253]:
          - generic [ref=e254]: 🌐
          - generic [ref=e255]: Artificial Intelligence
          - button "🔗" [ref=e256]
          - button "☆" [ref=e257]
          - button "📌" [ref=e258]
          - button "🗑" [ref=e259]
        - generic [ref=e260]:
          - generic "Apr 15, 2026" [ref=e261]: today
          - generic [ref=e262]: Artificial Intelligence
      - generic [ref=e265] [cursor=pointer]:
        - generic [ref=e266]:
          - generic [ref=e267]: 🌐
          - generic [ref=e268]: 50 Claude Code Tips & Tricks for Smoother Daily Coding in 2026
          - button "🔗" [ref=e269]
          - button "☆" [ref=e270]
          - button "📌" [ref=e271]
          - button "🗑" [ref=e272]
        - generic [ref=e273]:
          - generic "Feb 18, 2026" [ref=e274]: 1mo ago
          - generic [ref=e275]: Claude Code
      - generic [ref=e278] [cursor=pointer]:
        - generic [ref=e279]:
          - generic [ref=e280]: 🌐
          - generic [ref=e281]: How and when to use subagents in Claude Code
          - button "🔗" [ref=e282]
          - button "☆" [ref=e283]
          - button "📌" [ref=e284]
          - button "🗑" [ref=e285]
        - generic [ref=e286]:
          - generic "Apr 7, 2020" [ref=e287]: 6y ago
          - generic [ref=e288]: AI Development
      - generic [ref=e291] [cursor=pointer]:
        - generic [ref=e292]:
          - generic [ref=e293]: ▶
          - generic [ref=e294]: 1983-01-17 A18-08 İmtihandayız, ama hayat bazen çok zorlaşıyor, ne yapabiliriz?
          - button "🔗" [ref=e295]
          - button "★" [ref=e296]
          - button "📌" [ref=e297]
          - button "🗑" [ref=e298]
        - generic "Apr 1, 2026" [ref=e300]: 2w ago
      - generic [ref=e303] [cursor=pointer]:
        - generic [ref=e304]:
          - generic [ref=e305]: ▶
          - generic [ref=e306]: 【開発効率が爆上がり】Claude Codeの新機能「カスタムサブエージェント」がスゴすぎる！
          - button "🔗" [ref=e307]
          - button "☆" [ref=e308]
          - button "📌" [ref=e309]
          - button "🗑" [ref=e310]
        - generic [ref=e311]:
          - generic "Jul 25, 2025" [ref=e312]: 8mo ago
          - generic [ref=e313]: Claude Code
      - generic [ref=e316] [cursor=pointer]:
        - generic [ref=e317]:
          - generic [ref=e318]: ▶
          - generic [ref=e319]: Elon Knew the Secret to AGI All Along
          - button "🔗" [ref=e320]
          - button "★" [ref=e321]
          - button "📌" [ref=e322]
          - button "🗑" [ref=e323]
        - generic [ref=e324]:
          - generic "Mar 29, 2026" [ref=e325]: 2w ago
          - generic [ref=e326]: Artificial Intelligence
      - generic [ref=e329] [cursor=pointer]:
        - generic [ref=e330]:
          - generic [ref=e331]: ▶
          - generic [ref=e332]: You&#39;re NOT Ready For What&#39;s Coming...
          - button "🔗" [ref=e333]
          - button "★" [ref=e334]
          - button "📌" [ref=e335]
          - button "🗑" [ref=e336]
        - generic "Mar 30, 2026" [ref=e338]: 2w ago
      - generic [ref=e341] [cursor=pointer]:
        - generic [ref=e342]:
          - generic [ref=e343]: ▶
          - generic [ref=e344]: Don’t Buy a New Computer in 2026! (Even for AI Use – Here’s Why)
          - button "🔗" [ref=e345]
          - button "★" [ref=e346]
          - button "📌" [ref=e347]
          - button "🗑" [ref=e348]
        - generic [ref=e349]:
          - generic "Apr 1, 2026" [ref=e350]: 2w ago
          - generic [ref=e351]: AI Development
      - generic [ref=e354] [cursor=pointer]:
        - generic [ref=e355]:
          - generic [ref=e356]: ▶
          - generic [ref=e357]: Why You Should Bet Your Career on Local AI
          - button "🔗" [ref=e358]
          - button "☆" [ref=e359]
          - button "📌" [ref=e360]
          - button "🗑" [ref=e361]
        - generic [ref=e362]:
          - generic "Mar 30, 2026" [ref=e363]: 2w ago
          - generic [ref=e364]: AI
      - generic [ref=e367] [cursor=pointer]:
        - generic [ref=e368]:
          - generic [ref=e369]: ▶
          - generic [ref=e370]: What JAPAN Did for Ukraine Is INSANE… Putin Just Became POWERLESS
          - button "🔗" [ref=e371]
          - button "☆" [ref=e372]
          - button "📌" [ref=e373]
          - button "🗑" [ref=e374]
        - generic [ref=e375]:
          - generic "Apr 9, 2026" [ref=e376]: 6d ago
          - generic [ref=e377]: AI
      - generic [ref=e380] [cursor=pointer]:
        - generic [ref=e381]:
          - generic [ref=e382]: 🌐
          - generic [ref=e383]: Example Domain
          - button "🔗" [ref=e384]
          - button "☆" [ref=e385]
          - button "📌" [ref=e386]
          - button "🗑" [ref=e387]
        - generic [ref=e388]:
          - generic "Apr 10, 2026" [ref=e389]: 5d ago
          - generic [ref=e390]: Software Development
    - generic [ref=e393]:
      - generic [ref=e394]: ←
      - text: Select an item to read
```

# Test source

```ts
  149 |   // Confirm initial empty state
  150 |   await expect(page.locator('.reader-empty')).toBeVisible({ timeout: 10_000 });
  151 | 
  152 |   // Click first card
  153 |   const firstCard = page.locator('.item-card').first();
  154 |   await expect(firstCard).toBeVisible({ timeout: 5_000 });
  155 |   await firstCard.click();
  156 | 
  157 |   // .reader-empty hides
  158 |   await expect(page.locator('.reader-empty')).not.toBeVisible({ timeout: 5_000 });
  159 | 
  160 |   // .reader-title is visible and non-empty
  161 |   const readerTitle = page.locator('.reader-title');
  162 |   await expect(readerTitle).toBeVisible({ timeout: 5_000 });
  163 |   const titleText = await readerTitle.innerText();
  164 |   expect(titleText.trim().length).toBeGreaterThan(0);
  165 | 
  166 |   // .reader-meta is visible in the reader pane
  167 |   await expect(page.locator('.reader-meta')).toBeVisible({ timeout: 5_000 });
  168 | });
  169 | 
  170 | test('no error boundary fires after selecting an item', async ({
  171 |   page,
  172 |   request,
  173 | }) => {
  174 |   await ensureServer(request);
  175 |   await getDoneItem(request);
  176 | 
  177 |   await page.goto(BASE);
  178 | 
  179 |   const firstCard = page.locator('.item-card').first();
  180 |   await expect(firstCard).toBeVisible({ timeout: 10_000 });
  181 |   await firstCard.click();
  182 | 
  183 |   // .error-boundary must not appear
  184 |   await expect(page.locator('.error-boundary')).toHaveCount(0);
  185 |   // Belt-and-suspenders: check for the error text too
  186 |   await expect(page.locator('text=Something went wrong')).toHaveCount(0);
  187 | });
  188 | 
  189 | // ===========================================================================
  190 | // 3. Search bar CSS structure is preserved
  191 | // ===========================================================================
  192 | 
  193 | test('search input accepts text and filters the item list', async ({
  194 |   page,
  195 |   request,
  196 | }) => {
  197 |   await ensureServer(request);
  198 |   await getDoneItem(request);
  199 | 
  200 |   await page.goto(BASE);
  201 | 
  202 |   // [data-testid='search-input'] is present
  203 |   const searchInput = page.locator('[data-testid="search-input"]');
  204 |   await expect(searchInput).toBeVisible({ timeout: 10_000 });
  205 | 
  206 |   // Wait for at least one item card to appear before recording baseline
  207 |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 5_000 });
  208 |   const initialCount = await page.locator('.item-card').count();
  209 |   expect(initialCount).toBeGreaterThan(0);
  210 | 
  211 |   // Type a search term that is unlikely to match anything
  212 |   await searchInput.fill('zzznomatch_xyzxyz_99999');
  213 | 
  214 |   // Wait for the UI to react to the filter
  215 |   await page.waitForTimeout(600);
  216 | 
  217 |   const afterCount = await page.locator('.item-card').count();
  218 |   // No items should match this nonsense query (or at worst fewer than baseline)
  219 |   expect(afterCount).toBeLessThan(initialCount);
  220 | });
  221 | 
  222 | test('clearing search restores the full item list', async ({
  223 |   page,
  224 |   request,
  225 | }) => {
  226 |   await ensureServer(request);
  227 |   await getDoneItem(request);
  228 | 
  229 |   await page.goto(BASE);
  230 | 
  231 |   const searchInput = page.locator('[data-testid="search-input"]');
  232 |   await expect(searchInput).toBeVisible({ timeout: 10_000 });
  233 | 
  234 |   // Capture baseline count
  235 |   await expect(page.locator('.item-card').first()).toBeVisible({ timeout: 5_000 });
  236 |   const baselineCount = await page.locator('.item-card').count();
  237 | 
  238 |   // Filter to nothing
  239 |   await searchInput.fill('zzznomatch_xyzxyz_99999');
  240 |   // Give UI time to react
  241 |   await page.waitForTimeout(500);
  242 | 
  243 |   // Clear the input
  244 |   await searchInput.fill('');
  245 |   await page.waitForTimeout(500);
  246 | 
  247 |   // List should be back to at least the baseline count
  248 |   const restoredCount = await page.locator('.item-card').count();
> 249 |   expect(restoredCount).toBeGreaterThanOrEqual(baselineCount);
      |                         ^ Error: expect(received).toBeGreaterThanOrEqual(expected)
  250 | });
  251 | 
  252 | // ===========================================================================
  253 | // 4. Ingest entry point CSS structure is preserved
  254 | // ===========================================================================
  255 | 
  256 | test('Ctrl+L opens the quick-capture overlay', async ({ page, request }) => {
  257 |   await ensureServer(request);
  258 | 
  259 |   await page.goto(BASE);
  260 | 
  261 |   // Ensure page body has focus for keyboard events
  262 |   await page.locator('body').click();
  263 | 
  264 |   // Quick-capture overlay should not be visible initially
  265 |   await expect(page.locator('.quick-capture-overlay')).not.toBeVisible({
  266 |     timeout: 3_000,
  267 |   }).catch(() => {
  268 |     // May already be hidden — that's fine
  269 |   });
  270 | 
  271 |   // Open with Ctrl+L
  272 |   await page.keyboard.press('Control+l');
  273 | 
  274 |   // Overlay appears
  275 |   const overlay = page.locator('.quick-capture-overlay');
  276 |   await expect(overlay).toBeVisible({ timeout: 5_000 });
  277 | });
  278 | 
  279 | test('quick-capture modal contains input and button in correct initial state', async ({
  280 |   page,
  281 |   request,
  282 | }) => {
  283 |   await ensureServer(request);
  284 | 
  285 |   await page.goto(BASE);
  286 |   await page.locator('body').click();
  287 |   await page.keyboard.press('Control+l');
  288 | 
  289 |   const overlay = page.locator('.quick-capture-overlay');
  290 |   await expect(overlay).toBeVisible({ timeout: 5_000 });
  291 | 
  292 |   // .quick-capture-input is visible inside the modal
  293 |   const captureInput = page.locator('.quick-capture-input');
  294 |   await expect(captureInput).toBeVisible({ timeout: 3_000 });
  295 | 
  296 |   // .quick-capture-btn is visible and enabled
  297 |   const captureBtn = page.locator('.quick-capture-btn');
  298 |   await expect(captureBtn).toBeVisible({ timeout: 3_000 });
  299 |   await expect(captureBtn).toBeEnabled({ timeout: 3_000 });
  300 | 
  301 |   // Button text is 'Save' in idle state
  302 |   await expect(captureBtn).toHaveText('Save');
  303 | 
  304 |   // After typing a URL the button remains enabled and ready to submit
  305 |   await captureInput.fill('https://example.com');
  306 |   await expect(captureBtn).toBeEnabled({ timeout: 3_000 });
  307 | });
  308 | 
  309 | test('Escape key closes the quick-capture overlay', async ({
  310 |   page,
  311 |   request,
  312 | }) => {
  313 |   await ensureServer(request);
  314 | 
  315 |   await page.goto(BASE);
  316 |   await page.locator('body').click();
  317 |   await page.keyboard.press('Control+l');
  318 | 
  319 |   const overlay = page.locator('.quick-capture-overlay');
  320 |   await expect(overlay).toBeVisible({ timeout: 5_000 });
  321 | 
  322 |   // Press Escape to close
  323 |   await page.keyboard.press('Escape');
  324 | 
  325 |   await expect(overlay).not.toBeVisible({ timeout: 3_000 });
  326 | });
  327 | 
```