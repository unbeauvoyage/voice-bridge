/**
 * POST /transcribe handler — receives audio, transcribes via Whisper, routes to agent.
 *
 * Audio deduplication prevents WKWebView retries (slow Whisper transcription)
 * from flooding the relay with duplicate messages.
 *
 * Boundary validation (Stage-4 codex finding transcribe.ts:61 HIGH — no
 * upload cap): the handler rejects oversized or non-audio bodies BEFORE
 * spending CPU on formData parsing and WAV expansion.
 *   - Content-Length over MAX_BODY_BYTES → 413 before req.formData()
 *   - audio File size over MAX_AUDIO_BYTES → 413
 *   - audio MIME not in ALLOWED_AUDIO_MIME → 415
 *   - `to` field longer than MAX_TO_LEN → 400
 *
 * Routing logic:
 * 1. If "please" in first 7 words → llmRoute detects agent (OVERRIDES explicit `to`)
 * 2. Else if explicit `to` set → use it, full transcript
 * 3. Else → deliver to "command"
 */

import { transcribeAudio } from '../whisper.ts'
import { deliverToAgent } from '../relay.ts'
import { deliverViaCmux } from '../cmux.ts'
import { llmRoute } from '../llmRouter.ts'
import { isCancelCommand } from '../cancelUtils.ts'
import { DEDUP_WAIT_DEADLINE_MS } from '../config.ts'

// Body size: 10 MiB absolute cap at the HTTP boundary. A 60s voice message
// at webm/opus ~32kbps is ~240 KiB, so this is ~40× typical; legitimate
// traffic will never hit it.
const MAX_BODY_BYTES = 10 * 1024 * 1024
// Audio file cap — slightly tighter than body so non-audio form overhead
// (headers, boundary markers) cannot push us near the body limit.
const MAX_AUDIO_BYTES = 8 * 1024 * 1024
// MIME allowlist. Anything else (including octet-stream, text/*) is 415.
const ALLOWED_AUDIO_MIME = new Set([
  'audio/webm',
  'audio/ogg',
  'audio/wav',
  'audio/x-wav',
  'audio/mp4',
  'audio/mpeg',
  'audio/aac',
  'audio/flac'
])
// Reasonable cap for a routing target name. Longer strings are almost
// certainly hostile or buggy.
const MAX_TO_LEN = 128

/**
 * Deduplication state: tracks recent audio by hash to prevent WKWebView retries
 * from spamming the relay.
 */
export type DedupEntry =
  | { ts: number; transcript: string; to: string; message: string }
  | { ts: number; inProgress: true }

/**
 * Context object passed to the transcribe handler.
 * All shared state and dependencies needed by the handler.
 */
export type TranscribeContext = {
  // Audio dedup state and operations
  recentAudioHashes: Map<string, DedupEntry>
  evictStaleHashes: () => void
  hashAudioBuffer: (buf: Buffer) => string

  // Target (sticky routing destination)
  loadLastTarget: () => string
  saveLastTarget: (target: string) => void

  // Mic control (voice commands can pause/resume)
  handleMicCommand: (transcript: string) => { handled: true; state: 'on' | 'off' } | null

  // Agent discovery (for "please" routing)
  getKnownAgents: () => Promise<string[]>
}

/**
 * Handle POST /transcribe: receive audio, transcribe, route to agent.
 *
 * @param req HTTP request with multipart form data (audio file)
 * @param ctx Shared state and dependencies
 * @returns Response with JSON body: { transcript, to, message, ... } or error
 */
