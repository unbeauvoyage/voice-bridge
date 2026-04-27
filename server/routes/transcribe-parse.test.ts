/**
 * Anchor test — parseTranscribeRequest sub-module.
 *
 * Written BEFORE the refactor to pin the current behavior of request parsing
 * as a standalone concern. If this test file imports succeed and all tests
 * pass, the extraction was clean with no regressions.
 *
 * These tests will FAIL until transcribe-parse.ts is created (red→green TDD).
 */

import { describe, test, expect } from 'bun:test'

// These imports will fail until the file exists — intentionally red.
import { parseTranscribeRequest } from './transcribe-parse.ts'

describe('parseTranscribeRequest: request body parsing concern', () => {
  // Helper to make a bare Request with a stubbed formData
  function makeReq(formData: FormData, headers: Record<string, string> = {}): Request {
    const req = new Request('http://localhost:3030/transcribe', {
      method: 'POST',
      headers
    })
    Object.defineProperty(req, 'formData', { value: async () => formData })
    return req
  }

  test('returns 413 error when Content-Length header exceeds MAX_BODY_BYTES', async () => {
    const form = new FormData()
    const req = makeReq(form, { 'content-length': String(20 * 1024 * 1024) })
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(413)
    }
  })

  test('returns 400 error when formData is invalid', async () => {
    const req = new Request('http://localhost:3030/transcribe', { method: 'POST' })
    Object.defineProperty(req, 'formData', {
      value: async () => {
        throw new Error('bad form')
      }
    })
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(400)
    }
  })

  test('returns 400 error when `to` field exceeds MAX_TO_LEN', async () => {
    const form = new FormData()
    form.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    form.append('to', 'x'.repeat(200))
    const req = makeReq(form)
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(400)
    }
  })

  test('returns 400 error when audio field is missing', async () => {
    const form = new FormData()
    const req = makeReq(form)
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(400)
    }
  })

  test('returns 413 error when audio file exceeds MAX_AUDIO_BYTES', async () => {
    const form = new FormData()
    form.append(
      'audio',
      new File([new Uint8Array(9 * 1024 * 1024)], 'big.webm', { type: 'audio/webm' })
    )
    const req = makeReq(form)
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(413)
    }
  })

  test('returns 415 error when audio MIME is not in allowlist', async () => {
    const form = new FormData()
    form.append(
      'audio',
      new File([new Uint8Array(100)], 'bad.exe', { type: 'application/x-msdownload' })
    )
    const req = makeReq(form)
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(415)
    }
  })

  // Blank MIME used to fall through via || 'audio/webm'; now requires explicit allowed MIME.
  test('returns 415 error when audio MIME is blank', async () => {
    const form = new FormData()
    form.append('audio', new File([new Uint8Array(100)], 'blob', { type: '' }))
    const req = makeReq(form)
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('error')
    if (result.kind === 'error') {
      expect(result.status).toBe(415)
    }
  })

  test('returns parsed fields for a valid request', async () => {
    const form = new FormData()
    form.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    form.append('to', 'command')
    form.append('transcribe_only', '1')
    const req = makeReq(form)
    const result = await parseTranscribeRequest(req)
    expect(result.kind).toBe('ok')
    if (result.kind === 'ok') {
      const parsed = result.parsed
      expect(parsed.audioFile instanceof File).toBe(true)
      expect(parsed.explicitTo).toBe('command')
      expect(parsed.transcribeOnly).toBe(true)
      expect(parsed.audioBuffer instanceof Buffer).toBe(true)
      expect(parsed.audioMime).toBe('audio/webm')
    }
  })
})
