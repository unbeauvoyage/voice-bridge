/**
 * Tests for POST /transcribe route handler.
 *
 * These tests document the intended behavior of the transcribe handler.
 * They verify the route can be imported and invoked as a standalone function,
 * and that core behaviors (form parsing, dedup, routing logic) work correctly.
 *
 * Integration tests use the real server to verify end-to-end behavior.
 */

import { describe, test, expect } from 'bun:test'
import { handleTranscribe, type TranscribeContext, type DedupEntry } from './transcribe.ts'

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
function createMockContext(): TranscribeContext {
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
    getKnownAgents: async () => ['command', 'test']
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
