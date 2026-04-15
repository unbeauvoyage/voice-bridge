import { describe, test, expect } from 'bun:test'
import { EventEmitter } from 'node:events'
import {
  handleOverlayRequest,
  createOverlayServerController,
  type MinReq,
  type MinRes
} from './overlayServer.ts'
import type { OverlayPayload } from '../typeGuards.ts'

class FakeReq extends EventEmitter implements MinReq {
  method?: string | undefined
  url?: string | undefined
  constructor(method: string, url: string) {
    super()
    this.method = method
    this.url = url
  }
  send(body: string): void {
    this.emit('data', Buffer.from(body))
    this.emit('end')
  }
}

class FakeRes implements MinRes {
  heads: Array<{ status: number; headers?: Record<string, string> }> = []
  body = ''
  ended = false
  writeHead(status: number, headers?: Record<string, string>): void {
    this.heads.push(headers ? { status, headers } : { status })
  }
  end(chunk?: string): void {
    if (chunk !== undefined) this.body += chunk
    this.ended = true
  }
}

describe('handleOverlayRequest', () => {
  test('404 on non-POST', () => {
    const calls: OverlayPayload[] = []
    const req = new FakeReq('GET', '/overlay')
    const res = new FakeRes()
    handleOverlayRequest((p) => calls.push(p), req, res)
    expect(res.heads[0]?.status).toBe(404)
    expect(res.ended).toBe(true)
    expect(calls).toHaveLength(0)
  })

  test('404 on wrong path', () => {
    const calls: OverlayPayload[] = []
    const req = new FakeReq('POST', '/other')
    const res = new FakeRes()
    handleOverlayRequest((p) => calls.push(p), req, res)
    expect(res.heads[0]?.status).toBe(404)
  })

  test('200 on valid payload and invokes showOverlay', (done) => {
    const calls: OverlayPayload[] = []
    const req = new FakeReq('POST', '/overlay')
    const res = new FakeRes()
    handleOverlayRequest((p) => calls.push(p), req, res)
    req.send(JSON.stringify({ mode: 'recording', text: 'hi' }))
    queueMicrotask(() => {
      expect(res.heads[0]?.status).toBe(200)
      expect(res.body).toBe('{"ok":true}')
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual({ mode: 'recording', text: 'hi' })
      done()
    })
  })

  test('400 on invalid payload shape', (done) => {
    const calls: OverlayPayload[] = []
    const req = new FakeReq('POST', '/overlay')
    const res = new FakeRes()
    handleOverlayRequest((p) => calls.push(p), req, res)
    req.send(JSON.stringify({ bogus: true }))
    queueMicrotask(() => {
      expect(res.heads[0]?.status).toBe(400)
      expect(calls).toHaveLength(0)
      done()
    })
  })

  test('400 on invalid JSON', (done) => {
    const calls: OverlayPayload[] = []
    const req = new FakeReq('POST', '/overlay')
    const res = new FakeRes()
    handleOverlayRequest((p) => calls.push(p), req, res)
    req.send('{not valid')
    queueMicrotask(() => {
      expect(res.heads[0]?.status).toBe(400)
      expect(calls).toHaveLength(0)
      done()
    })
  })

  test('reassembles body across data chunks', (done) => {
    const calls: OverlayPayload[] = []
    const req = new FakeReq('POST', '/overlay')
    const res = new FakeRes()
    handleOverlayRequest((p) => calls.push(p), req, res)
    const full = JSON.stringify({ mode: 'message', text: 'split' })
    const mid = Math.floor(full.length / 2)
    req.emit('data', Buffer.from(full.slice(0, mid)))
    req.emit('data', Buffer.from(full.slice(mid)))
    req.emit('end')
    queueMicrotask(() => {
      expect(res.heads[0]?.status).toBe(200)
      expect(calls).toHaveLength(1)
      expect(calls[0]).toEqual({ mode: 'message', text: 'split' })
      done()
    })
  })
})

describe('createOverlayServerController', () => {
  test('start/stop lifecycle on ephemeral port', () => {
    const ctrl = createOverlayServerController({
      port: 0,
      showOverlay: () => {}
    })
    expect(ctrl.isRunning()).toBe(false)
    ctrl.start()
    expect(ctrl.isRunning()).toBe(true)
    ctrl.stop()
    expect(ctrl.isRunning()).toBe(false)
  })

  test('start() is idempotent while listening', () => {
    const ctrl = createOverlayServerController({
      port: 0,
      showOverlay: () => {}
    })
    ctrl.start()
    ctrl.start()
    expect(ctrl.isRunning()).toBe(true)
    ctrl.stop()
  })

  test('stop() when not running is a no-op', () => {
    const ctrl = createOverlayServerController({
      port: 0,
      showOverlay: () => {}
    })
    expect(() => ctrl.stop()).not.toThrow()
  })
})
