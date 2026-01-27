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
          react: ["react", "react-dom"],
          three: ["three", "@react-three/fiber", "@react-three/drei", "three-stdlib"],
          pdf: ["jspdf", "jspdf-autotable", "html2canvas"],
          sanitize: ["dompurify"],
        },
      },
    },
  },
})
