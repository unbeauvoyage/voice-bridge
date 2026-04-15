import { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain, screen } from 'electron'
import { spawn, ChildProcess } from 'child_process'
import { readFileSync, writeFileSync } from 'fs'
import * as http from 'http'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'

// ── Type guards ───────────────────────────────────────────────────────────────

function isMicResponse(v: unknown): v is { state: 'on' | 'off' } {
  if (typeof v !== 'object' || v === null) return false
  if (!('state' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return obj['state'] === 'on' || obj['state'] === 'off'
}

function isAgentsResponse(v: unknown): v is { agents: Array<{ name: string } | string> } {
  if (typeof v !== 'object' || v === null) return false
  if (!('agents' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return Array.isArray(obj['agents'])
}

function isOverlayPayload(v: unknown): v is OverlayPayload {
  if (typeof v !== 'object' || v === null) return false
  if (!('mode' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  const mode = obj['mode']
  if (typeof mode !== 'string') return false
  const validModes: string[] = ['success', 'recording', 'cancelled', 'error', 'message', 'hidden']
  if (!validModes.includes(mode)) return false
  if ('text' in v) {
    const text = obj['text']
    if (text !== undefined && typeof text !== 'string') return false
  }
  return true
}

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Hide from dock — this is a background utility
app.dock?.hide()

let tray: Tray | null = null
let win: BrowserWindow | null = null
let overlayWin: BrowserWindow | null = null
let daemon: ChildProcess | null = null
let server: ChildProcess | null = null
let lastTrayBounds: Electron.Rectangle | undefined

const OVERLAY_PORT = 47890

// __dirname in the compiled out/main/index.js is <project>/out/main — go up twice to reach project root
const PROJECT_ROOT = join(__dirname, '..', '..')
const LAST_TARGET_FILE = join(PROJECT_ROOT, 'tmp', 'last-target.txt')
const PYTHON_APP =
  '/opt/homebrew/Cellar/python@3.14/3.14.3_1/Frameworks/Python.framework/Versions/3.14/Resources/Python.app/Contents/MacOS/Python'
const DAEMON_DIR = join(PROJECT_ROOT, 'daemon')
const WAKE_WORD_SCRIPT = join(DAEMON_DIR, 'wake_word.py')
const VENV_PACKAGES = join(DAEMON_DIR, '.venv/lib/python3.14/site-packages')

function readLastTarget(): string {
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
    /* ignore */
  }
}

function startDaemon(): void {
  if (daemon && !daemon.killed) return
  daemon = spawn(
    PYTHON_APP,
    [
      '-u',
      WAKE_WORD_SCRIPT,
      '--target',
      readLastTarget(),
      '--start-threshold',
      '0.3',
      '--stop-threshold',
      '0.15'
    ],
    {
      cwd: join(DAEMON_DIR, '..'),
      env: { ...process.env, PYTHONPATH: VENV_PACKAGES },
      stdio: ['ignore', 'pipe', 'pipe']
    }
  )
  let buffer = ''
  daemon.stdout?.on('data', (chunk: Buffer) => {
    buffer += chunk.toString()
    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('{')) continue
      try {
        const state = JSON.parse(trimmed)
        if (win && !win.isDestroyed()) {
          win.webContents.send('state-change', state)
        }
      } catch {
        /* ignore */
      }
    }
  })
  daemon.stderr?.on('data', (d) => process.stderr.write(`[daemon:err] ${d}`))
  daemon.on('exit', (code) => {
    console.log(`[daemon] exited with code ${code}`)
    daemon = null
  })
  console.log(`[daemon] started PID=${daemon.pid}`)
}

function stopDaemon(): void {
  if (daemon) {
    daemon.kill('SIGTERM')
    daemon = null
  }
}

function startServer(): void {
  if (server && !server.killed) return
  const serverDir = join(PROJECT_ROOT, 'server')
  server = spawn('/Users/riseof/.bun/bin/bun', ['run', 'index.ts'], {
    cwd: serverDir,
    stdio: ['ignore', 'pipe', 'pipe']
  })
  server.on('error', (err: Error) => console.error('[server] spawn failed:', err.message))
  server.stdout?.on('data', (d: Buffer) => process.stdout.write(`[server] ${d}`))
  server.stderr?.on('data', (d: Buffer) => process.stderr.write(`[server:err] ${d}`))
  server.on('exit', (code) => {
    console.log(`[server] exited ${code}`)
    server = null
  })
  console.log(`[server] started PID=${server.pid}`)
}

function stopServer(): void {
  if (server) {
    server.kill('SIGTERM')
    server = null
  }
}

function createWindow(): BrowserWindow {
  const w = new BrowserWindow({
    width: 400,
    height: 340,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  w.setAlwaysOnTop(true, 'pop-up-menu')
  w.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true, visibleOnFullScreen: true })

  w.on('show', () => console.log('[win] show event, visible:', w.isVisible()))
  w.on('hide', () => {
    console.log('[win] hide event')
  })
  w.on('blur', () => console.log('[win] blur fired'))
  w.on('focus', () => console.log('[win] focus event'))

  w.webContents.on('console-message', (_e, level, message, line, sourceId) => {
    console.log(`[renderer:${level}] ${message} (${sourceId}:${line})`)
  })
  w.webContents.on('did-fail-load', (_e, errorCode, errorDescription, validatedURL) => {
    console.error(`[renderer] did-fail-load ${errorCode} ${errorDescription} ${validatedURL}`)
  })
  w.webContents.on('did-finish-load', () => {
    console.log('[renderer] did-finish-load')
    w.webContents
      .executeJavaScript(
        `
      document.body.style.background = 'rgba(20,20,28,0.95)';
      console.log('[diag] root:', document.getElementById('root')?.innerHTML?.length);
    `
      )
      .catch(() => {})
  })

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    w.webContents.openDevTools({ mode: 'detach' })
    w.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    w.loadFile(join(__dirname, '../renderer/index.html'))
  }

  return w
}

function positionWindowBelowTray(w: BrowserWindow, trayBounds?: Electron.Rectangle): void {
  const rawBounds =
    trayBounds && trayBounds.width > 0
      ? trayBounds
      : (tray?.getBounds() ?? { x: 0, y: 0, width: 32, height: 30 })

  const trayCenter = { x: rawBounds.x + rawBounds.width / 2, y: rawBounds.y + rawBounds.height / 2 }
  const display = screen.getDisplayNearestPoint(trayCenter)
  const { workArea } = display

  const winBounds = w.getBounds()
  const rawX = Math.round(rawBounds.x + rawBounds.width / 2 - winBounds.width / 2)
  const x = Math.max(workArea.x, Math.min(rawX, workArea.x + workArea.width - winBounds.width))
  const y = workArea.y + 4

  console.log('[tray] positioning window at:', x, y)
  w.setPosition(x, y, false)
}

function showWindow(): void {
  console.log('[showWindow] called — win exists:', !!win, 'destroyed:', win?.isDestroyed())
  if (!win || win.isDestroyed()) {
    console.log('[showWindow] creating new window')
    win = createWindow()
    win.webContents.once('did-finish-load', () => {
      console.log('[showWindow] did-finish-load — positioning and showing')
      if (win) positionWindowBelowTray(win, lastTrayBounds)
      win?.setAlwaysOnTop(true, 'pop-up-menu', 1)
      win?.setVisibleOnAllWorkspaces(true, {
        skipTransformProcessType: true,
        visibleOnFullScreen: true
      })
      win?.showInactive()
      win?.moveTop()
      console.log(
        '[showWindow] after showInactive, visible:',
        win?.isVisible(),
        'bounds:',
        win?.getBounds()
      )
    })
    return
  }
  console.log(
    '[showWindow] reusing existing window — visible:',
    win.isVisible(),
    'bounds:',
    win.getBounds()
  )
  positionWindowBelowTray(win, lastTrayBounds)
  win.setAlwaysOnTop(true, 'pop-up-menu', 1)
  win.setVisibleOnAllWorkspaces(true, { skipTransformProcessType: true, visibleOnFullScreen: true })
  win.showInactive()
  win.moveTop()
  console.log(
    '[showWindow] after showInactive, visible:',
    win.isVisible(),
    'bounds:',
    win.getBounds()
  )
}

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate([
    { label: 'Hey Jarvis — Running', enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: () => showWindow() },
    { type: 'separator' },
    {
      label: 'Restart Daemon',
      click: () => {
        stopDaemon()
        startDaemon()
      }
    },
    { label: 'Stop Daemon', click: stopDaemon },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        stopDaemon()
        stopServer()
        tray?.destroy()
        tray = null
        app.exit(0)
      }
    }
  ])
}

