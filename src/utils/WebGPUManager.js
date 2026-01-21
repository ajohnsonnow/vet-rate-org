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
    const canvas = document.createElement('canvas');
    const gl = canvas.gl = canvas.getContext('webgl') || canvas.getContext('experimental-webgl');
    
    if (!gl) return null;
    
    const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
    if (!debugInfo) return null;
    
    const renderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL);
    const vendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL);
    
    // Clean up the renderer string - extract just the GPU name
    let cleanName = renderer;
    
    // Pattern 1: "ANGLE (NVIDIA, NVIDIA GeForce RTX 4070 Ti SUPER (0x00002705) Direct3D11..."
    const angleMatch = renderer.match(/ANGLE \(.*?,\s*(.*?)\s*\(/);
    if (angleMatch) {
      cleanName = angleMatch[1].trim();
    } 
    // Pattern 2: "NVIDIA GeForce RTX 4070 Ti SUPER / PCIe / SSE2"
    else if (renderer.includes('/')) {
      cleanName = renderer.split('/')[0].trim();
    }
    // Pattern 3: Extract vendor + model from parentheses
    else {
      const modelMatch = renderer.match(/(NVIDIA|AMD|Intel)\s+(GeForce|Radeon|Arc|Iris).*?(?=\s*\(|$)/i);
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
      vram = unit === 'GB' ? amount : Math.round(amount / 1024);
    }
    
    return {
      renderer: cleanName, // Use cleaned name
      rawRenderer: renderer, // Keep raw for debugging
      vendor,
      vram
    };
  } catch (e) {
    console.warn('🎮 WebGL GPU detection failed:', e);
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

  // 1. The "Probe" - Try to force the browser to reveal different GPUs
  async scanForAdapters() {
    if (!navigator.gpu) {
      console.warn('🎮 WebGPU not supported in this browser');
      return [];
    }

    // Get WebGL info for fallback GPU detection
    if (!this.webglInfo) {
      this.webglInfo = getWebGLGPUInfo();
      if (this.webglInfo) {
        console.log(`🎮 WebGL detected: ${this.webglInfo.renderer} (${this.webglInfo.vendor})`);
        if (this.webglInfo.vram) {
          console.log(`🎮 WebGL VRAM: ${this.webglInfo.vram} GB`);
        }
      }
    }

    const hints = [
      'low-power', 
      'high-performance', 
      undefined // Default fallback
    ];

    const foundAdapters = [];

    // Run requests in parallel
    const promises = hints.map(async (powerPreference) => {
      try {
        const adapter = await navigator.gpu.requestAdapter({
          powerPreference: powerPreference
        });
        return { adapter, hint: powerPreference };
      } catch (e) {
        console.warn(`🎮 Failed to request adapter with ${powerPreference}:`, e);
        return null;
      }
    });

    const results = await Promise.all(promises);

    // 2. The "Filter" - Deduplicate adapters based on vendor/architecture signature
    for (const result of results) {
      if (!result || !result.adapter) continue;

      const { adapter, hint } = result;
      const info = adapter.info;
      
      // Create a unique signature for this GPU
      // Use vendor + architecture since device/description may be empty
      const vendor = info.vendor || 'unknown';
      const arch = info.architecture || 'unknown';
      const device = info.device || '';
      const description = info.description || '';
      
      // Build GPU name - prioritize WebGL renderer info if available
      let gpuName = description || device;
      
      // If WebGPU info is empty, try WebGL fallback
      if ((!gpuName || gpuName.trim() === '') && this.webglInfo) {
        gpuName = this.webglInfo.renderer;
        console.log(`🎮 Using WebGL name: ${gpuName}`);
      }
      
      // Final fallback: construct from vendor + architecture
      if (!gpuName || gpuName.trim() === '') {
        const vendorName = vendor.toUpperCase();
        const archName = arch ? ` ${arch.charAt(0).toUpperCase()}${arch.slice(1)}` : '';
        gpuName = `${vendorName}${archName} GPU`;
      }
      
      // Signature for deduplication
      const id = `${vendor}-${arch}-${device}-${description}`;
      
      if (!this.adapters.has(id)) {
        console.log(`🎮 Found GPU: ${gpuName} (${vendor}, ${arch}) via ${hint || 'default'}`);
        
        this.adapters.set(id, {
          id,
          adapter,
          info: {
            ...info,
            displayName: gpuName,
            vendor,
            architecture: arch,
            device: device || 'N/A',
            description: description || 'N/A'
          },
          tier: this.estimateTier(gpuName, vendor, arch),
          hint,
          webglInfo: this.webglInfo // Include WebGL info for VRAM
        });
      }
    }

    const adapterList = Array.from(this.adapters.values());
    console.log(`🎮 Total unique GPUs detected: ${adapterList.length}`);
    
    return adapterList;
  }

  // Helper to guess if it's a discrete card (NVIDIA/AMD) vs Integrated
  estimateTier(displayName, vendor, architecture) {
    const name = displayName.toLowerCase();
    const ven = vendor.toLowerCase();
    const arch = architecture ? architecture.toLowerCase() : '';
    
    // High-performance indicators
    if (name.includes('nvidia') || name.includes('radeon') || name.includes('rtx') || 
        name.includes('geforce') || name.includes('quadro') || name.includes('tesla') ||
        ven === 'nvidia' || ven === 'amd') {
      return 'High Performance';
    }
    
    // Integrated indicators
    if (name.includes('intel') || name.includes('uhd') || name.includes('iris') || 
        name.includes('xe') || ven === 'intel') {
      return 'Integrated';
    }
    
    // Architecture-based hints
    if (arch.includes('ampere') || arch.includes('lovelace') || arch.includes('rdna')) {
      return 'High Performance';
    }
    
    return 'Standard';
  }

  async selectAdapter(adapterId, options = {}) {
    const target = this.adapters.get(adapterId);
    if (!target) throw new Error("Adapter not found");

    // If force reinit is requested, we need to get a fresh adapter
    if (options.forceReinit) {
      console.log('🎮 Force reinitializing WebGPU device...');
      // Clear the old device
      if (this.device) {
        this.device.destroy?.();
        this.device = null;
      }
      this.selectedAdapter = null;
      this.isInitializing = false;
      this.initPromise = null;
      
      // Request a fresh adapter from the browser
      try {
        const freshAdapter = await navigator.gpu.requestAdapter({
          powerPreference: target.hint
        });
        
        if (!freshAdapter) {
          throw new Error('Failed to request fresh adapter');
        }
        
        // Update the target adapter with the fresh one
        target.adapter = freshAdapter;
        this.selectedAdapter = freshAdapter;
      } catch (err) {
        console.error('Failed to get fresh adapter:', err);
        throw err;
      }
    }

    // If we already have a device for this exact adapter, return it immediately
    if (this.device && this.selectedAdapter === target.adapter && !options.forceReinit) {
      console.log(`🎮 [Vet-Rate GPU] Already locked to: ${target.info.displayName}`);
      return this.device;
    }
    
    // If currently initializing the same adapter, wait for it
    if (this.isInitializing && this.initPromise && this.selectedAdapter === target.adapter && !options.forceReinit) {
      console.log(`🎮 [Vet-Rate GPU] Waiting for initialization to complete...`);
      return await this.initPromise;
    }
    
    // Mark as initializing
    this.isInitializing = true;
    this.selectedAdapter = target.adapter;
    
    // Initialize the device (this is where we lock it in)
    this.initPromise = (async () => {
      try {
        // Request device with required features for MLC-LLM
        const requiredFeatures = [];
        
        // Check which features are available and add them if needed
        const availableFeatures = this.selectedAdapter.features;
        
        // Required for MLC-LLM shader compilation
        if (availableFeatures.has('shader-f16')) {
          requiredFeatures.push('shader-f16');
        }
        
        // Experimental features - only add if explicitly requested
        const experimentalMode = options.experimental || localStorage.getItem('vet_rate_experimental_webgpu') === 'true';
        if (experimentalMode) {
          console.log('⚡ Experimental WebGPU mode enabled - attempting to use experimental features');
          console.log('⚡ Available adapter features:', Array.from(availableFeatures).join(', '));
          
          // Try to enable experimental subgroup features if available
          if (availableFeatures.has('chromium-experimental-subgroups')) {
            requiredFeatures.push('chromium-experimental-subgroups');
          }
          if (availableFeatures.has('subgroups')) {
            requiredFeatures.push('subgroups');
          }
          if (availableFeatures.has('chromium-experimental-subgroup-uniform-control-flow')) {
            requiredFeatures.push('chromium-experimental-subgroup-uniform-control-flow');
          }
          // Required for u8 type in WGSL shaders (WebLLM) - try both naming conventions
          if (availableFeatures.has('chromium-experimental-subgroup-matrix')) {
            requiredFeatures.push('chromium-experimental-subgroup-matrix');
          }
          if (availableFeatures.has('chromium_experimental_subgroup_matrix')) {
            requiredFeatures.push('chromium_experimental_subgroup_matrix');
          }
          
          console.log(`⚡ Requesting experimental features: ${requiredFeatures.filter(f => f.includes('experimental') || f.includes('subgroup')).join(', ') || 'none available'}`);
        }
        
        this.device = await this.selectedAdapter.requestDevice({
          requiredFeatures: requiredFeatures.length > 0 ? requiredFeatures : undefined
        });
        console.log(`🎮 [Vet-Rate GPU] Locked to: ${target.info.displayName}`);
        if (requiredFeatures.length > 0) {
          console.log(`🎮 [Vet-Rate GPU] Enabled features: ${requiredFeatures.join(', ')}`);
        }
        
        // Store selection in localStorage
        localStorage.setItem('vet_rate_selected_gpu', adapterId);
        
        return this.device;
      } catch (err) {
        console.error('🎮 Failed to initialize GPU device:', err);
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
    // Only scan if we don't have adapters yet
    let adapters = Array.from(this.adapters.values());
    if (adapters.length === 0) {
      adapters = await this.scanForAdapters();
    }
    
    // Try to restore previous selection
    const savedId = localStorage.getItem('vet_rate_selected_gpu');
    if (savedId && this.adapters.has(savedId)) {
      console.log('🎮 Restoring previous GPU selection');
      return await this.selectAdapter(savedId);
    }
    
    // Auto-select the "High Performance" one if available
    const best = adapters.find(a => a.tier === 'High Performance') || adapters[0];
    if (best) {
      console.log('🎮 Auto-selecting best available GPU');
      return await this.selectAdapter(best.id);
    }
    
    throw new Error('No GPU adapters found');
  }

  // Helper to get estimated VRAM from limits
  estimateVRAM(adapter) {
    if (!adapter || !adapter.info) return 'Unknown';
    
    // First, try WebGL info if available
    if (adapter.webglInfo && adapter.webglInfo.vram) {
      return `${adapter.webglInfo.vram} GB`;
    }
    
    // Fallback to WebGPU limits estimation
    const limits = adapter.adapter.limits;
    if (!limits) return 'Unknown';
    
    // Use maxBufferSize as a rough estimate (in GB)
    const maxBuffer = limits.maxBufferSize || 0;
    const estimatedGB = Math.round((maxBuffer / (1024 ** 3)) * 10) / 10;
    
    if (estimatedGB > 0) {
      return `~${estimatedGB}+ GB`;
    }
    
    return 'Unknown';
  }
}

// Singleton instance
export const gpuManager = new GPUDiscoveryEngine();

export default gpuManager;
