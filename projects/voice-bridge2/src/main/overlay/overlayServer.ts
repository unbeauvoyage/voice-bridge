/**
 * Overlay HTTP server — listens for POST /overlay payloads from the
 * voice-bridge Bun backend and invokes the injected `showOverlay`
 * callback. No Electron imports; the BrowserWindow coupling lives
 * in the shell that wires this controller up.
 *
 *   - `start()` listens on `<host>:<port>` (idempotent)
 *   - `stop()` closes the server (idempotent no-op if not running)
 *   - `isRunning()` reports current state
 *
 * `createServerFn` is injected so tests can substitute a fake that
 * captures the request listener and fakes `listen` / `close`.
 *
 * The request handler is exposed as `handleOverlayRequest` with a
 * minimal structural req/res contract (`MinReq` / `MinRes`) so tests
 * can pass EventEmitter-based fakes without type assertions. Real
 * `http.IncomingMessage` / `http.ServerResponse` satisfy the
 * structural contract at the wire-up site.
 */

import { createServer as nodeCreateServer, type RequestListener, type Server } from 'node:http'
import { isOverlayPayload, type OverlayPayload } from '../typeGuards'

type CreateServerFn = (handler: RequestListener) => Server

export type MinReq = {
  method?: string | undefined
  url?: string | undefined
  headers?: Record<string, string | string[] | undefined>
  on: (event: 'data' | 'end', listener: (chunk?: Buffer) => void) => unknown
}

export type MinRes = {
  writeHead: (status: number, headers?: Record<string, string>) => void
  end: (chunk?: string) => void
}

export type OverlayServerConfig = {
  port: number
  host?: string
  showOverlay: (payload: OverlayPayload) => void
  createServerFn?: CreateServerFn
}

export type OverlayServerController = {
  start: () => void
  stop: () => void
  isRunning: () => boolean
}

// 1 MiB — plenty for any overlay message JSON (mode + text fields).
// Checked against Content-Length before reading the body so hostile clients
// cannot exhaust memory by sending a giant body with a forged small header.
const MAX_OVERLAY_BODY_BYTES = 1024 * 1024

export function handleOverlayRequest(
  showOverlay: (payload: OverlayPayload) => void,
  req: MinReq,
  res: MinRes
): void {
  if (req.method !== 'POST' || req.url !== '/overlay') {
    res.writeHead(404)
    res.end()
    return
  }

  // Reject oversized requests early — before buffering any body bytes —
  // consistent with the transcribe.ts approach (Content-Length preflight).
  const clHeader = req.headers?.['content-length']
  const clRaw = Array.isArray(clHeader) ? clHeader[0] : clHeader
  if (clRaw !== undefined) {
    const declared = Number(clRaw)
    if (Number.isFinite(declared) && declared > MAX_OVERLAY_BODY_BYTES) {
      res.writeHead(413)
      res.end()
      return
    }
  }

  let body = ''
  req.on('data', (chunk?: Buffer) => {
    if (chunk) body += chunk.toString()
  })
  req.on('end', () => {
    try {
      const parsed: unknown = JSON.parse(body)
      if (!isOverlayPayload(parsed)) {
        res.writeHead(400)
        res.end()
        return
      }
      showOverlay(parsed)
      res.writeHead(200, { 'Content-Type': 'application/json' })
      res.end('{"ok":true}')
    } catch {
      res.writeHead(400)
      res.end()
    }
  })
}

export function createOverlayRequestHandler(
  showOverlay: (payload: OverlayPayload) => void
): RequestListener {
  return (req, res) => handleOverlayRequest(showOverlay, req, res)
}

export function createOverlayServerController(cfg: OverlayServerConfig): OverlayServerController {
  const createServerFn: CreateServerFn = cfg.createServerFn ?? ((h) => nodeCreateServer(h))
  const host = cfg.host ?? '127.0.0.1'
  let server: Server | null = null

  function start(): void {
    if (server) return
    const handler = createOverlayRequestHandler(cfg.showOverlay)
    server = createServerFn(handler)
    server.listen(cfg.port, host, () => {
      console.log(`[overlay-server] listening on http://${host}:${cfg.port}`)
    })
    server.on('error', (e: Error) => console.error(`[overlay-server] error: ${e.message}`))
  }

  function stop(): void {
    if (server) {
      server.close()
      server = null
    }
  }

  function isRunning(): boolean {
    return server !== null
  }

  return { start, stop, isRunning }
}
