import { create } from 'zustand'
import { supabase } from '../lib/supabase'

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
      const { data, error } = await supabase.from('channels').select('id').limit(1)
      if (error) {
        set({ error: `Base de datos no configurada. (${error.message})` })
        return false
      }
      if (!data || data.length === 0) {
        await supabase.from('channels').insert([
          { id: '00000000-0000-0000-0000-000000000001', name: 'General', description: 'Canal principal de comunicación comunitaria' },
          { id: '00000000-0000-0000-0000-000000000002', name: 'Alertas', description: 'Canal automático de alertas de seguridad' },
          { id: '00000000-0000-0000-0000-000000000003', name: 'Coordinación', description: 'Canal de coordinación y logística' },
        ])
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
    const { data } = await supabase.from('channels').select('*').order('created_at', { ascending: true })
    if (data && data.length > 0) {
      set({ channels: data })
      if (!data.find(c => c.id === get().activeChannel)) {
        set({ activeChannel: data[0].id })
      }
    }
  },

  fetchMessages: async (limit = 50) => {
    const ready = await get().ensureDbReady()
    if (!ready) return
    set({ loading: true })
    const channelId = get().activeChannel

    // Fetch messages with profile + reply info
    const { data, error } = await supabase
      .from('messages')
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .eq('channel_id', channelId)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      set({ loading: false, error: `Error cargando mensajes: ${error.message}` })
      return
    }

    if (data) {
      // Fetch reactions for these messages
      const msgIds = data.map(m => m.id)
      const { data: reactions } = await supabase
        .from('message_reactions')
        .select('*, profiles(name)')
        .in('message_id', msgIds)

      const reactionsMap = {}
      if (reactions) {
        reactions.forEach(r => {
          if (!reactionsMap[r.message_id]) reactionsMap[r.message_id] = []
          reactionsMap[r.message_id].push(r)
        })
      }

      const enriched = data.map(m => ({ ...m, reactions: reactionsMap[m.id] || [] }))
      set({ messages: enriched.reverse(), hasMore: data.length === limit, error: null })
    }
    set({ loading: false })
  },

  loadMoreMessages: async () => {
    const state = get()
    if (!state.hasMore || state.loading) return
    set({ loading: true })
    const oldest = state.messages[0]
    if (!oldest) return set({ loading: false })

    const { data } = await supabase
      .from('messages')
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .eq('channel_id', state.activeChannel)
      .lt('created_at', oldest.created_at)
      .order('created_at', { ascending: false })
      .limit(30)

    if (data) {
      set({
        messages: [...data.reverse().map(m => ({ ...m, reactions: [] })), ...state.messages],
        hasMore: data.length === 30
      })
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

    const { data, error } = await supabase.from('messages')
      .insert(insertData)
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .single()

    if (error) return { error }
    if (data) { 
      get().addMessage(data); 
      set({ replyTo: null }) 
      
      const channel = get().currentChannel
      if (channel) {
        channel.send({ type: 'broadcast', event: 'new_message', payload: data })
      }
      
      // Also broadcast to global-notifications so users not in the chat receive the toast/inbox update
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
    }
    return { error: null }
  },

  sendMediaMessage: async (file, type, userId, replyId, caption) => {
    const state = get()
    const channelId = state.activeChannel
    
    // Optimistic UI
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

    const fileExt = file.name?.split('.').pop() || (type === 'AUDIO' ? 'webm' : 'bin')
    const filePath = `${channelId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`

    const { error: uploadError } = await supabase.storage
      .from('chat-media')
      .upload(filePath, file, { upsert: false })

    if (uploadError) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error: uploadError }
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath)
    const mediaUrl = urlData?.publicUrl

    const insertData = {
      user_id: userId,
      channel_id: channelId,
      type,
      content: contentLabel,
      media_url: mediaUrl
    }
    if (replyId) insertData.reply_to = replyId

    const { data, error } = await supabase.from('messages')
      .insert(insertData)
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .single()

    if (error) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error }
    }

    if (data) { 
      set(s => ({ messages: s.messages.map(m => m.id === localId ? { ...data, reactions: [] } : m) }))
      set({ replyTo: null }) 
      
      const channel = get().currentChannel
      if (channel) {
        channel.send({ type: 'broadcast', event: 'new_message', payload: data })
      }
      
      // Also broadcast to global-notifications
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
    }
    return { error: null }
  },

  sendMultipleMediaMessage: async (files, type, userId, replyId, caption) => {
    const state = get()
    const channelId = state.activeChannel

    // Optimistic UI update: local message
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

    // Upload files to Supabase
    const uploadPromises = files.map(async (file) => {
      const fileExt = file.name?.split('.').pop() || 'bin'
      const filePath = `${channelId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`
      const { error } = await supabase.storage.from('chat-media').upload(filePath, file)
      if (error) return null
      const { data } = supabase.storage.from('chat-media').getPublicUrl(filePath)
      return data?.publicUrl
    })

    const urls = await Promise.all(uploadPromises)
    const validUrls = urls.filter(Boolean)

    if (validUrls.length === 0) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error: new Error('Error subiendo archivos') }
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

    const { data, error } = await supabase.from('messages')
      .insert(insertData)
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .single()

    if (error) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error }
    }
    
    // Replace temp message
    set(s => ({ messages: s.messages.map(m => m.id === localId ? { ...data, reactions: [] } : m) }))
    set({ replyTo: null })
    
    const channel = get().currentChannel
    if (channel) {
      channel.send({ type: 'broadcast', event: 'new_message', payload: data })
    }
    return { error: null }
  },

  sendFileMessage: async (file, userId, replyId) => {
    const state = get()
    const channelId = state.activeChannel

    // Optimistic UI
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

    const fileExt = file.name?.split('.').pop() || 'bin'
    const filePath = `${channelId}/${Date.now()}_${Math.random().toString(36).substr(2, 9)}.${fileExt}`

    const { error: uploadError } = await supabase.storage.from('chat-media').upload(filePath, file)
    if (uploadError) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error: uploadError }
    }

    const { data: urlData } = supabase.storage.from('chat-media').getPublicUrl(filePath)
    
    const insertData = {
      user_id: userId,
      channel_id: channelId,
      type: 'FILE',
      content: '📎 Documento adjunto',
      media_url: urlData?.publicUrl,
      file_metadata: { name: file.name, size: file.size }
    }
    if (replyId) insertData.reply_to = replyId

    const { data, error } = await supabase.from('messages')
      .insert(insertData)
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .single()

    if (error) {
      set(s => ({ messages: s.messages.filter(m => m.id !== localId) }))
      return { error }
    }

    set(s => ({ messages: s.messages.map(m => m.id === localId ? { ...data, reactions: [] } : m) }))
    set({ replyTo: null })
    const channel = get().currentChannel
    if (channel) {
      channel.send({ type: 'broadcast', event: 'new_message', payload: data })
    }
    return { error: null }
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

    const { data, error } = await supabase.from('messages')
      .insert(insertData)
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .single()

    if (error) return { error }
    if (data) { 
      get().addMessage(data); 
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
    }
    return { error: null }
  },

  forwardMessage: async (message, targetChannelId, userId) => {
    const insertData = {
      user_id: userId,
      channel_id: targetChannelId,
      type: message.type,
      content: message.content,
      media_url: message.media_url
    }

    const { data, error } = await supabase.from('messages')
      .insert(insertData)
      .select('*, profiles(name, avatar_url), reply:reply_to(id, content, type, profiles(name), media_url, media_urls, file_metadata)')
      .single()

    if (error) return { error }
    
    // Si estamos en ese canal, actualizar la UI local
    if (data && get().activeChannel === targetChannelId) { 
      get().addMessage(data); 
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
    }
    return { error: null }
  },

  toggleReaction: async (messageId, emoji, userId) => {
    const state = get()
    const msg = state.messages.find(m => m.id === messageId)
    if (!msg) return

    const existing = msg.reactions?.find(r => r.user_id === userId && r.emoji === emoji)
    const channel = get().currentChannel

    if (existing) {
      await supabase.from('message_reactions').delete().eq('id', existing.id)
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
      const { data } = await supabase.from('message_reactions')
        .insert({ message_id: messageId, user_id: userId, emoji })
        .select('*, profiles(name)')
        .single()

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
  },

  deleteMessage: async (messageId) => {
    const state = get()
    const msg = state.messages.find(m => m.id === messageId)
    
    // Delete media from storage if it exists
    if (msg && msg.media_url) {
      try {
        const urlParts = msg.media_url.split('/chat-media/')
        if (urlParts.length > 1) {
          const filePath = urlParts[1].split('?')[0] // remove query params if any
          await supabase.storage.from('chat-media').remove([filePath])
        }
      } catch (e) {
        console.error('Failed to delete media from storage', e)
      }
    }

    const { error } = await supabase.from('messages').delete().eq('id', messageId)
    if (!error) {
      set((state) => ({
        messages: state.messages.filter(m => m.id !== messageId)
      }))
      
      const channel = get().currentChannel
      if (channel) {
        channel.send({ type: 'broadcast', event: 'delete_message', payload: { id: messageId } })
      }
    }
    return { error }
  },

  updateChannelExpiration: async (channelId, hours) => {
    const value = hours === 0 ? null : hours
    const { error } = await supabase.from('channels').update({ expiration_hours: value }).eq('id', channelId)
    if (!error) {
      set((state) => ({
        channels: state.channels.map(c => c.id === channelId ? { ...c, expiration_hours: value } : c)
      }))
    }
    return { error }
  }
}))
