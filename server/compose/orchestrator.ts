/**
 * composeMessage — pure async orchestration function.
 *
 * Accepts a ComposeEnvelope + injected clients, orchestrates:
 *   1. Validate envelope (synchronous)
 *   2. Transcribe audio + upload attachments in parallel (via Promise.all)
 *   3. Build final body string
 *   4. Send to relay
 *
 * All-or-nothing: any failure in any step returns a ComposeError result.
 * Nothing is delivered if any step fails.
 *
 * Portability: no Bun/Node I/O in this file. Only clients (interfaces) and
 * envelope types. Copy-paste this file into relay or .NET when migrating.
 */

import { trace, SpanStatusCode } from '@opentelemetry/api'
import type { ComposeEnvelope, ComposeResult, ComposedAttachment } from './envelope.ts'
import type { IWhisperClient } from './clients/WhisperClient.ts'
import type { IContentServiceClient } from './clients/ContentServiceClient.ts'
import type { IRelaySendClient } from './clients/RelaySendClient.ts'
import { TooLargeError, UnsupportedMimeError } from './clients/ContentServiceClient.ts'

const tracer = trace.getTracer('voice-bridge-server')

// ── Internal helpers ───────────────────────────────────────────────────────────

/**
 * Tagged error wrapping a sub-step failure.
 * Used so Promise.all() rejections can be classified by stage without
 * inspecting error message text.
 */
class StageError extends Error {
  constructor(
    readonly stage: 'transcribe' | 'upload',
    message: string
  ) {
    super(message)
    this.name = 'StageError'
  }
}

// ── Dependencies ───────────────────────────────────────────────────────────────

export interface ComposeDeps {
  whisper: IWhisperClient
  contentService: IContentServiceClient
  relay: IRelaySendClient
}

// ── Body composition rule (from proposal) ─────────────────────────────────────
//
// text ?? "" + (audio ? "\n\n" + transcript : "") + attachments.map(a => "\n\n[Attachment: <url>]").join("")

function buildBody(
  text: string | undefined,
  transcript: string | undefined,
  attachmentUrls: ComposedAttachment[]
): string {
  let body = text ?? ''
  if (transcript !== undefined && transcript.length > 0) {
    body += (body.length > 0 ? '\n\n' : '') + transcript
  }
  for (const att of attachmentUrls) {
    body += (body.length > 0 ? '\n\n' : '') + `[Attachment: ${att.url}]`
  }
  return body
}

// ── Main orchestrator ──────────────────────────────────────────────────────────

