import './Chat.css'
import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react'
import {
  Hash, Send, ChevronDown, Loader2, Users, AlertCircle,
  Image, Video, Mic, X, Paperclip, Smile, ArrowDown,
  Sparkles, Shield, Zap, Volume2, VolumeX, Search,
  MoreVertical, Phone, Pin, AtSign, Bell, Star,
  ChevronRight, Radio, MessageSquare, Trash2, Share2, CheckSquare, Clock,
  Camera, Copy, Forward, MapPin, Pause, FileText, Download, ExternalLink,
  FileSpreadsheet, File, FileArchive
} from 'lucide-react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useAuthStore } from '../store/authStore'
import { useChatStore } from '../store/chatStore'
import { useThemeStore } from '../store/themeStore'
import { useNotificationStore } from '../store/notificationStore'
import { sendLocalNotification, canNotify } from '../lib/pushService'
import MediaViewer from '../components/MediaViewer'
import MediaEditor from '../components/MediaEditor'
import CameraCapture from '../components/CameraCapture'

/* ───────────────────────────────────────────── */
/*  EMOJI PICKER                                 */
/* ───────────────────────────────────────────── */
const EMOJIS = {
  'Caras': ['😀','😃','😄','😁','😆','😅','😂','🤣','🥲','☺️','😊','😇','🙂','🙃','😉','😌','😍','🥰','😘','😗','😙','😚','😋','😛','😝','😜','🤪','🤨','🧐','🤓','😎','🥸','🤩','🥳','😏','😒','😞','😔','😟','😕','🙁','☹️','😣','😖','😫','😩','🥺','😢','😭','😤','😠','😡','🤬','🤯','😳','🥵','🥶','😱','😨','😰','😥','😓','🤗','🤔','🤭','🤫','🤥','😶','😐','😑','😬','🙄','😯','😦','😧','😮','😲','🥱','😴','🤤','😪','😵','🤐','🥴','🤢','🤮','🤧','😷','🤒','🤕','🤑','🤠','😈','👿','👹','👺','🤡','💩','👻','💀','👽','👾','🤖','🎃','😺','😸','😹','😻','😼','😽','🙀','😿','😾','🙈','🙉','🙊'],
  'Gestos': ['👋','🤚','🖐','✋','🖖','👌','🤌','🤏','✌️','🤞','🤟','🤘','🤙','👈','👉','👆','🖕','👇','☝️','👍','👎','✊','👊','🤛','🤜','👏','🙌','👐','🤲','🤝','🙏','✍️','💅','🤳','💪','🦾','🦿','🦵','🦶','👂','🦻','👃','🧠','🫀','🫁','🦷','🦴','👀','👁','👅','👄','💋','🩸'],
  'Minero': ['⛏️','🪨','💎','🏔️','⚠️','🚨','🆘','🚧','🚜','👷','👷‍♂️','🔦','🧨','⚙️','🛡️','🛠️','⚒️','🔨','🪓']
}

function EmojiPicker({ onSelect, onClose }) {
  const [activeCategory, setActiveCategory] = useState('Caras')

  return (
    <div className="chat-emoji-picker" onClick={(e) => e.stopPropagation()}>
      <div className="chat-emoji-header">
        <Smile size={14} />
        <span>Emojis</span>
        <button onClick={onClose} className="chat-emoji-close"><X size={14} /></button>
      </div>
      <div className="chat-emoji-tabs flex overflow-x-auto gap-2 p-2 bg-slate-800/50 border-b border-slate-700/50">
        {Object.keys(EMOJIS).map(cat => (
          <button key={cat} onClick={() => setActiveCategory(cat)}
            className={`px-3 py-1 text-xs rounded-full whitespace-nowrap transition-colors ${activeCategory === cat ? 'bg-blue-600 text-white font-bold' : 'bg-slate-700 text-slate-300 hover:bg-slate-600'}`}>
            {cat}
          </button>
        ))}
      </div>
      <div className="chat-emoji-grid h-48 overflow-y-auto p-2">
        {EMOJIS[activeCategory].map((emoji, i) => (
          <button
            key={i}
            className="chat-emoji-btn text-xl"
            onClick={() => { onSelect(emoji); onClose() }}
          >
            {emoji}
          </button>
        ))}
      </div>
    </div>
  )
}

