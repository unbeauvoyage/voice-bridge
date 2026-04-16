import { describe, test, expect } from 'bun:test'
import { handleAgents, type AgentsContext } from './agents.ts'
import { getKnownAgents } from './agents.ts'

async function readJsonObject(res: Response): Promise<Record<string, unknown>> {
  const raw: unknown = await res.json()
  if (typeof raw !== 'object' || raw === null) throw new Error('non-object body')
  const out: Record<string, unknown> = {}
  for (const [k, v] of Object.entries(raw)) out[k] = v
  return out
}

function makeCtx(overrides: Partial<AgentsContext> & {
  relayOk?: boolean
  relayThrows?: boolean
  relayJson?: unknown
  workspaces?: string[]
} = {}): AgentsContext {
  const { relayOk, relayThrows, relayJson, workspaces, ...ctxOverrides } = overrides
  return {
    relayBaseUrl: 'http://relay.example',
    listWorkspaceNames: () => workspaces ?? ['ws-default'],
    fetchFn: Object.assign(
      async () => {
        if (relayThrows) throw new Error('connection refused')
        return new Response(JSON.stringify(relayJson ?? { agents: ['a', 'b'] }), {
          status: relayOk === false ? 500 : 200,
          headers: { 'Content-Type': 'application/json' }
        })
      },
      { preconnect: () => {} }
    ),
    ...ctxOverrides
  }
}

describe('handleAgents', () => {
  test('source=workspaces skips relay and returns cmux workspace list', async () => {
    let fetchCalls = 0
    const ctx = makeCtx({
      listWorkspaceNames: () => ['alpha', 'beta'],
      fetchFn: Object.assign(
        async () => { fetchCalls += 1; return new Response('{}') },
        { preconnect: () => {} }
      )
    })
    const req = new Request('http://localhost/agents?source=workspaces')
    const res = await handleAgents(req, ctx)
    expect(res.status).toBe(200)
    expect(fetchCalls).toBe(0)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['alpha', 'beta'])
  })

  test('source=relay returns relay JSON on success', async () => {
    const ctx = makeCtx({ relayJson: { agents: ['command', 'matrix'] }, workspaces: ['ws1'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['command', 'matrix'])
  })

  test('source=relay returns error body when fetch throws', async () => {
    const ctx = makeCtx({ relayThrows: true, workspaces: ['ws1'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual([])
    expect(body['error']).toBe('Relay unavailable')
  })

  test('source=relay returns error body (not cmux) when relay returns non-ok', async () => {
    const ctx = makeCtx({ relayOk: false, workspaces: ['shouldNotAppear'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual([])
    expect(typeof body['error']).toBe('string')
    expect(String(body['error'])).toContain('500')
  })

  test('source=auto (default) returns relay JSON on success', async () => {
    const ctx = makeCtx({ relayJson: { agents: ['relay1'] }, workspaces: ['wsX'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['relay1'])
  })

  test('source=auto falls back to workspaces when relay throws', async () => {
    const ctx = makeCtx({ relayThrows: true, workspaces: ['wsFallback'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['wsFallback'])
  })

  test('source=auto falls back to workspaces when relay returns non-ok', async () => {
    const ctx = makeCtx({ relayOk: false, workspaces: ['wsFallback2'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['wsFallback2'])
  })

  test('source=bogus returns 400 (unknown query value rejected at boundary)', async () => {
    const ctx = makeCtx({ workspaces: ['ws1'] })
    const req = new Request('http://localhost/agents?source=bogus')
    const res = await handleAgents(req, ctx)
    expect(res.status).toBe(400)
    const body = await readJsonObject(res)
    expect(body['error']).toBe('validation_failed')
  })

  test('source=relay rejects schema-invalid relay body ({foo:1}) with error', async () => {
    const ctx = makeCtx({ relayJson: { foo: 1 }, workspaces: ['wsShouldNotAppear'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual([])
    expect(typeof body['error']).toBe('string')
  })

  test('source=relay rejects relay body with non-string agents ({agents:[123]})', async () => {
    const ctx = makeCtx({ relayJson: { agents: [123] }, workspaces: ['wsShouldNotAppear'] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual([])
    expect(typeof body['error']).toBe('string')
  })

  test('source=auto falls back to workspaces when relay body fails schema', async () => {
    const ctx = makeCtx({ relayJson: { foo: 1 }, workspaces: ['wsFallback3'] })
    const req = new Request('http://localhost/agents')
    const res = await handleAgents(req, ctx)
    const body = await readJsonObject(res)
    expect(body['agents']).toEqual(['wsFallback3'])
  })

  test('CORS header present on all responses', async () => {
    const ctx = makeCtx({ relayThrows: true, workspaces: [] })
    const req = new Request('http://localhost/agents?source=relay')
    const res = await handleAgents(req, ctx)
    expect(res.headers.get('Access-Control-Allow-Origin')).toBe('*')
  })
})

// Tests for the extracted getKnownAgents function.
// It accepts injectable dependencies to avoid network/cmux calls in tests.
describe('getKnownAgents (extracted from index.ts)', () => {
  test('returns agent names from relay /status when relay is reachable', async () => {
    const ctx = makeCtx({ relayJson: { agents: { command: {}, matrix: {}, atlas: {} } } })
    const result = await getKnownAgents(ctx)
    expect(result).toEqual(expect.arrayContaining(['command', 'matrix', 'atlas']))
  })

  test('falls back to workspace names when relay is down', async () => {
    const ctx = makeCtx({ relayThrows: true, workspaces: ['alpha', 'beta'] })
    const result = await getKnownAgents(ctx)
    expect(result).toEqual(expect.arrayContaining(['alpha', 'beta']))
  })

  test('deduplicates names appearing in both relay and workspaces', async () => {
    const ctx = makeCtx({ relayJson: { agents: { command: {} } }, workspaces: ['command', 'extra'] })
    const result = await getKnownAgents(ctx)
    const commandCount = result.filter((a) => a === 'command').length
    expect(commandCount).toBe(1)
  })

  test('filters out names containing "test" or "probe"', async () => {
    const ctx = makeCtx({ relayJson: { agents: { 'test-agent': {}, 'probe-1': {}, matrix: {} } } })
    const result = await getKnownAgents(ctx)
    expect(result).not.toContain('test-agent')
    expect(result).not.toContain('probe-1')
    expect(result).toContain('matrix')
  })

  test('normalizes names to lowercase', async () => {
    const ctx = makeCtx({ relayJson: { agents: { MATRIX: {}, Command: {} } } })
    const result = await getKnownAgents(ctx)
    expect(result).toContain('matrix')
    expect(result).toContain('command')
    expect(result).not.toContain('MATRIX')
  })
})
