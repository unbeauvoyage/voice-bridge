/**
 * LLM-based voice message router using local Ollama (llama3.2).
 * Pre-parses the transcript with regex to extract the addressing fragment,
 * then passes only that fragment to the LLM — avoids hallucination from full transcript.
 * Falls back gracefully if Ollama is offline, slow, or returns bad JSON.
 */

import { OLLAMA_BASE_URL_DEFAULT, OLLAMA_TIMEOUT_MS } from './config.ts'

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
  // "chief of staff, do X" (comma as delimiter)
  /^(.+?)[,]\s+(.+)$/is
]

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
  // No "please" → no explicit agent addressing → send to sticky agent, skip LLM
  if (!/\bplease\b/i.test(transcript)) {
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
      console.log(`[llmRoute] fast-path: "${spoken}" → "${match}"`)
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
      console.warn(`[llmRoute] Ollama returned ${res.status} — falling back`)
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
      console.log(`[llmRoute] no match for "${fragmentToMatch}" → sticky "${fallbackAgent}"`)
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
      console.log(`[llmRoute] LLM returned "command" but transcript lacks it — keeping sticky`)
      return { agent: fallbackAgent, message: transcript, agentChanged: false }
    }

    const knownNorm = knownAgents.map((a) => a.toLowerCase().replace(/\s+/g, '-'))
    const agent =
      knownNorm.length === 0 || knownNorm.includes(agentNorm) ? agentNorm : fallbackAgent
    const agentChanged = agent !== fallbackAgent

    console.log(
      `[llmRoute] fragment="${fragmentToMatch}" → agent="${agent}" (changed=${agentChanged})`
    )
    return { agent, message: messageBody, agentChanged }
  } catch (err) {
    console.warn('[llmRoute] error:', String(err))
    return { agent: fallbackAgent, message: transcript, agentChanged: false }
  }
}
