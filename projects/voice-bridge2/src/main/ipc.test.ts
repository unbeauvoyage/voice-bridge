import { describe, test, expect } from 'bun:test'
import { registerIpcHandlers, type IpcMainLike, type IpcDeps } from './ipc.ts'
import type { OverlayPayload } from './typeGuards.ts'

type HandleCall = {
  channel: string
  handler: (event: unknown, ...args: unknown[]) => unknown
}
type OnCall = { channel: string; listener: (event: unknown, ...args: unknown[]) => void }

function fakeIpc(): { ipc: IpcMainLike; handles: HandleCall[]; ons: OnCall[] } {
  const handles: HandleCall[] = []
  const ons: OnCall[] = []
  const ipc: IpcMainLike = {
    handle: (channel, handler) => {
      handles.push({ channel, handler })
    },
    on: (channel, listener) => {
      ons.push({ channel, listener })
    }
  }
  return { ipc, handles, ons }
}

function makeDeps(overrides: Partial<IpcDeps> = {}): {
  deps: IpcDeps
  fetchCalls: Array<{ url: string; init?: RequestInit }>
  overlayCalls: OverlayPayload[]
  targetSaves: string[]
  hideCalls: number
} {
  const fetchCalls: Array<{ url: string; init?: RequestInit }> = []
  const overlayCalls: OverlayPayload[] = []
  const targetSaves: string[] = []
  let hideCalls = 0
  const deps: IpcDeps = {
    fetchFn: async (url, init) => {
      fetchCalls.push({ url, ...(init ? { init } : {}) })
      return new Response(null, { status: 500 })
    },
    targetStore: {
      read: () => 'command',
      save: (t) => {
        targetSaves.push(t)
      }
    },
    hideMainWindow: () => {
      hideCalls += 1
    },
    showOverlay: (p) => overlayCalls.push(p),
    ...overrides
  }
  return {
    deps,
    fetchCalls,
    overlayCalls,
    targetSaves,
    get hideCalls() {
      return hideCalls
    }
  }
}

describe('registerIpcHandlers — registrations', () => {
  test('registers handle for get-status, set-target, show-overlay, get-agents', () => {
    const f = fakeIpc()
    const d = makeDeps()
    registerIpcHandlers(f.ipc, d.deps)
    const channels = f.handles.map((h) => h.channel).sort()
    expect(channels).toEqual(['get-agents', 'get-status', 'set-target', 'show-overlay'])
  })

  test('registers on for hide-window', () => {
    const f = fakeIpc()
    const d = makeDeps()
    registerIpcHandlers(f.ipc, d.deps)
    expect(f.ons.map((o) => o.channel)).toEqual(['hide-window'])
  })
})

describe('registerIpcHandlers — get-status', () => {
  test('returns target + micState from /mic when ok', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      targetStore: { read: () => 'matrix', save: () => {} },
      fetchFn: async () => new Response(JSON.stringify({ state: 'off' }), { status: 200 })
    })
    registerIpcHandlers(f.ipc, d.deps)
    const getStatus = f.handles.find((h) => h.channel === 'get-status')
    if (!getStatus) throw new Error('no handler')
    const result = await getStatus.handler({})
    expect(result).toEqual({ target: 'matrix', micState: 'off' })
  })

  test('falls back to micState:on when fetch throws', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => {
        throw new Error('network')
      }
    })
    registerIpcHandlers(f.ipc, d.deps)
    const getStatus = f.handles.find((h) => h.channel === 'get-status')
    if (!getStatus) throw new Error('no handler')
    const result = await getStatus.handler({})
    expect(result).toEqual({ target: 'command', micState: 'on' })
  })

  test('falls back to micState:on when /mic returns non-ok', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => new Response(null, { status: 500 })
    })
    registerIpcHandlers(f.ipc, d.deps)
    const getStatus = f.handles.find((h) => h.channel === 'get-status')
    if (!getStatus) throw new Error('no handler')
    const result = await getStatus.handler({})
    expect(result).toEqual({ target: 'command', micState: 'on' })
  })

  test('falls back to micState:on when /mic returns malformed body', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => new Response('"not-object"', { status: 200 })
    })
    registerIpcHandlers(f.ipc, d.deps)
    const getStatus = f.handles.find((h) => h.channel === 'get-status')
    if (!getStatus) throw new Error('no handler')
    const result = await getStatus.handler({})
    expect(result).toEqual({ target: 'command', micState: 'on' })
  })
})

