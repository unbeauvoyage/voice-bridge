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
 */

// Override before importing the module so the constant picks it up.
process.env.OLLAMA_URL = 'http://localhost:0/api/generate'

import { describe, test, expect } from 'bun:test'
import { llmRoute } from './llmRouter'

const KNOWN_AGENTS = ['chief-of-staff', 'command', 'productivitesse', 'knowledge-base']
const FALLBACK = 'command'

describe('llmRoute fast-path: "to X please" routing', () => {
  test('routes "to chief of staff please do this" → chief-of-staff', async () => {
    const result = await llmRoute(
      'to chief of staff please do this',
      KNOWN_AGENTS,
      FALLBACK,
    )
    expect(result.agent).toBe('chief-of-staff')
    expect(result.agentChanged).toBe(true)
  })

  test('routes "to command please route this" → command', async () => {
    const result = await llmRoute(
      'to command please route this',
      KNOWN_AGENTS,
      FALLBACK,
    )
    expect(result.agent).toBe('command')
    // command is the fallback so agentChanged is false
    expect(result.agentChanged).toBe(false)
  })

  test('routes "to productivitesse please fix the bug" → productivitesse', async () => {
    const result = await llmRoute(
      'to productivitesse please fix the bug',
      KNOWN_AGENTS,
      FALLBACK,
    )
    expect(result.agent).toBe('productivitesse')
    expect(result.agentChanged).toBe(true)
  })

  test('falls back to command when "please" present but no agent match', async () => {
    const result = await llmRoute(
      'please do something unaddressed',
      KNOWN_AGENTS,
      FALLBACK,
    )
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
      FALLBACK,
    )
    expect(result.agent).toBe('knowledge-base')
    expect(result.agentChanged).toBe(true)
  })
})
