import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, MapPin, Navigation } from 'lucide-react'

function timeAgo(date) {
  const now = new Date()
  const diff = (now - new Date(date)) / 1000
  if (diff < 60) return 'hace segundos'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)} días`
}

export default function AlertCard({ alert, userPosition }) {
  const navigate = useNavigate()
  const profile = alert.profiles
  const initials = (profile?.name || 'A').slice(0, 2).toUpperCase()

  // Calculate distance if we have user position
  let distanceKm = alert.distance_km
  if (!distanceKm && userPosition && alert.latitude && alert.longitude) {
    const R = 6371
    const dLat = (alert.latitude - userPosition.latitude) * Math.PI / 180
    const dLon = (alert.longitude - userPosition.longitude) * Math.PI / 180
    const a = Math.sin(dLat/2)**2 + Math.cos(userPosition.latitude*Math.PI/180) * Math.cos(alert.latitude*Math.PI/180) * Math.sin(dLon/2)**2
    distanceKm = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
  }

  const isNear = distanceKm !== undefined && distanceKm < 1
  const isVeryNear = distanceKm !== undefined && distanceKm < 0.5

  const handleClick = () => {
    // Navigate to map and trace route to this alert
    navigate(`/map?alertId=${alert.id}&route=true`)
  }

  return (
    <div onClick={handleClick}
      className="relative p-4 rounded-2xl border cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
      style={{
        background: isVeryNear
          ? 'rgba(127, 29, 29, 0.3)'
          : isNear
            ? 'rgba(120, 53, 15, 0.15)'
            : 'var(--bg-card)',
        borderColor: isVeryNear
          ? 'rgba(239, 68, 68, 0.6)'
          : isNear
            ? 'rgba(245, 158, 11, 0.4)'
            : 'var(--border)',
        boxShadow: isVeryNear ? '0 0 20px rgba(220,38,38,0.2)' : 'none',
      }}>
      
      {/* Pulse animation for very near alerts */}
      {isVeryNear && (
        <div className="absolute inset-0 rounded-2xl border-2 border-red-500 animate-ping opacity-20" />
      )}

      <div className="flex justify-between items-start relative z-10">
        <div className="flex items-center gap-3">
          {/* Avatar */}
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-11 h-11 rounded-full object-cover ring-2 ring-red-500/50" />
          ) : (
            <div className="w-11 h-11 rounded-full flex items-center justify-center text-sm font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, var(--danger), #f59e0b)' }}>
              {initials}
            </div>
          )}

          <div>
            <h3 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>
              {profile?.name || 'Minero Anónimo'}
            </h3>
            <div className="flex items-center gap-2 mt-0.5">
              <Clock size={12} style={{ color: 'var(--text-muted)' }} />
              <span className="text-xs" style={{ color: 'var(--text-secondary)' }}>{timeAgo(alert.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Distance badge */}
        <div className="flex flex-col items-end gap-1">
          {isVeryNear ? (
            <span className="bg-red-500 text-white text-[10px] font-black px-2.5 py-1 rounded-full animate-pulse shadow-lg shadow-red-500/50">
              ⚠️ ¡MUY CERCA!
            </span>
          ) : isNear ? (
            <span className="bg-amber-500 text-black text-[10px] font-bold px-2.5 py-1 rounded-full">
              ¡CERCA!
            </span>
          ) : null}
          
          {distanceKm !== undefined && (
            <div className="flex items-center gap-1 text-xs" style={{ color: 'var(--text-secondary)' }}>
              <MapPin size={10} />
              <span>{distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}</span>
            </div>
          )}
        </div>
      </div>

      {alert.description && (
        <p className="mt-3 text-sm leading-relaxed pl-14" style={{ color: 'var(--text-secondary)' }}>
          {alert.description}
        </p>
      )}

      {/* Navigate indicator */}
      <div className="absolute bottom-3 right-3 flex items-center gap-1">
        <Navigation size={12} style={{ color: 'var(--accent)' }} />
        <span className="text-[9px] font-medium" style={{ color: 'var(--accent)' }}>Ver ruta</span>
      </div>
    </div>
  )
}
