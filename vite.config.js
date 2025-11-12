import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      devOptions: {
        enabled: true
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/cdn-prod-01\.outin\.space\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'photoflow-images',
              expiration: {
                maxEntries: 10000,
                maxAgeSeconds: 60 * 60 * 24 * 30, // 30 days
              },
            },
          },
        ],
      },
      manifest: {
        name: 'PhotoFlow',
        short_name: 'PhotoFlow',
        description: 'Your personal photo management app',
        theme_color: '#ffffff',
        background_color: '#ffffff',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: './assets/icon-512.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: './assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
          {
            src: './assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
    }),
  ],
  root: 'src',
  build: {
    rollupOptions: {
      input: 'src/index.html'
    }
  },
  css: {
    postcss: './.postcssrc'
  },
  resolve: {
    alias: {
      '@': '/src'
    }
  },
  server: {
    allowedHosts: ['localhost.outin.space'],
    host: '0.0.0.0'
  }
}); 
