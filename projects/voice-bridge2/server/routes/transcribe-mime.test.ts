/**
 * MIME allowlist coverage — every accepted audio MIME type must parse
 * without a 415 error. This suite is the regression guard for the
 * "Unsupported audio MIME: video/webm" class of bugs:
 *
 *   - CEO lost 8 hours because Chrome MediaRecorder sends video/webm
 *     for audio-only recordings and the allowlist didn't include it.
 *   - Any MIME removed from the allowlist immediately breaks this suite.
 *   - Any new MIME added to the allowlist should be added here too.
 *
 * Tests use a stub TranscribeContext so Whisper is never invoked —
 * we only verify the parse layer accepts the MIME and routes to
 * transcription, not the transcription result itself.
 */

import { describe, test, expect } from 'bun:test'
import { handleTranscribe, type TranscribeContext, type DedupEntry } from './transcribe.ts'
import type { LlmRouteResult } from '../llmRouter.ts'

// Minimal stub that succeeds for every valid parse → lets us assert HTTP 200.
function stubCtx(overrides: Partial<TranscribeContext> = {}): TranscribeContext {
  return {
    recentAudioHashes: new Map<string, DedupEntry>(),
    evictStaleHashes: () => {
      /* no-op */
    },
    hashAudioBuffer: (buf: Buffer) => `hash-${buf.length}-${Math.random()}`,
    loadLastTarget: () => 'command',
    saveLastTarget: () => {
      /* no-op */
    },
    handleMicCommand: () => null,
    getKnownAgents: async () => ['command'],
    deliverMessage: async () => ({ ok: true }),
    transcribeAudio: async () => ({ transcript: 'hello world', audioRms: 10000 }),
    llmRoute: async (_t: string, _a: string[], fallback: string): Promise<LlmRouteResult> => ({
      agent: fallback,
      message: _t,
      agentChanged: false
    }),
    ...overrides
  }
}

function makeReq(audioMime: string, sizeBytes = 512): Request {
  const form = new FormData()
  form.append('audio', new File([new Uint8Array(sizeBytes)], 'recording', { type: audioMime }))
  form.append('to', 'command')
  const req = new Request('http://localhost:3030/transcribe', { method: 'POST' })
  Object.defineProperty(req, 'formData', { value: async () => form })
  return req
}

// The complete MIME allowlist from transcribe-parse.ts.
// Keep this in sync with ALLOWED_AUDIO_MIME — if you add a MIME there, add it here.
const ALLOWED_MIMES: Array<{ mime: string; label: string }> = [
  { mime: 'audio/webm', label: 'audio/webm (standard Chrome/Firefox)' },
  { mime: 'audio/ogg', label: 'audio/ogg (Firefox native)' },
  { mime: 'audio/wav', label: 'audio/wav (uncompressed)' },
  { mime: 'audio/x-wav', label: 'audio/x-wav (x- variant)' },
  { mime: 'audio/mp4', label: 'audio/mp4 (Safari)' },
  { mime: 'audio/mpeg', label: 'audio/mpeg (MP3)' },
  { mime: 'audio/aac', label: 'audio/aac (AAC)' },
  { mime: 'audio/x-aac', label: 'audio/x-aac (x- variant)' },
  { mime: 'audio/flac', label: 'audio/flac (lossless)' },
  { mime: 'audio/m4a', label: 'audio/m4a (iOS native)' },
  { mime: 'audio/x-m4a', label: 'audio/x-m4a (iOS x- variant)' },
  { mime: 'video/webm', label: 'video/webm (Chrome MediaRecorder audio-only — THE REGRESSION)' }
]

const BLOCKED_MIMES: Array<{ mime: string; label: string }> = [
  { mime: 'application/x-msdownload', label: 'application/x-msdownload (exe)' },
  { mime: 'application/octet-stream', label: 'application/octet-stream (generic binary)' },
  { mime: 'text/plain', label: 'text/plain' },
  { mime: 'image/png', label: 'image/png' },
  { mime: '', label: 'blank MIME (no type set)' }
]

describe('MIME allowlist — all accepted types must parse to 200', () => {
  for (const { mime, label } of ALLOWED_MIMES) {
    test(`accepts ${label}`, async () => {
      const res = await handleTranscribe(makeReq(mime), stubCtx())
      // Any 2xx is a pass — 200 delivered, or 422 empty-transcript if whisper
      // stub returns empty (it doesn't here). A 415 is the regression we guard.
      expect(res.status).not.toBe(415)
      expect(res.status).toBeLessThan(500)
    })
  }
})

describe('MIME blocklist — rejected types must return 415', () => {
  for (const { mime, label } of BLOCKED_MIMES) {
    test(`rejects ${label}`, async () => {
      const res = await handleTranscribe(makeReq(mime), stubCtx())
      expect(res.status).toBe(415)
    })
  }
})

describe('video/webm regression — Chrome audio-only recording path', () => {
  // This is the exact failure the CEO experienced for 8 hours.
  // Keep this test prominent so future engineers understand the history.
  test('video/webm returns 200 and delivers transcript (not 415)', async () => {
    const deliverCalls: Array<{ message: string; to: string }> = []
    const ctx = stubCtx({
      deliverMessage: async (message, to) => {
        deliverCalls.push({ message, to })
        return { ok: true }
      }
    })
    const res = await handleTranscribe(makeReq('video/webm'), ctx)
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> =
      typeof body === 'object' && body !== null
        ? (() => {
            const o: Record<string, unknown> = {}
            Object.assign(o, body)
            return o
          })()
        : {}
    expect(obj['delivered']).toBe(true)
    expect(obj['transcript']).toBe('hello world')
    expect(deliverCalls.length).toBe(1)
  })

  test('video/webm with transcribe_only=1 returns transcript without delivery', async () => {
    const deliverCalls: string[] = []
    const ctx = stubCtx({
      deliverMessage: async (msg) => {
        deliverCalls.push(msg)
        return { ok: true }
      }
    })
    const form = new FormData()
    form.append('audio', new File([new Uint8Array(512)], 'recording', { type: 'video/webm' }))
    form.append('transcribe_only', '1')
    const req = new Request('http://localhost:3030/transcribe', { method: 'POST' })
    Object.defineProperty(req, 'formData', { value: async () => form })

    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    const obj =
      typeof body === 'object' && body !== null
        ? (() => {
            const o: Record<string, unknown> = {}
            Object.assign(o, body)
            return o
          })()
        : {}
    expect(obj['transcript']).toBe('hello world')
    // transcribe_only — no relay delivery
    expect(deliverCalls.length).toBe(0)
  })
})
