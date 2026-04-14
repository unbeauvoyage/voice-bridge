import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

async function findYoutubeItem(request: APIRequestContext): Promise<{ id: string; title?: string } | null> {
  const res = await request.get(`${BASE}/items`);
  if (!res.ok()) return null;
  const items = (await res.json()) as Array<{ id: string; type: string; title?: string }>;
  return items.find((i) => i.type === 'youtube') ?? null;
}

test('YouTube items have type: youtube in /items response', async ({ request }) => {
  const res = await request.get(`${BASE}/items`);
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()) as Array<{ type: string; url: string }>;
  const yts = items.filter((i) => i.type === 'youtube');
  expect(yts.length).toBeGreaterThan(0);
  for (const yt of yts) {
    expect(yt.type).toBe('youtube');
    expect(yt.url).toMatch(/youtube\.com|youtu\.be/);
  }
});

test('YouTube item detail is reachable via GET /items/:id', async ({ request }) => {
  const yt = await findYoutubeItem(request);
  expect(yt).toBeTruthy();
  const res = await request.get(`${BASE}/items/${yt!.id}`);
  expect(res.ok()).toBeTruthy();
  const item = (await res.json()) as { id: string; type: string; url: string };
  expect(item.id).toBe(yt!.id);
  expect(item.type).toBe('youtube');
});

test('YouTube video id is extractable from url for embed player', async ({ request }) => {
  const yt = await findYoutubeItem(request);
  expect(yt).toBeTruthy();
  const res = await request.get(`${BASE}/items/${yt!.id}`);
  const item = (await res.json()) as { url: string };
  // Standard YouTube URL shapes should yield an 11-char video id.
  const match = item.url.match(/(?:v=|youtu\.be\/)([A-Za-z0-9_-]{11})/);
  expect(match).not.toBeNull();
  expect(match![1]!.length).toBe(11);
});

test('YouTube item reader pane shows iframe embed', async ({ page, request }) => {
  const yt = await findYoutubeItem(request);
  expect(yt).toBeTruthy();
  await page.goto(BASE);
  // Open the card by its stable data-id so we never accidentally open a
  // non-YouTube card seeded by a parallel test.
  const card = page.locator(`.item-card[data-id="${yt!.id}"]`);
  await expect(card).toBeVisible({ timeout: 10_000 });
  await card.click();
  // The reader should contain an iframe whose src references youtube.com/embed/
  const iframe = page.locator('iframe[src*="youtube.com/embed/"]').first();
  await expect(iframe).toBeVisible({ timeout: 10_000 });
});
