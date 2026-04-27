import React, { useMemo } from 'react'
import { useAuthStore } from '../store/authStore'

// Detect URLs in text and render them as clickable links
function renderContent(text) {
  if (!text) return null
  const urlRegex = /(https?:\/\/[^\s]+)/g
  const parts = text.split(urlRegex)
  return parts.map((part, i) => {
    if (urlRegex.test(part)) {
      return (
        <a key={i} href={part} target="_blank" rel="noopener noreferrer"
          className="text-blue-400 underline hover:text-blue-300 break-all">
          {part}
        </a>
      )
    }
    return <span key={i}>{part}</span>
  })
}

function timeAgo(date) {
  const now = new Date()
  const diff = (now - new Date(date)) / 1000
  if (diff < 60) return 'ahora'
  if (diff < 3600) return `${Math.floor(diff / 60)}m`
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`
  return new Date(date).toLocaleDateString('es-PE', { day: '2-digit', month: 'short' })
}

export default function ChatMessage({ message }) {
  const { user } = useAuthStore()
  const isOwn = message.user_id === user?.id
  const profile = message.profiles
  const initials = (profile?.name || '?').slice(0, 2).toUpperCase()
  const avatarUrl = profile?.avatar_url

  const mediaContent = useMemo(() => {
    if (!message.media_url) return null
    
    switch (message.type) {
      case 'IMAGE':
        return (
          <div className="mt-2 rounded-xl overflow-hidden max-w-[280px]">
            <img src={message.media_url} alt="Imagen" loading="lazy"
              className="w-full h-auto rounded-xl cursor-pointer hover:opacity-90 transition-opacity"
              onClick={() => window.open(message.media_url, '_blank')} />
          </div>
        )
      case 'VIDEO':
        return (
          <div className="mt-2 rounded-xl overflow-hidden max-w-[300px]">
            <video src={message.media_url} controls preload="metadata"
              className="w-full rounded-xl" />
          </div>
        )
      case 'AUDIO':
        return (
          <div className="mt-2 w-full max-w-[260px]">
            <audio src={message.media_url} controls preload="metadata"
              className="w-full h-10" />
          </div>
        )
      default:
        return null
    }
  }, [message.media_url, message.type])

  return (
    <div className={`flex gap-3 px-4 py-2 hover:bg-slate-800/30 transition-colors ${isOwn ? 'flex-row-reverse' : ''}`}>
      {/* Avatar */}
      <div className="shrink-0">
        {avatarUrl ? (
          <img src={avatarUrl} alt="" referrerPolicy="no-referrer" className="w-9 h-9 rounded-full object-cover ring-2 ring-slate-700" />
        ) : (
          <div className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${isOwn ? 'bg-blue-600' : 'bg-emerald-600'}`}>
            {initials}
          </div>
        )}
      </div>

      {/* Content */}
      <div className={`flex flex-col max-w-[75%] ${isOwn ? 'items-end' : 'items-start'}`}>
        <div className="flex items-center gap-2 mb-0.5">
          <span className={`text-xs font-bold ${isOwn ? 'text-blue-400' : 'text-emerald-400'}`}>
            {profile?.name || 'Anónimo'}
          </span>
          <span className="text-[10px] text-slate-500">{timeAgo(message.created_at)}</span>
        </div>

        <div className={`rounded-2xl px-4 py-2.5 ${
          isOwn 
            ? 'bg-blue-600/80 rounded-tr-sm' 
            : 'bg-slate-700/80 rounded-tl-sm'
        }`}>
          {message.type === 'TEXT' && (
            <p className="text-sm leading-relaxed whitespace-pre-wrap break-words">
              {renderContent(message.content)}
            </p>
          )}
          {mediaContent}
        </div>
      </div>
    </div>
  )
}
