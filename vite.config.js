import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
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