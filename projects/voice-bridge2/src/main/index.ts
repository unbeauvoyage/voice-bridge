import { app, Tray, Menu, nativeImage, BrowserWindow, ipcMain, screen } from 'electron'
import { join } from 'path'
import { is } from '@electron-toolkit/utils'
import { type OverlayPayload } from './typeGuards'
import { createTargetStore } from './state/targetStore'
import { createDaemonController } from './processes/daemon'
import { createBackendServerController } from './processes/backendServer'
import { createOverlayServerController } from './overlay/overlayServer'
import { createOverlayManager } from './overlay/overlayWindow'
import { createMainWindowManager } from './windows/mainWindow'
import { registerIpcHandlers } from './ipc'

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Hide from dock — this is a background utility
app.dock?.hide()

let tray: Tray | null = null
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

const targetStore = createTargetStore(LAST_TARGET_FILE)

const daemonController = createDaemonController({
  pythonApp: PYTHON_APP,
  wakeWordScript: WAKE_WORD_SCRIPT,
  venvPackages: VENV_PACKAGES,
  workDir: join(DAEMON_DIR, '..'),
  readTarget: () => targetStore.read(),
  onStateChange: (state: unknown) => {
    const w = mainWindowManager.getWindow()
    if (w) w.webContents.send('state-change', state)
  }
})

const backendServerController = createBackendServerController({
  bunBinary: '/Users/riseof/.bun/bin/bun',
  serverDir: join(PROJECT_ROOT, 'server')
})

const overlayServerController = createOverlayServerController({
  port: OVERLAY_PORT,
  showOverlay: (payload) => showOverlay(payload)
})

function createMainBrowserWindow(): BrowserWindow {
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

const mainWindowManager = createMainWindowManager({
  createWindow: () => createMainBrowserWindow(),
  getTrayBounds: () => tray?.getBounds() ?? { x: 0, y: 0, width: 32, height: 30 },
  getLastTrayBounds: () => lastTrayBounds,
  getWorkAreaForPoint: (x, y) => screen.getDisplayNearestPoint({ x, y }).workArea
})

function showWindow(): void {
  mainWindowManager.show()
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
        daemonController.stop()
        daemonController.start()
      }
    },
    { label: 'Stop Daemon', click: () => daemonController.stop() },
    { type: 'separator' },
    {
      label: 'Quit',
      click: () => {
        daemonController.stop()
        backendServerController.stop()
        overlayServerController.stop()
        tray?.destroy()
        tray = null
        app.exit(0)
      }
    }
  ])
}

// ── Overlay window ───────────────────────────────────────────────────────────

function createOverlayBrowserWindow(): BrowserWindow {
  const bounds = { x: 18, y: 30, width: 420, height: 54 }

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

const overlayManager = createOverlayManager({
  getScreenWidth: () => screen.getPrimaryDisplay().workAreaSize.width,
  createWindow: () => createOverlayBrowserWindow()
})

function showOverlay(payload: OverlayPayload): void {
  overlayManager.show(payload)
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

registerIpcHandlers(ipcMain, {
  fetchFn: fetch,
  targetStore,
  hideMainWindow: () => mainWindowManager.hide(),
  showOverlay: (payload) => showOverlay(payload)
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
    if (mainWindowManager.isVisible()) {
      mainWindowManager.hide()
    } else {
      showWindow()
    }
  })
  tray.on('right-click', () => {
    tray?.popUpContextMenu(buildMenu())
  })

  overlayServerController.start()
  backendServerController.start()
  daemonController.start()
})

app.on('before-quit', () => {
  daemonController.stop()
  backendServerController.stop()
  overlayServerController.stop()
  tray?.destroy()
  tray = null
})
app.on('window-all-closed', () => {
  /* tray app — keep alive */
})
