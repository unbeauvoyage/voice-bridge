/**
 * Tests for server/routes/dedup.ts — dedup entry resolution and hallucination filter.
 *
 * Covers:
 *   - checkDedupEntry: all outcome branches of the inProgress wait loop
 *     (resolved, cancelled, deleted/fallthrough, timeout/409)
 *   - checkDedupEntry: direct handling of already-cancelled and already-resolved entries
 *   - isWhisperHallucination: known phrases vs unknown, RMS threshold
 *
 * transcribe.test.ts covers the timeout/409 and deleted/fallthrough paths via
 * the full handleTranscribe integration. This file tests checkDedupEntry
 * directly to document every branch of the discriminated-union state machine.
 */

import { describe, test, expect } from 'bun:test'
import { checkDedupEntry, isWhisperHallucination, type DedupEntry } from './dedup.ts'

const CORS = { 'Access-Control-Allow-Origin': '*' }

// ---------------------------------------------------------------------------
// checkDedupEntry — already-resolved (to in existing) branch
// ---------------------------------------------------------------------------
//
// When the first request completed successfully, the dedup map holds a
// resolved entry { ts, transcript, to, message }. Duplicates must return
// the cached result immediately without re-running whisper or delivery.

describe('checkDedupEntry — already-resolved entry (no wait needed)', () => {
  test('returns a cached 200 with deduplicated:true for an already-resolved entry', async () => {
    const existing: DedupEntry = {
      ts: Date.now(),
      transcript: 'hello world',
      to: 'command',
      message: 'hello world'
    }
    const map = new Map<string, DedupEntry>([['hash1', existing]])
    const result = await checkDedupEntry(existing, 'hash1', map, 1000, CORS)

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    expect(result.response.status).toBe(200)
    const body: unknown = await result.response.json()
    const obj = body as Record<string, unknown>
    expect(obj['transcript']).toBe('hello world')
    expect(obj['to']).toBe('command')
    expect(obj['deduplicated']).toBe(true)
    // Must NOT include a cancelled flag — this is a successful resolution
    expect(obj['cancelled']).toBeUndefined()
  })

  test('returned response includes CORS headers', async () => {
    const existing: DedupEntry = { ts: Date.now(), transcript: 'test', to: 'atlas', message: 'test' }
    const map = new Map<string, DedupEntry>([['h', existing]])
    const result = await checkDedupEntry(existing, 'h', map, 1000, CORS)
    if (result.kind !== 'response') throw new Error('expected response')
    expect(result.response.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// ---------------------------------------------------------------------------
// checkDedupEntry — already-cancelled entry
// ---------------------------------------------------------------------------
//
// When the first request was a Whisper hallucination, the map entry becomes
// { ts, cancelled: true, transcript }. Duplicates must return the cached
// cancellation without re-running Whisper (which would hallucinate again).

describe('checkDedupEntry — already-cancelled entry (hallucination cached)', () => {
  test('returns cached cancelled result without re-running whisper', async () => {
    const existing: DedupEntry = { ts: Date.now(), cancelled: true, transcript: 'hello' }
    const map = new Map<string, DedupEntry>([['hash2', existing]])
    const result = await checkDedupEntry(existing, 'hash2', map, 1000, CORS)

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    const body = await result.response.json() as Record<string, unknown>
    expect(body['cancelled']).toBe(true)
    expect(body['reason']).toBe('whisper-hallucination')
    expect(body['deduplicated']).toBe(true)
    expect(body['transcript']).toBe('hello')
  })
})

// ---------------------------------------------------------------------------
// checkDedupEntry — inProgress wait loop: cancelled outcome
// ---------------------------------------------------------------------------
//
// Duplicate arrives while the original is still transcribing. The waiter
// polls every 300ms. When the original detects a hallucination it upgrades
// the entry to { cancelled, transcript } — the waiter must pick that up
// and return the cached cancellation (not re-run whisper).

describe('checkDedupEntry — inProgress wait: original becomes cancelled', () => {
  test('returns cached cancelled when original upgrades entry to cancelled mid-wait', async () => {
    const map = new Map<string, DedupEntry>([
      ['h3', { ts: Date.now(), inProgress: true }]
    ])
    const existing = map.get('h3')!

    // After ~350ms (> one 300ms poll), upgrade the entry to cancelled
    setTimeout(() => {
      map.set('h3', { ts: Date.now(), cancelled: true, transcript: 'thank you' })
    }, 350)

    const result = await checkDedupEntry(existing, 'h3', map, 2000, CORS)

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    const body = await result.response.json() as Record<string, unknown>
    expect(body['cancelled']).toBe(true)
    expect(body['reason']).toBe('whisper-hallucination')
    expect(body['deduplicated']).toBe(true)
    expect(body['transcript']).toBe('thank you')
  })
})

// ---------------------------------------------------------------------------
// checkDedupEntry — inProgress wait loop: resolved outcome
// ---------------------------------------------------------------------------
//
// Duplicate waits while the original transcribes. Original succeeds and
// upgrades the entry to a resolved { transcript, to, message } shape.
// The waiter must detect the upgrade and return the cached result.

describe('checkDedupEntry — inProgress wait: original resolves successfully', () => {
  test('returns cached resolved result when original completes mid-wait', async () => {
    const map = new Map<string, DedupEntry>([
      ['h4', { ts: Date.now(), inProgress: true }]
    ])
    const existing = map.get('h4')!

    // After ~350ms, simulate the original completing delivery
    setTimeout(() => {
      map.set('h4', { ts: Date.now(), transcript: 'fix the bug', to: 'atlas', message: 'fix the bug' })
    }, 350)

    const result = await checkDedupEntry(existing, 'h4', map, 2000, CORS)

    expect(result.kind).toBe('response')
    if (result.kind !== 'response') return
    const body = await result.response.json() as Record<string, unknown>
    expect(body['transcript']).toBe('fix the bug')
    expect(body['to']).toBe('atlas')
    expect(body['deduplicated']).toBe(true)
    expect(body['cancelled']).toBeUndefined()
  })
})

// ---------------------------------------------------------------------------
// checkDedupEntry — inProgress wait loop: deleted/fallthrough outcome
// ---------------------------------------------------------------------------
//
// Original request fails mid-flight and deletes its cache entry. The waiter
// must detect the deletion and return { kind: 'fallthrough' } so the caller
// (handleTranscribe) re-runs whisper for this duplicate rather than returning
// a blank success.

describe('checkDedupEntry — inProgress wait: original fails (entry deleted)', () => {
  test('returns fallthrough when entry is deleted mid-wait (original failed)', async () => {
    const map = new Map<string, DedupEntry>([
      ['h5', { ts: Date.now(), inProgress: true }]
    ])
    const existing = map.get('h5')!

    // After ~350ms, simulate the original failing and deleting its entry
    setTimeout(() => {
      map.delete('h5')
    }, 350)

    const result = await checkDedupEntry(existing, 'h5', map, 2000, CORS)
    // Fallthrough: the duplicate should re-attempt transcription and delivery
    expect(result.kind).toBe('fallthrough')
  })
})

// ---------------------------------------------------------------------------
// isWhisperHallucination
// ---------------------------------------------------------------------------
//
// These tests are already partially covered via transcribe.test.ts integration
// tests. Direct unit tests here document the exact phrase/RMS matching logic.

describe('isWhisperHallucination', () => {
  test('returns true for a known hallucination phrase with low RMS', () => {
    // "hello" is in WHISPER_HALLUCINATION_PHRASES; RMS 10 < threshold 500
    expect(isWhisperHallucination('hello', 10)).toBe(true)
  })

  test('returns false for a known phrase when RMS is above threshold', () => {
    // Genuine "hello" spoken loudly — do not suppress, RMS 5000 > 500
    expect(isWhisperHallucination('hello', 5000)).toBe(false)
  })

  test('returns false for an unknown transcript even with low RMS', () => {
    // Only known phrases are suppressed; arbitrary low-signal audio is passed through
    expect(isWhisperHallucination('deploy the service', 5)).toBe(false)
  })

  test('strips punctuation before matching — "Hello." matches "hello"', () => {
    // The normaliser removes punctuation via /[^\w\s]/g before checking the set
    expect(isWhisperHallucination('Hello.', 10)).toBe(true)
  })

  test('is case-insensitive — "Thank You" matches "thank you"', () => {
    expect(isWhisperHallucination('Thank You', 10)).toBe(true)
  })

  test('matches "bye" with low RMS', () => {
    expect(isWhisperHallucination('bye', 0)).toBe(true)
  })

  test('does NOT match partial phrases — "say hello" is not suppressed', () => {
    // The full normalised transcript must match the phrase, not a substring
    expect(isWhisperHallucination('say hello', 0)).toBe(false)
  })
})
