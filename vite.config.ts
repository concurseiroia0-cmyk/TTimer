import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

// Base path: locally '/', on GitHub Pages '/<repo>/' (derived from the
// GITHUB_REPOSITORY the CI provides). All icon and manifest URLs below are
// relative, so the same build works in both places.
const pagesRepo = process.env.GITHUB_REPOSITORY?.split('/')[1]
const base = process.env.VITE_BASE ?? (pagesRepo ? `/${pagesRepo}/` : '/')

export default defineConfig({
  base,
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/favicon.png'],
      manifest: {
        name: 'TTimer — Banco de Tempo',
        short_name: 'TTimer',
        description:
          'Seu tempo livre é um saldo diário que expira. Compre atividades de crescimento com ele. Você não gasta tempo. Você investe tempo.',
        lang: 'pt-BR',
        dir: 'ltr',
        // Relative so the app works at the GitHub Pages subpath (/TTimer/).
        start_url: '.',
        scope: '.',
        display: 'standalone',
        orientation: 'portrait',
        theme_color: '#0B0F14',
        background_color: '#0B0F14',
        categories: ['productivity', 'lifestyle'],
        icons: [
          { src: 'icons/icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icons/icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icons/icon-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,woff2}'],
        // Relative navigation fallback keeps deep links working under /TTimer/.
        navigateFallback: 'index.html',
        cleanupOutdatedCaches: true,
      },
    }),
  ],
  server: {
    port: 5179,
  },
})
