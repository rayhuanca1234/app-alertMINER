import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useAlertStore = create(
  persist(
    (set, get) => ({
      alerts: [],
      settings: {
        soundEnabled: true,
        autoAlertRadius: 1, // km - distancia para alerta automática
        notificationsEnabled: true,
        vibrationEnabled: true,
        alertExpiryMinutes: 60, // 1 hour default
        defaultMapLayer: 'standard',
      },
      setAlerts: (alerts) => set({ alerts }),
      addAlert: (alert) => set((state) => ({ alerts: [alert, ...state.alerts] })),
      updateAlert: (updatedAlert) => set((state) => ({
        alerts: state.alerts.map(a => a.id === updatedAlert.id ? { ...a, ...updatedAlert } : a)
      })),
      removeAlert: (id) => set((state) => ({
        alerts: state.alerts.filter(a => a.id !== id)
      })),
      getActiveAlerts: () => get().alerts.filter(a => a.is_active),
      getActiveAlertCount: () => get().alerts.filter(a => a.is_active).length,
      updateSettings: (newSettings) => set((state) => ({
        settings: { ...state.settings, ...newSettings }
      })),
      // Clean alerts older than the expiry time
      cleanExpiredAlerts: () => {
        const expiryMinutes = get().settings.alertExpiryMinutes || 60
        const cutoff = new Date(Date.now() - expiryMinutes * 60 * 1000)
        set((state) => ({
          alerts: state.alerts.filter(a => {
            if (!a.created_at) return true
            return new Date(a.created_at) > cutoff
          })
        }))
      },
    }),
    {
      name: 'mineralert-alerts',
      partialize: (state) => ({ settings: state.settings }),
    }
  )
)
