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
import {
  handleTranscribe,
  type TranscribeContext,
  type DedupEntry,
  type DeliveryResult
} from './transcribe.ts'
import type { LlmRouteResult } from '../llmRouter.ts'

// Default transcribeAudio is now injected via createMockContext().transcribeAudio
// rather than mock.module('../whisper.ts'). This decouples tests from the module graph:
// no module mocking needed — each test overrides ctx.transcribeAudio directly.
// The default returns { transcript: 'hello world', audioRms: 10000 } — a stable
// transcript that won't trip mic-command or cancel-detection heuristics.

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
    // DI-injected transcription — avoids mock.module() coupling to the module graph.
    // Tests that need a custom transcription result override this field directly.
    transcribeAudio: async () => ({ transcript: 'hello world', audioRms: 10000 }),
    // DI-injected LLM router — returns no-match by default; tests that exercise
    // the "please"-gate routing override this to simulate agent detection.
    llmRoute: async (_transcript: string, _knownAgents: string[], fallbackAgent: string): Promise<LlmRouteResult> => ({
      agent: fallbackAgent,
      message: _transcript,
      agentChanged: false
    }),
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
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext({
      transcribeAudio: async () => { throw new Error('whisper exploded') }
    })
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(500)
    // Retries must not hang on a stale inProgress entry.
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  test('cache entry is cleaned up when transcript is empty', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext({
      transcribeAudio: async () => ({ transcript: '', audioRms: 0 })
    })
    const res = await handleTranscribe(req, ctx)
    expect(res.status).toBe(422)
    expect(ctx.recentAudioHashes.size).toBe(0)
  })

  test('cache entry is cleaned up when transcript is a cancel command', async () => {
    const formData = new FormData()
    formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
    const req = createMockRequest(formData)
    const ctx = createMockContext({
      transcribeAudio: async () => ({ transcript: 'cancel cancel cancel', audioRms: 10000 })
    })
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

  // Chunk-5 #4 HIGH (transcribe.ts:214-232) — the dedup waiter used to
  // return a fake-successful `200 {transcript:"", deduplicated:true}`
  // in two distinct bad cases: (a) the wait deadline expired while the
  // original was still running, (b) the original failed and cleared
  // the entry mid-wait. Both cases mislead the client into thinking
  // the message was sent when nothing landed.
  //
  // The fix: on deadline expiry, return 409 with an explicit retry
  // hint (NOT a blank transcript success). On entry-deleted (original
  // failed), fall through and reprocess — the duplicate's own audio
  // still deserves a real delivery attempt.
  describe('dedup waiter — no silent blank on timeout / original-failed', () => {
    test('returns 409 retry-later when wait deadline expires (not blank 200)', async () => {
      const ctx = createMockContext({ dedupWaitDeadlineMs: 50 })
      // Simulate another request already in progress — the handler will
      // wait for it, and the deadline will expire before it resolves.
      const hash = 'hash-100' // matches createMockContext's hashAudioBuffer
      ctx.recentAudioHashes.set(hash, { ts: Date.now(), inProgress: true })

      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(409)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      // Must NOT be a blank-transcript success; the client has to be
      // told this is a retry situation, not a "nothing was heard" one.
      expect(obj['transcript']).not.toBe('')
      expect(String(obj['error'] ?? obj['retry'] ?? '')).toMatch(/retry|progress/i)
    })

    test('falls through to re-process when entry is deleted mid-wait (not blank 200)', async () => {
      // Pre-seed an in-progress entry. Start the duplicate, then
      // simulate the original failing (which deletes the entry). The
      // duplicate must fall through, run transcription + delivery, and
      // return a real 200 — not the old blank-200 short-circuit.
      const deliverCalls: Array<{ message: string; to: string }> = []
      const ctx = createMockContext({
        dedupWaitDeadlineMs: 5000,
        deliverMessage: async (message, to) => {
          deliverCalls.push({ message, to })
          return { ok: true }
        }
      })
      const hash = 'hash-100'
      ctx.recentAudioHashes.set(hash, { ts: Date.now(), inProgress: true })

      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      formData.append('to', 'command')
      const req = createMockRequest(formData)

      const pending = handleTranscribe(req, ctx)

      // Give the handler time to enter the wait loop, then simulate
      // the original failing and clearing the entry.
      await Bun.sleep(350)
      ctx.recentAudioHashes.delete(hash)

      const res = await pending
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      expect(obj['delivered']).toBe(true)
      expect(obj['transcript']).toBe('hello world')
      // The duplicate actually delivered — it was not short-circuited.
      expect(deliverCalls.length).toBe(1)
    })
  })

  // ── Whisper hallucination filter ──────────────────────────────────────────
  //
  // When the wake word fires on low-signal audio (TTS bleed, ambient noise),
  // Whisper's known artifact is to hallucinate single-phrase transcripts like
  // "hello", "thank you", "thanks for watching", "you", "bye". If the audio
  // RMS is also below a low threshold, these are almost certainly hallucinated.
  // Treat them as cancelled/no-op rather than delivering them to an agent.
  //
  // CEO saw 23 identical "hello" in 2 min caused by TTS bleed back into the mic
  // (relay-poller pause-guard bug). This filter is defense-in-depth — it
  // prevents feedback loops even if the pause-guard fix is somehow bypassed.
  describe('whisper hallucination filter', () => {
    // Build a minimal WAV buffer with near-zero int16 samples.
    // WAV header: 44 bytes, then int16 PCM samples (little-endian).
    function makeSilentWav(durationMs = 100): Buffer {
      const sampleRate = 16000
      const numSamples = Math.floor((sampleRate * durationMs) / 1000)
      const dataBytes = numSamples * 2 // int16 = 2 bytes per sample
      const buf = Buffer.alloc(44 + dataBytes, 0)
      // RIFF header
      buf.write('RIFF', 0)
      buf.writeUInt32LE(36 + dataBytes, 4)
      buf.write('WAVE', 8)
      buf.write('fmt ', 12)
      buf.writeUInt32LE(16, 16) // PCM chunk size
      buf.writeUInt16LE(1, 20)  // PCM format
      buf.writeUInt16LE(1, 22)  // mono
      buf.writeUInt32LE(sampleRate, 24)
      buf.writeUInt32LE(sampleRate * 2, 28) // byte rate
      buf.writeUInt16LE(2, 32)  // block align
      buf.writeUInt16LE(16, 34) // bits per sample
      buf.write('data', 36)
      buf.writeUInt32LE(dataBytes, 40)
      // All samples are 0 (already zeroed by Buffer.alloc)
      return buf
    }

    // Build a WAV with high-amplitude int16 samples (RMS well above threshold).
    function makeLoudWav(durationMs = 100): Buffer {
      const sampleRate = 16000
      const numSamples = Math.floor((sampleRate * durationMs) / 1000)
      const dataBytes = numSamples * 2
      const buf = Buffer.alloc(44 + dataBytes, 0)
      buf.write('RIFF', 0)
      buf.writeUInt32LE(36 + dataBytes, 4)
      buf.write('WAVE', 8)
      buf.write('fmt ', 12)
      buf.writeUInt32LE(16, 16)
      buf.writeUInt16LE(1, 20)
      buf.writeUInt16LE(1, 22)
      buf.writeUInt32LE(sampleRate, 24)
      buf.writeUInt32LE(sampleRate * 2, 28)
      buf.writeUInt16LE(2, 32)
      buf.writeUInt16LE(16, 34)
      buf.write('data', 36)
      buf.writeUInt32LE(dataBytes, 40)
      // Fill with max int16 value (32767) for all samples — guaranteed high RMS
      for (let i = 0; i < numSamples; i++) {
        buf.writeInt16LE(32767, 44 + i * 2)
      }
      return buf
    }

    function wavToFile(buf: Buffer, name = 'audio.wav'): File {
      return new File([buf], name, { type: 'audio/wav' })
    }

    function makeRequest(audioFile: File, to?: string): Request {
      const formData = new FormData()
      formData.append('audio', audioFile)
      if (to) formData.append('to', to)
      const req = new Request('http://localhost:3030/transcribe', { method: 'POST', headers: {} })
      Object.defineProperty(req, 'formData', { value: async () => formData })
      return req
    }

    test('returns cancelled when transcript is "hello" and audio RMS is below threshold', async () => {
      // Silent WAV + Whisper hallucinating "hello" → must be cancelled, not delivered
      // audioRms: 0 simulates near-silence from the converted PCM (below threshold 500)
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'hello', audioRms: 0 })
      })
      const deliverCalls: unknown[] = []
      ctx.deliverMessage = async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }

      const res = await handleTranscribe(makeRequest(wavToFile(makeSilentWav())), ctx)
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      expect(obj['cancelled']).toBe(true)
      expect(obj['reason']).toBe('whisper-hallucination')
      expect(obj['transcript']).toBe('hello')
      // Must NOT deliver — this was a hallucination
      expect(deliverCalls).toHaveLength(0)
    })

    test('delivers normally when transcript is "hello" but audio RMS is above threshold', async () => {
      // Real signal + "hello" → could be genuine greeting — must deliver
      // audioRms: 10000 simulates real voice signal from the converted PCM (above threshold 500)
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'hello', audioRms: 10000 })
      })
      const deliverCalls: unknown[] = []
      ctx.deliverMessage = async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }

      const res = await handleTranscribe(makeRequest(wavToFile(makeLoudWav())), ctx)
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      // Not cancelled — real audio
      expect(obj['cancelled']).toBeUndefined()
      expect(obj['delivered']).toBe(true)
      expect(deliverCalls).toHaveLength(1)
    })

    test('delivers normally when transcript is longer than a single hallucination phrase at low RMS', async () => {
      // Low RMS but multi-word sentence — user genuinely said something
      // Even with low audioRms, a multi-word transcript does not match the hallucination phrase set
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'hello can you open the door', audioRms: 0 })
      })
      const deliverCalls: unknown[] = []
      ctx.deliverMessage = async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }

      const res = await handleTranscribe(makeRequest(wavToFile(makeSilentWav())), ctx)
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      expect(obj['cancelled']).toBeUndefined()
      expect(obj['delivered']).toBe(true)
      expect(deliverCalls).toHaveLength(1)
    })

    test.each([
      ['Hello.'],
      ['Thank you!'],
      ['Thanks for watching.'],
      ['You'],
      ['Bye'],
    ])('hallucination filter is case-insensitive and strips trailing punctuation: %s', async (phrase) => {
      const ctx = createMockContext({
        transcribeAudio: async () => ({
          transcript: phrase,
          audioRms: 0 // below threshold — hallucination condition applies
        })
      })
      const deliverCalls: unknown[] = []
      ctx.deliverMessage = async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }

      const res = await handleTranscribe(makeRequest(wavToFile(makeSilentWav())), ctx)
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      expect(obj['cancelled']).toBe(true)
      expect(obj['reason']).toBe('whisper-hallucination')
      expect(deliverCalls).toHaveLength(0)
    })
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

  // ── Fix 1: RMS computed from converted PCM, not raw upload buffer ─────────
  //
  // The old hallucination filter computed RMS over the raw upload buffer with a
  // hard-coded 44-byte header offset, assuming the upload is WAV. But uploads
  // are audio/webm, audio/ogg, audio/mp4, etc. — not WAV. The 44-byte offset
  // reads container metadata bytes, yielding meaningless RMS values.
  //
  // Fix: transcribeAudio() now returns { transcript, audioRms } where audioRms
  // is computed from the ffmpeg-converted pcm_s16le WAV buffer (scanning for
  // the RIFF 'data' subchunk instead of assuming 44-byte offset). The handler
  // uses that value instead of re-computing from the raw upload.
  //
  // This test sends a non-WAV upload (random bytes at audio/webm) with a mock
  // whisper that returns "hello" and a very low audioRms (simulating silent
  // audio). The hallucination filter must fire — it would not fire if RMS were
  // still computed over the random upload bytes (which would be non-zero noise).
  describe('Fix 1: hallucination filter uses converted PCM RMS, not raw upload RMS', () => {
    test('hallucination filter uses converted PCM RMS, not raw upload RMS', async () => {
      // Inject whisper to return a hallucination phrase with zero RMS
      // (simulating the converted PCM being silence after ffmpeg)
      // Upload random non-WAV bytes — these would produce non-zero RMS if the
      // old code still ran RMS over the upload buffer. With the fix, RMS comes
      // from ctx.transcribeAudio's returned audioRms (0) → hallucination fires.
      const randomBytes = new Uint8Array(1000)
      for (let i = 0; i < randomBytes.length; i++) {
        randomBytes[i] = Math.floor(Math.random() * 256)
      }
      const deliverCalls: unknown[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'hello', audioRms: 0 }),
        deliverMessage: async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }
      })

      const formData = new FormData()
      formData.append('audio', new File([randomBytes], 'audio.webm', { type: 'audio/webm' }))
      const req = new Request('http://localhost:3030/transcribe', { method: 'POST' })
      Object.defineProperty(req, 'formData', { value: async () => formData })

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      // Must be cancelled as hallucination — NOT delivered
      expect(obj['cancelled']).toBe(true)
      expect(obj['reason']).toBe('whisper-hallucination')
      expect(deliverCalls).toHaveLength(0)
    })

    test('hallucination filter does NOT fire when converted PCM RMS is above threshold', async () => {
      // High audioRms injected via ctx — real audio, not hallucination
      const deliverCalls: unknown[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({
          transcript: 'hello',
          audioRms: 10000 // well above WHISPER_HALLUCINATION_RMS_THRESHOLD (500)
        }),
        deliverMessage: async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }
      })

      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'audio.webm', { type: 'audio/webm' }))
      const req = new Request('http://localhost:3030/transcribe', { method: 'POST' })
      Object.defineProperty(req, 'formData', { value: async () => formData })

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(200)
      const body: unknown = await res.json()
      const obj: Record<string, unknown> = {}
      if (typeof body === 'object' && body !== null) Object.assign(obj, body)
      expect(obj['cancelled']).toBeUndefined()
      expect(obj['delivered']).toBe(true)
      expect(deliverCalls).toHaveLength(1)
    })
  })

  // ── Transcript stacking regression ───────────────────────────────────────────
  //
  // CEO-reported bug (2026-04-16): multiple voice transcripts arrive bundled
  // together as one message, end-to-end appended. Cause: the Whisper server
  // (whisper.cpp) reuses internal context across calls unless explicitly told
  // not to. Our /transcribe handler must pass `no_context=1` so each recording
  // is transcribed independently.
  //
  // This test proves the handler contract at the DI boundary: two separate POST
  // /transcribe calls — different audio bytes, different hashes — MUST produce
  // two separate deliverMessage calls each carrying only their own transcript.
  // The transcribeAudio injection ensures each call returns a distinct string.
  //
  // If transcript stacking occurred at the handler level (shared buffer, string
  // append, etc.) the second deliverMessage call would carry both transcripts.
  // This test catches that class of bug.
  describe('transcript stacking — sequential recordings deliver independently', () => {
    test('two sequential audio POSTs each deliver their own transcript (not concatenated)', async () => {
      const deliverCalls: Array<{ message: string; to: string }> = []

      // Simulate two distinct recordings that Whisper transcribes independently.
      // In production the whisper.cpp no_context=1 flag prevents cross-request
      // context bleed; here we verify the handler itself never concatenates.
      let callCount = 0
      const transcripts = ['turn on the lights', 'set a timer for ten minutes']
      const ctx = createMockContext({
        // Different audio buffers hash differently — use the real counter to
        // return distinct transcripts per call.
        transcribeAudio: async () => {
          const t = transcripts[callCount % transcripts.length]
          callCount++
          return { transcript: t!, audioRms: 10000 }
        },
        // Each audio buffer produces a unique hash so dedup does not fire.
        hashAudioBuffer: (_buf: Buffer) => `unique-hash-${Math.random()}`,
        deliverMessage: async (message, to) => {
          deliverCalls.push({ message, to })
          return { ok: true }
        }
      })

      // First recording
      const form1 = new FormData()
      form1.append('audio', new File([new Uint8Array(101)], 'recording1.wav', { type: 'audio/wav' }))
      form1.append('to', 'command')
      const req1 = createMockRequest(form1)
      const res1 = await handleTranscribe(req1, ctx)
      expect(res1.status).toBe(200)

      // Second recording — separate audio bytes
      const form2 = new FormData()
      form2.append('audio', new File([new Uint8Array(102)], 'recording2.wav', { type: 'audio/wav' }))
      form2.append('to', 'command')
      const req2 = createMockRequest(form2)
      const res2 = await handleTranscribe(req2, ctx)
      expect(res2.status).toBe(200)

      // Two separate deliver calls — one per recording
      expect(deliverCalls).toHaveLength(2)

      // Each call carries only its own transcript — no concatenation
      expect(deliverCalls[0]!.message).toBe('turn on the lights')
      expect(deliverCalls[1]!.message).toBe('set a timer for ten minutes')

      // Neither message contains the other's text
      expect(deliverCalls[0]!.message).not.toContain('set a timer')
      expect(deliverCalls[1]!.message).not.toContain('turn on the lights')
    })

    test('each transcribeAudio call receives only its own audio buffer (no cross-contamination)', async () => {
      // Verify the handler passes the audio buffer for each request in isolation
      // to ctx.transcribeAudio. If a shared buffer were being accumulated between
      // calls, the bufLen values below would grow — both should match their
      // respective File sizes exactly.
      const transcribeCallArgs: Array<{ bufLen: number; mime: string }> = []
      const ctx = createMockContext({
        transcribeAudio: async (buffer: Buffer, mimeType: string) => {
          transcribeCallArgs.push({ bufLen: buffer.length, mime: mimeType })
          return { transcript: `transcript-${buffer.length}`, audioRms: 10000 }
        },
        hashAudioBuffer: (_buf: Buffer) => `unique-hash-${Math.random()}`
      })

      const form1 = new FormData()
      form1.append('audio', new File([new Uint8Array(201)], 'r1.wav', { type: 'audio/wav' }))
      form1.append('to', 'command')
      await handleTranscribe(createMockRequest(form1), ctx)

      const form2 = new FormData()
      form2.append('audio', new File([new Uint8Array(303)], 'r2.wav', { type: 'audio/wav' }))
      form2.append('to', 'command')
      await handleTranscribe(createMockRequest(form2), ctx)

      expect(transcribeCallArgs).toHaveLength(2)
      // First call: 201 bytes; second call: 303 bytes — not 504 (not accumulated)
      expect(transcribeCallArgs[0]!.bufLen).toBe(201)
      expect(transcribeCallArgs[1]!.bufLen).toBe(303)
    })
  })

  // ── Fix 2: dedup entry preserved as cancelled on hallucination path ────────
  //
  // The old code called ctx.recentAudioHashes.delete(audioHash) before returning
  // the cancelled hallucination response. A concurrent duplicate in the wait loop
  // would see the entry vanish → treat it as "original failed" → fall through and
  // re-run whisper → hallucinate again → deliver another "hello" to the agent.
  //
  // Fix: instead of deleting, promote the entry to a terminal cancelled variant:
  //   { ts, cancelled: true, transcript }
  // The wait loop detects this and returns { cancelled: true, deduplicated: true }
  // without re-running whisper.
  describe('Fix 2: dedup entry preserved as cancelled result on hallucination path', () => {
    test('concurrent duplicate of hallucinated audio gets cached cancelled result instead of re-running whisper', async () => {
      // Inject transcribeAudio via ctx — returns hallucination with zero RMS.
      // whisperCallCount tracks how many times it was called; the duplicate
      // should read from the cancelled cache entry and NOT call transcribeAudio again.
      let whisperCallCount = 0
      const ctx = createMockContext({
        dedupWaitDeadlineMs: 2000,
        transcribeAudio: async () => {
          whisperCallCount++
          return { transcript: 'hello', audioRms: 0 }
        }
      })

      // Simulate: a hash is already inProgress (original is running)
      const hash = 'hash-100' // matches hashAudioBuffer(buf of 100 bytes)
      ctx.recentAudioHashes.set(hash, { ts: Date.now(), inProgress: true })

      // The original finishes: it ran whisper, got hallucination, and should
      // promote the entry to { cancelled: true, transcript: 'hello' }
      // We simulate this by setting the entry to what the fix should store:
      // (The duplicate waiter below should return cancelled without re-running whisper)
      //
      // To test the real behavior: run the original through the handler first,
      // then start the duplicate and let the original resolve.

      // Reset the map — let both requests race
      ctx.recentAudioHashes.clear()
      whisperCallCount = 0

      const formData1 = new FormData()
      formData1.append('audio', new File([new Uint8Array(100)], 'audio.webm', { type: 'audio/webm' }))
      const req1 = new Request('http://localhost:3030/transcribe', { method: 'POST' })
      Object.defineProperty(req1, 'formData', { value: async () => formData1 })

      // Start original request — it will reach whisper, get hallucination, should
      // promote entry to cancelled (not delete)
      const originalRes = handleTranscribe(req1, ctx)

      // Give original a tick to set inProgress
      await Bun.sleep(10)

      // Now start duplicate — it enters the wait loop
      const formData2 = new FormData()
      formData2.append('audio', new File([new Uint8Array(100)], 'audio.webm', { type: 'audio/webm' }))
      const req2 = new Request('http://localhost:3030/transcribe', { method: 'POST' })
      Object.defineProperty(req2, 'formData', { value: async () => formData2 })

      // Run both to completion
      const [res1, res2] = await Promise.all([originalRes, handleTranscribe(req2, ctx)])

      const body1: unknown = await res1.json()
      const obj1: Record<string, unknown> = {}
      if (typeof body1 === 'object' && body1 !== null) Object.assign(obj1, body1)

      const body2: unknown = await res2.json()
      const obj2: Record<string, unknown> = {}
      if (typeof body2 === 'object' && body2 !== null) Object.assign(obj2, body2)

      // Original should be cancelled as hallucination
      expect(obj1['cancelled']).toBe(true)
      expect(obj1['reason']).toBe('whisper-hallucination')

      // Duplicate should get cached cancelled result (deduplicated: true)
      // NOT re-run whisper and NOT deliver
      expect(obj2['cancelled']).toBe(true)
      expect(obj2['deduplicated']).toBe(true)

      // Whisper should only have been called ONCE — the duplicate reads from cache
      expect(whisperCallCount).toBe(1)
    })
  })

  // ── Test mode (transcript starts with "test") ──────────────────────────────
  //
  // If the transcribed text begins with the word "test", the handler short-circuits
  // before routing or relay delivery. This allows developers to verify the
  // transcription pipeline end-to-end without spamming real agents.
  describe('test mode: transcripts starting with "test" skip relay', () => {
    test('returns 200 test:true without calling deliverMessage', async () => {
      const deliverCalls: unknown[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'test hello world', audioRms: 10000 }),
        deliverMessage: async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body['test']).toBe(true)
      expect(body['transcript']).toBe('test hello world')
      // Relay must NOT be called — test mode is a dry-run
      expect(deliverCalls).toHaveLength(0)
    })

    test('test mode clears the dedup cache entry (retries get a fresh attempt)', async () => {
      // /^test\b/ matches "test" followed by a word boundary — use "test one two three"
      // NOT "testing one two three" (which has no boundary between "test" and "ing")
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'test one two three', audioRms: 10000 })
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      await handleTranscribe(req, ctx)
      // After test-mode short-circuit, the inProgress entry must be gone
      expect(ctx.recentAudioHashes.size).toBe(0)
    })
  })

  // ── Mic control commands ────────────────────────────────────────────────────
  //
  // Certain transcripts (e.g. "turn off mic", "mute mic") are handled as mic
  // control commands before agent routing. When detected, the handler returns
  // { transcript, mic, command: true } without routing to an agent.
  describe('mic control commands skip agent routing', () => {
    test('returns 200 with mic state when handleMicCommand matches', async () => {
      const deliverCalls: unknown[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'turn off mic', audioRms: 10000 }),
        handleMicCommand: () => ({ handled: true, state: 'off' as const }),
        deliverMessage: async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body['mic']).toBe('off')
      expect(body['command']).toBe(true)
      expect(body['transcript']).toBe('turn off mic')
      // Must not deliver to any agent — this is a local mic command
      expect(deliverCalls).toHaveLength(0)
    })

    test('mic resume command returns mic:on', async () => {
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'unmute mic', audioRms: 10000 }),
        handleMicCommand: () => ({ handled: true, state: 'on' as const })
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      const res = await handleTranscribe(req, ctx)
      const body = await res.json() as Record<string, unknown>
      expect(body['mic']).toBe('on')
      expect(body['command']).toBe(true)
    })

    test('mic command clears the dedup cache entry', async () => {
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'pause mic', audioRms: 10000 }),
        handleMicCommand: () => ({ handled: true, state: 'off' as const })
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      await handleTranscribe(req, ctx)
      expect(ctx.recentAudioHashes.size).toBe(0)
    })
  })

  // ── "please"-gate routing (llmRoute override) ─────────────────────────────
  //
  // When "please" appears in the first 7 words, the handler invokes ctx.llmRoute
  // to detect the target agent. This OVERRIDES any explicit `to` field. The
  // routing part (words up to and including "please") is passed to llmRoute;
  // the message part (words after "please") is what gets delivered.
  describe('"please" in first 7 words triggers llmRoute agent detection', () => {
    test('routes to agent returned by llmRoute when "please" is present', async () => {
      const deliverCalls: Array<{ message: string; to: string }> = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'to atlas please deploy the service', audioRms: 10000 }),
        llmRoute: async () => ({ agent: 'atlas', message: 'deploy the service', agentChanged: true }),
        deliverMessage: async (message, to) => { deliverCalls.push({ message, to }); return { ok: true } }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body['to']).toBe('atlas')
      // Message delivered must be the part AFTER "please" (words after please)
      expect(deliverCalls[0]?.to).toBe('atlas')
    })

    test('falls back to "command" when llmRoute returns no agent', async () => {
      // llmRoute returns empty agent → handler falls back to 'command'
      const deliverCalls: Array<{ to: string }> = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'mumbled noise please do something', audioRms: 10000 }),
        llmRoute: async (_t, _agents, fallback) => ({ agent: fallback, message: 'do something', agentChanged: false }),
        deliverMessage: async (message, to) => { deliverCalls.push({ to }); return { ok: true } }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      await handleTranscribe(req, ctx)
      expect(deliverCalls[0]?.to).toBe('command')
    })

    test('saves last target when llmRoute detects an agent change', async () => {
      const savedTargets: string[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'to atlas please check the logs', audioRms: 10000 }),
        llmRoute: async () => ({ agent: 'atlas', message: 'check the logs', agentChanged: true }),
        saveLastTarget: (target) => { savedTargets.push(target) }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      await handleTranscribe(req, ctx)
      expect(savedTargets).toContain('atlas')
    })

    test('does NOT save last target when llmRoute returns agentChanged=false', async () => {
      const savedTargets: string[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'please do this thing', audioRms: 10000 }),
        llmRoute: async (_t, _agents, fallback) => ({ agent: fallback, message: 'do this thing', agentChanged: false }),
        saveLastTarget: (target) => { savedTargets.push(target) }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      const req = createMockRequest(formData)

      await handleTranscribe(req, ctx)
      expect(savedTargets).toHaveLength(0)
    })
  })

  // ── transcribe_only mode ───────────────────────────────────────────────────
  //
  // When the form includes transcribe_only=1, the handler returns the transcript
  // and resolved agent without delivering to the relay. The app displays the
  // transcription for user confirmation before sending.
  describe('transcribe_only mode: skip delivery, return transcript + target', () => {
    test('returns transcript and to without calling deliverMessage', async () => {
      const deliverCalls: unknown[] = []
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'send a message to the team', audioRms: 10000 }),
        deliverMessage: async (msg, to) => { deliverCalls.push({ msg, to }); return { ok: true } }
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      formData.append('to', 'atlas')
      formData.append('transcribe_only', '1')
      const req = createMockRequest(formData)

      const res = await handleTranscribe(req, ctx)
      expect(res.status).toBe(200)
      const body = await res.json() as Record<string, unknown>
      expect(body['transcript']).toBe('send a message to the team')
      expect(body['to']).toBe('atlas')
      // Must NOT deliver — user hasn't confirmed yet
      expect(deliverCalls).toHaveLength(0)
    })

    test('transcribe_only promotes cache entry to resolved (duplicates get cached result)', async () => {
      const ctx = createMockContext({
        transcribeAudio: async () => ({ transcript: 'confirm later', audioRms: 10000 })
      })
      const formData = new FormData()
      formData.append('audio', new File([new Uint8Array(100)], 'ok.webm', { type: 'audio/webm' }))
      formData.append('to', 'command')
      formData.append('transcribe_only', '1')
      const req = createMockRequest(formData)

      await handleTranscribe(req, ctx)
      // Entry must be promoted (not inProgress) so duplicates return cached transcript
      const entry = Array.from(ctx.recentAudioHashes.values())[0]
      expect(entry).toBeDefined()
      // Must be a resolved entry with transcript and to fields
      expect(entry && 'transcript' in entry).toBe(true)
      expect(entry && 'inProgress' in entry).toBe(false)
    })
  })
})
