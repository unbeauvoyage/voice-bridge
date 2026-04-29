/**
 * voice-bridge Bun HTTP server
 *
 * Endpoints:
 *   POST /compose      — multimodal CEO message (text + audio + attachments)
 *   GET  /health       — liveness check
 *   GET  /openapi.yaml — served at runtime for hey-api codegen
 *   GET  /            — serve mobile recording UI
 *   GET/POST /mic      — mic state control (Electron + wake_word.py)
 *   GET/POST /settings — daemon settings (Electron settings page)
 *   POST /target       — relay target agent selection (Electron tray + wake_word.py)
 *   GET  /agents       — relay-required agent list
 *   GET  /status       — current session state (target + mic)
 *   GET/POST /wake-word* — wake word process control
 *
 * This file is wiring-only: construct ctx, mount routes, start Bun.serve.
 * No business logic lives here — see the route files for extracted functions.
 */

import './otel.ts' // must be first — initializes OTel SDK before any other module

import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { atomicWriteFile } from './atomicWriteFile.ts'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawnSync, spawn } from 'node:child_process'
import { handleCompose } from './routes/compose.ts'
import { createWakeWordOsContext } from './wakeWordController.ts'
import {
  handleMic,
  isMicOn,
  setMic,
  type MicContext
} from './routes/mic.ts'
import { handleStatus, type StatusContext } from './routes/status.ts'
import {
  handleTarget,
  loadLastTarget,
  saveLastTarget,
  type TargetContext
} from './routes/target.ts'
import { handleAgents, type AgentsContext } from './routes/agents.ts'
import { handleSettings, type SettingsContext } from './routes/settings.ts'
import { handleWakeWord } from './routes/wakeWord.ts'
import { handleHealth, handleIndexHtml, type IndexHtmlContext } from './routes/meta.ts'
import { SERVER_PORT, RELAY_BASE_URL_DEFAULT } from './config.ts'
import { logger } from './logger.ts'
import { getTracer } from './otel.ts'
import { propagation, context, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api'

const PORT = Number(process.env['PORT'] ?? SERVER_PORT)
const PUBLIC_DIR = join(dirname(fileURLToPath(import.meta.url)), '../public')
const RELAY_BASE_URL = process.env['RELAY_BASE_URL'] ?? RELAY_BASE_URL_DEFAULT

// Chunk2-review HIGH2: Content-Length header is client-trusted. Bun.serve
// maxRequestBodySize enforces at the parser level — Bun counts bytes as
// they arrive and rejects over-size with 413 before any handler runs, so
// lying/omitted Content-Length cannot buffer hostile bodies.
const MAX_REQUEST_BODY_BYTES = 11 * 1024 * 1024

// Bind extracted functions to zero-arg signatures expected by route contexts.
// The functions in their route files accept optional path args for testability;
// here we use the production defaults (no args = use defaults from config.ts).
const isMicOnBound = (): boolean => isMicOn()
const setMicBound = (on: boolean): void => setMic(on)
const loadLastTargetBound = (): string => loadLastTarget()
const saveLastTargetBound = (target: string): void => saveLastTarget(target)
const tracer = getTracer()

async function handleRequest(req: Request, url: URL): Promise<Response> {

  // ── Health ────────────────────────────────────────────────────────────────
  if (url.pathname === '/health') {
    return handleHealth()
  }

  // ── OpenAPI spec — served at runtime so consumers (hey-api in ceo-app) ────
  // can pull it via URL. File lives at docs/openapi.yaml.
  if (req.method === 'GET' && url.pathname === '/openapi.yaml') {
    try {
      const yaml = await readFile(join(dirname(fileURLToPath(import.meta.url)), '..', 'docs', 'openapi.yaml'), 'utf8')
      return new Response(yaml, {
        status: 200,
        headers: { 'Content-Type': 'application/yaml; charset=utf-8' }
      })
    } catch {
      return new Response(JSON.stringify({ error: 'spec_unavailable' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }
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

  // ── Compose ───────────────────────────────────────────────────────────────
  if (req.method === 'POST' && url.pathname === '/compose') {
    return handleCompose(req)
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
    const settingsPath = join(dirname(fileURLToPath(import.meta.url)), '../daemon/settings.json')
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
    const daemonDir = join(dirname(fileURLToPath(import.meta.url)), '../daemon')
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

    // Extract W3C traceparent from incoming headers so browser/ceo-app spans link here.
    const carrier: Record<string, string> = {}
    req.headers.forEach((v, k) => { carrier[k] = v })
    const parentCtx = propagation.extract(context.active(), carrier)

    const span = tracer.startSpan(
      `${req.method} ${url.pathname}`,
      {
        kind: SpanKind.SERVER,
        attributes: {
          'http.method': req.method,
          'http.url': req.url,
          'http.target': url.pathname,
          'http.scheme': url.protocol.replace(':', ''),
          'net.host.name': url.hostname,
        },
      },
      parentCtx,
    )

    return context.with(trace.setSpan(parentCtx, span), async () => {
      try {
        const response = await handleRequest(req, url)
        span.setAttribute('http.status_code', response.status)
        if (response.status >= 500) {
          span.setStatus({ code: SpanStatusCode.ERROR })
        }
        response.headers.set('Access-Control-Allow-Origin', '*')
        return response
      } catch (err) {
        span.recordException(err instanceof Error ? err : new Error(String(err)))
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: err instanceof Error ? err.message : String(err),
        })
        throw err
      } finally {
        span.end()
      }
    })
  }
})

logger.info(
  { component: 'server', port: server.port, url: `http://localhost:${server.port}` },
  'listening'
)
logger.info(
  { component: 'server', note: 'HTTPS required for non-localhost access — use mkcert' },
  'mobile_ui_note'
)
