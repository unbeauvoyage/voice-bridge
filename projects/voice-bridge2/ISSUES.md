---
name: voice-bridge2 known issues
description: Latent bugs and contract violations flagged during development. Each entry is rescue-able — it describes the current behavior, the contract it violates, a proposed fix, and a regression test.
---

# voice-bridge2 Known Issues

## GET /agents — source=relay silently falls through to cmux on non-ok response

**Discovered:** 2026-04-16, during route extraction of /agents into `server/routes/agents.ts` (commit cb76bbd).

**Current behavior:** when a client calls `GET /agents?source=relay` and the relay returns a non-2xx response (e.g., 500), the handler skips the relay-error branch (which is inside a `catch` block guarding `fetch` throws only) and falls through to `listWorkspaceNames()`, returning cmux workspace data as if the call had succeeded.

**Contract violation:** a consumer that explicitly sets `source=relay` has a legitimate expectation of "relay data or an explicit error from relay". Silent substitution with cmux data means the caller cannot distinguish (a) "relay is healthy, data is wrong" from (b) "relay is broken, this is fallback data". This is observability poison — same family as message-relay structural bugs.

**Proposed fix:** split the two failure cases explicitly.
- `source=relay` AND relay throws → return `{ agents: [], error: 'Relay unavailable' }` (current behavior)
- `source=relay` AND relay returns non-ok → return `{ agents: [], error: 'Relay returned <status>' }` (NEW — no silent fallback)
- `source=auto` AND relay throws → fall through to cmux (current behavior)
- `source=auto` AND relay returns non-ok → fall through to cmux (current behavior)

Sketch:
```ts
if (source !== 'workspaces') {
  try {
    const relayRes = await ctx.fetchFn(...)
    if (relayRes.ok) return Response.json(await relayRes.json(), { headers: CORS_HEADERS })
    if (source === 'relay') {
      return Response.json(
        { agents: [], error: `Relay returned ${relayRes.status}` },
        { headers: CORS_HEADERS }
      )
    }
    // source=auto: fall through
  } catch {
    if (source === 'relay') {
      return Response.json({ agents: [], error: 'Relay unavailable' }, { headers: CORS_HEADERS })
    }
    // source=auto: fall through
  }
}
```

**Regression test:** add to `server/routes/agents.test.ts`:
```ts
test('source=relay returns error body when relay returns non-ok', async () => {
  const ctx = ctxWith({ relayOk: false, workspaces: ['shouldNotAppear'] })
  const req = new Request('http://localhost/agents?source=relay')
  const res = await handleAgents(req, ctx)
  const body = await readJsonObject(res)
  expect(body['agents']).toEqual([])
  expect(typeof body['error']).toBe('string')
})
```
Current test suite has a test that ASSERTS the buggy behavior for `source=auto` (cmux fallback on non-ok), which must remain green. The NEW test above is the one that will fail against the current code and pass against the fix.

**Severity:** latent, low observed impact (no known caller explicitly uses `source=relay`), but a real contract violation. Fix is ~10 lines + 1 test. Pure-refactor chunk must not touch this; flag for a separate follow-up commit after route extraction is complete.
