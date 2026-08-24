import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { visualizer } from "rollup-plugin-visualizer";
import { fileURLToPath, URL } from "node:url";

const ANALYZE = process.env.ANALYZE === "true";

// Brand configurations for build-time HTML transformation
const BRAND_CONFIGS = {
  vetrate: {
    appName: "Vet-Rate.org",
    url: "https://vet-rate.org",
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
    url: "https://supplylocker.vet",
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
      return (
        html
          .replace(/<title>.*?<\/title>/, `<title>${brand.title}</title>`)
          // Page title reused by og:title / twitter:title
          .replace(
            /content="Vet-Rate\.org \| Complete VA Claims Arsenal[^"]*"/g,
            `content="${brand.title}"`,
          )
          // Meta + og + twitter description (the long "arsenal" blurb)
          .replace(
            /content="Vet-Rate\.org - Your complete VA claims arsenal[^"]*"/g,
            `content="${brand.description}"`,
          )
          // og:site_name + apple-mobile-web-app-title (the exact short name)
          .replace(/content="Vet-Rate\.org"/g, `content="${brand.appName}"`)
          // Logo asset filename (favicon, preload, og:image, twitter:image)
          .replace(
            /Vet-Rate-org-logo-official\.png/g,
            brand.logo.replace("/images/", ""),
          )
          .replace(/#003f87/g, brand.themeColor)
          // Canonical / og:url / og:image / twitter origin
          .replace(/https:\/\/vet-rate\.org/g, brand.url)
          .replace(
            /vet-rate-org\.goatcounter\.com\/count/g,
            brand.analytics.replace("https://", ""),
          )
      );
    },
  };
}

