import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true,          // ← SW activo en desarrollo (npm run dev)
        type: 'module',
      },
      strategies: 'injectManifest',   // usamos nuestro propio SW
      srcDir: 'src',
      filename: 'sw.js',              // src/sw.js → nuestro service worker
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg', 'sounds/alert.mp3'],
      manifest: {
        name: 'MinerAlert',
        short_name: 'MinerAlert',
        description: 'Alerta comunitaria para mineros en tiempo real',
        theme_color: '#0f172a',
        background_color: '#0f172a',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
})
