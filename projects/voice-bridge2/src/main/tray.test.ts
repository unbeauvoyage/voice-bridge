import { describe, test, expect } from 'bun:test'
import { EventEmitter } from 'node:events'
import {
  buildMenuTemplate,
  attachTrayBehavior,
  type MenuTemplate,
  type TrayLike,
  type TrayDeps,
  type TrayRectangle
} from './tray.ts'

// ── Recording indicator tests ─────────────────────────────────────────────────
//
// Privacy requirement: the user must always know when the mic is actively
// recording. The tray icon swaps to a "recording" image when recording starts
// and reverts to the normal image when recording stops.
//
// The recording icon is identified by the string token "recording-icon" and the
// normal icon by "normal-icon". These are opaque values supplied by the caller
// (in production: real nativeImage objects; in tests: string tokens for easy
// assertion without depending on Electron's nativeImage).

type IconToken = string

class FakeTrayWithImage extends EventEmitter implements TrayLike {
  popUps: unknown[] = []
  images: IconToken[] = []
  popUpContextMenu(menu: unknown): void {
    this.popUps.push(menu)
  }
  setImage(icon: IconToken): void {
    this.images.push(icon)
  }
}

function makeDepsWithIcons(overrides: Partial<TrayDeps> = {}): {
  deps: TrayDeps
  calls: string[]
  menuToken: object
  normalIcon: IconToken
  recordingIcon: IconToken
} {
  const calls: string[] = []
  const menuToken = { fake: 'menu' }
  const normalIcon: IconToken = 'normal-icon'
  const recordingIcon: IconToken = 'recording-icon'
  const deps: TrayDeps = {
    buildMenu: () => menuToken,
    showMainWindow: () => calls.push('show'),
    hideMainWindow: () => calls.push('hide'),
    isMainWindowVisible: () => false,
    normalIcon,
    recordingIcon,
    ...overrides
  }
  return { deps, calls, menuToken, normalIcon, recordingIcon }
}

describe('TrayController — recording indicator', () => {
  test('setRecordingState(true) swaps tray icon to recording icon', () => {
    const tray = new FakeTrayWithImage()
    const { deps, recordingIcon } = makeDepsWithIcons()
    const ctrl = attachTrayBehavior(tray, deps)
    ctrl.setRecordingState(true)
    expect(tray.images).toContain(recordingIcon)
  })

  test('setRecordingState(false) reverts tray icon to normal icon', () => {
    const tray = new FakeTrayWithImage()
    const { deps, normalIcon } = makeDepsWithIcons()
    const ctrl = attachTrayBehavior(tray, deps)
    // Start recording then stop
    ctrl.setRecordingState(true)
    ctrl.setRecordingState(false)
    expect(tray.images[tray.images.length - 1]).toBe(normalIcon)
  })

  test('setRecordingState(true) followed by false cycles icon correctly', () => {
    const tray = new FakeTrayWithImage()
    const { deps, normalIcon, recordingIcon } = makeDepsWithIcons()
    const ctrl = attachTrayBehavior(tray, deps)
    ctrl.setRecordingState(true)
    ctrl.setRecordingState(false)
    // Full cycle: normal → recording → normal
    expect(tray.images).toEqual([recordingIcon, normalIcon])
  })

  // When icons are not provided in deps, setRecordingState should not throw —
  // it's a graceful no-op so the rest of the tray keeps working even if icons
  // are omitted (e.g., in unit tests that don't care about icon state).
  test('setRecordingState is a no-op when icons not provided in deps', () => {
    const tray = new FakeTrayWithImage()
    const { deps } = makeDeps()
    const ctrl = attachTrayBehavior(tray, deps)
    // Should not throw
    expect(() => ctrl.setRecordingState(true)).not.toThrow()
    expect(() => ctrl.setRecordingState(false)).not.toThrow()
    expect(tray.images).toHaveLength(0)
  })

  test('existing click and right-click behavior unaffected by recording state', () => {
    const tray = new FakeTrayWithImage()
    const calls: string[] = []
    const { menuToken } = makeDepsWithIcons()
    const deps: TrayDeps = {
      buildMenu: () => menuToken,
      showMainWindow: () => calls.push('show'),
      hideMainWindow: () => calls.push('hide'),
      isMainWindowVisible: () => false,
      normalIcon: 'normal-icon',
      recordingIcon: 'recording-icon'
    }
    const ctrl = attachTrayBehavior(tray, deps)
    ctrl.setRecordingState(true)
    // Click should still toggle window
    tray.emit('click', null, { x: 0, y: 0, width: 32, height: 30 })
    expect(calls).toEqual(['show'])
    // Right-click should still pop up context menu
    tray.emit('right-click')
    expect(tray.popUps).toEqual([menuToken])
  })
})

