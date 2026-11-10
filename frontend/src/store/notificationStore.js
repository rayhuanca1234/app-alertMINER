import { create } from 'zustand'
import { fetchWithAuth } from '../lib/auth_client'

export const useNotificationStore = create((set, get) => ({
  notifications: [],
  unreadCount: 0,
  loading: false,
  globalChannel: null,

  setGlobalChannel: (channel) => set({ globalChannel: channel }),

  fetchNotifications: async () => {
    set({ loading: true })
    try {
      const res = await fetchWithAuth('/api/data/notifications', { redirectOn401: false })
      if (res.ok) {
        const { data } = await res.json()
        if (data) {
          set({
            notifications: data,
            unreadCount: data.filter(n => !n.is_read).length,
            loading: false
          })
          return
        }
      }
    } catch (e) {
      console.error('Error fetching notifications:', e)
    }
    set({ loading: false })
  },

  markAsRead: async (notificationId) => {
    try {
      const res = await fetchWithAuth('/api/data/notifications/read', {
        method: 'PUT',
        body: JSON.stringify({ id: notificationId })
      })
      if (res.ok) {
        set(state => {
          const next = state.notifications.map(n => n.id === notificationId ? { ...n, is_read: true } : n)
          return {
            notifications: next,
            unreadCount: next.filter(n => !n.is_read).length
          }
        })
      }
    } catch (e) {
      console.error('Error marking notification as read:', e)
    }
  },

  markAllAsRead: async () => {
    try {
      const res = await fetchWithAuth('/api/data/notifications/read', {
        method: 'PUT',
        body: JSON.stringify({ all: true })
      })
      if (res.ok) {
        set(state => ({
          notifications: state.notifications.map(n => ({ ...n, is_read: true })),
          unreadCount: 0
        }))
      }
    } catch (e) {
      console.error('Error marking all notifications as read:', e)
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
      const alreadyExists =
        state.notifications.find(n => n.id === payload.id) ||
        (payload.related_id &&
          state.notifications.find(
            n => n.related_id === payload.related_id && n.type === payload.type
          ))
      if (alreadyExists) return state

      const normalizedPayload = {
        ...payload,
        body: payload.body || payload.message
      }

      if (normalizedPayload.type === 'chat') {
        return state
      }

      const next = [normalizedPayload, ...state.notifications]
      return {
        notifications: next,
        unreadCount: next.filter(n => !n.is_read).length
      }
    })

    get().showToast(payload.title, payload.body || payload.message, payload.metadata?.sender_avatar, payload.type)
  }
}))
