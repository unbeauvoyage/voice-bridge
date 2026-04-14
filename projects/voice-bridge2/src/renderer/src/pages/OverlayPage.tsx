/* eslint-disable react-refresh/only-export-components */
// This file is the overlay page entry point — components render directly to DOM.
import { useState, useEffect, useRef } from 'react'
import { RecordingOverlay, StatusOverlay } from '../features/voice'
import { MessageToastStack } from '../features/relay-status'
import { type OverlayMode, type MessageToast } from '../shared/types'

type OverlayState = {
  mode: OverlayMode
  target: string
  fadeOut: boolean
  visible: boolean
}

export function OverlayPage(): React.JSX.Element {
  const [overlayState, setOverlayState] = useState<OverlayState>({
    mode: 'hidden',
    target: '',
    fadeOut: false,
    visible: false,
  })
  const [toasts, setToasts] = useState<MessageToast[]>([])
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!window.__overlayBridge) return
    const unsub = window.__overlayBridge.onShow((payload) => {
      const { mode: m, text = '' } = payload

      if (m === 'message') {
        const colonIdx = text.indexOf(':')
        const agent = colonIdx >= 0 ? text.slice(0, colonIdx).trim() : text.trim()
        const body = colonIdx >= 0 ? text.slice(colonIdx + 1).trim() : ''
        const id = `${Date.now()}-${Math.random()}`
        const toast: MessageToast = { id, agent, body, fadeOut: false }
        setToasts((prev) => [...prev, toast])
        setTimeout(() => {
          setToasts((prev) => prev.map((t) => (t.id === id ? { ...t, fadeOut: true } : t)))
          setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 1000)
        }, 7000)
        return
      }

      if (m === 'hidden') {
        setOverlayState((s) => ({ ...s, visible: false }))
        return
      }

      if (hideTimer.current) clearTimeout(hideTimer.current)
      setOverlayState({ mode: m, target: text, fadeOut: false, visible: true })

      if (m !== 'recording') {
        hideTimer.current = setTimeout(() => {
          setOverlayState((s) => ({ ...s, fadeOut: true }))
          setTimeout(() => setOverlayState((s) => ({ ...s, visible: false })), 1000)
        }, 2000)
      }
    })
    return unsub
  }, [])

  const { mode, target, fadeOut, visible } = overlayState

  return (
    <>
      {visible && mode === 'recording' && <RecordingOverlay target={target} />}
      {visible && (mode === 'success' || mode === 'cancelled' || mode === 'error') && (
        <StatusOverlay mode={mode} target={target} fadeOut={fadeOut} />
      )}
      <MessageToastStack toasts={toasts} />
    </>
  )
}
