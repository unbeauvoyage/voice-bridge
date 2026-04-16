/**
 * Tests for cmux delivery honesty.
 *
 * Chunk-4 #4 HIGH (cmux.ts:26,67 + index.ts:201): runCmux() used to swallow
 * execSync failures by returning '', so sendToPane / sendEnter appeared to
 * succeed even when the cmux command actually failed. deliverViaCmux then
 * returned normally and the composition in server/index.ts treated
 * relay-fail + cmux-fail as ok:true — CEO saw "message sent" for a
 * message that never landed.
 *
 * The fix routes all cmux invocations through an injectable exec that
 * returns a discriminated Result. deliverViaCmux unwraps each step and
 * throws when ANY step (list-workspaces, list-pane-surfaces, send,
 * send-key) fails, so the composed deliverMessage in index.ts correctly
 * surfaces a 502.
 */

import { describe, test, expect } from 'bun:test'
import { deliverViaCmux, listWorkspaceNames, type CmuxExec, type CmuxResult } from './cmux.ts'

// A fake exec that maps a cmux arg-prefix → CmuxResult. Lets tests script
// which specific cmux command fails (list vs send vs send-key).
function makeExec(script: Array<{ match: RegExp; result: CmuxResult }>): CmuxExec {
  return (args: string): CmuxResult => {
    const hit = script.find((s) => s.match.test(args))
    if (!hit) return { ok: false, error: `no script match for: ${args}` }
    return hit.result
  }
}

const WS_OK_OUTPUT = 'workspace:1 alpha\nworkspace:2 beta\n'
const SURF_OK_OUTPUT = 'surface:1 main\n'

describe('deliverViaCmux — error propagation', () => {
  test('throws when list-workspaces fails (no silent success)', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: false, error: 'cmux cli crashed' } }
    ])
    expect(() => deliverViaCmux('hi', 'alpha', exec)).toThrow()
  })

  test('throws when target workspace not found', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: true, stdout: WS_OK_OUTPUT } }
    ])
    expect(() => deliverViaCmux('hi', 'nonexistent', exec)).toThrow(/No cmux workspace/)
  })

  test('throws when list-pane-surfaces fails', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: true, stdout: WS_OK_OUTPUT } },
      { match: /^list-pane-surfaces/, result: { ok: false, error: 'surface list failed' } }
    ])
    expect(() => deliverViaCmux('hi', 'alpha', exec)).toThrow()
  })

  test('throws when `cmux send` fails (the original HIGH regression)', () => {
    // The exact regression: send silently returned '' before, so delivery
    // reported ok:true. Now a failing send MUST surface as a thrown error.
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: true, stdout: WS_OK_OUTPUT } },
      { match: /^list-pane-surfaces/, result: { ok: true, stdout: SURF_OK_OUTPUT } },
      { match: /^send /, result: { ok: false, error: 'pane closed, injection refused' } }
    ])
    expect(() => deliverViaCmux('hi', 'alpha', exec)).toThrow()
  })

  test('throws when `cmux send-key` (Enter) fails', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: true, stdout: WS_OK_OUTPUT } },
      { match: /^list-pane-surfaces/, result: { ok: true, stdout: SURF_OK_OUTPUT } },
      { match: /^send /, result: { ok: true, stdout: '' } },
      { match: /^send-key /, result: { ok: false, error: 'Enter key refused' } }
    ])
    expect(() => deliverViaCmux('hi', 'alpha', exec)).toThrow()
  })

  test('returns normally on full-chain success', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: true, stdout: WS_OK_OUTPUT } },
      { match: /^list-pane-surfaces/, result: { ok: true, stdout: SURF_OK_OUTPUT } },
      { match: /^send /, result: { ok: true, stdout: '' } },
      { match: /^send-key /, result: { ok: true, stdout: '' } }
    ])
    expect(() => deliverViaCmux('hi', 'alpha', exec)).not.toThrow()
  })
})

describe('listWorkspaceNames — UX-preserving empty on error', () => {
  // /agents uses listWorkspaceNames to build a dropdown. When cmux is not
  // running, returning [] is the correct UX (no cmux-backed agents). We
  // keep that behaviour even though deliverViaCmux now throws.
  test('returns [] when list-workspaces fails', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: false, error: 'cmux offline' } }
    ])
    expect(listWorkspaceNames(exec)).toEqual([])
  })

  test('returns workspace names on success', () => {
    const exec = makeExec([
      { match: /^list-workspaces$/, result: { ok: true, stdout: WS_OK_OUTPUT } }
    ])
    expect(listWorkspaceNames(exec)).toEqual(['alpha', 'beta'])
  })
})