// Emit brand-aware robots.txt + sitemap.xml into the build output. Both brands
// ship the same public/ dir to different outDirs, so these can't be static
// files — the absolute origin must match the brand being built.
function seoFilesPlugin() {
  const brandMode = process.env.VITE_BRAND_MODE || "vetrate";
  const brand = BRAND_CONFIGS[brandMode] || BRAND_CONFIGS.vetrate;
  const origin = brand.url;
  // Indexable surfaces only — the offline shell and the vision test page are
  // intentionally excluded.
  const paths = [
    "/",
    "/faq.html",
    "/support.html",
    "/terms-of-service.html",
    "/privacy-policy.html",
  ];

  return {
    name: "seo-files",
    generateBundle() {
      const robots = `User-agent: *\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`;
      const urls = paths
        .map((p) => `  <url>\n    <loc>${origin}${p}</loc>\n  </url>`)
        .join("\n");
      const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls}\n</urlset>\n`;
      this.emitFile({ type: "asset", fileName: "robots.txt", source: robots });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: sitemap,
      });
    },
  };
}

// === AGGRESSIVE CODE SPLITTING STRATEGY ===
// Goal: Keep each chunk under 1MB for optimal loading.
// Rules in priority order — first matching marker set wins, mirroring the
// original if/else-chain evaluation order exactly.
const MANUAL_CHUNK_RULES = [
  // 1. Core React framework (tiny, needed everywhere)
  [["node_modules/react/", "node_modules/react-dom/"], "vendor"],
  // 2. Router and core routing (if using react-router)
  [["node_modules/react-router"], "vendor"],
  // 3. UI Libraries (medium size, frequently used)
  [
    [
      "node_modules/lucide-react",
      "node_modules/@headlessui",
      "node_modules/framer-motion",
    ],
    "ui-libs",
  ],
  // 4. PDF.js (very heavy, separate chunk)
  [["node_modules/pdfjs-dist"], "pdfjs"],
  // 5. PDF generation (jspdf, html2canvas, pdf-lib)
  [
    ["node_modules/jspdf", "node_modules/html2canvas", "node_modules/pdf-lib"],
    "pdf",
  ],
  // 6. AI/ML WebLLM (extremely heavy - 5MB+, lazy loaded)
  [["node_modules/@mlc-ai/web-llm"], "ai-webllm"],
  // 7. OCR - Tesseract ONLY (transformers goes elsewhere)
  [["node_modules/tesseract.js"], "ocr"],
  // 8. Transformers/Vision models (separate from OCR)
  [["node_modules/@huggingface/transformers"], "vision"],
  // 9. Document processing - keep together to avoid circular deps
  [["node_modules/docx", "node_modules/mammoth", "node_modules/jszip"], "docs"],
  // 10. Storage utilities (tiny)
  [["node_modules/idb-keyval"], "storage"],
  // 11. Utility libraries (lodash, date-fns, etc)
  [
    ["node_modules/lodash", "node_modules/date-fns", "node_modules/clsx"],
    "utils",
  ],
  // 12. Markdown/Rich Text
  [["node_modules/marked", "node_modules/dompurify"], "markdown"],
  // 13. Large data files - medical
  [
    [
      "src/data/diagnosticCodes",
      "src/data/mosDatabase",
      "src/data/secondaryConditions",
    ],
    "data-medical",
  ],
  // 14. Large data files - resources
  [["src/data/stateBenefits", "src/data/vsoDirectory"], "data-resources"],
  // 15. Large data files - legal/forms
  [["src/data/vaForms", "src/data/legalDocuments"], "data-legal"],
  // 16. AI utilities (separate from WebLLM engine)
  [
    [
      "src/utils/unifiedAIService",
      "src/utils/aiStatementHelper",
      "src/utils/diamondSwarm",
    ],
    "ai-utils",
  ],
  // 17. Heavy analysis tools
  [
    [
      "src/utils/cfileAnalyzer",
      "src/utils/documentAnalyzer",
      "src/utils/advancedOCR",
    ],
    "analysis-tools",
  ],
  // 18. VA calculations and core logic
  [
    [
      "src/utils/vaCalculations",
      "src/utils/secondaryFinder",
      "src/utils/nexusLogic",
    ],
    "va-core",
  ],
  // 19. Heavy UI components - Calculator, AI tools, etc
  [
    [
      "src/components/Calculator",
      "src/components/TacticalCalculator",
      "src/components/WhatIfSandbox",
    ],
    "calculators",
  ],
  [
    [
      "src/components/DecisionDecoder",
      "src/components/DenialDecoder",
      "src/components/CFileAnalyzer",
    ],
    "analysis-tools",
  ],
  [
    [
      "src/components/NexusBuilder",
      "src/components/WitnessBench",
      "src/components/StatementAnalyzer",
    ],
    "calculators",
  ],
  // 20. Duty stations equal-area world map — d3-geo/topojson-client
  // + the vendored boundary data, only ever reached via
  // DutyStationMap.jsx's lazy import().
  [
    [
      "node_modules/d3-geo",
      "node_modules/d3-array",
      "node_modules/topojson-client",
      "src/data/geo",
    ],
    "geo",
  ],
];

// Default: let Vite decide (remaining app code goes in index chunk)
function resolveManualChunk(id) {
  const rule = MANUAL_CHUNK_RULES.find(([markers]) =>
    markers.some((marker) => id.includes(marker)),
  );
  return rule ? rule[1] : undefined;
}

export default defineConfig({
  plugins: [
    react(),
    brandingPlugin(),
    seoFilesPlugin(),
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
      // No explicit port: Vite then binds HMR to whatever port the server
      // actually got. Pinning it to 5173 meant `--port 5197` (how the
      // Playwright webServer starts this app) still tried to bind 5173, so
      // the whole E2E suite failed to start whenever a dev server was
      // already running.
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
          proxy.on("proxyReq", (proxyReq, req, _res) => {
            console.log(
              "[Proxy]",
              req.method,
              req.url,
              "→",
              options.target + proxyReq.path,
            );
          });
          proxy.on("proxyRes", (proxyRes, req, _res) => {
            console.log("[Proxy Response]", proxyRes.statusCode, req.url);
          });
          proxy.on("error", (err, _req, _res) => {
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
    terserOptions: {
      compress: {
        pure_funcs: ["console.log", "console.debug", "console.info"],
      },
    },
    target: "esnext", // Required for top-level await in WebGPU models
    chunkSizeWarningLimit: 7000, // Suppress for WebLLM (6MB), main bundle, PDF libs - all optimally chunked
    rollupOptions: {
      output: {
        manualChunks: resolveManualChunk,
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
