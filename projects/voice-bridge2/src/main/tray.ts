/**
 * Tray menu + click-behavior wiring. Extracted from the Electron
 * shell so the menu structure and click dispatch can be unit-
 * tested offline.
 *
 * `buildMenuTemplate(callbacks)` is a pure function returning the
 * template array. The shell feeds it to `Menu.buildFromTemplate`.
 * Template shape matches the subset of Electron.MenuItemConstructor-
 * Options we use — label/enabled/click and separator.
 *
 * `attachTrayBehavior(tray, deps)` wires click + right-click
 * listeners. Click toggles the main window (hide if visible, show
 * if not) and stashes the tray bounds for the positioning module.
 * Right-click pops up a freshly-built context menu — `buildMenu`
 * is invoked per right-click so callback state stays current.
 *
 * The `lastTrayBounds` state that used to live at module scope in
 * src/main/index.ts is now internal to the returned controller;
 * consumers access it via `getLastTrayBounds()`.
 *
 * `TrayLike` captures just the surface we use so tests can pass
 * EventEmitter-backed fakes without type assertions. Real Electron
 * Tray satisfies the shape.
 */

export type TrayRectangle = { x: number; y: number; width: number; height: number }

export type MenuTemplateItem =
  | { label: string; enabled: false }
  | { label: string; click: () => void }
  | { type: 'separator' }

export type MenuTemplate = MenuTemplateItem[]

export type MenuCallbacks = {
  onSettings: () => void
  onRestartDaemon: () => void
  onStopDaemon: () => void
  onQuit: () => void
}

export type TrayLike = {
  on: (event: 'click' | 'right-click', listener: (...args: unknown[]) => void) => unknown
  popUpContextMenu: (menu: unknown) => void
}

export type TrayDeps = {
  buildMenu: () => unknown
  showMainWindow: () => void
  hideMainWindow: () => void
  isMainWindowVisible: () => boolean
}

export type TrayController = {
  getLastTrayBounds: () => TrayRectangle | undefined
}

export function buildMenuTemplate(cb: MenuCallbacks): MenuTemplate {
  return [
    { label: 'Hey Jarvis — Running', enabled: false },
    { type: 'separator' },
    { label: 'Settings', click: cb.onSettings },
    { type: 'separator' },
    { label: 'Restart Daemon', click: cb.onRestartDaemon },
    { label: 'Stop Daemon', click: cb.onStopDaemon },
    { type: 'separator' },
    { label: 'Quit', click: cb.onQuit }
  ]
}

function isTrayRectangle(v: unknown): v is TrayRectangle {
  if (typeof v !== 'object' || v === null) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return (
    typeof obj['x'] === 'number' &&
    typeof obj['y'] === 'number' &&
    typeof obj['width'] === 'number' &&
    typeof obj['height'] === 'number'
  )
}

export function attachTrayBehavior(tray: TrayLike, deps: TrayDeps): TrayController {
  let lastTrayBounds: TrayRectangle | undefined

  tray.on('click', (..._args: unknown[]) => {
    const bounds = _args[1]
    if (isTrayRectangle(bounds)) lastTrayBounds = bounds
    if (deps.isMainWindowVisible()) {
      deps.hideMainWindow()
    } else {
      deps.showMainWindow()
    }
  })

  tray.on('right-click', () => {
    tray.popUpContextMenu(deps.buildMenu())
  })

  return {
    getLastTrayBounds: () => lastTrayBounds
  }
}
