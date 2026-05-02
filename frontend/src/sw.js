import { precacheAndRoute, cleanupOutdatedCaches } from 'workbox-precaching'

// ─── Precache all Vite-generated assets ───────────────────────────────────────
cleanupOutdatedCaches()
precacheAndRoute(self.__WB_MANIFEST)

// ─── Cache buster: v5 ─────────────────────────────────────────────────────────

// ─── Push event: show native OS notification ──────────────────────────────────
self.addEventListener('push', (event) => {
  if (!event.data) return

  let data = {}
  try {
    data = event.data.json()
  } catch {
    data = { title: '⚠️ MinerAlert', body: event.data.text() }
  }

  const { title, body, alertId, lat, lng, desc, icon, messageId, channelId, type } = data

  const isChat = type === 'chat' || messageId;

  const options = {
    body: body || (isChat ? 'Nuevo mensaje — toca para responder' : 'Nueva amenaza de seguridad — toca para ver en mapa'),
    icon: icon || '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [500, 200, 500, 200, 500],
    requireInteraction: !isChat,
    tag: isChat ? `chat-${channelId || Date.now()}` : `alert-${alertId || Date.now()}`,
    renotify: true,
    data: { alertId, lat, lng, desc, messageId, channelId, type: isChat ? 'chat' : 'alert' },
  }

  event.waitUntil(
    self.registration.showNotification(title || (isChat ? '💬 Nuevo Mensaje' : '⚠️ Nueva Alerta MinerAlert'), options)
  )
})

// ─── Lifecycle: activate new SW immediately ───────────────────────────────────
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

// ─── Notification click: open app and navigate ────────────────────────────────
self.addEventListener('notificationclick', (event) => {
  event.notification.close()

  const { alertId, lat, lng, desc, messageId, type } = event.notification.data || {}

  // Build the target path
  let targetPath = '/'

  if (type === 'chat' || messageId) {
    targetPath = '/chat'
  } else if (lat && lng) {
    const encodedDesc = encodeURIComponent(desc || 'Alerta')
    targetPath = `/map?alertId=${alertId || ''}&lat=${lat}&lng=${lng}&route=true&desc=${encodedDesc}`
  } else if (alertId) {
    targetPath = `/map?alertId=${alertId}&route=true`
  }

  const fullUrl = new URL(targetPath, self.location.origin).href

  // Always use openWindow — most reliable method across all platforms and states
  event.waitUntil(
    clients.openWindow(fullUrl)
  )
})

// ─── Fetch passthrough ───────────────────────────────────────────────────────
self.addEventListener('fetch', () => {})
