import { type Settings } from '../../../shared/types'

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  label: {
    fontSize: 11,
    color: '#9ca3af',
    flexShrink: 0,
    width: 38,
    textAlign: 'right' as const
  },
  select: {
    flex: 1,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 6,
    color: '#e5e5ea',
    fontSize: 12,
    padding: '3px 6px',
    outline: 'none',
    cursor: 'pointer'
  },
  slider: {
    flex: 1,
    accentColor: '#818cf8',
    cursor: 'pointer'
  },
  value: {
    fontSize: 11,
    color: '#818cf8',
    width: 34,
    textAlign: 'right' as const,
    fontVariantNumeric: 'tabular-nums'
  },
  numberInput: {
    width: 52,
    background: 'rgba(255,255,255,0.08)',
    border: '1px solid rgba(255,255,255,0.12)',
    borderRadius: 5,
    color: '#e5e5ea',
    fontSize: 12,
    padding: '2px 6px',
    outline: 'none',
    textAlign: 'center' as const
  },
  hint: {
    fontSize: 11,
    color: '#6b7280'
  },
  toggleWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    cursor: 'pointer'
  },
  checkbox: {
    accentColor: '#818cf8',
    width: 14,
    height: 14,
    cursor: 'pointer'
  },
  toggleLabel: {
    fontSize: 12,
    color: '#d1d5db'
  },
  divider: {
    height: 1,
    background: 'rgba(255,255,255,0.07)',
    margin: '1px 0'
  }
}

type SettingsControlsProps = {
  settings: Settings
  agents: string[]
  target: string
  saving: boolean
  onTargetChange: (target: string) => void
  onSettingChange: <K extends keyof Settings>(key: K, value: Settings[K]) => void
}

export function SettingsControls({
  settings,
  agents,
  target,
  saving,
  onTargetChange,
  onSettingChange
}: SettingsControlsProps): React.JSX.Element {
  return (
    <>
      {/* Target agent */}
      <div style={styles.row}>
        <label style={styles.label}>Target</label>
        <select
          style={styles.select}
          value={target}
          onChange={(e): void => onTargetChange(e.target.value)}
          disabled={saving}
        >
          {agents.map((a) => (
            <option key={a} value={a}>
              {a}
            </option>
          ))}
          {!agents.includes(target) && <option value={target}>{target}</option>}
        </select>
      </div>

      <div style={styles.divider} />

      {/* Start threshold */}
      <div style={styles.row}>
        <label style={styles.label}>Wake</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.start_threshold}
          style={styles.slider}
          onChange={(e): void => onSettingChange('start_threshold', parseFloat(e.target.value))}
        />
        <span style={styles.value}>{settings.start_threshold.toFixed(2)}</span>
      </div>

      {/* Stop threshold */}
      <div style={styles.row}>
        <label style={styles.label}>Stop</label>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={settings.stop_threshold}
          style={styles.slider}
          onChange={(e): void => onSettingChange('stop_threshold', parseFloat(e.target.value))}
        />
        <span style={styles.value}>{settings.stop_threshold.toFixed(2)}</span>
      </div>

      <div style={styles.divider} />

      {/* TTS enabled */}
      <div style={styles.row}>
        <label style={styles.label}>TTS</label>
        <label style={styles.toggleWrap}>
          <input
            type="checkbox"
            checked={settings.tts_enabled}
            style={styles.checkbox}
            onChange={(e): void => onSettingChange('tts_enabled', e.target.checked)}
          />
          <span style={styles.toggleLabel}>{settings.tts_enabled ? 'On' : 'Off'}</span>
        </label>
      </div>

      {/* TTS word limit */}
      <div style={styles.row}>
        <label style={styles.label}>Words</label>
        <input
          type="number"
          min={1}
          max={20}
          value={settings.tts_word_limit}
          style={styles.numberInput}
          onChange={(e): void =>
            onSettingChange(
              'tts_word_limit',
              Math.max(1, Math.min(20, parseInt(e.target.value) || 1))
            )
          }
        />
        <span style={styles.hint}>max TTS words</span>
      </div>

      {/* Toast duration */}
      <div style={styles.row}>
        <label style={styles.label}>Toast</label>
        <input
          type="number"
          min={1}
          max={10}
          value={settings.toast_duration}
          style={styles.numberInput}
          onChange={(e): void =>
            onSettingChange(
              'toast_duration',
              Math.max(1, Math.min(10, parseInt(e.target.value) || 1))
            )
          }
        />
        <span style={styles.hint}>sec</span>
      </div>
    </>
  )
}
