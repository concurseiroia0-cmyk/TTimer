// Entry point: mounts React, applies static-safe styles and registers the
// generated service worker (works fully offline after first load).

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './App'
import './index.css'

const container = document.getElementById('root')
if (!container) throw new Error('Root container #root not found')

createRoot(container).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Register the Workbox service worker produced by vite-plugin-pwa.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void import('./pwa').then(({ registerServiceWorker }) => registerServiceWorker())
  })
}
