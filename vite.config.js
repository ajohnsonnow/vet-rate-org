import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath, URL } from "node:url";

const ANALYZE = process.env.ANALYZE === "true";

// Brand configurations for build-time HTML transformation
const BRAND_CONFIGS = {
  vetrate: {
    appName: "Vet-Rate.org",
    title:
      "Vet-Rate.org | Complete VA Claims Arsenal - 39 Pro Tools · Rating Calculator · AI Analysis · FREE",
    description:
      "Vet-Rate.org - Your complete VA claims arsenal. 39 professional tools: search 748 conditions, calculate ratings, discover secondary claims, AI document analysis, C&P prep, evidence builders, strategic planning. What claim sharks charge $1000s for, FREE. Built by a veteran for veterans.",
    logo: "/images/Vet-Rate-org-logo-official.png",
    themeColor: "#003f87",
    analytics: "https://vet-rate-org.goatcounter.com/count",
  },
  supplylocker: {
    appName: "Supply Locker",
    title:
      "Supply Locker | Premium VA Claims Toolkit - 39 Pro Tools · Rating Calculator · AI Analysis",
    description:
      "Supply Locker - Your premium VA claims toolkit. 39 professional tools: search 748 conditions, calculate ratings, discover secondary claims, AI document analysis, C&P prep, evidence builders, strategic planning. Supporting veterans who support us.",
    logo: "/images/supply-locker-logo.png",
    themeColor: "#065f46",
    analytics: "https://supply-locker.goatcounter.com/count",
  },
};

