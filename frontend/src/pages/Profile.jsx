import './Profile.css'
import React, { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAlertStore } from '../store/alertStore'
import { 
  LogOut, UserPlus, Menu, Lock, Mail, Play, Plus, 
  Grid, Bookmark, Heart, MoreHorizontal, Settings, Edit2, Loader2 
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import InboxPanel from '../components/InboxPanel'
import TikTokViewer from '../components/TikTokViewer'
import ProfileDrawer from '../components/ProfileDrawer'

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuthStore()
  const [activeTab, setActiveTab] = useState('grid') // 'grid' | 'saved' | 'inbox'
  const [editing, setEditing] = useState(false)
  
  // Profile Form States
  const [name, setName] = useState(profile?.name || '')
  const [bio, setBio] = useState(profile?.bio || 'Aprovecha la vida que el tiempo nos gana')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)
  
  // UI States
  const [isDrawerOpen, setIsDrawerOpen] = useState(false)
  const [isViewerOpen, setIsViewerOpen] = useState(false)
  const [selectedMediaIndex, setSelectedMediaIndex] = useState(0)

  // Media Pagination States
  const [userMedia, setUserMedia] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const observerTarget = useRef(null)

  // Format numbers (e.g., 1500 -> 1.5k)
  const formatStat = (num) => {
    if (!num) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toString()
  }

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ name, bio })
    setEditing(false)
    setSaving(false)
  }

  const initials = (profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()
  const handleStr = profile?.name ? profile.name.toLowerCase().replace(/\s+/g, '') + (user?.id?.slice(0,4) || '') : 'usuario'

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `avatars/${user.id}_${Date.now()}.${fileExt}`
    try {
      const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file, { upsert: true })
      if (uploadError) throw uploadError
      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath)
      await updateProfile({ avatar_url: data.publicUrl })
    } catch (err) {
      alert('Error subiendo foto: ' + err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const fetchUserMedia = async (pageNum = 0) => {
    if (loadingMedia || (!hasMore && pageNum > 0)) return
    setLoadingMedia(true)
    const limit = 9
    const from = pageNum * limit
    const to = from + limit - 1

    try {
      const { data, error } = await supabase
        .from('messages')
        .select('id, type, media_url, media_urls, created_at, views')
        .eq('user_id', user.id)
        .in('type', ['IMAGE', 'VIDEO', 'MULTIPLE_MEDIA'])
        .order('created_at', { ascending: false })
        .range(from, to)

      if (error) throw error

      if (data) {
        const extracted = []
        data.forEach(msg => {
          if (msg.type === 'MULTIPLE_MEDIA' && msg.media_urls) {
            msg.media_urls.forEach((url, i) => {
              extracted.push({ 
                id: `${msg.id}-${i}`, 
                url, 
                isVideo: url.includes('.mp4') || url.includes('.webm') || url.includes('video'),
                views: msg.views || 0
              })
            })
          } else if (msg.media_url) {
            extracted.push({ 
              id: msg.id, 
              url: msg.media_url, 
              isVideo: msg.type === 'VIDEO',
              views: msg.views || 0
            })
          }
        })
        
        if (data.length < limit) setHasMore(false)
        setUserMedia(prev => pageNum === 0 ? extracted : [...prev, ...extracted])
        setPage(pageNum + 1)
      }
    } catch (err) {
      console.error('Error fetching media:', err)
    } finally {
      setLoadingMedia(false)
    }
  }

  // Cargar medios al cambiar a pestaña grid o saved
  useEffect(() => {
    if (user && (activeTab === 'grid' || activeTab === 'saved')) {
      if (userMedia.length === 0) fetchUserMedia(0)
    }
  }, [user, activeTab])

  // Infinite Scroll Observer para el Grid
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting && hasMore && !loadingMedia) {
          fetchUserMedia(page)
        }
      },
      { threshold: 0.1 }
    )

    if (observerTarget.current) {
      observer.observe(observerTarget.current)
    }

    return () => observer.disconnect()
  }, [hasMore, loadingMedia, page])

  return (
    <div className="profile-container animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="profile-header">
        <div style={{ width: 24 }} /> {/* Spacer */}
        <h1 className="profile-username">
          {profile?.name || 'MinerAlert'}
          <span className="text-[10px] bg-emerald-500/20 text-emerald-400 px-1.5 py-0.5 rounded uppercase">PRO</span>
        </h1>
        <div className="profile-header-actions">
          <Settings size={22} className="cursor-pointer" onClick={() => setIsDrawerOpen(true)} />
          <Menu size={22} className="cursor-pointer" onClick={() => setIsDrawerOpen(true)} />
        </div>
      </div>

      {/* ── Main Info: Stats & Avatar ── */}
      <div className="profile-info-section">
        <div className="profile-stats-avatar-row">
          <div className="profile-stats">
            <div className="profile-stat-item">
              <span className="profile-stat-value">{formatStat(profile?.following_count)}</span>
              <span className="profile-stat-label">Siguiendo</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-value">{formatStat(profile?.followers_count)}</span>
              <span className="profile-stat-label">Seguidores</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-value">{formatStat(profile?.likes_count)}</span>
              <span className="profile-stat-label">Me gusta</span>
            </div>
          </div>
          
          <div className="profile-avatar-container">
            <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            <div className="w-full h-full relative cursor-pointer" onClick={() => document.getElementById('avatar-upload').click()}>
              {uploadingAvatar ? (
                <div className="absolute inset-0 flex items-center justify-center bg-black/50 rounded-full z-10">
                  <Loader2 size={24} className="animate-spin text-white" />
                </div>
              ) : null}
              {profile?.avatar_url ? (
                <img src={profile.avatar_url} alt="" className="profile-avatar" referrerPolicy="no-referrer" />
              ) : (
                <div className="profile-avatar-placeholder">{initials}</div>
              )}
              <div className="profile-avatar-add"><Plus size={16} strokeWidth={3} /></div>
            </div>
          </div>
        </div>

        {/* ── Bio & Handle ── */}
        <div className="profile-bio-section">
          {editing ? (
            <div className="space-y-3 mt-2 relative z-10">
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Nombre</label>
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ring-blue-500 mt-1" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Biografía</label>
                <input value={bio} onChange={e => setBio(e.target.value)} placeholder="Tu biografía" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ring-blue-500 mt-1" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="flex-1 flex justify-center bg-blue-600 text-white py-2 rounded-lg text-sm font-bold transition active:scale-95 disabled:opacity-50">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)} className="flex-1 bg-slate-800 border border-slate-700 py-2 rounded-lg text-sm font-bold transition active:scale-95">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-handle">@{handleStr}</div>
              <div className="profile-bio">{profile?.bio || 'Aprovecha la vida que el tiempo nos gana'}</div>
              <div className="profile-email"><Mail size={12} /> {user?.email}</div>
              
              <div className="profile-actions-row">
                <button className="profile-action-btn" onClick={() => setEditing(true)}>Editar perfil</button>
                <button className="profile-action-btn flex items-center gap-1 justify-center"><UserPlus size={14}/> Añadir amigos</button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="profile-tabs">
        <div className={`profile-tab ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')}>
          <Grid size={20} strokeWidth={activeTab === 'grid' ? 2.5 : 1.5} />
        </div>
        <div className={`profile-tab ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')}>
          <Lock size={20} strokeWidth={activeTab === 'saved' ? 2.5 : 1.5} />
        </div>
        <div className={`profile-tab ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')}>
          <Mail size={20} strokeWidth={activeTab === 'inbox' ? 2.5 : 1.5} />
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="profile-content min-h-[400px]">
        {activeTab === 'grid' && (
          <div>
            <div className="profile-grid">
              {userMedia.map((item, index) => (
                <div 
                  key={item.id} 
                  className="profile-grid-item group cursor-pointer"
                  onClick={() => { setSelectedMediaIndex(index); setIsViewerOpen(true); }}
                >
                  {item.isVideo ? (
                    <video src={item.url} className="profile-grid-img opacity-80" muted playsInline />
                  ) : (
                    <img src={item.url} alt="" className="profile-grid-img" loading="lazy" />
                  )}
                  <div className="profile-grid-views">
                    <Play size={10} fill="currentColor" /> {item.views}
                  </div>
                  <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
                </div>
              ))}
            </div>
            {hasMore && userMedia.length > 0 && (
              <div ref={observerTarget} className="p-8 flex justify-center w-full">
                {loadingMedia && <Loader2 size={24} className="animate-spin text-slate-500" />}
              </div>
            )}
            {!loadingMedia && userMedia.length === 0 && (
              <div className="text-center p-12 text-slate-500 text-sm">No tienes archivos en tu grid.</div>
            )}
          </div>
        )}

        {activeTab === 'saved' && (
          <div>
            <div className="p-4 text-center">
              <Lock size={32} className="mx-auto mb-2 opacity-50 stroke-[1.5]" />
              <h3 className="font-bold text-sm">Solo tú puedes ver esto</h3>
              <p className="text-xs text-slate-400 mt-1">Archivos que tú subiste (Media Privada)</p>
            </div>
            <div className="profile-grid">
              {userMedia.map((item, index) => (
                <div 
                  key={`priv-${item.id}`} 
                  className="profile-grid-item group cursor-pointer"
                  onClick={() => { setSelectedMediaIndex(index); setIsViewerOpen(true); }}
                >
                  {item.isVideo ? (
                    <video src={item.url} className="profile-grid-img opacity-80" muted playsInline />
                  ) : (
                    <img src={item.url} alt="" className="profile-grid-img" loading="lazy" />
                  )}
                  <div className="profile-grid-views">
                    <Play size={10} fill="currentColor" /> {item.views}
                  </div>
                </div>
              ))}
            </div>
            {hasMore && userMedia.length > 0 && (
              <div ref={observerTarget} className="p-8 flex justify-center w-full">
                {loadingMedia && <Loader2 size={24} className="animate-spin text-slate-500" />}
              </div>
            )}
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="h-full border-t border-[var(--border)]">
            <InboxPanel />
          </div>
        )}
      </div>

      {/* Drawer & Viewer Overlays */}
      <ProfileDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)} />
      
      {isViewerOpen && (
        <TikTokViewer 
          mediaList={userMedia} 
          initialIndex={selectedMediaIndex} 
          onClose={() => setIsViewerOpen(false)} 
          onLoadMore={() => {
            if (hasMore && !loadingMedia) fetchUserMedia(page)
          }}
          hasMore={hasMore}
        />
      )}
    </div>
  )
}
