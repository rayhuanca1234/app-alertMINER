import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAlertStore } from '../store/alertStore'
import { useAuthStore } from '../store/authStore'
import { sendAlertNotification } from '../lib/pushService'

export function useAlerts() {
  const { alerts, setAlerts, addAlert, updateAlert, cleanExpiredAlerts, settings } = useAlertStore()
  const { user } = useAuthStore()
  const audioRef = useRef(null)

  // Play alert sound
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

  // Show native OS notification with alert data so click → map + route
  const showNotification = (alert) => {
    const isOwn = alert.user_id === user?.id
    const title = isOwn ? '✅ Tu alerta fue enviada' : '⚠️ ¡ALERTA MinerAlert!'
    const body  = alert.description || '¡Se ha reportado una amenaza de seguridad!'
    sendAlertNotification(title, body, {
      alertId: alert.id,
      lat: alert.latitude,
      lng: alert.longitude,
      desc: alert.description,
    })
  }

  useEffect(() => {
    // Request notification permissions
    if ('Notification' in window && Notification.permission === 'default') {
      Notification.requestPermission()
    }

    // Calculate cutoff time based on expiry setting
    const expiryMinutes = settings.alertExpiryMinutes || 60
    const cutoffDate = new Date(Date.now() - expiryMinutes * 60 * 1000)

    // Fetch only active alerts within expiry window
    const fetchAlerts = async () => {
      const { data, error } = await supabase
        .from('alerts')
        .select('*, profiles(name, avatar_url)')
        .eq('is_active', true)
        .gte('created_at', cutoffDate.toISOString())
        .order('created_at', { ascending: false })
        .limit(100)
      
      if (!error && data) setAlerts(data)
    }

    fetchAlerts()

    // Subscribe to realtime alert changes via Broadcast
    const channel = supabase.channel('global-alerts', {
      config: { broadcast: { ack: true } }
    })
      .on('broadcast', { event: 'new_alert' }, (payload) => {
        const alert = payload.payload
        const isOwn = alert.user_id === user?.id

        addAlert(alert)
        playAlertSound()
        showNotification(alert)

        // Add to notification inbox for everyone (including sender)
        import('../store/notificationStore').then(module => {
          const addLocally = module.useNotificationStore.getState().addNotificationLocally
          addLocally({
            id: alert.id,
            user_id: user?.id,
            title: isOwn ? '✅ Tu alerta fue enviada' : '⚠️ Nueva Alerta',
            message: alert.description || 'Alerta comunitaria',
            type: 'alert',
            related_id: alert.id,
            is_read: isOwn, // mark own alert as already read so badge doesn't count it
            created_at: new Date().toISOString()
          })
        })
      })
      .on('broadcast', { event: 'update_alert' }, (payload) => {
        updateAlert(payload.payload)
      })
      .subscribe()

    // Set up periodic cleanup of expired alerts (every 60 seconds)
    const cleanupInterval = setInterval(() => {
      cleanExpiredAlerts()
    }, 60 * 1000)

    // Run initial cleanup
    cleanExpiredAlerts()

    return () => {
      supabase.removeChannel(channel)
      clearInterval(cleanupInterval)
    }
  }, [user?.id, settings.alertExpiryMinutes])

  return { alerts, playAlertSound }
}
