import './assets/main.css'

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'

const rootEl = document.getElementById('root')
if (!rootEl) throw new Error('[voice-bridge] #root element not found in DOM')
createRoot(rootEl).render(
  <StrictMode>
    <App />
  </StrictMode>
)
