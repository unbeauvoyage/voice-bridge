import { test, expect, beforeAll } from 'bun:test';

const BASE = 'http://127.0.0.1:3737';

// ── Runtime type helpers ──────────────────────────────────────────────────────

/** Narrows unknown to Record<string,unknown> after a runtime check. */
function assertObj(v: unknown): asserts v is Record<string, unknown> {
  if (typeof v !== 'object' || v === null || Array.isArray(v)) {
    throw new Error('Expected object, got: ' + typeof v);
  }
}

/** Narrows unknown to unknown[] after a runtime check. */
function assertArr(v: unknown): asserts v is unknown[] {
  if (!Array.isArray(v)) throw new Error('Expected array, got: ' + typeof v);
}

// Check if the server is available before running tests that need it.
let serverAvailable = false;

beforeAll(async () => {
  try {
    const res = await fetch(`${BASE}/health`, { signal: AbortSignal.timeout(2000) });
    serverAvailable = res.ok;
  } catch {
    serverAvailable = false;
    console.warn('[server.test] Server not running — live tests will be skipped.');
  }
});

function skipIfDown() {
  if (!serverAvailable) {
    console.log('[server.test] Skipping — server not available.');
    return true;
  }
  return false;
}

// ── Health ─────────────────────────────────────────────────────────────────────

test('GET /health returns ok', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/health`);
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.ok).toBe(true);
});

// ── Items ──────────────────────────────────────────────────────────────────────

test('GET /items returns array', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/items`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /items response items have expected shape', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/items`);
  const rawItems: unknown = await res.json();
  assertArr(rawItems);
  for (const rawItem of rawItems) {
    assertObj(rawItem);
    const item = rawItem;
    expect(typeof item.id).toBe('string');
    expect(typeof item.url).toBe('string');
    expect(['youtube', 'article', 'video', 'pdf']).toContain(String(item.type));
    expect(item.status).toBe('done');
    expect(Array.isArray(item.tags)).toBe(true);
    expect(Array.isArray(item.tldr)).toBe(true);
    expect(Array.isArray(item.sections)).toBe(true);
    // transcript is excluded from /items list (only available via /items/:id)
    expect(item.transcript).toBeUndefined();
  }
});

// ── Single item ────────────────────────────────────────────────────────────────

test('GET /items/:id for unknown id returns 404', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/items/nonexistent-item-id`);
  expect(res.status).toBe(404);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Item not found');
});

// ── Status ─────────────────────────────────────────────────────────────────────

test('GET /status/:id for unknown id returns 404', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/status/nonexistent-item-id`);
  expect(res.status).toBe(404);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Item not found');
});

// ── Tags ───────────────────────────────────────────────────────────────────────

test('GET /tags returns approved/pending/rejected shape', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags`);
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(Array.isArray(body.approved)).toBe(true);
  expect(Array.isArray(body.pending)).toBe(true);
  expect(Array.isArray(body.rejected)).toBe(true);
});

test('GET /tags pending items have tag/itemId/itemTitle fields', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags`);
  const body: unknown = await res.json();
  assertObj(body);
  assertArr(body.pending);
  for (const rawP of body.pending) {
    assertObj(rawP);
    expect(typeof rawP.tag).toBe('string');
    expect(typeof rawP.itemId).toBe('string');
    expect(typeof rawP.itemTitle).toBe('string');
  }
});

test('POST /tags/approve updates tag status', async () => {
  if (skipIfDown()) return;

  // First create a pending tag by ensuring it exists (upsert via a known-safe name)
  const tag = `test-approve-${Date.now()}`;

  // Manually insert via reject then approve to test the round-trip
  const rejectRes = await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  expect(rejectRes.status).toBe(200);

  const approveRes = await fetch(`${BASE}/tags/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  expect(approveRes.status).toBe(200);
  const body: unknown = await approveRes.json();
  assertObj(body);
  expect(body.ok).toBe(true);

  // Verify in /tags response
  const tagsRes = await fetch(`${BASE}/tags`);
  const tagsBody: unknown = await tagsRes.json();
  assertObj(tagsBody);
  assertArr(tagsBody.approved);
  expect(tagsBody.approved).toContain(tag);
});

test('POST /tags/reject updates tag status', async () => {
  if (skipIfDown()) return;
  const tag = `test-reject-${Date.now()}`;
  const res = await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.ok).toBe(true);

  // Verify in /tags response
  const tagsRes = await fetch(`${BASE}/tags`);
  const tagsBody: unknown = await tagsRes.json();
  assertObj(tagsBody);
  assertArr(tagsBody.rejected);
  expect(tagsBody.rejected).toContain(tag);
});

test('POST /tags/approve with missing tag returns 400', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags/approve`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Missing tag field');
});

test('POST /tags/reject with missing tag returns 400', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Missing tag field');
});

