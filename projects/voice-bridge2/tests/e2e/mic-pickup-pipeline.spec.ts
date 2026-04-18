/**
 * E2E tests for the mic pickup pipeline.
 *
 * Root cause investigated 2026-04-18: "H-IBC not picking up — mic toggled on
 * but not listening." When the app crashes mid-TTS, a stale `tts-{uuid}` token
 * remains in /tmp/wake-word-pause.d/. The daemon pauses for ANY file in that
 * directory but isMicOn() only checks the `manual` token — so the UI shows
 * "MIC ON" while the daemon stays paused. Fix: cleanStaleTtsPauseTokens() on
 * server startup removes all `tts-*` tokens and restores daemon listening.
 *
 * Test groups:
 *   1. cleanStaleTtsPauseTokens — removes stale tokens, preserves manual
 *   2. isMicOn / setMic — correct state with manual token only
 *   3. handleMicCommand — voice commands toggle the manual token
 *   4. handleMic route — GET/POST mic state round-trip
 */

import { describe, test, expect, afterEach } from 'bun:test'
import { mkdirSync, writeFileSync, existsSync, rmSync } from 'node:fs'
import { join } from 'node:path'
import {
  cleanStaleTtsPauseTokens,
  isMicOn,
  setMic,
  handleMicCommand,
  handleMic,
  type MicContext
} from '../../server/routes/mic.ts'

// ── Test fixture: isolated temp directory per test ───────────────────────────

const TMP_BASE = '/tmp/vb2-mic-test'
let testDir = ''
let testManualToken = ''

function freshDir(suffix: string): string {
  const dir = `${TMP_BASE}-${suffix}-${Date.now()}`
  mkdirSync(dir, { recursive: true })
  return dir
}

afterEach(() => {
  // Clean up the test directory after each test
  if (testDir && existsSync(testDir)) {
    rmSync(testDir, { recursive: true, force: true })
  }
  testDir = ''
  testManualToken = ''
})

// ── 1. cleanStaleTtsPauseTokens ───────────────────────────────────────────────

describe('cleanStaleTtsPauseTokens — removes stale TTS tokens on startup', () => {
  test('removes a single stale tts-* token from the pause directory', () => {
    testDir = freshDir('clean1')
    const staleToken = join(testDir, 'tts-abc123-dead-beef-0000-ffffffffffff')
    writeFileSync(staleToken, '')
    expect(existsSync(staleToken)).toBe(true)

    cleanStaleTtsPauseTokens(testDir)

    expect(existsSync(staleToken)).toBe(false)
  })

  test('removes multiple stale tts-* tokens at once', () => {
    testDir = freshDir('clean2')
    const tokens = ['tts-aaa', 'tts-bbb', 'tts-ccc'].map((name) => {
      const p = join(testDir, name)
      writeFileSync(p, '')
      return p
    })

    cleanStaleTtsPauseTokens(testDir)

    for (const t of tokens) expect(existsSync(t)).toBe(false)
  })

  test('preserves the manual token — user intent survives restart', () => {
    testDir = freshDir('clean3')
    const manualToken = join(testDir, 'manual')
    const staleToken = join(testDir, 'tts-orphan')
    writeFileSync(manualToken, '')
    writeFileSync(staleToken, '')

    cleanStaleTtsPauseTokens(testDir)

    // Stale TTS token removed; manual token survives
    expect(existsSync(staleToken)).toBe(false)
    expect(existsSync(manualToken)).toBe(true)
  })

  test('is a no-op when the pause directory does not exist', () => {
    // Should not throw — first run after fresh install
    expect(() => cleanStaleTtsPauseTokens('/tmp/vb2-nonexistent-dir-99999')).not.toThrow()
  })

  test('is a no-op when the pause directory is already empty', () => {
    testDir = freshDir('clean5')
    expect(() => cleanStaleTtsPauseTokens(testDir)).not.toThrow()
  })

  test('does not remove non-tts-prefixed files (forward compatibility)', () => {
    testDir = freshDir('clean6')
    const weirdFile = join(testDir, 'other-owner')
    writeFileSync(weirdFile, '')

    cleanStaleTtsPauseTokens(testDir)

    expect(existsSync(weirdFile)).toBe(true)
  })
})

// ── 2. isMicOn / setMic ───────────────────────────────────────────────────────

