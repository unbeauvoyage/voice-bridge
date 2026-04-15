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
import {
  SERVER_PORT,
  RELAY_BASE_URL_DEFAULT,
  OVERLAY_URL_DEFAULT,
  RELAY_TIMEOUT_MS,
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

// Sticky last-used target — persisted to disk so it survives server restarts

// Parses a JSON text string, returning an empty object on any parse failure.
// Used wherever HTTP handlers need to tolerate malformed request bodies.
function safeJsonParse(text: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(text)
    if (parsed !== null && typeof parsed === 'object' && !Array.isArray(parsed)) {
      return Object.fromEntries(Object.entries(parsed))
    }
    return {}
  } catch {
    return {}
  }
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
    // GET /messages?agent=command — proxies relay GET /messages/:agent
    if (req.method === 'GET' && url.pathname === '/messages') {
      const agent = url.searchParams.get('agent') || 'command'
      const headers = { 'Access-Control-Allow-Origin': '*' }
      try {
        const relayRes = await fetch(`${RELAY_BASE_URL}/messages/${encodeURIComponent(agent)}`, {
          signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
        })

        if (!relayRes.ok) {
          const detail = await relayRes.text().catch(() => '')
          return Response.json(
            {
              error: 'Relay unavailable',
              agent,
              relayStatus: relayRes.status,
              detail: detail.slice(0, 200)
            },
            {
              status: 502,
              headers
            }
          )
        }

        const data = await relayRes.json()
        return Response.json(data, { headers })
      } catch (err) {
        console.warn('[relay] messages fetch failed:', err)
        return Response.json(
          {
            error: 'Relay unavailable',
            agent,
            detail: String(err)
          },
          {
            status: 502,
            headers
          }
        )
      }
    }

    // ── Mic control ──────────────────────────────────────────────────────────
    // GET  /mic         — { state: "on"|"off" }
    // POST /mic         — { state: "on"|"off" } → toggle
    if (url.pathname === '/mic') {
      const headers = { 'Access-Control-Allow-Origin': '*' }
      if (req.method === 'GET') {
        return Response.json({ state: isMicOn() ? 'on' : 'off' }, { headers })
      }
      if (req.method === 'POST') {
        const body = safeJsonParse(await req.text())
        const on = body['state'] === 'on'
        setMic(on)
        console.log(`[mic] ${on ? 'RESUMED' : 'PAUSED'} via API`)
        return Response.json({ state: on ? 'on' : 'off' }, { headers })
      }
    }

    // ── Agents list ───────────────────────────────────────────────────────────
    // GET /agents?source=relay|workspaces — list available agents/workspaces
    if (req.method === 'GET' && url.pathname === '/agents') {
      const headers = { 'Access-Control-Allow-Origin': '*' }
      const source = url.searchParams.get('source') ?? 'auto'

      if (source !== 'workspaces') {
        // Try relay
        try {
          const relayRes = await fetch(`${RELAY_BASE_URL}/agents`, {
            signal: AbortSignal.timeout(RELAY_TIMEOUT_MS)
          })
          if (relayRes.ok) {
            const data = await relayRes.json()
            return Response.json(data, { headers })
          }
        } catch {
          if (source === 'relay') {
            return Response.json({ agents: [], error: 'Relay unavailable' }, { headers })
          }
          // auto mode: fall through to cmux
        }
      }

      // workspaces or auto fallback
      const agents = listWorkspaceNames()
      return Response.json({ agents }, { headers })
    }

    // ── Status ───────────────────────────────────────────────────────────────
    // GET /status — returns { target, micState }
    if (req.method === 'GET' && url.pathname === '/status') {
      const headers = { 'Access-Control-Allow-Origin': '*' }
      return Response.json(
        { target: loadLastTarget(), micState: isMicOn() ? 'on' : 'off' },
        { headers }
      )
    }

    // ── Target control ────────────────────────────────────────────────────────
    // POST /target — { target: string } → saves new target
    if (req.method === 'POST' && url.pathname === '/target') {
      const headers = { 'Access-Control-Allow-Origin': '*' }
      const body = safeJsonParse(await req.text())
      const target = (typeof body['target'] === 'string' ? body['target'] : '').trim()
      if (!target) {
        return Response.json({ error: 'Missing target' }, { status: 400, headers })
      }
      saveLastTarget(target)
      console.log(`[target] updated to "${target}"`)
      return Response.json({ target }, { headers })
    }

    // ── Settings ─────────────────────────────────────────────────────────────
    // GET  /settings — read daemon/settings.json
    // POST /settings — write daemon/settings.json (partial or full update)
    if (url.pathname === '/settings') {
      const headers = { 'Access-Control-Allow-Origin': '*' }
      const settingsPath = join(import.meta.dir, '../daemon/settings.json')

      if (req.method === 'GET') {
        try {
          const raw = readFileSync(settingsPath, 'utf8')
          return new Response(raw, { headers: { ...headers, 'Content-Type': 'application/json' } })
        } catch {
          return Response.json({ error: 'settings.json not found' }, { status: 404, headers })
        }
      }

      if (req.method === 'POST') {
        let incoming: Record<string, unknown> = {}
        try {
          incoming = await req.json()
        } catch {
          return Response.json({ error: 'Invalid JSON' }, { status: 400, headers })
        }
        let current: Record<string, unknown> = {}
        try {
          current = JSON.parse(readFileSync(settingsPath, 'utf8'))
        } catch {
          /* file may not exist yet */
        }
        const merged = { ...current, ...incoming }
        try {
          writeFileSync(settingsPath, JSON.stringify(merged, null, 2))
        } catch (err) {
          return Response.json(
            { error: 'Failed to write settings: ' + String(err) },
            { status: 500, headers }
          )
        }
        console.log(`[settings] updated: ${JSON.stringify(incoming)}`)
        return Response.json(merged, { headers })
      }
    }

    // ── Wake word process control ─────────────────────────────────────────────
    // POST /wake-word/stop  — kill the wake_word.py process (closes mic, dot disappears)
    // POST /wake-word/start — restart it
    // GET  /wake-word       — { running: bool }
    if (url.pathname === '/wake-word' || url.pathname.startsWith('/wake-word/')) {
      const headers = { 'Access-Control-Allow-Origin': '*' }
      const daemonDir = join(import.meta.dir, '../daemon')

      function findWakeWordPid(): number | null {
        const result = spawnSync('pgrep', ['-f', 'wake_word.py'], { encoding: 'utf8' })
        const pid = parseInt(result.stdout.trim().split('\n')[0] ?? '', 10)
        return isNaN(pid) ? null : pid
      }

      if (req.method === 'GET' && url.pathname === '/wake-word') {
        return Response.json({ running: findWakeWordPid() !== null }, { headers })
      }

      if (req.method === 'POST' && url.pathname === '/wake-word/stop') {
        const pid = findWakeWordPid()
        if (pid) {
          spawnSync('kill', [String(pid)])
          console.log(`[wake-word] stopped (PID ${pid})`)
        }
        return Response.json({ running: false }, { headers })
      }

      if (req.method === 'POST' && url.pathname === '/wake-word/start') {
        const existing = findWakeWordPid()
        if (!existing) {
          // Replicate run_daemon.sh: use Python.app (has mic entitlements) with venv PYTHONPATH
          const pythonApp =
            '/opt/homebrew/Cellar/python@3.14/3.14.3_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python'
          const script = join(daemonDir, 'wake_word.py')
          const venvPackages = join(daemonDir, '.venv/lib/python3.14/site-packages')
          const child = spawn(pythonApp, ['-u', script, '--target', loadLastTarget()], {
            cwd: join(daemonDir, '..'),
            detached: true,
            stdio: 'ignore',
            env: { ...process.env, PYTHONPATH: venvPackages }
          })
          child.on('error', (err: Error) => console.error('[wake-word] spawn failed:', err.message))
          child.unref()
          console.log(`[wake-word] started (PID ${child.pid})`)
        }
        return Response.json({ running: true }, { headers })
      }
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
