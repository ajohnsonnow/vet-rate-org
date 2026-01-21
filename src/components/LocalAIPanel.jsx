/**
 * Vet-Rate.org - Local AI Provider
 * "The Faraday Cage Protocol" - Run AI completely locally, zero data leaves your device
 * 
 * This is the ULTIMATE trust signal for privacy-conscious veterans.
 * Uses WebLLM to run quantized models directly in the browser via WebGPU.
 * 
 * Even if you unplug your internet, the AI still works.
 */

import React, { useState, useEffect, useCallback, useContext, createContext } from 'react';
import { registerLocalAIEngine } from '../utils/unifiedAIService';
import ToolCardButton from './ToolCardButton';
import ReportBugLink from './ReportBugLink';
import GPUSelector from './GPUSelector';
import { gpuManager } from '../utils/WebGPUManager';

// Storage key for GPU preference
const GPU_PREFERENCE_KEY = 'vet_rate_gpu_preference';

// GPU preference options
export const GPU_PREFERENCES = {
  AUTO: 'auto',           // Let browser decide (default behavior)
  HIGH_PERFORMANCE: 'high-performance',  // Prefer discrete GPU (gaming/workstation)
  LOW_POWER: 'low-power', // Prefer integrated GPU (battery saver)
};

/**
 * Get the saved GPU preference
 */
export const getGPUPreference = () => {
  return localStorage.getItem(GPU_PREFERENCE_KEY) || GPU_PREFERENCES.AUTO;
};

/**
 * Save GPU preference
 */
export const setGPUPreference = (preference) => {
  if (Object.values(GPU_PREFERENCES).includes(preference)) {
    localStorage.setItem(GPU_PREFERENCE_KEY, preference);
    return true;
  }
  return false;
};

/**
 * Get adapter info helper with fallbacks
 */
const getAdapterInfo = async (adapter) => {
  let adapterInfo = { vendor: 'Unknown', architecture: 'Unknown', device: 'Unknown GPU', description: '' };
  
  try {
    // Modern browsers (Chrome 121+)
    if (typeof adapter.requestAdapterInfo === 'function') {
      adapterInfo = await adapter.requestAdapterInfo();
      console.log('🎮 Raw GPU Adapter Info:', adapterInfo);
    } 
    // Fallback: Try direct property access (older implementations)
    else if (adapter.info) {
      adapterInfo = adapter.info;
      console.log('🎮 GPU Adapter Info (fallback):', adapterInfo);
    }
    // Some browsers expose it as a getter
    else if (adapter.features && adapter.limits) {
      adapterInfo = { vendor: 'WebGPU Compatible', device: 'GPU Detected', description: 'WebGPU is functional' };
    }
  } catch (infoErr) {
    console.log('Could not get detailed adapter info, but WebGPU is available');
    adapterInfo = { vendor: 'WebGPU Compatible', device: 'GPU Detected', description: 'WebGPU is functional' };
  }
  
  return adapterInfo;
};

/**
 * Enumerate available GPUs by trying different power preferences
 * Returns info about both high-performance and low-power GPUs if available
 */
/**
 * Get detailed GPU adapter information
 */
const getDetailedAdapterInfo = async (adapter) => {
  if (!adapter) return null;
  
  const limits = adapter.limits;
  const features = Array.from(adapter.features || []);
  const info = await getAdapterInfo(adapter);
  
  // Estimate VRAM from max buffer size (rough approximation)
  const estimatedVRAM = limits.maxBufferSize ? 
    Math.floor(limits.maxBufferSize / (1024 * 1024 * 1024)) : null;
  
  // Build a meaningful GPU name if description/device are empty
  let gpuName = info.description || info.device;
  if (!gpuName || gpuName.trim() === '') {
    // Fallback: Use vendor + architecture to create a descriptive name
    const vendorName = (info.vendor || 'Unknown').toUpperCase();
    const arch = info.architecture ? ` ${info.architecture.charAt(0).toUpperCase()}${info.architecture.slice(1)}` : '';
    gpuName = `${vendorName}${arch} GPU`;
  }
  
  return {
    ...info,
    device: gpuName,
    description: gpuName,
    limits: {
      maxTextureSize: limits.maxTextureDimension2D,
      maxBufferSize: `${Math.floor(limits.maxBufferSize / (1024 * 1024))} MB`,
      maxComputeWorkgroupSizeX: limits.maxComputeWorkgroupSizeX,
      maxComputeWorkgroupsPerDimension: limits.maxComputeWorkgroupsPerDimension,
    },
    features: features,
    estimatedVRAM: estimatedVRAM ? `~${estimatedVRAM}+ GB` : 'Unknown',
  };
};

export const enumerateGPUs = async () => {
  if (!navigator.gpu) {
    return { available: [], error: 'WebGPU not available' };
  }
  
  const gpus = [];
  const seen = new Set(); // Track unique GPUs
  
  try {
    // Try high-performance (discrete GPU)
    const highPerfAdapter = await navigator.gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (highPerfAdapter) {
      const detailedInfo = await getDetailedAdapterInfo(highPerfAdapter);
      const gpuId = `${detailedInfo.vendor}-${detailedInfo.device}`;
      
      if (!seen.has(gpuId)) {
        seen.add(gpuId);
        const gpuName = detailedInfo.device || detailedInfo.description || 'Discrete GPU';
        gpus.push({
          type: 'high-performance',
          label: '🚀 High Performance',
          description: 'Best for AI - Uses dedicated GPU',
          vendor: detailedInfo.vendor || 'Unknown',
          device: gpuName,
          architecture: detailedInfo.architecture || 'Unknown',
          vram: detailedInfo.estimatedVRAM,
          limits: detailedInfo.limits,
          features: detailedInfo.features,
          adapter: detailedInfo,
        });
      }
    }
    
    // Try low-power (integrated GPU)
    const lowPowerAdapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' });
    if (lowPowerAdapter) {
      const detailedInfo = await getDetailedAdapterInfo(lowPowerAdapter);
      const gpuId = `${detailedInfo.vendor}-${detailedInfo.device}`;
      
      if (!seen.has(gpuId)) {
        seen.add(gpuId);
        const gpuName = detailedInfo.device || detailedInfo.description || 'Integrated GPU';
        gpus.push({
          type: 'low-power',
          label: '🔋 Power Saver',
          description: 'Extends battery life - Uses integrated GPU',
          vendor: detailedInfo.vendor || 'Unknown',
          device: gpuName,
          architecture: detailedInfo.architecture || 'Unknown',
          vram: detailedInfo.estimatedVRAM,
          limits: detailedInfo.limits,
          features: detailedInfo.features,
          adapter: detailedInfo,
        });
      }
    }
    
    console.log(`🎮 GPU Enumeration Complete:`);
    console.log(`   - Total GPUs found: ${gpus.length}`);
    console.log(`   - Has dual GPU: ${gpus.length > 1}`);
    gpus.forEach((gpu, idx) => {
      console.log(`   - GPU ${idx + 1}: ${gpu.device} (${gpu.vendor}) - ${gpu.type}`);
    });
    
    return { available: gpus, hasDualGPU: gpus.length > 1, hasMultiGPU: gpus.length >= 2 };
  } catch (err) {
    console.error('❌ Error enumerating GPUs:', err);
    return { available: [], error: err.message };
  }
};

