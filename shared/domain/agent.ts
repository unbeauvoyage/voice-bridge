/**
 * Branded primitive — prevents wrong strings in wrong slots.
 * Use toAgentName() to create, never cast directly.
 */
export type AgentName = string & { readonly __brand: 'AgentName' }

export function toAgentName(name: string): AgentName {
  if (!name.trim()) throw new Error('AgentName cannot be empty')
  return name as AgentName
}

/**
 * Agent lifecycle state — derived from JSONL session events in productivitesse.
 * Relay /agents always returns 'unknown' (only knows if agent is registered).
 * 'stale' = registered but no recent JSONL activity
 * 'disconnected' = channel registered but MCP session gone
 * 'offline' = no port file / not registered
 */
export type AgentState =
  | 'unknown'
  | 'idle'
  | 'working'
  | 'stale'
  | 'disconnected'
  | 'offline'

export interface Agent {
  name: AgentName
  state: AgentState
  hasChannel: boolean
  currentTask?: string
}

/** Wire format from relay /agents endpoint — before domain mapping */
export interface RawAgentInfo {
  name: string
  state?: string
  hasChannel?: boolean
}

export function toAgent(raw: RawAgentInfo): Agent {
  return {
    name: toAgentName(raw.name),
    state: toAgentState(raw.state),
    hasChannel: raw.hasChannel ?? false,
  }
}

function toAgentState(state?: string): AgentState {
  switch (state) {
    case 'idle': return 'idle'
    case 'working': return 'working'
    case 'stale': return 'stale'
    case 'disconnected': return 'disconnected'
    case 'offline': return 'offline'
    default: return 'unknown'
  }
}
