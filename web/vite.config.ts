import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@api-types': path.resolve(__dirname, '../src/types/api.ts'),
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/auth': { target: 'http://localhost:3000', changeOrigin: true },
      '/me': { target: 'http://localhost:3000', changeOrigin: true },
      '/products': { target: 'http://localhost:3000', changeOrigin: true },
      '/categories': { target: 'http://localhost:3000', changeOrigin: true },
      '/seller': { target: 'http://localhost:3000', changeOrigin: true },
      '/admin': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
})
