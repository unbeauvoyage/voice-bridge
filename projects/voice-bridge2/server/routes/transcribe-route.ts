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
  loadLastTarget: () => string
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
  const { transcript, explicitTo, getKnownAgents, llmRoute, loadLastTarget, saveLastTarget } = opts

  const words = transcript.trimStart().split(/\s+/)
  // Strip trailing punctuation so "please." and "please," still trigger the please-gate.
  const pleaseIndex = words.slice(0, 7).findIndex((w) => /^please[.,!?;:]*$/i.test(w))
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
      logger.info(
        { component: 'route', word: pleaseIndex + 1, routingPart, messagePart },
        'please_gate'
      )
      const llmResult = await llmRoute(routingPart, await getKnownAgents(), '')
      const fallback = explicitTo || loadLastTarget()
      const to = llmResult.agent || fallback
      const message = messagePart || transcript
      if (llmResult.agentChanged) {
        saveLastTarget(to)
      }
      logger.info(
        { component: 'route', to, agentChanged: llmResult.agentChanged, message },
        'routed_please_gate'
      )
      return { to, message }
    } else {
      // Direct-address patterns ("tell X to Y", "ask X about Y", "message to X: Y").
      // Pass the full transcript to llmRoute — it extracts the agent fragment internally.
      logger.info({ component: 'route', transcript }, 'direct_address_gate')
      const llmResult = await llmRoute(transcript, await getKnownAgents(), '')
      const fallback = explicitTo || loadLastTarget()
      const to = llmResult.agent || fallback
      const message = llmResult.message || transcript
      if (llmResult.agentChanged) {
        saveLastTarget(to)
      }
      logger.info(
        { component: 'route', to, agentChanged: llmResult.agentChanged, message },
        'routed_direct_address'
      )
      return { to, message }
    }
  }

  if (explicitTo) {
    // Case 2: Explicit UI selection, no addressing signal — honour it, full transcript.
    saveLastTarget(explicitTo)
    logger.info({ component: 'route', to: explicitTo, transcript }, 'routed_explicit')
    return { to: explicitTo, message: transcript }
  }

  // Case 3: No addressing signal, no explicit `to` — use the persisted last target.
  // This handles the common case where the UI dropdown hasn't loaded yet (iOS timing)
  // or localStorage was cleared. loadLastTarget() itself falls back to 'command'.
  const lastTarget = loadLastTarget()
  logger.info({ component: 'route', to: lastTarget, transcript }, 'routed_last_target')
  return { to: lastTarget, message: transcript }
}
