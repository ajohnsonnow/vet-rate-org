/**
 * Single source of truth for AI performance expectations and system requirements.
 *
 * BENCHMARK LOG — update this after every stress run, not the components.
 * Components import from here so one edit propagates everywhere.
 *
 * 2026-06-12 (run blxi74t2m): desktop-high RTX 4080 SUPER, 28K-char chunks,
 *   contextWindowSize 12288, pre-boundary-chunking
 *   → 165 s/chunk observed (p50), 240 s/chunk (p90 for dense pages)
 *   → First-run warmup: ~45 min (shader JIT + 1.7 GB model load)
 *   → 313 MB C-File → 301 chunks → ~13.5 h total (exceeds 8 h test ceiling)
 *   → Root cause: cross-document chunks inflate AI generation time
 *   → Fix: document-boundary chunking (cFilePageSegmenter.js)
 *
 * 2026-06-13 (run b7qly4srg): desktop-high RTX 4080 SUPER, 28K-char chunks,
 *   contextWindowSize 12288, with document-boundary chunking (284 chunks)
 *   → ~64 s/chunk observed (p50, military records section, chunk 1-127)
 *   → ~120 s/chunk observed (p90+, dense medical records section, chunks 128-284)
 *   → ~100 s/chunk overall average (8 h / 284 chunks)
 *   → 313 MB C-File → 284 chunks → ~8 h total (test timed out at 283-284/284)
 *   → First-run warmup: ~45 min (shader JIT + 1.7 GB model load, same as above)
 *   → Fix: extend stress test timeout from 8h to 12h
 */

// ---------------------------------------------------------------------------
// Warmup phases (browser-side WebLLM initialization)
// ---------------------------------------------------------------------------

export const AI_WARMUP = {
  firstRun: {
    minMin: 20,
    maxMin: 45,
    reason:
      "WebGPU shader compilation (thousands of GPU programs, one-time per GPU driver version) + 1.7 GB model weight load from browser storage to GPU.",
  },
  firstRunAppleSilicon: {
    minMin: 5,
    maxMin: 15,
    reason:
      "Metal Pipeline State Object (PSO) caching on Apple Silicon compiles shaders in 5–15 min (vs 20–45 min on Windows/NVIDIA). 1.7 GB model weight load is the same.",
  },
  subsequentRun: {
    minMin: 3,
    maxMin: 8,
    reason:
      "Shaders already compiled and cached. Only 1.7 GB model weights need to load from IndexedDB to GPU.",
  },
};

// ---------------------------------------------------------------------------
// Per-chunk AI generation rates, by device tier.
// p50 = typical chunk; p90 = dense-content chunk (e.g. 10-page STR section).
// null = mode not supported on this tier.
// ---------------------------------------------------------------------------

export const AI_CHUNK_RATE = {
  // desktop-high (NVIDIA RTX): ~64 s/chunk (p50 military records), ~120 s/chunk
  // (p90 dense medical records). 100 s/chunk is the conservative overall p50.
  "desktop-high": { p50: 100, p90: 180, label: "High-end desktop GPU" },
  // apple-silicon: Metal PSO caching makes first run 5-15 min (vs 20-45 min on
  // NVIDIA/WGSL). Per-chunk rate comparable to desktop-high once model is loaded.
  "apple-silicon": { p50: 90, p90: 150, label: "Apple Silicon (M1 Pro / M2+)" },
  "desktop-mid": { p50: 300, p90: 450, label: "Mid-range GPU" },
  laptop: {
    p50: 480,
    p90: 720,
    label: "Laptop / integrated GPU (WASM fallback)",
  },
  tablet: null,
  mobile: null,
};

// ---------------------------------------------------------------------------
// System requirements
// ---------------------------------------------------------------------------

export const AI_REQUIREMENTS = {
  browser: ["Chrome 113+", "Edge 113+"],
  browserNote:
    "Firefox and Safari do not support WebGPU. On-device AI will not run in those browsers.",
  gpu: {
    minVRAM: 6,
    minDesc: "NVIDIA GTX 1060 6 GB · AMD RX 580 8 GB · Apple M1",
    recDesc: "NVIDIA RTX 2060+ · AMD RX 6600+ · Apple M1 Pro or later",
  },
  ram: { minGB: 8, recGB: 16 },
  formFactor:
    "Desktop or laptop — phones and tablets are not supported for on-device AI.",
  model: {
    sizeGB: 1.7,
    cachedAfterFirstDownload: true,
    note: "Downloaded once to your browser storage. Subsequent sessions skip the download.",
  },
};

// ---------------------------------------------------------------------------
// Helpers — consumed by SystemRequirementsNotice and estimateProcessingTime()
// ---------------------------------------------------------------------------

/**
 * Human-readable estimate for N chunks at a given tier.
 * Returns null if the tier does not support local AI.
 */
export function estimateTimeForChunks(chunkCount, tier = "desktop-high") {
  const rate = AI_CHUNK_RATE[tier];
  if (!rate) return null;
  const totalSeconds = chunkCount * rate.p50;
  if (totalSeconds < 60) return `~${Math.ceil(totalSeconds)} s`;
  if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)} min`;
  return `~${(totalSeconds / 3600).toFixed(1)} hours`;
}

/**
 * Total wall-clock estimate for a file, including warmup.
 * Uses a 313 MB → 301 chunk empirical ratio to estimate chunk count from file size.
 */
export function estimateTotalTime(
  fileSizeMB,
  tier = "desktop-high",
  isFirstRun = true,
) {
  const rate = AI_CHUNK_RATE[tier];
  if (!rate) return null;
  const estimatedChunks = Math.max(1, Math.round(fileSizeMB * 0.96));
  const aiSeconds = estimatedChunks * rate.p50;
  const warmupMin = isFirstRun
    ? AI_WARMUP.firstRun.maxMin
    : AI_WARMUP.subsequentRun.maxMin;
  const totalSeconds = aiSeconds + warmupMin * 60;
  if (totalSeconds < 3600) return `~${Math.ceil(totalSeconds / 60)} min`;
  return `~${(totalSeconds / 3600).toFixed(1)} hours`;
}
