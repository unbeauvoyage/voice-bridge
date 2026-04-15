# Instructions

- Following Playwright test failed.
- Explain why, be concise, respect Playwright best practices.
- Provide a snippet of code with the fix, if possible.

# Test info

- Name: ollama-status.spec.ts >> GET /ollama/status includes model field
- Location: tests/ollama-status.spec.ts:59:1

# Error details

```
Error: expect(received).toBe(expected) // Object.is equality

Expected: "string"
Received: "undefined"
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
  56 |   await expect(page.locator('.ollama-status')).toContainText('gemma4:26b', { timeout: 5000 });
  57 | });
  58 | 
  59 | test('GET /ollama/status includes model field', async ({ request }) => {
  60 |   const res = await request.get(`${BASE}/ollama/status`);
  61 |   expect(res.ok()).toBeTruthy();
  62 |   const body = await res.json() as { ok: boolean; url: string; model?: string };
  63 |   expect(typeof body.ok).toBe('boolean');
  64 |   expect(typeof body.url).toBe('string');
> 65 |   expect(typeof body.model).toBe('string');
     |                             ^ Error: expect(received).toBe(expected) // Object.is equality
  66 |   expect((body.model ?? '').length).toBeGreaterThan(0);
  67 | });
  68 | 
```