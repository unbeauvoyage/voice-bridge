export type SessionId = string & { readonly __brand: 'SessionId' }

export type TurnRole = 'assistant' | 'user'

export interface SessionTurn {
  role: TurnRole
  text: string
  ts: number
}

export interface AgentSession {
  id: SessionId
  agentName: string
  startedAt: number
  turns: SessionTurn[]
  isActive: boolean
}