/* ───────────────────────────────────────────── */
/*  VOICE RECORDER BAR (WhatsApp-style)          */
/* ───────────────────────────────────────────── */
function VoiceRecorderBar({
  onUpload, onSendLocation, onSendFile, onOpenCamera, onOpenEditor,
  text, setText, sending, handleSend, inputRef,
  activeChannelData, showEmoji, setShowEmoji, handleEmojiSelect
}) {
  const [isRecording, setIsRecording] = useState(false)
  const [isPaused, setIsPaused]       = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [wavePhase, setWavePhase]     = useState(0)
  const mediaRecorderRef = useRef(null)
  const chunksRef        = useRef([])
  const timerRef         = useRef(null)
  const streamRef        = useRef(null)
  const waveAnimRef      = useRef(null)
  const waveBarsRef      = useRef(Array.from({ length: 32 }, () => 4))

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  // Smooth waveform animation loop
  useEffect(() => {
    if (isRecording && !isPaused) {
      let frame = 0
      const animate = () => {
        frame++
        waveBarsRef.current = waveBarsRef.current.map((_, i) => {
          const base = Math.sin((frame * 0.08) + (i * 0.4)) * 12
          const secondary = Math.cos((frame * 0.12) + (i * 0.7)) * 6
          const noise = Math.sin((frame * 0.2) + (i * 1.3)) * 4
          return Math.max(3, Math.abs(base + secondary + noise) + 3)
        })
        setWavePhase(frame)
        waveAnimRef.current = requestAnimationFrame(animate)
      }
      waveAnimRef.current = requestAnimationFrame(animate)
      return () => cancelAnimationFrame(waveAnimRef.current)
    } else {
      cancelAnimationFrame(waveAnimRef.current)
    }
  }, [isRecording, isPaused])

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      const mr = new MediaRecorder(stream, { mimeType })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.start()
      setIsRecording(true)
      setIsPaused(false)
      setRecordingTime(0)
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
    } catch {
      alert('No se pudo acceder al micrófono.')
    }
  }

  const pauseRecording = () => {
    if (!mediaRecorderRef.current) return
    if (isPaused) {
      mediaRecorderRef.current.resume()
      timerRef.current = setInterval(() => {
        setRecordingTime(t => t + 1)
      }, 1000)
      setIsPaused(false)
    } else {
      mediaRecorderRef.current.pause()
      clearInterval(timerRef.current)
      setIsPaused(true)
    }
  }

  const cancelRecording = () => {
    clearInterval(timerRef.current)
    cancelAnimationFrame(waveAnimRef.current)
    if (mediaRecorderRef.current?.state !== 'inactive') mediaRecorderRef.current.stop()
    streamRef.current?.getTracks().forEach(t => t.stop())
    chunksRef.current = []
    setIsRecording(false)
    setIsPaused(false)
    setRecordingTime(0)
    mediaRecorderRef.current = null
  }

  const sendRecording = () => {
    if (!mediaRecorderRef.current) return
    clearInterval(timerRef.current)
    cancelAnimationFrame(waveAnimRef.current)
    const mimeType = MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
    mediaRecorderRef.current.onstop = () => {
      const blob = new Blob(chunksRef.current, { type: mimeType })
      const file = new File([blob], `audio_${Date.now()}.webm`, { type: mimeType })
      streamRef.current?.getTracks().forEach(t => t.stop())
      setIsRecording(false)
      setIsPaused(false)
      setRecordingTime(0)
      mediaRecorderRef.current = null
      onUpload(file, 'AUDIO')
    }
    if (mediaRecorderRef.current.state !== 'inactive') mediaRecorderRef.current.stop()
  }

  const hasText = text.trim().length > 0

  // ── Recording bar UI — Premium Design ──
  if (isRecording) {
    return (
      <div className="voice-recorder-bar">
        {/* Animated background glow */}
        <div className="voice-rec-bg-glow" />
        
        {/* Cancel button */}
        <button type="button" className="voice-rec-btn voice-rec-delete" onClick={cancelRecording} title="Cancelar">
          <Trash2 size={18} />
        </button>
        
        {/* Recording indicator + waveform */}
        <div className="voice-rec-wave-area">
          <div className="voice-rec-indicator">
            <div className={`voice-rec-dot ${isPaused ? '' : 'voice-rec-dot-pulse'}`} />
            <span className="voice-rec-label">{isPaused ? 'Pausado' : 'Grabando'}</span>
          </div>
          <div className="voice-rec-waveform">
            {waveBarsRef.current.map((h, i) => (
              <div key={i} className="voice-rec-bar"
                style={{
                  height: `${isPaused ? 3 : h}px`,
                  opacity: isPaused ? 0.3 : 0.5 + (h / 40),
                  background: `hsl(${200 + (i * 4)}, 90%, ${55 + (h * 0.5)}%)`,
                }}
              />
            ))}
          </div>
          <span className="voice-rec-timer">{fmt(recordingTime)}</span>
        </div>
        
        {/* Pause / Resume */}
        <button type="button" className="voice-rec-btn voice-rec-pause" onClick={pauseRecording} title={isPaused ? 'Reanudar' : 'Pausar'}>
          {isPaused ? <Mic size={16} /> : <Pause size={16} />}
        </button>
        
        {/* Send */}
        <button type="button" className="voice-rec-btn voice-rec-send" onClick={sendRecording} title="Enviar audio">
          <Send size={18} />
        </button>
      </div>
    )
  }

  // ── Normal input bar UI ──
  return (
    <form onSubmit={handleSend} className="chat-input-form relative z-20">
      <ChatMediaUpload
        onUpload={onUpload}
        onSendLocation={onSendLocation}
        onSendFile={onSendFile}
        disabled={sending}
        onOpenCamera={onOpenCamera}
        onOpenEditor={onOpenEditor}
        onRecordingChange={startRecording}
      />
      <div className="chat-input-wrapper">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={`Mensaje en #${activeChannelData?.name || 'general'}`}
          disabled={sending}
          className="chat-input"
          autoComplete="off"
        />
        <div className="chat-input-actions">
          <div className="chat-emoji-wrapper">
            <button type="button" onClick={() => setShowEmoji(!showEmoji)} className="chat-action-btn chat-action-btn-sm"><Smile size={18} /></button>
            {showEmoji && <EmojiPicker onSelect={handleEmojiSelect} onClose={() => setShowEmoji(false)} />}
          </div>
        </div>
      </div>
      {hasText ? (
        <button type="submit" disabled={sending} className="chat-send-btn chat-send-btn-active">
          {sending ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
        </button>
      ) : (
        <button
          type="button"
          onClick={startRecording}
          disabled={sending}
          className="chat-send-btn chat-send-btn-mic"
          title="Grabar audio"
        >
          <Mic size={20} />
        </button>
      )}
    </form>
  )
}

/* ───────────────────────────────────────────── */
/*  CHAT MESSAGE BUBBLE                          */
/* ───────────────────────────────────────────── */
const QUICK_REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏']

