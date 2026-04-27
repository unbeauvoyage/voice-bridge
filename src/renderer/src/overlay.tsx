// This file is an Electron overlay entry point. Components render directly to DOM — not exported.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { OverlayPage } from './pages/OverlayPage'

const overlayRootEl = document.getElementById('overlay-root')
if (!overlayRootEl) throw new Error('[voice-bridge] #overlay-root element not found in DOM')
createRoot(overlayRootEl).render(
  <StrictMode>
    <OverlayPage />
  </StrictMode>
)