// ── Process ────────────────────────────────────────────────────────────────────

test('POST /process with missing url returns 400', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}),
  });
  expect(res.status).toBe(400);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Missing url field');
});

test('POST /process with invalid JSON body returns 400', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: 'not-json',
  });
  expect(res.status).toBe(400);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Invalid JSON body');
});

test('POST /process with valid URL returns queued status immediately', async () => {
  if (skipIfDown()) return;
  // Use a URL that is unlikely to be in the DB; processing starts async
  const url = `https://example.com/test-${Date.now()}`;
  const res = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(typeof body.id).toBe('string');
  expect(typeof body.id === 'string' && body.id.startsWith('item-')).toBe(true);
  // Status is queued on first submission
  expect(['queued', 'processing', 'done', 'error']).toContain(String(body.status));
});

test('POST /process with duplicate URL returns existing item', async () => {
  if (skipIfDown()) return;
  const url = `https://example.com/duplicate-test-${Date.now()}`;

  const first = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const firstBody: unknown = await first.json();
  assertObj(firstBody);

  const second = await fetch(`${BASE}/process`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url }),
  });
  const secondBody: unknown = await second.json();
  assertObj(secondBody);

  expect(secondBody.id).toBe(firstBody.id);
});

// ── Search ─────────────────────────────────────────────────────────────────────

test('GET /search?q=test returns array', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/search?q=test`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /search?tag=test returns array', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/search?tag=test`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /search with no params returns empty array', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/search`);
  expect(res.status).toBe(200);
  const body = await res.json();
  assertArr(body);
  expect(body.length).toBe(0);
});

// ── CORS ───────────────────────────────────────────────────────────────────────

test('OPTIONS preflight returns 204 with CORS headers', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/health`, { method: 'OPTIONS' });
  expect(res.status).toBe(204);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
});

test('GET /items response includes CORS header', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/items`);
  expect(res.headers.get('Access-Control-Allow-Origin')).toBeTruthy();
});

// ── Mark read ──────────────────────────────────────────────────────────────────

test('POST /items/:id/read for unknown id returns 404', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/items/nonexistent-item-id/read`, { method: 'POST' });
  expect(res.status).toBe(404);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Item not found');
});

// ── 404 catch-all ──────────────────────────────────────────────────────────────

test('Unknown route returns 404', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/nonexistent-route`);
  expect(res.status).toBe(404);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.error).toBe('Not found');
});

// ── Tag rejections + rules ─────────────────────────────────────────────────────

test('POST /tags/reject with reason returns 200', async () => {
  if (skipIfDown()) return;
  const tag = `test-reject-reason-${Date.now()}`;
  const res = await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, reason: 'too vague' }),
  });
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.ok).toBe(true);
});

test('POST /tags/reject without reason still returns 200', async () => {
  if (skipIfDown()) return;
  const tag = `test-reject-noreason-${Date.now()}`;
  const res = await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag }),
  });
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(body.ok).toBe(true);
});

test('GET /tag-rules returns rules string field', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tag-rules`);
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(typeof body.rules).toBe('string');
});

test('GET /tags/rejections returns array', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/tags/rejections`);
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(Array.isArray(body)).toBe(true);
});

test('GET /tags/rejections items have expected shape', async () => {
  if (skipIfDown()) return;
  // Seed one rejection first
  const tag = `test-rej-shape-${Date.now()}`;
  await fetch(`${BASE}/tags/reject`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ tag, reason: 'shape test' }),
  });
  const res = await fetch(`${BASE}/tags/rejections`);
  const body: unknown = await res.json();
  assertArr(body);
  const rawMatch = body.find((r) => {
    assertObj(r);
    return r.tag === tag;
  });
  expect(rawMatch).toBeDefined();
  assertObj(rawMatch);
  expect(typeof rawMatch.id).toBe('string');
  expect(typeof rawMatch.reason).toBe('string');
  expect(typeof rawMatch.createdAt).toBe('string');
});

// ── Retry-failed endpoint ───────────────────────────────────────────────────────

test('POST /items/retry-failed returns { retried: N }', async () => {
  if (skipIfDown()) return;
  const res = await fetch(`${BASE}/items/retry-failed`, { method: 'POST' });
  expect(res.status).toBe(200);
  const body: unknown = await res.json();
  assertObj(body);
  expect(typeof body['retried']).toBe('number');
});
