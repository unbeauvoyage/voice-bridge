/**
 * LLM-based voice message router using local Ollama (llama3.2).
 * Pre-parses the transcript with regex to extract the addressing fragment,
 * then passes only that fragment to the LLM — avoids hallucination from full transcript.
 * Falls back gracefully if Ollama is offline, slow, or returns bad JSON.
 */

import { OLLAMA_BASE_URL_DEFAULT, OLLAMA_TIMEOUT_MS } from './config.ts'
import { logger } from './logger.ts'

const DEFAULT_OLLAMA_URL = OLLAMA_BASE_URL_DEFAULT
const OLLAMA_MODEL = 'llama3.2:latest'

export interface LlmRouteResult {
  agent: string
  message: string
  agentChanged: boolean // true if agent differs from fallbackAgent
}

const ADDRESSING_PATTERNS = [
  // "to cheff of stoff please, do X" or "to chief of staff please do X"
  /^(?:to\s+)?(.+?)\s+please[,.]?\s+(.+)$/is,
  // "hey chief of staff, do X"
  /^(?:hey\s+)(.+?)[,.]\s+(.+)$/is,
  // "tell X to Y" — e.g. "tell command to check the build"
  /^tell\s+(.+?)\s+to\s+(.+)$/is,
  // "message to X: Y" — e.g. "message to productivitesse: check the build"
  /^message\s+to\s+(.+?):\s*(.+)$/is,
  // "ask X to Y" / "ask X about Y" — natural variants
  /^ask\s+(.+?)\s+(?:to|about)\s+(.+)$/is,
  // "chief of staff, do X" (comma as delimiter)
  /^(.+?)[,]\s+(.+)$/is
]

/**
 * The set of patterns that signal explicit agent addressing in a transcript.
 * These patterns are used by shouldLlmRoute to decide whether to invoke
 * llmRoute for a given transcript — without requiring "please".
 *
 * "please" is handled separately (existing behavior) so this list only covers
 * the new spoken-name addressing patterns.
 */
const DIRECT_ADDRESS_PATTERNS = [
  // "tell X to Y" — "tell command to check the build"
  // Must start with "tell" (anchored to avoid matching mid-sentence uses).
  /^tell\s+\S+.*?\bto\b/i,
  // "message to X: Y" — "message to productivitesse: check the build"
  // Anchored to start so "send a message to the team" does not match.
  /^message\s+to\s+\S+/i,
  // "ask X to/about Y" — "ask jarvis about the weather"
  // Anchored to start to avoid false positives on "I ask you about the weather".
  /^ask\s+\S+.*?\b(?:to|about)\b/i
]

/**
 * Returns true when a transcript should be routed through llmRoute for agent
 * detection. Broadens the original "please-in-first-7-words" gate to also
 * recognise spoken-name addressing patterns such as "tell X to Y" and
 * "ask X about Y", so the CEO can route messages without needing "please".
 *
 * This is intentionally the ONLY gate — the internal "please" guard inside
 * llmRoute itself is a separate concern (it prevents unnecessary Ollama calls
 * for non-addressed messages that happen to contain "please" as an aside).
 */
export function shouldLlmRoute(transcript: string): boolean {
  if (!transcript) return false
  // "please" in any position (existing behavior preserved)
  if (/\bplease\b/i.test(transcript)) return true
  // Direct addressing patterns (new behavior)
  return DIRECT_ADDRESS_PATTERNS.some((p) => p.test(transcript))
}

function preParseTranscript(transcript: string): { fragment: string; message: string } | null {
  for (const pattern of ADDRESSING_PATTERNS) {
    const m = transcript.match(pattern)
    if (m && m[1] && m[2]) {
      const fragment = m[1].trim()
      const message = m[2].trim()
      // Only return if fragment is reasonably short (1-5 words — agent names)
      if (fragment.split(/\s+/).length <= 5) {
        return { fragment, message }
      }
    }
  }
  return null
}

