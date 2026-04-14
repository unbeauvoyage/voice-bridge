import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

// Regression: a single slow/failed /ollama/status response must NOT flash the
// warning banner. Only after two consecutive failures should the UI report
// "Ollama is not running".
test('ollama status warning does not flash on initial slow response', async ({ page }) => {
  let callCount = 0;
  await page.route('**/ollama/status', async (route) => {
    callCount += 1;
    if (callCount === 1) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: false, url: 'http://localhost:11434' }),
      });
    } else {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({ ok: true, url: 'http://localhost:11434', model: 'gemma4:26b' }),
      });
    }
  });

  // Speed up polling so we don't wait 30s for the second check.
  await page.goto(`${BASE}?ollamaPollMs=300`);

  // Wait past the first poll completion — the warning must NOT be shown
  // despite ok:false, because only one failure has occurred.
  await page.waitForTimeout(600);
  await expect(page.locator('.ollama-warning')).toHaveCount(0);

  // Wait for the second poll to run with ok:true. The status pill should
  // reflect the running state.
  await expect.poll(() => callCount, { timeout: 5000 }).toBeGreaterThanOrEqual(2);

  // Still no warning.
  await expect(page.locator('.ollama-warning')).toHaveCount(0);
});

test('ollama status shows model name when running', async ({ page }) => {
  await page.route('**/ollama/status', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ ok: true, url: 'http://localhost:11434', model: 'gemma4:26b' }),
    });
  });

  await page.goto(BASE);

  // The UI must surface the active model name somewhere (status indicator /
  // tooltip / pill). Look for the literal model string.
  await expect(page.locator('.ollama-status')).toContainText('gemma4:26b', { timeout: 5000 });
});

test('GET /ollama/status includes model field', async ({ request }) => {
  const res = await request.get(`${BASE}/ollama/status`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json() as { ok: boolean; url: string; model?: string };
  expect(typeof body.ok).toBe('boolean');
  expect(typeof body.url).toBe('string');
  expect(typeof body.model).toBe('string');
  expect((body.model ?? '').length).toBeGreaterThan(0);
});
