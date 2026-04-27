import React, { useState, useEffect, useRef } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  X, Home, MessageCircle, AlertTriangle, Map, User, Settings,
  Palette, Bell, MapPin, Shield, ChevronRight, Volume2, VolumeX,
  Smartphone, BellOff, Clock, Sun, Moon, Layers, Info, LogOut,
  Radio, Compass, Type
} from 'lucide-react'
import { useAuthStore } from '../store/authStore'
import { useAlertStore } from '../store/alertStore'
import { useThemeStore, THEMES } from '../store/themeStore'
import { useNotificationStore } from '../store/notificationStore'
import InboxPanel from './InboxPanel'

export default function SideDrawer({ isOpen, onClose }) {
  const { user, profile, signOut } = useAuthStore()
  const { settings, updateSettings } = useAlertStore()
  const { currentTheme, setTheme } = useThemeStore()
  const { unreadCount } = useNotificationStore()
  const [activeSection, setActiveSection] = useState(null)
  const drawerRef = useRef(null)
  const navigate = useNavigate()
  const location = useLocation()

  // Close on route change
  useEffect(() => {
    onClose()
  }, [location.pathname])

  // Close on outside click
  useEffect(() => {
    const handleClick = (e) => {
      if (isOpen && drawerRef.current && !drawerRef.current.contains(e.target)) {
        onClose()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [isOpen, onClose])

  // Close on Escape key
  useEffect(() => {
    const handleKey = (e) => {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [onClose])

  const initials = (profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()

  const navItems = [
    { to: '/', icon: Home, label: 'Inicio' },
    { to: '/chat', icon: MessageCircle, label: 'Chat Comunitario' },
    { to: '/alert', icon: AlertTriangle, label: 'Emitir Alerta', accent: true },
    { to: '/map', icon: Map, label: 'Mapa en Vivo' },
    { to: '/profile', icon: User, label: 'Mi Perfil' },
  ]

  const EXPIRY_OPTIONS = [
    { value: 30, label: '30 min' },
    { value: 60, label: '1 hora' },
    { value: 120, label: '2 horas' },
    { value: 240, label: '4 horas' },
    { value: 480, label: '8 horas' },
    { value: 1440, label: '24 horas' },
  ]

  const toggleSection = (section) => {
    setActiveSection(activeSection === section ? null : section)
  }

  const ToggleSwitch = ({ enabled, onChange, color = 'bg-emerald-500' }) => (
    <button onClick={onChange}
      className={`relative w-11 h-6 rounded-full transition-colors duration-300 ${enabled ? color : 'bg-slate-600'}`}>
      <div className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-md transform transition-transform duration-300 ${enabled ? 'translate-x-[22px]' : 'translate-x-0.5'}`} />
    </button>
  )

  return (
    <>
      {/* Backdrop overlay */}
      <div
        className={`fixed inset-0 z-[9998] transition-all duration-300 ${
          isOpen ? 'bg-black/60 backdrop-blur-sm visible' : 'bg-transparent invisible'
        }`}
        onClick={onClose}
      />

      {/* Drawer */}
      <div
        ref={drawerRef}
        className={`fixed top-0 left-0 h-full z-[9999] transition-transform duration-300 ease-out ${
          isOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
        style={{ width: 'min(320px, 85vw)' }}
      >
        <div className="h-full flex flex-col overflow-hidden"
          style={{
            background: 'var(--bg-primary)',
            borderRight: '1px solid var(--border)',
            boxShadow: isOpen ? '4px 0 24px rgba(0,0,0,0.4)' : 'none'
          }}>
          
          {/* Profile header */}
          <div className="shrink-0 p-5 pb-4" style={{ borderBottom: '1px solid var(--border)' }}>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold tracking-widest uppercase" style={{ color: 'var(--accent)' }}>MinerAlert</span>
              <button onClick={onClose}
                className="p-1.5 rounded-lg hover:bg-white/10 transition-colors"
                style={{ color: 'var(--text-secondary)' }}>
                <X size={18} />
              </button>
            </div>
            
            <div className="flex items-center gap-3 cursor-pointer" onClick={() => { navigate('/profile'); onClose() }}>
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-12 h-12 rounded-2xl object-cover ring-2"
                  style={{ '--tw-ring-color': 'var(--accent)' }} />
              ) : (
                <div className="w-12 h-12 rounded-2xl flex items-center justify-center text-sm font-bold text-white shadow-lg"
                  style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` }}>
                  {initials}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-bold text-sm truncate" style={{ color: 'var(--text-primary)' }}>
                  {profile?.name || 'Sin nombre'}
                </h3>
                <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
              </div>
              <ChevronRight size={16} style={{ color: 'var(--text-muted)' }} />
            </div>
          </div>

          {/* Scrollable content */}
          <div className="flex-1 overflow-y-auto overscroll-contain">
            
            {/* Navigation */}
            <div className="p-3">
              <p className="px-3 py-2 text-[10px] font-bold uppercase tracking-widest" style={{ color: 'var(--text-muted)' }}>
                Navegación
              </p>
              {navItems.map(item => {
                const Icon = item.icon
                const isActive = location.pathname === item.to
                return (
                  <NavLink key={item.to} to={item.to} onClick={onClose}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl mb-0.5 transition-all duration-200"
                    style={{
                      background: isActive ? 'var(--accent-glow)' : 'transparent',
                      color: item.accent ? 'var(--danger)' : isActive ? 'var(--accent)' : 'var(--text-secondary)',
                    }}>
                    <Icon size={18} strokeWidth={isActive ? 2.5 : 1.5} />
                    <span className={`text-sm ${isActive || item.accent ? 'font-bold' : 'font-medium'}`}>{item.label}</span>
                    {item.accent && (
                      <span className="ml-auto w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--danger)' }} />
                    )}
                  </NavLink>
                )
              })}
            </div>

            <div className="mx-4 my-1" style={{ borderBottom: '1px solid var(--border)' }} />

            {/* Inbox Section */}
            <div className="p-3">
              <button onClick={() => toggleSection('inbox')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5 relative"
                style={{ color: 'var(--text-secondary)' }}>
                <div className="relative">
                  <Bell size={18} />
                  {unreadCount > 0 && (
                    <span className="absolute -top-1 -right-1 w-3 h-3 bg-red-500 rounded-full border-2 border-[var(--bg-primary)]"></span>
                  )}
                </div>
                <span className="text-sm font-medium flex-1 text-left">Buzón de Mensajes</span>
                {unreadCount > 0 && (
                  <span className="text-xs font-bold bg-red-500 text-white px-1.5 py-0.5 rounded-full mr-2">
                    {unreadCount}
                  </span>
                )}
                <ChevronRight size={14} className={`transition-transform duration-200 ${activeSection === 'inbox' ? 'rotate-90' : ''}`} />
              </button>

              {activeSection === 'inbox' && (
                <div className="mt-2 px-2 h-80 animate-fadeIn">
                  <InboxPanel />
                </div>
              )}
            </div>

            {/* Fonts Config Section */}
            <div className="p-3">
              <button onClick={() => toggleSection('fonts')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}>
                <Type size={18} />
                <span className="text-sm font-medium flex-1 text-left">Fonts Config</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${activeSection === 'fonts' ? 'rotate-90' : ''}`} />
              </button>

              {activeSection === 'fonts' && (
                <div className="mt-2 px-2 space-y-4 animate-fadeIn">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: 'var(--text-muted)' }}>Fuente del Chat</p>
                    <div className="grid grid-cols-2 gap-2">
                      {[
                        { id: 'inherit', label: 'Sistema' },
                        { id: 'Times New Roman, serif', label: 'Times New Roman' },
                        { id: 'monospace', label: 'Monospace' },
                        { id: 'Georgia, serif', label: 'Georgia' },
                        { id: 'Arial, sans-serif', label: 'Arial' },
                        { id: 'Courier New, monospace', label: 'Courier New' },
                        { id: 'Verdana, sans-serif', label: 'Verdana' },
                        { id: 'Tahoma, sans-serif', label: 'Tahoma' }
                      ].map(font => (
                        <button key={font.id}
                          onClick={() => useThemeStore.getState().setChatFont(font.id)}
                          className="px-2 py-2 rounded-lg text-[11px] transition-all border"
                          style={{
                            background: useThemeStore.getState().chatFont === font.id ? 'var(--accent-glow)' : 'transparent',
                            borderColor: useThemeStore.getState().chatFont === font.id ? 'var(--accent)' : 'var(--border)',
                            color: useThemeStore.getState().chatFont === font.id ? 'var(--accent)' : 'var(--text-secondary)',
                            fontFamily: font.id !== 'inherit' ? font.id : 'inherit'
                          }}>
                          {font.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: 'var(--text-muted)' }}>Tamaño de Letra (Chat)</p>
                    <div className="grid grid-cols-4 gap-2">
                      {[
                        { id: '12px', label: 'Aa' },
                        { id: '14px', label: 'Aa' },
                        { id: '16px', label: 'Aa' },
                        { id: '18px', label: 'Aa' }
                      ].map(size => (
                        <button key={size.id}
                          onClick={() => useThemeStore.getState().setChatFontSize(size.id)}
                          className="px-1 py-2 rounded-lg transition-all border text-center"
                          style={{
                            background: useThemeStore.getState().chatFontSize === size.id ? 'var(--accent-glow)' : 'transparent',
                            borderColor: useThemeStore.getState().chatFontSize === size.id ? 'var(--accent)' : 'var(--border)',
                            color: useThemeStore.getState().chatFontSize === size.id ? 'var(--accent)' : 'var(--text-secondary)',
                            fontSize: size.id
                          }}>
                          {size.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Theme Section */}
            <div className="p-3">
              <button onClick={() => toggleSection('theme')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}>
                <Palette size={18} />
                <span className="text-sm font-medium flex-1 text-left">Apariencia</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${activeSection === 'theme' ? 'rotate-90' : ''}`} />
              </button>

              {activeSection === 'theme' && (
                <div className="mt-2 px-2 space-y-4 animate-fadeIn">
                  <div className="space-y-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest px-1" style={{ color: 'var(--text-muted)' }}>Color</p>
                    {Object.values(THEMES).map(theme => (
                      <button key={theme.id}
                        onClick={() => setTheme(theme.id)}
                        className="w-full flex items-center gap-3 p-3 rounded-xl transition-all border"
                        style={{
                          background: currentTheme === theme.id ? 'var(--accent-glow)' : 'transparent',
                          borderColor: currentTheme === theme.id ? 'var(--accent)' : 'var(--border)',
                        }}>
                        <div className="flex gap-1">
                          {theme.preview.map((c, i) => (
                            <div key={i} className="w-5 h-5 rounded-full border border-white/20" style={{ background: c }} />
                          ))}
                        </div>
                        <span className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>{theme.label}</span>
                        {currentTheme === theme.id && (
                          <div className="ml-auto w-2 h-2 rounded-full" style={{ background: 'var(--accent)' }} />
                        )}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Alert Settings Section */}
            <div className="p-3">
              <button onClick={() => toggleSection('alerts')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}>
                <Bell size={18} />
                <span className="text-sm font-medium flex-1 text-left">Alertas</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${activeSection === 'alerts' ? 'rotate-90' : ''}`} />
              </button>

              {activeSection === 'alerts' && (
                <div className="mt-2 px-2 space-y-4 animate-fadeIn">
                  {/* Sound */}
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                      {settings.soundEnabled ? <Volume2 size={16} className="text-emerald-400" /> : <VolumeX size={16} style={{ color: 'var(--text-muted)' }} />}
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Sonido</span>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Sonido al recibir alerta</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={settings.soundEnabled} onChange={() => updateSettings({ soundEnabled: !settings.soundEnabled })} />
                  </div>

                  {/* Notifications */}
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                      {settings.notificationsEnabled ? <Bell size={16} className="text-blue-400" /> : <BellOff size={16} style={{ color: 'var(--text-muted)' }} />}
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Notificaciones</span>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Push del navegador</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={settings.notificationsEnabled} onChange={() => updateSettings({ notificationsEnabled: !settings.notificationsEnabled })} color="bg-blue-500" />
                  </div>

                  {/* Vibration */}
                  <div className="flex items-center justify-between p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3">
                      <Smartphone size={16} className={settings.vibrationEnabled ? 'text-purple-400' : ''} style={!settings.vibrationEnabled ? { color: 'var(--text-muted)' } : {}} />
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Vibración</span>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Vibrar al alerta cercana</p>
                      </div>
                    </div>
                    <ToggleSwitch enabled={settings.vibrationEnabled} onChange={() => updateSettings({ vibrationEnabled: !settings.vibrationEnabled })} color="bg-purple-500" />
                  </div>

                  {/* Alert radius */}
                  <div className="p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Radio size={16} style={{ color: 'var(--danger)' }} />
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Radio de alerta</span>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Distancia para alerta automática</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-3">
                      <input type="range" min="0.5" max="20" step="0.5"
                        value={settings.autoAlertRadius}
                        onChange={(e) => updateSettings({ autoAlertRadius: parseFloat(e.target.value) })}
                        className="flex-1 accent-red-500 h-1" />
                      <span className="text-sm font-bold w-14 text-right" style={{ color: 'var(--danger)' }}>
                        {settings.autoAlertRadius} km
                      </span>
                    </div>
                  </div>

                  {/* Alert Expiry */}
                  <div className="p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 mb-3">
                      <Clock size={16} style={{ color: 'var(--warning)' }} />
                      <div>
                        <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Expiración de alertas</span>
                        <p className="text-[9px]" style={{ color: 'var(--text-muted)' }}>Duración antes de borrar</p>
                      </div>
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {EXPIRY_OPTIONS.map(opt => (
                        <button key={opt.value}
                          onClick={() => updateSettings({ alertExpiryMinutes: opt.value })}
                          className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all border"
                          style={{
                            background: (settings.alertExpiryMinutes || 60) === opt.value ? 'var(--accent-glow)' : 'transparent',
                            borderColor: (settings.alertExpiryMinutes || 60) === opt.value ? 'var(--accent)' : 'var(--border)',
                            color: (settings.alertExpiryMinutes || 60) === opt.value ? 'var(--accent)' : 'var(--text-secondary)',
                          }}>
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Map Settings Section */}
            <div className="p-3">
              <button onClick={() => toggleSection('map')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}>
                <Compass size={18} />
                <span className="text-sm font-medium flex-1 text-left">Mapa</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${activeSection === 'map' ? 'rotate-90' : ''}`} />
              </button>

              {activeSection === 'map' && (
                <div className="mt-2 px-2 space-y-3 animate-fadeIn">
                  <div className="p-3 rounded-xl" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="flex items-center gap-3 mb-2">
                      <Layers size={16} style={{ color: 'var(--accent)' }} />
                      <span className="text-xs font-medium" style={{ color: 'var(--text-primary)' }}>Capa por defecto</span>
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {['standard', 'satellite', 'terrain', 'dark'].map(layer => (
                        <button key={layer}
                          onClick={() => updateSettings({ defaultMapLayer: layer })}
                          className="px-2 py-1.5 rounded-lg text-xs font-medium transition-all border capitalize"
                          style={{
                            background: (settings.defaultMapLayer || 'standard') === layer ? 'var(--accent-glow)' : 'transparent',
                            borderColor: (settings.defaultMapLayer || 'standard') === layer ? 'var(--accent)' : 'var(--border)',
                            color: (settings.defaultMapLayer || 'standard') === layer ? 'var(--accent)' : 'var(--text-secondary)',
                          }}>
                          {layer === 'standard' ? '🗺️ Normal' : layer === 'satellite' ? '🛰️ Satélite' : layer === 'terrain' ? '⛰️ Relieve' : '🌑 Oscuro'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* About Section */}
            <div className="p-3">
              <button onClick={() => toggleSection('about')}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all hover:bg-white/5"
                style={{ color: 'var(--text-secondary)' }}>
                <Info size={18} />
                <span className="text-sm font-medium flex-1 text-left">Acerca de</span>
                <ChevronRight size={14} className={`transition-transform duration-200 ${activeSection === 'about' ? 'rotate-90' : ''}`} />
              </button>

              {activeSection === 'about' && (
                <div className="mt-2 px-2 animate-fadeIn">
                  <div className="p-4 rounded-xl text-center" style={{ background: 'var(--bg-card)', border: '1px solid var(--border)' }}>
                    <div className="w-14 h-14 mx-auto rounded-2xl flex items-center justify-center mb-3 shadow-lg"
                      style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` }}>
                      <Shield size={28} className="text-white" />
                    </div>
                    <h4 className="font-bold text-sm" style={{ color: 'var(--text-primary)' }}>MinerAlert</h4>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>v2.0 • Puerto Maldonado, Perú</p>
                    <p className="text-[10px] mt-2 leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
                      App de seguridad comunitaria para mineros. Alertas en tiempo real, GPS, y comunicación.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Logout at bottom */}
          <div className="shrink-0 p-4" style={{ borderTop: '1px solid var(--border)' }}>
            <button onClick={() => { signOut(); onClose() }}
              className="w-full flex items-center justify-center gap-2 p-3 rounded-xl font-bold text-sm transition-all active:scale-95"
              style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>
              <LogOut size={16} />
              Cerrar Sesión
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
