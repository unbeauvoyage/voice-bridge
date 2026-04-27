/**
 * voice-bridge Bun HTTP server
 *
 * Endpoints:
 *   GET  /           — mobile recording UI
 *   POST /transcribe — receives audio, transcribes via Whisper, delivers to relay
 *   GET  /health     — liveness check
 *   GET  /mic        — { state: "on"|"off" }
 *   POST /mic        — { state: "on"|"off" } → set mic state
 *
 * This file is wiring-only: construct ctx, mount routes, start Bun.serve.
 * No business logic lives here — see the route files for extracted functions.
 */

import './otel.ts' // must be first — initializes OTel SDK before any other module

import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { atomicWriteFile } from './atomicWriteFile.ts'
import { join } from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { listWorkspaceNames } from './cmux.ts'
import { deliverToAgent } from './relay.ts'
import { transcribeAudio } from './whisper.ts'
import { llmRoute } from './llmRouter.ts'
import { startRelayPoller } from './relay-poller.ts'
import { drainVoiceBridgeQueue } from './queue-drain.ts'
import { handleTranscribe, type TranscribeContext } from './routes/transcribe.ts'
import { type DedupEntry, hashAudioBuffer, evictStaleHashes } from './routes/dedup.ts'
import { createWakeWordOsContext } from './wakeWordController.ts'
import { handleMessages, type MessagesContext } from './routes/messages.ts'
import {
  handleMic,
  isMicOn,
  setMic,
  handleMicCommand,
  cleanStaleTtsPauseTokens,
  type MicContext
} from './routes/mic.ts'
import { handleStatus, type StatusContext } from './routes/status.ts'
import {
  handleTarget,
  loadLastTarget,
  saveLastTarget,
  type TargetContext
} from './routes/target.ts'
import { handleAgents, getKnownAgents, type AgentsContext } from './routes/agents.ts'
import { handleSettings, type SettingsContext } from './routes/settings.ts'
import { handleWakeWord } from './routes/wakeWord.ts'
import { handleHealth, handleIndexHtml, type IndexHtmlContext } from './routes/meta.ts'
import { SERVER_PORT, RELAY_BASE_URL_DEFAULT, OVERLAY_URL_DEFAULT } from './config.ts'
import { logger } from './logger.ts'
import { getTracer } from './otel.ts'
import { SpanStatusCode } from '@opentelemetry/api'

const PORT = Number(process.env['PORT'] ?? SERVER_PORT)
const PUBLIC_DIR = join(import.meta.dir, '../public')
const RELAY_BASE_URL = process.env['RELAY_BASE_URL'] ?? RELAY_BASE_URL_DEFAULT

// Audio dedup — WKWebView retries fetches when Whisper is slow, causing duplicate relay delivery.
// We hash audio bytes on arrival and reject same hash within 30s.
const recentAudioHashes = new Map<string, DedupEntry>()

// Chunk2-review HIGH2: Content-Length header is client-trusted. Bun.serve
// maxRequestBodySize enforces at the parser level — Bun counts bytes as
// they arrive and rejects over-size with 413 before any handler runs, so
// lying/omitted Content-Length cannot buffer hostile bodies. Set slightly
// above the /transcribe route cap (10 MiB) so the route-level preflight
// gets a chance to produce the standard error shape for normal oversize;
// this cap is the hard backstop against the streaming-attack case.
const MAX_REQUEST_BODY_BYTES = 11 * 1024 * 1024

// Bind extracted functions to zero-arg signatures expected by route contexts.
// The functions in their route files accept optional path args for testability;
// here we use the production defaults (no args = use defaults from config.ts).
const isMicOnBound = (): boolean => isMicOn()
const setMicBound = (on: boolean): void => setMic(on)
const loadLastTargetBound = (): string => loadLastTarget()
const saveLastTargetBound = (target: string): void => saveLastTarget(target)
const handleMicCommandBound = (transcript: string): { handled: true; state: 'on' | 'off' } | null =>
  handleMicCommand(transcript)
const getKnownAgentsBound = (): Promise<string[]> =>
  getKnownAgents({ relayBaseUrl: RELAY_BASE_URL, fetchFn: fetch, listWorkspaceNames })

const tracer = getTracer()

