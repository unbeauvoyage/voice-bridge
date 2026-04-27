const FONT_UI = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'

type StatusMode = 'success' | 'cancelled' | 'error'

type StatusConfig = {
  text: string
  color: string
  borderColor: string
}

function getStatusConfig(mode: StatusMode, target: string): StatusConfig {
  switch (mode) {
    case 'success':
      return {
        text: `✓  Delivered → ${target}`,
        color: 'rgb(51,217,102)',
        borderColor: 'rgba(51,217,102,0.6)'
      }
    case 'cancelled':
      return {
        text: '⊘  Cancelled',
        color: 'rgb(255,192,0)',
        borderColor: 'rgba(255,192,0,0.6)'
      }
    case 'error':
      return {
        text: '✗  Delivery failed',
        color: 'rgb(255,69,59)',
        borderColor: 'rgba(255,69,59,0.6)'
      }
  }
}

type StatusOverlayProps = {
  mode: StatusMode
  target: string
  fadeOut: boolean
}

export function StatusOverlay({ mode, target, fadeOut }: StatusOverlayProps): React.JSX.Element {
  const cfg = getStatusConfig(mode, target)
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        width: 360,
        height: 52,
        background: 'rgba(26,26,31,0.70)',
        borderRadius: 10,
        border: `0.8px solid ${cfg.borderColor}`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: FONT_UI,
        userSelect: 'none',
        pointerEvents: 'none',
        opacity: fadeOut ? 0 : 1,
        transition: 'opacity 1s ease'
      }}
    >
      <span style={{ color: cfg.color, fontSize: 16, fontWeight: 500 }}>{cfg.text}</span>
    </div>
  )
}
