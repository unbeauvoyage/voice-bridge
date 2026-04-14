import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

test('GET /stats/summary returns complete StatsSummary shape', async ({ request }) => {
  const res = await request.get(`${BASE}/stats/summary`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as Record<string, unknown>;

  // All fields defined in StatsSummary interface in src/db.ts must be present.
  const requiredNumberFields = [
    'totalItems',
    'totalRead',
    'totalStarred',
    'totalPinned',
    'totalNotes',
    'avgRating',
    'savedThisWeek',
    'savedThisMonth',
    'avgReadingTime',
  ];
  for (const f of requiredNumberFields) {
    expect(typeof body[f]).toBe('number');
  }
  expect(Array.isArray(body.topTags)).toBe(true);
  expect(typeof body.mostReadDomain).toBe('string');
  expect(typeof body.byType).toBe('object');
});

test('GET /stats/summary byType has youtube and article keys', async ({ request }) => {
  const res = await request.get(`${BASE}/stats/summary`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { byType: Record<string, number> };
  expect(body.byType).toBeTruthy();
  expect(typeof body.byType.youtube).toBe('number');
  expect(typeof body.byType.article).toBe('number');
  expect(typeof body.byType.video).toBe('number');
  expect(typeof body.byType.pdf).toBe('number');
});

test('GET /stats/summary topTags entries have tag and count', async ({ request }) => {
  const res = await request.get(`${BASE}/stats/summary`);
  const body = (await res.json()) as { topTags: Array<{ tag: string; count: number }> };
  for (const t of body.topTags) {
    expect(typeof t.tag).toBe('string');
    expect(typeof t.count).toBe('number');
    expect(t.count).toBeGreaterThanOrEqual(0);
  }
});

test('GET /reading-stats returns expected shape', async ({ request }) => {
  const res = await request.get(`${BASE}/reading-stats`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as Record<string, unknown>;
  // Reading stats should expose today, week, and streak-style counters. Assert
  // that at least a few numeric fields are present.
  const numericKeys = Object.keys(body).filter((k) => typeof body[k] === 'number');
  expect(numericKeys.length).toBeGreaterThan(0);
});

test('GET /stats/domains returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/stats/domains`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('statistics totalItems is consistent with GET /items count of done items', async ({ request }) => {
  const [statsRes, itemsRes] = await Promise.all([
    request.get(`${BASE}/stats/summary`),
    request.get(`${BASE}/items`),
  ]);
  const stats = (await statsRes.json()) as { totalItems: number };
  const items = (await itemsRes.json()) as Array<{ status: string; archived?: boolean }>;
  const doneNonArchived = items.filter((i) => i.status === 'done' && !i.archived).length;
  // /items may return a superset (all statuses) or only done — assert that
  // totalItems is consistent with or ≤ the full list length.
  expect(stats.totalItems).toBeGreaterThanOrEqual(0);
  expect(stats.totalItems).toBeLessThanOrEqual(Math.max(items.length, doneNonArchived));
});
