/**
 * WebGPU Manager for Vet-Rate.org
 * Capable of multi-GPU discovery and selection with Windows limitations handling
 *
 * KNOWN LIMITATIONS:
 * - Windows ignores powerPreference (Chromium Issue #369219127)
 * - Browser may only expose 1 GPU for privacy (fingerprinting protection)
 * - Multiple identical GPUs appear as single adapter
 * - device/description fields often empty
 *
 * This manager does the best it can within browser constraints.
 */

// Helper: Get GPU info from WebGL (more reliable than WebGPU for name detection)
function getWebGLGPUInfo() {
  try {
    const canvas = document.createElement("canvas");
    const gl = (canvas.gl =
      canvas.getContext("webgl") || canvas.getContext("experimental-webgl"));

    if (!gl) return null;

    const debugInfo = gl.getExtension("WEBGL_debug_renderer_info");
    if (!debugInfo) return null;

    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);

    // Clean up the renderer string - extract just the GPU name
    let cleanName = renderer;

    // Pattern 1: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti SUPER (0x00002705) Direct3D11..."
    // Uses [^,]* / [^(]* instead of lazy .*? + \s* to avoid overlapping-quantifier
    // backtracking; result is .trim()'d below so trailing whitespace differences are moot.
    const angleMatch = renderer.match(/ANGLE \([^,]*,(.*?)\(/);
    if (angleMatch) {
      cleanName = angleMatch[1].trim();
    }
    // Pattern 2: "NVIDIA GeForce RTX 4070 Ti SUPER / PCIe / SSE2"
    else if (renderer.includes("/")) {
      cleanName = renderer.split("/")[0].trim();
    }
    // Pattern 3: Extract vendor + model from parentheses
    else {
      const modelMatch = renderer.match(
        /(NVIDIA|AMD|Intel)\s+(GeForce|Radeon|Arc|Iris)[^(]*/i,
      );
      if (modelMatch) {
        cleanName = modelMatch[0].trim();
      }
    }

    // Parse VRAM from renderer string (common patterns)
    let vram = null;
    const vramMatch = renderer.match(/(\d+)\s*(GB|MB)/i);
    if (vramMatch) {
      const amount = parseInt(vramMatch[1]);
      const unit = vramMatch[2].toUpperCase();
      vram = unit === "GB" ? amount : Math.round(amount / 1024);
    }

    return {
      renderer: cleanName, // Use cleaned name
      rawRenderer: renderer, // Keep raw for debugging
      vendor,
      vram,
    };
  } catch (e) {
    console.warn("🎮 WebGL GPU detection failed:", e);
    return null;
  }
}

class GPUDiscoveryEngine {
  constructor() {
    this.adapters = new Map();
    this.selectedAdapter = null;
    this.device = null;
    this.isInitializing = false; // Track initialization state
    this.initPromise = null; // Store the initialization promise
    this.webglInfo = null; // Cache WebGL info
  }

  // Get WebGL info for fallback GPU detection (cached after first call)
  _getOrCacheWebGLInfo() {
    if (!this.webglInfo) {
      this.webglInfo = getWebGLGPUInfo();
      if (this.webglInfo) {
        // eslint-disable-next-line no-console
        console.log(
          `🎮 WebGL detected: ${this.webglInfo.renderer} (${this.webglInfo.vendor})`,
        );
        if (this.webglInfo.vram) {
          // eslint-disable-next-line no-console
          console.log(`🎮 WebGL VRAM: ${this.webglInfo.vram} GB`);
        }
      }
    }
    return this.webglInfo;
  }

  // Run adapter requests for each power-preference hint in parallel
  async _requestAdaptersForHints(hints) {
    const promises = hints.map(async (powerPreference) => {
      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: powerPreference,
        });
        return { adapter, hint: powerPreference };
      } catch (e) {
        console.warn(
          `🎮 Failed to request adapter with ${powerPreference}:`,
          e,
        );
        return null;
      }
    });

    return Promise.all(promises);
  }

  _hintLabelPlain(hint) {
    if (hint === "low-power") return "Low Power";
    if (hint === "high-performance") return "High Performance";
    return "Default";
  }

  _hintLabelParenthesized(hint) {
    if (hint === "low-power") return " (Low Power)";
    if (hint === "high-performance") return " (High Performance)";
    return "";
  }

  _formatVendorArch(vendor, arch) {
    const vendorName = vendor.toUpperCase();
    const archName = arch
      ? ` ${arch.charAt(0).toUpperCase()}${arch.slice(1)}`
      : "";
    return `${vendorName}${archName}`;
  }

  // For additional GPUs, construct a unique name based on hint
  _buildAdditionalGpuName(vendor, arch, hint) {
    const hintLabel = this._hintLabelPlain(hint);
    return `${this._formatVendorArch(vendor, arch)} GPU (${hintLabel})`;
  }

  // Final fallback: construct from vendor + architecture
  _buildFallbackGpuName(vendor, arch, hint) {
    const hintLabel = this._hintLabelParenthesized(hint);
    return `${this._formatVendorArch(vendor, arch)} GPU${hintLabel}`;
  }

  // Build GPU name - prioritize WebGPU info, fall back to WebGL/constructed names
  _resolveGpuName({ description, device, vendor, arch, hint }) {
    let gpuName = description || device;

    // If WebGPU info is empty AND this is the first adapter, try WebGL fallback
    // Don't use WebGL name for multiple adapters since WebGL only sees one GPU
    if ((!gpuName || gpuName.trim() === "") && this.webglInfo) {
      // Only use WebGL fallback if we haven't found any GPU yet
      // This prevents misidentifying multiple GPUs with the same name
      if (this.adapters.size === 0) {
        gpuName = this.webglInfo.renderer;
        // eslint-disable-next-line no-console
        console.log(`🎮 Using WebGL name (first GPU): ${gpuName}`);
      } else {
        gpuName = this._buildAdditionalGpuName(vendor, arch, hint);
        // eslint-disable-next-line no-console
        console.log(`🎮 Using constructed name (additional GPU): ${gpuName}`);
      }
    }

    if (!gpuName || gpuName.trim() === "") {
      gpuName = this._buildFallbackGpuName(vendor, arch, hint);
    }

    return gpuName;
  }

  // Register a single scanForAdapters() result, deduplicating by vendor/architecture signature
  _registerAdapterResult(result) {
    const { adapter, hint } = result;
    const info = adapter.info;

    // Use vendor + architecture since device/description may be empty
    const vendor = info.vendor || "unknown";
    const arch = info.architecture || "unknown";
    const device = info.device || "";
    const description = info.description || "";

    const gpuName = this._resolveGpuName({
      description,
      device,
      vendor,
      arch,
      hint,
    });

    // Signature for deduplication
    const id = `${vendor}-${arch}-${device}-${description}`;

    if (this.adapters.has(id)) return;

    // eslint-disable-next-line no-console
    console.log(
      `🎮 Found GPU: ${gpuName} (${vendor}, ${arch}) via ${hint || "default"}`,
    );

    this.adapters.set(id, {
      id,
      adapter,
      info: {
        ...info,
        displayName: gpuName,
        vendor,
        architecture: arch,
        device: device || "N/A",
        description: description || "N/A",
      },
      tier: this.estimateTier(gpuName, vendor, arch),
      hint,
      webglInfo: this.webglInfo, // Include WebGL info for VRAM
    });
  }

  // 1. The "Probe" - Try to force the browser to reveal different GPUs
  async scanForAdapters() {
    if (!navigator.gpu) {
      console.warn("🎮 WebGPU not supported in this browser");
      return [];
    }

    this._getOrCacheWebGLInfo();

    const hints = [
      "low-power",
      "high-performance",
      undefined, // Default fallback
    ];

    // Run requests in parallel
    const results = await this._requestAdaptersForHints(hints);

    // 2. The "Filter" - Deduplicate adapters based on vendor/architecture signature
    for (const result of results) {
      if (!result || !result.adapter) continue;
      this._registerAdapterResult(result);
    }

    const adapterList = Array.from(this.adapters.values());
    // eslint-disable-next-line no-console
    console.log(`🎮 Total unique GPUs detected: ${adapterList.length}`);

    return adapterList;
  }

  // Helper to guess if it's a discrete card (NVIDIA/AMD) vs Integrated
  estimateTier(displayName, vendor, architecture) {
    const name = displayName.toLowerCase();
    const ven = vendor.toLowerCase();
    const arch = architecture ? architecture.toLowerCase() : "";

    // High-performance indicators
    if (
      name.includes("nvidia") ||
      name.includes("radeon") ||
      name.includes("rtx") ||
      name.includes("geforce") ||
      name.includes("quadro") ||
      name.includes("tesla") ||
      ven === "nvidia" ||
      ven === "amd"
    ) {
      return "High Performance";
    }

    // Integrated indicators
    if (
      name.includes("intel") ||
      name.includes("uhd") ||
      name.includes("iris") ||
      name.includes("xe") ||
      ven === "intel"
    ) {
      return "Integrated";
    }

    // Architecture-based hints
    if (
      arch.includes("ampere") ||
      arch.includes("lovelace") ||
      arch.includes("rdna")
    ) {
      return "High Performance";
    }

    return "Standard";
  }

  // Destroy the current device and rescan to get a completely fresh adapter
  async _forceReinitAdapter(adapterId) {
    // eslint-disable-next-line no-console
    console.log("🎮 Force reinitializing WebGPU device...");

    // Destroy the old device properly
    if (this.device) {
      try {
        this.device.destroy?.();
      } catch (destroyErr) {
        // Ignore destroy errors - device may already be gone
        console.warn(
          "🎮 Ignoring error while destroying stale device:",
          destroyErr,
        );
      }
      this.device = null;
    }

    // Clear state
    this.selectedAdapter = null;
    this.isInitializing = false;
    this.initPromise = null;

    // Clear all cached adapters and rescan to get fresh ones
    this.adapters.clear();
    await this.scanForAdapters();

    // Get the target again after rescan
    const newTarget = this.adapters.get(adapterId);
    if (!newTarget) {
      throw new Error("Failed to find adapter after rescan");
    }

    // Now proceed with the fresh adapter
    this.selectedAdapter = newTarget.adapter;
  }

  // Determine which optional device features to request, based on adapter support
  _addExperimentalFeatures(requiredFeatures, availableFeatures) {
    // eslint-disable-next-line no-console
    console.log(
      "⚡ Experimental WebGPU mode enabled - attempting to use experimental features",
    );
    // eslint-disable-next-line no-console
    console.log(
      "⚡ Available adapter features:",
      Array.from(availableFeatures).join(", "),
    );

    // Check if required experimental features for MLC-AI are available
    const hasSubgroupMatrix =
      availableFeatures.has("chromium-experimental-subgroup-matrix") ||
      availableFeatures.has("chromium_experimental_subgroup_matrix");

    if (
      !hasSubgroupMatrix &&
      (availableFeatures.has("subgroups") ||
        availableFeatures.has("chromium-experimental-subgroups"))
    ) {
      console.warn(
        "⚠️ Subgroup features available but chromium-experimental-subgroup-matrix is not supported",
      );
      console.warn(
        "⚠️ This GPU/driver/browser combination cannot use experimental mode with current MLC-AI models",
      );
      console.warn(
        "⚠️ Falling back to standard WebGPU mode to prevent shader compilation errors",
      );
      return;
    }

    // Try to enable experimental subgroup features if available
    if (availableFeatures.has("chromium-experimental-subgroups")) {
      requiredFeatures.push("chromium-experimental-subgroups");
    }
    if (availableFeatures.has("subgroups")) {
      requiredFeatures.push("subgroups");
    }
    if (
      availableFeatures.has(
        "chromium-experimental-subgroup-uniform-control-flow",
      )
    ) {
      requiredFeatures.push(
        "chromium-experimental-subgroup-uniform-control-flow",
      );
    }
    // Required for u8 type in WGSL shaders (WebLLM) - try both naming conventions
    if (availableFeatures.has("chromium-experimental-subgroup-matrix")) {
      requiredFeatures.push("chromium-experimental-subgroup-matrix");
    }
    if (availableFeatures.has("chromium_experimental_subgroup_matrix")) {
      requiredFeatures.push("chromium_experimental_subgroup_matrix");
    }

    // eslint-disable-next-line no-console
    console.log(
      `⚡ Requesting experimental features: ${requiredFeatures.filter((f) => f.includes("experimental") || f.includes("subgroup")).join(", ") || "none available"}`,
    );
  }

  // Request higher device limits if the adapter supports them (needed for large models)
  _buildRequiredLimits(adapterLimits) {
    const requiredLimits = {};

    // Request higher maxComputeInvocationsPerWorkgroup if adapter supports it
    // This is required for MLC-LLM models that use 1024 workgroup invocations
    if (adapterLimits.maxComputeInvocationsPerWorkgroup >= 1024) {
      requiredLimits.maxComputeInvocationsPerWorkgroup =
        adapterLimits.maxComputeInvocationsPerWorkgroup;
      // eslint-disable-next-line no-console
      console.log(
        `🎮 Requesting maxComputeInvocationsPerWorkgroup: ${requiredLimits.maxComputeInvocationsPerWorkgroup}`,
      );
    }

    // Request higher buffer size limits for large models
    if (adapterLimits.maxStorageBufferBindingSize) {
      requiredLimits.maxStorageBufferBindingSize =
        adapterLimits.maxStorageBufferBindingSize;
    }
    if (adapterLimits.maxBufferSize) {
      requiredLimits.maxBufferSize = adapterLimits.maxBufferSize;
    }

    // Request higher compute workgroup sizes if available
    if (adapterLimits.maxComputeWorkgroupSizeX) {
      requiredLimits.maxComputeWorkgroupSizeX =
        adapterLimits.maxComputeWorkgroupSizeX;
    }
    if (adapterLimits.maxComputeWorkgroupSizeY) {
      requiredLimits.maxComputeWorkgroupSizeY =
        adapterLimits.maxComputeWorkgroupSizeY;
    }
    if (adapterLimits.maxComputeWorkgroupSizeZ) {
      requiredLimits.maxComputeWorkgroupSizeZ =
        adapterLimits.maxComputeWorkgroupSizeZ;
    }

    return requiredLimits;
  }

  // Request device with required features for MLC-LLM
  _buildDeviceRequestConfig() {
    const requiredFeatures = [];

    // Check which features are available and add them if needed
    const availableFeatures = this.selectedAdapter.features;

    // Required for MLC-LLM shader compilation
    if (availableFeatures.has("shader-f16")) {
      requiredFeatures.push("shader-f16");
    }

    // Experimental features - DISABLED by default for stability
    const experimentalMode = false; // Disabled until custom model compilation complete
    if (experimentalMode) {
      this._addExperimentalFeatures(requiredFeatures, availableFeatures);
    }

    // Get adapter limits to request higher limits if available
    const adapterLimits = this.selectedAdapter.limits;
    const requiredLimits = this._buildRequiredLimits(adapterLimits);

    return { requiredFeatures, requiredLimits };
  }

  // Request the device, falling back to a fresh adapter if the stale one fails
  // (can happen during hot module reload)
  async _requestDeviceWithFallback(requiredFeatures, requiredLimits, target) {
    try {
      this.device = await this.selectedAdapter.requestDevice({
        requiredFeatures:
          requiredFeatures.length > 0 ? requiredFeatures : undefined,
        requiredLimits:
          Object.keys(requiredLimits).length > 0 ? requiredLimits : undefined,
      });
    } catch (deviceErr) {
      console.warn(
        "🎮 Device creation failed, attempting fresh adapter...",
        deviceErr.message,
      );

      // Get a fresh adapter
      const freshAdapter = await navigator.gpu.requestAdapter({
        powerPreference: target.info.powerPreference || "high-performance",
      });

      if (freshAdapter) {
        this.selectedAdapter = freshAdapter;
        this.device = await freshAdapter.requestDevice({
          requiredFeatures:
            requiredFeatures.length > 0 ? requiredFeatures : undefined,
          requiredLimits:
            Object.keys(requiredLimits).length > 0
              ? requiredLimits
              : undefined,
        });
      } else {
        throw deviceErr; // Re-throw if we couldn't get a fresh adapter
      }
    }
  }

  async selectAdapter(adapterId, options = {}) {
    const target = this.adapters.get(adapterId);
    if (!target) throw new Error("Adapter not found");

    // If force reinit is requested, we need to get a completely fresh adapter
    if (options.forceReinit) {
      await this._forceReinitAdapter(adapterId);
    }

    // If we already have a device for this exact adapter, return it immediately
    // (but only if we didn't just reinit)
    if (
      this.device &&
      this.selectedAdapter === target.adapter &&
      !options.forceReinit
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `🎮 [Vet-Rate GPU] Already locked to: ${target.info.displayName}`,
      );
      return this.device;
    }

    // If currently initializing the same adapter, wait for it
    if (
      this.isInitializing &&
      this.initPromise &&
      this.selectedAdapter === target.adapter &&
      !options.forceReinit
    ) {
      // eslint-disable-next-line no-console
      console.log(
        `🎮 [Vet-Rate GPU] Waiting for initialization to complete...`,
      );
      return await this.initPromise;
    }

    // Mark as initializing
    this.isInitializing = true;

    // Use the appropriate adapter (fresh one if reinit, original otherwise)
    const adapterToUse = options.forceReinit
      ? this.adapters.get(adapterId)?.adapter
      : target.adapter;

    if (!adapterToUse) {
      this.isInitializing = false;
      throw new Error("No valid adapter to use");
    }

    this.selectedAdapter = adapterToUse;

    // Initialize the device (this is where we lock it in)
    this.initPromise = (async () => {
      try {
        const { requiredFeatures, requiredLimits } =
          this._buildDeviceRequestConfig();

        // Device creation failed - this can happen during hot module reload
        // when the adapter becomes stale. _requestDeviceWithFallback retries
        // with a fresh adapter in that case.
        await this._requestDeviceWithFallback(
          requiredFeatures,
          requiredLimits,
          target,
        );

        // eslint-disable-next-line no-console
        console.log(`🎮 [Vet-Rate GPU] Locked to: ${target.info.displayName}`);
        if (requiredFeatures.length > 0) {
          // eslint-disable-next-line no-console
          console.log(
            `🎮 [Vet-Rate GPU] Enabled features: ${requiredFeatures.join(", ")}`,
          );
        }

        // Store selection in localStorage
        localStorage.setItem("vet_rate_selected_gpu", adapterId);

        return this.device;
      } catch (err) {
        console.error("🎮 Failed to initialize GPU device:", err);
        this.isInitializing = false;
        this.initPromise = null;
        throw err;
      } finally {
        this.isInitializing = false;
      }
    })();

    return await this.initPromise;
  }

  getDevice() {
    return this.device;
  }

  getSelectedAdapter() {
    return this.selectedAdapter;
  }

  getAdapters() {
    return Array.from(this.adapters.values());
  }

  async autoSelectBest() {
    // If we already have a valid device, return it (prevents React strict mode double-init)
    if (this.device) {
      // eslint-disable-next-line no-console
      console.log("🎮 Device already initialized, reusing existing device");
      return this.device;
    }

    // Only scan if we don't have adapters yet
    let adapters = Array.from(this.adapters.values());
    if (adapters.length === 0) {
      adapters = await this.scanForAdapters();
    }

    // Try to restore previous selection
    const savedId = localStorage.getItem("vet_rate_selected_gpu");
    if (savedId && this.adapters.has(savedId)) {
      // eslint-disable-next-line no-console
      console.log("🎮 Restoring previous GPU selection");
      try {
        return await this.selectAdapter(savedId);
      } catch (err) {
        if (err.message?.includes("consumed")) {
          console.warn(
            "🎮 Saved adapter was consumed, rescanning for fresh adapters...",
          );
          this.adapters.clear();
          adapters = await this.scanForAdapters();
          // Continue to auto-select below
        } else {
          throw err;
        }
      }
    }

    // Auto-select the "High Performance" one if available
    const best =
      adapters.find((a) => a.tier === "High Performance") || adapters[0];
    if (best) {
      // eslint-disable-next-line no-console
      console.log("🎮 Auto-selecting best available GPU");
      try {
        return await this.selectAdapter(best.id);
      } catch (err) {
        if (err.message?.includes("consumed")) {
          console.warn(
            "🎮 Best adapter was consumed, rescanning for fresh adapters...",
          );
          this.adapters.clear();
          const freshAdapters = await this.scanForAdapters();
          const freshBest =
            freshAdapters.find((a) => a.tier === "High Performance") ||
            freshAdapters[0];
          if (freshBest) {
            return await this.selectAdapter(freshBest.id);
          }
        }
        throw err;
      }
    }

    throw new Error("No GPU adapters found");
  }

  // Helper to get estimated VRAM from limits
  estimateVRAM(adapterEntry) {
    try {
      if (!adapterEntry) return "Unknown";

      // First, try WebGL info if available
      if (adapterEntry.webglInfo && adapterEntry.webglInfo.vram) {
        return `${adapterEntry.webglInfo.vram} GB`;
      }

      // Safely access the adapter's limits - adapter is nested property
      const rawAdapter = adapterEntry.adapter;
      if (!rawAdapter || typeof rawAdapter !== "object") {
        return "Unknown";
      }

      // Check if adapter has limits property
      const limits = rawAdapter.limits;
      if (!limits) {
        // Try to get limits from info if available
        if (adapterEntry.info && adapterEntry.info.limits) {
          const maxBuffer = adapterEntry.info.limits.maxBufferSize || 0;
          if (maxBuffer > 0) {
            const estimatedGB = Math.round((maxBuffer / 1024 ** 3) * 10) / 10;
            return estimatedGB > 0 ? `~${estimatedGB}+ GB` : "Unknown";
          }
        }
        return "Unknown";
      }

      // Use maxBufferSize as a rough estimate (in GB)
      const maxBuffer = limits.maxBufferSize || 0;
      const estimatedGB = Math.round((maxBuffer / 1024 ** 3) * 10) / 10;

      if (estimatedGB > 0) {
        return `~${estimatedGB}+ GB`;
      }

      return "Unknown";
    } catch (err) {
      console.warn("🎮 Error estimating VRAM:", err.message);
      return "Unknown";
    }
  }
}

// Singleton instance
export const gpuManager = new GPUDiscoveryEngine();

export default gpuManager;
