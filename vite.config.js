import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Brand configurations for build-time HTML transformation
const BRAND_CONFIGS = {
  vetrate: {
    appName: 'Vet-Rate.org',
    title: 'Vet-Rate.org | Complete VA Claims Arsenal - 39 Pro Tools · Rating Calculator · AI Analysis · FREE',
    description: 'Vet-Rate.org - Your complete VA claims arsenal. 39 professional tools: search 748 conditions, calculate ratings, discover secondary claims, AI document analysis, C&P prep, evidence builders, strategic planning. What claim sharks charge $1000s for, FREE. Built by a veteran for veterans.',
    logo: '/images/Vet-Rate-org-logo-official.png',
    themeColor: '#003f87',
    analytics: 'https://vet-rate-org.goatcounter.com/count'
  },
  supplylocker: {
    appName: 'Supply Locker',
    title: 'Supply Locker | Premium VA Claims Toolkit - 39 Pro Tools · Rating Calculator · AI Analysis',
    description: 'Supply Locker - Your premium VA claims toolkit. 39 professional tools: search 748 conditions, calculate ratings, discover secondary claims, AI document analysis, C&P prep, evidence builders, strategic planning. Supporting veterans who support us.',
    logo: '/images/supply-locker-logo.png',
    themeColor: '#065f46',
    analytics: 'https://supply-locker.goatcounter.com/count'
  }
};

// HTML transformation plugin for branding
function brandingPlugin() {
  const brandMode = process.env.VITE_BRAND_MODE || 'vetrate';
  const brand = BRAND_CONFIGS[brandMode] || BRAND_CONFIGS.vetrate;
  
  return {
    name: 'branding-transform',
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${brand.title}</title>`)
        .replace(/content="Vet-Rate\.org[^"]*"/, `content="${brand.description}"`)
        .replace(/Vet-Rate-org-logo-official\.png/g, brand.logo.replace('/images/', ''))
        .replace(/#003f87/g, brand.themeColor)
        .replace(/vet-rate-org\.goatcounter\.com\/count/g, brand.analytics.replace('https://', ''));
    }
  };
}

export default defineConfig({
  plugins: [react(), brandingPlugin()],
  
  // === WEBGPU / TRANSFORMERS.JS SUPPORT ===
  // Required for Florence-2 Vision LLM
  // - esnext target enables top-level await
  // - ES module workers for transformers.js
  worker: {
    format: 'es',
  },
  
  server: {
    port: 5173,
    host: '127.0.0.1', // Required for VA OAuth redirect URI
    hmr: {
      protocol: 'ws',
      host: '127.0.0.1',
      port: 5173
    },
    // Headers for SharedArrayBuffer (required for DOOM easter egg)
    // Using 'credentialless' instead of 'require-corp' to allow cross-origin resources
    headers: {
      'Cross-Origin-Opener-Policy': 'same-origin',
      'Cross-Origin-Embedder-Policy': 'credentialless'
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
    target: 'esnext',  // Required for top-level await in WebGPU models
    chunkSizeWarningLimit: 600, // Increase limit slightly for ML/AI libs
    rollupOptions: {
      output: {
        manualChunks: {
          // Core React vendor chunk
          'vendor': ['react', 'react-dom'],
          
          // PDF processing (heavy)
          'pdf': ['jspdf', 'html2canvas', 'pdfjs-dist', 'pdf-lib'],
          
          // AI/ML libraries (very heavy, lazy load)
          'ai-webllm': ['@mlc-ai/web-llm'],
          // Note: @wllama/wllama is excluded from manual chunks due to ESM/Node.js worker code issues
          // It's loaded dynamically via wllamaService.js
          // Note: @huggingface/transformers excluded - loaded dynamically in worker
          
          // OCR processing
          'ocr': ['tesseract.js'],
          
          // Document processing
          'docs': ['docx', 'mammoth'],
          
          // Storage utilities
          'storage': ['idb-keyval']
        }
      }
    }
  },
  optimizeDeps: {
    include: ['react', 'react-dom', 'jspdf', 'html2canvas'],
    // Exclude wllama from pre-bundling as it contains WASM workers with Node.js code strings
    // Exclude transformers from pre-bundling - loaded dynamically with WebGPU
    exclude: ['@wllama/wllama', '@huggingface/transformers'],
    esbuildOptions: {
      target: 'esnext',  // Required for WebGPU modules
    }
  }
})