// Check WebGPU support using the new WebGPUManager
const checkWebGPUSupport = async (forcePowerPreference = null) => {
  if (!navigator.gpu) {
    return { supported: false, reason: 'WebGPU not available in this browser. Try Chrome 113+, Edge 113+, or Firefox Nightly.' };
  }
  
  try {
    console.log('🎮 Initializing WebGPU Manager...');
    
    // Scan for available GPUs using the new manager
    const adapters = await gpuManager.scanForAdapters();
    
    if (adapters.length === 0) {
      return { supported: false, reason: 'No WebGPU adapter found (GPU may not be compatible)' };
    }
    
    // Auto-select best GPU or restore previous selection
    await gpuManager.autoSelectBest();
    const device = gpuManager.getDevice();
    
    if (!device) {
      return { supported: false, reason: 'Failed to initialize GPU device' };
    }
    
    // Get the selected adapter info
    const selectedAdapter = gpuManager.getSelectedAdapter();
    const selectedGPU = adapters.find(a => a.adapter === selectedAdapter);
    
    if (!selectedGPU) {
      return { supported: false, reason: 'Selected GPU not found' };
    }
    
    console.log(`🎮 WebGPU Manager initialized with ${adapters.length} GPU(s)`);
    console.log(`🎮 Selected: ${selectedGPU.info.displayName}`);
    
    // Check for required features
    const requiredFeatures = ['shader-f16']; // MLC-LLM typically needs float16 support
    const availableFeatures = Array.from(selectedAdapter.features || []);
    const missingFeatures = requiredFeatures.filter(f => !availableFeatures.includes(f));
    
    if (missingFeatures.length > 0) {
      console.warn(`⚠️ Missing WebGPU features: ${missingFeatures.join(', ')}`);
      console.warn('⚠️ Some AI models may not work properly');
    }
    
    return {
      supported: true,
      adapter: selectedGPU.info,
      vendor: selectedGPU.info.vendor,
      device: selectedGPU.info.displayName,
      currentPreference: selectedGPU.hint || 'auto',
      availableFeatures,
      missingFeatures,
      availableGPUs: adapters.map(a => ({
        type: a.tier.toLowerCase().replace(' ', '-'),
        label: a.tier === 'High Performance' ? '🚀 High Performance' : a.tier === 'Integrated' ? '🔋 Power Saver' : '⚙️ Standard',
        description: a.tier === 'High Performance' ? 'Best for AI - Uses dedicated GPU' : a.tier === 'Integrated' ? 'Extends battery life - Uses integrated GPU' : 'Standard GPU',
        vendor: a.info.vendor,
        device: a.info.displayName,
        architecture: a.info.architecture,
        vram: gpuManager.estimateVRAM(a),
        adapter: a.info,
      })),
      hasDualGPU: adapters.length > 1,
    };
  } catch (err) {
    console.error('🎮 WebGPU Manager error:', err);
    return { supported: false, reason: `WebGPU initialization failed: ${err.message}` };
  }
};

// Available models organized by RECOMMENDED USE CASE
// Each model has a bestFor field to help users choose the right one for their task
// Note: These model IDs must match exactly what's in @mlc-ai/web-llm's prebuiltAppConfig
const AVAILABLE_MODELS = [
  // === ⚡ QUICK TASKS - Fast responses for simple queries ===
  {
    id: 'SmolLM2-360M-Instruct-q4f32_1-MLC',
    name: 'SmolLM2 360M (Tiny)',
    size: '0.3 GB',
    description: 'Ultra-tiny, works on low-end devices',
    bestFor: '⚡ Quick Tasks',
    contextInfo: 'Best for: Basic questions, search enhancement, simple queries',
    vramRequired: '1 GB',
    recommended: false,
    category: 'ultra-light',
  },
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 1B (Fastest)',
    size: '0.7 GB',
    description: 'Ultra-fast, good for simple queries',
    bestFor: '⚡ Quick Tasks',
    contextInfo: 'Best for: Secondary Scout, calculator help, quick lookups',
    vramRequired: '2 GB',
    recommended: false,
    category: 'ultra-light',
  },
  // === LIGHT (1-2 GB) - Fast and efficient ===
  {
    id: 'Qwen2.5-1.5B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 1.5B (Fast)',
    size: '1.0 GB',
    description: 'Alibaba model, excellent multilingual',
    bestFor: '⚡ Quick Tasks',
    contextInfo: 'Best for: Fast responses, form field suggestions',
    vramRequired: '2 GB',
    recommended: false,
    category: 'light',
  },
  {
    id: 'SmolLM2-1.7B-Instruct-q4f32_1-MLC',
    name: 'SmolLM2 1.7B (Efficient)',
    size: '1.5 GB',
    description: 'Compact but capable, low memory usage',
    bestFor: '⚡ Quick Tasks',
    contextInfo: 'Best for: Good quality on limited hardware',
    vramRequired: '3 GB',
    recommended: false,
    category: 'light',
  },
  {
    id: 'gemma-2-2b-it-q4f32_1-MLC',
    name: 'Gemma 2 2B (Compact)',
    size: '1.4 GB',
    description: 'Google model, efficient and capable',
    bestFor: '⚡ Quick Tasks',
    contextInfo: 'Best for: General tasks with lower memory usage',
    vramRequired: '3 GB',
    recommended: false,
    category: 'light',
  },
  {
    id: 'Qwen3-1.7B-q4f32_1-MLC',
    name: 'Qwen 3 1.7B (Latest)',
    size: '1.2 GB',
    description: 'Newest Qwen generation, cutting-edge',
    bestFor: '⚡ Quick Tasks',
    contextInfo: 'Best for: Modern reasoning with low memory',
    vramRequired: '3 GB',
    recommended: false,
    category: 'light',
    isNew: true,
  },
  // === BALANCED (2-3 GB) - Best for most users ===
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 3B (Balanced) ✓',
    size: '1.8 GB',
    description: 'Good balance of speed and quality',
    bestFor: '📋 Forms & Writing',
    contextInfo: 'Best for: Forms Helper, basic statements, medium documents',
    vramRequired: '4 GB',
    recommended: true,
    category: 'balanced',
  },
  {
    id: 'Hermes-3-Llama-3.2-3B-q4f32_1-MLC',
    name: 'Hermes 3 3B (Function Calling)',
    size: '2.0 GB',
    description: 'Supports function calling, enhanced reasoning',
    bestFor: '📋 Forms & Writing',
    contextInfo: 'Best for: Structured outputs and tool use',
    vramRequired: '4 GB',
    recommended: false,
    category: 'balanced',
    isNew: true,
  },
  {
    id: 'Qwen2.5-3B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 3B (Smart)',
    size: '2.0 GB',
    description: 'Alibaba model, strong reasoning',
    bestFor: '📋 Forms & Writing',
    contextInfo: 'Best for: Form completion, basic analysis',
    vramRequired: '4 GB',
    recommended: false,
    category: 'balanced',
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
    name: 'Phi 3.5 Mini (Specialized)',
    size: '2.3 GB',
    description: 'Microsoft model, great for reasoning',
    bestFor: '⚖️ Legal Analysis',
    contextInfo: 'Best for: Decision Decoder, regulatory interpretation',
    vramRequired: '4 GB',
    recommended: false,
    category: 'balanced',
  },
  {
    id: 'Qwen3-4B-q4f32_1-MLC',
    name: 'Qwen 3 4B (Sweet Spot)',
    size: '2.5 GB',
    description: 'Newest Qwen, excellent price/performance',
    bestFor: '📋 Forms & Writing',
    contextInfo: 'Best for: Strong reasoning with moderate resources',
    vramRequired: '4 GB',
    recommended: false,
    category: 'balanced',
    isNew: true,
  },
  // === POWERFUL (4-6 GB) - For serious analysis ===
  {
    id: 'DeepSeek-R1-Distill-Qwen-7B-q4f32_1-MLC',
    name: 'DeepSeek R1 7B (Reasoning) ⭐',
    size: '3.5 GB',
    description: 'Chain-of-thought reasoning, excellent for claims',
    bestFor: '📄 Document Parsing • 🔴 Adversarial',
    contextInfo: 'Best for: C-Files, DD214s, Red Team, War Room, claim analysis',
    vramRequired: '6 GB',
    recommended: false,
    category: 'powerful',
    isNew: true,
    isFeatured: true,
  },
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
    name: 'Mistral 7B (Powerful)',
    size: '4.1 GB',
    description: 'High quality, requires more VRAM',
    bestFor: '✍️ Creative Writing',
    contextInfo: 'Best for: Nexus letters, witness interviews, natural prose',
    vramRequired: '8 GB',
    recommended: false,
    category: 'powerful',
  },
  {
    id: 'Qwen2.5-7B-Instruct-q4f32_1-MLC',
    name: 'Qwen 2.5 7B (Premium)',
    size: '4.5 GB',
    description: 'Top-tier Alibaba model, excellent quality',
    bestFor: '📄 Document Parsing • 🏥 Medical',
    contextInfo: 'Best for: Blue Button X-Ray, medical records, lab values',
    vramRequired: '8 GB',
    recommended: false,
    category: 'powerful',
  },
  {
    id: 'DeepSeek-R1-Distill-Llama-8B-q4f32_1-MLC',
    name: 'DeepSeek R1 Llama 8B (Pro)',
    size: '4.5 GB',
    description: 'Advanced reasoning based on Llama 3.1',
    bestFor: '⚖️ Legal Analysis • 💼 TDIU',
    contextInfo: 'Best for: TDIU Builder, professional-grade claim analysis',
    vramRequired: '6 GB',
    recommended: false,
    category: 'powerful',
    isNew: true,
  },
  {
    id: 'Qwen3-8B-q4f32_1-MLC',
    name: 'Qwen 3 8B (Top Tier)',
    size: '4.8 GB',
    description: 'Latest and most capable Qwen model',
    bestFor: '✍️ Creative Writing',
    contextInfo: 'Best for: Nexus Builder, personal statements, maximum quality',
    vramRequired: '7 GB',
    recommended: false,
    category: 'powerful',
    isNew: true,
  },
  // === VISION (Image Analysis) ===
  {
    id: 'Phi-3.5-vision-instruct-q4f32_1-MLC',
    name: 'Phi 3.5 Vision (See Images) 👁️',
    size: '3.5 GB',
    description: 'Can analyze DD214 images and documents!',
    bestFor: '👁️ Vision - Scanned Docs',
    contextInfo: 'Best for: DD214 photos, scanned documents, image analysis',
    vramRequired: '6 GB',
    recommended: false,
    category: 'vision',
    isNew: true,
    hasVision: true,
  },
];

