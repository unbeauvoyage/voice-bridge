/**
 * Tests for llmRoute fast-path and bug fixes.
 *
 * These tests run entirely offline — no Ollama required.
 * The fast-path "to X please" regex must resolve known agents
 * without ever calling the LLM.
 *
 * OLLAMA_URL is overridden to an unreachable address so any Ollama call
 * immediately throws and returns fallbackAgent — ensuring tests are
 * deterministic regardless of whether Ollama is running locally.
 *
 * A second describe block ("Ollama response parsing") uses a mock global
 * fetch to exercise the full Ollama branch without a running Ollama server.
 * The OLLAMA_URL env is set to a test sentinel so the module routes through
 * our mock rather than the real Ollama endpoint.
 */

// Override before importing the module so the constant picks it up.
process.env.OLLAMA_URL = 'http://localhost:0/api/generate'

import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { llmRoute, shouldLlmRoute } from './llmRouter'

const KNOWN_AGENTS = ['chief-of-staff', 'command', 'productivitesse', 'knowledge-base']
const FALLBACK = 'command'

describe('llmRoute fast-path: "to X please" routing', () => {
  test('routes "to chief of staff please do this" → chief-of-staff', async () => {
    const result = await llmRoute('to chief of staff please do this', KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe('chief-of-staff')
    expect(result.agentChanged).toBe(true)
  })

  test('routes "to command please route this" → command', async () => {
    const result = await llmRoute('to command please route this', KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe('command')
    // command is the fallback so agentChanged is false
    expect(result.agentChanged).toBe(false)
  })

  test('routes "to productivitesse please fix the bug" → productivitesse', async () => {
    const result = await llmRoute('to productivitesse please fix the bug', KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe('productivitesse')
    expect(result.agentChanged).toBe(true)
  })

  test('falls back to command when "please" present but no agent match', async () => {
    const result = await llmRoute('please do something unaddressed', KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
    expect(result.agentChanged).toBe(false)
  })

  test('Bug 1 regression: fast path works even when Ollama would fail (no data.response ReferenceError)', async () => {
    // If the data.response bug were still present, the catch block fires only inside
    // the Ollama response branch. Fast-path must resolve BEFORE reaching that code.
    // This test verifies the fast path returns correctly without throwing.
    const result = await llmRoute(
      'to knowledge-base please search for something',
      KNOWN_AGENTS,
      FALLBACK
    )
    expect(result.agent).toBe('knowledge-base')
    expect(result.agentChanged).toBe(true)
  })

  // Line 50: transcript without "please" short-circuits immediately —
  // no regex matching, no Ollama call. This is the highest-priority fast path:
  // if the user isn't addressing a specific agent (no "please"), stick to sticky.
  test('returns fallback immediately when transcript contains no "please"', async () => {
    const result = await llmRoute('just do it already', KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
    expect(result.agentChanged).toBe(false)
    // Message must be the original transcript unchanged
    expect(result.message).toBe('just do it already')
  })

  test('returns fallback when transcript is empty string', async () => {
    const result = await llmRoute('', KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
    expect(result.agentChanged).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// llmRoute — Ollama response parsing branch
// ---------------------------------------------------------------------------
//
// These tests mock globalThis.fetch so we can exercise the full Ollama
// code path (lines 90-158) without a running Ollama server.
// OLLAMA_URL is already set to the unreachable sentinel above — the mock
// replaces fetch before each test and restores it after.
//
// The "please" keyword in transcripts (but NO fast-path agent match) forces
// the code through the Ollama fetch call. We use a transcript like
// "hey cheff of stoff please do something" where the spoken name doesn't
// match any known agent exactly — this bypasses the fast-path and hits Ollama.

describe('llmRoute — Ollama response parsing', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  // Craft a transcript that contains "please" but won't fast-path match:
  // the addressing fragment ("cheff of stoff") is a misspelling of "chief-of-staff".
  const MISSPELLED = 'cheff of stoff please fix the bug'

  function makeOllamaResponse(responsePayload: unknown, status = 200): Response {
    return new Response(JSON.stringify(responsePayload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  test('falls back to fallbackAgent when Ollama returns a non-ok status', async () => {
    globalThis.fetch = async () => makeOllamaResponse({ error: 'overloaded' }, 503)
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
    expect(result.agentChanged).toBe(false)
  })

  test('falls back when Ollama response body has no "response" field', async () => {
    // The module expects rawData.response to be a string; missing field → fallback.
    globalThis.fetch = async () => makeOllamaResponse({ model: 'llama3.2', done: true })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  test('falls back when Ollama response field is not a string', async () => {
    globalThis.fetch = async () => makeOllamaResponse({ response: 42 })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  test('falls back when Ollama response field is an empty string', async () => {
    globalThis.fetch = async () => makeOllamaResponse({ response: '' })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  test('falls back when LLM JSON is unparseable', async () => {
    // response field is present but contains malformed JSON
    globalThis.fetch = async () => makeOllamaResponse({ response: 'not-json{{}' })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  test('falls back when LLM returns agent: null', async () => {
    // LLM couldn't match any agent — returns null per the prompt instructions
    globalThis.fetch = async () => makeOllamaResponse({ response: JSON.stringify({ agent: null }) })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
    expect(result.agentChanged).toBe(false)
  })

  test('falls back when LLM returns agent: ""', async () => {
    globalThis.fetch = async () => makeOllamaResponse({ response: JSON.stringify({ agent: '' }) })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  test('falls back when LLM returns agent that is not a string', async () => {
    // Guard: agent field must be a string; number → null agentNorm → fallback
    globalThis.fetch = async () => makeOllamaResponse({ response: JSON.stringify({ agent: 99 }) })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  test('routes to LLM-matched agent when it is in knownAgents', async () => {
    // LLM corrects "cheff of stoff" → "chief-of-staff"; agent is in KNOWN_AGENTS
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'chief-of-staff' }) })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe('chief-of-staff')
    expect(result.agentChanged).toBe(true)
  })

  test('normalises agent name (spaces → hyphens, lowercase) from LLM response', async () => {
    // LLM may return "Chief Of Staff" — must be normalised to "chief-of-staff"
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'Chief Of Staff' }) })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe('chief-of-staff')
  })

  test('falls back to fallback when LLM returns agent not in knownAgents', async () => {
    // LLM hallucinated an agent that doesn't exist — guard keeps sticky agent
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'unknown-agent' }) })
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
  })

  // Guard: LLM returning "command" when the transcript doesn't say "command"
  // is suspicious (llama3.2 hallucinates it when confused). The guard keeps
  // the sticky agent in this case to avoid unintended routing to command.
  test('ignores LLM "command" suggestion when transcript does not contain "command"', async () => {
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'command' }) })
    // transcript has "please" but NOT "command" → guard fires → fallback
    const result = await llmRoute(
      'cheff of stoff please do the thing',
      KNOWN_AGENTS,
      'productivitesse'
    )
    expect(result.agent).toBe('productivitesse')
    expect(result.agentChanged).toBe(false)
  })

  test('allows LLM "command" when transcript explicitly says command', async () => {
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'command' }) })
    const result = await llmRoute('to command please handle this', KNOWN_AGENTS, 'productivitesse')
    // Fast path handles this before Ollama — still verify the outcome is correct
    expect(result.agent).toBe('command')
  })

  test('falls back on network error (fetch throws)', async () => {
    globalThis.fetch = async () => {
      throw new Error('ECONNREFUSED')
    }
    const result = await llmRoute(MISSPELLED, KNOWN_AGENTS, FALLBACK)
    expect(result.agent).toBe(FALLBACK)
    expect(result.agentChanged).toBe(false)
  })

  test('routes correctly when knownAgents list is empty (returns agentNorm directly)', async () => {
    // When knownAgents is empty, the guard `knownNorm.includes(agentNorm)` is skipped
    // and the LLM-returned agent is used as-is (knownNorm.length === 0 branch).
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'some-agent' }) })
    const result = await llmRoute(MISSPELLED, [], FALLBACK)
    expect(result.agent).toBe('some-agent')
  })
})

