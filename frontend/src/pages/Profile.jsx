import './Profile.css'
import React, { useState, useEffect, useRef } from 'react'
import { useAuthStore } from '../store/authStore'
import { fetchWithAuth } from '../lib/auth_client'
import { uploadFileToR2 } from '../lib/cloudflare_client'
import { 
  Menu, Lock, Mail, Play, Plus, Grid, Settings, Loader2,
  Key, Copy, Trash2, Check, Sparkles, Share2, Cpu, Crown, ExternalLink, RefreshCw
} from 'lucide-react'
import InboxPanel from '../components/InboxPanel'
import TikTokViewer from '../components/TikTokViewer'
import ProfileDrawer from '../components/ProfileDrawer'

export default function Profile() {
  const { user, profile, updateProfile, fetchProfile } = useAuthStore()
  const [activeTab, setActiveTab] = useState('grid') // 'grid' | 'apikeys' | 'tools' | 'saved' | 'inbox'
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

  // Subscription & Quota States (Módulo 6)
  const [subStatus, setSubStatus] = useState(null)
  const [loadingSub, setLoadingSub] = useState(false)

  // API Keys States (Módulo 2, 3, 7 — fr_...)
  const [apiKeys, setApiKeys] = useState([])
  const [loadingKeys, setLoadingKeys] = useState(false)
  const [newKeyName, setNewKeyName] = useState('My API Key')
  const [newKeyExp, setNewKeyExp] = useState('Never')
  const [creatingKey, setCreatingKey] = useState(false)
  const [copiedKeyId, setCopiedKeyId] = useState(null)

  // Connected Tools, Env Keys & Social Shares States (Módulo 7)
  const [envKeys, setEnvKeys] = useState({})
  const [envInputs, setEnvInputs] = useState({})
  const [savingEnv, setSavingEnv] = useState(false)
  const [shares, setShares] = useState({ owned_shares: [], received_shares: [] })
  const [shareEmail, setShareEmail] = useState('')
  const [sharePlatform, setSharePlatform] = useState('TikTok')
  const [shareAccountName, setShareAccountName] = useState('Cuenta Principal')
  const [sharingLoading, setSharingLoading] = useState(false)

  // Media & R2 Projects States
  const [userMedia, setUserMedia] = useState([])
  const [r2Projects, setR2Projects] = useState([])
  const [loadingMedia, setLoadingMedia] = useState(false)
  const [page, setPage] = useState(0)
  const [hasMore, setHasMore] = useState(true)
  const observerTarget = useRef(null)

  useEffect(() => {
    if (profile?.name) setName(profile.name)
    if (profile?.bio) setBio(profile.bio)
  }, [profile?.name, profile?.bio])

  const formatStat = (num) => {
    if (!num) return '0'
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toString()
  }

  // Cargar estado de suscripción y cuota mensual desde Cloudflare D1
  const loadSubscriptionAndQuota = async () => {
    setLoadingSub(true)
    try {
      const res = await fetchWithAuth('/api/subscription/status', { redirectOn401: false })
      if (res.ok) {
        const data = await res.json()
        setSubStatus(data)
      }
    } catch (e) {
      console.error('Error loading subscription:', e)
    } finally {
      setLoadingSub(false)
    }
  }

  // Cargar API Keys fr_... desde Cloudflare D1
  const loadApiKeys = async () => {
    setLoadingKeys(true)
    try {
      const res = await fetchWithAuth('/api/user/apikeys', { redirectOn401: false })
      if (res.ok) {
        const data = await res.json()
        setApiKeys(data.keys || [])
      }
    } catch (e) {
      console.error('Error loading API keys:', e)
    } finally {
      setLoadingKeys(false)
    }
  }

  // Cargar llaves IA en caliente y cuentas compartidas
  const loadToolsAndShares = async () => {
    try {
      const [envRes, shareRes, projRes] = await Promise.all([
        fetchWithAuth('/api/env-keys', { redirectOn401: false }),
        fetchWithAuth('/api/social/shares', { redirectOn401: false }),
        fetchWithAuth('/api/user/projects', { redirectOn401: false })
      ])
      if (envRes.ok) {
        const d = await envRes.json()
        setEnvKeys(d.keys || {})
      }
      if (shareRes.ok) {
        const s = await shareRes.json()
        setShares(s)
      }
      if (projRes.ok) {
        const p = await projRes.json()
        setR2Projects(p.projects || [])
      }
    } catch (e) {
      console.error('Error loading tools:', e)
    }
  }

  useEffect(() => {
    if (user) {
      loadSubscriptionAndQuota()
      loadApiKeys()
    }
  }, [user?.id])

  useEffect(() => {
    if (activeTab === 'apikeys') loadApiKeys()
    if (activeTab === 'tools' || activeTab === 'saved') loadToolsAndShares()
  }, [activeTab])

  const handleCreateApiKey = async (e) => {
    e.preventDefault()
    if (creatingKey) return
    setCreatingKey(true)
    try {
      const res = await fetchWithAuth('/api/user/apikeys', {
        method: 'POST',
        body: JSON.stringify({ name: newKeyName || 'My API Key', expires_at: newKeyExp })
      })
      if (res.ok) {
        const { key } = await res.json()
        setApiKeys(prev => [key, ...prev])
        setNewKeyName('My API Key')
      }
    } catch (e) {
      alert('Error creando API Key: ' + e.message)
    } finally {
      setCreatingKey(false)
    }
  }

  const handleDeleteApiKey = async (keyId) => {
    try {
      const res = await fetchWithAuth(`/api/user/apikeys/${keyId}`, { method: 'DELETE' })
      if (res.ok) {
        setApiKeys(prev => prev.filter(k => k.id !== keyId))
      }
    } catch (e) {
      alert('Error eliminando API Key: ' + e.message)
    }
  }

  const handleCopyKey = (keyStr, id) => {
    navigator.clipboard.writeText(keyStr)
    setCopiedKeyId(id)
    setTimeout(() => setCopiedKeyId(null), 2000)
  }

  const handleUpgradePlan = async (planName) => {
    try {
      const res = await fetchWithAuth('/api/subscription/create-checkout', {
        method: 'POST',
        body: JSON.stringify({ plan: planName })
      })
      const data = await res.json()
      if (data.sandbox_activated) {
        await loadSubscriptionAndQuota()
        await fetchProfile()
        alert(`Plan ${planName.toUpperCase()} activado en Cloudflare D1`)
      } else if (data.checkout_url) {
        window.location.href = data.checkout_url
      }
    } catch (e) {
      alert('Error iniciando checkout: ' + e.message)
    }
  }

  const handleSaveEnvKeys = async (e) => {
    e.preventDefault()
    setSavingEnv(true)
    try {
      const res = await fetchWithAuth('/api/env-keys', {
        method: 'POST',
        body: JSON.stringify({ keys: envInputs })
      })
      if (res.ok) {
        setEnvInputs({})
        await loadToolsAndShares()
        await loadSubscriptionAndQuota()
        alert('✅ Variables guardadas en .env y recargadas en memoria en caliente.')
      }
    } catch (e) {
      alert('Error guardando llaves: ' + e.message)
    } finally {
      setSavingEnv(false)
    }
  }

  const handleShareAccount = async (e) => {
    e.preventDefault()
    if (!shareEmail.trim()) return
    setSharingLoading(true)
    try {
      const res = await fetchWithAuth('/api/social/shares', {
        method: 'POST',
        body: JSON.stringify({
          shared_with_email: shareEmail,
          platform: sharePlatform,
          account_name: shareAccountName
        })
      })
      if (res.ok) {
        setShareEmail('')
        await loadToolsAndShares()
      } else {
        const d = await res.json()
        alert(d.error || 'Error compartiendo cuenta')
      }
    } catch (e) {
      alert('Error: ' + e.message)
    } finally {
      setSharingLoading(false)
    }
  }

  const handleRemoveShare = async (shareId) => {
    await fetchWithAuth(`/api/social/shares/${shareId}`, { method: 'DELETE' })
    await loadToolsAndShares()
  }

  const handleDeleteProject = async (projectId) => {
    await fetchWithAuth(`/api/user/projects/${projectId}`, { method: 'DELETE' })
    await loadToolsAndShares()
    await loadSubscriptionAndQuota()
  }

  const handleSave = async () => {
    setSaving(true)
    await updateProfile({ name, bio })
    setEditing(false)
    setSaving(false)
  }

  const initials = (profile?.name || user?.email || 'U').slice(0, 2).toUpperCase()
  const handleStr = profile?.name ? profile.name.toLowerCase().replace(/\s+/g, '') + (user?.id?.slice(0, 4) || '') : 'usuario'

  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploadingAvatar(true)
    try {
      const uploaded = await uploadFileToR2(file, `avatar_${Date.now()}_${file.name}`)
      await updateProfile({ avatar_url: uploaded.publicUrl })
      await loadSubscriptionAndQuota()
    } catch (err) {
      alert('Error subiendo foto a Cloudflare R2: ' + err.message)
    } finally {
      setUploadingAvatar(false)
    }
  }

  const fetchUserMedia = async (pageNum = 0) => {
    if (loadingMedia || (!hasMore && pageNum > 0)) return
    setLoadingMedia(true)
    const limit = 9
    const offset = pageNum * limit

    try {
      const res = await fetchWithAuth(
        `/api/data/messages?user_id=${encodeURIComponent(user.id)}&types=IMAGE,VIDEO,MULTIPLE_MEDIA&limit=${limit}&offset=${offset}`,
        { redirectOn401: false }
      )
      if (!res.ok) throw new Error('Error consultando mensajes multimedia en D1')
      const { data } = await res.json()

      if (data) {
        const extracted = []
        data.forEach(msg => {
          if (msg.type === 'MULTIPLE_MEDIA' && Array.isArray(msg.media_urls)) {
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

  useEffect(() => {
    if (user && (activeTab === 'grid' || activeTab === 'saved')) {
      if (userMedia.length === 0) fetchUserMedia(0)
    }
  }, [user, activeTab])

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

  // Cálculo de barra de cuota mensual
  const isUnlimited = subStatus?.is_vip || subStatus?.videos_limit === -1
  const quotaUsed = Number(subStatus?.videos_used || 0)
  const quotaLimit = Number(subStatus?.videos_limit || 10)
  const quotaPercent = isUnlimited ? 100 : Math.min(100, Math.round((quotaUsed / Math.max(1, quotaLimit)) * 100))
  const planBadge = (subStatus?.plan || profile?.plan || 'free').toUpperCase()

  return (
    <div className="profile-container animate-fadeIn">
      {/* ── Top Header ── */}
      <div className="profile-header">
        <div style={{ width: 24 }} />
        <h1 className="profile-username">
          {profile?.name || 'MinerAlert'}
          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-extrabold ${
            subStatus?.is_vip || planBadge === 'PRO'
              ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
              : planBadge === 'CREATOR'
              ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
              : 'bg-slate-700 text-slate-300'
          }`}>
            {subStatus?.is_vip ? '👑 VIP PRO' : planBadge}
          </span>
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
              <span className="profile-stat-value">{formatStat(apiKeys.length)}</span>
              <span className="profile-stat-label">API Keys</span>
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
                <input value={name} onChange={e => setName(e.target.value)} placeholder="Tu nombre" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ring-blue-500 mt-1 text-white" />
              </div>
              <div>
                <label className="text-[10px] text-slate-400 font-bold uppercase tracking-wider ml-1">Biografía</label>
                <input value={bio} onChange={e => setBio(e.target.value)} placeholder="Tu biografía" className="w-full bg-slate-800/50 border border-slate-700 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-1 ring-blue-500 mt-1 text-white" />
              </div>
              <div className="flex gap-2 pt-2">
                <button onClick={handleSave} disabled={saving} className="flex-1 flex justify-center bg-blue-600 text-white py-2 rounded-lg text-sm font-bold transition active:scale-95 disabled:opacity-50">
                  {saving ? <Loader2 size={18} className="animate-spin" /> : 'Guardar'}
                </button>
                <button onClick={() => setEditing(false)} className="flex-1 bg-slate-800 border border-slate-700 py-2 rounded-lg text-sm font-bold transition active:scale-95 text-white">Cancelar</button>
              </div>
            </div>
          ) : (
            <>
              <div className="profile-handle">@{handleStr}</div>
              <div className="profile-bio">{profile?.bio || 'Aprovecha la vida que el tiempo nos gana'}</div>
              <div className="profile-email"><Mail size={12} /> {user?.email}</div>
              
              {/* ── Barra de Cuota Mensual y Plan (Módulo 6) ── */}
              <div className="mt-3 p-3.5 rounded-2xl bg-slate-900/90 border border-slate-800 shadow-lg">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-bold text-slate-200 flex items-center gap-1.5">
                    <Crown size={14} className="text-amber-400" />
                    Cuota Mensual ({planBadge})
                  </span>
                  <span className="font-mono font-bold text-emerald-400">
                    {isUnlimited ? `${quotaUsed} / ∞ Ilimitado` : `${quotaUsed} / ${quotaLimit} créditos`}
                  </span>
                </div>
                <div className="w-full h-2 bg-slate-800 rounded-full overflow-hidden">
                  <div
                    className={`h-full transition-all duration-500 ${
                      isUnlimited
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : quotaPercent > 85
                        ? 'bg-red-500'
                        : 'bg-blue-500'
                    }`}
                    style={{ width: `${quotaPercent}%` }}
                  />
                </div>
                <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
                  <span>
                    Cola: {subStatus?.allow_async_parallel ? '⚡ Paralela Asíncrona' : '⏳ Secuencial 1x1'}
                  </span>
                  {!subStatus?.is_vip && (
                    <div className="flex gap-1.5">
                      {planBadge === 'FREE' && (
                        <button
                          onClick={() => handleUpgradePlan('creator')}
                          className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 font-bold hover:bg-blue-600/30"
                        >
                          Creator $5
                        </button>
                      )}
                      {planBadge !== 'PRO' && (
                        <button
                          onClick={() => handleUpgradePlan('pro')}
                          className="px-2 py-0.5 rounded bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 font-bold hover:bg-emerald-600/30"
                        >
                          Pro $10
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="profile-actions-row mt-3">
                <button className="profile-action-btn" onClick={() => setEditing(true)}>Editar perfil</button>
                <button className="profile-action-btn flex items-center gap-1.5 justify-center" onClick={() => setActiveTab('apikeys')}>
                  <Key size={14} className="text-amber-400" /> API Keys (fr_...)
                </button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="profile-tabs">
        <div className={`profile-tab ${activeTab === 'grid' ? 'active' : ''}`} onClick={() => setActiveTab('grid')} title="Multimedia">
          <Grid size={20} strokeWidth={activeTab === 'grid' ? 2.5 : 1.5} />
        </div>
        <div className={`profile-tab ${activeTab === 'apikeys' ? 'active' : ''}`} onClick={() => setActiveTab('apikeys')} title="API Keys (fr_...)">
          <Key size={20} strokeWidth={activeTab === 'apikeys' ? 2.5 : 1.5} />
        </div>
        <div className={`profile-tab ${activeTab === 'tools' ? 'active' : ''}`} onClick={() => setActiveTab('tools')} title="Motores IA & Delegación">
          <Cpu size={20} strokeWidth={activeTab === 'tools' ? 2.5 : 1.5} />
        </div>
        <div className={`profile-tab ${activeTab === 'saved' ? 'active' : ''}`} onClick={() => setActiveTab('saved')} title="Archivos R2">
          <Lock size={20} strokeWidth={activeTab === 'saved' ? 2.5 : 1.5} />
        </div>
        <div className={`profile-tab ${activeTab === 'inbox' ? 'active' : ''}`} onClick={() => setActiveTab('inbox')} title="Notificaciones">
          <Mail size={20} strokeWidth={activeTab === 'inbox' ? 2.5 : 1.5} />
        </div>
      </div>

      {/* ── Tab Content ── */}
      <div className="profile-content min-h-[400px] pb-24">
        {/* TAB 1: GRID MULTIMEDIA */}
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
              <div className="text-center p-12 text-slate-500 text-sm">No tienes archivos en tu grid todavía.</div>
            )}
          </div>
        )}

        {/* TAB 2: GESTIÓN DE API KEYS (fr_...) EN CLOUDFLARE D1 */}
        {activeTab === 'apikeys' && (
          <div className="p-4 space-y-4">
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800">
              <h3 className="text-sm font-bold text-white flex items-center gap-2">
                <Key size={16} className="text-amber-400" />
                Generar Nueva API Key (<code className="text-amber-300">fr_...</code>)
              </h3>
              <p className="text-xs text-slate-400 mt-1">
                Usa estas llaves en extensiones de Chrome, CLI o integraciones externas mediante el header <code className="text-slate-300">Authorization: Bearer fr_...</code> o <code className="text-slate-300">X-API-Key</code>.
              </p>

              <form onSubmit={handleCreateApiKey} className="mt-3 space-y-3">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={e => setNewKeyName(e.target.value)}
                    placeholder="Nombre de la llave (ej. Chrome Extension)"
                    className="sm:col-span-2 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                    required
                  />
                  <select
                    value={newKeyExp}
                    onChange={e => setNewKeyExp(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-blue-500"
                  >
                    <option value="Never">Sin expiración (Never)</option>
                    <option value="1d">Expira en 1 día (1d)</option>
                    <option value="7d">Expira en 7 días (7d)</option>
                    <option value="30d">Expira en 30 días (30d)</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={creatingKey}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-amber-500 to-orange-500 text-slate-950 font-extrabold text-xs shadow-lg hover:opacity-95 active:scale-[0.99] transition flex items-center justify-center gap-2"
                >
                  {creatingKey ? <Loader2 size={15} className="animate-spin" /> : <Plus size={15} />}
                  Crear Llave en Cloudflare D1
                </button>
              </form>
            </div>

            <div className="space-y-2.5">
              <div className="flex items-center justify-between px-1">
                <span className="text-xs font-bold uppercase tracking-wider text-slate-400">
                  Tus Llaves Activas ({apiKeys.length})
                </span>
                <button onClick={loadApiKeys} className="text-xs text-blue-400 flex items-center gap-1 hover:underline">
                  <RefreshCw size={12} /> Actualizar
                </button>
              </div>

              {loadingKeys ? (
                <div className="p-8 flex justify-center"><Loader2 size={22} className="animate-spin text-slate-500" /></div>
              ) : apiKeys.length === 0 ? (
                <div className="p-6 text-center text-xs text-slate-500 bg-slate-900/40 rounded-2xl border border-slate-800/60">
                  No has generado llaves API todavía.
                </div>
              ) : (
                apiKeys.map(k => (
                  <div key={k.id} className="p-3.5 rounded-2xl bg-slate-900/75 border border-slate-800 flex flex-col gap-2">
                    <div className="flex items-center justify-between">
                      <span className="font-bold text-xs text-white">{k.name}</span>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/10 text-blue-400 border border-blue-500/20 font-mono">
                          Usos: {k.usage_count || 0}
                        </span>
                        <button
                          onClick={() => handleDeleteApiKey(k.id)}
                          className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 transition"
                          title="Eliminar API Key"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 bg-slate-950 border border-slate-800/80 rounded-xl px-3 py-2">
                      <code className="text-xs text-emerald-400 font-mono flex-1 truncate select-all">
                        {k.secret_key}
                      </code>
                      <button
                        onClick={() => handleCopyKey(k.secret_key, k.id)}
                        className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs font-bold text-white flex items-center gap-1 transition shrink-0"
                      >
                        {copiedKeyId === k.id ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                        {copiedKeyId === k.id ? 'Copiada' : 'Copiar'}
                      </button>
                    </div>

                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span>Creada: {k.created_at ? new Date(k.created_at).toLocaleDateString() : 'Hoy'}</span>
                      <span>
                        {k.expires_at ? `Expira: ${new Date(k.expires_at).toLocaleDateString()}` : 'Sin expiración'}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        )}

        {/* TAB 3: HERRAMIENTAS CONECTADAS, LLAVES IA (.ENV) Y DELEGACIÓN MULTI-USUARIO */}
        {activeTab === 'tools' && (
          <div className="p-4 space-y-5">
            {/* Gestión de API Keys de Motores IA en Caliente (/api/env-keys) */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Sparkles size={16} className="text-purple-400" />
                <h3 className="text-sm font-bold text-white">Motores IA & Lista VIP en Caliente (.env)</h3>
              </div>
              <p className="text-xs text-slate-400">
                Guarda tus claves externas directamente en <code className="text-slate-300">.env</code> y recárgalas al instante sin reiniciar el servidor.
              </p>

              <form onSubmit={handleSaveEnvKeys} className="space-y-2.5">
                {['GROQ_API_KEY', 'FAL_KEY', 'OPENAI_API_KEY', 'GEMINI_API_KEY', 'ALLOWED_EMAILS'].map(envName => {
                  const info = envKeys[envName] || {}
                  return (
                    <div key={envName} className="space-y-1">
                      <div className="flex justify-between text-[11px]">
                        <label className="font-mono font-bold text-slate-300">{envName}</label>
                        <span className={info.configured ? 'text-emerald-400' : 'text-slate-500'}>
                          {info.configured ? `Configurada (${info.masked})` : 'No configurada'}
                        </span>
                      </div>
                      <input
                        type={envName === 'ALLOWED_EMAILS' ? 'text' : 'password'}
                        placeholder={info.value || info.masked || `Ingresa ${envName}...`}
                        value={envInputs[envName] || ''}
                        onChange={e => setEnvInputs(prev => ({ ...prev, [envName]: e.target.value }))}
                        className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:border-purple-500"
                      />
                    </div>
                  )
                })}
                <button
                  type="submit"
                  disabled={savingEnv}
                  className="w-full py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-bold text-xs transition flex items-center justify-center gap-2"
                >
                  {savingEnv ? <Loader2 size={14} className="animate-spin" /> : null}
                  Guardar en .env y Recargar en Caliente
                </button>
              </form>
            </div>

            {/* Delegación de Herramientas / Cuentas Compartidas (social_account_shares en D1) */}
            <div className="p-4 rounded-2xl bg-slate-900/90 border border-slate-800 space-y-3">
              <div className="flex items-center gap-2">
                <Share2 size={16} className="text-emerald-400" />
                <h3 className="text-sm font-bold text-white">Delegación Multi-Usuario (Cuentas OAuth)</h3>
              </div>
              <p className="text-xs text-slate-400">
                Comparte tus cuentas conectadas (TikTok, YouTube, Facebook) con otro usuario por su correo en Cloudflare D1.
              </p>

              <form onSubmit={handleShareAccount} className="space-y-2.5">
                <div className="grid grid-cols-2 gap-2">
                  <select
                    value={sharePlatform}
                    onChange={e => setSharePlatform(e.target.value)}
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  >
                    <option value="TikTok">TikTok</option>
                    <option value="YouTube">YouTube</option>
                    <option value="Facebook">Facebook</option>
                    <option value="Instagram">Instagram</option>
                  </select>
                  <input
                    type="text"
                    value={shareAccountName}
                    onChange={e => setShareAccountName(e.target.value)}
                    placeholder="Nombre de cuenta"
                    className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                  />
                </div>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={shareEmail}
                    onChange={e => setShareEmail(e.target.value)}
                    placeholder="Correo del colaborador (ej. socio@gmail.com)"
                    className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white"
                    required
                  />
                  <button
                    type="submit"
                    disabled={sharingLoading}
                    className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shrink-0"
                  >
                    Compartir
                  </button>
                </div>
              </form>

              {shares.owned_shares?.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Accesos otorgados por ti:</p>
                  {shares.owned_shares.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="font-bold text-emerald-400">{s.platform}</span>
                        <span className="text-slate-300"> ({s.account_name}) → </span>
                        <span className="text-slate-400 font-mono">{s.shared_with_email}</span>
                      </div>
                      <button onClick={() => handleRemoveShare(s.id)} className="text-red-400 hover:text-red-300">
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {shares.received_shares?.length > 0 && (
                <div className="pt-2 space-y-1.5">
                  <p className="text-[10px] font-bold uppercase text-slate-400">Cuentas compartidas contigo:</p>
                  {shares.received_shares.map(s => (
                    <div key={s.id} className="flex items-center justify-between bg-slate-950 px-3 py-2 rounded-xl border border-slate-800 text-xs">
                      <div>
                        <span className="font-bold text-blue-400">{s.platform}</span>
                        <span className="text-slate-300"> ({s.account_name}) de </span>
                        <span className="text-slate-400 font-mono">{s.owner_email}</span>
                      </div>
                      <span className="text-[10px] px-2 py-0.5 rounded bg-emerald-500/10 text-emerald-400">Activo</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* TAB 4: PROYECTOS Y OBJETOS ALMACENADOS EN CLOUDFLARE R2 */}
        {activeTab === 'saved' && (
          <div className="p-4 space-y-4">
            <div className="p-4 text-center bg-slate-900/60 rounded-2xl border border-slate-800">
              <Lock size={28} className="mx-auto mb-1.5 text-blue-400" />
              <h3 className="font-bold text-sm text-white">Almacenamiento en Cloudflare R2</h3>
              <p className="text-xs text-slate-400 mt-0.5">
                Proyectos y medios guardados bajo tu usuario ({r2Projects.length} objetos en R2 / D1)
              </p>
            </div>

            {r2Projects.length > 0 && (
              <div className="space-y-2">
                {r2Projects.map(proj => (
                  <div key={proj.id} className="p-3 rounded-xl bg-slate-900/80 border border-slate-800 flex items-center justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-bold text-white truncate">{proj.title || proj.filename}</p>
                      <p className="text-[10px] text-slate-500 font-mono truncate">{proj.gcs_path || proj.video_url}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      {proj.video_url && (
                        <a
                          href={proj.video_url}
                          target="_blank"
                          rel="noreferrer"
                          className="p-1.5 rounded-lg bg-blue-500/10 text-blue-400 hover:bg-blue-500/20"
                        >
                          <ExternalLink size={14} />
                        </a>
                      )}
                      <button
                        onClick={() => handleDeleteProject(proj.id)}
                        className="p-1.5 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

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
          </div>
        )}

        {/* TAB 5: INBOX DE NOTIFICACIONES */}
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
