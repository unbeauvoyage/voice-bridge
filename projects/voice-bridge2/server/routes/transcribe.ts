/**
 * POST /transcribe handler — orchestrator.
 *
 * Sub-modules: transcribe-parse.ts (request validation), transcribe-route.ts
 * (agent routing), dedup.ts (audio dedup + hallucination filter).
 */
import { isCancelCommand } from '../cancelUtils.ts'
import { DEDUP_WAIT_DEADLINE_MS } from '../config.ts'
import { checkDedupEntry, isWhisperHallucination } from './dedup.ts'
import { parseTranscribeRequest } from './transcribe-parse.ts'
import { routeTranscript } from './transcribe-route.ts'
import { logger } from '../logger.ts'

export type { DeliveryResult, TranscribeContext } from './transcribe-types.ts'
import type { TranscribeContext } from './transcribe-types.ts'

/**
 * Handle POST /transcribe: receive audio, transcribe, route to agent.
 */
export async function handleTranscribe(req: Request, ctx: TranscribeContext): Promise<Response> {
  const corsHeaders = { 'Access-Control-Allow-Origin': '*' }

  // ── Parse + validate request ───────────────────────────────────────────────
  const parseResult = await parseTranscribeRequest(req)
  if (parseResult.kind === 'error') return parseResult.response
  const { audioBuffer, audioMime, explicitTo, transcribeOnly } = parseResult.parsed

  logger.info(
    { component: 'voice-bridge', bytes: audioBuffer.length, mime: audioMime },
    'audio_received'
  )

  // ── Audio dedup ────────────────────────────────────────────────────────────
  ctx.evictStaleHashes()
  const audioHash = ctx.hashAudioBuffer(audioBuffer)
  const existing = ctx.recentAudioHashes.get(audioHash)
  const waitDeadlineMs = ctx.dedupWaitDeadlineMs ?? DEDUP_WAIT_DEADLINE_MS
  if (existing) {
    logger.info({ component: 'voice-bridge', hash: audioHash }, 'duplicate_audio_detected')
    const dedupResult = await checkDedupEntry(
      existing,
      audioHash,
      ctx.recentAudioHashes,
      waitDeadlineMs,
      corsHeaders
    )
    if (dedupResult.kind === 'response') return dedupResult.response
    // kind === 'fallthrough': original failed mid-wait — re-process below
  }
  // Mark inProgress so concurrent retries wait rather than re-running Whisper.
  // EVERY early-return below MUST clear this entry to prevent frozen retries.
  ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), inProgress: true })

  // ── Transcribe ─────────────────────────────────────────────────────────────
  let transcript: string
  let audioRms: number
  try {
    const result = await ctx.transcribeAudio(audioBuffer, audioMime)
    transcript = result.transcript
    audioRms = result.audioRms
  } catch (err) {
    logger.error({ component: 'whisper', error: err }, 'transcription_failed')
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
  // Defense-in-depth against TTS bleed → "hello" feedback loop.
  // Promote to cancelled entry (not delete) so concurrent duplicates get the
  // cached result without re-running Whisper and re-triggering the loop.
  if (isWhisperHallucination(transcript, audioRms)) {
    logger.info(
      { component: 'voice-bridge', transcript, rms: audioRms },
      'hallucination_suppressed'
    )
    ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), cancelled: true, transcript })
    return Response.json(
      { transcript, cancelled: true, reason: 'whisper-hallucination' },
      { headers: corsHeaders }
    )
  }

  // ── Cancel detection ───────────────────────────────────────────────────────
  if (isCancelCommand(transcript)) {
    const tailText = transcript.trim().split(/\s+/).slice(-10).join(' ')
    const cancelCount = (tailText.match(/\bcancel\b/gi) ?? []).length
    logger.info({ component: 'voice-bridge', cancelCount, transcript }, 'cancel_command_discarding')
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json({ transcript, cancelled: true }, { headers: corsHeaders })
  }

  // ── Test mode ──────────────────────────────────────────────────────────────
  if (/^test\b/i.test(transcript)) {
    logger.info({ component: 'voice-bridge', transcript }, 'test_mode_skip_relay')
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json({ transcript, test: true }, { headers: corsHeaders })
  }

  // ── Mic control commands ───────────────────────────────────────────────────
  const micCmd = ctx.handleMicCommand(transcript)
  if (micCmd) {
    logger.info(
      { component: 'mic', transcript },
      micCmd.state === 'off' ? 'paused_via_voice' : 'resumed_via_voice'
    )
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json({ transcript, mic: micCmd.state, command: true }, { headers: corsHeaders })
  }

  // ── Routing ────────────────────────────────────────────────────────────────
  const { to, message } = await routeTranscript({
    transcript,
    explicitTo,
    getKnownAgents: ctx.getKnownAgents,
    llmRoute: ctx.llmRoute,
    saveLastTarget: ctx.saveLastTarget
  })

  // ── transcribe_only mode ───────────────────────────────────────────────────
  if (transcribeOnly) {
    logger.info({ component: 'voice-bridge', target: to }, 'transcribe_only_skip_relay')
    ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), transcript, to, message })
    return Response.json({ transcript, to }, { headers: corsHeaders })
  }

  // ── Deliver to agent ───────────────────────────────────────────────────────
  // Keep entry as {inProgress:true} until delivery succeeds — a concurrent
  // duplicate mid-delivery must not read a premature resolved entry.
  // On failure: delete so retries get a real delivery attempt (not 200 cached).
  const delivery = await ctx.deliverMessage(message, to)
  if (!delivery.ok) {
    logger.error({ component: 'voice-bridge', deliveryError: delivery.error }, 'delivery_failed')
    ctx.recentAudioHashes.delete(audioHash)
    return Response.json(
      { transcript, to, message, delivered: false, error: delivery.error },
      { status: 502, headers: corsHeaders }
    )
  }
  ctx.recentAudioHashes.set(audioHash, { ts: Date.now(), transcript, to, message })
  logger.info({ component: 'delivery', to, message }, 'message_delivered')
  return Response.json({ transcript, to, message, delivered: true }, { headers: corsHeaders })
}
