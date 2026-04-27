import { useEffect } from 'react'

export function useNotifications() {
  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }
  }, [])

  const notify = (title, body, options = {}) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      return new Notification(title, {
        body,
        icon: '/pwa-192x192.png',
        requireInteraction: true,
        vibrate: [500, 200, 500],
        ...options
      })
    }
  }

  return { notify, isSupported: 'Notification' in window }
}
