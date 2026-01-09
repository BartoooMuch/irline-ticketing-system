import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3010,
    proxy: {
      '/api/v1/auth': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/members': {
        target: 'http://localhost:3002',
        changeOrigin: true,
      },
      '/api/v1/flights': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/v1/tickets': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/v1/airports': {
        target: 'http://localhost:3001',
        changeOrigin: true,
      },
      '/api/v1/predict': {
        target: 'http://localhost:5001',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\/v1\/predict/, '/predict'),
      },
    },
  },
  build: {
    outDir: 'dist',
  },
})
