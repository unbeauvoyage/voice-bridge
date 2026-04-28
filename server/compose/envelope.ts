/**
 * Compose envelope types — derived from docs/openapi.yaml /compose schema.
 *
 * No Zod, no hand-rolled validation. These are plain TypeScript types that
 * mirror the OpenAPI schema. The OpenAPI spec is the contract; these types
 * make that contract explicit in the type system.
 *
 * Portability: this file is pure types — no imports from Bun or Node. It can
 * be copy-pasted into the relay or a .NET project (as C# records) unchanged.
 */

/** The incoming envelope parsed from the multipart form body. */
export interface ComposeEnvelope {
  /** Recipient agent name. Required. */
  to: string
  /** Optional typed text body. */
  text?: string
  /** Optional audio bytes + MIME, to be transcribed via whisper. */
  audio?: {
    buffer: Buffer
    mime: string
    filename: string
  }
  /** Optional binary attachments to upload to content-service. */
  attachments: Array<{
    buffer: Buffer
    mime: string
    filename: string
  }>
  /** Optional message id this is replying to (pass-through today). */
  replyTo?: string
}

/** Successful compose result. */
export interface ComposeSuccess {
  delivered: true
  to: string
  /** Present iff audio was supplied and transcription succeeded. */
  transcript?: string
  /** One entry per uploaded attachment. */
  attachmentUrls: ComposedAttachment[]
  /** The final composed body string sent to the agent. */
  body: string
  /** id returned by relay /send. */
  messageId: string
  /** ISO-8601 timestamp. */
  ts: string
}

/** An uploaded attachment's metadata. */
export interface ComposedAttachment {
  url: string
  mime: string
  bytes: number
  sha256: string
}

/** Error result from any stage. */
export type ComposeErrorCode =
  | 'no_speech'
  | 'attachment_too_large'
  | 'unsupported_mime'
  | 'whisper_unavailable'
  | 'content_service_unavailable'
  | 'relay_unavailable'
  | 'validation_failed'

export type ComposeStage = 'validate' | 'transcribe' | 'upload' | 'deliver'

export interface ComposeError {
  delivered?: false
  error: ComposeErrorCode
  message?: string
  stage?: ComposeStage
}

/** Discriminated union result from composeMessage(). */
export type ComposeResult =
  | { ok: true; value: ComposeSuccess }
  | { ok: false; error: ComposeError; httpStatus: 400 | 413 | 415 | 422 | 502 }
