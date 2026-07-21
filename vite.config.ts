import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // chemins relatifs : fonctionne aussi bien en local que sur GitHub Pages
  // (servi depuis un sous-dossier /fondvert/)
  base: './',
  plugins: [react()],
  server: {
    host: true, // accessible depuis le téléphone sur le réseau local
  },
})
