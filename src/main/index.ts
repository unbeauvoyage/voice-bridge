import { app, Tray, Menu, nativeImage, ipcMain, screen, type NativeImage } from 'electron'
import { join } from 'path'
import { type OverlayPayload, isRecordingState } from './typeGuards'
import { createTargetStore } from './state/targetStore'
import { createDaemonController } from './processes/daemon'
import { createBackendServerController } from './processes/backendServer'
import { createOverlayServerController } from './overlay/overlayServer'
import { createOverlayManager, createToastManager } from './overlay/overlayWindow'
import {
  createOverlayBrowserWindow,
  createToastBrowserWindow
} from './overlay/overlayBrowserWindow'
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
    // Authoritative recording state from daemon stdout — drives tray icon.
    // This is the ONLY path that may call setRecordingState(). Overlay payloads
    // must NOT drive recording state — they are best-effort HTTP and can arrive
    // for non-recording events (e.g. mode="message" toasts) during mic recording.
    if (isRecordingState(state)) {
      trayCtrl?.setRecordingState(state.recording)
    }
    const w = mainWindowManager.getWindow()
    if (w) w.webContents.send('state-change', state)
  }
})

const backendServerController = createBackendServerController({
  bunBinary: process.env['BUN_BINARY'] ?? 'bun',
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

// Recording/status overlay — left side, small pill, repositions between recording and status modes.
const overlayManager = createOverlayManager({
  getScreenWidth: () => screen.getPrimaryDisplay().workAreaSize.width,
  createWindow: () => createOverlayBrowserWindow(__dirname)
})

// Message toast overlay — RIGHT side, separate window that never moves.
// Keeping this independent means incoming relay messages don't reposition
// the recording pill (the original bug: one shared window moved right on message).
const toastManager = createToastManager({
  createWindow: () =>
    createToastBrowserWindow(__dirname, screen.getPrimaryDisplay().workAreaSize.width)
})

function showOverlay(payload: OverlayPayload): void {
  // Overlay payloads are display-only — they MUST NOT drive tray recording state.
  // A "message" mode overlay from relay-poller can arrive while the mic is actively
  // recording; if that overlay called setRecordingState it would flip the tray back
  // to green, lying about mic state. Recording state is driven exclusively by
  // daemon stdout JSON events in onStateChange above.
  if (payload.mode === 'message') {
    toastManager.show(payload)
  } else {
    overlayManager.show(payload)
  }
}

// ── IPC handlers ─────────────────────────────────────────────────────────────

registerIpcHandlers(ipcMain, {
  fetchFn: fetch,
  targetStore,
  hideMainWindow: () => mainWindowManager.hide(),
  showOverlay: (payload) => showOverlay(payload),
  sendStateUpdate: (update) => {
    const w = mainWindowManager.getWindow()
    if (w) w.webContents.send('state-change', update)
  }
})

// ── App lifecycle ─────────────────────────────────────────────────────────────

app.whenReady().then(() => {
  app.setLoginItemSettings({ openAtLogin: true, openAsHidden: true })

  // NSImageNameStatusAvailable → green dot (idle/ready)
  // recordingFrames → same-size custom circles fading red→white→red (breathing pulse)
  const normalIcon = nativeImage.createFromNamedImage('NSImageNameStatusAvailable', [-1, 0, 1])
  const recordingIcon = nativeImage.createFromNamedImage('NSImageNameStatusUnavailable', [-1, 0, 1])
  function pngIcon(b64: string): ReturnType<typeof nativeImage.createFromDataURL> {
    return nativeImage.createFromDataURL(`data:image/png;base64,${b64}`)
  }
  // Five same-size 22×22 circles: red → mid-red → light-pink → near-white → white
  const f0 = pngIcon('iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAjklEQVR42t3VzQnAIAwFYBfJAh7fKq7jdtnAc4Zwg5ZCBA9af0pK6eEhFPlIg0YngLOI+zVMAnhdH8MXEgVgAbIAh66s32kHDgIkxXpJum8aDlWFo+QW3vv9NInWldMIjotoSRzBvAnzHUwLvW31mnqw30RL/OsVm/XY9FSYnWOzm2c6K0ynm+k8/t7TdAL/iBJx01vHQgAAAABJRU5ErkJggg==')
  const f1 = pngIcon('iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAjklEQVR42t3V2wnAIAwFUBfJAq7jHncCt8sGzpAB3KClEMEPrY+SUvpxEYoc0qDRCeAs4n4NkwBe18fwhUQBWIAswKEr63fagYMASbFeku6bhkNV4Si5hfd+P02ideU0guMiWhJHMG/CfAfTQm9bvaYe7DfREv96xWY9Nj0VZufY7OaZzgrT6WY6j7/3NJ3CegSAWj+lvQAAAABJRU5ErkJggg==')
  const f2 = pngIcon('iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAjklEQVR42t3VzQnAIAwFYBfJAq7jOk701sgGrpGLG7QUInjQ+lNSSg8PochHGjQ6AZxF3K9hEsDr+hi+kCgAC5AFOHRl/U47cBAgKdZL0n3TcKgqHCW38N7vp0m0rpxGcFxES+II5k2Y72Ba6G2r19SD/SZa4l+v2KzHpqfC7Byb3TzTWWE63Uzn8feephNHQfScmnbq5wAAAABJRU5ErkJggg==')
  const f3 = pngIcon('iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAjElEQVR42t3VzQnAIAwFYBfJAq7jOm7nBp7fENmgpRDBg9af8krp4SEU+UiDRqeAY8T9GhYFvK2P4QuJCiQFVIHD1mTfZQcOCmTDesm2bxoOVYWjaAvv/X6eROvKZQTHRbQkjuC0Cac7WBZ62+q19GC/iZb41yum9Zh6KmjnmHbzqLOCOt2o8/h7T9MJrLS7Lya6x5MAAAAASUVORK5CYII=')
  const f4 = pngIcon('iVBORw0KGgoAAAANSUhEUgAAABYAAAAWCAYAAADEtGw7AAAAi0lEQVR42t3VzQmAMAyG4S6SBbqO63S7bNBJvLxnRYjgobU/EhEPHwUpDzG0aQCCR8KvYQGirY/hA0mAAiuw2ar2XWbgBciG1ZJtXze8XCpsZS3htd/Pnei1cmnBaRA9k1qwTsJ6B8tAb0u9lhocJ9Ez8fWK3XrseirczrHbzXOdFa7TzXUef+9p2gF66CM6mdxWdQAAAABJRU5ErkJggg==')
  // Breathing sequence: red→mid→light→near-white→white→near-white→light→mid (loops back to red)
  const recordingFrames = [f0, f1, f2, f3, f4, f3, f2, f1]
  tray = new Tray(normalIcon)
  tray.setToolTip('Hey Jarvis — click to open settings')
  tray.setIgnoreDoubleClickEvents(true)

  const trayShim = {
    on: (event: 'click' | 'right-click', listener: (...args: unknown[]) => void): unknown => {
      if (event === 'click') return tray?.on('click', (...args) => listener(...args))
      return tray?.on('right-click', (...args) => listener(...args))
    },
    popUpContextMenu: (menu: unknown): void => {
      if (menu instanceof Menu) tray?.popUpContextMenu(menu)
    },
    setImage: (icon: NativeImage): void => {
      if (tray) tray.setImage(icon)
    }
  }
  trayCtrl = attachTrayBehavior(trayShim, {
    buildMenu: () => buildMenu(),
    showMainWindow: () => showWindow(),
    hideMainWindow: () => mainWindowManager.hide(),
    isMainWindowVisible: () => mainWindowManager.isVisible(),
    normalIcon,
    recordingIcon,
    recordingFrames
  })

  // Pre-warm both overlay windows now, before any recording starts.
  // Creating a new BrowserWindow while recording was active caused macOS window-manager
  // cascading that repositioned the recording overlay and could disrupt the audio session.
  overlayManager.prewarm()
  toastManager.prewarm()

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
