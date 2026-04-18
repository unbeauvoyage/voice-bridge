/**
 * TTS playback + mic pause guard.
 *
 * Extracted from relay-poller.ts (Chunk-5 #1 HIGH security fix):
 *  - TtsSpawn boundary type: argv-only spawn, never a shell string — prevents RCE
 *    via agent-controlled message bodies.
 *  - TtsPauseGuard: per-owner token files in MIC_PAUSE_DIR suppress wake-word
 *    detection across the full TTS playback cycle (edge-tts → afplay).
 *  - playTts(): orchestrates edge-tts → await exit → afplay → await exit with
 *    configurable timeouts and kill-on-timeout for both children.
 */

import { spawn } from 'node:child_process'
import { writeFileSync, mkdirSync, unlinkSync } from 'node:fs'
import { once } from 'node:events'
import { randomUUID } from 'node:crypto'
import { MIC_PAUSE_DIR, OLLAMA_BASE_URL_DEFAULT, OLLAMA_TIMEOUT_MS } from './config.ts'
import { logger } from './logger.ts'

function isOllamaResponse(raw: unknown): raw is { response: unknown } {
  return raw !== null && typeof raw === 'object' && 'response' in raw
}

function extractOllamaResponse(raw: unknown): string | undefined {
  if (!isOllamaResponse(raw)) return undefined
  return typeof raw.response === 'string' ? raw.response : undefined
}

/**
 * Summarizes a message body using Ollama before TTS playback.
 *
 * Short messages (≤ wordLimit + 3 words) pass through unchanged — no Ollama call.
 * For longer messages, sends a prompt to the local Ollama instance (llama3.2:latest).
 * Strips a leading "Summary:" prefix that the model sometimes echoes.
 *
 * Fallback (Ollama offline, timeout, or empty response): returns the first sentence
 * of the input, truncated to 120 characters — matching the old Python daemon behavior.
 *
 * @param text      Raw message body to summarize.
 * @param wordLimit Target word count for the summary (also used as skip threshold).
 *                  Defaults to 8.
 */
export async function summarizeForTts(text: string, wordLimit: number = 8): Promise<string> {
  // Short messages need no summarization — pass through unchanged.
  const words = text.trim().split(/\s+/)
  if (words.length <= wordLimit + 3) return text.trim()

  try {
    const prompt = `Summarize the following message in ${wordLimit} to ${wordLimit + 3} words. No agent name. Just the key fact.\n\nMessage: ${text}\n\nSummary:`
    const ollamaUrl = process.env.OLLAMA_URL ?? OLLAMA_BASE_URL_DEFAULT
    const res = await fetch(ollamaUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: 'llama3.2:latest',
        prompt,
        stream: false,
        options: { num_predict: wordLimit * 3, temperature: 0.3 }
      }),
      signal: AbortSignal.timeout(OLLAMA_TIMEOUT_MS)
    })
    if (!res.ok) throw new Error(`Ollama ${res.status}`)
    const raw: unknown = await res.json()
    let summary = (extractOllamaResponse(raw) ?? '').trim()
    if (summary.toLowerCase().startsWith('summary:')) {
      summary = summary.slice(8).trim()
    }
    if (summary) return summary
  } catch (err) {
    logger.error('tts', 'ollama_summarization_failed', { error: err })
  }

  // Fallback: first sentence of the input text, max 120 chars.
  // Matches the old Python daemon speak() fallback behavior.
  const first = text.split(/[.!?\n]/)[0]?.trim() ?? text.trim()
  return first.slice(0, 120)
}

/**
 * Shape of the TTS spawn boundary. Takes a command + argv array — NEVER
 * a shell string. The production default uses argv-only `spawn` so the
 * agent-controlled body can never reach a shell. Injected in tests so
 * the contract is enforceable (see relay-poller.test.ts).
 *
 * Returns a NodeJS.EventEmitter so callers can await 'exit'. The default
 * implementation returns the ChildProcess from node:child_process.
 *
 * Chunk-5 #1 HIGH fix: the previous implementation piped the body
 * through `sh -c` with a JSON-quoted substitution; shell `$(...)`
 * expansion inside double quotes made every queued message a latent
 * RCE on the host when TTS was enabled.
 */
export type TtsSpawn = (command: string, args: string[]) => NodeJS.EventEmitter

export const defaultTtsSpawn: TtsSpawn = (command, args) => {
  return spawn(command, args, { stdio: 'ignore' })
}

