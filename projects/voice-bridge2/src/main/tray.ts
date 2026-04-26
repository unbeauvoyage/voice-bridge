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

export type ConnectionState = 'connected' | 'disconnected' | 'error'

export type MenuStatus = {
  relay?: ConnectionState
  whisper?: ConnectionState
}

// TIcon is the type of icon values (NativeImage in production; opaque token in tests).
// Defaults to unknown so test fakes and production code can both implement TrayLike
// without needing a cast at the call site.
export type TrayLike<TIcon = unknown> = {
  on: (event: 'click' | 'right-click', listener: (...args: unknown[]) => void) => unknown
  popUpContextMenu: (menu: unknown) => void
  // Optional — present on real Electron Tray and on test fakes that exercise
  // the recording indicator. Omitted on fakes that don't care about icons.
  setImage?: (icon: TIcon) => void
}

export type TrayDeps<TIcon = unknown> = {
  buildMenu: () => unknown
  showMainWindow: () => void
  hideMainWindow: () => void
  isMainWindowVisible: () => boolean
  // Icon values to swap on recording state change. Both must be provided for
  // icon swapping to activate. Either may be any value the underlying tray
  // accepts (real nativeImage in production; opaque token in tests).
  normalIcon?: TIcon
  recordingIcon?: TIcon
  // Relay connectivity icons. When provided, setRelayState() swaps the icon
  // to reflect the relay's health ('disconnected' or 'error'); 'connected'
  // reverts to normalIcon.
  relayDisconnectedIcon?: TIcon
  relayErrorIcon?: TIcon
  // Whisper-server connectivity icons. When provided, setWhisperState() swaps
  // the icon to reflect whisper-server health; 'connected' reverts to normalIcon.
  whisperDisconnectedIcon?: TIcon
  whisperErrorIcon?: TIcon
}

export type TrayController = {
  getLastTrayBounds: () => TrayRectangle | undefined
  // Privacy requirement: always indicate when the mic is recording.
  // Swaps the tray icon between normal and recording states.
  // No-op when `normalIcon`/`recordingIcon` were not provided in deps.
  setRecordingState: (recording: boolean) => void
  // Relay connectivity indicator. Updates the tray icon to reflect relay health.
  // 'connected' → normalIcon, 'disconnected' → relayDisconnectedIcon,
  // 'error' → relayErrorIcon. No-op when relay icons not provided in deps.
  setRelayState: (state: ConnectionState) => void
  // Whisper-server connectivity indicator. Same three-state model as relay.
  // 'connected' → normalIcon, 'disconnected' → whisperDisconnectedIcon,
  // 'error' → whisperErrorIcon. No-op when whisper icons not provided in deps.
  setWhisperState: (state: ConnectionState) => void
  // Returns the current relay + whisper states for use in buildMenuTemplate.
  getMenuStatus: () => Required<MenuStatus>
}

function stateLabel(prefix: string, state: ConnectionState): string {
  if (state === 'connected') return `${prefix}: Connected`
  if (state === 'disconnected') return `${prefix}: Offline`
  return `${prefix}: Error`
}

export function buildMenuTemplate(cb: MenuCallbacks, status?: MenuStatus): MenuTemplate {
  const relay: ConnectionState = status?.relay ?? 'connected'
  const whisper: ConnectionState = status?.whisper ?? 'connected'
  return [
    { label: 'Hey Jarvis — Running', enabled: false },
    { label: stateLabel('Relay', relay), enabled: false },
    { label: stateLabel('Whisper', whisper), enabled: false },
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

export function attachTrayBehavior<TIcon>(
  tray: TrayLike<TIcon>,
  deps: TrayDeps<TIcon>
): TrayController {
  let lastTrayBounds: TrayRectangle | undefined
  let relayState: ConnectionState = 'connected'
  let whisperState: ConnectionState = 'connected'

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

  function setRelayState(state: ConnectionState): void {
    relayState = state
    if (!tray.setImage) return
    if (state === 'disconnected') {
      if (deps.relayDisconnectedIcon !== undefined) tray.setImage(deps.relayDisconnectedIcon)
    } else if (state === 'error') {
      if (deps.relayErrorIcon !== undefined) tray.setImage(deps.relayErrorIcon)
    } else {
      // 'connected' → revert to normalIcon
      if (deps.normalIcon !== undefined) tray.setImage(deps.normalIcon)
    }
  }

  function setWhisperState(state: ConnectionState): void {
    whisperState = state
    if (!tray.setImage) return
    if (state === 'disconnected') {
      if (deps.whisperDisconnectedIcon !== undefined) tray.setImage(deps.whisperDisconnectedIcon)
    } else if (state === 'error') {
      if (deps.whisperErrorIcon !== undefined) tray.setImage(deps.whisperErrorIcon)
    } else {
      if (deps.normalIcon !== undefined) tray.setImage(deps.normalIcon)
    }
  }

  return {
    getLastTrayBounds: () => lastTrayBounds,
    setRecordingState,
    setRelayState,
    setWhisperState,
    getMenuStatus: () => ({ relay: relayState, whisper: whisperState })
  }
}
