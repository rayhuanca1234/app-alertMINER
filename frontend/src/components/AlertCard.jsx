import React from 'react'
import { useNavigate } from 'react-router-dom'
import { AlertTriangle, Clock, MapPin, Navigation } from 'lucide-react'
import { useAuthStore } from '../store/authStore'

function timeAgo(date) {
  const now = new Date()
  const diff = (now - new Date(date)) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `hace ${Math.floor(diff / 60)} min`
  if (diff < 86400) return `hace ${Math.floor(diff / 3600)}h`
  return `hace ${Math.floor(diff / 86400)} d`
}

export default function AlertCard({ alert, userPosition }) {
  const navigate = useNavigate()
  const { user, profile: userProfile } = useAuthStore()
  const profile = alert.profiles
  const isOwn = (user && alert.user_id === user.id) || (userProfile && profile && userProfile.name === profile.name)
  const initials = (profile?.name || 'A').slice(0, 2).toUpperCase()

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
    navigate(`/map?alertId=${alert.id}&route=true`)
  }

  // Determine glow and border color based on proximity and ownership
  const cardColor = isVeryNear ? 'rgba(239, 68, 68, 0.15)' : isNear ? 'rgba(245, 158, 11, 0.1)' : 'rgba(255, 255, 255, 0.03)'
  const borderColor = isVeryNear ? 'rgba(239, 68, 68, 0.3)' : isNear ? 'rgba(245, 158, 11, 0.2)' : 'rgba(255, 255, 255, 0.08)'

  return (
    <div onClick={handleClick}
      className="relative p-5 rounded-[24px] cursor-pointer transition-all duration-300 hover:scale-[1.02] active:scale-[0.98] overflow-hidden"
      style={{
        background: cardColor,
        border: `1px solid ${borderColor}`,
        backdropFilter: 'blur(16px)',
        boxShadow: isVeryNear ? '0 10px 30px rgba(220,38,38,0.1)' : '0 4px 20px rgba(0,0,0,0.2)',
      }}>
      
      {/* Glossy top highlight */}
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="flex justify-between items-start relative z-10">
        <div className="flex gap-3">
          {/* Avatar */}
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-2xl object-cover ring-2 ring-white/10 shadow-lg" />
          ) : (
            <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
              style={{ background: 'linear-gradient(135deg, #3b82f6, #8b5cf6)' }}>
              {initials}
            </div>
          )}

          <div className="flex flex-col justify-center">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-[15px] text-white tracking-tight">
                {isOwn ? 'Tú' : profile?.name?.split(' ')[0] || 'Minero'}
              </h3>
              {isOwn && (
                <span className="bg-blue-500/20 text-blue-400 text-[9px] px-1.5 py-0.5 rounded uppercase font-black tracking-wider">
                  Mía
                </span>
              )}
            </div>
            <div className="flex items-center gap-1.5 mt-0.5 text-slate-400">
              <Clock size={11} />
              <span className="text-[11px] font-medium">{timeAgo(alert.created_at)}</span>
            </div>
          </div>
        </div>

        {/* Distance Indicator */}
        {distanceKm !== undefined && (
          <div className="flex flex-col items-end">
            <div className={`flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-full ${
              isVeryNear ? 'bg-red-500/20 text-red-400 border border-red-500/30' : 
              isNear ? 'bg-amber-500/20 text-amber-400 border border-amber-500/30' : 
              'bg-white/5 text-slate-300 border border-white/10'
            }`}>
              <MapPin size={10} />
              {distanceKm < 1 ? `${Math.round(distanceKm * 1000)}m` : `${distanceKm.toFixed(1)}km`}
            </div>
          </div>
        )}
      </div>

      {alert.description && (
        <p className="mt-4 text-[14px] leading-relaxed text-slate-300 pl-[60px] font-medium">
          {alert.description}
        </p>
      )}

      {/* Futuristic Route Button */}
      <div className="mt-4 flex justify-end">
        <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-blue-600/20 border border-blue-500/30 text-blue-400 text-[11px] font-bold tracking-wide uppercase transition-colors hover:bg-blue-600/30">
          <Navigation size={12} className="fill-blue-500" />
          Ver ruta
        </div>
      </div>
    </div>
  )
}
