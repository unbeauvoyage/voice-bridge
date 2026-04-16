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

import { readFile } from 'node:fs/promises'
import { readFileSync } from 'node:fs'
import { atomicWriteFile } from './atomicWriteFile.ts'
import { join } from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { listWorkspaceNames, deliverViaCmux } from './cmux.ts'
import { deliverToAgent } from './relay.ts'
import { transcribeAudio } from './whisper.ts'
import { llmRoute } from './llmRouter.ts'
import { startRelayPoller } from './relay-poller.ts'
import { handleTranscribe, type TranscribeContext } from './routes/transcribe.ts'
import { type DedupEntry } from './routes/dedup.ts'
import { handleMessages, type MessagesContext } from './routes/messages.ts'
import { handleMic, isMicOn, setMic, handleMicCommand, type MicContext } from './routes/mic.ts'
import { handleStatus, type StatusContext } from './routes/status.ts'
import { handleTarget, loadLastTarget, saveLastTarget, type TargetContext } from './routes/target.ts'
import { handleAgents, getKnownAgents, type AgentsContext } from './routes/agents.ts'
import { handleSettings, type SettingsContext } from './routes/settings.ts'
import { handleWakeWord, type WakeWordContext } from './routes/wakeWord.ts'
import { handleHealth, handleIndexHtml, type IndexHtmlContext } from './routes/meta.ts'
import { discoverPythonApp } from './pythonApp.ts'
import {
  SERVER_PORT,
  RELAY_BASE_URL_DEFAULT,
  OVERLAY_URL_DEFAULT,
  DEDUP_WINDOW_MS
} from './config.ts'

const PORT = Number(process.env.PORT ?? SERVER_PORT)
const PUBLIC_DIR = join(import.meta.dir, '../public')
const RELAY_BASE_URL = process.env.RELAY_BASE_URL ?? RELAY_BASE_URL_DEFAULT

// Audio dedup — WKWebView retries fetches when Whisper is slow, causing duplicate relay delivery.
// We hash audio bytes on arrival and reject same hash within 30s.
const recentAudioHashes = new Map<string, DedupEntry>()

function hashAudioBuffer(buf: Buffer): string {
  const hasher = new Bun.CryptoHasher('sha256')
  hasher.update(buf)
  return hasher.digest('hex').slice(0, 16)
}

function evictStaleHashes(): void {
  const cutoff = Date.now() - DEDUP_WINDOW_MS
  for (const [h, entry] of recentAudioHashes) {
    if (entry.ts < cutoff) recentAudioHashes.delete(h)
  }
}

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

const server = Bun.serve({
  port: PORT,
  maxRequestBodySize: MAX_REQUEST_BODY_BYTES,
  async fetch(req) {
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
            return await readFile(join(PUBLIC_DIR, 'index.html'))
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
        evictStaleHashes,
        hashAudioBuffer,
        loadLastTarget: loadLastTargetBound,
        saveLastTarget: saveLastTargetBound,
        handleMicCommand: handleMicCommandBound,
        getKnownAgents: getKnownAgentsBound,
        transcribeAudio,
        llmRoute,
        // Compose relay-first-with-cmux-fallback. Returns {ok: false}
        // only when BOTH channels fail; the handler surfaces that as 502.
        deliverMessage: async (message, to) => {
          const relayResult = await deliverToAgent(message, to)
          if (relayResult.ok) {
            console.log(`[relay] → ${to}: ${message}`)
            return { ok: true }
          }
          console.error('[voice-bridge] relay delivery failed:', relayResult.error)
          try {
            deliverViaCmux(message, to)
            console.log(`[cmux] → ${to}: ${message}`)
            return { ok: true }
          } catch (cmuxErr) {
            const cmuxMsg =
              cmuxErr instanceof Error ? cmuxErr.message : String(cmuxErr)
            console.warn('[cmux] delivery failed:', cmuxMsg)
            return {
              ok: false,
              error: `relay: ${relayResult.error}; cmux: ${cmuxMsg}`
            }
          }
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
            if (err instanceof Error && 'code' in err && (err as NodeJS.ErrnoException).code === 'ENOENT') return null
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
      const wakeCtx: WakeWordContext = {
        findPid: () => {
          const result = spawnSync('pgrep', ['-f', 'wake_word.py'], { encoding: 'utf8' })
          const pid = parseInt(result.stdout.trim().split('\n')[0] ?? '', 10)
          return isNaN(pid) ? null : pid
        },
        stop: (pid: number) => {
          spawnSync('kill', [String(pid)])
        },
        start: (target: string) => {
          // Replicate run_daemon.sh: use Python.app (has mic entitlements) with venv PYTHONPATH
          const pythonApp = discoverPythonApp({ spawnSync, env: process.env })
          const script = join(daemonDir, 'wake_word.py')
          const venvPackages = join(daemonDir, '.venv/lib/python3.14/site-packages')
          const child = spawn(pythonApp, ['-u', script, '--target', target], {
            cwd: join(daemonDir, '..'),
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, PYTHONPATH: venvPackages }
          })
          child.on('error', (err: Error) => console.error('[wake-word] spawn failed:', err.message))
          child.unref()
          console.log(`[wake-word] spawned (PID ${child.pid})`)
        },
        loadLastTarget: loadLastTargetBound
      }
      const res = handleWakeWord(req, wakeCtx)
      if (res) return res
    }

    return new Response('Not found', { status: 404 })
  }
})

console.log(`voice-bridge server running at http://localhost:${server.port}`)
console.log(`Mobile UI (HTTPS required): use mkcert for non-localhost access`)

// Start relay response poller — agent replies appear as overlay message toasts
const OVERLAY_URL = process.env.OVERLAY_URL ?? OVERLAY_URL_DEFAULT
const SETTINGS_PATH = join(import.meta.dir, '../daemon/settings.json')
startRelayPoller({
  relayBaseUrl: RELAY_BASE_URL,
  overlayUrl: OVERLAY_URL,
  settingsPath: SETTINGS_PATH
})
console.log(
  `[relay-poller] polling ${RELAY_BASE_URL}/queue/ceo every 3s → overlay at ${OVERLAY_URL}`
)
