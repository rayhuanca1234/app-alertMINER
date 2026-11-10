import { create } from 'zustand'
import {
  getSession,
  onAuthStateChange,
  fetchWithAuth,
  signOut as cfSignOut,
  signInWithGoogle as cfSignInWithGoogle,
  signInWithEmail as cfSignInWithEmail,
  registerWithEmail as cfRegisterWithEmail
} from '../lib/auth_client'

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  profile: null,
  subscription: null,
  loading: true,

  initialize: async () => {
    try {
      const session = await getSession()
      const user = session?.user || null
      set({
        session,
        user,
        profile: user,
        subscription: user?.subscription || null,
        loading: false
      })
    } catch {
      set({ session: null, user: null, profile: null, loading: false })
    }

    onAuthStateChange(async (_event, session) => {
      const user = session?.user || null
      set({ session, user })
      if (user) {
        await get().fetchProfile()
      } else {
        set({ profile: null, subscription: null })
      }
    })
  },

  fetchProfile: async () => {
    try {
      const res = await fetchWithAuth('/api/user/profile', { redirectOn401: false })
      if (res.ok) {
        const data = await res.json()
        set({
          profile: data,
          user: { ...(get().user || {}), ...data },
          subscription: data.subscription || null
        })
      }
    } catch (e) {
      console.error('[authStore] Error fetching profile:', e)
    }
  },

  updateProfile: async (updates) => {
    try {
      const res = await fetchWithAuth('/api/user/profile', {
        method: 'PUT',
        body: JSON.stringify(updates)
      })
      const data = await res.json()
      if (res.ok && data) {
        set({
          profile: { ...(get().profile || {}), ...data },
          user: { ...(get().user || {}), ...data }
        })
        return { data, error: null }
      }
      return { data: null, error: new Error(data?.error || 'Error actualizando perfil') }
    } catch (error) {
      return { data: null, error }
    }
  },

  signInWithGoogle: () => {
    cfSignInWithGoogle()
  },

  signInWithEmail: async (email, password) => {
    const session = await cfSignInWithEmail(email, password)
    set({ session, user: session.user, profile: session.user })
    await get().fetchProfile()
    return session
  },

  registerWithEmail: async (payload) => {
    const session = await cfRegisterWithEmail(payload)
    set({ session, user: session.user, profile: session.user })
    await get().fetchProfile()
    return session
  },

  signOut: async () => {
    await cfSignOut()
    set({ user: null, session: null, profile: null, subscription: null })
  }
}))