// Context for Local AI state
const LocalAIContext = createContext(null);

/**
 * useLocalAI hook - Access local AI functionality
 */
export const useLocalAI = () => {
  const context = useContext(LocalAIContext);
  if (!context) {
    throw new Error('useLocalAI must be used within a LocalAIProvider');
  }
  return context;
};

/**
 * LocalAIProvider Component
 * Provides local AI capabilities to the entire app
 */
export const LocalAIProvider = ({ children }) => {
  // WebGPU state
  const [webGPUStatus, setWebGPUStatus] = useState({ checked: false, supported: false });
  const [selectedModel, setSelectedModel] = useState(AVAILABLE_MODELS[1]); // Default to balanced
  const [installedModels, setInstalledModels] = useState(new Set());
  const [gpuPreference, setGpuPreferenceState] = useState(getGPUPreference());
  
  // Engine state
  const [engine, setEngine] = useState(null);
  const [loadedModelId, setLoadedModelId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ progress: 0, text: '' });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  
  // Chat state
  const [isGenerating, setIsGenerating] = useState(false);
  
  // Experimental features state
  const [experimentalMode, setExperimentalMode] = useState(() => {
    return localStorage.getItem('vet_rate_experimental_webgpu') === 'true';
  });
  const [showExperimentalWarning, setShowExperimentalWarning] = useState(false);

  // Update GPU preference and re-check WebGPU
  const updateGPUPreference = useCallback(async (newPreference) => {
    setGPUPreference(newPreference);
    setGpuPreferenceState(newPreference);
    
    // Rescan for GPUs with the new preference
    console.log(`🎮 GPU preference updated to: ${newPreference}`);
    const result = await checkWebGPUSupport(newPreference);
    setWebGPUStatus({ checked: true, ...result });
    
    console.log(`🎮 Now using: ${result.device} (${result.vendor})`);
    
    return result;
  }, []);

  // Check WebGPU support and installed models on mount
  useEffect(() => {
    const check = async () => {
      const result = await checkWebGPUSupport();
      setWebGPUStatus({ checked: true, ...result });
      
      // Check which models are already cached
      try {
        const { hasModelInCache } = await import('@mlc-ai/web-llm');
        const installed = new Set();
        
        // Check each model individually
        await Promise.all(
          AVAILABLE_MODELS.map(async (model) => {
            try {
              const isCached = await hasModelInCache(model.id);
              if (isCached) {
                console.log(`✅ Model ${model.id} is cached`);
                installed.add(model.id);
              } else {
                console.log(`❌ Model ${model.id} is not cached`);
              }
            } catch (err) {
              console.warn(`Could not check cache for ${model.id}:`, err);
            }
          })
        );
        
        setInstalledModels(installed);
      } catch (err) {
        console.warn('Could not check cached models:', err);
      }
    };
    check();
  }, []);

  // Reinitialize WebGPU device when experimental mode changes
  useEffect(() => {
    const reinitializeDevice = async () => {
      if (!webGPUStatus.supported) return;
      
      try {
        console.log(`🎮 Experimental mode ${experimentalMode ? 'ENABLED' : 'DISABLED'} - reinitializing WebGPU device...`);
        
        // Get current adapter and reinitialize with new options
        const selectedAdapter = gpuManager.getSelectedAdapter();
        if (selectedAdapter) {
          const adapters = gpuManager.getAdapters();
          const currentGPU = adapters.find(a => a.adapter === selectedAdapter);
          
          if (currentGPU) {
            // Force reinitialization with a fresh adapter
            await gpuManager.selectAdapter(currentGPU.id, { 
              experimental: experimentalMode, 
              forceReinit: true 
            });
            console.log(`✅ WebGPU device reinitialized with experimental=${experimentalMode}`);
          }
        }
      } catch (err) {
        console.error('Failed to reinitialize WebGPU device:', err);
      }
    };
    
    // Only reinitialize if we've already initialized once (not on mount)
    if (webGPUStatus.checked) {
      reinitializeDevice();
    }
  }, [experimentalMode, webGPUStatus.supported, webGPUStatus.checked]);

  // Initialize the LLM engine
  const initializeEngine = useCallback(async (modelId = selectedModel.id) => {
    setIsLoading(true);
    setError(null);
    
    // Check if model is cached to determine the initial message
    const { hasModelInCache } = await import('@mlc-ai/web-llm');
    const isCached = await hasModelInCache(modelId);
    const isDownloading = !isCached;
    
    setLoadProgress({ 
      progress: 0, 
      text: isDownloading ? 'Downloading model from HuggingFace...' : 'Loading model into GPU...' 
    });

    try {
      // Dynamically import WebLLM (heavy dependency)
      const { CreateMLCEngine } = await import('@mlc-ai/web-llm');
      
      // Progress callback with better messaging
      const initProgressCallback = (report) => {
        const progress = Math.round(report.progress * 100);
        let text = report.text || 'Loading...';
        
        // Enhance the progress text
        if (text.includes('Downloading')) {
          text = `📥 ${text}`;
        } else if (text.includes('Loading')) {
          text = `⚡ ${text}`;
        } else if (progress < 50 && isDownloading) {
          text = `📥 Downloading: ${progress}%`;
        } else if (progress >= 50 || !isDownloading) {
          text = `⚡ Loading into GPU: ${progress}%`;
        }
        
        setLoadProgress({
          progress,
          text,
        });
      };

      // Create the engine
      const mlcEngine = await CreateMLCEngine(modelId, {
        initProgressCallback,
        logLevel: 'SILENT',
        // Request specific WebGPU features if available
        deviceLostCallback: () => {
          console.warn('⚠️ WebGPU device lost, reinitializing...');
          setError('GPU device lost. Please reload the page.');
          setIsReady(false);
          setEngine(null);
        },
      });

      setEngine(mlcEngine);
      setLoadedModelId(modelId);
      setIsReady(true);
      setIsLoading(false);
      setLoadProgress({ progress: 100, text: '✅ Neural Engine Ready!' });
      
      // Verify and mark model as installed (double-check it's actually cached now)
      try {
        const { hasModelInCache } = await import('@mlc-ai/web-llm');
        const isNowCached = await hasModelInCache(modelId);
        if (isNowCached) {
          setInstalledModels(prev => new Set([...prev, modelId]));
          console.log(`✅ Model ${modelId} verified as cached`);
        }
      } catch (err) {
        console.warn('Could not verify model cache:', err);
        // Still mark as installed since the engine loaded successfully
        setInstalledModels(prev => new Set([...prev, modelId]));
      }
      
      // Save preference FIRST before registering
      localStorage.setItem('vet_rate_local_ai_model', modelId);
      
      // Register with unified AI service for seamless integration
      registerLocalAIEngine(mlcEngine, true);
      
      return mlcEngine;
    } catch (err) {
      console.error('Failed to initialize local AI:', err);
      
      // Provide more helpful error messages for common issues
      let errorMessage = err.message || 'Failed to initialize local AI';
      
      if (err.message?.includes('chromium_experimental_subgroup_matrix')) {
        errorMessage = `🚨 WGSL Extension Not Enabled\n\nThe 'chromium_experimental_subgroup_matrix' extension is required but not enabled.\n\n✅ FIX: Launch Chrome with:\n--enable-dawn-features=allow_unsafe_apis\n\n📚 See FAQ for detailed instructions (Windows/Mac/Linux)`;
        setError(errorMessage);
        setIsLoading(false);
        setLoadProgress({ progress: 0, text: '' });
        return;
      }
      
      if (err.message?.includes('u8') || err.message?.includes('WGSL') || err.message?.includes('shader')) {
        errorMessage = '⚠️ WebGPU Shader Compatibility Issue\n\n' +
          'Your browser does not support the shader features required by this AI model.\n\n' +
          '🔧 Solutions:\n' +
          '1. Update Chrome/Edge to the latest version (recommended)\n' +
          '2. Update your GPU drivers\n' +
          '3. Try launching Chrome with experimental flags:\n' +
          '   chrome.exe --enable-dawn-features=allow_unsafe_apis\n' +
          '4. Try a smaller AI model (360M or 1B models)\n\n' +
          'Technical: WGSL u8 type requires experimental WebGPU features.';
      } else if (err.message?.includes('GPUValidationError')) {
        errorMessage = '⚠️ WebGPU Validation Error\n\n' +
          'The AI model failed GPU validation. This may be due to:\n' +
          '• Outdated GPU drivers\n' +
          '• Browser compatibility issues\n' +
          '• Insufficient GPU memory\n\n' +
          'Please update your GPU drivers and browser.';
      }
      
      setError(errorMessage);
      setIsLoading(false);
      setIsReady(false);
      // Unregister from unified service on failure
      registerLocalAIEngine(null, false);
      return null;
    }
  }, [selectedModel]);

  // Generate completion
  const generate = useCallback(async (prompt, options = {}) => {
    if (!engine || !isReady) {
      throw new Error('Local AI not initialized');
    }

    // Import getUserTokenLimit from the token config
    const getUserTokenLimit = () => {
      try {
        const stored = localStorage.getItem('vetrate_token_limit_config');
        if (stored) {
          const config = JSON.parse(stored);
          return config.value || 2048;
        }
      } catch (e) {
        console.warn('Error loading token limit config:', e);
      }
      return 2048;
    };

    // Import the buildSystemPrompt function for comprehensive context
    const { buildSystemPrompt } = await import('../utils/aiSystemPrompts');
    
    const {
      systemPrompt = buildSystemPrompt({ 
        task: options.task || 'general',
        toolContext: options.toolContext || 'Faraday Cage Test Console',
        includeAppContext: true,
        includeRegulations: true,
        includeVeteranData: true, // Auto-load veteran's My Packet data
      }),
      maxTokens = getUserTokenLimit(), // Use user-configured limit or default
      temperature = 0.7,
      onStream,
    } = options;

    setIsGenerating(true);

    try {
      const messages = [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: prompt },
      ];

      if (onStream) {
        // Streaming response
        let fullResponse = '';
        const chunks = await engine.chat.completions.create({
          messages,
          max_tokens: maxTokens,
          temperature,
          stream: true,
        });

        for await (const chunk of chunks) {
          const delta = chunk.choices[0]?.delta?.content || '';
          fullResponse += delta;
          onStream(delta, fullResponse);
        }

        setIsGenerating(false);
        return fullResponse;
      } else {
        // Non-streaming response
        const response = await engine.chat.completions.create({
          messages,
          max_tokens: maxTokens,
          temperature,
        });

        setIsGenerating(false);
        return response.choices[0]?.message?.content || '';
      }
    } catch (err) {
      setIsGenerating(false);
      throw err;
    }
  }, [engine, isReady]);

  // Interrupt generation
  const interruptGeneration = useCallback(async () => {
    if (engine && isGenerating) {
      try {
        // Use WebLLM's interrupt method if available
        await engine.interruptGenerate?.();
      } catch (err) {
        console.warn('Error interrupting generation:', err);
      }
      setIsGenerating(false);
    }
  }, [engine, isGenerating]);

  // Switch to a different model
  const switchModel = useCallback(async (newModelId) => {
    // Unload current model
    if (engine) {
      try {
        await engine.unload?.();
      } catch (err) {
        console.warn('Error unloading model:', err);
      }
    }
    
    // Reset state
    setEngine(null);
    setLoadedModelId(null);
    setIsReady(false);
    registerLocalAIEngine(null, false);
    
    // Load new model
    await initializeEngine(newModelId);
  }, [engine, initializeEngine]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (engine) {
        engine.unload?.();
      }
    };
  }, [engine]);

  const value = {
    // Status
    webGPUStatus,
    isLoading,
    loadProgress,
    isReady,
    error,
    isGenerating,
    
    // Model
    selectedModel,
    setSelectedModel,
    availableModels: AVAILABLE_MODELS,
    installedModels,
    loadedModelId,
    
    // GPU Preference
    gpuPreference,
    updateGPUPreference,
    
    // Experimental Features
    experimentalMode,
    setExperimentalMode,
    showExperimentalWarning,
    setShowExperimentalWarning,
    
    // Actions
    initializeEngine,
    generate,
    interruptGeneration,
    switchModel,
  };

  return (
    <LocalAIContext.Provider value={value}>
      {children}
    </LocalAIContext.Provider>
  );
};

