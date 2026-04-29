/**
 * ContentServiceClient — interface + HTTP implementation.
 *
 * POSTs multipart to content-service /upload (port 8770 by default).
 * Returns the URL, mime, bytes, and sha256 of the stored file.
 */

import { propagation, context } from '@opentelemetry/api'
import type { ComposedAttachment } from '../envelope.ts'

// ── Interface ──────────────────────────────────────────────────────────────────

export interface IContentServiceClient {
  /**
   * Upload a single file to the content-service.
   * Returns a ComposedAttachment on success.
   * Throws on network failure, 4xx (too large, bad mime), or 5xx.
   */
  upload(buffer: Buffer, mime: string, filename: string): Promise<ComposedAttachment>
}

// ── Response type guard ───────────────────────────────────────────────────────

function isUploadResponse(
  value: unknown
): value is { url: string; mime: string; bytes: number; sha256: string } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  return (
    'url' in value &&
    typeof value.url === 'string' &&
    'mime' in value &&
    typeof value.mime === 'string' &&
    'bytes' in value &&
    typeof value.bytes === 'number' &&
    'sha256' in value &&
    typeof value.sha256 === 'string'
  )
}

// ── Error type guard ──────────────────────────────────────────────────────────

function isErrorResponse(value: unknown): value is { error: string } {
  return (
    typeof value === 'object' &&
    value !== null &&
    'error' in value &&
    typeof value.error === 'string'
  )
}

// ── HTTP implementation ────────────────────────────────────────────────────────

export class HttpContentServiceClient implements IContentServiceClient {
  private readonly baseUrl: string
  private readonly timeoutMs: number

  constructor(baseUrl: string, timeoutMs = 30_000) {
    this.baseUrl = baseUrl
    this.timeoutMs = timeoutMs
  }

  async upload(buffer: Buffer, mime: string, filename: string): Promise<ComposedAttachment> {
    const form = new FormData()
    form.append('file', new Blob([buffer], { type: mime }), filename)

    const headers: Record<string, string> = {}
    propagation.inject(context.active(), headers)

    const res = await fetch(`${this.baseUrl}/upload`, {
      method: 'POST',
      headers,
      body: form,
      signal: AbortSignal.timeout(this.timeoutMs)
    })

    const body: unknown = await res.json().catch(() => null)

    if (!res.ok) {
      if (res.status === 413) {
        throw new TooLargeError(`content-service: attachment too large`)
      }
      if (res.status === 415) {
        const detail = isErrorResponse(body) ? body.error : String(res.status)
        throw new UnsupportedMimeError(`content-service: unsupported mime — ${detail}`)
      }
      const detail = isErrorResponse(body) ? body.error : String(res.status)
      throw new Error(`content-service upload failed ${res.status}: ${detail}`)
    }

    if (!isUploadResponse(body)) {
      throw new Error('content-service returned unexpected response shape')
    }

    return {
      url: body.url,
      mime: body.mime,
      bytes: body.bytes,
      sha256: body.sha256
    }
  }
}

/** Thrown when content-service returns 413. */
export class TooLargeError extends Error {
  readonly kind = 'TooLargeError' as const
  constructor(message: string) {
    super(message)
    this.name = 'TooLargeError'
  }
}

/** Thrown when content-service returns 415. */
export class UnsupportedMimeError extends Error {
  readonly kind = 'UnsupportedMimeError' as const
  constructor(message: string) {
    super(message)
    this.name = 'UnsupportedMimeError'
  }
}
