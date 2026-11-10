import { useEffect, useRef } from 'react'
import { fetchWithAuth } from '../lib/auth_client'
import { createRealtimeChannel, removeRealtimeChannel } from '../lib/cloudflare_client'
import { useAlertStore } from '../store/alertStore'
import { useAuthStore } from '../store/authStore'

export function useAlerts() {
  const { alerts, setAlerts, addAlert, updateAlert, cleanExpiredAlerts, settings } = useAlertStore()
  const { user } = useAuthStore()
  const audioRef = useRef(null)

  const playAlertSound = () => {
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio('/sounds/alert.mp3')
        audioRef.current.volume = 1.0
      }
      audioRef.current.currentTime = 0
      audioRef.current.play().catch(() => {})
    } catch (e) {
      console.warn('No se pudo reproducir sonido de alerta:', e)
    }
  }

  useEffect(() => {
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    const expiryMinutes = settings.alertExpiryMinutes || 60
    const cutoffDate = new Date(Date.now() - expiryMinutes * 60 * 1000)

    const fetchAlerts = async () => {
      try {
        const res = await fetchWithAuth(
          `/api/data/alerts?since=${encodeURIComponent(cutoffDate.toISOString())}&limit=100`,
          { redirectOn401: false }
        )
        if (res.ok) {
          const { data } = await res.json()
          if (data) setAlerts(data)
        }
      } catch (e) {
        console.warn('Error fetching alerts from D1:', e)
      }
    }

    fetchAlerts()

    const channel = createRealtimeChannel('global-alerts')
      .on('broadcast', { event: 'new_alert' }, (payload) => {
        const alert = payload.payload
        const isOwn = alert.user_id === user?.id

        addAlert(alert)
        playAlertSound()

        import('../store/notificationStore').then(module => {
          const addLocally = module.useNotificationStore.getState().addNotificationLocally
          addLocally({
            id: alert.id,
            user_id: user?.id,
            title: isOwn ? '✅ Tu alerta fue enviada' : '⚠️ Nueva Alerta',
            message: alert.description || 'Alerta comunitaria',
            type: 'alert',
            related_id: alert.id,
            is_read: isOwn,
            created_at: new Date().toISOString()
          })
        })
      })
      .on('broadcast', { event: 'update_alert' }, (payload) => {
        updateAlert(payload.payload)
      })
      .subscribe()

    const cleanupInterval = setInterval(() => {
      cleanExpiredAlerts()
    }, 60 * 1000)

    cleanExpiredAlerts()

    return () => {
      removeRealtimeChannel(channel)
      clearInterval(cleanupInterval)
    }
  }, [user?.id, settings.alertExpiryMinutes])

  return { alerts, playAlertSound }
}
