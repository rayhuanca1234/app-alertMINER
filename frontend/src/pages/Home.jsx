import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAlertStore } from '../store/alertStore'
import { useGeolocation } from '../hooks/useGeolocation'
import { useAlerts } from '../hooks/useAlerts'
import { useAuthStore } from '../store/authStore'
import AlertCard from '../components/AlertCard'
import { ShieldCheck, RefreshCw, Loader2, Wifi, Clock } from 'lucide-react'

export default function Home() {
  const { alerts, settings } = useAlertStore()
  const { position } = useGeolocation()
  const { user, profile } = useAuthStore()
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  useAlerts() // Subscribe to realtime alerts globally

  useEffect(() => {
    const timer = setTimeout(() => setLoading(false), 1000)
    return () => clearTimeout(timer)
  }, [])

  // Exclude the current user's own alerts — they don't need to see their own
  const activeAlerts = alerts.filter(a => a.is_active && a.user_id !== user?.id)

  const handleRefresh = async () => {
    setRefreshing(true)
    const expiryMinutes = settings.alertExpiryMinutes || 60
    const cutoffDate = new Date(Date.now() - expiryMinutes * 60 * 1000)

    const { data } = await supabase
      .from('alerts')
      .select('*, profiles(name, avatar_url)')
      .eq('is_active', true)
      .gte('created_at', cutoffDate.toISOString())
      .order('created_at', { ascending: false })
      .limit(100)
    
    if (data) useAlertStore.getState().setAlerts(data)
    setTimeout(() => setRefreshing(false), 500)
  }

  const expiryLabel = (min) => {
    if (min < 60) return `${min} min`
    if (min === 60) return '1 hora'
    if (min < 1440) return `${min / 60}h`
    return '24h'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin" style={{ color: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cargando alertas...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-4 py-3" style={{
        background: 'var(--bg-secondary)',
        backdropFilter: 'blur(8px)',
        borderBottom: '1px solid var(--border)',
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-lg font-extrabold" style={{ color: 'var(--text-primary)' }}>
              Hola, {profile?.name || user?.email?.split('@')[0] || 'Minero'} 👋
            </h1>
            <div className="flex items-center gap-2 mt-0.5">
              <Wifi size={10} className="text-emerald-400" />
              <span className="text-[10px]" style={{ color: 'var(--text-muted)' }}>
                Conectado • {activeAlerts.length} alertas activas
              </span>
              <span className="text-[9px] flex items-center gap-1 px-1.5 py-0.5 rounded-full"
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border)', color: 'var(--text-muted)' }}>
                <Clock size={8} /> {expiryLabel(settings.alertExpiryMinutes || 60)}
              </span>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-2 rounded-xl transition-all hover:opacity-80"
            style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
            <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} style={{ color: 'var(--text-secondary)' }} />
          </button>
        </div>
      </div>

      {/* Alerts list */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3 pb-20">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-70">
            <div className="w-20 h-20 rounded-full flex items-center justify-center mb-4"
              style={{ background: 'rgba(34, 197, 94, 0.1)' }}>
              <ShieldCheck size={40} className="text-emerald-500" />
            </div>
            <h2 className="text-lg font-bold mb-1" style={{ color: 'var(--text-primary)' }}>Zona segura</h2>
            <p className="text-sm text-center max-w-xs" style={{ color: 'var(--text-secondary)' }}>
              No hay alertas activas en este momento. Mantente atento.
            </p>
          </div>
        ) : (
          activeAlerts.map(alert => (
            <AlertCard 
              key={alert.id} 
              alert={alert} 
              userPosition={position}
            />
          ))
        )}
      </div>
    </div>
  )
}
