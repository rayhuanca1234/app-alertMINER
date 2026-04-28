import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { registerSW } from 'virtual:pwa-register'

// Register Service Worker for PWA (auto-update in background)
registerSW({
  onNeedRefresh() {
    // Nueva versión disponible — actualiza silenciosamente
    console.info('[PWA] Nueva versión disponible, actualizando...')
  },
  onOfflineReady() {
    console.info('[PWA] App lista para usar sin conexión ✓')
  },
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
