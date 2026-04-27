import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const THEMES = {
  dark: {
    id: 'dark',
    label: '🌑 Oscuro',
    colors: {
      '--bg-primary': '#0f172a',
      '--bg-secondary': '#1e293b',
      '--bg-card': 'rgba(30, 41, 59, 0.6)',
      '--bg-nav': 'rgba(15, 23, 42, 0.95)',
      '--bg-input': '#1e293b',
      '--text-primary': '#f1f5f9',
      '--text-secondary': '#94a3b8',
      '--text-muted': '#64748b',
      '--accent': '#3b82f6',
      '--accent-glow': 'rgba(59, 130, 246, 0.3)',
      '--accent-hover': '#60a5fa',
      '--border': 'rgba(51, 65, 85, 0.5)',
      '--border-strong': '#475569',
      '--danger': '#ef4444',
      '--success': '#22c55e',
      '--warning': '#f59e0b',
      '--glass': 'rgba(15, 23, 42, 0.85)',
      '--shadow': '0 8px 32px rgba(0, 0, 0, 0.4)',
      '--gradient-start': '#3b82f6',
      '--gradient-end': '#10b981',
    },
    preview: ['#0f172a', '#3b82f6', '#10b981']
  },
  light: {
    id: 'light',
    label: '☀️ Claro',
    colors: {
      '--bg-primary': '#f8fafc',
      '--bg-secondary': '#ffffff',
      '--bg-card': 'rgba(255, 255, 255, 0.8)',
      '--bg-nav': 'rgba(248, 250, 252, 0.95)',
      '--bg-input': '#ffffff',
      '--text-primary': '#0f172a',
      '--text-secondary': '#475569',
      '--text-muted': '#94a3b8',
      '--accent': '#2563eb',
      '--accent-glow': 'rgba(37, 99, 235, 0.2)',
      '--accent-hover': '#3b82f6',
      '--border': 'rgba(226, 232, 240, 0.8)',
      '--border-strong': '#cbd5e1',
      '--danger': '#dc2626',
      '--success': '#16a34a',
      '--warning': '#d97706',
      '--glass': 'rgba(255, 255, 255, 0.85)',
      '--shadow': '0 8px 32px rgba(0, 0, 0, 0.08)',
      '--gradient-start': '#2563eb',
      '--gradient-end': '#0891b2',
    },
    preview: ['#f8fafc', '#2563eb', '#0891b2']
  },
  blue: {
    id: 'blue',
    label: '🔵 Azul',
    colors: {
      '--bg-primary': '#0c1929',
      '--bg-secondary': '#132744',
      '--bg-card': 'rgba(19, 39, 68, 0.6)',
      '--bg-nav': 'rgba(12, 25, 41, 0.95)',
      '--bg-input': '#132744',
      '--text-primary': '#e0f2fe',
      '--text-secondary': '#7dd3fc',
      '--text-muted': '#38bdf8',
      '--accent': '#0ea5e9',
      '--accent-glow': 'rgba(14, 165, 233, 0.3)',
      '--accent-hover': '#38bdf8',
      '--border': 'rgba(14, 165, 233, 0.2)',
      '--border-strong': '#0284c7',
      '--danger': '#f43f5e',
      '--success': '#34d399',
      '--warning': '#fbbf24',
      '--glass': 'rgba(12, 25, 41, 0.85)',
      '--shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
      '--gradient-start': '#0ea5e9',
      '--gradient-end': '#6366f1',
    },
    preview: ['#0c1929', '#0ea5e9', '#6366f1']
  },
  amber: {
    id: 'amber',
    label: '🟠 Ámbar',
    colors: {
      '--bg-primary': '#1a1207',
      '--bg-secondary': '#292014',
      '--bg-card': 'rgba(41, 32, 20, 0.6)',
      '--bg-nav': 'rgba(26, 18, 7, 0.95)',
      '--bg-input': '#292014',
      '--text-primary': '#fef3c7',
      '--text-secondary': '#fcd34d',
      '--text-muted': '#b45309',
      '--accent': '#f59e0b',
      '--accent-glow': 'rgba(245, 158, 11, 0.3)',
      '--accent-hover': '#fbbf24',
      '--border': 'rgba(245, 158, 11, 0.2)',
      '--border-strong': '#d97706',
      '--danger': '#ef4444',
      '--success': '#22c55e',
      '--warning': '#f59e0b',
      '--glass': 'rgba(26, 18, 7, 0.85)',
      '--shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
      '--gradient-start': '#f59e0b',
      '--gradient-end': '#ef4444',
    },
    preview: ['#1a1207', '#f59e0b', '#ef4444']
  },
  emerald: {
    id: 'emerald',
    label: '🟢 Esmeralda',
    colors: {
      '--bg-primary': '#052e16',
      '--bg-secondary': '#0a3d22',
      '--bg-card': 'rgba(10, 61, 34, 0.6)',
      '--bg-nav': 'rgba(5, 46, 22, 0.95)',
      '--bg-input': '#0a3d22',
      '--text-primary': '#dcfce7',
      '--text-secondary': '#86efac',
      '--text-muted': '#16a34a',
      '--accent': '#10b981',
      '--accent-glow': 'rgba(16, 185, 129, 0.3)',
      '--accent-hover': '#34d399',
      '--border': 'rgba(16, 185, 129, 0.2)',
      '--border-strong': '#059669',
      '--danger': '#f43f5e',
      '--success': '#34d399',
      '--warning': '#fbbf24',
      '--glass': 'rgba(5, 46, 22, 0.85)',
      '--shadow': '0 8px 32px rgba(0, 0, 0, 0.5)',
      '--gradient-start': '#10b981',
      '--gradient-end': '#06b6d4',
    },
    preview: ['#052e16', '#10b981', '#06b6d4']
  },
}

export const useThemeStore = create(
  persist(
    (set, get) => ({
      currentTheme: 'light',
      chatBackground: 'default',
      chatFont: 'Arial, sans-serif',
      chatFontSize: '18px',

      setTheme: (themeId) => {
        if (!THEMES[themeId]) return
        const theme = THEMES[themeId]
        const root = document.documentElement

        // Apply CSS variables
        Object.entries(theme.colors).forEach(([key, value]) => {
          root.style.setProperty(key, value)
        })

        // Set data attribute for CSS selectors
        root.setAttribute('data-theme', themeId)
        set({ currentTheme: themeId })
      },

      setChatBackground: (bg) => set({ chatBackground: bg }),
      setChatFont: (font) => set({ chatFont: font }),
      setChatFontSize: (size) => set({ chatFontSize: size }),

      initTheme: () => {
        const themeId = get().currentTheme
        get().setTheme(themeId)
      },

      getTheme: () => THEMES[get().currentTheme],
    }),
    {
      name: 'mineralert-theme',
      partialize: (state) => ({ 
        currentTheme: state.currentTheme, 
        chatFont: state.chatFont,
        chatFontSize: state.chatFontSize 
      }),
    }
  )
)