function ChatBubble({ message, isOwn, index, selectionMode, isSelected, toggleSelection, onDelete, onShare, onReply, onViewMedia, activeMessageId, onOpenActions, onCloseActions, onReaction }) {
  const profile = message.profiles
  const initials = (profile?.name || '?').slice(0, 2).toUpperCase()
  const pressTimerRef = useRef(null)
  const bubbleRef = useRef(null)
  const navigate = useNavigate()

  const isActive = activeMessageId === message.id

  const handleStartPress = (e) => {
    if (selectionMode) {
      return
    }
    pressTimerRef.current = setTimeout(() => {
      // Open reactions above bubble + actions in header
      onOpenActions(message, isOwn)
    }, 500)
  }

  const handleEndPress = () => {
    if (pressTimerRef.current) {
      clearTimeout(pressTimerRef.current)
      pressTimerRef.current = null
    }
  }

  const handleClick = (e) => {
    if (selectionMode) {
      toggleSelection(message.id)
    }
  }

  const renderContent = (text) => {
    if (!text) return null
    const urlRegex = /(https?:\/\/[^\s]+)/g
    const parts = text.split(urlRegex)
    return parts.map((part, i) => {
      if (part.match(urlRegex)) {
        if (/\.(jpg|jpeg|png|gif|webp)(\?.*)?$/i.test(part)) {
          return (
            <div key={i} className="chat-link-preview">
              <img src={part} alt="" loading="lazy" className="chat-link-preview-img" />
              <a href={part} target="_blank" rel="noopener noreferrer" className="chat-link-text">
                {part.length > 40 ? part.substring(0, 40) + '...' : part}
              </a>
            </div>
          )
        }
        return (
          <a key={i} href={part} target="_blank" rel="noopener noreferrer" className="chat-link-text">
            {part.length > 50 ? part.substring(0, 50) + '...' : part}
          </a>
        )
      }
      return <span key={i}>{part}</span>
    })
  }

  const timeAgo = (date) => {
    const now = new Date()
    const diff = (now - new Date(date)) / 1000
    if (diff < 60) return 'ahora'
    if (diff < 3600) return `${Math.floor(diff / 60)}m`
    if (diff < 86400) return `${Math.floor(diff / 3600)}h`
    return new Date(date).toLocaleString('es-PE', {
      hour: '2-digit', minute: '2-digit', day: '2-digit', month: 'short'
    })
  }

  const colors = useMemo(() => {
    const hue = profile?.name
      ? profile.name.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) % 360
      : 200
    return {
      avatar: `hsl(${hue}, 70%, 45%)`,
      avatarGlow: `hsla(${hue}, 80%, 50%, 0.3)`,
      name: `hsl(${hue}, 80%, 50%)`
    }
  }, [profile?.name])

  return (
    <div
      id={`message-${message.id}`}
      className={`chat-bubble-row ${isOwn ? 'chat-bubble-own' : ''} ${isSelected ? 'bg-blue-500/20' : ''} ${isActive ? 'chat-bubble-row-active' : ''}`}
      style={{ animationDelay: `${Math.min(index * 30, 300)}ms` }}
      onMouseDown={handleStartPress}
      onMouseUp={handleEndPress}
      onTouchStart={handleStartPress}
      onTouchEnd={handleEndPress}
      onClick={handleClick}
      onContextMenu={(e) => { e.preventDefault(); onOpenActions(message, isOwn) }}
    >
      {/* Selection Checkbox */}
      {selectionMode && (
        <div className="mr-2 flex items-center justify-center chat-checkbox-wrapper">
          <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all duration-300 ${isSelected ? 'bg-blue-500 border-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)] scale-110' : 'border-gray-400'}`}>
            {isSelected && <CheckSquare size={12} className="text-white chat-checkbox-icon" />}
          </div>
        </div>
      )}

      {/* Avatar */}
      {!isOwn && (
        <div className="chat-avatar-wrapper">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="chat-avatar-img" />
          ) : (
            <div className="chat-avatar-initials" style={{ background: colors.avatar, boxShadow: `0 0 12px ${colors.avatarGlow}` }}>
              {initials}
            </div>
          )}
          <div className="chat-avatar-status" />
        </div>
      )}

      {/* Content */}
      <div ref={bubbleRef} className={`chat-bubble-content ${isOwn ? 'chat-bubble-content-own' : ''} relative`}>
        {!isOwn && (
          <div className="chat-bubble-meta">
            <span className="chat-bubble-name" style={{ color: colors.name }}>{profile?.name || 'Anónimo'}</span>
            <span className="chat-bubble-time">{timeAgo(message.created_at)}</span>
          </div>
        )}

        {/* ── Floating Reaction Bar (WhatsApp/TikTok style) ── */}
        {isActive && !selectionMode && (
          <div className={`chat-reactions-floating ${isOwn ? 'chat-reactions-own' : 'chat-reactions-other'}`}
               onClick={(e) => e.stopPropagation()}>
            {QUICK_REACTIONS.map(emoji => (
              <button
                key={emoji}
                className="chat-reaction-btn"
                onClick={(e) => {
                  e.stopPropagation()
                  onReaction(message.id, emoji)
                  onCloseActions()
                }}
              >
                {emoji}
              </button>
            ))}
            <button
              className="chat-reaction-btn chat-reaction-plus"
              onClick={(e) => {
                e.stopPropagation()
                // Could open full emoji picker here
              }}
            >
              +
            </button>
          </div>
        )}

        <div className={`chat-bubble ${isOwn ? 'chat-bubble-mine' : 'chat-bubble-theirs'}`}>
          {message.reply && (
            <div 
              className="bg-black/20 rounded-md p-2 mb-2 text-xs border-l-2 border-blue-400 cursor-pointer opacity-80 hover:opacity-100 transition-opacity flex gap-2 items-center"
              onClick={(e) => {
                e.stopPropagation()
                const el = document.getElementById(`message-${message.reply.id}`)
                if (el) {
                  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
                  el.classList.add('chat-bubble-highlight')
                  setTimeout(() => el.classList.remove('chat-bubble-highlight'), 1500)
                }
              }}
            >
              {(message.reply.type === 'IMAGE' || message.reply.type === 'VIDEO' || message.reply.type === 'LOCATION') && message.reply.media_url && (
                <div className="chat-reply-thumb-wrapper shrink-0">
                  {message.reply.type === 'IMAGE' ? (
                    <img src={message.reply.media_url} alt="" className="chat-reply-thumb" loading="lazy" />
                  ) : message.reply.type === 'VIDEO' ? (
                    <video src={message.reply.media_url} className="chat-reply-thumb" />
                  ) : (
                    <div className="w-full h-full bg-slate-700 flex items-center justify-center text-red-400">
                      <MapPin size={20} />
                    </div>
                  )}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <span className="font-bold block text-blue-300">{message.reply.profiles?.name || 'Usuario'}</span>
                <span className="line-clamp-1">{message.reply.type === 'TEXT' ? message.reply.content : 'Archivo multimedia'}</span>
              </div>
            </div>
          )}
          {message.type === 'TEXT' && (
            <p className="chat-bubble-text">{renderContent(message.content)}</p>
          )}

          {message.type === 'MULTIPLE_MEDIA' && message.media_urls && message.media_urls.length > 0 && (
            <div className="chat-media-grid" onClick={(e) => {
              if (selectionMode) { e.preventDefault(); e.stopPropagation(); toggleSelection(message.id); }
            }}>
              {message.media_urls.slice(0, 4).map((url, i) => {
                const isVideo = url.includes('.mp4') || url.includes('.webm') || url.includes('video')
                return (
                  <div key={i} className="chat-media-grid-item" onClick={(e) => {
                    e.stopPropagation(); handleEndPress();
                    if (!selectionMode) {
                      // Open gallery with ALL media, starting from clicked index
                      const allMedia = message.media_urls.map(u => ({
                        url: u,
                        type: (u.includes('.mp4') || u.includes('.webm') || u.includes('video')) ? 'VIDEO' : 'IMAGE'
                      }))
                      onViewMedia(allMedia, i)
                    }
                  }}>
                    {isVideo ? (
                      <video src={url} className="chat-media-grid-img" />
                    ) : (
                      <img src={url} alt="" loading="lazy" className="chat-media-grid-img" />
                    )}
                    {isVideo && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                        <Video size={24} className="text-white opacity-80" />
                      </div>
                    )}
                    {i === 3 && message.media_urls.length > 4 && (
                      <div className="chat-media-grid-more">
                        +{message.media_urls.length - 4}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          )}

          {message.type === 'FILE' && message.file_metadata && (() => {
            const fname = message.file_metadata.name || 'documento'
            const ext = fname.split('.').pop()?.toLowerCase() || ''
            const sizeBytes = message.file_metadata.size || 0
            const sizeLabel = sizeBytes > 1048576 ? `${(sizeBytes / 1048576).toFixed(1)} MB` : sizeBytes > 1024 ? `${(sizeBytes / 1024).toFixed(0)} KB` : sizeBytes > 0 ? `${sizeBytes} B` : 'Documento'

            // File type config: icon, color, label
            const fileTypes = {
              pdf:  { icon: FileText, color: '#ef4444', bg: 'rgba(239,68,68,0.12)', label: 'PDF' },
              doc:  { icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'DOC' },
              docx: { icon: FileText, color: '#3b82f6', bg: 'rgba(59,130,246,0.12)', label: 'DOCX' },
              xls:  { icon: FileSpreadsheet, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'XLS' },
              xlsx: { icon: FileSpreadsheet, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'XLSX' },
              csv:  { icon: FileSpreadsheet, color: '#22c55e', bg: 'rgba(34,197,94,0.12)', label: 'CSV' },
              txt:  { icon: FileText, color: '#94a3b8', bg: 'rgba(148,163,184,0.12)', label: 'TXT' },
              zip:  { icon: FileArchive, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'ZIP' },
              rar:  { icon: FileArchive, color: '#f59e0b', bg: 'rgba(245,158,11,0.12)', label: 'RAR' },
            }
            const ft = fileTypes[ext] || { icon: File, color: '#6366f1', bg: 'rgba(99,102,241,0.12)', label: ext.toUpperCase() || 'ARCHIVO' }
            const IconComp = ft.icon

            const handleOpen = (e) => {
              e.stopPropagation()
              if (!selectionMode) window.open(message.media_url, '_blank')
            }

            const handleSave = async (e) => {
              e.stopPropagation()
              if (selectionMode) return
              try {
                const res = await fetch(message.media_url)
                const blob = await res.blob()
                const blobUrl = URL.createObjectURL(blob)
                const a = document.createElement('a')
                a.href = blobUrl
                a.download = fname
                document.body.appendChild(a)
                a.click()
                document.body.removeChild(a)
                URL.revokeObjectURL(blobUrl)
              } catch {
                window.open(message.media_url, '_blank')
              }
            }

            return (
              <div className="chat-file-card" onClick={(e) => {
                if (selectionMode) { e.preventDefault(); e.stopPropagation(); toggleSelection(message.id); }
              }}>
                {/* File info row */}
                <div className="chat-file-card-body">
                  <div className="chat-file-card-icon" style={{ background: ft.bg }}>
                    <IconComp size={22} style={{ color: ft.color }} />
                  </div>
                  <div className="chat-file-card-info">
                    <span className="chat-file-card-name">{fname}</span>
                    <div className="chat-file-card-meta">
                      <span className="chat-file-card-badge" style={{ background: ft.bg, color: ft.color }}>{ft.label}</span>
                      <span className="chat-file-card-size">{sizeLabel}</span>
                    </div>
                  </div>
                </div>
                {/* Action buttons */}
                <div className="chat-file-card-actions">
                  <button className="chat-file-action-btn" onClick={handleOpen}>
                    <ExternalLink size={14} />
                    <span>Abrir</span>
                  </button>
                  <div className="chat-file-action-divider" />
                  <button className="chat-file-action-btn" onClick={handleSave}>
                    <Download size={14} />
                    <span>Guardar</span>
                  </button>
                </div>
              </div>
            )
          })()}

          {message.type === 'IMAGE' && message.media_url && (
            <div className="chat-media-container" onClick={(e) => { 
              e.stopPropagation(); 
              handleEndPress(); 
              if (selectionMode) toggleSelection(message.id);
              else onViewMedia([{ url: message.media_url, type: 'IMAGE' }], 0);
            }}>
              <img src={message.media_url} alt="Imagen" loading="lazy" className="chat-media-img" />
              <div className="chat-media-overlay">
                <Image size={20} />
                <span>Ver imagen</span>
              </div>
            </div>
          )}

          {message.type === 'VIDEO' && message.media_url && (
            <div className="chat-media-container" onClick={(e) => { 
              e.stopPropagation(); 
              handleEndPress(); 
              if (selectionMode) toggleSelection(message.id);
              else onViewMedia([{ url: message.media_url, type: 'VIDEO' }], 0);
            }}>
              <video src={message.media_url} controls preload="metadata" className={`chat-media-video ${selectionMode ? 'pointer-events-none' : ''}`} />
            </div>
          )}

          {message.type === 'AUDIO' && message.media_url && (
            <div className="chat-audio-container" onClick={(e) => {
              if (selectionMode) {
                e.preventDefault();
                e.stopPropagation();
                toggleSelection(message.id);
              }
            }}>
              <audio src={message.media_url} controls preload="metadata" className={`chat-audio-player ${selectionMode ? 'pointer-events-none' : ''}`} />
            </div>
          )}

          {message.type === 'LOCATION' && message.media_url && (() => {
            const [lat, lng] = message.media_url.split(',').map(Number)
            const zoom = 15
            // OSM static tile: calculate tile at zoom 15
            const osmThumb = `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=${zoom}&size=300x130&markers=${lat},${lng},red-pushpin`
            const handleGoMap = (e) => {
              e.stopPropagation()
              navigate(`/map?lat=${lat}&lng=${lng}&route=true&desc=${encodeURIComponent(message.content || 'Ubicación compartida')}`)
            }
            return (
              <div className="chat-location-card" onClick={(e) => e.stopPropagation()}>
                {/* Map Thumbnail */}
                <div className="chat-location-thumb" onClick={handleGoMap}>
                  <img
                    src={osmThumb}
                    alt="Mapa"
                    className="chat-location-thumb-img"
                    loading="lazy"
                    onError={(e) => { e.target.style.display='none' }}
                  />
                  <div className="chat-location-pin-overlay">
                    <div className="chat-location-pin-ring" />
                    <MapPin size={28} className="text-red-500 drop-shadow-lg relative z-10" />
                  </div>
                  <div className="chat-location-tap-hint">Toca para ver en mapa</div>
                </div>
                {/* Info row */}
                <div className="chat-location-footer">
                  <div className="chat-location-text">
                    <span className="font-bold text-xs text-blue-400 flex items-center gap-1">
                      <MapPin size={12} /> Ubicación compartida
                    </span>
                    {message.content && message.content !== '📍 Ubicación compartida' && (
                      <span className="text-xs text-gray-300 mt-0.5 block line-clamp-2">{message.content}</span>
                    )}
                    <span className="text-[10px] text-gray-500 mt-0.5 block">{lat.toFixed(5)}, {lng.toFixed(5)}</span>
                  </div>
                  <button
                    className="chat-location-route-btn"
                    onClick={handleGoMap}
                    title="Enrutar desde mi posición"
                  >
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="3"/>
                      <path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/>
                    </svg>
                    Enrutar
                  </button>
                </div>
              </div>
            )
          })()}

          {message.type !== 'TEXT' && message.type !== 'LOCATION' && message.content && (
            <p className="chat-media-caption">{message.content}</p>
          )}
        </div>

        {/* Display existing reactions */}
        {message.reactions && message.reactions.length > 0 && (
          <div className="chat-reactions-display">
            {Object.entries(message.reactions.reduce((acc, r) => {
              const e = typeof r === 'string' ? r : r.emoji;
              if (e) acc[e] = (acc[e] || 0) + 1;
              return acc;
            }, {})).map(([emoji, count]) => (
              <span key={emoji} className="chat-reaction-chip" onClick={(e) => { e.stopPropagation(); onReaction(message.id, emoji) }}>
                {emoji} {count > 1 && <span className="chat-reaction-count">{count}</span>}
              </span>
            ))}
          </div>
        )}

        {isOwn && (
          <span className="chat-bubble-time chat-bubble-time-own">{timeAgo(message.created_at)}</span>
        )}
      </div>

      {isOwn && (
        <div className="chat-avatar-wrapper">
          {profile?.avatar_url ? (
            <img src={profile.avatar_url} alt="" referrerPolicy="no-referrer" className="chat-avatar-img" />
          ) : (
            <div className="chat-avatar-initials" style={{ background: 'var(--accent-primary)', boxShadow: '0 0 12px rgba(99,102,241,0.3)' }}>
              {initials}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

/* ───────────────────────────────────────────── */
/*  MEDIA UPLOAD (with Camera + Multi-Image)     */
/* ───────────────────────────────────────────── */
function ChatMediaUpload({ onUpload, onOpenCamera, onOpenEditor, onSendLocation, onSendFile, disabled }) {
  const [isRecording, setIsRecording] = useState(false)
  const [recordingTime, setRecordingTime] = useState(0)
  const [showOptions, setShowOptions] = useState(false)
  const mediaRecorderRef = useRef(null)
  const chunksRef = useRef([])
  const timerRef = useRef(null)
  const imgInputRef = useRef(null)
  const vidInputRef = useRef(null)
  const fileInputRef = useRef(null)

  const handleImageSelect = (e) => {
    const fileList = Array.from(e.target.files || [])
    if (fileList.length === 0) return
    setShowOptions(false)
    onOpenEditor(fileList)
    e.target.value = ''
  }

  const handleVideoSelect = (e) => {
    const fileList = Array.from(e.target.files || [])
    if (fileList.length === 0) return
    for (let f of fileList) {
      if (f.size > 50 * 1024 * 1024) {
        alert(`El video ${f.name} no puede superar 50MB`)
        return
      }
    }
    setShowOptions(false)
    onOpenEditor(fileList)
    e.target.value = ''
  }

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (file.size > 50 * 1024 * 1024) {
      alert('El archivo no puede superar 50MB')
      return
    }
    setShowOptions(false)
    if (onSendFile) onSendFile(file)
    e.target.value = ''
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mr = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg'
      })
      mediaRecorderRef.current = mr
      chunksRef.current = []
      mr.ondataavailable = (e) => { if (e.data.size > 0) chunksRef.current.push(e.data) }
      mr.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        const file = new File([blob], `audio_${Date.now()}.webm`, { type: 'audio/webm' })
        stream.getTracks().forEach(t => t.stop())
        clearInterval(timerRef.current)
        setRecordingTime(0)
        setIsRecording(false)
        setShowOptions(false)
        onUpload(file, 'AUDIO')
      }
      mr.start()
      setIsRecording(true)
      setShowOptions(false)
      timerRef.current = setInterval(() => setRecordingTime(t => t + 1), 1000)
    } catch (err) {
      alert('No se pudo acceder al micrófono.')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
  }

  const fmt = (s) => `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, '0')}`

  if (isRecording) {
    return (
      <button type="button" onClick={stopRecording} className="chat-recording-btn">
        <div className="chat-recording-dot" />
        <span>{fmt(recordingTime)}</span>
        <span className="chat-recording-label">Toca para detener</span>
      </button>
    )
  }

  return (
    <div className="chat-attach-wrapper">
      <button type="button" onClick={() => setShowOptions(!showOptions)} disabled={disabled} className="chat-action-btn" title="Adjuntar archivo">
        <Paperclip size={20} />
      </button>

      {showOptions && (
        <>
          <div className="chat-attach-backdrop" onClick={() => setShowOptions(false)} />
          <div className="chat-attach-menu">
            <input type="file" ref={imgInputRef} accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
            <input type="file" ref={vidInputRef} accept="video/*" multiple className="hidden" onChange={handleVideoSelect} />
            <input type="file" ref={fileInputRef} accept=".pdf,.doc,.docx,.xls,.xlsx,.txt,.zip" className="hidden" onChange={handleFileSelect} />

            <button type="button" onClick={() => { setShowOptions(false); onOpenCamera() }} className="chat-attach-option">
              <div className="chat-attach-icon" style={{background:'linear-gradient(135deg,#6366f1,#8b5cf6)'}}><Camera size={18} className="text-white" /></div>
              <div>
                <span className="chat-attach-label">Cámara</span>
                <span className="chat-attach-desc">Foto o video</span>
              </div>
            </button>
            <button type="button" onClick={() => imgInputRef.current?.click()} className="chat-attach-option">
              <div className="chat-attach-icon chat-attach-icon-img"><Image size={18} /></div>
              <div>
                <span className="chat-attach-label">Galería</span>
                <span className="chat-attach-desc">Selección múltiple</span>
              </div>
            </button>
            <button type="button" onClick={() => vidInputRef.current?.click()} className="chat-attach-option">
              <div className="chat-attach-icon chat-attach-icon-vid"><Video size={18} /></div>
              <div>
                <span className="chat-attach-label">Video</span>
                <span className="chat-attach-desc">Máximo 50MB</span>
              </div>
            </button>
            <button type="button" onClick={() => fileInputRef.current?.click()} className="chat-attach-option">
              <div className="chat-attach-icon" style={{background:'rgba(245, 158, 11, 0.1)', color:'#f59e0b'}}><Paperclip size={18} /></div>
              <div>
                <span className="chat-attach-label">Documento</span>
                <span className="chat-attach-desc">PDF, Word, Excel</span>
              </div>
            </button>
            <button type="button" onClick={startRecording} className="chat-attach-option">
              <div className="chat-attach-icon chat-attach-icon-mic"><Mic size={18} /></div>
              <div>
                <span className="chat-attach-label">Audio</span>
                <span className="chat-attach-desc">Grabar mensaje de voz</span>
              </div>
            </button>
            <button type="button" onClick={() => { setShowOptions(false); onSendLocation() }} className="chat-attach-option">
              <div className="chat-attach-icon" style={{background: 'linear-gradient(135deg, #10b981, #059669)'}}><MapPin size={18} className="text-white" /></div>
              <div>
                <span className="chat-attach-label">Ubicación</span>
                <span className="chat-attach-desc">Compartir posición actual</span>
              </div>
            </button>
          </div>
        </>
      )}
    </div>
  )
}

/* ───────────────────────────────────────────── */
/*  MAIN CHAT PAGE                               */
/* ───────────────────────────────────────────── */
export default function Chat() {
  const { user, profile: userProfile } = useAuthStore()
  const { chatBackground, setChatBackground, chatFont, chatFontSize } = useThemeStore()
  const {
    messages, channels, activeChannel, loading, error,
    fetchChannels, fetchMessages, addMessage, loadMoreMessages,
    sendTextMessage, sendMediaMessage, sendLocationMessage, forwardMessage, setActiveChannel,
    deleteMessage, updateChannelExpiration, toggleReaction
  } = useChatStore()

  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)
  const [showChannels, setShowChannels] = useState(false)
  const [showEmoji, setShowEmoji] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [unreadCount, setUnreadCount] = useState(0)
  
  // Selection Mode
  const [selectionMode, setSelectionMode] = useState(false)
  const [selectedIds, setSelectedIds] = useState([])
  const [replyToMsg, setReplyToMsg] = useState(null)
  const [mediaToView, setMediaToView] = useState(null) // { mediaList: [...], initialIndex: 0 }
  const [showCamera, setShowCamera] = useState(false)
  const [editorFiles, setEditorFiles] = useState(null)

  // Active message actions (long-press context)
  const [activeMessage, setActiveMessage] = useState(null) // { message, isOwn }
  const [forwardingMessage, setForwardingMessage] = useState(null)

  const messagesEndRef = useRef(null)
  const scrollContainerRef = useRef(null)
  const inputRef = useRef(null)

  const activeChannelData = channels.find(c => c.id === activeChannel)

  const channelIcons = {
    'General': MessageSquare,
    'Alertas': AlertCircle,
    'Coordinación': Radio
  }

  useEffect(() => {
    fetchChannels()
  }, [])

  useEffect(() => {
    if (activeChannel) {
      fetchMessages()
      setUnreadCount(0)
      setSelectionMode(false)
      setSelectedIds([])
    }
  }, [activeChannel])

  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape' && selectionMode) {
        setSelectionMode(false)
        setSelectedIds([])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectionMode])

  useEffect(() => {
    if (!activeChannel) return
    console.warn('[Realtime] Intentando conectar a:', activeChannel)

    const channel = supabase.channel(`chat-room-${activeChannel}`, {
      config: {
        broadcast: { ack: true }
      }
    })
      .on('broadcast', { event: 'new_message' }, (payload) => {
        console.warn('[Broadcast] Nuevo mensaje recibido:', payload.payload)
        const data = payload.payload
        useChatStore.getState().addMessage(data)
        
        if (data.user_id !== user?.id && canNotify()) {
           const senderName = data.profiles?.name || 'Alguien'
           const msgContent = data.type === 'TEXT' ? data.content : 'Mensaje multimedia'
           
           // Browser Push Notification
           sendLocalNotification(`Nuevo mensaje de ${senderName}`, msgContent)
           
           // In-app Notification Inbox & Toast
           useNotificationStore.getState().addNotificationLocally({
              id: data.id, // Reusing message id as notif id
              user_id: user.id,
              title: `💬 ${senderName}`,
              message: msgContent,
              type: 'chat',
              related_id: data.channel_id,
              is_read: false,
              created_at: new Date().toISOString()
           })
        }
        
        const container = scrollContainerRef.current
        if (container) {
          const nearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 150
          if (nearBottom) {
            setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 80)
          } else {
            setUnreadCount(c => c + 1)
          }
        }
      })
      .on('broadcast', { event: 'delete_message' }, (payload) => {
         console.warn('[Broadcast] Mensaje eliminado:', payload.payload)
         useChatStore.setState(state => ({ messages: state.messages.filter(m => m.id !== payload.payload.id) }))
      })
      .on('broadcast', { event: 'reaction_add' }, (payload) => {
         console.warn('[Broadcast] Reacción agregada:', payload.payload)
         const { messageId, reaction } = payload.payload
         useChatStore.setState(state => ({
           messages: state.messages.map(m => 
             m.id === messageId
               ? { ...m, reactions: m.reactions?.find(r => r.id === reaction.id) ? m.reactions : [...(m.reactions || []), reaction] } 
               : m
           )
         }))
      })
      .on('broadcast', { event: 'reaction_remove' }, (payload) => {
         console.warn('[Broadcast] Reacción removida:', payload.payload)
         const { messageId, reactionId } = payload.payload
         useChatStore.setState(state => ({
           messages: state.messages.map(m => 
             m.id === messageId 
               ? { ...m, reactions: (m.reactions || []).filter(r => r.id !== reactionId) } 
               : m
           )
         }))
      })
      .subscribe((status) => {
        console.warn('[Realtime] Estado de suscripción:', status)
      })

    useChatStore.setState({ currentChannel: channel })

    return () => { 
      useChatStore.setState({ currentChannel: null })
      supabase.removeChannel(channel) 
    }
  }, [activeChannel])


  useEffect(() => {
    if (!loading && messages.length > 0) {
      setTimeout(() => messagesEndRef.current?.scrollIntoView(), 150)
    }
  }, [loading, messages.length === 0])

  const handleScroll = useCallback(() => {
    const c = scrollContainerRef.current
    if (!c) return
    const distFromBottom = c.scrollHeight - c.scrollTop - c.clientHeight
    setShowScrollBtn(distFromBottom > 200)
    if (distFromBottom < 100) setUnreadCount(0)
    if (c.scrollTop < 50) loadMoreMessages()
  }, [])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
    setUnreadCount(0)
  }

  const handleSend = async (e) => {
    e.preventDefault()
    const msg = text.trim()
    if (!msg || sending) return
    setSending(true)
    const replyId = replyToMsg?.id
    setText('')
    setShowEmoji(false)
    setReplyToMsg(null)
    const { error: sendErr } = await sendTextMessage(msg, user.id, replyId)
    if (sendErr) {
      setText(msg)
      alert('Error al enviar: ' + sendErr.message)
    } else {
      setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    }
    setSending(false)
    inputRef.current?.focus()
  }

  const handleLocationSend = () => {
    if (!navigator.geolocation) {
      alert("Tu navegador no soporta geolocalización.");
      return;
    }
    setSending(true)
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        await sendLocationMessage(text, pos.coords.latitude, pos.coords.longitude, user.id, replyToMsg?.id);
        setText('');
        setReplyToMsg(null);
        setSending(false)
        scrollToBottom()
      },
      (err) => {
        alert("No se pudo obtener la ubicación: " + err.message);
        setSending(false)
      },
      { enableHighAccuracy: true }
    );
  }

  const handleMediaUpload = (file, type) => {
    const replyId = replyToMsg?.id
    setReplyToMsg(null)
    sendMediaMessage(file, type, user.id, replyId).then((res) => {
      if (res && res.error) {
        alert('Error al subir archivo: ' + res.error.message)
      } else {
        setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
      }
    })
  }

  // Called from MediaEditor: send multiple files with caption
  const handleEditorSend = (files, caption) => {
    setEditorFiles(null)
    if (!files || files.length === 0) return
    const replyId = replyToMsg?.id
    setReplyToMsg(null)
    
    const type = files[0].type.startsWith('video') ? 'VIDEO' : 'IMAGE'
    useChatStore.getState().sendMultipleMediaMessage(files, type, user.id, replyId, caption).then((res) => {
      if (res && res.error) alert('Error al enviar multimedia: ' + res.error.message)
      else setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
  }

  const handleFileSend = (file) => {
    const replyId = replyToMsg?.id
    setReplyToMsg(null)
    useChatStore.getState().sendFileMessage(file, user.id, replyId).then((res) => {
      if (res && res.error) alert('Error al enviar archivo: ' + res.error.message)
      else setTimeout(() => messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }), 100)
    })
  }

  // Camera capture callback: open files in the editor
  const handleCameraCapture = (files) => {
    setShowCamera(false)
    setEditorFiles(files)
  }

  const handleEmojiSelect = (emoji) => {
    setText(prev => prev + emoji)
    inputRef.current?.focus()
  }

  const toggleSelection = (id, forceMode = false) => {
    if (forceMode && !selectionMode) {
      setSelectionMode(true)
      setSelectedIds([id])
      return
    }
    setSelectedIds(prev => {
      const next = prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
      if (next.length === 0) setSelectionMode(false)
      return next
    })
  }

  const handleDeleteSelected = async () => {
    if (!window.confirm(`¿Eliminar ${selectedIds.length} mensaje(s)?`)) return
    for (const id of selectedIds) {
      const msg = messages.find(m => m.id === id)
      if (msg && msg.user_id === user.id) {
        await deleteMessage(id)
      }
    }
    setSelectionMode(false)
    setSelectedIds([])
  }

  const handleShare = async (msg) => {
    try {
      const content = msg.type === 'TEXT' ? msg.content : msg.media_url
      if (navigator.share) {
        await navigator.share({ title: 'Mensaje de MinerAlert', text: content })
      } else {
        await navigator.clipboard.writeText(content)
        alert('Copiado al portapapeles')
      }
    } catch (e) { console.error('Share failed', e) }
  }

  const handleCopy = async (msg) => {
    try {
      const content = msg.type === 'TEXT' ? msg.content : msg.media_url
      await navigator.clipboard.writeText(content)
      alert('Copiado al portapapeles')
    } catch (e) { console.error('Copy failed', e) }
  }

  // ── Active message action handlers ──
  const handleOpenActions = useCallback((message, isOwn) => {
    setActiveMessage({ message, isOwn })
  }, [])

  const handleCloseActions = useCallback(() => {
    setActiveMessage(null)
  }, [])

  const handleReaction = useCallback(async (messageId, emoji) => {
    await toggleReaction(messageId, emoji, user.id)
    setActiveMessage(null)
  }, [toggleReaction, user.id])

  // Filter messages based on expiration
  const filteredMessages = useMemo(() => {
    if (!activeChannelData?.expiration_hours) return messages
    const cutoff = new Date(Date.now() - activeChannelData.expiration_hours * 3600 * 1000)
    return messages.filter(m => new Date(m.created_at) > cutoff)
  }, [messages, activeChannelData?.expiration_hours])

  // Get background style
  const getBackgroundStyle = () => {
    switch (chatBackground) {
      case 'doodle': return { backgroundImage: 'url(https://i.pinimg.com/originals/8c/98/99/8c98994518b575bfd8c949e91d20548b.jpg)', opacity: 0.1, backgroundSize: '200px' }
      case 'dark-doodle': return { backgroundImage: 'url(https://w0.peakpx.com/wallpaper/508/606/HD-wallpaper-whatsapp-background-dark-black-doodles-texture-thumbnail.jpg)', opacity: 0.4, backgroundSize: '300px' }
      case 'solid-blue': return { background: '#0ea5e9', opacity: 0.1 }
      case 'solid-dark': return { background: '#000000', opacity: 0.3 }
      default: return { background: 'none' }
    }
  }

  const canDeleteSelected = selectedIds.length > 0 && selectedIds.every(id => messages.find(m => m.id === id)?.user_id === user.id)

  if (error) {
    return (
      <div className="chat-error-state">
        <div className="chat-error-icon"><AlertCircle size={32} /></div>
        <h2>Error de conexión</h2>
        <p>{error}</p>
        <button onClick={() => { fetchChannels(); fetchMessages() }} className="chat-error-retry">
          <Zap size={16} /> Reintentar
        </button>
      </div>
    )
  }

  return (
    <div className="chat-container relative">
      <div className="absolute inset-0 z-0 pointer-events-none" style={getBackgroundStyle()} />
      
      {/* ── HEADER ── */}
      {selectionMode ? (
        <div className="chat-header bg-blue-600 border-none !text-white z-20">
          <div className="flex items-center gap-4">
            <button onClick={() => { setSelectionMode(false); setSelectedIds([]) }} className="flex items-center gap-1 p-2 hover:bg-white/10 rounded-lg transition-colors">
              <X size={20} className="text-white" />
              <span className="text-sm font-medium">Cancelar</span>
            </button>
            <span className="font-bold text-white ml-2">{selectedIds.length} seleccionados</span>
          </div>
          <div className="flex items-center gap-2">
            {selectedIds.length === 1 && (
              <button onClick={() => { setReplyToMsg(messages.find(m => m.id === selectedIds[0])); setSelectionMode(false); setSelectedIds([]) }} className="p-2 hover:bg-white/10 rounded-full" title="Responder">
                <MessageSquare size={20} className="text-white" />
              </button>
            )}
            {canDeleteSelected && (
              <button onClick={handleDeleteSelected} className="flex items-center gap-1 p-2 hover:bg-red-500/50 rounded-lg transition-colors" title="Eliminar seleccionados">
                <Trash2 size={20} className="text-white" />
                <span className="text-sm font-medium">Eliminar</span>
              </button>
            )}
          </div>
        </div>
      ) : activeMessage ? (
        /* ── ACTION BAR (when message is long-pressed) ── */
        <div className="chat-header chat-action-header z-[60]">
          <div className="flex items-center gap-2">
            <button onClick={handleCloseActions} className="chat-action-header-btn">
              <X size={20} />
            </button>
            <span className="chat-action-header-label">
              {activeMessage.message.profiles?.name || 'Mensaje'}
            </span>
          </div>
          <div className="chat-action-buttons-wrapper">
            <button onClick={() => { handleCloseActions(); setReplyToMsg(activeMessage.message) }} className="chat-action-header-btn" title="Responder">
              <MessageSquare size={20} />
            </button>
            <button onClick={() => { handleCloseActions(); toggleSelection(activeMessage.message.id, true) }} className="chat-action-header-btn" title="Seleccionar">
              <CheckSquare size={20} />
            </button>
            <button onClick={() => { handleCloseActions(); handleCopy(activeMessage.message) }} className="chat-action-header-btn" title="Copiar">
              <Copy size={20} />
            </button>
            <button onClick={() => { handleCloseActions(); setForwardingMessage(activeMessage.message) }} className="chat-action-header-btn" title="Reenviar">
              <Forward size={20} />
            </button>
            <button onClick={() => { handleCloseActions(); handleShare(activeMessage.message) }} className="chat-action-header-btn" title="Compartir">
              <Share2 size={20} />
            </button>
            {activeMessage.isOwn && (
              <button onClick={() => { const id = activeMessage.message.id; handleCloseActions(); deleteMessage(id) }} className="chat-action-header-btn chat-action-header-btn-danger" title="Eliminar">
                <Trash2 size={20} />
              </button>
            )}
          </div>
        </div>
      ) : (
        <div className="chat-header z-20">
          <div className="chat-header-left">
            <button onClick={() => setShowChannels(!showChannels)} className="chat-header-btn">
              <Users size={18} />
            </button>
            <div className="chat-header-channel">
              <div className="chat-header-channel-icon">
                <Hash size={16} />
              </div>
              <div>
                <h2 className="chat-header-title">{activeChannelData?.name || 'General'}</h2>
                <div className="flex items-center gap-1">
                  <p className="chat-header-desc">{activeChannelData?.description || 'Canal comunitario'}</p>
                  {activeChannelData?.expiration_hours && (
                    <span className="flex items-center gap-0.5 text-[9px] text-amber-500 font-bold bg-amber-500/10 px-1 rounded">
                      <Clock size={8} /> {activeChannelData.expiration_hours}h
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
          <div className="chat-header-right relative">
            <button onClick={() => setShowSettings(!showSettings)} className="chat-header-btn" title="Ajustes">
              <MoreVertical size={18} />
            </button>
            {showSettings && (
              <>
                <div className="fixed inset-0 z-30" onClick={() => setShowSettings(false)} />
                <div className="absolute right-0 top-full mt-2 w-56 bg-slate-800 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-40">
                  <div className="p-2 border-b border-slate-700">
                    <span className="text-xs font-bold text-slate-400 uppercase ml-2">Fondo de Chat</span>
                    <button onClick={() => setChatBackground('default')} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${chatBackground==='default'?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>Predeterminado</button>
                    <button onClick={() => setChatBackground('doodle')} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${chatBackground==='doodle'?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>Doodles Claro</button>
                    <button onClick={() => setChatBackground('dark-doodle')} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${chatBackground==='dark-doodle'?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>Doodles Oscuro</button>
                    <button onClick={() => setChatBackground('solid-blue')} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${chatBackground==='solid-blue'?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>Azul Sólido</button>
                  </div>
                  <div className="p-2">
                    <span className="text-xs font-bold text-slate-400 uppercase ml-2">Mensajes Temporales</span>
                    <button onClick={() => updateChannelExpiration(activeChannel, 0)} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${!activeChannelData?.expiration_hours?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>Desactivada</button>
                    <button onClick={() => updateChannelExpiration(activeChannel, 24)} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${activeChannelData?.expiration_hours===24?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>24 horas</button>
                    <button onClick={() => updateChannelExpiration(activeChannel, 168)} className={`w-full text-left px-3 py-2 text-sm mt-1 rounded-lg ${activeChannelData?.expiration_hours===168?'bg-blue-600 text-white':'text-slate-200 hover:bg-slate-700'}`}>7 días</button>
                  </div>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* ── CHANNEL SIDEBAR ── */}
      {showChannels && (
        <>
          <div className="chat-sidebar-backdrop" onClick={() => setShowChannels(false)} />
          <div className="chat-sidebar">
            <div className="chat-sidebar-header">
              <div className="chat-sidebar-logo">
                <Shield size={20} />
                <span>MinerAlert</span>
              </div>
              <button onClick={() => setShowChannels(false)} className="chat-sidebar-close"><X size={18} /></button>
            </div>
            <div className="chat-sidebar-section">
              <div className="chat-sidebar-section-title"><ChevronDown size={12} /><span>CANALES</span></div>
              <div className="chat-sidebar-list">
                {channels.map((ch, i) => {
                  const ChannelIcon = channelIcons[ch.name] || Hash
                  return (
                    <button key={ch.id} onClick={() => { setActiveChannel(ch.id); setShowChannels(false) }}
                      className={`chat-sidebar-item ${ch.id === activeChannel ? 'chat-sidebar-item-active' : ''}`}
                      style={{ animationDelay: `${i * 60}ms` }}>
                      <ChannelIcon size={16} /><span>{ch.name}</span>
                      {ch.id === activeChannel && <div className="chat-sidebar-item-indicator" />}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </>
      )}

      {/* ── DIMMED BACKDROP ── */}
      {activeMessage && (
        <div className="chat-action-backdrop" onClick={handleCloseActions} />
      )}

      {/* ── FORWARD MODAL ── */}
      {forwardingMessage && (
        <>
          <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm" onClick={() => setForwardingMessage(null)} />
          <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 z-[80] w-[90%] max-w-sm bg-slate-800 rounded-2xl shadow-2xl overflow-hidden border border-slate-700/50">
            <div className="p-4 border-b border-slate-700 flex justify-between items-center bg-slate-800/80">
              <h3 className="text-white font-bold text-sm">Reenviar a...</h3>
              <button onClick={() => setForwardingMessage(null)} className="text-slate-400 hover:text-white"><X size={18} /></button>
            </div>
            <div className="max-h-60 overflow-y-auto p-2">
              {channels.map((ch) => {
                const ChannelIcon = channelIcons[ch.name] || Hash
                return (
                  <button 
                    key={ch.id}
                    onClick={async () => {
                      setForwardingMessage(null)
                      await forwardMessage(forwardingMessage, ch.id, user.id)
                      alert(`Mensaje reenviado a ${ch.name}`)
                    }}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-700/50 rounded-xl transition-colors text-left"
                  >
                    <div className="w-10 h-10 rounded-full bg-slate-700 flex items-center justify-center text-blue-400">
                      <ChannelIcon size={20} />
                    </div>
                    <span className="text-white font-medium flex-1">{ch.name}</span>
                    <ChevronRight size={16} className="text-slate-500" />
                  </button>
                )
              })}
            </div>
          </div>
        </>
      )}

      {/* ── MESSAGES ── */}
      <div ref={scrollContainerRef} onScroll={handleScroll} className="chat-messages" style={{ fontFamily: chatFont, fontSize: chatFontSize }}>
        {loading && messages.length === 0 ? (
          <div className="chat-loading">
            <Loader2 size={28} className="animate-spin text-blue-500" />
            <span>Cargando...</span>
          </div>
        ) : filteredMessages.length === 0 ? (
          <div className="chat-empty">
            <Sparkles size={40} className="text-blue-500 mb-2" />
            <h3>¡Bienvenido a #{activeChannelData?.name || 'general'}!</h3>
            <p>Sé el primero en enviar un mensaje.</p>
          </div>
        ) : (
          <div className="chat-messages-inner">
            {loading && <div className="chat-loading-more"><Loader2 size={16} className="animate-spin" /></div>}
            {filteredMessages.map((msg, i) => (
              <ChatBubble
                key={msg.id} message={msg} index={i}
                isOwn={msg.user_id === user?.id}
                selectionMode={selectionMode}
                isSelected={selectedIds.includes(msg.id)}
                toggleSelection={toggleSelection}
                onDelete={(id) => deleteMessage(id)}
                onShare={handleShare}
                onReply={(m) => setReplyToMsg(m)}
                onViewMedia={(mediaList, initialIndex) => setMediaToView({ mediaList, initialIndex })}
                activeMessageId={activeMessage?.message?.id}
                onOpenActions={handleOpenActions}
                onCloseActions={handleCloseActions}
                onReaction={handleReaction}
              />
            ))}
            <div ref={messagesEndRef} className="chat-anchor" />
          </div>
        )}
      </div>

      {showScrollBtn && !selectionMode && (
        <button onClick={scrollToBottom} className="chat-scroll-fab">
          <ArrowDown size={18} />
          {unreadCount > 0 && <span className="chat-scroll-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>}
        </button>
      )}

      {/* ── INPUT AREA ── */}
      {!selectionMode && (
        <div className="chat-input-area">
          {replyToMsg && (
            <div className="px-4 py-2 bg-slate-800/80 border-t border-slate-700/50 flex justify-between items-center z-10 w-full relative">
              <div className="flex-1 min-w-0 border-l-4 border-blue-500 pl-2 flex gap-2 items-center">
                {(replyToMsg.type === 'IMAGE' || replyToMsg.type === 'VIDEO' || replyToMsg.type === 'LOCATION') && replyToMsg.media_url && (
                  <div className="chat-reply-thumb-wrapper shrink-0 h-10 w-10">
                    {replyToMsg.type === 'IMAGE' ? (
                      <img src={replyToMsg.media_url} alt="" className="w-full h-full object-cover rounded-md" loading="lazy" />
                    ) : replyToMsg.type === 'VIDEO' ? (
                      <video src={replyToMsg.media_url} className="w-full h-full object-cover rounded-md" />
                    ) : (
                      <div className="w-full h-full bg-slate-700 flex items-center justify-center text-red-400 rounded-md">
                        <MapPin size={20} />
                      </div>
                    )}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <span className="text-xs font-bold text-blue-400 block truncate">Repondiendo a {replyToMsg.profiles?.name || 'Usuario'}</span>
                  <span className="text-xs text-slate-300 truncate block">{replyToMsg.type === 'TEXT' ? replyToMsg.content : 'Multimedia'}</span>
                </div>
              </div>
              <button onClick={() => setReplyToMsg(null)} className="p-1 rounded-full hover:bg-slate-700"><X size={16} /></button>
            </div>
          )}
          <VoiceRecorderBar
            onUpload={handleMediaUpload}
            onSendLocation={handleLocationSend}
            onSendFile={handleFileSend}
            onOpenCamera={() => setShowCamera(true)}
            onOpenEditor={(files) => setEditorFiles(files)}
            text={text}
            setText={setText}
            sending={sending}
            handleSend={handleSend}
            inputRef={inputRef}
            activeChannelData={activeChannelData}
            showEmoji={showEmoji}
            setShowEmoji={setShowEmoji}
            handleEmojiSelect={handleEmojiSelect}
          />
        </div>
      )}
      {/* Media Viewer Overlay */}
      {mediaToView && (
        <MediaViewer mediaList={mediaToView.mediaList} initialIndex={mediaToView.initialIndex || 0} onClose={() => setMediaToView(null)} />
      )}

      {/* Camera */}
      {showCamera && (
        <CameraCapture onCapture={handleCameraCapture} onClose={() => setShowCamera(false)} />
      )}

      {/* Media Editor */}
      {editorFiles && (
        <MediaEditor files={editorFiles} onSend={handleEditorSend} onClose={() => setEditorFiles(null)} />
      )}
    </div>
  )
}