export async function llmRoute(
  transcript: string,
  knownAgents: string[],
  fallbackAgent: string
): Promise<LlmRouteResult> {
  // No explicit addressing signal → send to sticky agent, skip LLM.
  // Checks both "please" (existing behavior) and direct address patterns
  // (tell/ask/message). shouldLlmRoute is the canonical predicate — keeping
  // the same logic here ensures the internal guard stays consistent with the
  // gate in transcribe.ts without creating a dependency on that module.
  if (!shouldLlmRoute(transcript)) {
    return { agent: fallbackAgent, message: transcript, agentChanged: false }
  }

  // Fast path: "to X please" — match agent name directly against known agents.
  // This handles the common case without requiring Ollama to be running.
  const toXMatch = transcript.match(/^(?:to\s+)?(.+?)\s+please\b/is)
  if (toXMatch && toXMatch[1]) {
    const spoken = toXMatch[1].trim().toLowerCase().replace(/\s+/g, '-')
    const match = knownAgents.find((a) => {
      const norm = a.toLowerCase().replace(/\s+/g, '-')
      return norm === spoken || norm.replace(/-/g, ' ') === spoken.replace(/-/g, ' ')
    })
    if (match) {
      logger.info('llmRoute', 'fast_path_match', { spoken, match })
      return { agent: match, message: transcript, agentChanged: match !== fallbackAgent }
    }
  }

  const agentListReadable = knownAgents
    .map((a) => `${a} (spoken: "${a.replace(/-/g, ' ')}")`)
    .join(', ')

  // Step 1: pre-parse addressing fragment
  const parsed = preParseTranscript(transcript)
  const fragmentToMatch = parsed
    ? parsed.fragment
    : transcript.trim().split(/\s+/).slice(0, 4).join(' ')
  const messageBody = parsed ? parsed.message : transcript

  const prompt =
    `Match this spoken text to the closest known agent name.\n` +
    `Known agents: ${agentListReadable || 'command'}\n` +
    `Rules:\n` +
    `- Hyphens and spaces are the same: "chief of staff" = "chief-of-staff"\n` +
    `- Handle spelling/transcription errors: "cheff of stoff" → "chief-of-staff", "productivities" → "productivitesse"\n` +
    `- If no agent matches (or the text is not an agent name at all), return null\n` +
    `- "command" is NOT a default — only return it if the text clearly says "command"\n\n` +
    `Spoken text: "${fragmentToMatch}"\n\n` +
    `Respond with JSON {"agent": string | null}`

  try {
    const ollamaUrl = process.env.OLLAMA_URL ?? DEFAULT_OLLAMA_URL
    const res = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: OLLAMA_MODEL,
        stream: false,
        format: 'json',
        keep_alive: -1,
        prompt
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
    })

    if (!res.ok) {
      logger.warn('llmRoute', 'ollama_non_ok_falling_back', { status: res.status })
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    const rawData: unknown = await res.json()
    if (typeof rawData !== 'object' || rawData === null || !('response' in rawData)) {
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }
    const ollamaObj: Record<string, unknown> = Object.fromEntries(Object.entries(rawData))
    const response = ollamaObj['response']
    if (typeof response !== 'string' || !response) {
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    let llmParsed: { agent?: unknown }
    try {
      llmParsed = JSON.parse(response)
    } catch {
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    if (llmParsed.agent === null || llmParsed.agent === undefined || llmParsed.agent === '') {
      logger.info('llmRoute', 'no_match_keeping_sticky', {
        fragment: fragmentToMatch,
        sticky: fallbackAgent
      })
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    const agentNorm =
      typeof llmParsed.agent === 'string'
        ? llmParsed.agent.trim().toLowerCase().replace(/\s+/g, '-')
        : null

    if (!agentNorm) {
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    // Guard: never switch to "command" unless explicitly said
    if (agentNorm === 'command' && !/\bcommand\b/i.test(transcript)) {
      logger.info('llmRoute', 'command_guard_keeping_sticky', { transcript })
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    const knownNorm = knownAgents.map((a) => a.toLowerCase().replace(/\s+/g, '-'))
    const agent =
      knownNorm.length === 0 || knownNorm.includes(agentNorm) ? agentNorm : fallbackAgent
    const agentChanged = agent !== fallbackAgent

    logger.info('llmRoute', 'agent_resolved', { fragment: fragmentToMatch, agent, agentChanged })
    return { agent, message: messageBody, agentChanged }
  } catch (err) {
    logger.warn('llmRoute', 'llm_error_falling_back', { error: err })
    return { agent: fallbackAgent, message: transcript, agentChanged: false }
  }
}
