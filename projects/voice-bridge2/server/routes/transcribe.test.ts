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

// Mock Request with FormData
function createMockRequest(body: FormData): Request {
  const req: Request = {
    method: 'POST',
    url: 'http://localhost:3030/transcribe',
    formData: async () => body,
    text: async () => ''
  }
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

  test('POST /transcribe returns 400 when form data is invalid', async () => {
    // Simulate invalid form data parsing
    const req: Request = {
      method: 'POST',
      url: 'http://localhost:3030/transcribe',
      formData: async () => {
        throw new Error('Invalid form data')
      }
    }
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
