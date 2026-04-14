import { type MessageToast } from '../../../shared/types'

const FONT_UI = '-apple-system, BlinkMacSystemFont, "SF Pro Text", sans-serif'

type MessageToastItemProps = {
  toast: MessageToast
}

function MessageToastItem({ toast }: MessageToastItemProps): React.JSX.Element {
  return (
    <div
      style={{
        width: 480,
        minHeight: 52,
        background: 'rgba(20,20,38,0.92)',
        borderRadius: 10,
        border: '1px solid rgba(90,90,90,0.5)',
        boxShadow: '0 4px 24px rgba(0,0,0,0.5)',
        padding: '10px 16px',
        fontFamily: FONT_UI,
        userSelect: 'none',
        pointerEvents: 'none',
        opacity: toast.fadeOut ? 0 : 1,
        transition: 'opacity 1s ease',
      }}
    >
      {toast.agent && (
        <div
          style={{
            color: 'rgb(74,143,255)',
            fontSize: 18,
            fontWeight: 500,
            marginBottom: toast.body ? 4 : 0,
          }}
        >
          {toast.agent}
        </div>
      )}
      {toast.body && (
        <div
          style={{
            color: 'rgb(217,235,255)',
            fontSize: 18,
            fontWeight: 500,
            lineHeight: 1.4,
          }}
        >
          {toast.body}
        </div>
      )}
    </div>
  )
}

type MessageToastStackProps = {
  toasts: MessageToast[]
}

export function MessageToastStack({ toasts }: MessageToastStackProps): React.JSX.Element {
  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        display: 'flex',
        flexDirection: 'column',
        gap: 8,
      }}
    >
      {toasts.map((t) => (
        <MessageToastItem key={t.id} toast={t} />
      ))}
    </div>
  )
}
