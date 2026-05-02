import './Profile.css'
import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAlertStore } from '../store/alertStore'
import { 
  LogOut, UserPlus, Menu, Lock, Mail, Play, Plus, 
  Grid, Bookmark, Heart, MoreHorizontal, Settings, Edit2 
} from 'lucide-react'
import { supabase } from '../lib/supabase'
import InboxPanel from '../components/InboxPanel'

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuthStore()
  const [activeTab, setActiveTab] = useState('grid') // 'grid' | 'inbox' | 'saved'
  const [editing, setEditing] = useState(false)
  
  // Profile Form States
  const [name, setName] = useState(profile?.name || '')
  const [bio, setBio] = useState(profile?.bio || 'Aprovecha la vida que el tiempo nos gana')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  // Stats mockups based on user request (TikTok style)
  const stats = {
    following: '643',
    followers: '146,6 mil',
    likes: '566,2 mil'
  }

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ name, bio }) // ensure your backend accepts 'bio'
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

  // Mock grid data for visual realistic TikTok look
  const mockGrid = [
    { id: 1, views: '12k', img: 'https://images.unsplash.com/photo-1518791841217-8f162f1e1131?auto=format&fit=crop&w=300&q=80' },
    { id: 2, views: '3.4k', img: 'https://images.unsplash.com/photo-1542314831-c6a4d1409362?auto=format&fit=crop&w=300&q=80' },
    { id: 3, views: '890', img: 'https://images.unsplash.com/photo-1493612276216-ee3925520721?auto=format&fit=crop&w=300&q=80' },
    { id: 4, views: '5.1k', img: 'https://images.unsplash.com/photo-1507525428034-b723cf961d3e?auto=format&fit=crop&w=300&q=80' },
    { id: 5, views: '11k', img: 'https://images.unsplash.com/photo-1472214103451-9374bd1c798e?auto=format&fit=crop&w=300&q=80' },
    { id: 6, views: '2.2k', img: 'https://images.unsplash.com/photo-1511300636408-a63a89df3482?auto=format&fit=crop&w=300&q=80' },
  ]

  return (
    <div className="profile-container animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="profile-header">
        <div style={{ width: 24 }} /> {/* Spacer */}
        <h1 className="profile-username">
          {profile?.name || 'MinerAlert'}
          <span className="text-[10px] bg-emerald-500/20 text-emerald-500 px-1.5 rounded">PRO</span>
        </h1>
        <div className="profile-header-actions">
          <Settings size={22} className="cursor-pointer" onClick={() => signOut()} />
          <Menu size={22} className="cursor-pointer" />
        </div>
      </div>

      {/* ── Main Info: Stats & Avatar ── */}
      <div className="profile-info-section">
        <div className="profile-stats-avatar-row">
          <div className="profile-stats">
            <div className="profile-stat-item">
              <span className="profile-stat-value">{stats.following}</span>
              <span className="profile-stat-label">Siguiendo</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-value">{stats.followers}</span>
              <span className="profile-stat-label">Seguidores</span>
            </div>
            <div className="profile-stat-item">
              <span className="profile-stat-value">{stats.likes}</span>
              <span className="profile-stat-label">Me gusta</span>
            </div>
          </div>
          
          <div className="profile-avatar-container">
            <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />
            <div className="w-full h-full relative cursor-pointer" onClick={() => document.getElementById('avatar-upload').click()}>
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
            <div className="space-y-2 mt-2">
              <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ring-blue-500" />
              <input value={bio} onChange={e => setBio(e.target.value)} placeholder="Tu biografía" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ring-blue-500" />
              <div className="flex gap-2">
                <button onClick={handleSave} className="flex-1 bg-blue-600 text-white py-1.5 rounded-lg text-sm font-bold">Guardar</button>
                <button onClick={() => setEditing(false)} className="flex-1 bg-slate-800 border border-slate-700 py-1.5 rounded-lg text-sm font-bold">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-handle">@{handleStr}</div>
              <div className="profile-bio">{profile?.bio || 'Aprovecha la vida que el tiempo nos gana'}</div>
              <div className="profile-email"><Mail size={12} /> {user?.email}</div>
              
              <div className="profile-actions-row">
                <button className="profile-action-btn" onClick={() => setEditing(true)}>Editar perfil</button>
                <button className="profile-action-btn">Añadir amigos</button>
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
          <div className="profile-grid">
            {mockGrid.map((item) => (
              <div key={item.id} className="profile-grid-item group">
                <img src={item.img} alt="" className="profile-grid-img" loading="lazy" />
                <div className="profile-grid-views">
                  <Play size={10} fill="currentColor" /> {item.views}
                </div>
                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors" />
              </div>
            ))}
          </div>
        )}

        {activeTab === 'saved' && (
          <div className="flex flex-col items-center justify-center p-12 text-center opacity-60">
            <Lock size={48} className="mb-4 stroke-[1]" />
            <h3 className="font-bold text-lg mb-1">Solo tú puedes ver esto</h3>
            <p className="text-sm">Tus alertas guardadas aparecerán aquí.</p>
          </div>
        )}

        {activeTab === 'inbox' && (
          <div className="h-full border-t border-[var(--border)]">
            <InboxPanel />
          </div>
        )}
      </div>

    </div>
  )
}
