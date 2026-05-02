import React, { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAlertStore } from '../store/alertStore'
import { useGeolocation } from '../hooks/useGeolocation'
import { useAlerts } from '../hooks/useAlerts'
import { useAuthStore } from '../store/authStore'
import AlertCard from '../components/AlertCard'
import { ShieldCheck, RefreshCw, Loader2, Wifi, Clock, Navigation } from 'lucide-react'

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

  // Show all active alerts, including the current user's own
  const activeAlerts = alerts.filter(a => a.is_active)

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
      <div className="flex items-center justify-center h-full bg-[#050B14]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 size={32} className="animate-spin text-blue-500" />
          <span className="text-sm text-blue-200">Sincronizando feed...</span>
        </div>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full relative overflow-hidden bg-[#050B14]">
      {/* ── Immersive Premium Background ── */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-blue-600/10 blur-[100px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full bg-emerald-600/10 blur-[100px] pointer-events-none" />

      {/* ── Header ── */}
      <div className="shrink-0 px-5 py-4 z-10 sticky top-0" style={{
        background: 'rgba(5, 11, 20, 0.65)',
        backdropFilter: 'blur(24px)',
        borderBottom: '1px solid rgba(255, 255, 255, 0.05)',
      }}>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
              Hola, {profile?.name?.split(' ')[0] || user?.email?.split('@')[0] || 'Minero'} 
              <span className="animate-pulse">✨</span>
            </h1>
            <div className="flex items-center gap-2 mt-1">
              <span className="flex items-center gap-1.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-400 px-2 py-0.5 rounded-full border border-emerald-500/20">
                <Wifi size={10} /> Online
              </span>
              <span className="text-[11px] text-slate-400 font-medium">
                {activeAlerts.length} alertas activas
              </span>
            </div>
          </div>
          <button onClick={handleRefresh} disabled={refreshing}
            className="p-3 rounded-2xl transition-all active:scale-95 bg-white/5 border border-white/10 text-slate-300 hover:bg-white/10"
            style={{ backdropFilter: 'blur(12px)' }}>
            <RefreshCw size={18} className={refreshing ? 'animate-spin text-blue-400' : ''} />
          </button>
        </div>
      </div>

      {/* ── Alerts Feed ── */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4 pb-24 relative z-10">
        {activeAlerts.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full opacity-80">
            <div className="w-24 h-24 rounded-3xl flex items-center justify-center mb-5 bg-emerald-500/10 border border-emerald-500/20 shadow-[0_0_30px_rgba(16,185,129,0.15)] relative">
              <ShieldCheck size={48} className="text-emerald-400" />
              <div className="absolute inset-0 rounded-3xl border border-emerald-400/50 animate-ping opacity-20" />
            </div>
            <h2 className="text-xl font-bold mb-2 text-white tracking-tight">Zona Segura</h2>
            <p className="text-sm text-center max-w-[240px] text-slate-400 leading-relaxed">
              No se han reportado incidencias. El radar está despejado.
            </p>
          </div>
        ) : (
          activeAlerts.map((alert, index) => (
            <div key={alert.id} className="animate-in fade-in slide-in-from-bottom-4 duration-500" style={{ animationDelay: `${index * 50}ms`, animationFillMode: 'both' }}>
              <AlertCard 
                alert={alert} 
                userPosition={position}
                currentUser={user}
              />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
