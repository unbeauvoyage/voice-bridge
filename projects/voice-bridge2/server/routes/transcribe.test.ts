/**
 * Tests for POST /transcribe route handler.
 *
 * These tests document the intended behavior of the transcribe handler.
 * They verify the route can be imported and invoked as a standalone function,
 * and that core behaviors (form parsing, dedup, routing logic) work correctly.
 *
 * Integration tests use the real server to verify end-to-end behavior.
 */

import { describe, test, expect, beforeEach, mock } from 'bun:test'
import {
  handleTranscribe,
  type TranscribeContext,
  type DedupEntry,
  type DeliveryResult
} from './transcribe.ts'

// Default whisper mock: returns a stable transcript that won't trip
// mic-command or cancel-detection heuristics. Individual tests may
// re-mock to simulate throws / empty transcripts; beforeEach restores.
const DEFAULT_WHISPER = (): { transcribeAudio: () => Promise<string> } => ({
  transcribeAudio: async (): Promise<string> => 'hello world'
})
mock.module('../whisper.ts', DEFAULT_WHISPER)
beforeEach(() => {
  mock.module('../whisper.ts', DEFAULT_WHISPER)
})

// Build a real Request whose formData() returns the given FormData. We stub
// only `formData` on the instance because Bun/undici's native Request.formData
// requires a matching body stream; for unit tests we want the in-memory form.
function createMockRequest(body: FormData, headerMap: Record<string, string> = {}): Request {
  const req = new Request('http://localhost:3030/transcribe', {
    method: 'POST',
    headers: headerMap
  })
  Object.defineProperty(req, 'formData', { value: async () => body })
  return req
}

// Minimal context for unit tests
function createMockContext(
  overrides: Partial<TranscribeContext> = {}
): TranscribeContext {
  return {
    recentAudioHashes: new Map<string, DedupEntry>(),
    evictStaleHashes: () => {
      /* no-op for unit test */
    },
    hashAudioBuffer: (buf: Buffer) => {
      // Simple hash for testing
      return `hash-${buf.length}`
    },
    loadLastTarget: () => 'command',
    saveLastTarget: () => {
      /* no-op for unit test */
    },
    handleMicCommand: () => null,
    getKnownAgents: async () => ['command', 'test'],
    deliverMessage: async () => ({ ok: true }),
    ...overrides
  }
}