/**
 * LocalAIPanel Component
 * UI for managing and using local AI
 */
const LocalAIPanel = ({ onClose, onReportBug }) => {
  const {
    webGPUStatus,
    isLoading,
    loadProgress,
    isReady,
    error,
    isGenerating,
    selectedModel,
    setSelectedModel,
    availableModels,
    installedModels,
    loadedModelId,
    gpuPreference,
    updateGPUPreference,
    experimentalMode,
    setExperimentalMode,
    showExperimentalWarning,
    setShowExperimentalWarning,
    initializeEngine,
    generate,
    interruptGeneration,
    switchModel,
  } = useLocalAI();

  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [streamedResponse, setStreamedResponse] = useState('');
  const [isChangingGPU, setIsChangingGPU] = useState(false);

  // Clear test prompt and responses when model changes
  useEffect(() => {
    setTestPrompt('');
    setTestResponse('');
    setStreamedResponse('');
  }, [loadedModelId]);

  // Handle GPU preference change
  const handleGPUChange = async (newPreference) => {
    setIsChangingGPU(true);
    try {
      await updateGPUPreference(newPreference);
      
      // If an AI model is loaded, warn user they may need to reload
      if (isReady) {
        // The user will need to reload the model to use the new GPU
        console.log('⚠️ GPU changed - model may need to be reloaded to use new GPU');
      }
    } finally {
      setIsChangingGPU(false);
    }
  };

  // Handle GPU selection from GPUSelector component
  const handleGPUSelected = async (adapterId) => {
    // Get currently selected adapter to check if it's the same
    const currentAdapter = gpuManager.getSelectedAdapter();
    const targetAdapter = gpuManager.getAdapters().find(a => a.id === adapterId);
    
    if (!targetAdapter) {
      console.error('❌ Selected GPU not found');
      return;
    }
    
    // If same adapter, just log and return (no error, no UI change needed)
    if (currentAdapter === targetAdapter.adapter) {
      console.log('✅ GPU already selected:', targetAdapter.info.displayName);
      return;
    }
    
    setIsChangingGPU(true);
    try {
      // Select the new GPU
      await gpuManager.selectAdapter(adapterId);
      
      // Re-check WebGPU status to update UI
      const result = await checkWebGPUSupport();
      setWebGPUStatus({ checked: true, ...result });
      
      // If a model is loaded, prompt to reload
      if (isReady && loadedModelId) {
        const shouldReload = window.confirm(
          `GPU changed to ${result.device}.\n\nReload the current model (${selectedModel.name}) to use the new GPU?`
        );
        
        if (shouldReload) {
          // Unload current model first
          await handleUnload();
          // Small delay to ensure cleanup
          await new Promise(resolve => setTimeout(resolve, 500));
          // Load model with new GPU
          await handleLoadModel(selectedModel.id);
        }
      }
      
      console.log('✅ GPU selection updated:', result.device);
    } catch (err) {
      console.error('❌ Failed to change GPU:', err);
      if (err && err.message) {
        alert(`Failed to change GPU: ${err.message}`);
      }
    } finally {
      setIsChangingGPU(false);
    }
  };

  // Handle test generation
  const handleTestGenerate = async () => {
    if (!testPrompt.trim()) return;
    
    setStreamedResponse('');
    setTestResponse('');
    
    try {
      const fullResponse = await generate(testPrompt, {
        onStream: (delta, full) => {
          setStreamedResponse(full);
        },
      });
      // Once complete, clear streaming and set final response
      setStreamedResponse('');
      setTestResponse(fullResponse);
    } catch (err) {
      setStreamedResponse('');
      setTestResponse(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl shadow-2xl max-w-3xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 text-white px-6 py-6 rounded-t-2xl relative overflow-hidden flex-shrink-0">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
            <div className="absolute -bottom-8 -left-8 w-24 h-24 bg-white/5 rounded-full" />
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-4xl">🛡️</span>
                </div>
                <div>
                  <h2 className="text-2xl sm:text-3xl font-bold">
                    Faraday Cage Protocol
                  </h2>
                  <p className="text-cyan-200 mt-1">
                    100% Local AI • Zero Data Leaves Your Device
                  </p>
                  <div className="mt-2">
                    <span className="px-2 py-0.5 bg-blue-500/90 text-white text-xs font-semibold rounded-full" title="VA employees use VA GPT, a secure AI tool">
                      ℹ️ VA Staff Use VA GPT (100K+ Users)
                    </span>
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="VA AI Transparency Hub" />}
                <button
                  onClick={onClose}
                  className="p-2 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          {/* WebGPU Status */}
            <div className={`p-4 rounded-xl border-2 ${
              webGPUStatus.supported 
                ? 'bg-green-900/30 border-green-500/50'
                : 'bg-red-900/30 border-red-500/50'
            }`}>
              <div className="flex items-center gap-3">
                <span className="text-2xl">
                  {webGPUStatus.supported ? '✅' : '❌'}
                </span>
                <div className="flex-1">
                  <h3 className={`font-bold ${
                    webGPUStatus.supported ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {webGPUStatus.supported ? 'WebGPU Available' : 'WebGPU Not Available'}
                  </h3>
                  {webGPUStatus.supported ? (
                    <p className="text-gray-400 text-sm">
                      🎮 Using: {webGPUStatus.device} ({webGPUStatus.vendor})
                    </p>
                  ) : (
                    <p className="text-red-400/80 text-sm">
                      {webGPUStatus.reason || 'Your browser or device does not support WebGPU'}
                    </p>
                  )}
                </div>
              </div>
            </div>

            {/* GPU Selector Component - Show when WebGPU is supported */}
            {webGPUStatus.supported && (
              <div className="space-y-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">🎮</span>
                  <h3 className="font-bold text-cyan-300">GPU Selection</h3>
                  <span className="text-xs px-2 py-0.5 bg-cyan-500/30 text-cyan-200 rounded-full">
                    {webGPUStatus.availableGPUs?.length || 1} GPU{(webGPUStatus.availableGPUs?.length || 1) > 1 ? 's' : ''} Available
                  </span>
                </div>
                <GPUSelector 
                  onGPUSelected={handleGPUSelected}
                  autoSelect={false}
                />
              </div>
            )
            }

            {/* Experimental WebGPU Features Toggle */}
            {webGPUStatus.supported && (
              <div className="p-4 rounded-xl border-2 bg-amber-900/20 border-amber-500/50">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">⚠️</span>
                  <div className="flex-1 space-y-3">
                    <div>
                      <h3 className="font-bold text-amber-400 flex items-center gap-2">
                        Experimental WebGPU Mode
                        <span className="text-xs px-2 py-0.5 bg-amber-500/30 text-amber-200 rounded-full">
                          Advanced
                        </span>
                      </h3>
                      <p className="text-gray-400 text-sm mt-1">
                        Enable experimental shader features for newer AI models (may be unstable)
                      </p>
                    </div>

                    {/* Checkbox */}
                    <label className="flex items-start gap-3 cursor-pointer group">
                      <input
                        type="checkbox"
                        checked={experimentalMode}
                        onChange={(e) => {
                          if (e.target.checked && !showExperimentalWarning) {
                            setShowExperimentalWarning(true);
                          } else if (!e.target.checked) {
                            setExperimentalMode(false);
                            localStorage.setItem('vet_rate_experimental_webgpu', 'false');
                          }
                        }}
                        className="mt-1 w-5 h-5 rounded border-2 border-amber-500 bg-gray-800 text-amber-500 focus:ring-2 focus:ring-amber-500 focus:ring-offset-2 focus:ring-offset-gray-900"
                      />
                      <div className="flex-1">
                        <span className="text-white font-medium group-hover:text-amber-400 transition-colors">
                          I understand the risks and want to enable experimental features
                        </span>
                        <p className="text-xs text-gray-500 mt-1">
                          This attempts to use experimental WebGPU APIs that may not be available in your browser
                        </p>
                      </div>
                    </label>

                    {/* Warning Panel - Shows when trying to enable */}
                    {showExperimentalWarning && (
                      <div className="bg-red-900/30 border-2 border-red-500/50 rounded-lg p-4 space-y-3">
                        <div className="flex items-start gap-2">
                          <span className="text-xl">🚨</span>
                          <div className="flex-1">
                            <h4 className="font-bold text-red-400 text-sm">IMPORTANT WARNINGS</h4>
                            <ul className="text-xs text-gray-300 mt-2 space-y-1 list-disc list-inside">
                              <li>This enables <strong>experimental browser features</strong> not yet standardized</li>
                              <li>May cause <strong>browser crashes, GPU errors, or system instability</strong></li>
                              <li>Requires launching Chrome with special flags (see instructions below)</li>
                              <li><strong>Not recommended for production use</strong> - for testing only</li>
                              <li>Your browser may not support these features even with flags enabled</li>
                            </ul>
                          </div>
                        </div>

                        {/* Instructions */}
                        <div className="bg-gray-900/50 rounded p-3 space-y-2">
                          <p className="text-xs font-bold text-amber-400">📋 How to Enable (Windows):</p>
                          <div className="bg-gray-950 rounded p-2">
                            <code className="text-xs text-green-400 break-all">
                              chrome.exe --enable-dawn-features=allow_unsafe_apis
                            </code>
                          </div>
                          <p className="text-xs text-gray-400 mt-2">
                            1. Close ALL Chrome windows<br/>
                            2. Open Command Prompt or PowerShell<br/>
                            3. Run the command above (adjust path to Chrome if needed)<br/>
                            4. Check if experimental features are detected below
                          </p>
                        </div>

                        {/* Feature Detection Status */}
                        <div className="bg-gray-900/50 rounded p-3">
                          <p className="text-xs font-bold text-cyan-400 mb-2">🔍 Detected Features:</p>
                          <div className="space-y-1 text-xs">
                            {webGPUStatus.availableFeatures?.length > 0 ? (
                              <>
                                {webGPUStatus.availableFeatures.map(feature => (
                                  <div key={feature} className="flex items-center gap-2">
                                    <span className="text-green-400">✓</span>
                                    <code className="text-gray-300">{feature}</code>
                                  </div>
                                ))}
                              </>
                            ) : (
                              <p className="text-gray-500">No experimental features detected</p>
                            )}
                            {webGPUStatus.missingFeatures?.length > 0 && (
                              <>
                                <p className="text-xs text-red-400 mt-2 font-semibold">Missing Features:</p>
                                {webGPUStatus.missingFeatures.map(feature => (
                                  <div key={feature} className="flex items-center gap-2">
                                    <span className="text-red-400">✗</span>
                                    <code className="text-gray-400">{feature}</code>
                                  </div>
                                ))}
                              </>
                            )}
                          </div>
                        </div>

                        {/* Action Buttons */}
                        <div className="flex gap-2">
                          <button
                            onClick={() => {
                              setExperimentalMode(true);
                              localStorage.setItem('vet_rate_experimental_webgpu', 'true');
                              setShowExperimentalWarning(false);
                            }}
                            className="flex-1 px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg font-medium text-sm transition-colors"
                          >
                            I Accept the Risks - Enable Now
                          </button>
                          <button
                            onClick={() => {
                              setShowExperimentalWarning(false);
                            }}
                            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-lg font-medium text-sm transition-colors"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {/* Status when enabled */}
                    {experimentalMode && !showExperimentalWarning && (
                      <div className="bg-amber-900/30 rounded-lg p-3">
                        <div className="flex items-center gap-2">
                          <span className="text-lg">⚡</span>
                          <div className="flex-1">
                            <p className="text-xs font-bold text-amber-400">Experimental Mode Active</p>
                            <p className="text-xs text-gray-400 mt-0.5">
                              The AI will attempt to use experimental WebGPU features if available.
                              If you encounter errors, disable this option.
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* GPU Selection - Only show if dual GPU detected */}
            {webGPUStatus.supported && webGPUStatus.hasDualGPU && (
              <div className="p-4 rounded-xl border-2 bg-purple-900/20 border-purple-500/50">
                <div className="flex items-center gap-2 mb-3">
                  <span className="text-xl">🎮</span>
                  <h3 className="font-bold text-purple-300">Advanced GPU Selection</h3>
                  <span className="text-xs px-2 py-0.5 bg-purple-500/30 text-purple-200 rounded-full">
                    {webGPUStatus.availableGPUs?.length || 2} GPUs Detected
                  </span>
                  <span className="text-xs px-2 py-0.5 bg-cyan-500/30 text-cyan-200 rounded-full">
                    🤓 Nerd Mode
                  </span>
                </div>
                <p className="text-gray-400 text-sm mb-3">
                  Multiple GPUs detected on your system. Select which GPU to use for AI processing:
                </p>
                <div className="grid gap-3">
                  {/* Auto Option */}
                  <button
                    onClick={() => handleGPUChange(GPU_PREFERENCES.AUTO)}
                    disabled={isChangingGPU || isLoading}
                    className={`p-4 rounded-lg border-2 text-left transition-all ${
                      gpuPreference === GPU_PREFERENCES.AUTO
                        ? 'bg-purple-900/40 border-purple-500 shadow-lg shadow-purple-500/20'
                        : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                    } ${(isChangingGPU || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-2xl">🤖</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <p className="font-bold text-white">Auto (Recommended)</p>
                          {gpuPreference === GPU_PREFERENCES.AUTO && (
                            <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">ACTIVE</span>
                          )}
                        </div>
                        <p className="text-xs text-gray-400 mt-1">Let the browser choose based on power state and workload</p>
                      </div>
                    </div>
                  </button>
                  
                  {/* Available GPUs with Detailed Specs */}
                  {webGPUStatus.availableGPUs?.map((gpu, idx) => (
                    <button
                      key={gpu.type}
                      onClick={() => handleGPUChange(gpu.type)}
                      disabled={isChangingGPU || isLoading}
                      className={`p-4 rounded-lg border-2 text-left transition-all ${
                        gpuPreference === gpu.type
                          ? 'bg-purple-900/40 border-purple-500 shadow-lg shadow-purple-500/20'
                          : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                      } ${(isChangingGPU || isLoading) ? 'opacity-50 cursor-not-allowed' : ''}`}
                    >
                      <div className="space-y-2">
                        {/* GPU Header */}
                        <div className="flex items-start gap-3">
                          <span className="text-2xl">{gpu.type === 'high-performance' ? '🚀' : '🔋'}</span>
                          <div className="flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-bold text-white">{gpu.label}</p>
                              {gpuPreference === gpu.type && (
                                <span className="px-2 py-0.5 bg-purple-500 text-white text-xs font-bold rounded-full">ACTIVE</span>
                              )}
                              {gpu.type === 'high-performance' && (
                                <span className="px-2 py-0.5 bg-cyan-500/30 text-cyan-200 text-xs font-semibold rounded-full">Recommended for AI</span>
                              )}
                            </div>
                            <p className="text-sm text-cyan-300 font-mono mt-1">{gpu.device}</p>
                            <p className="text-xs text-gray-400 mt-0.5">{gpu.description}</p>
                          </div>
                        </div>
                        
                        {/* GPU Specs */}
                        <div className="grid grid-cols-2 gap-2 pl-11">
                          <div className="bg-gray-900/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Vendor</p>
                            <p className="text-sm text-white font-semibold">{gpu.vendor}</p>
                          </div>
                          <div className="bg-gray-900/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Est. VRAM</p>
                            <p className="text-sm text-white font-semibold">{gpu.vram || 'Unknown'}</p>
                          </div>
                          <div className="bg-gray-900/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Architecture</p>
                            <p className="text-sm text-white font-semibold">{gpu.architecture || 'Unknown'}</p>
                          </div>
                          <div className="bg-gray-900/50 p-2 rounded">
                            <p className="text-xs text-gray-500">Max Texture</p>
                            <p className="text-sm text-white font-semibold">{gpu.limits?.maxTextureSize || 'N/A'}</p>
                          </div>
                        </div>
                        
                        {/* WebGPU Features Count */}
                        {gpu.features && gpu.features.length > 0 && (
                          <div className="pl-11">
                            <p className="text-xs text-gray-500">
                              WebGPU Features: <span className="text-purple-400 font-semibold">{gpu.features.length} supported</span>
                            </p>
                          </div>
                        )}
                      </div>
                    </button>
                  ))}
                </div>
                
                {/* Detailed Info for Nerds */}
                {webGPUStatus.availableGPUs && webGPUStatus.availableGPUs.length > 0 && (
                  <details className="mt-3">
                    <summary className="cursor-pointer text-xs text-gray-500 hover:text-gray-400 select-none">
                      🤓 Show Technical Details
                    </summary>
                    <div className="mt-2 space-y-2 text-xs font-mono">
                      {webGPUStatus.availableGPUs.map((gpu, idx) => (
                        <div key={idx} className="bg-gray-900/50 p-2 rounded border border-gray-800">
                          <p className="text-purple-400 font-bold mb-1">{gpu.device}</p>
                          <p className="text-gray-400">Max Buffer: {gpu.limits?.maxBufferSize}</p>
                          <p className="text-gray-400">Max Workgroup Size: {gpu.limits?.maxComputeWorkgroupSizeX}</p>
                          <p className="text-gray-400">Max Workgroups: {gpu.limits?.maxComputeWorkgroupsPerDimension}</p>
                          {gpu.features && gpu.features.length > 0 && (
                            <details className="mt-1">
                              <summary className="cursor-pointer text-gray-500 hover:text-gray-400">Features ({gpu.features.length})</summary>
                              <div className="mt-1 pl-2 text-gray-500">
                                {gpu.features.slice(0, 10).map((feat, i) => (
                                  <div key={i}>• {feat}</div>
                                ))}
                                {gpu.features.length > 10 && <div>• ... and {gpu.features.length - 10} more</div>}
                              </div>
                            </details>
                          )}
                        </div>
                      ))}
                    </div>
                  </details>
                )}
                
                {isChangingGPU && (
                  <div className="mt-3 flex items-center gap-2 text-purple-300 text-sm">
                    <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    Switching GPU...
                  </div>
                )}
                
                {isReady && gpuPreference !== webGPUStatus.currentPreference && (
                  <div className="mt-3 p-2 bg-yellow-900/30 border border-yellow-500/50 rounded-lg">
                    <p className="text-yellow-300 text-xs">
                      ⚠️ GPU preference changed. Unload and reload the AI model to use the new GPU.
                    </p>
                  </div>
                )}
              </div>
            )}

            {webGPUStatus.supported && (
              <>
                {/* Helpful Info Box */}
                <div className="bg-blue-900/20 border border-blue-500/30 rounded-xl p-4">
                  <div className="flex items-start gap-3">
                    <span className="text-2xl">💡</span>
                    <div className="flex-1">
                      <h4 className="font-bold text-blue-300 mb-2">Choosing Your AI Model</h4>
                      <div className="text-gray-300 text-sm space-y-2">
                        <p>
                          <strong>For most veterans:</strong> The recommended model works great for typical tasks.
                        </p>
                        <p>
                          <strong>Large medical records:</strong> Don't worry! All models can handle large Blue Button files. 
                          The system automatically breaks them into smaller sections if needed.
                        </p>
                        <p>
                          <strong>Need faster results?</strong> Try a smaller model. <strong>Need better quality?</strong> Try a larger one.
                        </p>
                      </div>
                    </div>
                  </div>
                </div>
                {/* Model Selection */}
                <div className="space-y-3">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🧠</span> Select Neural Engine
                  </h3>
                  <div className="grid gap-3">
                    {availableModels.map(model => {
                      const isInstalled = installedModels.has(model.id);
                      const isCurrentlyLoaded = loadedModelId === model.id;
                      
                      return (
                        <button
                          key={model.id}
                          onClick={() => setSelectedModel(model)}
                          disabled={isLoading}
                          className={`p-4 rounded-xl border-2 text-left transition-all ${
                            selectedModel.id === model.id
                              ? 'bg-cyan-900/30 border-cyan-500'
                              : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                          } ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-white">{model.name}</span>
                                {model.bestFor && (
                                  <span className="text-xs px-2 py-0.5 bg-violet-500/30 text-violet-300 rounded-full">
                                    {model.bestFor}
                                  </span>
                                )}
                                {model.recommended && (
                                  <span className="text-xs px-2 py-0.5 bg-cyan-500/30 text-cyan-300 rounded-full">
                                    RECOMMENDED
                                  </span>
                                )}
                                {isInstalled && (
                                  <span className="text-xs px-2 py-0.5 bg-green-500/30 text-green-300 rounded-full flex items-center gap-1">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                    </svg>
                                    INSTALLED
                                  </span>
                                )}
                                {isCurrentlyLoaded && (
                                  <span className="text-xs px-2 py-0.5 bg-blue-500/30 text-blue-300 rounded-full flex items-center gap-1">
                                    <span className="w-2 h-2 bg-blue-400 rounded-full animate-pulse"></span>
                                    ACTIVE
                                  </span>
                                )}
                              </div>
                              <p className="text-gray-400 text-sm mt-1">{model.description}</p>
                              {model.contextInfo && (
                                <p className="text-cyan-400/80 text-xs mt-1 italic">
                                  💡 {model.contextInfo}
                                </p>
                              )}
                              <p className="text-gray-500 text-xs mt-1">
                                Size: {model.size} • VRAM: {model.vramRequired}
                              </p>
                            </div>
                            <div className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 ml-3 ${
                              selectedModel.id === model.id
                                ? 'border-cyan-500 bg-cyan-500'
                                : 'border-gray-600'
                            }`}>
                              {selectedModel.id === model.id && (
                                <svg className="w-4 h-4 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                </svg>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Initialize/Switch Button */}
                {!isReady ? (
                  <ToolCardButton className="w-full" type="button" onClick={() => initializeEngine()} disabled={isLoading}>
                    {isLoading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span> {loadProgress.text}
                      </>
                    ) : installedModels.has(selectedModel.id) ? (
                      <>⚡ Load {selectedModel.name}</>
                    ) : (
                      <>📥 Download & Load {selectedModel.name}</>
                    )}
                  </ToolCardButton>
                ) : loadedModelId !== selectedModel.id ? (
                  <ToolCardButton 
                    className="w-full" 
                    type="button" 
                    onClick={() => switchModel(selectedModel.id)} 
                    disabled={isLoading}
                  >
                    {isLoading ? (
                      <>
                        <span className="animate-spin mr-2">⏳</span> {loadProgress.text}
                      </>
                    ) : installedModels.has(selectedModel.id) ? (
                      <>🔄 Switch to {selectedModel.name}</>
                    ) : (
                      <>📥 Download & Switch to {selectedModel.name}</>
                    )}
                  </ToolCardButton>
                ) : null}

                {/* Loading Progress */}
                {isLoading && (
                  <div className="space-y-2">
                    <div className="h-4 bg-gray-800 rounded-full overflow-hidden">
                      <div 
                        className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                        style={{ width: `${loadProgress.progress}%` }}
                      />
                    </div>
                    <p className="text-gray-400 text-sm text-center">
                      {loadProgress.text} ({loadProgress.progress}%)
                    </p>
                  </div>
                )}

                {/* Ready State */}
                {isReady && (
                  <div className="bg-green-900/30 border-2 border-green-500 rounded-xl p-6">
                    <div className="flex items-center gap-3 mb-4">
                      <span className="text-3xl animate-pulse">🟢</span>
                      <div>
                        <h3 className="text-xl font-bold text-green-400">Neural Engine Active</h3>
                        <p className="text-green-300/80 text-sm">
                          All AI processing happens locally. You can disconnect from the internet now.
                        </p>
                      </div>
                    </div>

                    {/* AI Knowledge Test */}
                    <div className="mb-4 p-4 bg-cyan-900/20 border border-cyan-700/50 rounded-lg">
                      <div className="flex items-start gap-3 mb-3">
                        <span className="text-2xl">🧪</span>
                        <div>
                          <h4 className="font-bold text-cyan-300 text-sm">AI Knowledge Test</h4>
                          <p className="text-cyan-400/80 text-xs mt-1">
                            Test if the AI knows about Vet-Rate.org's tools and 38 CFR regulations
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => setTestPrompt('What do you know about eCFR and Vet-Rate.org functions? Please list the tools available and explain key VA disability regulations.')}
                        className="w-full py-2 px-4 bg-cyan-600/30 hover:bg-cyan-600/50 border border-cyan-500/50 text-cyan-300 text-sm font-medium rounded-lg transition-colors"
                      >
                        Run Knowledge Test ⚡
                      </button>
                    </div>

                    {/* Test Input */}
                    <div className="space-y-3">
                      <textarea
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter' && !e.shiftKey) {
                            e.preventDefault();
                            if (testPrompt.trim() && !isGenerating) {
                              handleTestGenerate();
                            }
                          }
                        }}
                        placeholder="Test the local AI... e.g., 'What evidence do I need for a PTSD claim?' (Press Enter to generate, Shift+Enter for new line)"
                        className="w-full px-4 py-3 bg-gray-800 border-2 border-gray-700 rounded-lg text-white placeholder:text-gray-500 resize-none focus:border-green-500 focus:ring-2 focus:ring-green-500/20"
                        rows={3}
                      />
                      <div className="flex gap-2">
                        {!isGenerating ? (
                          <button
                            onClick={handleTestGenerate}
                            disabled={!testPrompt.trim()}
                            className="flex-1 py-3 bg-green-600 hover:bg-green-700 text-white font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center justify-center gap-2"
                          >
                            <span>⚡</span>
                            Generate (100% Local)
                          </button>
                        ) : (
                          <button
                            onClick={interruptGeneration}
                            className="flex-1 py-3 bg-red-600 hover:bg-red-700 text-white font-semibold rounded-lg transition-colors flex items-center justify-center gap-2"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <rect x="6" y="6" width="12" height="12" strokeWidth="2" />
                            </svg>
                            Stop Generating
                          </button>
                        )}
                      </div>
                      {isGenerating && (
                        <div className="flex items-center justify-center gap-2 text-sm text-cyan-400">
                          <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                          </svg>
                          <span>Generating response...</span>
                        </div>
                      )}
                    </div>

                    {/* Response */}
                    {(streamedResponse || testResponse) && (
                      <div className="mt-4 p-4 bg-gray-800/50 rounded-lg">
                        <p className="text-sm text-gray-400 mb-2">Response:</p>
                        <p className="text-white whitespace-pre-wrap">
                          {streamedResponse || testResponse}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Error State */}
                {error && (
                  <div className="bg-red-900/30 border-2 border-red-500 rounded-xl p-4">
                    <p className="text-red-400">
                      <strong>Error:</strong> {error}
                    </p>
                  </div>
                )}
              </>
            )}

            {/* Fallback for no WebGPU */}
            {!webGPUStatus.supported && webGPUStatus.checked && (
              <div className="bg-yellow-900/30 border-2 border-yellow-500/50 rounded-xl p-6">
                <h3 className="font-bold text-yellow-400 mb-2">Use Cloud AI Instead</h3>
                <p className="text-gray-300 text-sm mb-4">
                  Your device doesn't support local AI, but you can still use the cloud-based 
                  AI features by adding your own Gemini API key in Settings.
                </p>
                <p className="text-gray-500 text-xs">
                  💡 Tip: Try using Chrome/Edge on a device with a dedicated GPU for local AI support.
                </p>
              </div>
            )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800/50 rounded-b-2xl border-t border-gray-700 flex-shrink-0">
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
            <span>🔒</span>
            <span>Military-grade privacy: Your data never leaves your device</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalAIPanel;