describe('registerIpcHandlers — set-target', () => {
  test('saves target and POSTs to /target', () => {
    const f = fakeIpc()
    const calls: Array<{ url: string; init?: RequestInit }> = []
    const saves: string[] = []
    const deps: IpcDeps = {
      fetchFn: async (url, init) => {
        calls.push({ url: String(url), ...(init ? { init } : {}) })
        return new Response(null, { status: 200 })
      },
      targetStore: {
        read: () => 'command',
        save: (t) => {
          saves.push(t)
        }
      },
      hideMainWindow: () => {},
      showOverlay: () => {}
    }
    registerIpcHandlers(f.ipc, deps)
    const setTarget = f.handles.find((h) => h.channel === 'set-target')
    if (!setTarget) throw new Error('no handler')
    setTarget.handler({}, { target: 'matrix' })
    expect(saves).toEqual(['matrix'])
    expect(calls).toHaveLength(1)
    expect(calls[0]?.url).toBe('http://127.0.0.1:3030/target')
    expect(calls[0]?.init?.method).toBe('POST')
    expect(calls[0]?.init?.body).toBe(JSON.stringify({ target: 'matrix' }))
  })

  test('swallows fetch failure', () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => {
        throw new Error('boom')
      }
    })
    registerIpcHandlers(f.ipc, d.deps)
    const setTarget = f.handles.find((h) => h.channel === 'set-target')
    if (!setTarget) throw new Error('no handler')
    expect(() => setTarget.handler({}, { target: 'matrix' })).not.toThrow()
    expect(d.targetSaves).toEqual(['matrix'])
  })
})

describe('registerIpcHandlers — hide-window', () => {
  test('invokes hideMainWindow', () => {
    const f = fakeIpc()
    const d = makeDeps()
    registerIpcHandlers(f.ipc, d.deps)
    const hide = f.ons.find((o) => o.channel === 'hide-window')
    if (!hide) throw new Error('no listener')
    hide.listener({})
    expect(d.hideCalls).toBe(1)
  })
})

describe('registerIpcHandlers — show-overlay', () => {
  test('forwards payload to showOverlay', () => {
    const f = fakeIpc()
    const d = makeDeps()
    registerIpcHandlers(f.ipc, d.deps)
    const so = f.handles.find((h) => h.channel === 'show-overlay')
    if (!so) throw new Error('no handler')
    const payload: OverlayPayload = { mode: 'recording', text: 'hi' }
    so.handler({}, payload)
    expect(d.overlayCalls).toEqual([payload])
  })
})

describe('registerIpcHandlers — get-agents', () => {
  test('returns agent names on ok response', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () =>
        new Response(JSON.stringify({ agents: [{ name: 'alpha' }, 'beta'] }), { status: 200 })
    })
    registerIpcHandlers(f.ipc, d.deps)
    const get = f.handles.find((h) => h.channel === 'get-agents')
    if (!get) throw new Error('no handler')
    const result = await get.handler({})
    expect(result).toEqual(['alpha', 'beta'])
  })

  test('returns empty list on fetch error (no silent hardcoded substitution)', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => {
        throw new Error('network')
      }
    })
    registerIpcHandlers(f.ipc, d.deps)
    const get = f.handles.find((h) => h.channel === 'get-agents')
    if (!get) throw new Error('no handler')
    const result = await get.handler({})
    expect(result).toEqual([])
  })

  test('returns empty list on non-ok response', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => new Response(null, { status: 500 })
    })
    registerIpcHandlers(f.ipc, d.deps)
    const get = f.handles.find((h) => h.channel === 'get-agents')
    if (!get) throw new Error('no handler')
    const result = await get.handler({})
    expect(result).toEqual([])
  })

  test('returns empty list on malformed response body', async () => {
    const f = fakeIpc()
    const d = makeDeps({
      fetchFn: async () => new Response('"not-an-object"', { status: 200 })
    })
    registerIpcHandlers(f.ipc, d.deps)
    const get = f.handles.find((h) => h.channel === 'get-agents')
    if (!get) throw new Error('no handler')
    const result = await get.handler({})
    expect(result).toEqual([])
  })
})
