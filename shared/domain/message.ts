import type { AgentName } from './agent.js'

export type MessageType =
  | 'message'
  | 'done'
  | 'status'
  | 'waiting-for-input'
  | 'escalate'
  | 'voice'
  | 'permission-result'

export type MessageId = string & { readonly __brand: 'MessageId' }

/** Smart constructor for MessageId — use instead of `as MessageId` casts. */
export function toMessageId(id: string): MessageId {
  return id as MessageId
}

/**
 * A message in the relay system.
 * ts is ISO 8601 string — convert to number only at sort/display time.
 * from/to are AgentName branded — both sender and recipient are named agents.
 */
export interface Message {
  id: MessageId
  from: AgentName
  to: AgentName
  type: MessageType
  body: string
  ts: string
}

export interface SendRequest {
  from: string
  to: string
  type: MessageType
  body: string
}

export type SendStatus = 'delivered' | 'queued' | 'failed'

export interface SendResponse {
  id: MessageId
  status: SendStatus
}
