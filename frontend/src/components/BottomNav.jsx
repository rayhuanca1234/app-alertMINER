import React, { useState, useEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { Home, MessageCircle, AlertTriangle, Map, User } from 'lucide-react'
import { useAlertStore } from '../store/alertStore'

export default function BottomNav() {
  const alerts = useAlertStore(state => state.alerts)
  const activeCount = alerts.filter(a => a.is_active).length
  const location = useLocation()
  const [inputFocused, setInputFocused] = useState(false)

  // Detect when user focuses any input/textarea (keyboard open on mobile)
  useEffect(() => {
    const onFocus = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        setInputFocused(true)
      }
    }
    const onBlur = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
        // Small delay so tapping send button doesn't flash the nav
        setTimeout(() => setInputFocused(false), 200)
      }
    }
    document.addEventListener('focusin', onFocus)
    document.addEventListener('focusout', onBlur)
    return () => {
      document.removeEventListener('focusin', onFocus)
      document.removeEventListener('focusout', onBlur)
    }
  }, [])

  // Hide nav on login/register pages
  if (['/login', '/register'].includes(location.pathname)) return null

  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/chat', icon: MessageCircle, label: 'Chat' },
    { to: '/alert', icon: AlertTriangle, label: 'ALERTA', isAlert: true },
    { to: '/map', icon: Map, label: 'Mapa' },
    { to: '/profile', icon: User, label: 'Perfil' },
  ]

  return (
    <nav className="fixed bottom-0 w-full z-50 safe-area-bottom"
      style={{ background: 'var(--bg-nav)', backdropFilter: 'blur(16px)', borderTop: '1px solid var(--border)' }}>
      <div className="flex justify-around items-center px-2 py-1">
        {navItems.map(item => {
          const Icon = item.icon

          if (item.isAlert) {
            return (
              <NavLink key={item.to} to={item.to}
                className={({isActive}) => `flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-300 transform ${isActive ? 'scale-110' : 'hover:scale-105'}`}
                style={({isActive}) => ({
                  color: isActive ? '#ef4444' : 'var(--text-muted)',
                })}>
                {({isActive}) => (
                  <>
                    <div className="relative">
                      <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} className="transition-transform duration-300" />
                    </div>
                    <span className={`text-[9px] mt-0.5 font-medium transition-all duration-300 ${isActive ? 'font-bold' : ''}`}>
                      {item.label}
                    </span>
                    {isActive && (
                      <div className="w-1 h-1 rounded-full mt-0.5 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                    )}
                  </>
                )}
              </NavLink>
            )
          }

          return (
            <NavLink key={item.to} to={item.to}
              className={({isActive}) => `flex flex-col items-center py-2 px-3 rounded-xl transition-all duration-300 transform ${isActive ? 'scale-110' : 'hover:scale-105'}`}
              style={({isActive}) => ({
                color: isActive ? 'var(--accent)' : 'var(--text-muted)',
              })}>
              {({isActive}) => (
                <>
                  <div className="relative">
                    <Icon size={22} strokeWidth={isActive ? 2.5 : 1.5} className="transition-transform duration-300" />
                    {item.to === '/' && activeCount > 0 && (
                      <span className="absolute -top-1.5 -right-2 bg-red-500 text-white text-[8px] font-bold min-w-[16px] h-4 flex items-center justify-center px-1 rounded-full shadow-lg shadow-red-500/50 animate-pulse">
                        {activeCount > 99 ? '99+' : activeCount}
                      </span>
                    )}
                  </div>
                  <span className={`text-[9px] mt-0.5 font-medium transition-all duration-300 ${isActive ? 'font-bold' : ''}`}>
                    {item.label}
                  </span>
                  {isActive && (
                    <div className="w-1 h-1 rounded-full mt-0.5 shadow-[0_0_8px_rgba(59,130,246,0.8)] animate-pulse" style={{ background: 'var(--accent)' }} />
                  )}
                </>
              )}
            </NavLink>
          )
        })}
      </div>
    </nav>
  )
}