// ── Overlay ───────────────────────────────────────────────────────────────────

type OverlayPayload = {
  mode: 'success' | 'recording' | 'cancelled' | 'error' | 'message' | 'hidden'
  text?: string
}

function overlayBoundsForMode(mode: string): {
  x: number
  y: number
  width: number
  height: number
} {
  const { width: sw } = screen.getPrimaryDisplay().workAreaSize
  if (mode === 'message') {
    return { x: sw - 480 - 18, y: 30, width: 480, height: 80 }
  }
  if (mode === 'recording') {
    return { x: 18, y: 30, width: 420, height: 54 }
  }
  return { x: 18, y: 30, width: 360, height: 52 }
}

function createOverlayWindow(): BrowserWindow {
  const bounds = overlayBoundsForMode('recording')

  const w = new BrowserWindow({
    ...bounds,
    frame: false,
    transparent: true,
    alwaysOnTop: true,
    skipTaskbar: true,
    resizable: false,
    focusable: false,
    show: false,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false
    }
  })

  w.setAlwaysOnTop(true, 'screen-saver')
  w.setIgnoreMouseEvents(true)

  const overlayFilePath = join(__dirname, '../renderer/overlay.html')

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const devUrl = `${process.env['ELECTRON_RENDERER_URL']}/overlay.html`
    w.loadURL(devUrl).catch(() => {
      // Vite dev server not reachable — fall back to built file
      console.warn('[overlay] dev server unreachable, falling back to loadFile')
      w.loadFile(overlayFilePath).catch((e: Error) =>
        console.error('[overlay] loadFile fallback failed:', e.message)
      )
    })
  } else {
    w.loadFile(overlayFilePath)
  }

  return w
}

