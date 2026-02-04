import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  base: "/",
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
manualChunks: {
        three: ['three'],
        pdf: ['jspdf', 'jspdf-autotable'],
        viewer: ['three/examples/jsm/controls/OrbitControls'],
        core: ['react', 'react-dom']
      },
      },
    },
  },
})
