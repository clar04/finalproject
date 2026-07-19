import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    allowedHosts: ['web.absa-labelstudio.my.id'],
    host: true,
    port: 5173,
    watch: {
      usePolling: true,
    }
  }
})
