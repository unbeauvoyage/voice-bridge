/**
 * Main settings window manager — owns the `win` lifecycle.
 *
 * `calculateTrayAnchoredPosition(trayBounds, winBounds, workArea)`
 * is the pure positioning function: horizontally-center on the tray
 * icon, clamp to workArea edges, pin y to workArea.y + 4. Screen
 * API injected so tests run without Electron.
 *
 * `createMainWindowManager({ createWindow, getTrayBounds,
 * getLastTrayBounds, getWorkAreaForPoint }) → { show, hide,
 * getWindow, isVisible }` is a controller-object owning the single
 * `win` reference. `show()` creates on first call, waits for
 * `did-finish-load`, positions + shows + moves-top; subsequent
 * calls reuse. After `isDestroyed()` transitions a fresh window
 * is created.
 *
 * `MainWindowLike` captures just the surface the manager uses so
 * tests can pass EventEmitter-backed fakes without type
 * assertions. Real Electron BrowserWindow satisfies it.
 */

export type Rectangle = { x: number; y: number; width: number; height: number }
export type WorkArea = Rectangle

export type MainWebContentsLike = {
  once: (event: 'did-finish-load', listener: () => void) => unknown
  send: (channel: string, ...args: unknown[]) => void
}

export type MainWindowLike = {
  webContents: MainWebContentsLike
  setAlwaysOnTop: (flag: boolean, level?: 'pop-up-menu', relativeLevel?: number) => void
  setVisibleOnAllWorkspaces: (
    visible: boolean,
    options?: { skipTransformProcessType?: boolean; visibleOnFullScreen?: boolean }
  ) => void
  showInactive: () => void
  hide: () => void
  moveTop: () => void
  isVisible: () => boolean
  isDestroyed: () => boolean
  setPosition: (x: number, y: number, animate?: boolean) => void
  getBounds: () => Rectangle
}

export type MainWindowManagerConfig = {
  createWindow: () => MainWindowLike
  getTrayBounds: () => Rectangle
  getLastTrayBounds: () => Rectangle | undefined
  getWorkAreaForPoint: (x: number, y: number) => WorkArea
}

export type MainWindowManager = {
  show: () => void
  hide: () => void
  getWindow: () => MainWindowLike | null
  isVisible: () => boolean
}

export function calculateTrayAnchoredPosition(
  trayBounds: Rectangle,
  winBounds: { width: number; height: number },
  workArea: WorkArea
): { x: number; y: number } {
  const rawX = Math.round(trayBounds.x + trayBounds.width / 2 - winBounds.width / 2)
  const x = Math.max(workArea.x, Math.min(rawX, workArea.x + workArea.width - winBounds.width))
  const y = workArea.y + 4
  return { x, y }
}

export function createMainWindowManager(cfg: MainWindowManagerConfig): MainWindowManager {
  let win: MainWindowLike | null = null

  function resolveTrayBounds(): Rectangle {
    const last = cfg.getLastTrayBounds()
    if (last && last.width > 0) return last
    return cfg.getTrayBounds()
  }

  function position(w: MainWindowLike): void {
    const trayBounds = resolveTrayBounds()
    const trayCenter = {
      x: trayBounds.x + trayBounds.width / 2,
      y: trayBounds.y + trayBounds.height / 2
    }
    const workArea = cfg.getWorkAreaForPoint(trayCenter.x, trayCenter.y)
    const pos = calculateTrayAnchoredPosition(trayBounds, w.getBounds(), workArea)
    w.setPosition(pos.x, pos.y, false)
  }

  function show(): void {
    if (!win || win.isDestroyed()) {
      win = cfg.createWindow()
      const w = win
      w.webContents.once('did-finish-load', () => {
        position(w)
        w.setAlwaysOnTop(true, 'pop-up-menu', 1)
        w.setVisibleOnAllWorkspaces(true, {
          skipTransformProcessType: true,
          visibleOnFullScreen: true
        })
        w.showInactive()
        w.moveTop()
      })
      return
    }
    position(win)
    win.setAlwaysOnTop(true, 'pop-up-menu', 1)
    win.setVisibleOnAllWorkspaces(true, {
      skipTransformProcessType: true,
      visibleOnFullScreen: true
    })
    win.showInactive()
    win.moveTop()
  }

  function hide(): void {
    if (win && !win.isDestroyed()) win.hide()
  }

  function getWindow(): MainWindowLike | null {
    if (win && win.isDestroyed()) return null
    return win
  }

  function isVisible(): boolean {
    return win !== null && !win.isDestroyed() && win.isVisible()
  }

  return { show, hide, getWindow, isVisible }
}
