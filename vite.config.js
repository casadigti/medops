import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  test: {
    environment: 'node',
    globals: true,
    // Playwright e2e specs must not be picked up by vitest; they use
    // test.describe() from @playwright/test and fail under the vitest runner.
    // Keep the vitest defaults (node_modules, dist) and add e2e.
    exclude: ['**/node_modules/**', '**/dist/**', '**/e2e/**', '**/.claude/**'],
  },
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: 'autoUpdate',
      // Inject crossorigin="use-credentials" on the manifest <link> so the
      // browser sends cookies when fetching /manifest.webmanifest. Without it,
      // Vercel Deployment Protection 307-redirects the (uncredentialed) manifest
      // request to its SSO gate, which then fails CORS on protected previews.
      useCredentials: true,
      includeAssets: ['favicon.svg', 'icon-192.png', 'icon-512.png'],
      manifest: {
        name: 'MedOps - Gestión Médica',
        short_name: 'MedOps',
        description: 'Plataforma de Gestión Logística Quirúrgica',
        theme_color: '#1e40af',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/',
        orientation: 'portrait',
        lang: 'es',
        icons: [
          {
            src: 'icon-192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      }
    })
  ],
  build: {
    chunkSizeWarningLimit: 1600,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('react')) return 'vendor-react';
            if (id.includes('@supabase')) return 'vendor-supabase';
            if (id.includes('lucide')) return 'vendor-icons';
            if (id.includes('recharts') || id.includes('d3')) return 'vendor-charts';
            if (id.includes('fullcalendar')) return 'vendor-calendar';
            if (id.includes('jspdf')) return 'vendor-pdf';
            if (id.includes('xlsx')) return 'vendor-xlsx';
            return 'vendor-core';
          }
        }
      }
    }
  }
})