function showOverlay(payload: OverlayPayload): void {
  if (!overlayWin || overlayWin.isDestroyed()) {
    overlayWin = createOverlayWindow()
    overlayWin.webContents.once('did-finish-load', () => {
      overlayWin?.setBounds(overlayBoundsForMode(payload.mode))
      overlayWin?.show()
      overlayWin?.webContents.send('overlay-show', payload)
    })
    return
  }
  overlayWin.setBounds(overlayBoundsForMode(payload.mode))
  if (!overlayWin.isVisible()) overlayWin.show()
  overlayWin.webContents.send('overlay-show', payload)
}

function startOverlayServer(): void {
  const server = http.createServer((req, res) => {
    if (req.method !== 'POST' || req.url !== '/overlay') {
      res.writeHead(404)
      res.end()
      return
    }
    let body = ''
    req.on('data', (chunk: Buffer) => {
      body += chunk.toString()
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
  })
  server.listen(OVERLAY_PORT, '127.0.0.1', () => {
    console.log(`[overlay-server] listening on http://127.0.0.1:${OVERLAY_PORT}`)
  })
  server.on('error', (e: Error) => console.error(`[overlay-server] error: ${e.message}`))
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

ipcMain.handle('get-status', async () => {
  const target = readLastTarget()
  try {
    const res = await fetch('http://127.0.0.1:3030/mic')
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

ipcMain.handle('set-target', (_event, { target }: { target: string }) => {
  saveLastTarget(target)
  void fetch('http://127.0.0.1:3030/target', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ target })
  }).catch(() => {})
})

ipcMain.on('hide-window', () => {
  console.log('[ipc] hide-window from renderer')
  win?.hide()
})

ipcMain.handle('show-overlay', (_event, payload: OverlayPayload) => {
  showOverlay(payload)
})

ipcMain.handle('get-agents', async () => {
  try {
    const res = await fetch('http://127.0.0.1:3030/agents', { signal: AbortSignal.timeout(2000) })
    if (res.ok) {
      const data: unknown = await res.json()
      if (isAgentsResponse(data)) {
        return data.agents.map((a) => (typeof a === 'string' ? a : a.name))
      }
    }
  } catch {
    /* ignore */
  }
  return ['command', 'chief-of-staff', 'productivitesse']
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })

  const icon = nativeImage.createFromNamedImage('NSImageNameStatusAvailable', [-1, 0, 1])
  tray = new Tray(icon)
  tray.setToolTip('Hey Jarvis — click to open settings')
  tray.setIgnoreDoubleClickEvents(true)

  tray.on('click', (_event, bounds) => {
    lastTrayBounds = bounds
    if (win && !win.isDestroyed() && win.isVisible()) {
      win.hide()
    } else {
      showWindow()
    }
  })
  tray.on('right-click', () => {
    tray?.popUpContextMenu(buildMenu())
  })

  startOverlayServer()
  startServer()
  startDaemon()
})

app.on('before-quit', () => {
  stopDaemon()
  stopServer()
  tray?.destroy()
  tray = null
})
app.on('window-all-closed', () => {
  /* tray app — keep alive */
})
