/**
 * POST /compose — thin route handler.
 *
 * Responsibilities:
 *   1. Parse multipart form body into a ComposeEnvelope
 *   2. Call composeMessage() with production clients
 *   3. Map ComposeResult → HTTP response (status + JSON body)
 *
 * No business logic here. All orchestration is in server/compose/orchestrator.ts.
 *
 * Accepted multipart fields:
 *   to          (required) — string, recipient agent name
 *   text        (optional) — string, typed text body
 *   audio       (optional) — binary, audio file (any MIME)
 *   attachments (optional, repeatable) — binary, image attachments
 *   replyTo     (optional) — string, message id this replies to
 */

import { composeMessage } from '../compose/orchestrator.ts'
import { HttpWhisperClient } from '../compose/clients/WhisperClient.ts'
import { HttpContentServiceClient } from '../compose/clients/ContentServiceClient.ts'
import { HttpRelaySendClient } from '../compose/clients/RelaySendClient.ts'
import type { ComposeEnvelope } from '../compose/envelope.ts'
import { WHISPER_BASE_URL_DEFAULT, RELAY_BASE_URL_DEFAULT } from '../config.ts'

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*' } as const

const CONTENT_SERVICE_BASE_URL_DEFAULT = 'http://127.0.0.1:8770'

function getWhisperUrl(): string {
  return process.env['WHISPER_URL'] ?? WHISPER_BASE_URL_DEFAULT
}

function getRelayBaseUrl(): string {
  return process.env['RELAY_BASE_URL'] ?? RELAY_BASE_URL_DEFAULT
}

function getContentServiceBaseUrl(): string {
  return process.env['CONTENT_SERVICE_URL'] ?? CONTENT_SERVICE_BASE_URL_DEFAULT
}

/**
 * Parse a Bun multipart FormData into a ComposeEnvelope.
 * Returns an error string if the envelope is structurally invalid (missing `to`).
 */
async function parseEnvelope(
  req: Request
): Promise<{ ok: true; envelope: ComposeEnvelope } | { ok: false; message: string }> {
  let formData: FormData
  try {
    formData = await req.formData()
  } catch (err) {
    return {
      ok: false,
      message: `Failed to parse multipart body: ${err instanceof Error ? err.message : String(err)}`
    }
  }

  const toField = formData.get('to')
  if (toField === null || typeof toField !== 'string' || toField.trim().length === 0) {
    return { ok: false, message: '`to` field is required and must be a non-empty string' }
  }
  const to = toField.trim()
  if (to.length > 128) {
    return { ok: false, message: '`to` field must not exceed 128 characters' }
  }

  const textField = formData.get('text')
  const text = typeof textField === 'string' ? textField : undefined

  const replyToField = formData.get('replyTo')
  const replyTo = typeof replyToField === 'string' ? replyToField : undefined

  // Audio — single file field
  const audioField = formData.get('audio')
  let audio: ComposeEnvelope['audio']
  if (audioField instanceof File) {
    const buffer = Buffer.from(await audioField.arrayBuffer())
    audio = {
      buffer,
      mime: audioField.type || 'audio/webm',
      filename: audioField.name || 'recording'
    }
  }

  // Attachments — may have multiple files under 'attachments' key
  const attachmentFiles = formData.getAll('attachments')
  const attachments: ComposeEnvelope['attachments'] = []
  for (const att of attachmentFiles) {
    if (att instanceof File) {
      const buffer = Buffer.from(await att.arrayBuffer())
      attachments.push({
        buffer,
        mime: att.type || 'application/octet-stream',
        filename: att.name || 'attachment'
      })
    }
  }

  const envelope: ComposeEnvelope = {
    to,
    attachments,
    ...(text !== undefined ? { text } : {}),
    ...(audio !== undefined ? { audio } : {}),
    ...(replyTo !== undefined ? { replyTo } : {}),
  }
  return { ok: true, envelope }
}

/**
 * Handle POST /compose.
 */
export async function handleCompose(req: Request): Promise<Response> {
  // Parse multipart body
  const parseResult = await parseEnvelope(req)
  if (!parseResult.ok) {
    return Response.json(
      { error: 'validation_failed', message: parseResult.message, stage: 'validate' },
      { status: 400, headers: CORS_HEADERS }
    )
  }

  const { envelope } = parseResult

  // Build production clients
  const whisperClient = new HttpWhisperClient(getWhisperUrl())
  const contentServiceClient = new HttpContentServiceClient(getContentServiceBaseUrl())
  const relaySendClient = new HttpRelaySendClient(getRelayBaseUrl())

  // Orchestrate
  const result = await composeMessage(envelope, {
    whisper: whisperClient,
    contentService: contentServiceClient,
    relay: relaySendClient
  })

  if (!result.ok) {
    return Response.json(result.error, { status: result.httpStatus, headers: CORS_HEADERS })
  }

  return Response.json(result.value, { status: 200, headers: CORS_HEADERS })
}