export async function composeMessage(
  envelope: ComposeEnvelope,
  deps: ComposeDeps
): Promise<ComposeResult> {
  // replyTo is a pass-through field (future use); not consumed in v1.
  const { to, text, audio, attachments } = envelope

  // ── Validate ───────────────────────────────────────────────────────────────
  // Must have at least one modality: text, audio, or attachments.
  const hasText = typeof text === 'string' && text.trim().length > 0
  const hasAudio = audio !== undefined
  const hasAttachments = attachments.length > 0

  if (!hasText && !hasAudio && !hasAttachments) {
    return {
      ok: false,
      httpStatus: 400,
      error: {
        error: 'validation_failed',
        message: 'At least one of text, audio, or attachments is required',
        stage: 'validate'
      }
    }
  }

  // ── Transcribe + Upload in parallel ───────────────────────────────────────
  //
  // We tag each promise with the stage name so that when Promise.all() rejects,
  // we know which sub-operation failed without inspecting error message text.

  type TaggedResult =
    | { stage: 'transcribe'; transcript: string | undefined }
    | { stage: 'upload'; index: number; attachment: ComposedAttachment }

  const taggedPromises: Array<Promise<TaggedResult>> = []

  if (hasAudio) {
    const transcribeSpan = tracer.startSpan('compose.transcribe', {
      attributes: { 'audio.size_bytes': audio.buffer.byteLength },
    })
    taggedPromises.push(
      deps.whisper
        .transcribe(audio.buffer, audio.mime)
        .then((r): TaggedResult => {
          const t = r.transcript.length > 0 ? r.transcript : undefined
          transcribeSpan.setAttribute('whisper.transcript', (t ?? '').slice(0, 200))
          transcribeSpan.end()
          return { stage: 'transcribe', transcript: t }
        })
        .catch((err: unknown) => {
          const e = err instanceof Error ? err : new Error(String(err))
          transcribeSpan.recordException(e)
          transcribeSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
          transcribeSpan.end()
          throw new StageError('transcribe', e.message)
        })
    )
  }

  for (let i = 0; i < attachments.length; i++) {
    const att = attachments[i]
    if (att === undefined) continue
    const uploadSpan = tracer.startSpan('compose.upload-attachment', {
      attributes: { 'content.mime': att.mime, 'content.bytes': att.buffer.byteLength },
    })
    taggedPromises.push(
      deps.contentService
        .upload(att.buffer, att.mime, att.filename)
        .then((attachment): TaggedResult => {
          uploadSpan.setAttribute('content.sha256', attachment.sha256)
          uploadSpan.end()
          return { stage: 'upload', index: i, attachment }
        })
        .catch((err: unknown) => {
          const e = err instanceof Error ? err : new Error(String(err))
          uploadSpan.recordException(e)
          uploadSpan.setStatus({ code: SpanStatusCode.ERROR, message: e.message })
          uploadSpan.end()
          throw err
        })
    )
  }

  let transcript: string | undefined
  const attachmentResults: ComposedAttachment[] = []

  try {
    const results = await Promise.all(taggedPromises)
    for (const r of results) {
      if (r.stage === 'transcribe') {
        transcript = r.transcript
      } else {
        attachmentResults[r.index] = r.attachment
      }
    }
  } catch (err) {
    // Classify the error by type — no `as` casts, use `instanceof`.
    if (err instanceof TooLargeError) {
      return {
        ok: false,
        httpStatus: 413,
        error: {
          error: 'attachment_too_large',
          message: err.message,
          stage: 'upload'
        }
      }
    }
    if (err instanceof UnsupportedMimeError) {
      return {
        ok: false,
        httpStatus: 415,
        error: {
          error: 'unsupported_mime',
          message: err.message,
          stage: 'upload'
        }
      }
    }
    if (err instanceof StageError) {
      if (err.stage === 'transcribe') {
        return {
          ok: false,
          httpStatus: 502,
          error: {
            error: 'whisper_unavailable',
            message: err.message,
            stage: 'transcribe'
          }
        }
      }
    }
    const msg = err instanceof Error ? err.message : String(err)
    return {
      ok: false,
      httpStatus: 502,
      error: {
        error: 'content_service_unavailable',
        message: msg,
        stage: 'upload'
      }
    }
  }

  // ── No-speech check ────────────────────────────────────────────────────────
  // If audio was supplied but whisper returned empty and there is no text
  // or attachments to fall back on, return 422.
  if (hasAudio && transcript === undefined && !hasText && !hasAttachments) {
    return {
      ok: false,
      httpStatus: 422,
      error: {
        error: 'no_speech',
        message: 'Whisper detected no speech in the audio',
        stage: 'transcribe'
      }
    }
  }

  // ── Build body ─────────────────────────────────────────────────────────────
  const body = buildBody(text, transcript, attachmentResults)

  if (body.trim().length === 0) {
    return {
      ok: false,
      httpStatus: 400,
      error: {
        error: 'validation_failed',
        message: 'Composed body is empty — nothing to send',
        stage: 'validate'
      }
    }
  }

  // ── Deliver via relay ──────────────────────────────────────────────────────
  let relayResult: { id: string; status: 'delivered' | 'queued' } | undefined
  let relayErr: Error | undefined
  const deliverSpan = tracer.startSpan('compose.deliver', { attributes: { 'relay.to': to } })
  try {
    relayResult = await deps.relay.send({ from: 'ceo', to, body, type: 'message' })
    deliverSpan.setAttribute('relay.message_id', relayResult.id)
    deliverSpan.setAttribute('relay.status', relayResult.status)
  } catch (err) {
    relayErr = err instanceof Error ? err : new Error(String(err))
    deliverSpan.recordException(relayErr)
    deliverSpan.setStatus({ code: SpanStatusCode.ERROR, message: relayErr.message })
  } finally {
    deliverSpan.end()
  }
  if (relayErr !== undefined || relayResult === undefined) {
    return {
      ok: false,
      httpStatus: 502,
      error: {
        error: 'relay_unavailable',
        message: relayErr?.message ?? 'relay send returned no result',
        stage: 'deliver'
      }
    }
  }

  return {
    ok: true,
    value: {
      delivered: true,
      to,
      transcript,
      attachmentUrls: attachmentResults,
      body,
      messageId: relayResult.id,
      ts: new Date().toISOString()
    }
  }
}
