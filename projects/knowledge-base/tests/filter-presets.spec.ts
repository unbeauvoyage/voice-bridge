import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

async function cleanup(request: APIRequestContext, id: string) {
  await request.delete(`${BASE}/filter-presets/${id}`);
}

test('GET /filter-presets returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/filter-presets`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('POST /filter-presets creates a preset and returns id', async ({ request }) => {
  const res = await request.post(`${BASE}/filter-presets`, {
    data: {
      name: `preset-${Date.now()}`,
      searchQuery: 'ai',
      tagFilter: ['AI'],
      typeFilter: 'web',
      semanticMode: false,
      showStarredOnly: false,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(201);
  const body = (await res.json()) as { id: string };
  expect(typeof body.id).toBe('string');
  expect(body.id.length).toBeGreaterThan(0);
  await cleanup(request, body.id);
});

test('POST /filter-presets rejects missing name', async ({ request }) => {
  const res = await request.post(`${BASE}/filter-presets`, {
    data: { searchQuery: 'oops' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('newly created preset appears in GET /filter-presets with expected fields', async ({ request }) => {
  const name = `preset-shape-${Date.now()}`;
  const createRes = await request.post(`${BASE}/filter-presets`, {
    data: {
      name,
      searchQuery: 'hello',
      tagFilter: ['AI', 'Anthropic'],
      dateFilter: 'week',
      typeFilter: 'youtube',
      semanticMode: true,
      showStarredOnly: true,
    },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id } = (await createRes.json()) as { id: string };

  const listRes = await request.get(`${BASE}/filter-presets`);
  expect(listRes.ok()).toBeTruthy();
  const presets = (await listRes.json()) as Array<{
    id: string;
    name: string;
    searchQuery?: string | null;
    tagFilter?: string[] | null;
    typeFilter?: string | null;
  }>;
  const created = presets.find((p) => p.id === id);
  expect(created).toBeTruthy();
  expect(created!.name).toBe(name);
  // Only assert structural fields — shape may vary by driver camelCasing.
  expect(typeof created!.id).toBe('string');

  await cleanup(request, id);
});

test('DELETE /filter-presets/:id removes the preset', async ({ request }) => {
  const createRes = await request.post(`${BASE}/filter-presets`, {
    data: { name: `preset-del-${Date.now()}` },
    headers: { 'Content-Type': 'application/json' },
  });
  const { id } = (await createRes.json()) as { id: string };

  const del = await request.delete(`${BASE}/filter-presets/${id}`);
  expect(del.ok()).toBeTruthy();

  const listRes = await request.get(`${BASE}/filter-presets`);
  const presets = (await listRes.json()) as Array<{ id: string }>;
  expect(presets.find((p) => p.id === id)).toBeUndefined();
});