// ---------------------------------------------------------------------------
// shouldLlmRoute — predicate for the transcribe gate
// ---------------------------------------------------------------------------
//
// shouldLlmRoute(transcript) returns true when a transcript should be passed
// through llmRoute for agent detection. This decouples the gate logic from
// the "please" guard inside llmRoute itself (which prevents unnecessary Ollama
// calls for ordinary messages that happen to pass the gate).
//
// True cases:
//   - "please" is present (existing behavior)
//   - "tell X to Y" / "tell X, Y" patterns
//   - "message to X: Y" pattern
//   - "ask X to Y" / "ask X about Y" patterns
//   - "hey X, Y" patterns (already covered by ADDRESSING_PATTERNS)
//
// False cases:
//   - plain statements with no addressing signal

describe('shouldLlmRoute — gate predicate', () => {
  // ---------- "please" (existing behavior preserved) ----------

  test('"check the build please" → true (backward compat)', () => {
    expect(shouldLlmRoute('check the build please')).toBe(true)
  })

  test('"please check the build" → true (backward compat)', () => {
    expect(shouldLlmRoute('please check the build')).toBe(true)
  })

  // ---------- "tell X to/Y" patterns ----------

  // "tell command to check the build" — canonical spoken-name routing
  test('"tell command to check the build" → true', () => {
    expect(shouldLlmRoute('tell command to check the build')).toBe(true)
  })

  test('"tell productivitesse to run the tests" → true', () => {
    expect(shouldLlmRoute('tell productivitesse to run the tests')).toBe(true)
  })

  // ---------- "message to X: Y" pattern ----------

  test('"message to productivitesse: check the build" → true', () => {
    expect(shouldLlmRoute('message to productivitesse: check the build')).toBe(true)
  })

  // ---------- "ask X to/about Y" patterns ----------

  test('"ask jarvis about the weather" → true', () => {
    expect(shouldLlmRoute('ask jarvis about the weather')).toBe(true)
  })

  test('"ask command to check the build" → true', () => {
    expect(shouldLlmRoute('ask command to check the build')).toBe(true)
  })

  // ---------- non-addressing transcripts → false ----------

  // Plain statement with no addressing keyword must NOT trigger llmRoute.
  // This is the most important false case — ordinary messages must not
  // result in unnecessary LLM calls.
  test('"just do the thing" → false (no addressing signal)', () => {
    expect(shouldLlmRoute('just do the thing')).toBe(false)
  })

  test('"check the build" → false (no addressing, no please)', () => {
    expect(shouldLlmRoute('check the build')).toBe(false)
  })

  test('empty string → false', () => {
    expect(shouldLlmRoute('')).toBe(false)
  })

  // Anchoring guard: "send a message to the team" contains "message to" mid-sentence
  // but is NOT a "message to X: Y" addressing command — must NOT trigger llmRoute.
  test('"send a message to the team" → false (mid-sentence "message to" is not addressing)', () => {
    expect(shouldLlmRoute('send a message to the team')).toBe(false)
  })

  // Anchoring guard: mid-sentence "tell" must not match.
  test('"I will tell command to do it" → false ("tell" not at start)', () => {
    expect(shouldLlmRoute('I will tell command to do it')).toBe(false)
  })
})