async function handleRequest(req: Request): Promise<Response> {
  const url = new URL(req.url)

  // ── Health ────────────────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    return handleHealth()
  }

  // ── Mobile UI ─────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/') {
    const indexCtx: IndexHtmlContext = {
      loadIndexHtml: async () => {
        try {
          const buf = await readFile(join(PUBLIC_DIR, 'index.html'))
          return buf.toString('utf8')
        } catch {
          return null
        }
      }
    }
    return handleIndexHtml(indexCtx)
  }

  // ── CORS preflight — allow dashboard (localhost:5173) to call voice-bridge ──
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
        'Access-Control-Max-Age': '86400'
      }
    })
  }

  // ── Transcribe ────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/transcribe') {
    const ctx: TranscribeContext = {
      recentAudioHashes,
      evictStaleHashes: () => evictStaleHashes(recentAudioHashes),
      hashAudioBuffer,
      loadLastTarget: loadLastTargetBound,
      saveLastTarget: saveLastTargetBound,
      handleMicCommand: handleMicCommandBound,
      getKnownAgents: getKnownAgentsBound,
      transcribeAudio,
      llmRoute,
      // Relay-only delivery. Queued (offline agent) counts as ok — relay
      // will deliver when the agent comes online. cmux fallback removed:
      // voice-bridge2 is not a cmux process, so deliverViaCmux always
      // throws "Access denied" and was never useful here.
      deliverMessage: async (message, to) => {
        const relayResult = await deliverToAgent(message, to)
        if (relayResult.ok) {
          logger.info({ component: 'relay', to, message }, 'message_sent')
          return { ok: true }
        }
        logger.error(
          { component: 'voice-bridge', relayError: relayResult.error },
          'relay_delivery_failed'
        )
        return { ok: false, error: relayResult.error }
      }
    }
    return handleTranscribe(req, ctx)
  }

  // ── Messages proxy ────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/messages') {
    const ctx: MessagesContext = { relayBaseUrl: RELAY_BASE_URL }
    return handleMessages(req, ctx)
  }

  // ── Mic control ──────────────────────────────────────────────────────────
  // GET  /mic         — { state: "on"|"off" }
  // POST /mic         — { state: "on"|"off" } → toggle
  if (url.pathname === '/mic') {
    const micCtx: MicContext = { isMicOn: isMicOnBound, setMic: setMicBound }
    const res = await handleMic(req, micCtx)
    if (res) return res
  }

  // ── Agents list ───────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/agents') {
    const ctx: AgentsContext = {
      relayBaseUrl: RELAY_BASE_URL,
      listWorkspaceNames,
      fetchFn: fetch
    }
    return handleAgents(req, ctx)
  }

  // ── Status ───────────────────────────────────────────────────────────────
  if (req.method === 'GET' && url.pathname === '/status') {
    const ctx: StatusContext = { loadLastTarget: loadLastTargetBound, isMicOn: isMicOnBound }
    return handleStatus(ctx)
  }

  // ── Target control ────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/target') {
    const ctx: TargetContext = { saveLastTarget: saveLastTargetBound }
    return handleTarget(req, ctx)
  }

  // ── Settings ─────────────────────────────────────────────────────────────
  if (url.pathname === '/settings') {
    const settingsPath = join(import.meta.dir, '../daemon/settings.json')
    const ctx: SettingsContext = {
      readSettings: () => {
        try {
          return readFileSync(settingsPath, 'utf8')
        } catch (err) {
          // ENOENT = file missing (legitimate first-time use) → return null so
          // the handler gives a 404 on GET or merges onto {} on POST.
          // Any other error (EACCES, EISDIR, EIO) is a real problem → re-throw
          // so the handler surfaces it as 500 instead of silently treating it
          // as "no settings file" and potentially overwriting with fresh {}.
          if (err instanceof Error && 'code' in err && err.code === 'ENOENT') return null
          throw err
        }
      },
      writeSettings: (content: string) => {
        atomicWriteFile(settingsPath, content)
      }
    }
    const res = await handleSettings(req, ctx)
    if (res) return res
  }

  // ── Wake word process control ─────────────────────────────────────────────
  if (url.pathname === '/wake-word' || url.pathname.startsWith('/wake-word/')) {
    const daemonDir = join(import.meta.dir, '../daemon')
    const wakeCtx = createWakeWordOsContext(daemonDir, loadLastTargetBound, {
      spawnSync,
      spawn: (cmd, args, opts) => spawn(cmd, [...args], opts),
      env: process.env
    })
    const res = handleWakeWord(req, wakeCtx)
    if (res) return res
  }

  return new Response('Not found', { status: 404 })
}

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
  async fetch(req) {
    const url = new URL(req.url)
    const span = tracer.startSpan(`${req.method} ${url.pathname}`, {
      attributes: {
        'http.method': req.method,
        'http.url': req.url,
        'http.scheme': url.protocol.replace(':', ''),
        'net.host.name': url.hostname
      }
    })
    try {
      const response = await handleRequest(req)
      span.setAttribute('http.status_code', response.status)
      if (response.status >= 500) {
        span.setStatus({ code: SpanStatusCode.ERROR })
      }
      return response
    } catch (err) {
      span.setStatus({
        code: SpanStatusCode.ERROR,
        message: err instanceof Error ? err.message : String(err)
      })
      throw err
    } finally {
      span.end()
    }
  }
})

// Clean up stale TTS pause tokens left by a previous crash. Must run before the
// relay poller or any TTS cycle can create new tokens, so the daemon starts with
// a clean slate and voice pickup works immediately.
cleanStaleTtsPauseTokens()

logger.info(
  { component: 'server', port: server.port, url: `http://localhost:${server.port}` },
  'listening'
)
logger.info(
  { component: 'server', note: 'HTTPS required for non-localhost access — use mkcert' },
  'mobile_ui_note'
)

// Drain voice-bridge's own relay queue — messages sent while offline are not lost
drainVoiceBridgeQueue(RELAY_BASE_URL, (msg) => {
  logger.info(
    {
      component: 'queue-drain',
      from: msg.from,
      type: msg.type,
      body: msg.body
    },
    'startup_message_received'
  )
}).catch(() => {
  /* drain errors already logged inside drainVoiceBridgeQueue */
})

// Start relay response poller — agent replies appear as overlay message toasts
const OVERLAY_URL = process.env['OVERLAY_URL'] ?? OVERLAY_URL_DEFAULT
const SETTINGS_PATH = join(import.meta.dir, '../daemon/settings.json')
startRelayPoller({
  relayBaseUrl: RELAY_BASE_URL,
  overlayUrl: OVERLAY_URL,
  settingsPath: SETTINGS_PATH
})
logger.info(
  { component: 'relay-poller', relayBaseUrl: RELAY_BASE_URL, overlayUrl: OVERLAY_URL },
  'started'
)
