import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'import.meta.env.VITE_GOOGLE_CLIENT_ID': JSON.stringify(
      process.env.VITE_GOOGLE_CLIENT_ID ||
      process.env.GOOGLE_CLIENT_ID ||
      '868290366696-3ecgm76h2ekevo3j6jcp8500iul73sq2.apps.googleusercontent.com'
    )
  },
  server: {
    port: 3000,
    host: '0.0.0.0'
  },
  optimizeDeps: {
    include: ['leaflet']
  }
})