describe('isMicOn — reflects manual token only (not TTS tokens)', () => {
  test('returns true when no manual token exists', () => {
    testDir = freshDir('mic1')
    testManualToken = join(testDir, 'manual')
    expect(isMicOn(testManualToken)).toBe(true)
  })

  test('returns false when manual token exists', () => {
    testDir = freshDir('mic2')
    testManualToken = join(testDir, 'manual')
    mkdirSync(testDir, { recursive: true })
    writeFileSync(testManualToken, '')
    expect(isMicOn(testManualToken)).toBe(false)
  })

  test('returns true even when a stale tts-* token exists (UI shows MIC ON)', () => {
    // This is the "not picking up" scenario: stale token pauses daemon but
    // isMicOn() returns true. After cleanStaleTtsPauseTokens() the daemon
    // resumes. isMicOn() is intentionally user-intent-only.
    testDir = freshDir('mic3')
    const staleToken = join(testDir, 'tts-stale')
    testManualToken = join(testDir, 'manual')
    writeFileSync(staleToken, '')
    // manual token does NOT exist → UI shows "MIC ON"
    expect(isMicOn(testManualToken)).toBe(true)
    // But daemon is paused (stale token in dir). After cleanup it resumes:
    cleanStaleTtsPauseTokens(testDir)
    expect(existsSync(staleToken)).toBe(false)
    // Now both UI and daemon agree: mic is on
    expect(isMicOn(testManualToken)).toBe(true)
  })

  test('setMic(false) creates manual token', () => {
    testDir = freshDir('setmic1')
    testManualToken = join(testDir, 'manual')
    setMic(false, testDir, testManualToken)
    expect(existsSync(testManualToken)).toBe(true)
    expect(isMicOn(testManualToken)).toBe(false)
  })

  test('setMic(true) removes manual token', () => {
    testDir = freshDir('setmic2')
    testManualToken = join(testDir, 'manual')
    // Start paused
    mkdirSync(testDir, { recursive: true })
    writeFileSync(testManualToken, '')
    expect(isMicOn(testManualToken)).toBe(false)

    setMic(true, testDir, testManualToken)

    expect(isMicOn(testManualToken)).toBe(true)
  })

  test('setMic(true) is idempotent when mic is already on', () => {
    testDir = freshDir('setmic3')
    testManualToken = join(testDir, 'manual')
    expect(() => setMic(true, testDir, testManualToken)).not.toThrow()
    expect(isMicOn(testManualToken)).toBe(true)
  })
})

// ── 3. handleMicCommand — voice mic control ───────────────────────────────────

describe('handleMicCommand — voice commands control the manual token', () => {
  test('"turn off mic" returns handled:true and pauses via manual token', () => {
    testDir = freshDir('cmd1')
    testManualToken = join(testDir, 'manual')
    const result = handleMicCommand('turn off the mic', testDir, testManualToken)
    expect(result).not.toBeNull()
    expect(result?.handled).toBe(true)
    expect(result?.state).toBe('off')
    expect(existsSync(testManualToken)).toBe(true)
  })

  test('"turn on mic" returns handled:true and resumes via manual token', () => {
    testDir = freshDir('cmd2')
    testManualToken = join(testDir, 'manual')
    // Start paused
    mkdirSync(testDir, { recursive: true })
    writeFileSync(testManualToken, '')

    const result = handleMicCommand('turn on the microphone', testDir, testManualToken)
    expect(result?.handled).toBe(true)
    expect(result?.state).toBe('on')
    expect(existsSync(testManualToken)).toBe(false)
  })

  test('unrelated transcript returns null (not a mic command)', () => {
    testDir = freshDir('cmd3')
    testManualToken = join(testDir, 'manual')
    const result = handleMicCommand('schedule a meeting tomorrow', testDir, testManualToken)
    expect(result).toBeNull()
  })
})

// ── 4. handleMic route — GET/POST round-trip ──────────────────────────────────

describe('handleMic route — GET/POST mic state round-trip', () => {
  function makeCtx(on: boolean): MicContext {
    let state = on
    return {
      isMicOn: () => state,
      setMic: (v: boolean) => {
        state = v
      }
    }
  }

  test('GET /mic returns { state: "on" } when mic is on', async () => {
    const ctx = makeCtx(true)
    const res = await handleMic(new Request('http://localhost/mic'), ctx)
    expect(res).not.toBeNull()
    if (!res) throw new Error('null response')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ state: 'on' })
  })

  test('GET /mic returns { state: "off" } when mic is off', async () => {
    const ctx = makeCtx(false)
    const res = await handleMic(new Request('http://localhost/mic'), ctx)
    if (!res) throw new Error('null response')
    const body: unknown = await res.json()
    expect(body).toMatchObject({ state: 'off' })
  })

  test('POST /mic {state:"off"} calls setMic(false)', async () => {
    const ctx = makeCtx(true)
    const res = await handleMic(
      new Request('http://localhost/mic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'off' })
      }),
      ctx
    )
    if (!res) throw new Error('null response')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ state: 'off' })
    // ctx should have been mutated
    expect(ctx.isMicOn()).toBe(false)
  })

  test('POST /mic {state:"on"} calls setMic(true)', async () => {
    const ctx = makeCtx(false)
    const res = await handleMic(
      new Request('http://localhost/mic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'on' })
      }),
      ctx
    )
    if (!res) throw new Error('null response')
    expect(res.status).toBe(200)
    const body: unknown = await res.json()
    expect(body).toMatchObject({ state: 'on' })
    expect(ctx.isMicOn()).toBe(true)
  })

  test('POST /mic with invalid body returns 400', async () => {
    const ctx = makeCtx(true)
    const res = await handleMic(
      new Request('http://localhost/mic', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: 'invalid' })
      }),
      ctx
    )
    if (!res) throw new Error('null response')
    expect(res.status).toBe(400)
  })

  test('DELETE /mic returns null (dispatcher fallthrough)', async () => {
    const ctx = makeCtx(true)
    const res = await handleMic(new Request('http://localhost/mic', { method: 'DELETE' }), ctx)
    expect(res).toBeNull()
  })
})
