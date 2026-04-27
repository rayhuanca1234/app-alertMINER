import { useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { useAlertStore } from '../store/alertStore'
import { useAuthStore } from '../store/authStore'

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

  // Show browser notification
  const showNotification = (alert) => {
    if ('Notification' in window && Notification.permission === 'granted') {
      new Notification('⚠️ ¡ALERTA MinerAlert!', {
        body: alert.description || '¡Se ha reportado una amenaza de seguridad!',
        icon: '/pwa-192x192.png',
        tag: 'alert-' + alert.id,
        requireInteraction: true,
        vibrate: [500, 200, 500, 200, 500]
      })
    }
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
        addAlert(alert)
        
        // Don't alert yourself
        if (alert.user_id !== user?.id) {
          playAlertSound()
          showNotification(alert)
          
          // Add to notification inbox
          import('../store/notificationStore').then(module => {
            const addLocally = module.useNotificationStore.getState().addNotificationLocally
            addLocally({
              id: alert.id,
              user_id: user.id,
              title: '⚠️ Nueva Alerta',
              message: alert.description || 'Alerta comunitaria',
              type: 'alert',
              related_id: alert.id,
              is_read: false,
              created_at: new Date().toISOString()
            })
          })
        }
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
