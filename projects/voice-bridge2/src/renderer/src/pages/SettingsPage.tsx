import { useState, useEffect, useCallback } from 'react'
import { SettingsControls } from '../features/voice-settings'
import { useWakeState } from '../features/voice'
import {
  isAgentsResponse,
  isPartialSettings,
  KNOWN_AGENTS,
  SERVER,
  DEFAULT_SETTINGS,
  type Settings
} from '../shared/types'

const styles: Record<string, React.CSSProperties> = {
  container: {
    position: 'relative',
    width: '100%',
    height: '100%',
    background: 'rgba(20, 20, 28, 0.95)',
    borderRadius: 12,
    padding: '14px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 9,
    fontFamily: '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif',
    color: '#e5e5ea',
    userSelect: 'none',
    overflowY: 'auto'
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  dot: {
    width: 10,
    height: 10,
    borderRadius: '50%',
    flexShrink: 0,
    transition: 'background 0.3s'
  },
  statusText: {
    fontSize: 13,
    fontWeight: 500,
    flex: 1,
    color: '#e5e5ea'
  },
  micBadge: {
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: '0.05em',
    color: '#6b7280',
    transition: 'opacity 0.3s'
  },
  transcriptBox: {
    background: 'rgba(255,255,255,0.05)',
    borderRadius: 8,
    padding: '7px 9px',
    flex: 1,
    overflow: 'hidden',
    minHeight: 40
  },
  transcriptLabel: {
    fontSize: 10,
    color: '#6b7280',
    marginBottom: 3,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.06em'
  },
  transcriptText: {
    fontSize: 12,
    color: '#d1d5db',
    lineHeight: 1.5,
    overflow: 'hidden',
    display: '-webkit-box',
    WebkitLineClamp: 3,
    WebkitBoxOrient: 'vertical'
  }
}

function stateColor(s: 'idle' | 'listening' | 'recording' | 'processing'): string {
  switch (s) {
    case 'listening':
      return '#4ade80'
    case 'recording':
      return '#f87171'
    case 'processing':
      return '#facc15'
    default:
      return '#6b7280'
  }
}

function stateLabel(s: 'idle' | 'listening' | 'recording' | 'processing'): string {
  switch (s) {
    case 'listening':
      return 'Listening...'
    case 'recording':
      return 'Recording...'
    case 'processing':
      return 'Processing...'
    default:
      return 'Idle'
  }
}

export function SettingsPage(): React.JSX.Element {
  const { state, setState } = useWakeState()
  const [agents, setAgents] = useState<string[]>(KNOWN_AGENTS)
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS)
  const [saving, setSaving] = useState(false)

  // Close panel on Escape key
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') window.__voiceBridge?.hide()
    }
    window.addEventListener('keydown', handler)
    return (): void => window.removeEventListener('keydown', handler)
  }, [])

  // Load initial status, agents and settings from server
  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch(`${SERVER}/agents`)
        if (res.ok) {
          const data: unknown = await res.json()
          if (isAgentsResponse(data) && data.agents.length > 0) {
            const agentNames = data.agents.map((a) => (typeof a === 'string' ? a : a.name))
            const merged = [...new Set([...KNOWN_AGENTS, ...agentNames])]
            setAgents(merged)
          }
        }
      } catch {
        /* ignore */
      }

      try {
        const res = await fetch(`${SERVER}/settings`)
        if (res.ok) {
          const data: unknown = await res.json()
          if (isPartialSettings(data)) {
            setSettings((s) => ({ ...s, ...data }))
          }
        }
      } catch {
        /* ignore */
      }
    })()
  }, [])

  const handleTargetChange = useCallback(
    async (target: string): Promise<void> => {
      setSaving(true)
      setState((s) => ({ ...s, target }))
      try {
        if (window.__voiceBridge) {
          await window.__voiceBridge.setTarget(target)
        } else {
          await fetch(`${SERVER}/target`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target })
          })
        }
      } catch {
        /* ignore */
      } finally {
        setSaving(false)
      }
    },
    [setState]
  )

  const handleSettingChange = useCallback(
    <K extends keyof Settings>(key: K, value: Settings[K]): void => {
      setSettings((s) => ({ ...s, [key]: value }))
    },
    []
  )

  const dot = stateColor(state.wakeState)

  return (
    <div style={styles.container}>
      <button
        onClick={(): void => window.__voiceBridge?.hide()}
        style={{
          position: 'absolute',
          top: 12,
          right: 12,
          background: 'transparent',
          border: 'none',
          color: 'rgba(255,255,255,0.5)',
          fontSize: 18,
          cursor: 'pointer',
          lineHeight: 1,
          padding: '4px 8px'
        }}
        title="Close"
      >
        ×
      </button>

      {/* Header row */}
      <div style={styles.header}>
        <div style={{ ...styles.dot, background: dot }} />
        <span style={styles.statusText}>{stateLabel(state.wakeState)}</span>
        <span style={{ ...styles.micBadge, opacity: state.micState === 'on' ? 1 : 0.4 }}>
          {state.micState === 'on' ? 'MIC ON' : 'MIC OFF'}
        </span>
      </div>

      <SettingsControls
        settings={settings}
        agents={agents}
        target={state.target}
        saving={saving}
        onTargetChange={(t): void => void handleTargetChange(t)}
        onSettingChange={handleSettingChange}
      />

      {/* Transcript */}
      {state.transcript && (
        <div style={styles.transcriptBox}>
          <div style={styles.transcriptLabel}>Last transcript</div>
          <div style={styles.transcriptText}>{state.transcript}</div>
        </div>
      )}
    </div>
  )
}
