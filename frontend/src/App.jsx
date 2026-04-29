import React, { useEffect, useState } from 'react'
import { Routes, Route, Navigate, useNavigate } from 'react-router-dom'
import { useAuthStore } from './store/authStore'
import { useThemeStore } from './store/themeStore'
import { useAlerts } from './hooks/useAlerts'
import { useNotificationStore } from './store/notificationStore'
import { supabase } from './lib/supabase'
import BottomNav from './components/BottomNav'
import SideDrawer from './components/SideDrawer'
import Home from './pages/Home'
import Chat from './pages/Chat'
import Alert from './pages/Alert'
import MapView from './pages/Map'
import Profile from './pages/Profile'
import Login from './pages/Login'
import Register from './pages/Register'
import About from './pages/About'
import { socket } from './lib/socket'
import { Loader2, Menu, Bell } from 'lucide-react'

const PrivateRoute = ({ children }) => {
  const { user, loading } = useAuthStore()
  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center" style={{ background: 'var(--bg-primary)' }}>
        <div className="flex flex-col items-center gap-4">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center shadow-lg animate-pulse"
            style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` }}>
            <svg className="w-7 h-7 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>
          </div>
          <Loader2 className="animate-spin" size={24} style={{ color: 'var(--accent)' }} />
          <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>Cargando MinerAlert...</span>
        </div>
      </div>
    )
  }
  return user ? children : <Navigate to="/login" />
}

export default function App() {
  const { initialize, user } = useAuthStore()
  const { initTheme } = useThemeStore()
  const { fetchNotifications, addNotificationLocally, activeToast, hideToast } = useNotificationStore()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const navigate = useNavigate()

  useEffect(() => {
    initialize()
    initTheme()
  }, [initialize, initTheme])

  useEffect(() => {
    if (user) {
      // socket.connect()
      
      // Fetch initial notifications
      fetchNotifications(user.id)
      
      // Listen for system notifications via Broadcast
      const notifChannel = supabase.channel('global-notifications', {
        config: { broadcast: { ack: true } }
      })
        .on('broadcast', { event: 'new_notification' }, (payload) => {
          if (payload.payload?.sender_id !== user.id) {
            addNotificationLocally(payload.payload)
          }
        })
        .subscribe()
        
      useNotificationStore.getState().setGlobalChannel(notifChannel)
      
      // Listen for broadcast alerts from other users via socket
      // socket.on('new_alert', (alertData) => {
      //   console.log('New alert received via socket:', alertData)
      // })

      return () => {
        // socket.off('new_alert')
        // socket.disconnect()
        supabase.removeChannel(notifChannel)
      }
    }
  }, [user, fetchNotifications, addNotificationLocally])

  const handleToastClick = () => {
    hideToast()
    if (activeToast?.type === 'alert') {
      navigate('/map')
    } else if (activeToast?.type === 'chat') {
      navigate('/chat')
    }
  }

  return (
    <div className="flex flex-col h-screen font-sans"
      style={{ background: 'var(--bg-primary)', color: 'var(--text-primary)' }}>
      
      {/* Menu button (hamburger) — visible when logged in */}
      {user && (
        <button
          onClick={() => setDrawerOpen(true)}
          className="fixed top-3 left-3 z-[100] p-2 rounded-xl shadow-lg transition-all active:scale-90"
          style={{
            background: 'var(--glass)',
            backdropFilter: 'blur(12px)',
            border: '1px solid var(--border)',
            color: 'var(--text-secondary)',
          }}
          title="Menú"
        >
          <Menu size={20} />
        </button>
      )}

      {/* Side Drawer */}
      {user && (
        <SideDrawer
          isOpen={drawerOpen}
          onClose={() => setDrawerOpen(false)}
        />
      )}

      {/* WhatsApp-style In-App Notification Toast */}
      {activeToast && (
        <div className="fixed top-4 left-4 right-4 z-[9999] flex justify-center pointer-events-none animate-in slide-in-from-top-4 fade-in duration-300">
          <div 
            onClick={handleToastClick}
            className="pointer-events-auto max-w-sm w-full bg-[var(--bg-card)] border border-[var(--border)] shadow-2xl rounded-2xl p-4 flex gap-3 cursor-pointer hover:scale-[1.02] active:border-red-500 transition-all"
            style={{ backdropFilter: 'blur(16px)' }}
          >
            {activeToast.iconUrl ? (
              <img src={activeToast.iconUrl} alt="icon" referrerPolicy="no-referrer" className="w-10 h-10 rounded-full object-cover shrink-0 border border-[var(--border)]" />
            ) : (
              <div className="w-10 h-10 rounded-full bg-[var(--accent)]/20 flex items-center justify-center shrink-0">
                <Bell size={20} className="text-[var(--accent)]" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-[var(--text-primary)] truncate">{activeToast.title}</p>
              <p className="text-xs text-[var(--text-secondary)] line-clamp-2 mt-0.5">{activeToast.body}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); hideToast(); }}
              className="shrink-0 text-[var(--text-muted)] hover:text-[var(--text-primary)] p-1"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="18" y1="6" x2="6" y2="18"></line><line x1="6" y1="6" x2="18" y2="18"></line></svg>
            </button>
          </div>
        </div>
      )}

      <main className="flex-1 overflow-hidden">
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<PrivateRoute><Home /></PrivateRoute>} />
          <Route path="/chat" element={<PrivateRoute><Chat /></PrivateRoute>} />
          <Route path="/alert" element={<PrivateRoute><Alert /></PrivateRoute>} />
          <Route path="/map" element={<PrivateRoute><MapView /></PrivateRoute>} />
          <Route path="/profile" element={<PrivateRoute><Profile /></PrivateRoute>} />
          <Route path="/about" element={<PrivateRoute><About /></PrivateRoute>} />
        </Routes>
      </main>
      {user && <BottomNav />}
    </div>
  )
}
