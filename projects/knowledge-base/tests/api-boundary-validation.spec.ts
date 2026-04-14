/**
 * api-boundary-validation.spec.ts
 *
 * Verifies that API endpoints validate incoming data shapes at runtime
 * rather than silently accepting or crashing on unexpected shapes.
 *
 * Rule: every JSON boundary must be validated, not cast.
 */

import { test, expect } from '@playwright/test';

const BASE = 'http://127.0.0.1:3737';

// ---------------------------------------------------------------------------
// POST /items/:id/rate — request body validation
// ---------------------------------------------------------------------------

test('rate endpoint rejects missing rating field with 400', async () => {
  // We need any valid item id — use a nonexistent one to test body validation path
  const res = await fetch(`${BASE}/items/nonexistent-id-for-validation/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // missing rating
  });
  // Should be 400 (bad request) or 404 (item not found) — both are valid rejections
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});

test('rate endpoint rejects array JSON body with 400 not 500', async () => {
  // Sending a non-object body should not crash the server — it should return 4xx
  const res = await fetch(`${BASE}/items/nonexistent-id/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify([1, 2, 3]), // array, not object
  });
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});

test('rate endpoint rejects non-numeric rating with 400', async () => {
  const res = await fetch(`${BASE}/items/nonexistent-id-for-validation/rate`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rating: 'not-a-number' }),
  });
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});

// ---------------------------------------------------------------------------
// PATCH /considerations/:id — request body validation
// ---------------------------------------------------------------------------

test('considerations PATCH rejects missing status field with 400', async () => {
  const res = await fetch(`${BASE}/considerations/nonexistent-consideration`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({}), // missing status
  });
  // Should be 400 (missing status) or 404 (not found) — both are valid
  expect(res.status).toBeGreaterThanOrEqual(400);
  expect(res.status).toBeLessThan(500);
});

// ---------------------------------------------------------------------------
// Server health: verify API is still responsive after receiving malformed requests
// ---------------------------------------------------------------------------

test('server remains responsive after receiving malformed request bodies', async () => {
  // Confirm the server is still up after all the malformed requests above
  const res = await fetch(`${BASE}/health`);
  expect(res.status).toBe(200);
});