/**
 * Pause-guard boundary: acquire() touches /tmp/wake-word-pause before TTS
 * starts (suppresses wake-word detection in daemon/wake_word.py); release()
 * removes it after afplay finishes.
 *
 * The old `speak` wrapper script did this implicitly. When Chunk-5 #1 split
 * edge-tts+afplay into two direct argv-only spawns (no shell), the speak
 * wrapper was bypassed and the guard was dropped — leaving the mic hot during
 * playback. TTS audio fed back into the open mic, wake-word fired on ambient
 * noise, Whisper hallucinated "hello", delivery looped 23+ times in 2 min.
 *
 * Injected in tests so the acquire→spawn→exit→release ordering is verified.
 */
export interface TtsPauseGuard {
  acquire(): void
  release(): void
}

/**
 * Creates a per-call TtsPauseGuard backed by a token file in MIC_PAUSE_DIR.
 *
 * Each TTS cycle gets a unique token name (tts-{uuid}) so concurrent cycles
 * and manual mic-off (which writes {MIC_PAUSE_DIR}/manual) cannot stomp each other.
 * acquire() writes the token; release() unlinks only that token.
 * The directory is created with mkdir -p on acquire so the guard is self-contained.
 */
export function createTtsPauseGuard(): TtsPauseGuard {
  const token = `tts-${randomUUID()}`
  const tokenPath = `${MIC_PAUSE_DIR}/${token}`
  return {
    acquire() {
      try {
        mkdirSync(MIC_PAUSE_DIR, { recursive: true })
        writeFileSync(tokenPath, '')
      } catch {
        /* ignore write errors */
      }
    },
    release() {
      try {
        unlinkSync(tokenPath)
      } catch {
        /* token may not exist if acquire failed */
      }
    }
  }
}

/**
 * Plays TTS audio for the given body text.
 *
 * Orchestrates the full TTS cycle:
 *   1. guard.acquire() — suppress wake-word mic before spawning anything
 *   2. Spawn edge-tts and AWAIT its exit (up to edgeTtsTimeoutMs) — ensures
 *      the mp3 is fully written before afplay opens it. Kill edge-tts if it times out.
 *   3. Spawn afplay and AWAIT its exit (up to afplayTimeoutMs). Kill afplay if it times out.
 *   4. guard.release() — always in finally so mic is restored even on spawn error
 *   5. Best-effort unlink of mp3Path in finally
 *
 * The body is passed as a single argv element to edge-tts — no shell is involved,
 * so shell metacharacters in agent-controlled bodies cannot execute (Chunk-5 #1 HIGH fix).
 */
export async function playTts(
  body: string,
  mp3Path: string,
  guard: TtsPauseGuard,
  ttsSpawn: TtsSpawn,
  edgeTtsTimeoutMs: number,
  afplayTimeoutMs: number
): Promise<void> {
  guard.acquire()
  try {
    // Step 1: Spawn edge-tts and AWAIT its exit before spawning afplay.
    // The old code was fire-and-forget: afplay raced edge-tts for the
    // mp3 file and played silence or a truncated file. Now we wait for
    // edge-tts to finish writing (up to edgeTtsTimeoutMs) before starting
    // playback. The cap prevents a stuck download from blocking forever.
    const edgeTtsChild = ttsSpawn('edge-tts', [
      '--voice',
      'en-US-JennyNeural',
      '--text',
      body,
      '--write-media',
      mp3Path
    ])
    const edgeTtsResult = await Promise.race([
      once(edgeTtsChild, 'exit').then(() => 'exited' as const),
      new Promise<'timeout'>((r) => setTimeout(() => r('timeout'), edgeTtsTimeoutMs))
    ]).catch(() => 'exited' as const /* edge-tts may exit non-zero — treat as done */)
    // If the timeout won, kill the abandoned edge-tts process so it stops
    // writing to mp3Path while afplay may be reading it.
    // Duck-typed via 'kill' in check: works with real ChildProcess, harmless on plain EventEmitter.
    if (
      edgeTtsResult === 'timeout' &&
      'kill' in edgeTtsChild &&
      typeof edgeTtsChild.kill === 'function'
    ) {
      edgeTtsChild.kill()
    }

    // Step 2: Spawn afplay now that edge-tts has finished (or timed out).
    // 60-second cap prevents hanging if afplay never exits.
    const afplayChild = ttsSpawn('afplay', [mp3Path])
    const afplayResult = await Promise.race([
      once(afplayChild, 'exit').then(() => 'exited' as const),
      new Promise<'timeout'>((resolve) => setTimeout(() => resolve('timeout'), afplayTimeoutMs))
    ]).catch(() => 'exited' as const)
    if (
      afplayResult === 'timeout' &&
      'kill' in afplayChild &&
      typeof afplayChild.kill === 'function'
    ) {
      afplayChild.kill()
    }
  } catch (err) {
    logger.error('tts', 'tts_spawn_failed', { error: err })
  } finally {
    guard.release()
    // Best-effort cleanup of the temp mp3
    try {
      unlinkSync(mp3Path)
    } catch {
      /* file may not exist if edge-tts failed */
    }
  }
}
