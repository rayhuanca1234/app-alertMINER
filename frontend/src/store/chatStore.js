import { create } from 'zustand'
import { fetchWithAuth, getBackendUrl } from '../lib/auth_client'
import { uploadFileToR2, deleteFileFromR2 } from '../lib/cloudflare_client'

const triggerChatPush = async (messageData) => {
  try {
    const payload = {
      ...messageData,
      sender_name: messageData.profiles?.name || 'Alguien',
      avatar_url: messageData.profiles?.avatar_url
    }
    const backendUrl = getBackendUrl()
    await fetch(`${backendUrl}/api/push/broadcast-chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: payload })
    })
  } catch (e) {
    console.error('Error triggering chat push:', e)
  }
}

const DEFAULT_CHANNEL_ID = '00000000-0000-0000-0000-000000000001'

export const useChatStore = create((set, get) => ({
  messages: [],
  channels: [],
  activeChannel: DEFAULT_CHANNEL_ID,
  loading: false,
  hasMore: true,
  error: null,
  dbReady: false,
  replyTo: null,

  setActiveChannel: (channelId) => {
    set({ activeChannel: channelId, messages: [], hasMore: true, error: null, replyTo: null })
  },

  setReplyTo: (message) => set({ replyTo: message }),
  clearReplyTo: () => set({ replyTo: null }),

  ensureDbReady: async () => {
    if (get().dbReady) return true
    try {
      const res = await fetchWithAuth('/api/data/channels', { redirectOn401: false })
      if (!res.ok) {
        set({ error: `Error conectando con Cloudflare D1 (${res.status})` })
        return false
      }
      set({ dbReady: true, error: null })
      return true
    } catch (e) {
      set({ error: `Error de conexión: ${e.message}` })
      return false
    }
  },

  fetchChannels: async () => {
    const ready = await get().ensureDbReady()
    if (!ready) return
    try {
      const res = await fetchWithAuth('/api/data/channels', { redirectOn401: false })
      if (res.ok) {
        const { data } = await res.json()
        if (data && data.length > 0) {
          set({ channels: data })
          if (!data.find(c => c.id === get().activeChannel)) {
            set({ activeChannel: data[0].id })
          }
        }
      }
    } catch (e) {
      console.error('Error fetching channels:', e)
    }
  },

  fetchMessages: async (limit = 50) => {
    const ready = await get().ensureDbReady()
    if (!ready) return
    set({ loading: true })
    const channelId = get().activeChannel

    try {
      const res = await fetchWithAuth(
        `/api/data/messages?channel_id=${encodeURIComponent(channelId)}&limit=${limit}`,
        { redirectOn401: false }
      )
      if (!res.ok) {
        set({ loading: false, error: `Error cargando mensajes (${res.status})` })
        return
      }
      const { data } = await res.json()
      if (data) {
        set({ messages: [...data].reverse(), hasMore: data.length === limit, error: null })
      }
    } catch (e) {
      set({ error: `Error cargando mensajes: ${e.message}` })
    }
    set({ loading: false })
  },

  loadMoreMessages: async () => {
    const state = get()
    if (!state.hasMore || state.loading) return
    set({ loading: true })
    const oldest = state.messages[0]
    if (!oldest) return set({ loading: false })

    try {
      const res = await fetchWithAuth(
        `/api/data/messages?channel_id=${encodeURIComponent(state.activeChannel)}&before=${encodeURIComponent(oldest.created_at)}&limit=30`,
        { redirectOn401: false }
      )
      if (res.ok) {
        const { data } = await res.json()
        if (data) {
          set({
            messages: [...data.reverse(), ...state.messages],
            hasMore: data.length === 30
          })
        }
      }
    } catch (e) {
      console.error('Error loading more messages:', e)
    }
    set({ loading: false })
  },

  addMessage: (message) => {
    set((state) => {
      if (state.messages.find(m => m.id === message.id)) return state
      return { messages: [...state.messages, { ...message, reactions: message.reactions || [] }] }
    })
  },

  sendTextMessage: async (content, userId, replyId) => {
    const state = get()
    const channelId = state.activeChannel
    const insertData = {
      user_id: userId,
      channel_id: channelId,
      type: 'TEXT',
      content,
    }
    if (replyId) insertData.reply_to = replyId

    try {
      const res = await fetchWithAuth('/api/data/messages', {
        method: 'POST',
        body: JSON.stringify(insertData)
      })
      const { data, error } = await res.json()
      if (!res.ok || error) return { error: new Error(error || 'Error enviando mensaje') }

      if (data) {
        get().addMessage(data)
        set({ replyTo: null })

        const channel = get().currentChannel
        if (channel) {
          channel.send({ type: 'broadcast', event: 'new_message', payload: data })
        }

        const { useNotificationStore } = await import('./notificationStore')
        const globalChannel = useNotificationStore.getState().globalChannel
        if (globalChannel) {
          globalChannel.send({
            type: 'broadcast',
            event: 'new_notification',
            payload: {
              id: data.id,
              sender_id: userId,
              title: `💬 ${data.profiles?.name || 'Alguien'}`,
              message: content,
              type: 'chat',
              related_id: channelId,
              is_read: false,
              created_at: new Date().toISOString()
            }
          })
        }
        triggerChatPush(data)
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  },

  sendMediaMessage: async (file, type, userId, replyId, caption) => {
    const state = get()
    const channelId = state.activeChannel

    const localId = 'temp-' + Date.now()
    const contentLabel = caption || (type === 'IMAGE' ? '📷 Imagen' : type === 'VIDEO' ? '🎬 Video' : '🎤 Audio')
    const localUrl = URL.createObjectURL(file)

    const tempMessage = {
      id: localId,
      user_id: userId,
      channel_id: channelId,
      type,
      content: contentLabel,
      media_url: localUrl,
      status: 'uploading',
      created_at: new Date().toISOString(),
      profiles: { name: 'Tú' }
    }
    get().addMessage(tempMessage)

    try {
      const uploaded = await uploadFileToR2(file)
      const mediaUrl = uploaded.publicUrl

      const insertData = {
        user_id: userId,
        channel_id: channelId,
        type,
        content: contentLabel,
        media_url: mediaUrl
      }
      if (replyId) insertData.reply_to = replyId

      const res = await fetchWithAuth('/api/data/messages', {
        method: 'POST',
        body: JSON.stringify(insertData)
      })
      const { data, error } = await res.json()
      if (!res.ok || error) {
        set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
        return { error: new Error(error || 'Error guardando mensaje') }
      }

      if (data) {
        set(s => ({ messages: s.messages.map(m => m.id === localId ? { ...data, reactions: [] } : m) }))
        set({ replyTo: null })

        const channel = get().currentChannel
        if (channel) {
          channel.send({ type: 'broadcast', event: 'new_message', payload: data })
        }

        const { useNotificationStore } = await import('./notificationStore')
        const globalChannel = useNotificationStore.getState().globalChannel
        if (globalChannel) {
          globalChannel.send({
            type: 'broadcast',
            event: 'new_notification',
            payload: {
              id: data.id,
              sender_id: userId,
              title: `💬 ${data.profiles?.name || 'Alguien'}`,
              message: contentLabel,
              type: 'chat',
              related_id: channelId,
              is_read: false,
              created_at: new Date().toISOString()
            }
          })
        }
        triggerChatPush({ ...data, content: contentLabel })
      }
      return { error: null }
    } catch (error) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error }
    }
  },

  sendMultipleMediaMessage: async (files, type, userId, replyId, caption) => {
    const state = get()
    const channelId = state.activeChannel

    const localId = 'temp-' + Date.now()
    const localUrls = files.map(f => URL.createObjectURL(f))
    const tempMessage = {
      id: localId,
      user_id: userId,
      channel_id: channelId,
      type: files.length > 1 ? 'MULTIPLE_MEDIA' : type,
      content: caption || 'Subiendo multimedia...',
      media_urls: localUrls,
      status: 'uploading',
      created_at: new Date().toISOString(),
      profiles: { name: 'Tú' }
    }
    get().addMessage(tempMessage)

    try {
      const uploadPromises = files.map(async (file) => {
        try {
          const uploaded = await uploadFileToR2(file)
          return uploaded.publicUrl
        } catch {
          return null
        }
      })

      const urls = await Promise.all(uploadPromises)
      const validUrls = urls.filter(Boolean)

      if (validUrls.length === 0) {
        set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
        return { error: new Error('Error subiendo archivos a R2') }
      }

      const insertData = {
        user_id: userId,
        channel_id: channelId,
        type: validUrls.length > 1 ? 'MULTIPLE_MEDIA' : type,
        content: caption || (type === 'IMAGE' ? '📷 Imagen' : '🎬 Video'),
        media_urls: validUrls
      }
      if (validUrls.length === 1) {
        insertData.media_url = validUrls[0]
        insertData.media_urls = null
      }
      if (replyId) insertData.reply_to = replyId

      const res = await fetchWithAuth('/api/data/messages', {
        method: 'POST',
        body: JSON.stringify(insertData)
      })
      const { data, error } = await res.json()
      if (!res.ok || error) {
        set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
        return { error: new Error(error || 'Error guardando multimedia') }
      }

      set(s => ({ messages: s.messages.map(m => m.id === localId ? { ...data, reactions: [] } : m) }))
      set({ replyTo: null })

      const channel = get().currentChannel
      if (channel) {
        channel.send({ type: 'broadcast', event: 'new_message', payload: data })
      }
      triggerChatPush(data)
      return { error: null }
    } catch (error) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error }
    }
  },

  sendFileMessage: async (file, userId, replyId) => {
    const state = get()
    const channelId = state.activeChannel

    const localId = 'temp-' + Date.now()
    const tempMessage = {
      id: localId,
      user_id: userId,
      channel_id: channelId,
      type: 'FILE',
      content: file.name,
      file_metadata: { name: file.name, size: file.size },
      status: 'uploading',
      created_at: new Date().toISOString(),
      profiles: { name: 'Tú' }
    }
    get().addMessage(tempMessage)

    try {
      const uploaded = await uploadFileToR2(file)
      const insertData = {
        user_id: userId,
        channel_id: channelId,
        type: 'FILE',
        content: '📎 Documento adjunto',
        media_url: uploaded.publicUrl,
        file_metadata: { name: file.name, size: file.size }
      }
      if (replyId) insertData.reply_to = replyId

      const res = await fetchWithAuth('/api/data/messages', {
        method: 'POST',
        body: JSON.stringify(insertData)
      })
      const { data, error } = await res.json()
      if (!res.ok || error) {
        set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
        return { error: new Error(error || 'Error enviando archivo') }
      }

      set(s => ({ messages: s.messages.map(m => m.id === localId ? { ...data, reactions: [] } : m) }))
      set({ replyTo: null })
      const channel = get().currentChannel
      if (channel) {
        channel.send({ type: 'broadcast', event: 'new_message', payload: data })
      }
      triggerChatPush(data)
      return { error: null }
    } catch (error) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error }
    }
  },

  sendLocationMessage: async (content, lat, lng, userId, replyId) => {
    const state = get()
    const channelId = state.activeChannel
    const insertData = {
      user_id: userId,
      channel_id: channelId,
      type: 'LOCATION',
      content: content || '📍 Ubicación compartida',
      media_url: `${lat},${lng}`
    }
    if (replyId) insertData.reply_to = replyId

    try {
      const res = await fetchWithAuth('/api/data/messages', {
        method: 'POST',
        body: JSON.stringify(insertData)
      })
      const { data, error } = await res.json()
      if (!res.ok || error) return { error: new Error(error || 'Error enviando ubicación') }

      if (data) {
        get().addMessage(data)
        set({ replyTo: null })

        const channel = get().currentChannel
        if (channel) {
          channel.send({ type: 'broadcast', event: 'new_message', payload: data })
        }

        const { useNotificationStore } = await import('./notificationStore')
        const globalChannel = useNotificationStore.getState().globalChannel
        if (globalChannel) {
          globalChannel.send({
            type: 'broadcast',
            event: 'new_notification',
            payload: {
              id: data.id,
              sender_id: userId,
              title: `💬 ${data.profiles?.name || 'Alguien'}`,
              message: insertData.content,
              type: 'chat',
              related_id: channelId,
              is_read: false,
              created_at: new Date().toISOString()
            }
          })
        }
        triggerChatPush({ ...data, content: insertData.content })
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  },

  forwardMessage: async (message, targetChannelId, userId) => {
    const insertData = {
      user_id: userId,
      channel_id: targetChannelId,
      type: message.type,
      content: message.content,
      media_url: message.media_url
    }

    try {
      const res = await fetchWithAuth('/api/data/messages', {
        method: 'POST',
        body: JSON.stringify(insertData)
      })
      const { data, error } = await res.json()
      if (!res.ok || error) return { error: new Error(error || 'Error reenviando mensaje') }

      if (data && get().activeChannel === targetChannelId) {
        get().addMessage(data)
        const channel = get().currentChannel
        if (channel) {
          channel.send({ type: 'broadcast', event: 'new_message', payload: data })
        }
      }

      if (data) {
        const { useNotificationStore } = await import('./notificationStore')
        const globalChannel = useNotificationStore.getState().globalChannel
        if (globalChannel) {
          globalChannel.send({
            type: 'broadcast',
            event: 'new_notification',
            payload: {
              id: data.id,
              sender_id: userId,
              title: `💬 ${data.profiles?.name || 'Alguien'}`,
              message: message.type === 'TEXT' ? message.content : 'Multimedia (Reenviado)',
              type: 'chat',
              related_id: targetChannelId,
              is_read: false,
              created_at: new Date().toISOString()
            }
          })
        }
        triggerChatPush({ ...data, content: message.type === 'TEXT' ? message.content : 'Multimedia (Reenviado)' })
      }
      return { error: null }
    } catch (error) {
      return { error }
    }
  },

  toggleReaction: async (messageId, emoji, userId) => {
    const state = get()
    const msg = state.messages.find(m => m.id === messageId)
    if (!msg) return

    const existing = msg.reactions?.find(r => r.user_id === userId && r.emoji === emoji)
    const channel = get().currentChannel

    if (existing) {
      await fetchWithAuth(`/api/data/reactions/${existing.id}`, { method: 'DELETE' })
      set({
        messages: state.messages.map(m =>
          m.id === messageId
            ? { ...m, reactions: m.reactions.filter(r => r.id !== existing.id) }
            : m
        )
      })
      if (channel) {
        channel.send({ type: 'broadcast', event: 'reaction_remove', payload: { messageId, reactionId: existing.id } })
      }
    } else {
      const res = await fetchWithAuth('/api/data/reactions', {
        method: 'POST',
        body: JSON.stringify({ message_id: messageId, emoji })
      })
      if (res.ok) {
        const { data } = await res.json()
        if (data) {
          set({
            messages: state.messages.map(m =>
              m.id === messageId
                ? { ...m, reactions: [...(m.reactions || []), data] }
                : m
            )
          })
          if (channel) {
            channel.send({ type: 'broadcast', event: 'reaction_add', payload: { messageId, reaction: data } })
          }
        }
      }
    }
  },

  deleteMessage: async (messageId) => {
    const state = get()
    const msg = state.messages.find(m => m.id === messageId)

    if (msg && msg.media_url && msg.media_url.includes('videos/')) {
      try {
        const idx = msg.media_url.indexOf('videos/')
        const objectPath = msg.media_url.slice(idx).split('?')[0]
        await deleteFileFromR2(objectPath)
      } catch (e) {
        console.error('Failed to delete media from R2', e)
      }
    }

    try {
      const res = await fetchWithAuth(`/api/data/messages/${messageId}`, { method: 'DELETE' })
      if (res.ok) {
        set((state) => ({
          messages: state.messages.filter(m => m.id !== messageId)
        }))
        const channel = get().currentChannel
        if (channel) {
          channel.send({ type: 'broadcast', event: 'delete_message', payload: { id: messageId } })
        }
        return { error: null }
      }
      return { error: new Error('Error eliminando mensaje') }
    } catch (error) {
      return { error }
    }
  },

  updateChannelExpiration: async (channelId, hours) => {
    const value = hours === 0 ? null : hours
    try {
      const res = await fetchWithAuth(`/api/data/channels/${channelId}`, {
        method: 'PUT',
        body: JSON.stringify({ expiration_hours: value })
      })
      if (res.ok) {
        set((state) => ({
          channels: state.channels.map(c => c.id === channelId ? { ...c, expiration_hours: value } : c)
        }))
        return { error: null }
      }
      return { error: new Error('Error actualizando canal') }
    } catch (error) {
      return { error }
    }
  }
}))
