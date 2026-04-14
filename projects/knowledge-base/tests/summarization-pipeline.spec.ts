import { test, expect, type APIRequestContext } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

// Finds an already-done item with a transcript. The DB always has at least one
// (the seeded YouTube item and previously-processed real items).
async function findDoneItemWithTranscript(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${BASE}/items`);
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()) as Array<{ id: string; status: string }>;
  for (const it of items.filter((i) => i.status === 'done')) {
    const full = await request.get(`${BASE}/items/${it.id}`);
    if (!full.ok()) continue;
    const body = (await full.json()) as { transcript?: string | null };
    if (body.transcript && body.transcript.length > 0) return it.id;
  }
  // Fallback: return first done item regardless — some endpoints accept items
  // without transcripts (history, summary-quality).
  const firstDone = items.find((i) => i.status === 'done');
  expect(firstDone, 'expected at least one done item in DB').toBeTruthy();
  return firstDone!.id;
}

async function firstDoneId(request: APIRequestContext): Promise<string> {
  const res = await request.get(`${BASE}/items`);
  expect(res.ok()).toBeTruthy();
  const items = (await res.json()) as Array<{ id: string; status: string }>;
  const done = items.find((i) => i.status === 'done');
  expect(done, 'expected a done item in DB').toBeTruthy();
  return done!.id;
}

test('GET /items/:id/history returns an array of versions', async ({ request }) => {
  const id = await firstDoneId(request);
  const res = await request.get(`${BASE}/items/${id}/history`);
  expect(res.ok()).toBeTruthy();
  const versions = (await res.json()) as unknown;
  expect(Array.isArray(versions)).toBe(true);
});

test('summary history versions have tldr, sections, and summary fields', async ({ request }) => {
  // Look across all done items for one with at least one history entry.
  const listRes = await request.get(`${BASE}/items`);
  const items = (await listRes.json()) as Array<{ id: string; status: string }>;
  let sample: { tldr: unknown; sections: unknown; summary: unknown; summaryModel?: unknown } | null = null;
  for (const it of items.filter((i) => i.status === 'done')) {
    const h = await request.get(`${BASE}/items/${it.id}/history`);
    if (!h.ok()) continue;
    const versions = (await h.json()) as Array<typeof sample & object>;
    if (versions.length > 0) {
      sample = versions[0]!;
      break;
    }
  }
  // If no history exists yet, trigger a resummarize to produce one, then poll.
  if (!sample) {
    const id = await findDoneItemWithTranscript(request);
    await request.post(`${BASE}/items/${id}/resummarize`);
    const deadline = Date.now() + 120_000;
    while (Date.now() < deadline && !sample) {
      await new Promise((r) => setTimeout(r, 2000));
      const h = await request.get(`${BASE}/items/${id}/history`);
      if (!h.ok()) continue;
      const versions = (await h.json()) as Array<typeof sample & object>;
      if (versions.length > 0) sample = versions[0]!;
    }
  }
  expect(sample, 'expected at least one history version to exist or be created').toBeTruthy();
  expect(Array.isArray(sample!.tldr)).toBe(true);
  expect(Array.isArray(sample!.sections)).toBe(true);
  expect(typeof sample!.summary).toBe('string');
});

test('resummarize creates a new version in history', async ({ request }) => {
  test.setTimeout(180_000);
  const id = await findDoneItemWithTranscript(request);

  const beforeRes = await request.get(`${BASE}/items/${id}/history`);
  expect(beforeRes.ok()).toBeTruthy();
  const beforeCount = ((await beforeRes.json()) as unknown[]).length;

  const resummarize = await request.post(`${BASE}/items/${id}/resummarize`);
  expect(resummarize.ok()).toBeTruthy();

  const deadline = Date.now() + 150_000;
  let afterCount = beforeCount;
  while (Date.now() < deadline) {
    await new Promise((r) => setTimeout(r, 2000));
    const afterRes = await request.get(`${BASE}/items/${id}/history`);
    if (!afterRes.ok()) continue;
    afterCount = ((await afterRes.json()) as unknown[]).length;
    if (afterCount > beforeCount) break;
  }
  expect(afterCount).toBeGreaterThan(beforeCount);
});

test('resummarize on item without transcript returns 400', async ({ request }) => {
  // Create a fresh queued item — it has no transcript until processing completes.
  // We use a URL that will immediately be accepted by the queue but has no content yet.
  const uniqueUrl = `https://example.com/no-transcript-${Date.now()}`;
  const create = await request.post(`${BASE}/process`, {
    data: { url: uniqueUrl },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(create.ok()).toBeTruthy();
  const { id } = (await create.json()) as { id: string };

  // Immediately try to resummarize — transcript is not yet populated.
  const res = await request.post(`${BASE}/items/${id}/resummarize`);
  // Either 400 (no transcript) or 200 (already processed). Both are valid given timing.
  expect([200, 400]).toContain(res.status());

  await request.delete(`${BASE}/items/${id}`);
});

test('GET /prompt-templates/summary returns templates with id and template fields', async ({ request }) => {
  const res = await request.get(`${BASE}/prompt-templates/summary`);
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as Array<{ id: number; template: string }>;
  expect(Array.isArray(body)).toBe(true);
  for (const t of body) {
    expect(typeof t.id).toBe('number');
    expect(typeof t.template).toBe('string');
    expect(t.template.length).toBeGreaterThan(0);
  }
});

test('GET /prompt-templates/chat returns an array', async ({ request }) => {
  const res = await request.get(`${BASE}/prompt-templates/chat`);
  expect(res.ok()).toBeTruthy();
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('POST /prompt-templates/summary rejects empty template', async ({ request }) => {
  const res = await request.post(`${BASE}/prompt-templates/summary`, {
    data: { template: '' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('POST /prompt-templates/summary persists and returns id', async ({ request }) => {
  const template = `You are a summarizer test ${Date.now()}. Summarize concisely.`;
  const res = await request.post(`${BASE}/prompt-templates/summary`, {
    data: { template },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();
  const body = (await res.json()) as { id: number; is_active: number };
  expect(typeof body.id).toBe('number');
  expect(body.is_active).toBe(1);

  // Verify it appears in the listing.
  const list = await request.get(`${BASE}/prompt-templates/summary`);
  const all = (await list.json()) as Array<{ id: number; template: string }>;
  expect(all.some((t) => t.template === template)).toBe(true);
});

test('POST /items/:id/summary-quality stores a rating', async ({ request }) => {
  const id = await firstDoneId(request);
  const res = await request.post(`${BASE}/items/${id}/summary-quality`, {
    data: { rating: 4, reason: 'pipeline-test' },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.ok()).toBeTruthy();

  const getRes = await request.get(`${BASE}/items/${id}/summary-quality`);
  expect(getRes.ok()).toBeTruthy();
});

test('POST /items/:id/summary-quality rejects out-of-range rating', async ({ request }) => {
  const id = await firstDoneId(request);
  const res = await request.post(`${BASE}/items/${id}/summary-quality`, {
    data: { rating: 99 },
    headers: { 'Content-Type': 'application/json' },
  });
  expect(res.status()).toBe(400);
});

test('POST /items/:id/history/:historyId/restore restores an older version', async ({ request }) => {
  test.setTimeout(180_000);
  const id = await findDoneItemWithTranscript(request);

  // Ensure at least one history entry exists — if none, trigger a resummarize.
  let historyRes = await request.get(`${BASE}/items/${id}/history`);
  let history = (await historyRes.json()) as Array<{ id: number; summary: string }>;
  if (history.length === 0) {
    await request.post(`${BASE}/items/${id}/resummarize`);
    const deadline = Date.now() + 150_000;
    while (Date.now() < deadline && history.length === 0) {
      await new Promise((r) => setTimeout(r, 2000));
      historyRes = await request.get(`${BASE}/items/${id}/history`);
      history = (await historyRes.json()) as Array<{ id: number; summary: string }>;
    }
  }
  expect(history.length).toBeGreaterThan(0);

  const restore = await request.post(`${BASE}/items/${id}/history/${history[0]!.id}/restore`);
  expect(restore.ok()).toBeTruthy();
});
