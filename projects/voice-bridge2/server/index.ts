/**
 * voice-bridge Bun HTTP server
 *
 * Endpoints:
 *   GET  /           — mobile recording UI
 *   POST /transcribe — receives audio, transcribes via Whisper, delivers to relay
 *   GET  /health     — liveness check
 *   GET  /mic        — { state: "on"|"off" }
 *   POST /mic        — { state: "on"|"off" } → set mic state
 */

import { readFile } from 'node:fs/promises'
import { readFileSync, writeFileSync, existsSync, unlinkSync } from 'node:fs'
import { join } from 'node:path'
import { spawnSync, spawn } from 'node:child_process'
import { listWorkspaceNames } from './cmux.ts'
import { startRelayPoller } from './relay-poller.ts'
import { handleTranscribe, type TranscribeContext, type DedupEntry } from './routes/transcribe.ts'
import { handleMessages, type MessagesContext } from './routes/messages.ts'
import { handleMic, type MicContext } from './routes/mic.ts'
import { handleStatus, type StatusContext } from './routes/status.ts'
import { handleTarget, type TargetContext } from './routes/target.ts'
import { handleAgents, type AgentsContext } from './routes/agents.ts'
import { handleSettings, type SettingsContext } from './routes/settings.ts'
import { handleWakeWord, type WakeWordContext } from './routes/wakeWord.ts'
import {
  SERVER_PORT,
  RELAY_BASE_URL_DEFAULT,
  OVERLAY_URL_DEFAULT,
  DEDUP_WINDOW_MS
} from './config.ts'

const PORT = Number(process.env.PORT ?? SERVER_PORT)
const PUBLIC_DIR = join(import.meta.dir, '../public')
const RELAY_BASE_URL = process.env.RELAY_BASE_URL ?? RELAY_BASE_URL_DEFAULT
const LAST_TARGET_FILE = join(import.meta.dir, '../tmp/last-target.txt')

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

// Mic control — server owns the pause file; daemon reads it every loop iteration
const MIC_PAUSE_FILE = '/tmp/wake-word-pause'

function isMicOn(): boolean {
  return !existsSync(MIC_PAUSE_FILE)
}
function setMic(on: boolean): void {
  if (on) {
    try {
      unlinkSync(MIC_PAUSE_FILE)
    } catch {
      /* file may not exist */
    }
  } else {
    try {
      writeFileSync(MIC_PAUSE_FILE, '')
    } catch {
      /* ignore write errors */
    }
  }
}

// Returns true if transcript is a mic control command, and handles it.
// "turn off (the) (mac/max) mic(rophone)" → pause
// "turn on (the) (mac/max) mic(rophone)"  → resume
function handleMicCommand(transcript: string): { handled: true; state: 'on' | 'off' } | null {
  const t = transcript.toLowerCase().trim()
  if (/\b(turn\s+off|disable|mute|pause)\b.{0,20}\b(mic(rophone)?|listening)\b/.test(t)) {
    setMic(false)
    return { handled: true, state: 'off' }
  }
  if (/\b(turn\s+on|enable|unmute|resume)\b.{0,20}\b(mic(rophone)?|listening)\b/.test(t)) {
    setMic(true)
    return { handled: true, state: 'on' }
  }
  return null
}

function loadLastTarget(): string {
  try {
    return readFileSync(LAST_TARGET_FILE, 'utf8').trim() || 'command'
  } catch {
    return 'command'
  }
}
function saveLastTarget(target: string): void {
  try {
    writeFileSync(LAST_TARGET_FILE, target)
  } catch {
    /* ignore write errors */
  }
}

// Returns all known agent/workspace names, normalized to lowercase with hyphens.
async function getKnownAgents(): Promise<string[]> {
  const names: string[] = []
  // Relay uses /status which returns {agents: {name: {workspace}, ...}}
  try {
    const res = await fetch(`${RELAY_BASE_URL}/status`, { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const data: unknown = await res.json()
      if (typeof data === 'object' && data !== null && 'agents' in data) {
        const obj: Record<string, unknown> = Object.fromEntries(Object.entries(data))
        const agents = obj['agents']
        if (agents && typeof agents === 'object') {
          names.push(...Object.keys(agents).map((a) => a.toLowerCase()))
        }
      }
    }
  } catch {
    /* relay may be offline */
  }
  // Add cmux workspace names as fallback
  try {
    const ws = listWorkspaceNames()
    names.push(...ws.map((w: string) => w.toLowerCase()))
  } catch {
    /* cmux may be unavailable */
  }
  // Deduplicate
  return [...new Set(names)].filter((a) => !a.includes('test') && !a.includes('probe'))
}

const server = Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url)

    // ── Health ────────────────────────────────────────────────────────────────
    if (url.pathname === '/health') {
      return Response.json({ status: 'ok', ts: Date.now() })
    }

    // ── Mobile UI ─────────────────────────────────────────────────────────────
    if (req.method === 'GET' && url.pathname === '/') {
      try {
        const html = await readFile(join(PUBLIC_DIR, 'index.html'))
        return new Response(html, { headers: { 'Content-Type': 'text/html; charset=utf-8' } })
      } catch {
        return new Response('Not found', { status: 404 })
      }
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
        loadLastTarget,
        saveLastTarget,
        handleMicCommand,
        getKnownAgents
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
      const micCtx: MicContext = { isMicOn, setMic }
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
      const ctx: StatusContext = { loadLastTarget, isMicOn }
      return handleStatus(ctx)
    }

    // ── Target control ────────────────────────────────────────────────────────
    if (req.method === 'POST' && url.pathname === '/target') {
      const ctx: TargetContext = { saveLastTarget }
      return handleTarget(req, ctx)
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    if (url.pathname === '/settings') {
      const settingsPath = join(import.meta.dir, '../daemon/settings.json')
      const ctx: SettingsContext = {
        readSettings: () => {
          try {
            return readFileSync(settingsPath, 'utf8')
          } catch {
            return null
          }
        },
        writeSettings: (content: string) => {
          writeFileSync(settingsPath, content)
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
          const pythonApp =
            '/opt/homebrew/Cellar/python@3.14/3.14.3_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python'
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
        loadLastTarget
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
