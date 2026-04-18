/**
 * Structured JSON logging for voice-bridge2 server — backed by Pino.
 *
 * Output format (flat, same keys as before):
 *   { ts, level, component, event, ...contextFields, error? }
 *
 * Usage:
 *   import { logger } from './logger.ts'
 *   logger.info({ component: 'transcribe', bytes: 24576, mime: 'audio/webm' }, 'audio_received')
 *   logger.error({ component: 'relay', error: err, to: 'atlas' }, 'delivery_failed')
 *
 * The `error` key is serialized by a custom serializer into { message, stack?, code? }.
 *
 * For tests, use `createLogger(stream)` to capture output into a Writable stream.
 */

import pino from 'pino'
import { Writable } from 'node:stream'

// ── Custom error serializer — matches the existing error schema ───────────────

function serializeError(err: unknown): { message: string; stack?: string; code?: string } {
  if (err instanceof Error) {
    const s: { message: string; stack?: string; code?: string } = {
      message: err.message,
      stack: err.stack
    }
    if ('code' in err && typeof err.code === 'string') s.code = err.code
    return s
  }
  return { message: String(err) }
}

// ── Pino options ──────────────────────────────────────────────────────────────
// - messageKey: 'event'  → the message string appears as "event" in JSON output
// - timestamp: custom    → emits "ts" (ISO string) instead of pino's default "time" (epoch ms)
// - formatters.level     → emits level as string ("info") not number (30)
// - base: null           → removes pid/hostname from every line
// - serializers.error    → serializes the `error` field consistently

function pinoOptions(): pino.LoggerOptions {
  const isDev = process.env.NODE_ENV === 'development'
  return {
    level: isDev ? 'debug' : 'info',
    messageKey: 'event' as const,
    timestamp: (): string => `,"ts":"${new Date().toISOString()}"`,
    base: null,
    formatters: {
      level: (label: string) => ({ level: label })
    },
    serializers: {
      error: serializeError
    },
    ...(isDev ? { transport: { target: 'pino-pretty', options: { colorize: true } } } : {})
  }
}

/**
 * Create a Pino logger instance.
 *
 * @param stream  Optional Writable stream to capture output (for tests).
 *                Defaults to process.stdout.
 */
export function createLogger(stream?: Writable): pino.Logger {
  if (stream) {
    return pino(pinoOptions(), stream)
  }
  return pino(pinoOptions())
}

/**
 * Root logger instance for server/index.ts and other modules.
 */
export const logger: pino.Logger = createLogger()
