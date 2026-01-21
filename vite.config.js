import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    host: '127.0.0.1', // Required for VA OAuth redirect URI
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173
    },
    // Proxy VA Sandbox API calls to bypass CORS
    proxy: {
      '/va-api': {
        target: 'https://sandbox-api.va.gov',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/va-api/, ''),
        secure: true,
        configure: (proxy, options) => {
          // Log proxy requests for debugging
          proxy.on('proxyReq', (proxyReq, req, res) => {
            console.log('[Proxy]', req.method, req.url, '→', options.target + proxyReq.path);
          });
          proxy.on('proxyRes', (proxyRes, req, res) => {
            console.log('[Proxy Response]', proxyRes.statusCode, req.url);
          });
          proxy.on('error', (err, req, res) => {
            console.error('[Proxy Error]', err.message);
          });
        }
      }
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
