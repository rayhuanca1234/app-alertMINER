/**
 * pushService.js
 * Maneja permisos de notificación y envío de notificaciones nativas del sistema.
 * Cuando el usuario hace click → el SW redirige al mapa con la ruta activa.
 */

// ─── Permission helpers ───────────────────────────────────────────────────────

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'denied'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'
  return await Notification.requestPermission()
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

// ─── Send alert notification ─────────────────────────────────────────────────
/**
 * Sends a native OS push notification for a new alert.
 * If a Service Worker is registered (PWA mode), uses SW showNotification
 * so it works in background and supports action buttons.
 * Falls back to plain Notification API when SW is not available.
 *
 * @param {string} title   - Notification title
 * @param {string} body    - Notification body text
 * @param {object} alertData - { alertId, lat, lng, desc }
 */
export async function sendAlertNotification(title, body, alertData = {}) {
  if (!canNotify()) return

  const { alertId, lat, lng, desc } = alertData

  const options = {
    body: body || 'Se reportó una nueva amenaza de seguridad.',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    vibrate: [500, 200, 500, 200, 500],
    requireInteraction: true,
    tag: `alert-${alertId || Date.now()}`,
    renotify: true,
    data: { alertId, lat, lng, desc },
    actions: [
      { action: 'map',   title: '🗺️ Ver en Mapa' },
      { action: 'close', title: '✕ Cerrar'        },
    ],
  }

  // Prefer SW notification (works in background, supports action buttons on Android)
  if ('serviceWorker' in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready
      await reg.showNotification(title, options)
      return
    } catch (e) {
      console.warn('[pushService] SW showNotification failed, falling back:', e)
    }
  }

  // Fallback: plain Notification API (no actions, no background support)
  const notif = new Notification(title, options)

  // Handle click manually for fallback (navigate to map)
  notif.onclick = () => {
    notif.close()
    let url = '/map'
    if (alertId) {
      url = `/map?alertId=${alertId}&route=true`
    } else if (lat && lng) {
      url = `/map?lat=${lat}&lng=${lng}&route=true&desc=${encodeURIComponent(desc || 'Alerta')}`
    }
    window.focus()
    window.location.href = url
  }
}

// ─── Generic local notification (chat, system, etc.) ─────────────────────────
export function sendLocalNotification(title, body, options = {}) {
  if (!canNotify()) return null
  return new Notification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    requireInteraction: false,
    vibrate: [200, 100, 200],
    ...options,
  })
}
