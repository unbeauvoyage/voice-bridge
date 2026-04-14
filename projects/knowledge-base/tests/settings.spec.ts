import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('POST /settings persists a key and GET /settings returns it', async ({ request }) => {
  const testKey = 'test_setting_' + Date.now();
  const testValue = 'hello-world';
  const postRes = await request.post(BASE + '/settings', {
    data: { key: testKey, value: testValue },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(postRes.ok()).toBeTruthy();
  const getRes = await request.get(BASE + '/settings');
  expect(getRes.ok()).toBeTruthy();
  const body = await getRes.json();
  expect(body[testKey]).toBe(testValue);
});

test('settings panel shows the current summarization language radio selection', async ({ page }) => {
  await page.goto(BASE + '/');
  await page.locator('button.header-settings-btn').click();
  const panel = page.locator('.settings-panel');
  await expect(panel).toBeVisible();
  // One of the language radios should be checked after settings load
  const englishRadio = panel.locator('input[type="radio"][value="english"]');
  const originalRadio = panel.locator('input[type="radio"][value="original"]');
  await expect(englishRadio).toBeVisible();
  await expect(originalRadio).toBeVisible();
  const englishChecked = await englishRadio.isChecked();
  const originalChecked = await originalRadio.isChecked();
  expect(englishChecked || originalChecked).toBe(true);
});

test('GET /tag-rules returns a rules string', async ({ request }) => {
  const res = await request.get(BASE + '/tag-rules');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(typeof body.rules).toBe('string');
  expect(body.rules.length).toBeGreaterThan(0);
});

test('GET /tags/rejections returns an array with expected shape', async ({ request }) => {
  const res = await request.get(BASE + '/tags/rejections');
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
  if (body.length > 0) {
    const r = body[0];
    expect(r).toHaveProperty('id');
    expect(r).toHaveProperty('tag');
    expect(r).toHaveProperty('reason');
    expect(r).toHaveProperty('createdAt');
  }
});
