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
  // Optional — present on real Electron Tray and on test fakes that exercise
  // the recording indicator. Omitted on fakes that don't care about icons.
  setImage?: (icon: unknown) => void
}

export type TrayDeps = {
  buildMenu: () => unknown
  showMainWindow: () => void
  hideMainWindow: () => void
  isMainWindowVisible: () => boolean
  // Icon values to swap on recording state change. Both must be provided for
  // icon swapping to activate. Either may be any value the underlying tray
  // accepts (real nativeImage in production; opaque token in tests).
  normalIcon?: unknown
  recordingIcon?: unknown
}

export type TrayController = {
  getLastTrayBounds: () => TrayRectangle | undefined
  // Privacy requirement: always indicate when the mic is recording.
  // Swaps the tray icon between normal and recording states.
  // No-op when `normalIcon`/`recordingIcon` were not provided in deps.
  setRecordingState: (recording: boolean) => void
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

  function setRecordingState(recording: boolean): void {
    // Only swap icon when both icon values and the setImage method are available.
    // Callers that don't provide icons (e.g. tests focused on click behavior)
    // get a graceful no-op — the rest of tray functionality is unaffected.
    if (!tray.setImage) return
    if (deps.normalIcon === undefined || deps.recordingIcon === undefined) return
    tray.setImage(recording ? deps.recordingIcon : deps.normalIcon)
  }

  return {
    getLastTrayBounds: () => lastTrayBounds,
    setRecordingState
  }
}
