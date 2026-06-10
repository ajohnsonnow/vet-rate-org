/**
 * Device capability detection for adaptive AI inference.
 *
 * Probes WebGPU adapter limits, device memory, CPU cores, and form factor
 * to classify the device into a tier and return a recommended AI config.
 * Called once at app start; result is cached for the session.
 *
 * Tiers and their implications:
 *   mobile       — phone or no GPU; WebLLM skipped, cloud or skip
 *   tablet       — iPad / Android tablet; WebLLM 1.5B if WebGPU present
 *   laptop       — integrated / low-end discrete GPU; WebLLM 1.5B q4f16
 *   desktop-mid  — mid discrete GPU (~8GB VRAM); WebLLM 3B q4f16
 *   desktop-high — high-end GPU (≥16GB, RTX 3000+); WebLLM 3B q4f16, 28K chunks
 */

// WebGPU maxBufferSize thresholds correlate with GPU memory tier.
// High-end cards expose 2 147 483 648 (2 GB); mid ~268 MB; mobile/integrated
// expose the minimum (64 MB). These are not exact VRAM values but are a
// reliable proxy across Chrome/Edge on Windows/macOS/Android/iOS.
const GPU_HIGH_THRESHOLD = 1_500_000_000; // ~1.5 GB maxBufferSize
const GPU_MID_THRESHOLD = 200_000_000; // ~200 MB maxBufferSize

let _cachedProfile = null;

/**
 * Returns a device capability profile. Caches after first call.
 * @returns {Promise<DeviceProfile>}
 */
export async function detectDeviceCapabilities() {
  if (_cachedProfile) return _cachedProfile;

  const isMobileUA =
    /Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent) ||
    navigator.userAgentData?.mobile === true;

  // Treat iPad and large-screen tablets as their own tier
  const isTabletUA =
    /iPad/i.test(navigator.userAgent) ||
    (/Android/i.test(navigator.userAgent) &&
      !/Mobile/i.test(navigator.userAgent));

  const screenW = window.screen.width;
  const systemRAM = navigator.deviceMemory || (isMobileUA ? 2 : 4); // GB
  const cpuCores = navigator.hardwareConcurrency || 4;

  // --- WebGPU probe ---
  let hasWebGPU = false;
  let gpuMaxBufferSize = 0;
  let gpuDescription = "";

  if (typeof navigator !== "undefined" && navigator.gpu) {
    try {
      const adapter = await navigator.gpu.requestAdapter({
        powerPreference: "high-performance",
      });
      if (adapter) {
        hasWebGPU = true;
        gpuMaxBufferSize = adapter.limits.maxBufferSize ?? 0;
        gpuDescription = adapter.info?.description || "";
      }
    } catch {
      // requestAdapter can throw on unsupported platforms
    }
  }

  // --- GPU tier ---
  let gpuTier;
  if (!hasWebGPU) {
    gpuTier = "none";
  } else if (gpuMaxBufferSize >= GPU_HIGH_THRESHOLD) {
    gpuTier = "high"; // RTX 3000+, RX 6000+, M1 Pro/Max
  } else if (gpuMaxBufferSize >= GPU_MID_THRESHOLD) {
    gpuTier = "mid"; // integrated Intel/AMD, low-end discrete, M1 base
  } else {
    gpuTier = "low"; // minimal WebGPU (e.g. mobile WebGPU)
  }

  // --- Device tier ---
  let tier;
  if (isMobileUA && !isTabletUA) {
    tier = "mobile";
  } else if (isTabletUA || (isMobileUA && gpuTier !== "none")) {
    tier = "tablet";
  } else if (gpuTier === "high" && systemRAM >= 8) {
    // Desktop-high: large GPU buffer + plenty of RAM
    tier = screenW < 1400 ? "desktop-mid" : "desktop-high";
  } else if (gpuTier === "mid" || (hasWebGPU && cpuCores >= 8)) {
    tier = "laptop";
  } else {
    tier = "mobile"; // no GPU, unknown — fallback to the most conservative path
  }

  // --- AI config per tier ---
  // Models listed most-preferred first; diamondSwarm.js tries them in order.
  const config = _configForTier(tier);

  _cachedProfile = {
    tier,
    hasWebGPU,
    gpuTier,
    gpuMaxBufferSize,
    gpuDescription,
    systemRAM,
    cpuCores,
    isMobile: isMobileUA && !isTabletUA,
    isTablet: isTabletUA,
    ...config,
  };

  // eslint-disable-next-line no-console
  console.log(
    `📱 Device tier: ${tier} | WebGPU: ${hasWebGPU} (${gpuTier}) | RAM: ${systemRAM}GB | Cores: ${cpuCores}`,
    _cachedProfile,
  );

  return _cachedProfile;
}

function _configForTier(tier) {
  switch (tier) {
    case "desktop-high":
      return {
        recommendedModels: [
          "Qwen2.5-3B-Instruct-q4f16_1-MLC", // 1.7 GB, shader-f16 fast path
          "Qwen2.5-3B-Instruct-q4f32_1-MLC", // 2.0 GB, f32 fallback
          "Llama-3.2-3B-Instruct-q4f32_1-MLC",
        ],
        contextWindowSize: 12288,
        maxChunkChars: 28000,
        maxOutputTokens: 2048,
        ocrWorkers: Math.min(8, (navigator.hardwareConcurrency || 8) - 2),
        canUseWebLLM: true,
      };

    case "desktop-mid":
      return {
        recommendedModels: [
          "Qwen2.5-3B-Instruct-q4f16_1-MLC",
          "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
          "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
        ],
        contextWindowSize: 8192,
        maxChunkChars: 18000,
        maxOutputTokens: 1200,
        ocrWorkers: Math.min(6, (navigator.hardwareConcurrency || 6) - 2),
        canUseWebLLM: true,
      };

    case "laptop":
      return {
        recommendedModels: [
          "Qwen2.5-1.5B-Instruct-q4f16_1-MLC", // ~1 GB VRAM
          "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
          "Qwen2.5-3B-Instruct-q4f16_1-MLC", // try if 1.5B fails
        ],
        contextWindowSize: 8192,
        maxChunkChars: 14000,
        maxOutputTokens: 1024,
        ocrWorkers: Math.min(4, (navigator.hardwareConcurrency || 4) - 2),
        canUseWebLLM: true,
      };

    case "tablet":
      return {
        recommendedModels: [
          "Qwen2.5-1.5B-Instruct-q4f16_1-MLC",
          "Qwen2.5-1.5B-Instruct-q4f32_1-MLC",
        ],
        contextWindowSize: 4096,
        maxChunkChars: 8000,
        maxOutputTokens: 768,
        ocrWorkers: 2,
        canUseWebLLM: true, // M-series iPads have WebGPU
      };

    case "mobile":
    default:
      return {
        recommendedModels: [], // WebLLM not viable; route to cloud or skip
        contextWindowSize: 4096,
        maxChunkChars: 6000,
        maxOutputTokens: 512,
        ocrWorkers: 1,
        canUseWebLLM: false,
      };
  }
}

/** Returns the cached profile synchronously, or null if not yet probed. */
export function getCachedDeviceProfile() {
  return _cachedProfile;
}

/** Human-readable summary of the device tier for display in the UI. */
export function getDeviceTierLabel(profile) {
  if (!profile) return "Unknown device";
  const labels = {
    "desktop-high": "High-end desktop",
    "desktop-mid": "Mid-range desktop",
    laptop: "Laptop / integrated GPU",
    tablet: "Tablet",
    mobile: "Mobile device",
  };
  return labels[profile.tier] ?? profile.tier;
}