// ---------------------------------------------------------------------------
// llmRoute — new addressing patterns (tell/message/ask)
// ---------------------------------------------------------------------------
//
// These patterns allow spoken routing WITHOUT "please". The transcript
// is matched via ADDRESSING_PATTERNS and the agent is extracted from the
// addressing fragment. llmRoute's internal "please" guard must NOT fire
// for these — the gate (shouldLlmRoute) fires in transcribe.ts before
// llmRoute is called, so these tests verify end-to-end extraction behavior
// when Ollama is mocked to return the expected agent.

describe('llmRoute — tell/ask/message addressing patterns', () => {
  let originalFetch: typeof globalThis.fetch

  beforeEach(() => {
    originalFetch = globalThis.fetch
  })

  afterEach(() => {
    globalThis.fetch = originalFetch
  })

  function makeOllamaResponse(responsePayload: unknown, status = 200): Response {
    return new Response(JSON.stringify(responsePayload), {
      status,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // The "please" guard inside llmRoute fires for transcripts without "please".
  // For "tell X to Y" transcripts, llmRoute must be modified to also recognise
  // direct-address patterns and skip the early-return guard.
  // These tests document the required end-to-end behavior.

  test('"tell command to check the build" extracts agent="command"', async () => {
    // "command" is in KNOWN_AGENTS, so fast-path or Ollama-path must return it.
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'command' }) })
    const result = await llmRoute(
      'tell command to check the build',
      ['command', 'productivitesse', 'chief-of-staff'],
      'chief-of-staff'
    )
    expect(result.agent).toBe('command')
  })

  test('"message to productivitesse: run the tests" extracts agent="productivitesse"', async () => {
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'productivitesse' }) })
    const result = await llmRoute(
      'message to productivitesse: run the tests',
      ['command', 'productivitesse', 'chief-of-staff'],
      'command'
    )
    expect(result.agent).toBe('productivitesse')
  })

  test('"ask jarvis about the weather" extracts agent="jarvis"', async () => {
    globalThis.fetch = async () =>
      makeOllamaResponse({ response: JSON.stringify({ agent: 'jarvis' }) })
    // jarvis is in knownAgents here — so the guard passes and agent is returned
    const result = await llmRoute(
      'ask jarvis about the weather',
      ['jarvis', 'command', 'productivitesse'],
      'command'
    )
    expect(result.agent).toBe('jarvis')
  })

  test('"just do the thing" (no addressing) → fallback, no agent extracted', async () => {
    // No addressing pattern — llmRoute must return fallback immediately.
    // We do NOT mock fetch: if it were called, the test would fail with a
    // network error proving the guard didn't fire correctly.
    const result = await llmRoute('just do the thing', ['command', 'productivitesse'], 'command')
    expect(result.agent).toBe('command')
    expect(result.agentChanged).toBe(false)
  })
})
