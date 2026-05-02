import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// ─── Precache all Vite-generated assets ───────────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ─── Push event: show native OS notification ──────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    // MinerAlert Service Worker
    // Cache buster: v3
    data = { title: '⚠️ MinerAlert', body: event.data.text() }
  }

  const { title, body, alertId, lat, lng, desc, icon, messageId, channelId, type } = data

  const isChat = type === 'chat' || messageId;

  const options = {
    body: body || (isChat ? 'Nuevo mensaje' : 'Se ha reportado una nueva amenaza de seguridad'),
    icon: icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [500, 200, 500, 200, 500],
    requireInteraction: !isChat,
    tag: isChat ? `chat-${channelId || Date.now()}` : `alert-${alertId || Date.now()}`,   // evita notificaciones duplicadas
    renotify: true,
    data: { alertId, lat, lng, desc, messageId, channelId, type: isChat ? 'chat' : 'alert' },        // payload para el click handler
    actions: isChat ? [
      { action: 'chat',    title: '💬 Responder' },
      { action: 'close',  title: '✕ Cerrar'       },
    ] : [
      { action: 'map',    title: '🗺️ Ver en Mapa' },
      { action: 'close',  title: '✕ Cerrar'       },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title || (isChat ? '💬 Nuevo Mensaje' : '⚠️ Nueva Alerta MinerAlert'), options)
  )
})

self.addEventListener('install', () => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(clients.claim())
})

self.addEventListener('message', (event) => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting()
  }
})

// ─── Notification click: open app and navigate to map with route ──────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // "close" action: just dismiss
  if (event.action === 'close') return

  const { alertId, lat, lng, desc, messageId, type } = event.notification.data || {}

  // Build URL: if we have coords → route mode; else just open the map
  let targetUrl = '/'
  
  if (event.action === 'chat' || type === 'chat' || messageId) {
    targetUrl = '/chat'
  } else if (event.action === 'map' || (lat && lng)) {
    const encodedDesc = encodeURIComponent(desc || 'Alerta')
    targetUrl = `/map?alertId=${alertId || ''}&lat=${lat || ''}&lng=${lng || ''}&route=true&desc=${encodedDesc}`
  } else if (alertId) {
    targetUrl = `/map?alertId=${alertId}&route=true`
  }

  const fullUrl = new URL(targetUrl, self.location.origin).href

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If it's an action button click, Android often blocks background focus(). 
      // We must use openWindow to force the OS to bring the PWA to the foreground.
      if (event.action && clients.openWindow) {
        return clients.openWindow(fullUrl);
      }

      // Check if there is already a window/tab open with the exact target URL
      for (let i = 0; i < windowClients.length; i++) {
        let client = windowClients[i];
        if (client.url === fullUrl && 'focus' in client) {
          return client.focus();
        }
      }
      
      // If there is a window open, navigate it and focus
      if (windowClients.length > 0) {
        let client = windowClients[0];
        for (const c of windowClients) {
          if (c.focused) client = c;
        }
        if ('navigate' in client && 'focus' in client) {
          return client.navigate(fullUrl).then(c => c ? c.focus() : client.focus());
        }
      }
      
      // Otherwise open a new window
      if (clients.openWindow) {
        return clients.openWindow(fullUrl)
      }
    })
  )
})

// ─── Background sync / fetch (optional passthrough) ──────────────────────────
self.addEventListener('fetch', () => {})
