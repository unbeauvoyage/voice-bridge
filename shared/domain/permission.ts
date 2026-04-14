export type PermissionId = string & { readonly __brand: 'PermissionId' }

export type PermissionStatus = 'pending' | 'approved' | 'denied'

export interface PermissionRecord {
  id: PermissionId
  sessionId: string
  agentName: string
  tool: string
  input: Record<string, unknown>
  status: PermissionStatus
  ts: number
}
