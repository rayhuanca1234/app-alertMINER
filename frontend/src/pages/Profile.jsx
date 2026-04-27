import React, { useState } from 'react'
import { useAuthStore } from '../store/authStore'
import { useAlertStore } from '../store/alertStore'
import { LogOut, User, Shield, ChevronRight, Camera, Save, X, Loader2, Bell } from 'lucide-react'
import { supabase } from '../lib/supabase'
import InboxPanel from '../components/InboxPanel'

export default function Profile() {
  const { user, profile, updateProfile, signOut } = useAuthStore()
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(profile?.name || '')
  const [phone, setPhone] = useState(profile?.phone || '')
  const [saving, setSaving] = useState(false)
  const [uploadingAvatar, setUploadingAvatar] = useState(false)

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ name, phone })
    setEditing(false)
    setSaving(false)
  }

  const initials = (profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploadingAvatar(true)
    const fileExt = file.name.split('.').pop()
    const filePath = `avatars/${user.id}_${Date.now()}.${fileExt}`

    try {
      const { error: uploadError } = await supabase.storage
        .from('chat-media')
        .upload(filePath, file, { upsert: true })

      if (uploadError) throw uploadError

      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath)
      await updateProfile({ avatar_url: data.publicUrl })
    } catch (err) {
      alert('Error subiendo foto: ' + err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  return (
    <div className="p-4 overflow-y-auto h-full space-y-4 pb-24">
      {/* Profile Card */}
      <div className="rounded-2xl p-6 relative overflow-hidden"
        style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
        {/* Background decoration */}
        <div className="absolute top-0 right-0 w-32 h-32 rounded-full -translate-y-1/2 translate-x-1/2"
          style={{ background: 'var(--accent-glow)' }} />

        <div className="flex items-center gap-4 relative z-10">
          <div className="relative group cursor-pointer" onClick={() => document.getElementById('avatar-upload').click()}>
            <input type="file" id="avatar-upload" className="hidden" accept="image/*" onChange={handleAvatarUpload} disabled={uploadingAvatar} />

            {uploadingAvatar ? (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center bg-slate-800/50">
                <Loader2 size={24} className="animate-spin text-white" />
              </div>
            ) : profile?.avatar_url ? (
              <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="w-16 h-16 rounded-2xl object-cover ring-2 transition-opacity group-hover:opacity-75"
                style={{ '--tw-ring-color': 'var(--accent)' }} />
            ) : (
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold text-white shadow-lg transition-opacity group-hover:opacity-75"
                style={{ background: `linear-gradient(135deg, var(--gradient-start), var(--gradient-end))` }}>
                {initials}
              </div>
            )}

            {!uploadingAvatar && (
              <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/40 rounded-2xl">
                <Camera size={20} className="text-white" />
              </div>
            )}
          </div>
          <div className="flex-1">
            {editing ? (
              <input value={name} onChange={(e) => setName(e.target.value)}
                className="rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 w-full"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)', '--tw-ring-color': 'var(--accent-glow)' }} />
            ) : (
              <h2 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{profile?.name || 'Sin nombre'}</h2>
            )}
            <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{user?.email}</p>
            {profile?.is_verified && (
              <span className="inline-flex items-center gap-1 text-[10px] text-emerald-400 font-bold mt-1 bg-emerald-500/10 px-2 py-0.5 rounded-full">
                <Shield size={10} /> Verificado
              </span>
            )}
          </div>
        </div>

        {editing ? (
          <div className="mt-4 space-y-3 relative z-10">
            <div>
              <label className="text-xs mb-1 block" style={{ color: 'var(--text-muted)' }}>Teléfono</label>
              <input value={phone} onChange={(e) => setPhone(e.target.value)}
                placeholder="+51 999 999 999"
                className="w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2"
                style={{ background: 'var(--bg-input)', border: '1px solid var(--border)', color: 'var(--text-primary)' }} />
            </div>
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving}
                className="flex-1 flex items-center justify-center gap-2 text-white py-2 rounded-xl font-bold text-sm transition-colors disabled:opacity-50"
                style={{ background: 'var(--accent)' }}>
                <Save size={14} />
                {saving ? 'Guardando...' : 'Guardar'}
              </button>
              <button onClick={() => setEditing(false)}
                className="px-4 py-2 rounded-xl text-sm transition-colors flex items-center gap-1"
                style={{ background: 'var(--bg-card)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }}>
                <X size={14} /> Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button onClick={() => { setEditing(true); setName(profile?.name || ''); setPhone(profile?.phone || '') }}
            className="mt-4 text-sm font-medium transition-colors relative z-10 flex items-center gap-1"
            style={{ color: 'var(--accent)' }}>
            Editar perfil <ChevronRight size={14} />
          </button>
        )}
      </div>



      {/* Notifications Inbox */}
      <div className="h-96">
        <InboxPanel />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-2xl font-black" style={{ color: 'var(--accent)' }}>
            {useAlertStore.getState().alerts.filter(a => a.is_active).length}
          </div>
          <div className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>Alertas Activas</div>
        </div>
        <div className="rounded-2xl p-4 text-center" style={{ background: 'var(--bg-secondary)', border: '1px solid var(--border)' }}>
          <div className="text-2xl font-black" style={{ color: 'var(--success, #22c55e)' }}>✓</div>
          <div className="text-[10px] font-medium mt-1" style={{ color: 'var(--text-muted)' }}>GPS Activo</div>
        </div>
      </div>

      {/* Logout */}
      <button onClick={() => signOut()}
        className="w-full flex items-center justify-center gap-2 p-4 rounded-2xl font-bold transition-all active:scale-[0.98]"
        style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', color: 'var(--danger)' }}>
        <LogOut size={18} />
        Cerrar Sesión
      </button>

      <p className="text-center text-[10px] pb-4" style={{ color: 'var(--text-muted)' }}>
        MinerAlert v2.0 • Puerto Maldonado, Perú
      </p>
    </div>
  )
}
