import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { execSync } from 'child_process';

const getCommitHash = () => {
  try {
    return execSync('git rev-parse --short HEAD').toString().trim();
  } catch {
    return 'unknown';
  }
};

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
            urlPattern: /^https:\/\/.*\/tile-image\//,
            handler: 'CacheFirst',
            options: {
              cacheName: 'photoflow-tile-images',
              expiration: {
                maxEntries: 100000,
                purgeOnQuotaError: true,
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
            src: './assets/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './assets/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './assets/icon-maskable-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
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
  define: {
    'import.meta.env.VITE_COMMIT_HASH': JSON.stringify(getCommitHash())
  },
  server: {
    allowedHosts: ['localhost.outin.space'],
    host: '0.0.0.0'
  }
}); 
