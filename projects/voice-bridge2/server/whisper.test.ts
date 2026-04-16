/**
 * Tests for whisper.ts pure-logic helpers.
 *
 * These are pure-function tests (no I/O, no ffmpeg, no network) covering:
 *   - computeWavRms: RMS computation over pcm_s16le WAV buffers
 *   - mimeTypeToExt: MIME type → file extension mapping
 *   - buildWhisperBody: multipart form body sent to whisper.cpp server
 *
 * transcribeAudio is not tested here because it requires ffmpeg + a running
 * whisper-server. Those paths are exercised by integration/E2E tests.
 */

import { describe, test, expect } from 'bun:test'
import { computeWavRms, mimeTypeToExt, buildWhisperBody } from './whisper.ts'

// ---------------------------------------------------------------------------
// buildWhisperBody — multipart body sent to the Whisper inference endpoint
// ---------------------------------------------------------------------------

describe('buildWhisperBody', () => {
  // CEO-reported bug (2026-04-16): multiple voice transcripts (last 3-4) arrive
  // bundled together as one message. Root cause: whisper.cpp reuses its internal
  // context window across API calls unless no_context=1 is included in the
  // multipart request. Without it, each subsequent transcription is conditioned
  // on all prior transcriptions → output includes fragments of prior calls.
  //
  // Fix: include no_context=1 in every /inference request body.
  // This test verifies the field is present in the built multipart body.
  test('includes no_context=1 field to prevent whisper.cpp context bleed across calls', () => {
    const wav = Buffer.from('fake-wav-data')
    const boundary = 'test-boundary'
    const body = buildWhisperBody(wav, boundary)
    const bodyStr = body.toString('latin1')

    // The no_context field must be present with value "1".
    // Without it, whisper.cpp reuses context from prior calls and appends
    // their transcripts to the current one — causing the stacking bug.
    expect(bodyStr).toContain('name="no_context"')
    expect(bodyStr).toContain('\r\n\r\n1\r\n')
  })

  test('includes response_format=text field', () => {
    const wav = Buffer.from('fake-wav-data')
    const body = buildWhisperBody(wav, 'boundary-x')
    const bodyStr = body.toString('latin1')
    expect(bodyStr).toContain('name="response_format"')
    expect(bodyStr).toContain('\r\n\r\ntext\r\n')
  })

  test('includes language=auto field', () => {
    const wav = Buffer.from('fake-wav-data')
    const body = buildWhisperBody(wav, 'boundary-x')
    const bodyStr = body.toString('latin1')
    expect(bodyStr).toContain('name="language"')
    expect(bodyStr).toContain('\r\n\r\nauto\r\n')
  })

  test('includes the WAV file bytes in the body', () => {
    const wav = Buffer.from([0x52, 0x49, 0x46, 0x46]) // "RIFF"
    const body = buildWhisperBody(wav, 'boundary-x')
    // The WAV bytes must appear in the body (file part)
    const wavIdx = body.indexOf(wav)
    expect(wavIdx).toBeGreaterThan(-1)
  })

  test('body is terminated with the closing boundary marker', () => {
    const wav = Buffer.from('fake-wav')
    const boundary = 'my-boundary'
    const body = buildWhisperBody(wav, boundary)
    const bodyStr = body.toString('latin1')
    expect(bodyStr.endsWith(`--${boundary}--\r\n`)).toBe(true)
  })
})

// ---------------------------------------------------------------------------
// Helper: build a minimal valid pcm_s16le WAV buffer
// ---------------------------------------------------------------------------

/**
 * Builds a minimal RIFF/WAV buffer with pcm_s16le samples.
 * Layout: RIFF header (12) + fmt chunk (24) + data chunk (8 + samples*2)
 *
 * This is the canonical 44-byte canonical WAV layout — no extra chunks.
 */
function buildWav(samples: number[]): Buffer {
  const sampleBytes = samples.length * 2
  const buf = Buffer.alloc(44 + sampleBytes)

  // RIFF header
  buf.write('RIFF', 0, 'ascii')
  buf.writeUInt32LE(36 + sampleBytes, 4) // file size - 8
  buf.write('WAVE', 8, 'ascii')

  // fmt chunk
  buf.write('fmt ', 12, 'ascii')
  buf.writeUInt32LE(16, 16)     // chunk size
  buf.writeUInt16LE(1, 20)      // PCM format
  buf.writeUInt16LE(1, 22)      // mono
  buf.writeUInt32LE(16000, 24)  // sample rate
  buf.writeUInt32LE(32000, 28)  // byte rate
  buf.writeUInt16LE(2, 32)      // block align
  buf.writeUInt16LE(16, 34)     // bits per sample

  // data chunk
  buf.write('data', 36, 'ascii')
  buf.writeUInt32LE(sampleBytes, 40)
  for (let i = 0; i < samples.length; i++) {
    buf.writeInt16LE(samples[i]!, 44 + i * 2)
  }
  return buf
}

