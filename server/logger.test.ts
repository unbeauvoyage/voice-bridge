/**
 * Tests for server/logger.ts — Pino-backed structured JSON logging.
 *
 * Every significant behavior of the logger is documented here.
 * These tests serve as the specification for the Logger interface.
 *
 * Output format: newline-delimited JSON to stdout
 * Capture uses `createLogger(stream)` with a Writable that records lines.
 *
 * Pino API:
 *   logger.info({ component, ...fields }, event)
 *   logger.warn({ component, ...fields }, event)
 *   logger.error({ component, error?, ...fields }, event)
 *
 * Schema (flat — no context wrapper):
 *   { ts, level, component, event, ...contextFields, error? }
 */

import { describe, test, expect } from 'bun:test'
import { Writable } from 'node:stream'
import { createLogger } from './logger.ts'

describe('logger', () => {
  // Helper: capture emitted lines via a Writable stream
  function capture(): { lines: string[]; stream: Writable } {
    const lines: string[] = []
    const stream = new Writable({
      write(chunk: Buffer, _enc: string, cb: () => void) {
        lines.push(chunk.toString().trim())
        cb()
      }
    })
    return { lines, stream }
  }

  // Helper: parse the Nth captured line as JSON — throws on missing line.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function parseLine(lines: string[], index: number): any {
    const line = lines.at(index)
    if (line === undefined) throw new Error(`Expected line at index ${index} but got undefined`)
    return JSON.parse(line)
  }

  // ── Test 1: info() emits valid JSON with correct level/component/event ────
  test('info() emits JSON with level "info", correct component and event', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.info({ component: 'transcribe' }, 'audio_received')

    expect(lines).toHaveLength(1)
    const entry = parseLine(lines, 0)
    expect(entry.level).toBe('info')
    expect(entry.component).toBe('transcribe')
    expect(entry.event).toBe('audio_received')
  })

  // ── Test 2: warn() emits with level "warn" ────────────────────────────────
  test('warn() emits JSON with level "warn"', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.warn({ component: 'relay' }, 'delivery_slow')

    expect(lines).toHaveLength(1)
    const entry = parseLine(lines, 0)
    expect(entry.level).toBe('warn')
    expect(entry.component).toBe('relay')
  })

  // ── Test 3: error() emits with error field containing message + stack ─────
  // When an Error is passed as the `error` field, it is serialized as
  // { message, stack } under the top-level "error" key.
  test('error() serializes error field (Error instance) to top-level error with message and stack', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)
    const err = new Error('transcription failed')

    log.error({ component: 'whisper', error: err }, 'transcription_error')

    expect(lines).toHaveLength(1)
    const entry = parseLine(lines, 0)
    expect(entry.level).toBe('error')
    expect(entry.error).toBeDefined()
    expect(entry.error.message).toBe('transcription failed')
    expect(typeof entry.error.stack).toBe('string')
  })

  // ── Test 4: error() with non-Error value in error field stringifies it ────
  test('error() with a non-Error error field stringifies it to error.message', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.error({ component: 'relay', error: 'something went wrong as a string' }, 'unexpected_throw')

    expect(lines).toHaveLength(1)
    const entry = parseLine(lines, 0)
    expect(entry.error.message).toBe('something went wrong as a string')
    expect(entry.error.stack).toBeUndefined()
  })

  // ── Test 5: component is set per call ────────────────────────────────────
  test('component field in output matches the component argument passed to each call', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.info({ component: 'transcribe' }, 'audio_received')
    log.info({ component: 'relay' }, 'message_sent')

    expect(parseLine(lines, 0).component).toBe('transcribe')
    expect(parseLine(lines, 1).component).toBe('relay')
  })

  // ── Test 6: extra fields appear flat in the output (no context wrapper) ───
  // Structured metadata is emitted at the top level, not nested under "context".
  test('extra fields appear at the top level of emitted JSON (flat schema)', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.info({ component: 'voice-bridge', bytes: 24576, mime: 'audio/webm' }, 'audio_received')

    expect(lines).toHaveLength(1)
    const entry = parseLine(lines, 0)
    expect(entry.bytes).toBe(24576)
    expect(entry.mime).toBe('audio/webm')
  })

  // ── Test 7: ts is a valid ISO 8601 date string ───────────────────────────
  test('ts field is a valid ISO 8601 UTC timestamp', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.info({ component: 'server' }, 'startup')

    const entry = parseLine(lines, 0)
    const parsed = new Date(entry.ts)
    expect(Number.isNaN(parsed.getTime())).toBe(false)
    expect(entry.ts).toMatch(/Z$/)
  })

  // ── Test 8: stream is written exactly once per log call ──────────────────
  test('the stream write is called exactly once per logger call', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.info({ component: 'server' }, 'startup')
    expect(lines).toHaveLength(1)

    log.warn({ component: 'relay' }, 'slow_request')
    expect(lines).toHaveLength(2)

    log.error({ component: 'whisper', error: new Error('boom') }, 'fatal')
    expect(lines).toHaveLength(3)
  })

  // ── Additional: no extra fields when none are passed ─────────────────────
  test('no extra fields in output when only component is passed', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.info({ component: 'server' }, 'startup')

    const entry = parseLine(lines, 0)
    // Only standard fields should be present
    expect(entry.ts).toBeDefined()
    expect(entry.level).toBe('info')
    expect(entry.component).toBe('server')
    expect(entry.event).toBe('startup')
  })

  // ── error() with Error that has a code property ───────────────────────────
  test('error() includes code field when error has a code property', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)
    const err = Object.assign(new Error('file not found'), { code: 'ENOENT' })

    log.error({ component: 'fs', error: err }, 'file_read_failed')

    const entry = parseLine(lines, 0)
    expect(entry.error.code).toBe('ENOENT')
  })

  // ── error field coexists with other fields ────────────────────────────────
  // The error key is serialized by the custom serializer; other fields are flat.
  test('error field is serialized alongside other flat fields', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.error(
      { component: 'relay', error: new Error('timeout'), to: 'atlas', attempt: 3 },
      'delivery_failed'
    )

    const entry = parseLine(lines, 0)
    expect(entry.error.message).toBe('timeout')
    expect(entry.to).toBe('atlas')
    expect(entry.attempt).toBe(3)
  })

  // ── warn() without extra fields ───────────────────────────────────────────
  test('warn() with only component emits no extra fields', () => {
    const { lines, stream } = capture()
    const log = createLogger(stream)

    log.warn({ component: 'server' }, 'deprecated_endpoint_called')

    const entry = parseLine(lines, 0)
    expect(entry.event).toBe('deprecated_endpoint_called')
    expect(entry.component).toBe('server')
  })
})
