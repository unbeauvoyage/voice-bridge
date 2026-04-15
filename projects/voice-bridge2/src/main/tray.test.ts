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