// ---------------------------------------------------------------------------
// computeWavRms
// ---------------------------------------------------------------------------

describe('computeWavRms', () => {
  test('returns 0 for a buffer smaller than 44 bytes', () => {
    // 44 bytes is the minimum valid WAV header size. Smaller buffers cannot
    // contain a parseable RIFF structure, so RMS must be 0.
    const tooSmall = Buffer.alloc(43, 0)
    expect(computeWavRms(tooSmall)).toBe(0)
  })

  test('returns 0 for an empty buffer', () => {
    expect(computeWavRms(Buffer.alloc(0))).toBe(0)
  })

  test('returns 0 when no data chunk is found in the buffer', () => {
    // A buffer that is >= 44 bytes but whose RIFF structure has no 'data'
    // chunk ID — computeWavRms scans for 'data' and must return 0 if absent.
    const buf = Buffer.alloc(100, 0)
    buf.write('RIFF', 0, 'ascii')
    buf.writeUInt32LE(92, 4)
    buf.write('WAVE', 8, 'ascii')
    // Write a chunk with ID 'junk' instead of 'data'
    buf.write('junk', 12, 'ascii')
    buf.writeUInt32LE(84, 16)
    // (rest of buffer is zeros — no 'data' chunk anywhere)
    expect(computeWavRms(buf)).toBe(0)
  })

  test('computes correct RMS for a known constant-value WAV', () => {
    // All samples = 1000 → RMS = sqrt(1000^2) = 1000
    const wav = buildWav([1000, 1000, 1000, 1000])
    expect(computeWavRms(wav)).toBeCloseTo(1000, 0)
  })

  test('computes correct RMS for mixed positive and negative samples', () => {
    // Samples [3, -3, 3, -3] → sumSq = 4*9 = 36, RMS = sqrt(36/4) = 3
    const wav = buildWav([3, -3, 3, -3])
    expect(computeWavRms(wav)).toBeCloseTo(3, 5)
  })

  test('computes correct RMS for a single sample', () => {
    // Single sample 32767 (int16 max) → RMS = 32767
    const wav = buildWav([32767])
    expect(computeWavRms(wav)).toBeCloseTo(32767, 0)
  })

  test('returns 0 for a data chunk with zero samples', () => {
    // WAV with a data chunk size of 0 — no samples to compute RMS over.
    const buf = Buffer.alloc(44, 0)
    buf.write('RIFF', 0, 'ascii')
    buf.writeUInt32LE(36, 4)
    buf.write('WAVE', 8, 'ascii')
    buf.write('fmt ', 12, 'ascii')
    buf.writeUInt32LE(16, 16)
    buf.write('data', 36, 'ascii')
    buf.writeUInt32LE(0, 40) // zero data bytes
    expect(computeWavRms(buf)).toBe(0)
  })
})

// ---------------------------------------------------------------------------
// mimeTypeToExt
// ---------------------------------------------------------------------------

describe('mimeTypeToExt', () => {
  test('maps audio/webm to webm', () => {
    expect(mimeTypeToExt('audio/webm')).toBe('webm')
  })

  test('maps audio/ogg to ogg', () => {
    expect(mimeTypeToExt('audio/ogg')).toBe('ogg')
  })

  test('maps audio/mp4 to mp4', () => {
    expect(mimeTypeToExt('audio/mp4')).toBe('mp4')
  })

  test('maps audio/aac to mp4', () => {
    // AAC audio uses mp4 container for ffmpeg compatibility
    expect(mimeTypeToExt('audio/aac')).toBe('mp4')
  })

  test('maps audio/m4a to m4a', () => {
    expect(mimeTypeToExt('audio/m4a')).toBe('m4a')
  })

  test('maps audio/x-m4a to m4a', () => {
    // iOS sometimes sends audio/x-m4a — must be handled identically to audio/m4a
    expect(mimeTypeToExt('audio/x-m4a')).toBe('m4a')
  })

  test('falls back to webm for unknown MIME types', () => {
    // Unrecognised types default to webm — the most common browser recording format
    expect(mimeTypeToExt('audio/unknown')).toBe('webm')
    expect(mimeTypeToExt('')).toBe('webm')
  })
})
