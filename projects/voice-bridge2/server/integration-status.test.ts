/**
 * Integration test: daemon reads current-target from backend /status instead of tmp file.
 *
 * Root cause of overlay desync: daemon read tmp/last-target.txt via filesystem path
 * resolved at spawn time. Backend and daemon could run from different worktrees →
 * different tmp files → stale overlay target.
 *
 * Fix: daemon calls GET /status and reads the `target` field. This test verifies the
 * contract: POST /target → GET /status → target field reflects the update.
 *
 * Requires the backend to be running on localhost:3030 (it is live during development).
 */

import { describe, test, expect, beforeAll } from 'bun:test'

const BASE = 'http://localhost:3030'

function isRecord(v: unknown): v is Record<string, unknown> {
  return v !== null && typeof v === 'object' && !Array.isArray(v)
}

// Save and restore the target so this test doesn't permanently alter the live state.
let originalTarget: string | null = null

beforeAll(async () => {
  const res = await fetch(`${BASE}/status`)
  if (res.ok) {
    const body: unknown = await res.json()
    if (isRecord(body) && typeof body['target'] === 'string') {
      originalTarget = body['target']
    }
  }
})

describe('GET /status — daemon target contract', () => {
  test('backend is reachable and /status returns a target field', async () => {
    const res = await fetch(`${BASE}/status`)
    expect(res.status).toBe(200)
    expect(res.headers.get('content-type')).toMatch(/application\/json/)
    const body: unknown = await res.json()
    if (!isRecord(body)) throw new Error('Expected JSON object from /status')
    expect(typeof body['target']).toBe('string')
    expect(String(body['target']).length).toBeGreaterThan(0)
  })

  // This is the critical contract: daemon POSTs to /target then reads /status.
  // If /status does not reflect the update, the daemon sees a stale overlay target.
  test('POST /target updates the target visible via GET /status', async () => {
    const testTarget = 'integration-test-agent'

    const postRes = await fetch(`${BASE}/target`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ target: testTarget })
    })
    expect(postRes.status).toBe(200)

    const statusRes = await fetch(`${BASE}/status`)
    expect(statusRes.status).toBe(200)
    const body: unknown = await statusRes.json()
    if (!isRecord(body)) throw new Error('Expected JSON object from /status')
    expect(body['target']).toBe(testTarget)

    // Restore original target so we don't leave live state dirty
    if (originalTarget) {
      await fetch(`${BASE}/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: originalTarget })
      })
    }
  })
})
