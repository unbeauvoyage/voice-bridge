/**
 * Tests for summarizeForTts — the Ollama-based summarization step applied
 * before edge-tts playback.
 *
 * All tests mock global fetch so no real Ollama process is required.
 * Each test restores fetch after it runs.
 */

import { describe, test, expect, mock, beforeEach, afterEach } from 'bun:test'
import { summarizeForTts } from './tts'

// Capture original fetch so we can restore it after each test.
const originalFetch = globalThis.fetch

beforeEach(() => {
  // Restored before each test; individual tests set their own mock.
  globalThis.fetch = originalFetch
})

afterEach(() => {
  globalThis.fetch = originalFetch
})

// ─── Happy path ───────────────────────────────────────────────────────────────

describe('summarizeForTts: Ollama happy path', () => {
  test('returns trimmed summary from Ollama response', async () => {
    // Arrange: mock Ollama returning a clean summary
    globalThis.fetch = mock(async () =>
      Response.json({ response: '  Summary text here  ' })
    )

    const longText = 'This is a very long message with many words that absolutely exceeds the word limit and needs summarization to be short.'
    const result = await summarizeForTts(longText, 8)

    // The function should return the trimmed Ollama response
    expect(result).toBe('Summary text here')
  })

  test('strips leading "Summary:" prefix returned by Ollama', async () => {
    // Ollama sometimes echoes the prompt ending "Summary:" as a prefix —
    // strip it to avoid speaking "Summary: some fact" aloud.
    globalThis.fetch = mock(async () =>
      Response.json({ response: 'Summary: Build finished successfully' })
    )

    const longText = 'The build pipeline ran through all stages and finished successfully with zero errors and all checks passing.'
    const result = await summarizeForTts(longText, 8)

    expect(result).toBe('Build finished successfully')
  })

  test('strips "summary:" prefix case-insensitively', async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ response: 'SUMMARY: Task complete' })
    )

    const longText = 'The assigned task has been completed with all requirements fulfilled as specified in the ticket.'
    const result = await summarizeForTts(longText, 8)

    expect(result).toBe('Task complete')
  })
})

// ─── Short messages skip Ollama ───────────────────────────────────────────────

describe('summarizeForTts: short messages bypass Ollama', () => {
  test('returns input unchanged when word count is at or below wordLimit + 3', async () => {
    // Short messages should pass through with no fetch call.
    // Words: "Build complete." = 2 words — far below limit of 8+3=11
    const fetchSpy = mock(async () => Response.json({ response: 'anything' }))
    globalThis.fetch = fetchSpy

    const shortText = 'Build complete.'
    const result = await summarizeForTts(shortText, 8)

    expect(result).toBe('Build complete.')
    // Ollama must NOT have been called for short messages
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('exact boundary: message with wordLimit+3 words returns as-is', async () => {
    // 11 words = 8 + 3 exactly → should skip Ollama
    const fetchSpy = mock(async () => Response.json({ response: 'summary' }))
    globalThis.fetch = fetchSpy

    const elevenWords = 'one two three four five six seven eight nine ten eleven'
    const result = await summarizeForTts(elevenWords, 8)

    expect(result).toBe(elevenWords.trim())
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  test('one word over the boundary triggers Ollama', async () => {
    // 12 words = 8 + 4 → Ollama should be called
    globalThis.fetch = mock(async () =>
      Response.json({ response: 'Summarized result' })
    )

    const twelveWords = 'one two three four five six seven eight nine ten eleven twelve'
    const result = await summarizeForTts(twelveWords, 8)

    expect(result).toBe('Summarized result')
  })
})

// ─── Ollama offline fallback ──────────────────────────────────────────────────

describe('summarizeForTts: Ollama offline fallback', () => {
  test('falls back to first sentence (max 120 chars) when fetch throws', async () => {
    // Simulate Ollama being unreachable (connection refused).
    globalThis.fetch = mock(async () => {
      throw new Error('connect ECONNREFUSED 127.0.0.1:11434')
    })

    // Must be long enough (>11 words) to trigger Ollama; first sentence ends at "."
    const text = 'Build finished. All tests passed with no issues found across every suite and environment tested.'
    const result = await summarizeForTts(text, 8)

    // Fallback: first sentence before "."
    expect(result).toBe('Build finished')
  })

  test('fallback truncates at 120 chars for very long first sentence', async () => {
    globalThis.fetch = mock(async () => {
      throw new Error('connect ECONNREFUSED')
    })

    // Build a sentence that is >11 words AND >120 chars before the first period.
    // "word1 word2 ... word15 and many more characters padding this out longer"
    // followed by a period and then more content.
    const longFirstSentence = Array.from({ length: 30 }, (_, i) => `word${i + 1}`).join(' ')
    const text = longFirstSentence + '. Second sentence here for context and completion.'
    const result = await summarizeForTts(text, 8)

    // Fallback first sentence is the long segment, truncated to 120
    expect(result.length).toBeLessThanOrEqual(120)
    expect(result).toBe(longFirstSentence.slice(0, 120))
  })

  test('falls back when fetch rejects with AbortError (timeout)', async () => {
    // Simulate timeout via AbortSignal.timeout — Bun throws DOMException AbortError
    globalThis.fetch = mock(async () => {
      const err = new DOMException('The operation was aborted.', 'AbortError')
      throw err
    })

    // Long enough (>11 words) to trigger Ollama call
    const text = 'Deployment succeeded. Pods are healthy and ready to serve all incoming traffic without errors.'
    const result = await summarizeForTts(text, 8)

    // Falls back to first sentence
    expect(result).toBe('Deployment succeeded')
  })
})

// ─── Empty Ollama response ────────────────────────────────────────────────────

describe('summarizeForTts: empty Ollama response falls back', () => {
  test('falls back when Ollama returns empty string', async () => {
    // Ollama may return {"response": ""} if the model produces nothing —
    // treat that the same as offline: use the first-sentence fallback.
    globalThis.fetch = mock(async () =>
      Response.json({ response: '' })
    )

    // Long enough (>11 words) to trigger Ollama call
    const text = 'Task done. Details in the worklog are available for review and inspection by the team lead.'
    const result = await summarizeForTts(text, 8)

    expect(result).toBe('Task done')
  })

  test('falls back when Ollama returns whitespace-only response', async () => {
    globalThis.fetch = mock(async () =>
      Response.json({ response: '   \n  ' })
    )

    // Long enough (>11 words) to trigger Ollama call
    const text = 'All tests passed. Coverage is 94% across every module in the entire codebase we ship.'
    const result = await summarizeForTts(text, 8)

    expect(result).toBe('All tests passed')
  })

  test('falls back when Ollama returns non-ok HTTP status', async () => {
    globalThis.fetch = mock(async () =>
      new Response('Service Unavailable', { status: 503 })
    )

    // Long enough (>11 words) to trigger Ollama call
    const text = 'Migration complete. Schema updated successfully with no rows dropped during the transition period.'
    const result = await summarizeForTts(text, 8)

    expect(result).toBe('Migration complete')
  })
})