type LabelClick = Extract<MenuTemplate[number], { label: string; click: () => void }>

function findLabeled(template: MenuTemplate, label: string): LabelClick {
  for (const item of template) {
    if ('label' in item && item.label === label && 'click' in item && item.click) {
      return item
    }
  }
  throw new Error(`label not found: ${label}`)
}

describe('buildMenuTemplate', () => {
  function noop(): void {
    /* test stub */
  }
  const callbacks = {
    onSettings: noop,
    onRestartDaemon: noop,
    onStopDaemon: noop,
    onQuit: noop
  }

  test('starts with disabled running marker', () => {
    const t = buildMenuTemplate(callbacks)
    const first = t[0]
    if (!first || !('label' in first)) throw new Error('expected label item')
    expect(first.label).toBe('Hey Jarvis — Running')
    expect(first.enabled).toBe(false)
  })

  test('contains Settings/Restart/Stop/Quit items', () => {
    const t = buildMenuTemplate(callbacks)
    const labels = t
      .map((item) => ('label' in item ? item.label : null))
      .filter((l): l is string => l !== null)
    expect(labels).toContain('Settings')
    expect(labels).toContain('Restart Daemon')
    expect(labels).toContain('Stop Daemon')
    expect(labels).toContain('Quit')
  })

  test('click callbacks wire to the provided functions', () => {
    const calls: string[] = []
    const t = buildMenuTemplate({
      onSettings: () => calls.push('settings'),
      onRestartDaemon: () => calls.push('restart'),
      onStopDaemon: () => calls.push('stop'),
      onQuit: () => calls.push('quit')
    })
    findLabeled(t, 'Settings').click()
    findLabeled(t, 'Restart Daemon').click()
    findLabeled(t, 'Stop Daemon').click()
    findLabeled(t, 'Quit').click()
    expect(calls).toEqual(['settings', 'restart', 'stop', 'quit'])
  })

  test('includes separators between sections', () => {
    const t = buildMenuTemplate(callbacks)
    const sepCount = t.filter((item) => 'type' in item && item.type === 'separator').length
    expect(sepCount).toBeGreaterThanOrEqual(2)
  })
})

class FakeTray extends EventEmitter implements TrayLike {
  popUps: unknown[] = []
  popUpContextMenu(menu: unknown): void {
    this.popUps.push(menu)
  }
}

function makeDeps(overrides: Partial<TrayDeps> = {}): {
  deps: TrayDeps
  calls: string[]
  menuToken: object
} {
  const calls: string[] = []
  const menuToken = { fake: 'menu' }
  const deps: TrayDeps = {
    buildMenu: () => menuToken,
    showMainWindow: () => calls.push('show'),
    hideMainWindow: () => calls.push('hide'),
    isMainWindowVisible: () => false,
    ...overrides
  }
  return { deps, calls, menuToken }
}

describe('attachTrayBehavior — click', () => {
  test('stores lastTrayBounds on click', () => {
    const tray = new FakeTray()
    const { deps } = makeDeps()
    const ctrl = attachTrayBehavior(tray, deps)
    expect(ctrl.getLastTrayBounds()).toBeUndefined()
    const bounds: TrayRectangle = { x: 100, y: 0, width: 32, height: 30 }
    tray.emit('click', null, bounds)
    expect(ctrl.getLastTrayBounds()).toEqual(bounds)
  })

  test('click hides when main window visible', () => {
    const tray = new FakeTray()
    const { deps, calls } = makeDeps({ isMainWindowVisible: () => true })
    attachTrayBehavior(tray, deps)
    tray.emit('click', null, { x: 0, y: 0, width: 32, height: 30 })
    expect(calls).toEqual(['hide'])
  })

  test('click shows when main window hidden', () => {
    const tray = new FakeTray()
    const { deps, calls } = makeDeps({ isMainWindowVisible: () => false })
    attachTrayBehavior(tray, deps)
    tray.emit('click', null, { x: 0, y: 0, width: 32, height: 30 })
    expect(calls).toEqual(['show'])
  })
})

describe('attachTrayBehavior — right-click', () => {
  test('pops up the built menu', () => {
    const tray = new FakeTray()
    const { deps, menuToken } = makeDeps()
    attachTrayBehavior(tray, deps)
    tray.emit('right-click')
    expect(tray.popUps).toEqual([menuToken])
  })

  test('buildMenu is called fresh each right-click', () => {
    const tray = new FakeTray()
    let n = 0
    const { deps } = makeDeps({
      buildMenu: () => ({ nth: ++n })
    })
    attachTrayBehavior(tray, deps)
    tray.emit('right-click')
    tray.emit('right-click')
    expect(tray.popUps).toEqual([{ nth: 1 }, { nth: 2 }])
  })
})
