import { describe, test, expect } from 'bun:test'
import { handleMessages, type MessagesContext } from './messages.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

describe('handleMessages', () => {
  // Guaranteed-closed loopback port — any fetch to it triggers ConnectionRefused.
  const DEAD_RELAY = 'http://127.0.0.1:1'

  test('module exports handleMessages as a function', () => {
    expect(typeof handleMessages).toBe('function')
  })

  test('returns 502 JSON with CORS header when relay is unreachable', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const req = new Request('http://localhost/messages?agent=command')
    const res = await handleMessages(req, ctx)
    expect(res.status).toBe(502)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
    const body = await readJsonObject(res)
    expect(body.error).toBe('Relay unavailable')
    expect(body.agent).toBe('command')
  })

  test('defaults agent to "command" when no agent query param', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const req = new Request('http://localhost/messages')
    const res = await handleMessages(req, ctx)
    const body = await readJsonObject(res)
    expect(body.agent).toBe('command')
  })

  test('propagates explicit agent query param', async () => {
    const ctx: MessagesContext = { relayBaseUrl: DEAD_RELAY }
    const req = new Request('http://localhost/messages?agent=matrix')
    const res = await handleMessages(req, ctx)
    const body = await readJsonObject(res)
    expect(body.agent).toBe('matrix')
  })
})
