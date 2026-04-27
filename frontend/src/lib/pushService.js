export async function pushService() {
  // Request notification permission if not yet granted
  if ('Notification' in window && Notification.permission === 'default') {
    await Notification.requestPermission()
  }
}

export function canNotify() {
  return 'Notification' in window && Notification.permission === 'granted'
}

export function sendLocalNotification(title, body, options = {}) {
  if (!canNotify()) return null
  return new Notification(title, {
    body,
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    requireInteraction: true,
    vibrate: [500, 200, 500],
    ...options
  })
}
