/**
 * Routing concern for POST /transcribe.
 *
 * Extracted from transcribe.ts — resolves the destination agent and message body
 * from a transcript, using one of three cases (in priority order):
 *
 *   1. Addressing signal present (shouldLlmRoute=true) → llmRoute OVERRIDES explicit `to`.
 *      "please"-gated: routingPart (up to and including "please") → agent detection,
 *        messagePart (after "please") → the message body.
 *      Direct-address patterns ("tell X to Y", "ask X about Y", "message to X: Y"):
 *        full transcript passed to llmRoute; llmRoute returns extracted message.
 *   2. Explicit `to` set, no addressing signal → use it, full transcript as message.
 *   3. No addressing signal, no explicit `to` → deliver to "command", full transcript.
 *
 * No I/O beyond calling the injected llmRoute + getKnownAgents functions.
 */

import type { LlmRouteResult } from '../llmRouter.ts'
import { shouldLlmRoute } from '../llmRouter.ts'
import { logger } from '../logger.ts'

export interface RouteTranscriptOptions {
  transcript: string
  explicitTo: string
  getKnownAgents: () => Promise<string[]>
  llmRoute: (
    transcript: string,
    knownAgents: string[],
    fallbackAgent: string
  ) => Promise<LlmRouteResult>
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
export async function routeTranscript(
  opts: RouteTranscriptOptions
): Promise<RouteTranscriptResult> {
  const { transcript, explicitTo, getKnownAgents, llmRoute, saveLastTarget } = opts

  const words = transcript.trimStart().split(/\s+/)
  const pleaseIndex = words.slice(0, 7).findIndex((w) => /^please$/i.test(w))
  const pleaseInFirst7 = pleaseIndex !== -1

  // shouldLlmRoute is the authoritative gate — covers both "please" (any position)
  // and direct-address patterns ("tell X to Y", "ask X about Y", "message to X: Y").
  const needsLlmRoute = shouldLlmRoute(transcript)

  if (needsLlmRoute) {
    // Case 1: addressing signal — llmRoute OVERRIDES explicit `to`.
    if (pleaseInFirst7) {
      // "please"-gated: split routing fragment from message body at "please".
      const routingPart = words.slice(0, pleaseIndex + 1).join(' ')
      const messagePart = words
        .slice(pleaseIndex + 1)
        .join(' ')
        .trim()
      logger.info('route', 'please_gate', { word: pleaseIndex + 1, routingPart, messagePart })
      const llmResult = await llmRoute(routingPart, await getKnownAgents(), '')
      const fallback = explicitTo || 'command'
      const to = llmResult.agent || fallback
      const message = messagePart || transcript
      if (llmResult.agentChanged) {
        saveLastTarget(to)
      }
      logger.info('route', 'routed_please_gate', {
        to,
        agentChanged: llmResult.agentChanged,
        message
      })
      return { to, message }
    } else {
      // Direct-address patterns ("tell X to Y", "ask X about Y", "message to X: Y").
      // Pass the full transcript to llmRoute — it extracts the agent fragment internally.
      logger.info('route', 'direct_address_gate', { transcript })
      const llmResult = await llmRoute(transcript, await getKnownAgents(), '')
      const fallback = explicitTo || 'command'
      const to = llmResult.agent || fallback
      const message = llmResult.message || transcript
      if (llmResult.agentChanged) {
        saveLastTarget(to)
      }
      logger.info('route', 'routed_direct_address', {
        to,
        agentChanged: llmResult.agentChanged,
        message
      })
      return { to, message }
    }
  }

  if (explicitTo) {
    // Case 2: Explicit UI selection, no addressing signal — honour it, full transcript.
    saveLastTarget(explicitTo)
    logger.info('route', 'routed_explicit', { to: explicitTo, transcript })
    return { to: explicitTo, message: transcript }
  }

  // Case 3: No addressing signal, no explicit `to` — deliver to "command".
  logger.info('route', 'routed_command_direct', { transcript })
  return { to: 'command', message: transcript }
}
