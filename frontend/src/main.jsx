import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'
import { requestNotificationPermission } from './lib/pushService'

// Register Service Worker for PWA (auto-update in background)
registerSW({
  onNeedRefresh() {
    console.info('[PWA] Nueva versión disponible, actualizando...')
  },
  onOfflineReady() {
    console.info('[PWA] App lista para usar sin conexión ✓')
  },
})

// Request notification permission as early as possible
requestNotificationPermission()

// Listen for navigation messages from the Service Worker
// (when user clicks a notification while the app is already open)
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.type === 'NAVIGATE' && event.data?.url) {
      window.location.href = event.data.url
    }
  })
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)

