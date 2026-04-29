import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  globalChannel: null,

  setGlobalChannel: (channel) => set({ globalChannel: channel }),

  fetchNotifications: async (userId) => {
    set({ loading: true })
    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50)

    if (!error && data) {
      set({
        notifications: data,
        unreadCount: data.filter(n => !n.is_read).length,
        loading: false
      })
    } else {
      set({ loading: false })
    }
  },

  markAsRead: async (notificationId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('id', notificationId)

    if (!error) {
      set(state => {
        const next = state.notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
        return {
          notifications: next,
          unreadCount: next.filter(n => !n.is_read).length
        }
      })
    }
  },

  markAllAsRead: async (userId) => {
    const { error } = await supabase
      .from('notifications')
      .update({ is_read: true })
      .eq('user_id', userId)
      .eq('is_read', false)

    if (!error) {
      set(state => ({
        notifications: state.notifications.map(n => ({ ...n, is_read: true })),
        unreadCount: 0
      }))
    }
  },

  activeToast: null,

  showToast: (title, body, iconUrl = null, type = null) => {
    const toast = { id: Date.now(), title, body, iconUrl, type }
    set({ activeToast: toast })
    setTimeout(() => {
      if (get().activeToast?.id === toast.id) {
        set({ activeToast: null })
      }
    }, 4500)
  },

  hideToast: () => set({ activeToast: null }),

  addNotificationLocally: (payload) => {
    set(state => {
      // Prevent duplicates by id AND by related_id (covers both 'sent-X' and broadcast 'X')
      const alreadyExists =
        state.notifications.find(n => n.id === payload.id) ||
        (payload.related_id &&
          state.notifications.find(
            n => n.related_id === payload.related_id && n.type === payload.type
          ))
      if (alreadyExists) return state

      const normalizedPayload = {
        ...payload,
        body: payload.body || payload.message // Ensure body exists for InboxPanel
      }

      // If it's a chat message, we don't want it in the Inbox. Just skip adding it to the state array.
      if (normalizedPayload.type === 'chat') {
        return state
      }

      const next = [normalizedPayload, ...state.notifications]
      return {
        notifications: next,
        unreadCount: next.filter(n => !n.is_read).length
      }
    })

    // Trigger in-app WhatsApp-style toast automatically for ALL types (including chat)
    get().showToast(payload.title, payload.body || payload.message, payload.metadata?.sender_avatar, payload.type)
  }
}))