export async function handleTranscribe(req: Request, ctx: TranscribeContext): Promise<Response> {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

  // ── Preflight: reject oversized bodies BEFORE formData parsing ───────────
  // A hostile/broken client sending a 100 MiB payload would otherwise be
  // fully buffered, copied to arrayBuffer(), and expanded to WAV before
  // any size check. Reading Content-Length is cheap and catches the common
  // case; we still enforce the real file size after parsing.
  const contentLengthHeader = req.headers.get('content-length')
  if (contentLengthHeader !== null) {
    const declared = Number(contentLengthHeader)
    if (Number.isFinite(declared) && declared > MAX_BODY_BYTES) {
      return Response.json(
        { error: 'Request body too large' },
        { status: 413, headers: corsHeaders }
      )
    }
  }

  // ── Parse form data ───────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await req.formData()
  } catch {
    return Response.json({ error: 'Invalid form data' }, { status: 400, headers: corsHeaders })
  }

  // ── Extract form fields ────────────────────────────────────────────────────
  const audioFile = formData.get('audio')
  const transcribeOnly = formData.get('transcribe_only') === '1'
  const toField = formData.get('to')
  const explicitTo = typeof toField === 'string' ? toField.trim() : ''
  if (explicitTo.length > MAX_TO_LEN) {
    return Response.json(
      { error: `\`to\` field exceeds ${MAX_TO_LEN} chars` },
      { status: 400, headers: corsHeaders }
    )
  }
  let to = explicitTo || ctx.loadLastTarget()

  if (!audioFile || !(audioFile instanceof File)) {
    return Response.json({ error: 'Missing audio field' }, { status: 400, headers: corsHeaders })
  }

  // ── Audio size + MIME validation ──────────────────────────────────────────
  if (audioFile.size > MAX_AUDIO_BYTES) {
    return Response.json(
      { error: 'Audio file too large' },
      { status: 413, headers: corsHeaders }
    )
  }
  const audioMime = audioFile.type || 'audio/webm'
  if (!ALLOWED_AUDIO_MIME.has(audioMime)) {
    return Response.json(
      { error: `Unsupported audio MIME: ${audioMime}` },
      { status: 415, headers: corsHeaders }
    )
  }

  // ── Audio buffer + dedup ───────────────────────────────────────────────────
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
  const mimeType = audioFile.type || 'audio/webm'
  console.log(`[voice-bridge] audio received: ${audioBuffer.length} bytes, mime: ${mimeType}`)

  // Dedup: reject if same audio bytes seen within 30s (WKWebView retry on slow Whisper)
  ctx.evictStaleHashes()
  const audioHash = ctx.hashAudioBuffer(audioBuffer)
  const existing = ctx.recentAudioHashes.get(audioHash)
  if (existing) {
    console.log(`[voice-bridge] duplicate audio detected (hash=${audioHash})`)
    if ('inProgress' in existing) {
      // First request still transcribing — wait for it to complete rather than returning empty,
      // because returning empty causes the phone to freeze in "transcribing" state (Tailscale latency triggers WKWebView retries)
      const deadline = Date.now() + DEDUP_WAIT_DEADLINE_MS
      while (Date.now() < deadline) {
        await Bun.sleep(300)
        const updated = ctx.recentAudioHashes.get(audioHash)
        if (!updated || !('inProgress' in updated)) {
          if (updated) {
            console.log(`[voice-bridge] duplicate resolved after wait, returning cached transcript`)
            return Response.json(
              { transcript: updated.transcript, to: updated.to, deduplicated: true },
              { headers: corsHeaders }
            )
          }
          break
        }
      }
      return Response.json({ transcript: '', deduplicated: true }, { headers: corsHeaders })
    }
    // First request already completed — return cached result, skip relay
    return Response.json(
      { transcript: existing.transcript, to: existing.to, deduplicated: true },
      { headers: corsHeaders }
    )
  }
  ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), inProgress: true })

  // ── Transcribe ─────────────────────────────────────────────────────────────
  let transcript: string
  try {
    transcript = await transcribeAudio(audioBuffer, mimeType)
  } catch (err) {
    console.error('[whisper] transcription failed:', err)
    return Response.json(
      { error: 'Transcription failed: ' + String(err) },
      { status: 500, headers: corsHeaders }
    )
  }

  if (!transcript) {
    return Response.json(
      { error: 'Empty transcription — no speech detected' },
      { status: 422, headers: corsHeaders }
    )
  }

  // ── Cancel detection ───────────────────────────────────────────────────────
  // >=2 "cancel" in last 10 words → discard recording
  if (isCancelCommand(transcript)) {
    const tailText = transcript.trim().split(/\s+/).slice(-10).join(' ')
    const cancelCount = (tailText.match(/\bcancel\b/gi) ?? []).length
    console.log(
      `[voice-bridge] cancelled (${cancelCount}x "cancel" in last 10 words) — discarding: "${transcript}"`
    )
    return Response.json({ transcript, cancelled: true }, { headers: corsHeaders })
  }

  // ── Test mode ──────────────────────────────────────────────────────────────
  // If transcript starts with "test" skip relay entirely
  const isTest = /^test\b/i.test(transcript)
  if (isTest) {
    console.log(`[voice-bridge] test mode — skipping relay: ${transcript}`)
    return Response.json({ transcript, test: true }, { headers: corsHeaders })
  }

  // ── Mic control commands ───────────────────────────────────────────────────
  // Handled before routing, from any source (phone or Mac)
  const micCmd = ctx.handleMicCommand(transcript)
  if (micCmd) {
    console.log(
      `[mic] ${micCmd.state === 'off' ? 'PAUSED' : 'RESUMED'} via voice command: "${transcript}"`
    )
    return Response.json({ transcript, mic: micCmd.state, command: true }, { headers: corsHeaders })
  }

  // ── Routing logic ──────────────────────────────────────────────────────────
  // Three cases (in priority order):
  //
  // 1. Explicit `to` + no "please" in first 7 words → use explicit `to`, full transcript, skip llmRoute.
  // 2. "please" found in first 7 words (even if explicit `to` is set) → llmRoute OVERRIDES.
  //      routingPart = text BEFORE "please" → passed to llmRoute to detect agent
  //      messagePart = text AFTER "please" (trimmed) → the actual message body to deliver
  //    llmRoute returns an agent → deliver messagePart to that agent.
  //    llmRoute fails/returns nothing → fall back to explicit `to`, or "command" if no explicit `to`.
  // 3. No "please" in first 7 words, no explicit `to` → deliver full transcript to "command".

  let message: string

  // Detect "please" only within the first 7 words (case-insensitive).
  // We match the word boundary for "please" and check its position.
  const words = transcript.trimStart().split(/\s+/)
  const pleaseIndex = words.slice(0, 7).findIndex((w) => /^please$/i.test(w))
  const pleaseInFirst7 = pleaseIndex !== -1

  if (pleaseInFirst7) {
    // Case 2: "please" in first 7 words — llmRoute OVERRIDES explicit `to`.
    // Pass everything up to and including "please" to llmRoute so it can detect the agent.
    const routingPart = words.slice(0, pleaseIndex + 1).join(' ') // words up to and including "please"
    const messagePart = words
      .slice(pleaseIndex + 1)
      .join(' ')
      .trim() // words after "please"
    console.log(
      `[route] please-gate (word ${pleaseIndex + 1}): routingPart="${routingPart}", messagePart="${messagePart}"`
    )
    const llmResult = await llmRoute(routingPart, await ctx.getKnownAgents(), '')
    const fallback = explicitTo || 'command'
    to = llmResult.agent || fallback
    message = messagePart || transcript // fallback to full transcript if nothing after "please"
    if (llmResult.agentChanged) {
      ctx.saveLastTarget(to)
    }
    console.log(`[route] → ${to} (please-gate, changed=${llmResult.agentChanged}): "${message}"`)
  } else if (explicitTo) {
    // Case 1: Explicit UI selection, no "please" in first 7 words — honour it, full transcript.
    to = explicitTo
    message = transcript
    ctx.saveLastTarget(to)
    console.log(`[route] → ${to} (explicit, sticky updated): "${message}"`)
  } else {
    // Case 3: No "please" in first 7 words, no explicit `to` — deliver full transcript to "command".
    to = 'command'
    message = transcript
    console.log(`[route] → ${to} (no-please, direct): "${message}"`)
  }

  // ── Update dedup cache ─────────────────────────────────────────────────────
  // Upgrade hash entry from in-progress → resolved so retries get cached transcript
  ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), transcript, to, message })

  // ── transcribe_only mode ───────────────────────────────────────────────────
  // App will send the message itself after user confirms
  if (transcribeOnly) {
    console.log(`[voice-bridge] transcribe_only — skipping relay delivery, target="${to}"`)
    return Response.json({ transcript, to }, { headers: corsHeaders })
  }

  // ── Deliver to agent ───────────────────────────────────────────────────────
  try {
    await deliverToAgent(message, to)
    console.log(`[relay] → ${to}: ${message}`)
  } catch (err) {
    console.error(
      '[voice-bridge] relay delivery failed:',
      err instanceof Error ? err.message : String(err)
    )
    // Relay not running — fall back to direct cmux injection
    try {
      deliverViaCmux(message, to)
      console.log(`[cmux] → ${to}: ${message}`)
    } catch (cmuxErr) {
      console.warn('[cmux] delivery failed:', cmuxErr)
    }
  }

  return Response.json({ transcript, to, message }, { headers: corsHeaders })
}
