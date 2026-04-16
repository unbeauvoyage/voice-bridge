import { app, Tray, Menu, nativeImage, ipcMain, screen } from 'electron'
import { join } from 'path'
import { type OverlayPayload } from './typeGuards'
import { createTargetStore } from './state/targetStore'
import { createDaemonController } from './processes/daemon'
import { createBackendServerController } from './processes/backendServer'
import { createOverlayServerController } from './overlay/overlayServer'
import { createOverlayManager } from './overlay/overlayWindow'
import { createOverlayBrowserWindow } from './overlay/overlayBrowserWindow'
import { createMainWindowManager } from './windows/mainWindow'
import { createMainBrowserWindow } from './windows/mainBrowserWindow'
import { registerIpcHandlers } from './ipc'
import { buildMenuTemplate, attachTrayBehavior, type TrayController } from './tray'
import {
  OVERLAY_PORT,
  PROJECT_ROOT,
  LAST_TARGET_FILE,
  DAEMON_DIR,
  WAKE_WORD_SCRIPT,
  VENV_PACKAGES,
  PYTHON_APP
} from './config'

// Single instance lock
if (!app.requestSingleInstanceLock()) {
  app.quit()
  process.exit(0)
}

// Hide from dock — this is a background utility
app.dock?.hide()

let tray: Tray | null = null
let trayCtrl: TrayController | null = null

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

const mainWindowManager = createMainWindowManager({
  createWindow: () => createMainBrowserWindow(__dirname),
  getTrayBounds: () => tray?.getBounds() ?? { x: 0, y: 0, width: 32, height: 30 },
  getLastTrayBounds: () => trayCtrl?.getLastTrayBounds(),
  getWorkAreaForPoint: (x, y) => screen.getDisplayNearestPoint({ x, y }).workArea
})

function showWindow(): void {
  mainWindowManager.show()
}

function buildMenu(): Electron.Menu {
  return Menu.buildFromTemplate(
    buildMenuTemplate({
      onSettings: () => showWindow(),
      onRestartDaemon: () => {
        daemonController.stop()
        daemonController.start()
      },
      onStopDaemon: () => daemonController.stop(),
      onQuit: () => {
        daemonController.stop()
        backendServerController.stop()
        overlayServerController.stop()
        tray?.destroy()
        tray = null
        app.exit(0)
      }
    })
  )
}

// ── Overlay ───────────────────────────────────────────────────────────────────

const overlayManager = createOverlayManager({
  getScreenWidth: () => screen.getPrimaryDisplay().workAreaSize.width,
  createWindow: () => createOverlayBrowserWindow(__dirname)
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

  const trayShim = {
    on: (event: 'click' | 'right-click', listener: (...args: unknown[]) => void): unknown => {
      if (event === 'click') return tray?.on('click', (...args) => listener(...args))
      return tray?.on('right-click', (...args) => listener(...args))
    },
    popUpContextMenu: (menu: unknown): void => {
      if (menu instanceof Menu) tray?.popUpContextMenu(menu)
    }
  }
  trayCtrl = attachTrayBehavior(trayShim, {
    buildMenu: () => buildMenu(),
    showMainWindow: () => showWindow(),
    hideMainWindow: () => mainWindowManager.hide(),
    isMainWindowVisible: () => mainWindowManager.isVisible()
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
