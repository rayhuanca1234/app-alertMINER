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
    data = { title: '⚠️ MinerAlert', body: event.data.text() }
  }

  const { title, body, alertId, lat, lng, desc } = data

  const options = {
    body: body || 'Se ha reportado una nueva amenaza de seguridad',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [500, 200, 500, 200, 500],
    requireInteraction: true,
    tag: `alert-${alertId || Date.now()}`,   // evita notificaciones duplicadas
    renotify: true,
    data: { alertId, lat, lng, desc },        // payload para el click handler
    actions: [
      { action: 'map',    title: '🗺️ Ver en Mapa' },
      { action: 'close',  title: '✕ Cerrar'       },
    ],
  }

  event.waitUntil(
    self.registration.showNotification(title || '⚠️ Nueva Alerta MinerAlert', options)
  )
})

// ─── Notification click: open app and navigate to map with route ──────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  // "close" action: just dismiss
  if (event.action === 'close') return

  const { alertId, lat, lng, desc } = event.notification.data || {}

  // Build URL: if we have coords → route mode; else just open the map
  let targetUrl = '/'
  if (alertId) {
    targetUrl = `/map?alertId=${alertId}&route=true`
  } else if (lat && lng) {
    const encodedDesc = encodeURIComponent(desc || 'Alerta')
    targetUrl = `/map?lat=${lat}&lng=${lng}&route=true&desc=${encodedDesc}`
  } else {
    targetUrl = '/map'
  }

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((windowClients) => {
      // If the app is already open in some tab/window, focus and navigate it
      for (const client of windowClients) {
        if ('navigate' in client) {
          client.navigate(targetUrl)
          return client.focus()
        }
      }
      // Otherwise open a new window
      return clients.openWindow(targetUrl)
    })
  )
})

// ─── Background sync / fetch (optional passthrough) ──────────────────────────
self.addEventListener('fetch', () => {})
