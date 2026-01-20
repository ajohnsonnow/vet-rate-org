import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 3000,
    host: true,
    hmr: {
      protocol: 'ws',
      host: 'localhost',
      port: 3000
    }
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    minify: 'terser',
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor': ['react', 'react-dom'],
          'pdf': ['jspdf', 'html2canvas']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'jspdf', 'html2canvas']
  }
})
