import { describe, test, expect } from 'bun:test'
import { EventEmitter } from 'node:events'
import {
  calculateTrayAnchoredPosition,
  createMainWindowManager,
  type MainWindowLike,
  type MainWindowManagerConfig,
  type Rectangle,
  type WorkArea
} from './mainWindow.ts'

describe('calculateTrayAnchoredPosition', () => {
  const workArea: WorkArea = { x: 0, y: 0, width: 1920, height: 1080 }
  const winBounds = { width: 400, height: 340 }

  test('centers window horizontally on tray center', () => {
    const tray: Rectangle = { x: 1000, y: 0, width: 32, height: 30 }
    const pos = calculateTrayAnchoredPosition(tray, winBounds, workArea)
    expect(pos.x).toBe(Math.round(1000 + 16 - 200))
    expect(pos.y).toBe(workArea.y + 4)
  })

  test('clamps to left edge of workArea', () => {
    const tray: Rectangle = { x: 0, y: 0, width: 32, height: 30 }
    const pos = calculateTrayAnchoredPosition(tray, winBounds, workArea)
    expect(pos.x).toBe(workArea.x)
  })

  test('clamps to right edge of workArea', () => {
    const tray: Rectangle = { x: 1900, y: 0, width: 32, height: 30 }
    const pos = calculateTrayAnchoredPosition(tray, winBounds, workArea)
    expect(pos.x).toBe(workArea.x + workArea.width - winBounds.width)
  })

  test('y is always workArea.y + 4', () => {
    const offsetWorkArea: WorkArea = { x: 100, y: 200, width: 1920, height: 1080 }
    const tray: Rectangle = { x: 1000, y: 0, width: 32, height: 30 }
    const pos = calculateTrayAnchoredPosition(tray, winBounds, offsetWorkArea)
    expect(pos.y).toBe(204)
  })
})

type Call<T> = { name: string; args: T }

class FakeWebContents extends EventEmitter {
  onceEvents: string[] = []
  sends: Array<{ channel: string; args: unknown[] }> = []
  once(event: string, listener: () => void): this {
    this.onceEvents.push(event)
    super.once(event, listener)
    return this
  }
  send(channel: string, ...args: unknown[]): void {
    this.sends.push({ channel, args })
  }
  triggerFinishLoad(): void {
    this.emit('did-finish-load')
  }
}

class FakeMainWindow implements MainWindowLike {
  webContents: FakeWebContents = new FakeWebContents()
  calls: Array<Call<unknown>> = []
  destroyed = false
  visible = false
  bounds: Rectangle = { x: 0, y: 0, width: 400, height: 340 }
  setAlwaysOnTop(on: boolean, level?: 'pop-up-menu', relativeLevel?: number): void {
    this.calls.push({ name: 'setAlwaysOnTop', args: { on, level, relativeLevel } })
  }
  setVisibleOnAllWorkspaces(
    visible: boolean,
    options?: { skipTransformProcessType?: boolean; visibleOnFullScreen?: boolean }
  ): void {
    this.calls.push({ name: 'setVisibleOnAllWorkspaces', args: { visible, options } })
  }
  showInactive(): void {
    this.visible = true
    this.calls.push({ name: 'showInactive', args: null })
  }
  hide(): void {
    this.visible = false
    this.calls.push({ name: 'hide', args: null })
  }
  moveTop(): void {
    this.calls.push({ name: 'moveTop', args: null })
  }
  isVisible(): boolean {
    return this.visible
  }
  isDestroyed(): boolean {
    return this.destroyed
  }
  setPosition(x: number, y: number, animate?: boolean): void {
    this.bounds = { ...this.bounds, x, y }
    this.calls.push({ name: 'setPosition', args: { x, y, animate } })
  }
  getBounds(): Rectangle {
    return this.bounds
  }
}

