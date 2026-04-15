// Shared types used across features and pages — no app logic here

export type WakeState = 'idle' | 'listening' | 'recording' | 'processing'
export type MicState = 'on' | 'off'
export type OverlayMode = 'success' | 'recording' | 'cancelled' | 'error' | 'message' | 'hidden'

export type DaemonState = {
  target: string
  micState: MicState
  wakeState: WakeState
  transcript: string
}

export type OverlayPayload = {
  mode: OverlayMode
  text?: string
}

export type Settings = {
  start_threshold: number
  stop_threshold: number
  tts_word_limit: number
  tts_enabled: boolean
  toast_duration: number
}

export type MessageToast = {
  id: string
  agent: string
  body: string
  fadeOut: boolean
}

export type StatusResponse = { target: string; micState: MicState }
export type AgentsResponse = { agents: Array<{ name: string } | string> }

export function isStatusResponse(v: unknown): v is StatusResponse {
  if (typeof v !== 'object' || v === null) return false
  if (!('target' in v) || !('micState' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return (
    typeof obj['target'] === 'string' && (obj['micState'] === 'on' || obj['micState'] === 'off')
  )
}

export function isAgentsResponse(v: unknown): v is AgentsResponse {
  if (typeof v !== 'object' || v === null) return false
  if (!('agents' in v)) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  return Array.isArray(obj['agents'])
}

export function isPartialSettings(v: unknown): v is Partial<Settings> {
  if (typeof v !== 'object' || v === null) return false
  const obj: Record<string, unknown> = Object.fromEntries(Object.entries(v))
  if ('start_threshold' in v && typeof obj['start_threshold'] !== 'number') return false
  if ('stop_threshold' in v && typeof obj['stop_threshold'] !== 'number') return false
  if ('tts_word_limit' in v && typeof obj['tts_word_limit'] !== 'number') return false
  if ('tts_enabled' in v && typeof obj['tts_enabled'] !== 'boolean') return false
  if ('toast_duration' in v && typeof obj['toast_duration'] !== 'number') return false
  return true
}

export const DEFAULT_SETTINGS: Settings = {
  start_threshold: 0.3,
  stop_threshold: 0.05,
  tts_word_limit: 3,
  tts_enabled: true,
  toast_duration: 3
}

export const SERVER = 'http://127.0.0.1:3030'
export const KNOWN_AGENTS = ['command', 'chief-of-staff', 'productivitesse', 'atlas', 'sentinel']