describe('transcribe route handler', () => {
  test('handler is importable and callable', async () => {
    expect(typeof handleTranscribe).toBe('function')
  })

  test('POST /transcribe returns 400 when audio field is missing', async () => {
    const formData = new FormData()
    // Empty form data — no audio field
    const req = createMockRequest(formData)
    const ctx = createMockContext()

    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(400)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['error']).toMatch(/Missing audio/)
  })

  test('POST /transcribe returns 413 when Content-Length exceeds MAX_BODY_BYTES', async () => {
    const formData = new FormData()
    const req = createMockRequest(formData, { 'content-length': String(20 * 1024 * 1024) })
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(413)
  })

  test('POST /transcribe returns 413 when audio File size exceeds cap', async () => {
    const formData = new FormData()
    const big = new Uint8Array(9 * 1024 * 1024)
    formData.append('audio', new File([big], 'big.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(413)
  })

  test('POST /transcribe returns 415 when audio MIME is not in allowlist', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'bad.exe', { type: 'application/x-msdownload' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(415)
  })

  // Stage-4 codex chunk2-review MED: blank/missing MIME used to fall through
  // via `audioFile.type || 'audio/webm'`, so a File with type=''
  // reached ffmpeg/Whisper and failed as 500. Require an explicit allowed
  // MIME at the boundary — reject blank as 415.
  test('POST /transcribe returns 415 when audio MIME is blank (no allowlist bypass)', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'blob', { type: '' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(415)
  })

  test('POST /transcribe returns 400 when `to` field exceeds MAX_TO_LEN', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    formData.append('to', 'x'.repeat(200))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(400)
  })

  // Chunk-4 HIGH (transcribe.ts:347-365): when BOTH relay AND cmux
  // delivery fail, the handler previously swallowed the error and
  // returned 200 {transcript, to, message} — CEO saw "message sent"
  // feedback for a message that was on the floor. The fix routes all
  // delivery through an injected ctx.deliverMessage whose failure
  // surfaces as 502 with {transcript, to, delivered: false, error}.
  test('POST /transcribe surfaces delivery failure (not silent 200) when all delivery channels fail', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext({
      deliverMessage: async () => ({ ok: false, error: 'relay+cmux both down' })
    })
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(502)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    // UI-preservation: the transcript MUST still be in the body so the
    // client can show the user what was heard, even though delivery failed.
    expect(obj['transcript']).toBe('hello world')
    expect(obj['delivered']).toBe(false)
    expect(obj['error']).toBe('relay+cmux both down')
  })

  // Paired positive case: successful delivery keeps the existing 200 +
  // {transcript, to, message} shape, with delivered:true added so clients
  // can branch on a single boolean.
  test('POST /transcribe returns 200 delivered=true when deliverMessage succeeds', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    formData.append('to', 'command')
    const req = createMockRequest(formData)
    const ctx = createMockContext({ deliverMessage: async () => ({ ok: true }) })
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['transcript']).toBe('hello world')
    expect(obj['delivered']).toBe(true)
  })

  // Chunk-4 HIGH (transcribe.ts:240 + error-return sites): the handler marks
  // the audio hash as { inProgress: true } before calling Whisper, but on
  // every error-return path (transcription failure, empty transcript, cancel,
  // test mode, mic command, delivery failure) that entry was never cleaned
  // up or upgraded. WKWebView retries within 30s would see inProgress:true,
  // wait DEDUP_WAIT_DEADLINE_MS, then return empty — the phone freezes in
  // "transcribing" state. The fix: delete the entry on every error/early
  // return so retries get a fresh attempt.
  test('cache entry is cleaned up when transcription fails (retries do not hang)', async () => {
    mock.module('../whisper.ts', () => ({
      transcribeAudio: async (): Promise<string> => {
        throw new Error('whisper exploded')
      }
    }))
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(500)
    // Retries must not hang on a stale inProgress entry.
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  test('cache entry is cleaned up when transcript is empty', async () => {
    mock.module('../whisper.ts', () => ({
      transcribeAudio: async (): Promise<string> => ''
    }))
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(422)
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  test('cache entry is cleaned up when transcript is a cancel command', async () => {
    mock.module('../whisper.ts', () => ({
      transcribeAudio: async (): Promise<string> => 'cancel cancel cancel'
    }))
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext()
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) Object.assign(obj, body)
    expect(obj['cancelled']).toBe(true)
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  test('cache entry is cleaned up when delivery fails (retries re-attempt delivery)', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext({
      deliverMessage: async () => ({ ok: false, error: 'relay+cmux both down' })
    })
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(502)
    // Retries must re-attempt delivery, not hang on the stale inProgress entry.
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  // Chunk-4 #4 MED (transcribe.ts:353): the dedup entry was promoted
  // from {inProgress:true} to a resolved {transcript,to,message} BEFORE
  // delivery completed. A duplicate arriving mid-delivery read the
  // resolved entry and returned deduplicated:true, skipping delivery; if
  // the original then failed delivery, the retry's chance at delivery
  // was already consumed. Fix: keep the entry as {inProgress:true} until
  // AFTER delivery succeeds, so a failing delivery path clears it and
  // retries get a real delivery attempt.
  test('duplicate arriving mid-delivery does NOT short-circuit when original delivery fails', async () => {
    // Simulate: original request is in-flight with a slow (and eventually
    // failing) deliverMessage. Mid-flight, a duplicate arrives — it must
    // see inProgress (not a resolved cache entry) and, once the original
    // fails, the cache entry must be gone so a subsequent retry runs
    // delivery again rather than returning deduplicated:true.
    let resolveDelivery: (v: DeliveryResult) => void = () => {}
    const deliveryPromise = new Promise<DeliveryResult>((r) => {
      resolveDelivery = r
    })
    const ctx = createMockContext({
      deliverMessage: () => deliveryPromise
    })

    const form1 = new FormData()
    form1.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req1 = createMockRequest(form1)

    // Start original request but don't await — it blocks on deliveryPromise.
    const originalPromise = handleTranscribe(req1, ctx)

    // Give the handler a tick to reach the pre-delivery cache promotion point.
    await Bun.sleep(10)

    // At this moment the cache entry MUST still be {inProgress:true} — a
    // duplicate arriving now must NOT receive a resolved cached
    // {transcript,to,message} response.
    const entry = Array.from(ctx.recentAudioHashes.values())[0]
    expect(entry).toBeDefined()
    expect(entry && 'inProgress' in entry).toBe(true)

    // Now fail delivery. Original should clear the cache on its way out.
    resolveDelivery({ ok: false, error: 'relay+cmux both down' })
    const originalRes = await originalPromise
    expect(originalRes.status).toBe(502)
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  test('POST /transcribe returns 400 when form data is invalid', async () => {
    // Simulate invalid form data parsing
    const req = new Request('http://localhost:3030/transcribe', { method: 'POST' })
    Object.defineProperty(req, 'formData', {
      value: async () => {
        throw new Error('Invalid form data')
      }
    })
    const ctx = createMockContext()

    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(400)
    const body: unknown = await res.json()
    const obj: Record<string, unknown> = {}
    if (typeof body === 'object' && body !== null) {
      Object.assign(obj, body)
    }
    expect(obj['error']).toMatch(/Invalid form data/)
  })
})
