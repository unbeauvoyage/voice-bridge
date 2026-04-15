/**
 * IPC handler registration — wires the five ipcMain channels that
 * the renderer talks to. Extracted from the Electron shell so the
 * handler bodies can be unit-tested without spinning up Electron.
 *
 * `registerIpcHandlers(ipc, deps)` attaches handlers and listeners
 * to the provided `ipc` object. `IpcMainLike` captures just the
 * `handle(channel, handler)` + `on(channel, listener)` surface the
 * real Electron `ipcMain` exposes, so tests can pass a fake that
 * captures the registrations and invokes them directly.
 *
 * Dependencies are injected as `IpcDeps`:
 *   - `fetchFn` — for /mic, /target, /agents backend calls
 *   - `targetStore` — last-target persistence
 *   - `hideMainWindow` — closure that hides the settings window
 *   - `showOverlay` — closure that delegates to the overlay manager
 *
 * Handler behavior is preserved 1:1 from the pre-extraction
 * `src/main/index.ts`, except get-agents: it now returns `[]` on
 * any failure (fetch throw, non-ok, malformed body) instead of
 * silently substituting a hardcoded list. Renderer treats `[]` as
 * "backend unavailable" rather than "three agents exist".
 */

import { isMicResponse, isAgentsResponse, type OverlayPayload } from './typeGuards'
import type { TargetStore } from './state/targetStore'

export type IpcMainLike = {
  handle: (channel: string, handler: (event: unknown, ...args: unknown[]) => unknown) => void
  on: (channel: string, listener: (event: unknown, ...args: unknown[]) => void) => void
}

export type IpcDeps = {
  fetchFn: typeof fetch
  targetStore: TargetStore
  hideMainWindow: () => void
  showOverlay: (payload: OverlayPayload) => void
}

const BACKEND_URL = 'http://127.0.0.1:3030'
const AGENTS_TIMEOUT_MS = 2000

export function registerIpcHandlers(ipc: IpcMainLike, deps: IpcDeps): void {
  ipc.handle('get-status', async () => {
    const target = deps.targetStore.read()
    try {
      const res = await deps.fetchFn(`${BACKEND_URL}/mic`)
      if (res.ok) {
        const data: unknown = await res.json()
        if (isMicResponse(data)) {
          return { target, micState: data.state }
        }
      }
    } catch {
      /* ignore */
    }
    return { target, micState: 'on' as const }
  })

  ipc.handle('set-target', (_event, ...args) => {
    const payload = args[0]
    if (!isTargetPayload(payload)) return
    deps.targetStore.save(payload.target)
    void deps
      .fetchFn(`${BACKEND_URL}/target`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target: payload.target })
      })
      .catch(() => {})
  })

  ipc.on('hide-window', () => {
    console.log('[ipc] hide-window from renderer')
    deps.hideMainWindow()
  })

  ipc.handle('show-overlay', (_event, ...args) => {
    const payload = args[0]
    if (isOverlayPayloadArg(payload)) deps.showOverlay(payload)
  })

  ipc.handle('get-agents', async () => {
    try {
      const res = await deps.fetchFn(`${BACKEND_URL}/agents`, {
        signal: AbortSignal.timeout(AGENTS_TIMEOUT_MS)
      })
      if (res.ok) {
        const data: unknown = await res.json()
        if (isAgentsResponse(data)) {
          return data.agents.map((a) => (typeof a === 'string' ? a : a.name))
        }
      }
    } catch {
      /* ignore */
    }
    return []
  })
}

function isTargetPayload(v: unknown): v is { target: string } {
  if (typeof v !== 'object' || v === null) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return typeof obj['target'] === 'string'
}

function isOverlayPayloadArg(v: unknown): v is OverlayPayload {
  if (typeof v !== 'object' || v === null) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  const mode = obj['mode']
  return (
    mode === 'success' ||
    mode === 'recording' ||
    mode === 'cancelled' ||
    mode === 'error' ||
    mode === 'message' ||
    mode === 'hidden'
  )
}
