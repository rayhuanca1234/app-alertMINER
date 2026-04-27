import React, { useState } from 'react'
import { Bell, CheckCircle, Info, AlertTriangle, ShieldAlert, MessageSquare } from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { useNotificationStore } from '../store/notificationStore'
import { useAuthStore } from '../store/authStore'

export default function InboxPanel() {
  const { notifications, markAsRead, markAllAsRead, unreadCount } = useNotificationStore()
  const { user } = useAuthStore()
  const navigate = useNavigate()
  const [clickedId, setClickedId] = useState(null)

  const handleNotificationClick = (notif) => {
    if (!notif.is_read) {
      markAsRead(notif.id)
    }
    
    setClickedId(notif.id)
    
    // Animate and redirect after a short delay
    setTimeout(() => {
      setClickedId(null)
      if (notif.type === 'alert') {
        navigate('/map')
      } else if (notif.type === 'chat') {
        navigate('/chat')
      }
    }, 300)
  }

  const renderIcon = (notif) => {
    // If metadata has sender avatar, show it
    if (notif.metadata?.sender_avatar) {
      return (
        <img 
          src={notif.metadata.sender_avatar} 
          alt="Avatar" 
          referrerPolicy="no-referrer"
          className="w-10 h-10 rounded-full object-cover border-2 border-[var(--bg-secondary)] shadow-sm" 
        />
      )
    }
    
    // Otherwise show default icons based on type
    switch (notif.type?.toUpperCase()) {
      case 'ALERT': return <ShieldAlert size={20} className="text-red-500 m-2" />
      case 'CHAT': return <MessageSquare size={20} className="text-blue-500 m-2" />
      case 'WARNING': return <AlertTriangle size={20} className="text-amber-500 m-2" />
      case 'SYSTEM': return <Info size={20} className="text-blue-500 m-2" />
      default: return <Bell size={20} className="text-slate-400 m-2" />
    }
  }

  return (
    <div className="flex flex-col h-full bg-[var(--bg-secondary)] rounded-2xl overflow-hidden border border-[var(--border)]">
      <div className="p-4 border-b border-[var(--border)] flex items-center justify-between bg-[var(--bg-card)]">
        <div className="flex items-center gap-2">
          <Bell size={18} className="text-[var(--accent)]" />
          <h3 className="font-bold text-[var(--text-primary)]">Buzón de Notificaciones</h3>
        </div>
        {unreadCount > 0 && (
          <button 
            onClick={() => markAllAsRead(user.id)}
            className="text-xs font-medium text-[var(--accent)] hover:underline flex items-center gap-1"
          >
            <CheckCircle size={12} /> Marcar todo
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-2">
        {notifications.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-center px-4">
            <Bell size={32} className="text-[var(--text-muted)] mb-2 opacity-50" />
            <p className="text-sm text-[var(--text-muted)]">No tienes notificaciones recientes.</p>
          </div>
        ) : (
          notifications.map(notif => (
            <div 
              key={notif.id}
              onClick={() => handleNotificationClick(notif)}
              className={`p-3 rounded-xl flex gap-3 transition-all cursor-pointer border ${
                clickedId === notif.id ? 'border-red-500 scale-[0.98] bg-red-500/10' :
                notif.is_read ? 'bg-[var(--bg-card)] opacity-70 border-transparent hover:border-[var(--border)]' : 'bg-[var(--accent-glow)] border-[var(--accent)]/30 hover:border-[var(--accent)]'
              }`}
            >
              <div className="shrink-0 mt-0.5">
                {renderIcon(notif)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <p className={`text-sm font-bold truncate ${notif.is_read ? 'text-[var(--text-primary)]' : 'text-[var(--accent)]'}`}>
                    {notif.title}
                  </p>
                  {!notif.is_read && <div className="w-2 h-2 rounded-full bg-[var(--accent)] mt-1 shrink-0" />}
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2 leading-relaxed">
                  {notif.body}
                </p>
                <p className="text-[10px] text-[var(--text-muted)] mt-2">
                  {new Date(notif.created_at).toLocaleString('es-PE', {
                    day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit'
                  })}
                </p>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}
