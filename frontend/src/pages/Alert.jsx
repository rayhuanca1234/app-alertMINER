import React, { useState, useEffect } from 'react'
import { AlertTriangle, MapPin, Loader2, Send, Shield } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useGeolocation } from '../hooks/useGeolocation'
import { useAlertStore } from '../store/alertStore'
import { useNotificationStore } from '../store/notificationStore'
import { socket } from '../lib/socket'



export default function Alert() {
  const { user, profile } = useAuthStore()
  const { addAlert } = useAlertStore()
  const { addNotificationLocally } = useNotificationStore()
  const { position, loading: gpsLoading, error: gpsError } = useGeolocation()
  const [selectedType, setSelectedType] = useState(null)
  const [description, setDescription] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [countdown, setCountdown] = useState(0)

  // Countdown after sending
  useEffect(() => {
    if (countdown > 0) {
      const timer = setTimeout(() => setCountdown(c => c - 1), 1000)
      return () => clearTimeout(timer)
    }
    if (countdown === 0 && sent) {
      setSent(false)
    }
  }, [countdown, sent])

  const handleSendAlert = async () => {
    if (!position || sending || countdown > 0) return
    setSending(true)

    const alertData = {
      user_id: user.id,
      latitude: position.latitude,
      longitude: position.longitude,
      location: `SRID=4326;POINT(${position.longitude} ${position.latitude})`,
      description: selectedType
        ? `${ALERT_TYPES.find(t => t.id === selectedType)?.label || ''} — ${description}`.trim()
        : description || '⚠️ Alerta de seguridad',
      is_active: true,
    }

    const { data, error } = await supabase
      .from('alerts')
      .insert(alertData)
      .select()
      .single()

    if (!error && data) {
      // 1. Add alert immediately to local store so sender sees it right away
      addAlert({
        ...data,
        profiles: { name: profile?.name, avatar_url: profile?.avatar_url }
      })

      // 2. Add confirmation to sender's notification inbox (already read, no badge)
      addNotificationLocally({
        id: `sent-${data.id}`,
        user_id: user.id,
        title: '✅ Tu alerta fue enviada',
        message: data.description || 'Alerta comunitaria enviada correctamente',
        type: 'alert',
        related_id: data.id,
        is_read: true,
        created_at: new Date().toISOString()
      })

      // 3. Broadcast via Supabase to all other users instantly
      const channel = supabase.channel('global-alerts', {
        config: { broadcast: { ack: true } }
      })
      channel.subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          channel.send({
            type: 'broadcast',
            event: 'new_alert',
            payload: {
              ...data,
              profiles: { name: profile?.name, avatar_url: profile?.avatar_url },
              sender_name: profile?.name || user.email
            }
          })
        }
      })

      setSent(true)
      setCountdown(30) // Cooldown 30 seconds
      setDescription('')
      setSelectedType(null)
    } else {
      alert('Error al enviar alerta: ' + (error?.message || 'desconocido'))
    }

    setSending(false)
  }

  if (sent) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-24 h-24 bg-emerald-500/20 rounded-full flex items-center justify-center mb-6 animate-pulse">
          <Shield size={48} className="text-emerald-400" />
        </div>
        <h2 className="text-2xl font-bold text-emerald-400 mb-2">¡Alerta enviada!</h2>
        <p className="text-slate-400 max-w-xs mb-6">
          Todos los mineros de la comunidad han sido notificados. Mantente seguro.
        </p>
        <div className="text-4xl font-mono font-bold text-slate-300">
          {countdown}s
        </div>
        <p className="text-xs text-slate-500 mt-2">Podrás enviar otra alerta en {countdown} segundos</p>
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full p-4 overflow-y-auto">
      {/* Header */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-extrabold text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-amber-500">
          Emitir Alerta
        </h1>
        <p className="text-slate-400 text-sm mt-1">
          Alerta a toda la comunidad minera
        </p>
      </div>

      {/* GPS Status */}
      <div className={`flex items-center gap-2 p-3 rounded-xl mb-4 ${gpsLoading ? 'bg-amber-500/10 border border-amber-500/30' :
        gpsError ? 'bg-red-500/10 border border-red-500/30' :
          'bg-emerald-500/10 border border-emerald-500/30'
        }`}>
        <MapPin size={16} className={gpsLoading ? 'text-amber-400 animate-pulse' : gpsError ? 'text-red-400' : 'text-emerald-400'} />
        <span className="text-xs">
          {gpsLoading ? 'Obteniendo ubicación GPS...' :
            gpsError ? `GPS con error: usando ubicación aproximada` :
              `GPS activo: ${position?.latitude.toFixed(4)}, ${position?.longitude.toFixed(4)}`}
        </span>
      </div>

      {/* Alert type selection */}
      <div className="mb-4">
        <label className="text-sm font-bold text-slate-300 mb-2 block">Tipo de amenaza</label>
        <div className="grid grid-cols-2 gap-2">
          {ALERT_TYPES.map(type => (
            <button key={type.id}
              onClick={() => setSelectedType(selectedType === type.id ? null : type.id)}
              className={`p-3 rounded-xl text-sm font-medium text-left transition-all border ${selectedType === type.id
                ? `bg-gradient-to-r ${type.color} border-white/20 text-white scale-[1.02]`
                : 'bg-slate-800 border-slate-700/50 text-slate-300 hover:bg-slate-700'
                }`}>
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {/* Description */}
      <div className="mb-6">
        <label className="text-sm font-bold text-slate-300 mb-2 block">Descripción (opcional)</label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe la situación: cuántas personas, vehículos, dirección..."
          rows={3}
          className="w-full bg-slate-800 border border-slate-700/50 rounded-xl p-3 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-red-500/30 resize-none"
        />
      </div>

      {/* SOS Button */}
      <div className="flex-1 flex items-center justify-center">
        <button
          onClick={handleSendAlert}
          disabled={sending || !position || countdown > 0}
          className="group relative w-44 h-44 rounded-full transition-all duration-300 disabled:opacity-40"
        >
          {/* Outer glow */}
          <div className="absolute inset-0 rounded-full bg-red-600/40 blur-xl group-hover:bg-red-500/60 transition-all animate-pulse" />

          {/* Button */}
          <div className="relative w-full h-full rounded-full bg-gradient-to-br from-red-600 to-red-800 border-4 border-red-900 shadow-[0_0_40px_rgba(220,38,38,0.5)] flex flex-col items-center justify-center text-white group-hover:from-red-500 group-hover:to-red-700 group-active:scale-95 transition-all">
            {sending ? (
              <Loader2 size={40} className="animate-spin" />
            ) : (
              <>
                <AlertTriangle size={40} className="mb-1" />
                <span className="text-2xl font-black">S.O.S</span>
              </>
            )}
          </div>
        </button>
      </div>

      <p className="text-center text-slate-500 text-xs mt-4 mb-2">
        Tu ubicación GPS se compartirá con la comunidad al alertar
      </p>
    </div>
  )
}
const ALERT_TYPES = [
  { id: 'policias', label: '👮🚨 Atraco de policías', color: 'from-red-600 to-red-800' },
  { id: 'robo', label: '🔫 Robo armado', color: 'from-amber-600 to-amber-800' },
  { id: 'vehiculo', label: '🚗 Vehículo sospechoso', color: 'from-orange-600 to-orange-800' },
  { id: 'accidente', label: '💥 Accidente/Emergencia', color: 'from-purple-600 to-purple-800' },
  { id: 'bloqueo', label: '🚧 Bloqueo de vía', color: 'from-yellow-600 to-yellow-800' },
  { id: 'otro', label: '⚠️ Otra amenaza', color: 'from-slate-600 to-slate-800' },
];