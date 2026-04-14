import { useState, useEffect } from 'react'

const FONT = '-apple-system, BlinkMacSystemFont, "SF Pro Text", "SF Mono", monospace'

type RecordingOverlayProps = {
  target: string
}

export function RecordingOverlay({ target }: RecordingOverlayProps): React.JSX.Element {
  const [elapsed, setElapsed] = useState(0)
  const [pulse, setPulse] = useState(true)

  useEffect(() => {
    const timer = setInterval(() => setElapsed((e) => e + 1), 1000)
    const pulser = setInterval(() => setPulse((p) => !p), 600)
    return (): void => {
      clearInterval(timer)
      clearInterval(pulser)
    }
  }, [])

  const timeStr = `${String(Math.floor(elapsed / 60)).padStart(2, '0')}:${String(elapsed % 60).padStart(2, '0')}`

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 420,
        height: 54,
        background: 'rgba(18,18,18,0.88)',
        borderRadius: 27,
        display: 'flex',
        alignItems: 'center',
        gap: 14,
        padding: '0 22px',
        fontFamily: FONT,
        userSelect: 'none',
        pointerEvents: 'none',
      }}
    >
      <span
        style={{
          color: 'rgb(255,69,59)',
          fontSize: 18,
          fontWeight: 700,
          opacity: pulse ? 1.0 : 0.35,
          transition: 'opacity 0.1s ease',
          letterSpacing: '0.04em',
        }}
      >
        ⏺ REC
      </span>
      <span
        style={{
          color: 'rgb(229,229,229)',
          fontSize: 19,
          fontWeight: 400,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '0.06em',
        }}
      >
        {timeStr}
      </span>
      <span
        style={{
          color: 'rgb(74,143,255)',
          fontSize: 18,
          fontWeight: 500,
        }}
      >
        → {target}
      </span>
    </div>
  )
}
