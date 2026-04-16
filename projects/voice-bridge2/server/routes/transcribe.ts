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

import type { TranscribeResult } from '../whisper.ts'
import type { LlmRouteResult } from '../llmRouter.ts'
import { isCancelCommand } from '../cancelUtils.ts'
import { DEDUP_WAIT_DEADLINE_MS } from '../config.ts'
import { type DedupEntry, checkDedupEntry, isWhisperHallucination } from './dedup.ts'

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
 * Context object passed to the transcribe handler.
 * All shared state and dependencies needed by the handler.
 */
export type DeliveryResult = { ok: true } | { ok: false; error: string }

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

  // Audio transcription — injected so tests can stub without mock.module()
  transcribeAudio: (buffer: Buffer, mimeType: string) => Promise<TranscribeResult>

  // LLM-based agent routing — injected so tests can stub without mock.module()
  llmRoute: (transcript: string, knownAgents: string[], fallbackAgent: string) => Promise<LlmRouteResult>

  // Message delivery. The wiring layer composes relay-first-cmux-fallback
  // and returns {ok: false} only when BOTH channels have failed. The
  // handler surfaces that as 502 instead of the old silent 200.
  deliverMessage: (message: string, to: string) => Promise<DeliveryResult>

  // Optional override for the dedup-waiter deadline. Defaults to the
  // production constant from config.ts when omitted; tests inject a
  // small value so the retry/timeout paths can be exercised quickly.
  dedupWaitDeadlineMs?: number
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

  // ── Preflight + streaming accounting ─────────────────────────────────────
  // Three-layer defense against oversized bodies (Stage-4 codex
  // chunk2-review HIGH2):
  //   1. Bun.serve maxRequestBodySize (set in server/index.ts) enforces at
  //      parser level for honest Content-Length.
  //   2. Content-Length preflight here — cheap, catches honest-CL DoS
  //      before we touch the body.
  //   3. Streaming accounting below — Bun's maxRequestBodySize does NOT
  //      fire for Transfer-Encoding: chunked / streamed bodies (verified
  //      repro on Bun 1.3.3), so we count bytes ourselves as they arrive
  //      and abort the moment the cap is exceeded, WITHOUT buffering the
  //      full hostile payload.
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

  // Drain req.body with a byte budget when the request has a streaming
  // body. Any chunk that pushes the running total past MAX_BODY_BYTES
  // aborts the stream and returns 413. When req.body is null (no body,
  // or a unit-test Request stub), fall through to req.formData() directly.
  //
  // Memory: during streaming we retain up to MAX_BODY_BYTES + one chunk
  // (the over-limit chunk that triggers rejection is read but discarded).
  // On the success path Buffer.concat doubles this transiently, and
  // audioFile.arrayBuffer() later materializes the file a third time; a
  // near-cap legitimate upload can hold ~2× MAX_BODY_BYTES for a moment
  // before transcription. This is acceptable given the 10 MiB cap.
  let formData: FormData
  if (req.body) {
    const chunks: Uint8Array[] = []
    let totalBytes = 0
    const reader = req.body.getReader()
    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break
        totalBytes += value.byteLength
        if (totalBytes > MAX_BODY_BYTES) {
          // Fire-and-forget cancel: a hostile client could return a
          // never-resolving or rejecting promise from its ReadableStream's
          // cancel(), which would hang or crash this handler if awaited.
          // We've decided to return 413 — cancel is best-effort cleanup.
          void reader.cancel().catch(() => {})
          return Response.json(
            { error: 'Request body too large' },
            { status: 413, headers: corsHeaders }
          )
        }
        chunks.push(value)
      }
    } finally {
      reader.releaseLock()
    }
    try {
      const bodyBuf = Buffer.concat(chunks)
      const parseReq = new Response(bodyBuf, { headers: req.headers })
      formData = await parseReq.formData()
    } catch {
      return Response.json({ error: 'Invalid form data' }, { status: 400, headers: corsHeaders })
    }
  } else {
    try {
      formData = await req.formData()
    } catch {
      return Response.json({ error: 'Invalid form data' }, { status: 400, headers: corsHeaders })
    }
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
  // Require an explicit allowed MIME — blank/missing used to fall through
  // via `|| 'audio/webm'`, so a File with type='' reached ffmpeg/Whisper
  // and failed as 500. Boundary rejects it as 415 now.
  const audioMime = audioFile.type
  if (!audioMime || !ALLOWED_AUDIO_MIME.has(audioMime)) {
    return Response.json(
      { error: `Unsupported audio MIME: ${audioMime || '(blank)'}` },
      { status: 415, headers: corsHeaders }
    )
  }

  // ── Audio buffer + dedup ───────────────────────────────────────────────────
  const audioBuffer = Buffer.from(await audioFile.arrayBuffer())
  console.log(`[voice-bridge] audio received: ${audioBuffer.length} bytes, mime: ${audioMime}`)

  // Dedup: reject if same audio bytes seen within 30s (WKWebView retry on slow Whisper)
  ctx.evictStaleHashes()
  const audioHash = ctx.hashAudioBuffer(audioBuffer)
  const existing = ctx.recentAudioHashes.get(audioHash)
  const waitDeadlineMs = ctx.dedupWaitDeadlineMs ?? DEDUP_WAIT_DEADLINE_MS
  if (existing) {
    console.log(`[voice-bridge] duplicate audio detected (hash=${audioHash})`)
    const dedupResult = await checkDedupEntry(existing, audioHash, ctx.recentAudioHashes, waitDeadlineMs, corsHeaders)
    if (dedupResult.kind === 'response') {
      return dedupResult.response
    }
    // kind === 'fallthrough': original failed mid-wait — re-process below
  }
  ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), inProgress: true })

  // ── Transcribe ─────────────────────────────────────────────────────────────
  // Chunk-4 HIGH (transcribe.ts:240 error-return sites): we marked the hash
  // as { inProgress: true } above so concurrent in-flight retries wait for
  // us. Every early-return below MUST clear that entry — otherwise retries
  // within DEDUP_WINDOW_MS wait on a ghost "inProgress" entry and the phone
  // freezes in "transcribing" state.
  let transcript: string
  let audioRms: number
  try {
    const result = await ctx.transcribeAudio(audioBuffer, audioMime)
    transcript = result.transcript
    audioRms = result.audioRms
  } catch (err) {
    console.error('[whisper] transcription failed:', err)
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json(
      { error: 'Transcription failed: ' + String(err) },
      { status: 500, headers: corsHeaders }
    )
  }

  if (!transcript) {
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json(
      { error: 'Empty transcription — no speech detected' },
      { status: 422, headers: corsHeaders }
    )
  }

  // ── Whisper hallucination filter ───────────────────────────────────────────
  // Defense-in-depth against the feedback loop that caused 23 identical
  // "hello" responses in 2 min: when TTS audio bleeds back into the mic,
  // Whisper's artifact is a known single-phrase hallucination ("hello",
  // "thank you", etc.). If the audio RMS is also below the low threshold,
  // treat it as cancelled rather than delivering to an agent.
  //
  // RMS comes from transcribeAudio() which computes it over the ffmpeg-converted
  // pcm_s16le WAV buffer, scanning for the RIFF 'data' subchunk (not a fixed
  // 44-byte offset). This ensures correct RMS for any input format (webm, ogg,
  // mp4, etc.) — not just canonical WAV uploads.
  if (isWhisperHallucination(transcript, audioRms)) {
    console.log(
      `[voice-bridge] whisper hallucination suppressed (transcript="${transcript}", rms=${audioRms.toFixed(1)})`
    )
    // Fix 2: promote to terminal cancelled entry instead of deleting.
    // Deleting caused concurrent duplicates in the wait loop to see the
    // entry vanish → treat it as "original failed" → re-run whisper →
    // hallucinate again → deliver another "hello" to the agent.
    // A cancelled entry lets the wait loop return { cancelled: true,
    // deduplicated: true } without re-running whisper.
    ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), cancelled: true, transcript })
    return Response.json(
      { transcript, cancelled: true, reason: 'whisper-hallucination' },
      { headers: corsHeaders }
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
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json({ transcript, cancelled: true }, { headers: corsHeaders })
  }

  // ── Test mode ──────────────────────────────────────────────────────────────
  // If transcript starts with "test" skip relay entirely
  const isTest = /^test\b/i.test(transcript)
  if (isTest) {
    console.log(`[voice-bridge] test mode — skipping relay: ${transcript}`)
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json({ transcript, test: true }, { headers: corsHeaders })
  }

  // ── Mic control commands ───────────────────────────────────────────────────
  // Handled before routing, from any source (phone or Mac)
  const micCmd = ctx.handleMicCommand(transcript)
  if (micCmd) {
    console.log(
      `[mic] ${micCmd.state === 'off' ? 'PAUSED' : 'RESUMED'} via voice command: "${transcript}"`
    )
    ctx.recentAudioHashes.delete(audioHash)
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
    const llmResult = await ctx.llmRoute(routingPart, await ctx.getKnownAgents(), '')
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

  // ── transcribe_only mode ───────────────────────────────────────────────────
  // App will send the message itself after user confirms. There is no
  // delivery phase to race against, so it is safe to promote the cache
  // entry to a resolved result here — duplicates within the window get
  // the cached transcript back.
  if (transcribeOnly) {
    console.log(`[voice-bridge] transcribe_only — skipping relay delivery, target="${to}"`)
    ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), transcript, to, message })
    return Response.json({ transcript, to }, { headers: corsHeaders })
  }

  // ── Deliver to agent ───────────────────────────────────────────────────────
  // Chunk-4 #4 MED: the cache entry stays as {inProgress:true} across
  // the delivery await so that a duplicate arriving mid-delivery blocks
  // on the in-progress branch instead of reading a premature resolved
  // entry. Only on a successful delivery do we promote it; on failure
  // we delete, so a retry gets a fresh attempt at delivery.
  //
  // Chunk-4 #2 HIGH: previously, if both the relay and the cmux fallback
  // failed, the handler swallowed the error and returned 200 — CEO saw
  // "message sent" for a message that never landed. All delivery now
  // routes through ctx.deliverMessage (composed relay-then-cmux in the
  // wiring layer). A failing result surfaces as 502 with the transcript
  // preserved in the body so the UI can still display what was heard.
  const delivery = await ctx.deliverMessage(message, to)
  if (!delivery.ok) {
    console.error(`[voice-bridge] delivery failed: ${delivery.error}`)
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json(
      { transcript, to, message, delivered: false, error: delivery.error },
      { status: 502, headers: corsHeaders }
    )
  }
  // Only promote to a resolved cache entry AFTER delivery succeeds.
  ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), transcript, to, message })
  console.log(`[delivery] → ${to}: ${message}`)
  return Response.json(
    { transcript, to, message, delivered: true },
    { headers: corsHeaders }
  )
}
