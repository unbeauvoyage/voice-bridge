/**
 * Routing concern for POST /transcribe.
 *
 * Extracted from transcribe.ts — resolves the destination agent and message body
 * from a transcript, using one of three cases (in priority order):
 *
 *   1. "please" in first 7 words → llmRoute OVERRIDES any explicit `to`.
 *      routingPart (up to and including "please") → agent detection.
 *      messagePart (after "please") → the message body.
 *   2. Explicit `to` set, no "please" → use it, full transcript as message.
 *   3. No "please", no explicit `to` → deliver to "command", full transcript.
 *
 * No I/O beyond calling the injected llmRoute + getKnownAgents functions.
 */

import type { LlmRouteResult } from '../llmRouter.ts'

export interface RouteTranscriptOptions {
  transcript: string
  explicitTo: string
  getKnownAgents: () => Promise<string[]>
  llmRoute: (transcript: string, knownAgents: string[], fallbackAgent: string) => Promise<LlmRouteResult>
  saveLastTarget: (target: string) => void
}

export interface RouteTranscriptResult {
  to: string
  message: string
}

/**
 * Resolve the destination agent and message body for a transcript.
 *
 * Mutates: calls saveLastTarget() when routing changes the sticky target.
 */
export async function routeTranscript(opts: RouteTranscriptOptions): Promise<RouteTranscriptResult> {
  const { transcript, explicitTo, getKnownAgents, llmRoute, saveLastTarget } = opts

  const words = transcript.trimStart().split(/\s+/)
  const pleaseIndex = words.slice(0, 7).findIndex((w) => /^please$/i.test(w))
  const pleaseInFirst7 = pleaseIndex !== -1

  if (pleaseInFirst7) {
    // Case 1: "please" in first 7 words — llmRoute OVERRIDES explicit `to`.
    const routingPart = words.slice(0, pleaseIndex + 1).join(' ')
    const messagePart = words.slice(pleaseIndex + 1).join(' ').trim()
    console.log(
      `[route] please-gate (word ${pleaseIndex + 1}): routingPart="${routingPart}", messagePart="${messagePart}"`
    )
    const llmResult = await llmRoute(routingPart, await getKnownAgents(), '')
    const fallback = explicitTo || 'command'
    const to = llmResult.agent || fallback
    const message = messagePart || transcript
    if (llmResult.agentChanged) {
      saveLastTarget(to)
    }
    console.log(`[route] → ${to} (please-gate, changed=${llmResult.agentChanged}): "${message}"`)
    return { to, message }
  }

  if (explicitTo) {
    // Case 2: Explicit UI selection, no "please" — honour it, full transcript.
    saveLastTarget(explicitTo)
    console.log(`[route] → ${explicitTo} (explicit, sticky updated): "${transcript}"`)
    return { to: explicitTo, message: transcript }
  }

  // Case 3: No "please", no explicit `to` — deliver to "command".
  console.log(`[route] → command (no-please, direct): "${transcript}"`)
  return { to: 'command', message: transcript }
}
