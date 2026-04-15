/**
 * Direct cmux delivery — injects transcript into a Claude Code pane by workspace name.
 * Used as fallback when the relay server (localhost:8765) is not running.
 *
 * Workspace matching is purely by name: whatever the user named their cmux workspace
 * is what they put in the "To" field on the voice-bridge UI.
 */

import { execSync } from 'child_process'

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

function runCmux(args: string): string {
  try {
    return execSync(`cmux ${args}`, { encoding: 'utf8', timeout: 5000 })
  } catch {
    return ''
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

function sendToPane(loc: AgentLocation, text: string): void {
  const sanitized = text
    .replace(/\r?\n/g, ' ')
    .replace(/<<\s*'?\w+'?/g, '')
    .replace(/`/g, "'")
    .replace(/\$/g, '＄')
    .replace(/"/g, '\\"')
  runCmux(`send --workspace ${loc.workspace} --surface ${loc.surface} "${sanitized}"`)
}

function sendEnter(loc: AgentLocation): void {
  runCmux(`send-key --workspace ${loc.workspace} --surface ${loc.surface} Enter`)
}

export function listWorkspaceNames(): string[] {
  const wsOut = runCmux('list-workspaces')
  return parseWorkspaces(wsOut).map((w) => w.name)
}

export function deliverViaCmux(transcript: string, agentName: string): void {
  const wsOut = runCmux('list-workspaces')
  const workspaces = parseWorkspaces(wsOut)
  const normalized = normalizeName(agentName)
  const ws = workspaces.find((w) => normalizeName(w.name) === normalized)
  if (!ws) throw new Error(`No cmux workspace named "${agentName}"`)

  const surfOut = runCmux(`list-pane-surfaces --workspace ${ws.id}`)
  const surfaces = parseSurfaces(surfOut)
  if (!surfaces.length) throw new Error(`No surfaces in workspace "${agentName}"`)

  const firstSurface = surfaces[0]
  if (!firstSurface) throw new Error(`No surfaces in workspace "${agentName}"`)
  const loc = { workspace: ws.id, surface: firstSurface.id }
  sendToPane(loc, transcript)
  sendEnter(loc)
}
