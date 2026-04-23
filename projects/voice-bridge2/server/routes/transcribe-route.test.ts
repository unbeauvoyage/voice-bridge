/**
 * Tests for routeTranscript — sticky-target agentChanged logic.
 *
 * Critical behavior: agentChanged must be computed against the ACTUAL previous
 * sticky target (from loadLastTarget), NOT against the '' fallbackAgent that
 * routeTranscript passes to llmRoute. Passing '' meant any non-empty agent
 * always triggered agentChanged=true — a fragile coincidence, not correct logic.
 *
 * Rule: agentChanged = previousSticky !== '' && newAgent !== previousSticky
 *   - First routing (no sticky set) → agentChanged=false (not a "change" when nothing was set)
 *   - Same agent as sticky → agentChanged=false
 *   - Different agent from sticky → agentChanged=true
 */

import { describe, test, expect } from 'bun:test'
import { routeTranscript, type RouteTranscriptOptions } from './transcribe-route.ts'
import type { LlmRouteResult } from '../llmRouter.ts'

function makeOpts(overrides: Partial<RouteTranscriptOptions> = {}): RouteTranscriptOptions {
  return {
    transcript: 'please route this',
    explicitTo: '',
    getKnownAgents: async () => ['command', 'atlas', 'matrix'],
    llmRoute: async (_t, _agents, fallback): Promise<LlmRouteResult> => ({
      agent: fallback || 'command',
      message: _t,
      agentChanged: fallback !== 'atlas' // simulates llmRoute's own '' comparison — should be ignored
    }),
    loadLastTarget: () => '',
    saveLastTarget: () => {},
    ...overrides
  }
}

describe('routeTranscript — sticky-target agentChanged', () => {
  // First routing: no previous sticky (loadLastTarget returns '').
  // Even if llmRoute returns agentChanged=true (because it compares against '' fallback),
  // routeTranscript must NOT call saveLastTarget — this is not a "change" from a known state.
  test('first routing (no previous sticky) → agentChanged=false, saveLastTarget not called', async () => {
    const savedTargets: string[] = []
    const opts = makeOpts({
      transcript: 'to atlas please do something',
      loadLastTarget: () => '', // no sticky set yet
      saveLastTarget: (t) => savedTargets.push(t),
      llmRoute: async (): Promise<LlmRouteResult> => ({
        agent: 'atlas',
        message: 'do something',
        agentChanged: true // llmRoute compares against '' — would be true for any agent
      })
    })

    await routeTranscript(opts)

    // When previousSticky is '', agentChanged must be false → saveLastTarget not called
    expect(savedTargets).toHaveLength(0)
  })

  // Same agent as sticky: user is speaking to the same agent as last time.
  // saveLastTarget must not be called (no change).
  test('same agent as sticky → agentChanged=false, saveLastTarget not called', async () => {
    const savedTargets: string[] = []
    const opts = makeOpts({
      transcript: 'to atlas please check the logs',
      loadLastTarget: () => 'atlas', // already routing to atlas
      saveLastTarget: (t) => savedTargets.push(t),
      llmRoute: async (): Promise<LlmRouteResult> => ({
        agent: 'atlas',
        message: 'check the logs',
        agentChanged: false
      })
    })

    await routeTranscript(opts)

    expect(savedTargets).toHaveLength(0)
  })

  // Different agent: user explicitly switches to a new agent.
  // saveLastTarget MUST be called with the new agent.
  test('different agent from sticky → agentChanged=true, saveLastTarget called with new agent', async () => {
    const savedTargets: string[] = []
    const opts = makeOpts({
      transcript: 'to matrix please run tests',
      loadLastTarget: () => 'atlas', // was routing to atlas
      saveLastTarget: (t) => savedTargets.push(t),
      llmRoute: async (): Promise<LlmRouteResult> => ({
        agent: 'matrix',
        message: 'run tests',
        agentChanged: true
      })
    })

    const result = await routeTranscript(opts)

    expect(result.to).toBe('matrix')
    expect(savedTargets).toContain('matrix')
  })

  // Direct-address path (no "please" in first 7 words): same three cases apply.
  // This exercises the second branch of the needsLlmRoute block.
  test('direct-address: first routing → saveLastTarget not called', async () => {
    const savedTargets: string[] = []
    const opts = makeOpts({
      transcript: 'tell atlas to run the build',
      loadLastTarget: () => '', // no sticky
      saveLastTarget: (t) => savedTargets.push(t),
      llmRoute: async (): Promise<LlmRouteResult> => ({
        agent: 'atlas',
        message: 'run the build',
        agentChanged: true // llmRoute's own '' comparison says true
      })
    })

    await routeTranscript(opts)

    expect(savedTargets).toHaveLength(0)
  })

  test('direct-address: same agent as sticky → saveLastTarget not called', async () => {
    const savedTargets: string[] = []
    const opts = makeOpts({
      transcript: 'tell atlas to run the build',
      loadLastTarget: () => 'atlas',
      saveLastTarget: (t) => savedTargets.push(t),
      llmRoute: async (): Promise<LlmRouteResult> => ({
        agent: 'atlas',
        message: 'run the build',
        agentChanged: false
      })
    })

    await routeTranscript(opts)

    expect(savedTargets).toHaveLength(0)
  })

  test('direct-address: different agent from sticky → saveLastTarget called', async () => {
    const savedTargets: string[] = []
    const opts = makeOpts({
      transcript: 'tell matrix to run the build',
      loadLastTarget: () => 'atlas',
      saveLastTarget: (t) => savedTargets.push(t),
      llmRoute: async (): Promise<LlmRouteResult> => ({
        agent: 'matrix',
        message: 'run the build',
        agentChanged: true
      })
    })

    const result = await routeTranscript(opts)

    expect(result.to).toBe('matrix')
    expect(savedTargets).toContain('matrix')
  })
})
