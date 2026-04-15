import { describe, test, expect } from 'bun:test'
import { handleAgents, type AgentsContext } from './agents.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

function ctxWith(opts: {
  relayOk?: boolean
  relayThrows?: boolean
  relayJson?: unknown
  workspaces: string[]
}): AgentsContext {
  return {
    relayBaseUrl: 'http://relay.example',
    listWorkspaceNames: () => opts.workspaces,
    fetchFn: async () => {
      if (opts.relayThrows) throw new Error('connection refused')
      return new Response(JSON.stringify(opts.relayJson ?? { agents: ['a', 'b'] }), {
        status: opts.relayOk === false ? 500 : 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

describe('handleAgents', () => {
  test('source=workspaces skips relay and returns cmux workspace list', async () => {
    let fetchCalls = 0
    const ctx: AgentsContext = {
      relayBaseUrl: 'http://relay.example',
      listWorkspaceNames: () => ['alpha', 'beta'],
      fetchFn: async () => {
        fetchCalls += 1
        return new Response('{}')
      }
    }
    const req = new Request('http://localhost/agents?source=workspaces')
    const res = await handleAgents(req, ctx)
    expect(res.status).toBe(200)
    expect(fetchCalls).toBe(0)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['alpha', 'beta'])
  })

  test('source=relay returns relay JSON on success', async () => {
    const ctx = ctxWith({ relayJson: { agents: ['command', 'matrix'] }, workspaces: ['ws1'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['command', 'matrix'])
  })

  test('source=relay returns error body when fetch throws', async () => {
    const ctx = ctxWith({ relayThrows: true, workspaces: ['ws1'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual([])
    expect(body['error']).toBe('Relay unavailable')
  })

  test('source=relay returns error body (not cmux) when relay returns non-ok', async () => {
    const ctx = ctxWith({ relayOk: false, workspaces: ['shouldNotAppear'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual([])
    expect(typeof body['error']).toBe('string')
    expect(String(body['error'])).toContain('500')
  })

  test('source=auto (default) returns relay JSON on success', async () => {
    const ctx = ctxWith({ relayJson: { agents: ['relay1'] }, workspaces: ['wsX'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['relay1'])
  })

  test('source=auto falls back to workspaces when relay throws', async () => {
    const ctx = ctxWith({ relayThrows: true, workspaces: ['wsFallback'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['wsFallback'])
  })

  test('source=auto falls back to workspaces when relay returns non-ok', async () => {
    const ctx = ctxWith({ relayOk: false, workspaces: ['wsFallback2'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['wsFallback2'])
  })

  test('CORS header present on all responses', async () => {
    const ctx = ctxWith({ relayThrows: true, workspaces: [] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})
