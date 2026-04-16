/**
 * Direct cmux delivery — injects transcript into a Claude Code pane by workspace name.
 * Used as fallback when the relay server (localhost:8765) is not running.
 *
 * Workspace matching is purely by name: whatever the user named their cmux workspace
 * is what they put in the "To" field on the voice-bridge UI.
 *
 * Chunk-4 #4 HIGH: every cmux invocation returns a discriminated Result.
 * The previous silent-empty-string-on-failure pattern let real `cmux send`
 * failures masquerade as successful delivery, defeating the 502 surfacing
 * in /transcribe. deliverViaCmux now throws on the first failing step so
 * the composed deliverMessage in server/index.ts correctly reports
 * ok:false and the handler returns 502.
 *
 * Chunk-5 #1b SECURITY: the exec boundary takes an argv array — no
 * shell, ever. The previous implementation built `cmux ${args}` and ran
 * it through execSync, which shells out via /bin/sh -c. User-controlled
 * transcript text reached that shell string after a hand-rolled
 * sanitizer; correct today but fragile. Argv-only removes the entire
 * attack surface: the transcript is one argv element, and no shell
 * parses it.
 */

import { execFileSync } from 'child_process'

interface AgentLocation {
  workspace: string
  surface: string
}

interface CmuxWorkspace {
  id: string
  name: string
}

interface CmuxSurface {
  id: string
  name: string
}

export type CmuxResult = { ok: true; stdout: string } | { ok: false; error: string }

/**
 * Injectable cmux executor. Takes an argv array — NEVER a shell string.
 * Tests pass a fake implementation that scripts success/failure per
 * command; production uses defaultRunCmux which calls `cmux` directly
 * via argv.
 */
export type CmuxExec = (args: string[]) => CmuxResult

const defaultRunCmux: CmuxExec = (args) => {
  try {
    return {
      ok: true,
      stdout: execFileSync('cmux', args, { encoding: 'utf8', timeout: 5000 })
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return { ok: false, error: msg }
  }
}

function parseWorkspaces(output: string): CmuxWorkspace[] {
  const workspaces: CmuxWorkspace[] = []
  for (const line of output.split('\n').filter(Boolean)) {
    const match = line.match(/(workspace:\d+)\s+[✳⠐⠂]*\s*(.+?)(?:\s+\[selected\])?\s*$/)
    if (match && match[1] && match[2]) {
      workspaces.push({ id: match[1], name: match[2].trim() })
    }
  }
  return workspaces
}

function parseSurfaces(output: string): CmuxSurface[] {
  const surfaces: CmuxSurface[] = []
  for (const line of output.split('\n').filter(Boolean)) {
    const match = line.match(/(surface:\d+)\s+[✳⠐⠂]*\s*(.+?)(?:\s+\[selected\])?\s*$/)
    if (match && match[1] && match[2]) {
      surfaces.push({ id: match[1], name: match[2].trim() })
    }
  }
  return surfaces
}

function normalizeName(name: string): string {
  return name.replace(/^meta:/, '').toLowerCase()
}

/**
 * Minimal sanitization of text before it reaches cmux. Shell-safety is
 * no longer our concern (argv has no shell), but we still keep the
 * newline→space fold so multi-line transcripts do not break cmux's
 * line-oriented pane input, and we strip obvious heredoc openers
 * because cmux itself parses them inside pane text.
 */
function sanitizeForPane(text: string): string {
  return text.replace(/\r?\n/g, ' ').replace(/<<\s*'?\w+'?/g, '')
}

function sendToPane(exec: CmuxExec, loc: AgentLocation, text: string): void {
  const sanitized = sanitizeForPane(text)
  const r = exec(['send', '--workspace', loc.workspace, '--surface', loc.surface, sanitized])
  if (!r.ok) throw new Error(`cmux send failed: ${r.error}`)
}

function sendEnter(exec: CmuxExec, loc: AgentLocation): void {
  const r = exec(['send-key', '--workspace', loc.workspace, '--surface', loc.surface, 'Enter'])
  if (!r.ok) throw new Error(`cmux send-key Enter failed: ${r.error}`)
}

/**
 * Returns cmux workspace names, or [] if cmux is unavailable. Used by
 * /agents to build a dropdown — a cmux-offline environment is legitimate
 * (the UX shows "no cmux-backed agents"), so we translate list failure
 * into an empty list rather than throwing.
 */
export function listWorkspaceNames(exec: CmuxExec = defaultRunCmux): string[] {
  const r = exec(['list-workspaces'])
  if (!r.ok) return []
  return parseWorkspaces(r.stdout).map((w) => w.name)
}

/**
 * Deliver a transcript to a cmux workspace by name. Throws on any
 * failure — list-workspaces, workspace-not-found, list-pane-surfaces,
 * send, or send-key. The caller (server/index.ts composed
 * deliverMessage) uses the thrown error to report ok:false, which the
 * handler surfaces as 502 in /transcribe.
 */
export function deliverViaCmux(
  transcript: string,
  agentName: string,
  exec: CmuxExec = defaultRunCmux
): void {
  const wsRes = exec(['list-workspaces'])
  if (!wsRes.ok) throw new Error(`cmux list-workspaces failed: ${wsRes.error}`)
  const workspaces = parseWorkspaces(wsRes.stdout)
  const normalized = normalizeName(agentName)
  const ws = workspaces.find((w) => normalizeName(w.name) === normalized)
  if (!ws) throw new Error(`No cmux workspace named "${agentName}"`)

  const surfRes = exec(['list-pane-surfaces', '--workspace', ws.id])
  if (!surfRes.ok) throw new Error(`cmux list-pane-surfaces failed: ${surfRes.error}`)
  const surfaces = parseSurfaces(surfRes.stdout)
  if (!surfaces.length) throw new Error(`No surfaces in workspace "${agentName}"`)

  const firstSurface = surfaces[0]
  if (!firstSurface) throw new Error(`No surfaces in workspace "${agentName}"`)
  const loc = { workspace: ws.id, surface: firstSurface.id }
  sendToPane(exec, loc, transcript)
  sendEnter(exec, loc)
}
