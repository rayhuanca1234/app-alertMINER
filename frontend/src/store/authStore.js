import { create } from 'zustand'
import { supabase } from '../lib/supabase'

export const useAuthStore = create((set, get) => ({
  user: null,
  session: null,
  profile: null,
  loading: true,

  initialize: async () => {
    const { data: { session } } = await supabase.auth.getSession()
    const user = session?.user || null
    set({ session, user, loading: false })

    if (user) {
      get().fetchProfile(user.id)
    }

    supabase.auth.onAuthStateChange(async (_event, session) => {
      const user = session?.user || null
      set({ session, user })
      if (user) {
        get().fetchProfile(user.id)
      } else {
        set({ profile: null })
      }
    })
  },

  fetchProfile: async (userId) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()

    if (error && error.code === 'PGRST116') {
      // Profile doesn't exist yet — create it
      const user = get().user
      const name = user?.user_metadata?.full_name || user?.user_metadata?.name || user?.email?.split('@')[0] || 'Minero'
      const avatar_url = user?.user_metadata?.avatar_url || null

      const { data: newProfile } = await supabase
        .from('profiles')
        .insert({ id: userId, name, avatar_url })
        .select()
        .single()

      if (newProfile) set({ profile: newProfile })
    } else if (data) {
      set({ profile: data })
    }
  },

  updateProfile: async (updates) => {
    const userId = get().user?.id
    if (!userId) return

    const { data, error } = await supabase
      .from('profiles')
      .update(updates)
      .eq('id', userId)
      .select()
      .single()

    if (!error && data) set({ profile: data })
    return { data, error }
  },

  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null, session: null, profile: null })
  }
}))
