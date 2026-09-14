import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Standard Vite + React config. No special setup needed — this project
// doesn't require anything beyond the defaults.
export default defineConfig({
  plugins: [react()],
})