// HTML transformation plugin for branding
function brandingPlugin() {
  const brandMode = process.env.VITE_BRAND_MODE || "vetrate";
  const brand = BRAND_CONFIGS[brandMode] || BRAND_CONFIGS.vetrate;

  return {
    name: "branding-transform",
    transformIndexHtml(html) {
      return html
        .replace(/<title>.*?<\/title>/, `<title>${brand.title}</title>`)
        .replace(
          /content="Vet-Rate\.org[^"]*"/,
          `content="${brand.description}"`,
        )
        .replace(
          /Vet-Rate-org-logo-official\.png/g,
          brand.logo.replace("/images/", ""),
        )
        .replace(/#003f87/g, brand.themeColor)
        .replace(
          /vet-rate-org\.goatcounter\.com\/count/g,
          brand.analytics.replace("https://", ""),
        );
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    brandingPlugin(),
    ANALYZE &&
      visualizer({
        filename: "dist/bundle-report.html",
        template: "treemap",
        gzipSize: true,
        brotliSize: true,
        open: false,
      }),
  ].filter(Boolean),

  // Resolve dompurify to a no-op stub. This is intentional — see
  // packages/dompurify-noop/README.md for the full design rationale.
  // Summary: no direct callers; jspdf lists it as optional peer; all 3.x
  // versions ship XSS advisories; we sanitize at the source via sanitize.js
  // helpers (escapeHtml, sanitizeUrl, safeHtml) with CSP as the perimeter.
  resolve: {
    alias: {
      dompurify: fileURLToPath(
        new URL("./packages/dompurify-noop/index.js", import.meta.url),
      ),
    },
  },

  // === WEBGPU / TRANSFORMERS.JS SUPPORT ===
  // Required for Florence-2 Vision LLM
  // - esnext target enables top-level await
  // - ES module workers for transformers.js
  worker: {
    format: "es",
  },

  server: {
    port: 5173,
    host: "127.0.0.1", // Required for VA OAuth redirect URI
    hmr: {
      protocol: "ws",
      host: "127.0.0.1",
      port: 5173,
    },
    // Headers for SharedArrayBuffer (required for DOOM easter egg)
    // Using 'credentialless' instead of 'require-corp' to allow cross-origin resources
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "credentialless",
    },
    // Proxy VA Sandbox API calls to bypass CORS
    proxy: {
      "/va-api": {
        target: "https://sandbox-api.va.gov",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/va-api/, ""),
        secure: true,
        configure: (proxy, options) => {
          // Log proxy requests for debugging
          proxy.on("proxyReq", (proxyReq, req, res) => {
            console.log(
              "[Proxy]",
              req.method,
              req.url,
              "→",
              options.target + proxyReq.path,
            );
          });
          proxy.on("proxyRes", (proxyRes, req, res) => {
            console.log("[Proxy Response]", proxyRes.statusCode, req.url);
          });
          proxy.on("error", (err, req, res) => {
            console.error("[Proxy Error]", err.message);
          });
        },
      },
    },
  },
  build: {
    outDir: "dist",
    sourcemap: false,
    minify: "terser",
    target: "esnext", // Required for top-level await in WebGPU models
    chunkSizeWarningLimit: 7000, // Suppress for WebLLM (6MB), main bundle, PDF libs - all optimally chunked
    rollupOptions: {
      output: {
        manualChunks(id) {
          // === AGGRESSIVE CODE SPLITTING STRATEGY ===
          // Goal: Keep each chunk under 1MB for optimal loading

          // 1. Core React framework (tiny, needed everywhere)
          if (
            id.includes("node_modules/react/") ||
            id.includes("node_modules/react-dom/")
          ) {
            return "vendor";
          }

          // 2. Router and core routing (if using react-router)
          if (id.includes("node_modules/react-router")) {
            return "vendor";
          }

          // 3. UI Libraries (medium size, frequently used)
          if (
            id.includes("node_modules/lucide-react") ||
            id.includes("node_modules/@headlessui") ||
            id.includes("node_modules/framer-motion")
          ) {
            return "ui-libs";
          }

          // 4. PDF.js (very heavy, separate chunk)
          if (id.includes("node_modules/pdfjs-dist")) {
            return "pdfjs";
          }

          // 5. PDF generation (jspdf, html2canvas, pdf-lib)
          if (
            id.includes("node_modules/jspdf") ||
            id.includes("node_modules/html2canvas") ||
            id.includes("node_modules/pdf-lib")
          ) {
            return "pdf";
          }

          // 6. AI/ML WebLLM (extremely heavy - 5MB+, lazy loaded)
          if (id.includes("node_modules/@mlc-ai/web-llm")) {
            return "ai-webllm";
          }

          // 7. OCR - Tesseract ONLY (transformers goes elsewhere)
          if (id.includes("node_modules/tesseract.js")) {
            return "ocr";
          }

          // 8. Transformers/Vision models (separate from OCR)
          if (id.includes("node_modules/@huggingface/transformers")) {
            return "vision";
          }

          // 9. Document processing - keep together to avoid circular deps
          if (
            id.includes("node_modules/docx") ||
            id.includes("node_modules/mammoth") ||
            id.includes("node_modules/jszip")
          ) {
            return "docs";
          }

          // 10. Storage utilities (tiny)
          if (id.includes("node_modules/idb-keyval")) {
            return "storage";
          }

          // 11. Utility libraries (lodash, date-fns, etc)
          if (
            id.includes("node_modules/lodash") ||
            id.includes("node_modules/date-fns") ||
            id.includes("node_modules/clsx")
          ) {
            return "utils";
          }

          // 12. Markdown/Rich Text
          if (
            id.includes("node_modules/marked") ||
            id.includes("node_modules/dompurify")
          ) {
            return "markdown";
          }

          // 13. Large data files - medical
          if (
            id.includes("src/data/diagnosticCodes") ||
            id.includes("src/data/mosDatabase") ||
            id.includes("src/data/secondaryConditions")
          ) {
            return "data-medical";
          }

          // 14. Large data files - resources
          if (
            id.includes("src/data/stateBenefits") ||
            id.includes("src/data/vsoDirectory")
          ) {
            return "data-resources";
          }

          // 15. Large data files - legal/forms
          if (
            id.includes("src/data/vaForms") ||
            id.includes("src/data/legalDocuments")
          ) {
            return "data-legal";
          }

          // 16. AI utilities (separate from WebLLM engine)
          if (
            id.includes("src/utils/unifiedAIService") ||
            id.includes("src/utils/aiStatementHelper") ||
            id.includes("src/utils/diamondSwarm")
          ) {
            return "ai-utils";
          }

          // 17. Heavy analysis tools
          if (
            id.includes("src/utils/cfileAnalyzer") ||
            id.includes("src/utils/documentAnalyzer") ||
            id.includes("src/utils/advancedOCR")
          ) {
            return "analysis-tools";
          }

          // 18. VA calculations and core logic
          if (
            id.includes("src/utils/vaCalculations") ||
            id.includes("src/utils/secondaryFinder") ||
            id.includes("src/utils/nexusLogic")
          ) {
            return "va-core";
          }

          // 19. Heavy UI components - Calculator, AI tools, etc
          if (
            id.includes("src/components/Calculator") ||
            id.includes("src/components/TacticalCalculator") ||
            id.includes("src/components/WhatIfSandbox")
          ) {
            return "calculators";
          }

          if (
            id.includes("src/components/DecisionDecoder") ||
            id.includes("src/components/DenialDecoder") ||
            id.includes("src/components/CFileAnalyzer")
          ) {
            return "analysis-tools";
          }

          if (
            id.includes("src/components/NexusBuilder") ||
            id.includes("src/components/WitnessBench") ||
            id.includes("src/components/StatementAnalyzer")
          ) {
            return "calculators";
          }

          // Default: let Vite decide (remaining app code goes in index chunk)
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom", "jspdf", "html2canvas"],
    // Exclude wllama from pre-bundling as it contains WASM workers with Node.js code strings
    // Exclude transformers from pre-bundling - loaded dynamically with WebGPU
    exclude: ["@wllama/wllama", "@huggingface/transformers"],
    esbuildOptions: {
      target: "esnext", // Required for WebGPU modules
    },
  },
});