function makeHarness(): {
  cfg: MainWindowManagerConfig
  windows: FakeMainWindow[]
  lastTray: Rectangle | undefined
  trayFallback: Rectangle
} {
  const windows: FakeMainWindow[] = []
  const trayFallback: Rectangle = { x: 500, y: 0, width: 32, height: 30 }
  let lastTray: Rectangle | undefined
  const cfg: MainWindowManagerConfig = {
    createWindow: () => {
      const w = new FakeMainWindow()
      windows.push(w)
      return w
    },
    getTrayBounds: () => trayFallback,
    getLastTrayBounds: () => lastTray,
    getWorkAreaForPoint: () => ({ x: 0, y: 0, width: 1920, height: 1080 })
  }
  return {
    cfg,
    windows,
    get lastTray() {
      return lastTray
    },
    set lastTray(v) {
      lastTray = v
    },
    trayFallback
  }
}

describe('createMainWindowManager.show', () => {
  test('first show creates window and positions on did-finish-load', () => {
    const h = makeHarness()
    const mgr = createMainWindowManager(h.cfg)
    mgr.show()
    expect(h.windows).toHaveLength(1)
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    expect(w.calls.some((c) => c.name === 'setPosition')).toBe(false)
    w.webContents.triggerFinishLoad()
    expect(w.calls.some((c) => c.name === 'setPosition')).toBe(true)
    expect(w.calls.some((c) => c.name === 'showInactive')).toBe(true)
    expect(w.calls.some((c) => c.name === 'moveTop')).toBe(true)
    expect(w.visible).toBe(true)
  })

  test('second show reuses existing window without recreate', () => {
    const h = makeHarness()
    const mgr = createMainWindowManager(h.cfg)
    mgr.show()
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    w.calls.length = 0

    mgr.show()
    expect(h.windows).toHaveLength(1)
    expect(w.calls.some((c) => c.name === 'setPosition')).toBe(true)
    expect(w.calls.some((c) => c.name === 'showInactive')).toBe(true)
  })

  test('show after destroy creates fresh window', () => {
    const h = makeHarness()
    const mgr = createMainWindowManager(h.cfg)
    mgr.show()
    const first = h.windows[0]
    if (!first) throw new Error('no window')
    first.webContents.triggerFinishLoad()
    first.destroyed = true

    mgr.show()
    expect(h.windows).toHaveLength(2)
  })

  test('uses lastTrayBounds when provided, falls back to getTrayBounds otherwise', () => {
    const h = makeHarness()
    h.lastTray = { x: 1700, y: 0, width: 32, height: 30 }
    const mgr = createMainWindowManager(h.cfg)
    mgr.show()
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    const pos = w.calls.find((c) => c.name === 'setPosition')
    function hasX(v: unknown): v is { x: number; y: number } {
      return typeof v === 'object' && v !== null && 'x' in v && 'y' in v
    }
    if (!pos || !hasX(pos.args)) throw new Error('expected setPosition with x,y args')
    expect(pos.args.x).toBeGreaterThan(1500)
  })

  test('zero-width lastTrayBounds falls through to getTrayBounds', () => {
    const h = makeHarness()
    h.lastTray = { x: 0, y: 0, width: 0, height: 0 }
    const mgr = createMainWindowManager(h.cfg)
    mgr.show()
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    expect(w.calls.some((c) => c.name === 'setPosition')).toBe(true)
  })
})

describe('createMainWindowManager.hide / getWindow / isVisible', () => {
  test('hide() calls hide on existing window', () => {
    const h = makeHarness()
    const mgr = createMainWindowManager(h.cfg)
    mgr.show()
    const w = h.windows[0]
    if (!w) throw new Error('no window')
    w.webContents.triggerFinishLoad()
    mgr.hide()
    expect(w.calls.some((c) => c.name === 'hide')).toBe(true)
  })

  test('hide() when no window is a no-op', () => {
    const h = makeHarness()
    const mgr = createMainWindowManager(h.cfg)
    expect(() => mgr.hide()).not.toThrow()
  })

  test('getWindow() returns current window or null', () => {
    const h = makeHarness()
    const mgr = createMainWindowManager(h.cfg)
    expect(mgr.getWindow()).toBeNull()
    mgr.show()
    expect(mgr.getWindow()).not.toBeNull()
  })
})
