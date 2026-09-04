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

// The bucket is private, so every URL read from it carries a signature that is
// re-signed each day. Cached under the full URL, everything would miss every
// morning and be stored again under the new signature. The signature is dropped
// from the cache key and any `t` version kept, so an object is stored once and a
// reprocessed one still busts it.
const dropSignatureFromCacheKey = {
  cacheKeyWillBeUsed: async ({ request }) => {
    const url = new URL(request.url);
    for (const name of [...url.searchParams.keys()]) {
      if (name.toLowerCase().startsWith('x-amz-')) {
        url.searchParams.delete(name);
      }
    }
    return url.href;
  },
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
              plugins: [dropSignatureFromCacheKey],
            },
          },
          {
            // Search reads the photo vectors from here. Without this they are
            // fetched afresh every session and search is the one page that stops
            // working with no connection, while the gallery beside it keeps going.
            //
            // Network first, not cache first: the current month's file is rewritten
            // whenever the worker runs, and it has to agree with the manifest the
            // catalog was read from. It is fetched once per session, not per
            // keystroke, so the round trip costs nothing worth saving.
            urlPattern: /^https:\/\/.*\/catalog\/embeddings\//,
            handler: 'NetworkFirst',
            options: {
              cacheName: 'photoflow-embeddings',
              plugins: [dropSignatureFromCacheKey],
            },
          },
          {
            // The ONNX runtime the search model runs on — some 20MB of WebAssembly
            // that transformers.js fetches from jsDelivr the first time anyone
            // searches. The model weights land in its own Cache API store and so
            // survive going offline; this did not, leaving only the HTTP cache
            // between search and a dead first query.
            //
            // Cache first because the URL carries the library version, so an
            // upgrade asks for a different file rather than a newer copy of this one.
            urlPattern: /^https:\/\/cdn\.jsdelivr\.net\/npm\/@huggingface\/transformers@/,
            handler: 'CacheFirst',
            options: {
              cacheName: 'photoflow-onnx-runtime',
              // 0 covers an opaque response, which is what this would be if
              // jsDelivr ever stopped answering with CORS headers. Storing it
              // matters more than being able to read its status.
              cacheableResponse: { statuses: [0, 200] },
              expiration: { purgeOnQuotaError: true },
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
        // Where supported, an installed app claims its own links, so a scanned
        // code opens here rather than in the browser. Safari ignores this.
        handle_links: 'preferred',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: './icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './icon-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: './icon-maskable-512.png',
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
