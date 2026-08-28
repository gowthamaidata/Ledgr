import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { defineConfig } from 'vite'

export default defineConfig({
  plugins: [
    react(),
    tailwindcss(),
  ],

  server: {
    // Bind to all interfaces so mobile devices on the same Wi-Fi can connect
    host: '0.0.0.0',
    port: 5173,
    // Allow LAN access — important for mobile testing
    cors: true,
  },

  preview: {
    host: '0.0.0.0',
    port: 4173,
  },

  build: {
    // Ensure sw.js and manifest.json are copied as-is from /public
    copyPublicDir: true,
  },
})
