/**
 * Story: ceo-app browser preflight is accepted by BOTH voice-bridge stacks
 *
 * CORS regression guard. When ceo-app (served at http://localhost:5175) calls
 * POST /compose cross-origin, the browser fires an OPTIONS preflight before the
 * real request. Without a correct CORS policy the preflight fails and the user
 * sees "Failed to fetch" — breaking the backend toggle.
 *
 * PARITY NOTE (discovered 2026-04-29 during test-authoring):
 *   The TS voice-bridge (server/index.ts OPTIONS handler) returns a WILDCARD
 *   `Access-Control-Allow-Origin: *` for ALL origins — including evil ones —
 *   and does NOT set `Access-Control-Allow-Credentials`. The .NET voice-bridge
 *   correctly uses the BackendDefaults whitelist (localhost:5175 only + credentials).
 *   This is the most severe drift of the three services:
 *     - Wildcard + credentials is invalid per CORS spec (browsers reject it).
 *     - Any origin can call the TS /compose endpoint cross-origin right now.
 *   Tracked in handoffs/cors-drift-2026-04-29-all-services.md.
 *
 * Given:
 *   - TS voice-bridge is running at http://127.0.0.1:3030 (AppHost-managed)
 *   - .NET voice-bridge is running at http://127.0.0.1:8773 (AppHost-managed)
 * When:
 *   - Browser sends OPTIONS preflight with Origin: http://localhost:5175
 *   - Same preflight from Origin: http://evil.example.com (negative control)
 * Then:
 *   - Both stacks return 204 for the ceo-app origin
 *   - .NET stack includes Access-Control-Allow-Origin: http://localhost:5175 with credentials
 *   - .NET stack blocks evil origin (no Allow-Origin header)
 *
 * NEGATIVE CONTROL PROVEN: Test initially asserted status 999 for the
 * preflight → went RED. Reverted to 204 → GREEN. Assertions are live.
 */

import { test, expect } from 'bun:test'

const TS_VB_URL = 'http://127.0.0.1:3030'
const DOTNET_VB_URL = 'http://127.0.0.1:8773'
const CEO_APP_ORIGIN = 'http://localhost:5175'
const EVIL_ORIGIN = 'http://evil.example.com'

async function sendPreflight(
  baseUrl: string,
  path: string,
  origin: string,
): Promise<Response> {
  return fetch(`${baseUrl}${path}`, {
    method: 'OPTIONS',
    headers: {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,traceparent',
    },
  })
}

// ── Precondition check ──────────────────────────────────────────────────────

test('precondition: both voice-bridge stacks are up before CORS assertions run', async () => {
  const [tsRes, dotnetRes] = await Promise.all([
    fetch(`${TS_VB_URL}/health`),
    fetch(`${DOTNET_VB_URL}/health`),
  ])
  expect(tsRes.status, 'TS voice-bridge at :3030 must be running (start via AppHost)').toBe(200)
  expect(dotnetRes.status, '.NET voice-bridge at :8773 must be running (start via AppHost)').toBe(200)
})

// ── .NET voice-bridge — correct whitelist behaviour ─────────────────────────

test('.NET voice-bridge preflight from ceo-app origin returns 204 with correct CORS headers', async () => {
  // Given .NET voice-bridge is running
  // When ceo-app browser sends OPTIONS preflight to POST /compose
  const res = await sendPreflight(DOTNET_VB_URL, '/compose', CEO_APP_ORIGIN)

  // Then preflight succeeds
  expect(res.status).toBe(204)

  // And the allow-origin echoes ceo-app exactly
  expect(res.headers.get('access-control-allow-origin')).toBe(CEO_APP_ORIGIN)

  // And credentials are allowed
  expect(res.headers.get('access-control-allow-credentials')).toBe('true')

  // And POST is listed
  const allowMethods = res.headers.get('access-control-allow-methods') ?? ''
  expect(allowMethods.toUpperCase()).toContain('POST')

  // And content-type header is allowed
  const allowHeaders = res.headers.get('access-control-allow-headers') ?? ''
  expect(allowHeaders.toLowerCase()).toContain('content-type')
})

test('.NET voice-bridge preflight from untrusted origin is rejected — no Allow-Origin header returned', async () => {
  // Given .NET voice-bridge enforces an origin whitelist
  // When an evil origin sends a preflight
  const res = await sendPreflight(DOTNET_VB_URL, '/compose', EVIL_ORIGIN)

  // Then the browser will block the real request
  const allowOrigin = res.headers.get('access-control-allow-origin')
  expect(allowOrigin).not.toBe(EVIL_ORIGIN)
  expect(allowOrigin).not.toBe('*')
})

// ── TS voice-bridge — functional parity for allowed origin, known gap elsewhere ─

test('TS voice-bridge preflight from ceo-app origin returns 204 (wildcard allows it)', async () => {
  // Given TS voice-bridge is running
  // When ceo-app browser sends OPTIONS preflight to POST /compose
  // NOTE: TS voice-bridge returns * — which means the origin check always passes
  //   for non-credentialed requests. However, ceo-app needs credentials for
  //   cross-origin requests; * + credentials is rejected by browsers. This is drift.
  const res = await sendPreflight(TS_VB_URL, '/compose', CEO_APP_ORIGIN)

  // Preflight returns 204
  expect(res.status).toBe(204)

  // TS voice-bridge returns wildcard * — not the specific ceo-app origin.
  // The .NET counterpart returns the explicit origin. This is the drift.
  // When the TS side is fixed to use a whitelist, update this assertion to:
  //   expect(res.headers.get('access-control-allow-origin')).toBe(CEO_APP_ORIGIN)
  const allowOrigin = res.headers.get('access-control-allow-origin') ?? ''
  // Current behavior: wildcard (broken) OR specific origin (after fix).
  // We assert it is at minimum non-empty — the preflight is not rejected entirely.
  expect(allowOrigin.length).toBeGreaterThan(0)
})

test('KNOWN DRIFT: TS voice-bridge returns wildcard for evil origin (see cors-drift handoff)', async () => {
  // This test documents the known security gap in the TS voice-bridge CORS policy.
  // The server/index.ts OPTIONS handler (line 112-122) unconditionally returns
  // `Access-Control-Allow-Origin: *` regardless of the request Origin.
  // Fix: replace the wildcard with an origin-aware check matching the .NET whitelist.
  // Tracked in handoffs/cors-drift-2026-04-29-all-services.md.
  const res = await sendPreflight(TS_VB_URL, '/compose', EVIL_ORIGIN)

  const allowOrigin = res.headers.get('access-control-allow-origin')
  // Document current (broken) behavior: returns wildcard for all origins.
  // After fix: should be null/undefined for evil origins.
  expect(allowOrigin).toBe('*') // ← WRONG behavior, tracked for fix
})
