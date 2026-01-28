/**
 * Vet-Rate.org - Unified AI Service
 * 💎 "The Diamond Standard" - 3-Model Swarm Architecture
 * 
 * This service provides a unified interface for AI operations using the
 * Warrant Council - 3 specialized fine-tuned models:
 * - AUDITOR: Reviews claims for accuracy, compliance, and completeness
 * - WRITER: Generates compelling personal statements and nexus letters  
 * - RATER: Calculates VA disability ratings using bilateral factor formula
 * 
 * Supports fallback to cloud AI (Gemini) when local models unavailable.
 * 100% private local inference - no data leaves the device.
 */

import { interceptBeforeAICall } from './crisisInterceptor';
import { scrubPII, analyzePII } from './piiScrubber';
import { validateAIResponse as validateHallucinations } from './hallucinationTrap';
import { isFeatureEnabled } from './featureFlags';
import {
  SWARM_AGENTS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getSwarmStatus,
  generateWithSwarm,
  initializeSwarm,
  switchAgent,
  unloadSwarm
} from './diamondSwarm';

// 💎 New backends: Wllama (browser WASM) and Local Server (llama.cpp)
import * as wllamaService from './wllamaService';
import * as localServerClient from './localServerClient';

// Dynamic imports for code splitting
let aiSystemPromptsModule = null;
const getAISystemPrompts = async () => {
  if (!aiSystemPromptsModule) {
    aiSystemPromptsModule = await import('./aiSystemPrompts');
  }
  return aiSystemPromptsModule;
};

// Storage keys
const AI_MODE_KEY = 'vet_rate_ai_mode'; // 'cloud' | 'local' | 'swarm'
const GEMINI_KEY = 'vetrate_gemini_key';
const LOCAL_MODEL_KEY = 'vet_rate_local_ai_model';
const TOKEN_LIMIT_KEY = 'vetrate_token_limit_config';

// Cloud AI endpoint (fallback only)
// NOTE: gemini-1.5-flash was deprecated and shut down in late 2025
// Updated to gemini-2.5-flash which has same 1M token context window
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

// Warrant Council state (primary AI engine)
let swarmEngine = null;
let swarmReady = false;
let swarmGenerating = false;
let swarmInitializingState = false;
let swarmCurrentAgent = null;

// 🌐 Wllama state (browser WASM inference)
let wllamaReady = false;
let wllamaInitializing = false;
let wllamaCurrentModel = null;

// 🖥️ Local Server state (llama.cpp server)
let localServerAvailable = false;
let localServerChecked = false;

// Legacy WebLLM state (deprecated - kept for backward compatibility)
let localAIEngine = null;
let localAIReady = false;
let localAIGenerating = false;
let localAIInitializing = false;
let localAIModelId = null;
let localAIIsVisionModel = false;
let webGPUSupported = null;
let webGPUCheckPromise = null;

// Promise-based mutex to prevent concurrent generation requests
let generationLock = null;

/**
 * Acquire generation lock - ensures only one generation at a time
 */
const acquireGenerationLock = async () => {
  // Wait for any existing lock to release
  while (generationLock) {
    console.log('⏳ Waiting for previous generation to complete...');
    await generationLock;
  }
  
  // Create new lock
  let releaseLock;
  generationLock = new Promise(resolve => {
    releaseLock = resolve;
  });
  
  return () => {
    generationLock = null;
    releaseLock();
  };
};

/**
 * Get user-configured token limit (or default to 2048)
 */
const getUserTokenLimit = () => {
  try {
    const stored = localStorage.getItem(TOKEN_LIMIT_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      return config.value || 2048;
    }
  } catch (e) {
    console.warn('Error loading token limit config:', e);
  }
  return 2048; // Default balanced setting
};

/**
 * AI Configuration Presets for different use cases
 * Based on "Platinum Standard" recommendations
 */
export const AI_PRESETS = {
  // For legal/regulatory analysis - Maximum accuracy, zero creativity
  LEGAL: {
    label: 'Legal/Regulatory (Jag Advocate)',
    description: '100% adherence to regulations. Zero creativity.',
    temperature: 0.1,
    topK: 1,
    topP: 0.1,
    frequencyPenalty: 0.0, // Allow repetition of legal terms
    useCase: ['C-File Analyzer', 'Decision Decoder', 'PACT Act Navigator', 'TDIU Builder']
  },
  
  // For creative writing - Natural, persuasive, human-sounding
  CREATIVE: {
    label: 'Creative/Writing (Empathetic Nexus)',
    description: 'Natural, persuasive, human-sounding narrative.',
    temperature: 0.7,
    topK: 40,
    topP: 0.9,
    presencePenalty: 0.3, // Discourage repetitive sentence structures
    useCase: ['Nexus Builder', 'Witness Bench', 'Personal Statement Helper']
  },
  
  // For adversarial analysis - Critical, skeptical, probing
  ADVERSARIAL: {
    label: 'Adversarial (Red Team)',
    description: 'Critical, skeptical evaluation.',
    temperature: 0.4,
    topK: 20,
    topP: 0.8,
    presencePenalty: 0.2,
    useCase: ['The War Game', 'Red Team Simulator']
  },
  
  // Balanced default
  BALANCED: {
    label: 'Balanced (Standard)',
    description: 'Good for most tasks.',
    temperature: 0.7,
    topK: 40,
    topP: 0.95,
    useCase: ['General purpose']
  }
};

/**
 * Get AI preset by name
 * @param {string} presetName - Name of preset (LEGAL, CREATIVE, ADVERSARIAL, BALANCED)
 * @returns {Object} Preset configuration
 */
export const getAIPreset = (presetName = 'BALANCED') => {
  return AI_PRESETS[presetName] || AI_PRESETS.BALANCED;
};

/**
 * Check if WebGPU is supported on this device
 * Cached result for performance
 * @returns {Promise<{supported: boolean, reason?: string, device?: string}>}
 */
export const checkWebGPUSupport = async () => {
  // Return cached result if available
  if (webGPUSupported !== null) {
    return webGPUSupported;
  }
  
  // Prevent duplicate concurrent checks
  if (webGPUCheckPromise) {
    return webGPUCheckPromise;
  }
  
  webGPUCheckPromise = (async () => {
    // Check for navigator.gpu availability
    if (typeof navigator === 'undefined' || !navigator.gpu) {
      webGPUSupported = { 
        supported: false, 
        reason: 'WebGPU not available. Local AI requires Chrome 113+, Edge 113+, or a compatible browser.' 
      };
      return webGPUSupported;
    }
    
    try {
      const adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        webGPUSupported = { 
          supported: false, 
          reason: 'No compatible GPU found. Your device may not support Local AI.' 
        };
        return webGPUSupported;
      }
      
      // Verify we can actually get a device
      await adapter.requestDevice();
      
      webGPUSupported = { 
        supported: true, 
        device: 'GPU detected' 
      };
      return webGPUSupported;
    } catch (err) {
      webGPUSupported = { 
        supported: false, 
        reason: `WebGPU initialization failed: ${err.message}. Try using Chrome or Edge.` 
      };
      return webGPUSupported;
    }
  })();
  
  return webGPUCheckPromise;
};

/**
 * AI Mode Types
 */
export const AI_MODES = {
  CLOUD: 'cloud',
  LOCAL: 'local',
  SWARM: 'swarm',           // 🎖️ Warrant Council - 3 specialized agents (WebGPU/MLC)
  WLLAMA: 'wllama',         // 🌐 Wllama - Browser WASM inference (works everywhere)
  LOCAL_SERVER: 'local_server', // 🖥️ llama.cpp server - Desktop inference via API
  AUTO: 'auto',             // Prefer swarm → wllama → local_server → cloud
};

/**
 * Get the current AI mode preference
 */
export const getAIMode = () => {
  const stored = localStorage.getItem(AI_MODE_KEY);
  // Migrate old 'local' preference to 'swarm'
  if (stored === 'local') {
    localStorage.setItem(AI_MODE_KEY, AI_MODES.SWARM);
    return AI_MODES.SWARM;
  }
  return stored || AI_MODES.SWARM; // Default to Warrant Council
};

/**
 * Set the AI mode preference
 */
export const setAIMode = (mode) => {
  if (Object.values(AI_MODES).includes(mode)) {
    localStorage.setItem(AI_MODE_KEY, mode);
    return true;
  }
  return false;
};

/**
 * Register the Warrant Council engine (primary AI)
 * @param {object} engine - The swarm engine instance
 * @param {boolean} ready - Whether the swarm is fully ready
 * @param {boolean} initializing - Whether the swarm is currently loading
 * @param {string} agentId - The ID of the current agent
 */
export const registerSwarmEngine = (engine, ready, initializing = false, agentId = null) => {
  swarmEngine = engine;
  swarmReady = ready;
  swarmInitializingState = initializing;
  swarmCurrentAgent = agentId;
  console.log(`🎖️ Warrant Council registered: agent=${agentId}, ready=${ready}`);
};

/**
 * Register the local AI engine (legacy - for backward compatibility)
 * @param {object} engine - The MLCEngine instance
 * @param {boolean} ready - Whether the engine is fully ready for inference
 * @param {boolean} initializing - Whether the engine is currently loading/warming up
 * @param {string} modelId - The ID of the loaded model
 * @param {boolean} isVisionModel - Whether the model supports vision/image input
 */
export const registerLocalAIEngine = (engine, ready, initializing = false, modelId = null, isVisionModel = false) => {
  localAIEngine = engine;
  localAIReady = ready;
  localAIInitializing = initializing;
  localAIModelId = modelId;
  localAIIsVisionModel = isVisionModel;
  console.log(`📝 Legacy Local AI registered: modelId=${modelId}, ready=${ready}, isVision=${isVisionModel}`);
  
  // Dispatch event for DKB status update when Local AI is ready
  if (ready && modelId) {
    window.dispatchEvent(new CustomEvent('local-ai-status-change', {
      detail: { 
        ready: true, 
        modelId,
        fullDKBAvailable: true // Local AI has access to full 130K+ DKB
      }
    }));
    
    // Map legacy model to closest Diamond Swarm agent
    const agentId = modelId.toLowerCase().includes('writer') ? 'writer' 
      : modelId.toLowerCase().includes('rater') ? 'rater' 
      : 'auditor';
    registerSwarmEngine(engine, ready, initializing, agentId);
  } else if (!ready && !initializing) {
    // AI unloaded or failed - dispatch status change
    window.dispatchEvent(new CustomEvent('local-ai-status-change', {
      detail: { ready: false, fullDKBAvailable: false }
    }));
  }
};

/**
 * Unload/terminate the local AI engine to free up resources
 * @returns {Promise<boolean>} true if successfully unloaded
 */
export const unloadLocalAI = async () => {
  if (!localAIEngine) {
    console.log('No local AI engine to unload');
    return false;
  }
  
  try {
    // MLC WebLLM engines have a terminate() method
    if (typeof localAIEngine.unload === 'function') {
      await localAIEngine.unload();
      console.log('Local AI engine unloaded via unload()');
    } else if (typeof localAIEngine.terminate === 'function') {
      await localAIEngine.terminate();
      console.log('Local AI engine terminated');
    }
    
    // Clear the references
    localAIEngine = null;
    localAIReady = false;
    localAIGenerating = false;
    localAIInitializing = false;
    localAIModelId = null;
    localAIIsVisionModel = false;
    
    console.log('✅ Local AI unloaded successfully');
    return true;
  } catch (err) {
    console.error('Error unloading local AI:', err);
    // Still clear references even on error
    localAIEngine = null;
    localAIReady = false;
    localAIGenerating = false;
    localAIInitializing = false;
    localAIModelId = null;
    localAIIsVisionModel = false;
    return false;
  }
};

/**
 * Check if Warrant Council is ready (primary)
 */
export const isDiamondSwarmReady = () => {
  return isSwarmReady() || (swarmEngine !== null && swarmReady && !swarmInitializingState);
};

/**
 * Check if local AI is ready (includes Warrant Council)
 */
export const isLocalAIReady = () => {
  // Warrant Council takes priority
  if (isDiamondSwarmReady()) return true;
  // Fallback to legacy local AI
  return localAIEngine !== null && localAIReady && !localAIInitializing;
};

/**
 * Check if local AI is currently initializing/warming up
 */
export const isLocalAIInitializing = () => {
  return isSwarmInitializing() || swarmInitializingState || localAIInitializing;
};

/**
 * Check if the currently loaded local AI model supports vision/image input
 * @returns {boolean} true if vision model is loaded and ready
 */
export const isLocalAIVisionModel = () => {
  return localAIEngine !== null && localAIReady && localAIIsVisionModel;
};

/**
 * Get the currently loaded local AI model ID
 * @returns {string|null} The model ID or null if no model loaded
 */
export const getLocalAIModelId = () => {
  return localAIModelId;
};

/**
 * Check if an API key is valid (not a placeholder)
 */
const isValidApiKey = (key) => {
  if (!key || key.length === 0) return false;
  // Reject common placeholder patterns
  const placeholderPatterns = [
    'your_',
    'your-',
    'YOUR_',
    'YOUR-',
    '_here',
    '-here',
    'api_key_here',
    'key_here',
    'placeholder',
    'example',
    'xxx',
    'test_key',
  ];
  const lowerKey = key.toLowerCase();
  return !placeholderPatterns.some(pattern => lowerKey.includes(pattern.toLowerCase()));
};

/**
 * Check if cloud AI is available (API key configured)
 */
export const isCloudAIAvailable = () => {
  const storedKey = localStorage.getItem(GEMINI_KEY);
  if (isValidApiKey(storedKey)) return true;
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
  return isValidApiKey(envKey);
};

/**
 * 🌐 Check if Wllama (browser WASM) is available
 */
export const isWllamaAvailable = () => {
  return wllamaReady && !wllamaInitializing;
};

/**
 * 🌐 Check if Wllama is currently initializing
 */
export const isWllamaInitializing = () => {
  return wllamaInitializing;
};

/**
 * 🌐 Initialize Wllama for browser-based inference
 * @param {string} modelName - 'auditor' | 'writer' | 'rater'
 * @param {function} onProgress - Progress callback
 */
export const initializeWllama = async (modelName = 'auditor', onProgress = null) => {
  if (wllamaInitializing) {
    console.log('🌐 Wllama already initializing...');
    return false;
  }
  
  try {
    wllamaInitializing = true;
    console.log(`🌐 Initializing Wllama with ${modelName}...`);
    
    const result = await wllamaService.initializeWllama(modelName, onProgress);
    
    if (result.success) {
      wllamaReady = true;
      wllamaCurrentModel = modelName;
      console.log(`🌐 Wllama ready with ${modelName}`);
    } else {
      console.error('🌐 Wllama init failed:', result.error);
    }
    
    wllamaInitializing = false;
    return result.success;
  } catch (err) {
    console.error('🌐 Wllama init error:', err);
    wllamaInitializing = false;
    return false;
  }
};

/**
 * 🖥️ Check if local llama.cpp server is available
 */
export const isLocalServerAvailable = () => {
  return localServerAvailable;
};

/**
 * 🖥️ Check local server availability (ping the server)
 * @param {boolean} force - Force re-check even if already checked
 */
export const checkLocalServer = async (force = false) => {
  if (localServerChecked && !force) {
    return localServerAvailable;
  }
  
  try {
    console.log('🖥️ Checking local llama.cpp server...');
    const health = await localServerClient.checkServerHealth();
    localServerAvailable = health.available;
    localServerChecked = true;
    
    if (health.available) {
      console.log(`🖥️ Local server available: ${health.model || 'ready'}`);
    } else {
      console.log('🖥️ Local server not available');
    }
    
    return localServerAvailable;
  } catch (err) {
    console.log('🖥️ Local server check failed:', err.message);
    localServerAvailable = false;
    localServerChecked = true;
    return false;
  }
};

/**
 * Check if ANY AI is available
 */
export const isAnyAIAvailable = () => {
  return isCloudAIAvailable() || isLocalAIReady() || isWllamaAvailable() || isLocalServerAvailable();
};

/**
 * Get the effective AI mode based on availability
 * Priority: SWARM (WebGPU) → WLLAMA (WASM) → LOCAL_SERVER (llama.cpp) → LOCAL (legacy) → CLOUD
 */
export const getEffectiveAIMode = () => {
  const preferredMode = getAIMode();
  
  // Warrant Council mode (preferred - WebGPU)
  if (preferredMode === AI_MODES.SWARM) {
    if (isDiamondSwarmReady()) return AI_MODES.SWARM;
    if (isWllamaAvailable()) return AI_MODES.WLLAMA;
    if (isLocalServerAvailable()) return AI_MODES.LOCAL_SERVER;
    if (isLocalAIReady()) return AI_MODES.LOCAL;
    if (isCloudAIAvailable()) return AI_MODES.CLOUD;
    return null;
  }
  
  // Wllama mode (browser WASM - works everywhere)
  if (preferredMode === AI_MODES.WLLAMA) {
    if (isWllamaAvailable()) return AI_MODES.WLLAMA;
    if (isDiamondSwarmReady()) return AI_MODES.SWARM;
    if (isLocalServerAvailable()) return AI_MODES.LOCAL_SERVER;
    if (isCloudAIAvailable()) return AI_MODES.CLOUD;
    return null;
  }
  
  // Local Server mode (llama.cpp server)
  if (preferredMode === AI_MODES.LOCAL_SERVER) {
    if (isLocalServerAvailable()) return AI_MODES.LOCAL_SERVER;
    if (isDiamondSwarmReady()) return AI_MODES.SWARM;
    if (isWllamaAvailable()) return AI_MODES.WLLAMA;
    if (isCloudAIAvailable()) return AI_MODES.CLOUD;
    return null;
  }
  
  if (preferredMode === AI_MODES.LOCAL) {
    if (isDiamondSwarmReady()) return AI_MODES.SWARM; // Upgrade to swarm
    if (isWllamaAvailable()) return AI_MODES.WLLAMA;
    if (isLocalServerAvailable()) return AI_MODES.LOCAL_SERVER;
    return isLocalAIReady() ? AI_MODES.LOCAL : (isCloudAIAvailable() ? AI_MODES.CLOUD : null);
  }
  
  if (preferredMode === AI_MODES.CLOUD) {
    return isCloudAIAvailable() ? AI_MODES.CLOUD : (isDiamondSwarmReady() ? AI_MODES.SWARM : (isWllamaAvailable() ? AI_MODES.WLLAMA : (isLocalServerAvailable() ? AI_MODES.LOCAL_SERVER : (isLocalAIReady() ? AI_MODES.LOCAL : null))));
  }
  
  // AUTO mode: prefer swarm → wllama → local_server → local → cloud
  if (isDiamondSwarmReady()) return AI_MODES.SWARM;
  if (isWllamaAvailable()) return AI_MODES.WLLAMA;
  if (isLocalServerAvailable()) return AI_MODES.LOCAL_SERVER;
  if (isLocalAIReady()) return AI_MODES.LOCAL;
  if (isCloudAIAvailable()) return AI_MODES.CLOUD;
  return null;
};

/**
 * Get the Gemini API key (only returns valid keys, not placeholders)
 */
const getGeminiApiKey = () => {
  const storedKey = localStorage.getItem(GEMINI_KEY);
  if (isValidApiKey(storedKey)) return storedKey;
  const envKey = import.meta.env?.VITE_GEMINI_API_KEY;
  if (isValidApiKey(envKey)) return envKey;
  return '';
};

/**
 * Generate text using Cloud AI (Gemini)
 * 💎 Now enhanced with DKB (Diamond Knowledge Base) context injection
 */
const generateWithCloudAI = async (prompt, options = {}) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  // 💎 Build comprehensive system prompt with DKB context injection
  const { buildSystemPromptWithDKB, buildSystemPrompt, buildDKBContext } = await getAISystemPrompts();
  
  // Get base system prompt
  let defaultSystemPrompt = buildSystemPrompt({
    task: options.taskType || 'general',
    toolContext: options.toolContext,
    includeAppContext: true,
    includeRegulations: true,
    includeVeteranData: true,
  });
  
  // 💎 Inject DKB context based on user's prompt (makes Gemini "smart" on VA data)
  const useDKB = options.useDKB !== false; // Enabled by default
  if (useDKB) {
    try {
      const dkbContext = await buildDKBContext(prompt, {
        maxEntries: options.maxDKBEntries || 10,
        maxChars: options.maxDKBChars || 8000,
      });
      if (dkbContext) {
        defaultSystemPrompt += dkbContext;
        console.log('[Gemini] 💎 DKB context injected for enhanced VA knowledge');
      }
    } catch (dkbError) {
      console.warn('[Gemini] DKB context injection failed, continuing without:', dkbError.message);
    }
  }

  const {
    systemPrompt = defaultSystemPrompt,
    maxTokens = getUserTokenLimit(), // Use user-configured limit or default
    temperature = 0.7,
    topK = 40,
    topP = 0.95,
    timeout = 60000, // 60 second timeout
    scrubPIIEnabled = true, // Enable PII scrubbing by default
    preset = null, // Optional: Use AI_PRESETS (e.g., 'LEGAL', 'CREATIVE')
  } = options;

  // Apply preset if specified
  let finalConfig = { temperature, topK, topP, maxTokens };
  if (preset && AI_PRESETS[preset]) {
    const presetConfig = AI_PRESETS[preset];
    finalConfig = {
      temperature: presetConfig.temperature,
      topK: presetConfig.topK,
      topP: presetConfig.topP,
      maxTokens
    };
  }

  let fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  // PII Scrubbing (Client-Side Privacy Firewall)
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(fullPrompt);
    
    if (piiAnalysis.hasPII) {
      console.warn(`⚠️ PII Detected before AI call:`, piiAnalysis.types);
      
      // Scrub the PII
      const { scrubbedText, details } = scrubPII(fullPrompt, {
        aggressive: true, // Also scrub DOB and addresses
        preservePartial: false // Full redaction for safety
      });
      
      fullPrompt = scrubbedText;
      
      // Log what was scrubbed (for transparency)
      console.info(`🛡️ PII Scrubbed:`, details);
    }
  }

  // Create abort controller for timeout
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);
  
  let response;
  try {
    response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        contents: [{ parts: [{ text: fullPrompt }] }],
        generationConfig: {
          temperature: finalConfig.temperature,
          maxOutputTokens: finalConfig.maxTokens,
          topK: finalConfig.topK,
          topP: finalConfig.topP,
        },
        safetySettings: [
          { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
          { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
        ],
      }),
    });
  } catch (fetchError) {
    clearTimeout(timeoutId);
    // Handle network errors and timeouts
    if (fetchError.name === 'AbortError') {
      throw new Error('Request timed out. The AI is taking too long to respond. Please try again with a shorter prompt, or switch to Local AI.');
    }
    if (fetchError.message?.includes('Failed to fetch') || fetchError.message?.includes('NetworkError')) {
      throw new Error('Network error. Please check your internet connection. If you are offline, try Local AI which works without internet.');
    }
    throw new Error(`Connection failed: ${fetchError.message}. If this persists, try switching to Local AI.`);
  } finally {
    clearTimeout(timeoutId);
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    const errorMessage = errorData.error?.message || '';
    
    // Handle specific HTTP status codes with user-friendly messages
    switch (response.status) {
      case 400:
        if (errorMessage.includes('API key')) {
          throw new Error('Invalid API key. Please check your Gemini API key in Settings.');
        }
        throw new Error('Bad request. The AI could not process your input. Please try rephrasing.');
      
      case 401:
      case 403:
        throw new Error('API key unauthorized. Your Gemini API key may be invalid or expired. Please check Settings.');
      
      case 404:
        throw new Error('AI model endpoint not found. Please refresh the page and try again. If this persists, the API endpoint may have changed.');
      
      case 429:
        throw new Error('Rate limit reached. Too many requests - please wait a minute before trying again, or consider switching to Local AI.');
      
      case 500:
      case 502:
      case 503:
      case 504:
        throw new Error('Google\'s AI servers are temporarily unavailable. Please try again in a few minutes, or switch to Local AI.');
      
      default:
        // Check for region/access blocks
        if (errorMessage.includes('not available') || errorMessage.includes('region') || errorMessage.includes('country')) {
          throw new Error('Gemini API may not be available in your region. Consider using Local AI for 100% private, offline processing.');
        }
        throw new Error(errorMessage || `Cloud AI error (${response.status}). Please try again or switch to Local AI.`);
    }
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('No response generated');
  }

  return text;
};

/**
 * Generate text using Warrant Council (Primary AI Engine)
 * Routes to the appropriate specialized agent based on task type
 * 💎 Now enhanced with DKB context injection
 */
const generateWithWarrantCouncil = async (prompt, options = {}) => {
  const {
    taskType = 'general',
    toolId = null,
    maxTokens = getUserTokenLimit(),
    temperature = 0.7,
    scrubPIIEnabled = true,
    useDKB = true, // Enable DKB by default
  } = options;

  // PII Scrubbing (Client-Side Privacy Firewall)
  let scrubbedPrompt = prompt;
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(prompt);
    if (piiAnalysis.hasPII) {
      console.warn(`⚠️ PII Detected before Warrant Council call:`, piiAnalysis.types);
      const { scrubbedText, details } = scrubPII(prompt, {
        aggressive: true,
        preservePartial: false
      });
      scrubbedPrompt = scrubbedText;
      console.info(`🛡️ PII Scrubbed (Warrant Council):`, details);
    }
  }

  // 💎 Inject DKB context for Warrant Council (makes specialized agents VA-smart!)
  let enhancedPrompt = scrubbedPrompt;
  if (useDKB) {
    try {
      const { buildDKBContext } = await getAISystemPrompts();
      const dkbContext = await buildDKBContext(scrubbedPrompt, {
        maxEntries: options.maxDKBEntries || 6, // Smaller for fine-tuned models (they know more already)
        maxChars: options.maxDKBChars || 4000,
      });
      if (dkbContext) {
        enhancedPrompt = scrubbedPrompt + dkbContext;
        console.log('[WarrantCouncil] 💎 DKB context injected - agents have live knowledge base access');
      }
    } catch (dkbError) {
      console.warn('[WarrantCouncil] DKB context injection failed:', dkbError.message);
    }
  }

  // Determine the right agent based on task or tool
  let agentId = 'auditor'; // Default
  if (toolId) {
    agentId = TOOL_AGENT_MAP[toolId] || 'auditor';
  } else if (taskType) {
    // Map task types to agents
    const taskToAgent = {
      'cfile': 'auditor',
      'nexus': 'writer',
      'statement': 'writer',
      'personal-statement': 'writer',
      'rating': 'rater',
      'calculator': 'rater',
      'tdiu': 'rater',
      'legal': 'auditor',
      'analysis': 'auditor',
      'document': 'auditor',
      'writing': 'writer',
      'general': 'auditor'
    };
    agentId = taskToAgent[taskType] || 'auditor';
  }

  console.log(`🎖️ Warrant Council: Using ${agentId.toUpperCase()} agent for ${taskType || toolId || 'general'} task`);

  try {
    swarmGenerating = true;
    
    // 💎 Use enhanced prompt with DKB context
    const result = await generateWithSwarm(enhancedPrompt, {
      agentId,
      toolId,
      maxTokens,
      temperature
    });
    
    swarmGenerating = false;
    return result.text;
  } catch (err) {
    swarmGenerating = false;
    throw new Error(`Warrant Council error (${agentId}): ${err.message}`);
  }
};

/**
 * 🌐 Generate text using Wllama (Browser WASM inference)
 * 💎 Now enhanced with DKB context injection
 */
const generateWithWllama = async (prompt, options = {}) => {
  const {
    taskType = 'general',
    maxTokens = getUserTokenLimit(),
    temperature = 0.7,
    scrubPIIEnabled = true,
    onStream = null,
    useDKB = true,
  } = options;

  // PII Scrubbing
  let scrubbedPrompt = prompt;
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(prompt);
    if (piiAnalysis.hasPII) {
      console.warn(`⚠️ PII Detected before Wllama call:`, piiAnalysis.types);
      const { scrubbedText, details } = scrubPII(prompt, {
        aggressive: true,
        preservePartial: false
      });
      scrubbedPrompt = scrubbedText;
      console.info(`🛡️ PII Scrubbed (Wllama):`, details);
    }
  }

  // 💎 Inject DKB context for Wllama
  let enhancedPrompt = scrubbedPrompt;
  if (useDKB) {
    try {
      const { buildDKBContext } = await getAISystemPrompts();
      const dkbContext = await buildDKBContext(scrubbedPrompt, {
        maxEntries: options.maxDKBEntries || 6,
        maxChars: options.maxDKBChars || 4000,
      });
      if (dkbContext) {
        enhancedPrompt = scrubbedPrompt + dkbContext;
        console.log('[Wllama] 💎 DKB context injected');
      }
    } catch (dkbError) {
      console.warn('[Wllama] DKB context injection failed:', dkbError.message);
    }
  }

  try {
    console.log(`🌐 Wllama: Generating with ${wllamaCurrentModel || 'auditor'} model...`);
    
    const result = await wllamaService.chatCompletion(enhancedPrompt, {
      maxTokens,
      temperature,
      onToken: onStream ? (token) => onStream(token) : null,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Wllama generation failed');
    }
    
    return result.text;
  } catch (err) {
    throw new Error(`Wllama error: ${err.message}`);
  }
};

/**
 * 🖥️ Generate text using Local Server (llama.cpp API)
 * 💎 Now enhanced with DKB context injection
 */
const generateWithLocalServer = async (prompt, options = {}) => {
  const {
    taskType = 'general',
    maxTokens = getUserTokenLimit(),
    temperature = 0.7,
    scrubPIIEnabled = true,
    onStream = null,
    useDKB = true,
  } = options;

  // PII Scrubbing
  let scrubbedPrompt = prompt;
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(prompt);
    if (piiAnalysis.hasPII) {
      console.warn(`⚠️ PII Detected before Local Server call:`, piiAnalysis.types);
      const { scrubbedText, details } = scrubPII(prompt, {
        aggressive: true,
        preservePartial: false
      });
      scrubbedPrompt = scrubbedText;
      console.info(`🛡️ PII Scrubbed (Local Server):`, details);
    }
  }

  // 💎 Inject DKB context for Local Server
  let enhancedPrompt = scrubbedPrompt;
  if (useDKB) {
    try {
      const { buildDKBContext } = await getAISystemPrompts();
      const dkbContext = await buildDKBContext(scrubbedPrompt, {
        maxEntries: options.maxDKBEntries || 8,
        maxChars: options.maxDKBChars || 6000,
      });
      if (dkbContext) {
        enhancedPrompt = scrubbedPrompt + dkbContext;
        console.log('[LocalServer] 💎 DKB context injected');
      }
    } catch (dkbError) {
      console.warn('[LocalServer] DKB context injection failed:', dkbError.message);
    }
  }

  try {
    console.log('🖥️ Local Server: Generating via llama.cpp API...');
    
    const result = await localServerClient.chatCompletion(enhancedPrompt, {
      maxTokens,
      temperature,
      stream: !!onStream,
      onChunk: onStream,
    });
    
    if (!result.success) {
      throw new Error(result.error || 'Local server generation failed');
    }
    
    return result.text;
  } catch (err) {
    throw new Error(`Local Server error: ${err.message}`);
  }
};

/**
 * Generate text using Local AI (Legacy WebLLM - fallback only)
 */
const generateWithLocalAI = async (prompt, options = {}) => {
  // First try Warrant Council if available
  if (isDiamondSwarmReady()) {
    console.log('🎖️ Routing to Warrant Council (upgraded from legacy local AI)');
    return generateWithWarrantCouncil(prompt, options);
  }

  // Check for various initialization states and provide helpful error messages
  if (localAIInitializing) {
    throw new Error('Local AI is still warming up. Please wait for the model to finish loading before sending messages.');
  }
  if (!localAIEngine) {
    throw new Error('Local AI not initialized. Please initialize the Neural Engine first.');
  }
  if (!localAIReady) {
    throw new Error('Local AI engine exists but is not ready. This may indicate a failed initialization - please try reloading the model.');
  }
  
  // Acquire generation lock - this ensures only one generation at a time
  // and properly serializes concurrent requests
  const releaseLock = await acquireGenerationLock();
  
  // Double-check we're not already generating (belt and suspenders)
  if (localAIGenerating) {
    releaseLock();
    console.warn('⚠️ localAIGenerating flag still set despite lock - possible state bug');
    throw new Error('Another AI generation is in progress. Please wait for it to complete.');
  }

  // Build comprehensive system prompt if not provided (lazy load)
  // 💎 Now also injects DKB context for enhanced VA knowledge (same as cloud AI)
  const { buildSystemPrompt, buildDKBContext } = await getAISystemPrompts();
  let defaultSystemPrompt = buildSystemPrompt({
    task: options.taskType || 'general',
    toolContext: options.toolContext,
    includeAppContext: true,
    includeRegulations: true,
    includeVeteranData: true,
  });
  
  // 💎 Inject DKB context for Local AI (makes local models VA-smart!)
  const useDKB = options.useDKB !== false; // Enabled by default
  if (useDKB) {
    try {
      const dkbContext = await buildDKBContext(prompt, {
        maxEntries: options.maxDKBEntries || 8, // Slightly less than cloud due to context limits
        maxChars: options.maxDKBChars || 6000, // Smaller context for local models
      });
      if (dkbContext) {
        defaultSystemPrompt += dkbContext;
        console.log('[LocalAI] 💎 DKB context injected - local model now has VA knowledge base access');
      }
    } catch (dkbError) {
      console.warn('[LocalAI] DKB context injection failed, continuing without:', dkbError.message);
    }
  }

  const {
    systemPrompt = defaultSystemPrompt,
    maxTokens = getUserTokenLimit(), // Use user-configured limit or default
    temperature = 0.7,
    topK = 40,
    topP = 0.95,
    scrubPIIEnabled = true, // Enable PII scrubbing by default
    preset = null, // Optional: Use AI_PRESETS
    onStream,
  } = options;

  // Apply preset if specified
  let finalConfig = { temperature, topK, topP, maxTokens };
  if (preset && AI_PRESETS[preset]) {
    const presetConfig = AI_PRESETS[preset];
    finalConfig = {
      temperature: presetConfig.temperature,
      topK: presetConfig.topK || 40,
      topP: presetConfig.topP,
      maxTokens
    };
  }

  // PII Scrubbing (Client-Side Privacy Firewall)
  let scrubbedPrompt = prompt;
  if (scrubPIIEnabled) {
    const piiAnalysis = analyzePII(prompt);
    
    if (piiAnalysis.hasPII) {
      console.warn(`⚠️ PII Detected before Local AI call:`, piiAnalysis.types);
      
      // Scrub the PII
      const { scrubbedText, details } = scrubPII(prompt, {
        aggressive: true,
        preservePartial: false
      });
      
      scrubbedPrompt = scrubbedText;
      
      // Log what was scrubbed
      console.info(`🛡️ PII Scrubbed (Local AI):`, details);
    }
  }

  /**
   * Clean AI response - remove thinking tags and detect degenerate output
   * Handles DeepSeek R1 and other reasoning models that output <think> tags
   */
  const cleanResponse = (text) => {
    if (!text) return '';
    
    // Remove <think>...</think> blocks (DeepSeek R1, QwQ, and other reasoning models)
    let cleaned = text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim();
    
    // Remove unclosed <think> tags (model may have been interrupted mid-thought)
    cleaned = cleaned.replace(/<think>[\s\S]*/gi, '').trim();
    
    // Remove orphaned </think> tags (sometimes R1 outputs these without opening tag)
    cleaned = cleaned.replace(/<\/think>/gi, '').trim();
    
    // Remove any remaining think-like patterns (</think>'ve, </think>", etc.)
    cleaned = cleaned.replace(/<\/think>[^\s]*/gi, '').trim();
    
    // Detect degenerate/repetitive output (same 2-10 char pattern repeated 8+ times)
    const repetitionPattern = /(.{2,10})\1{8,}/;
    if (repetitionPattern.test(cleaned)) {
      console.warn('⚠️ Detected degenerate output (repetition collapse)');
      const match = cleaned.match(repetitionPattern);
      if (match) {
        const repetitiveSection = match[0];
        cleaned = cleaned.replace(repetitiveSection, '[Output truncated due to repetition]');
      }
    }
    
    // Detect R1-style gibberish (multiple quotes/ellipsis/fragments indicating confused output)
    const gibberishPatterns = [
      /(\.{3,}\s*){5,}/,           // Multiple ellipsis sequences
      /(["\"]\s*){5,}/,            // Multiple quote sequences  
      /(Hmm|Ok|Wait|But|Hence|Thus|Therefore)[\s\S]{0,20}\1[\s\S]{0,20}\1/gi, // Repeated filler words
      /\b(think|thinking|thought)\b[\s\S]{0,50}\b\1\b[\s\S]{0,50}\b\1\b/gi, // Repeated "think"
    ];
    
    for (const pattern of gibberishPatterns) {
      if (pattern.test(cleaned)) {
        console.warn('⚠️ Detected R1-style confused output');
        // Try to extract any meaningful content before the gibberish
        const lines = cleaned.split('\n').filter(l => l.trim());
        const meaningfulLines = lines.filter(line => {
          const lower = line.toLowerCase();
          return !lower.includes('hmm') && 
                 !lower.includes('wait') && 
                 !lower.includes('confuse') &&
                 !lower.includes('unclear') &&
                 line.length > 20 &&
                 !/^[\s\"\'\.\\,\!\?]+$/.test(line);
        });
        if (meaningfulLines.length > 0) {
          cleaned = meaningfulLines.join('\n');
        } else {
          cleaned = 'I apologize, but I\'m having trouble generating a clear response. Please try rephrasing your question or using a different AI model.';
        }
        break;
      }
    }
    
    return cleaned;
  };

  try {
    localAIGenerating = true;
    
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: scrubbedPrompt },
    ];

    // Generation config with repetition penalty to prevent degenerate output
    const generationConfig = {
      messages,
      max_tokens: finalConfig.maxTokens,
      temperature: finalConfig.temperature,
      top_p: finalConfig.topP,
      // Repetition penalty to prevent loops (1.0 = no penalty, >1.0 = penalize repetition)
      repetition_penalty: 1.1,
      // Frequency penalty (penalize tokens that appear frequently)
      frequency_penalty: 0.3,
      // Presence penalty (penalize tokens that have appeared at all)
      presence_penalty: 0.1,
    };

    if (onStream) {
      // Streaming response
      let fullResponse = '';
      const chunks = await localAIEngine.chat.completions.create({
        ...generationConfig,
        stream: true,
      });

      for await (const chunk of chunks) {
        const delta = chunk.choices[0]?.delta?.content || '';
        fullResponse += delta;
        
        // Clean and send the streamed response
        const cleanedResponse = cleanResponse(fullResponse);
        onStream(delta, cleanedResponse);
        
        // Early abort if we detect degenerate output during streaming
        if (fullResponse.length > 200) {
          const last200 = fullResponse.slice(-200);
          const repetitionPattern = /(.{2,10})\1{8,}/;
          if (repetitionPattern.test(last200)) {
            console.warn('⚠️ Aborting due to degenerate output detected during streaming');
            try {
              await localAIEngine.interruptGenerate?.();
            } catch (e) {
              // Ignore interrupt errors
            }
            break;
          }
        }
      }

      localAIGenerating = false;
      releaseLock();
      return cleanResponse(fullResponse);
    } else {
      // Non-streaming response
      console.log('🔧 Local AI generation config:', JSON.stringify(generationConfig, null, 2).substring(0, 500));
      const response = await localAIEngine.chat.completions.create(generationConfig);
      console.log('🔧 Local AI raw response:', JSON.stringify(response, null, 2).substring(0, 1000));

      localAIGenerating = false;
      
      // Check for aborted response (WebLLM returns empty content when aborted)
      const finishReason = response.choices[0]?.finish_reason;
      const rawContent = response.choices[0]?.message?.content || '';
      
      if (finishReason === 'abort' && !rawContent) {
        console.warn('⚠️ Generation was aborted (possibly concurrent request conflict)');
        releaseLock();
        throw new Error('AI generation was interrupted. Please try again. If this keeps happening, refresh the page.');
      }
      
      console.log('🔧 Local AI rawContent:', rawContent.substring(0, 500) || '(empty)');
      releaseLock();
      return cleanResponse(rawContent);
    }
  } catch (err) {
    localAIGenerating = false;
    releaseLock();
    
    // Provide user-friendly error messages for common Local AI failures
    const errorMsg = err.message || '';
    
    // WebLLM specific errors
    if (errorMsg.includes('ModelNotLoadedError') || errorMsg.includes('not loaded')) {
      throw new Error('Local AI model not loaded. Please wait for the model to finish loading, or try reloading.');
    }
    if (errorMsg.includes('WebGPU') || errorMsg.includes('GPU')) {
      throw new Error('GPU error. Your device may not fully support Local AI. Try refreshing the page, or switch to Cloud AI.');
    }
    if (errorMsg.includes('out of memory') || errorMsg.includes('OOM')) {
      throw new Error('GPU out of memory. Try a smaller model (like Llama 3.2 1B), close other browser tabs, or switch to Cloud AI.');
    }
    if (errorMsg.includes('aborted') || errorMsg.includes('cancelled')) {
      throw new Error('Generation was cancelled.');
    }
    
    // Re-throw with context
    throw new Error(`Local AI error: ${errorMsg}. If this persists, try reloading the model or switching to Cloud AI.`);
  }
};

/**
 * Get user's selected AI preset from localStorage
 */
const getUserPreset = () => {
  try {
    const saved = localStorage.getItem('vetrate_ai_preset');
    if (saved && AI_PRESETS[saved]) {
      return saved;
    }
  } catch (e) {
    console.warn('Error loading preset:', e);
  }
  return null; // Use function defaults if no preset
};

/**
 * Generate AI response with image input (for vision models)
 * This function sends actual images to the vision model instead of OCR text.
 * 
 * @param {string} prompt - The text prompt describing what to analyze
 * @param {string|string[]} imageUrls - Base64 data URLs of images to analyze (data:image/jpeg;base64,...)
 * @param {Object} options - Generation options
 * @param {string} options.systemPrompt - System prompt for context
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @returns {Promise<{text: string, mode: string}>} Generated text and mode used
 */
export const generateAIWithImage = async (prompt, imageUrls, options = {}) => {
  // Validate vision model is loaded
  if (!localAIIsVisionModel) {
    throw new Error('Vision model not loaded. Please load a vision model (like Vet-Rate Vision Phi) to analyze images directly.');
  }
  
  if (!localAIEngine) {
    throw new Error('Local AI engine not initialized. Please wait for model to load.');
  }
  
  if (!localAIReady) {
    throw new Error('Local AI not ready. Please wait for model to finish loading.');
  }
  
  // Normalize imageUrls to array
  const images = Array.isArray(imageUrls) ? imageUrls : [imageUrls];
  
  // Validate images
  for (const url of images) {
    if (!url.startsWith('data:image')) {
      throw new Error('Image must be a base64 data URL (data:image/...). Use renderPDFToImages or convert images first.');
    }
  }
  
  console.log(`🖼️ generateAIWithImage: ${images.length} image(s), prompt: ${prompt.substring(0, 100)}...`);
  
  const {
    systemPrompt = '',
    maxTokens = getUserTokenLimit(),
    temperature = 0.2, // Lower temperature for document analysis
  } = options;
  
  localAIGenerating = true;
  
  try {
    // Build multimodal message content (OpenAI vision format)
    // WebLLM follows OpenAI's chat completion API for vision models
    const contentParts = [];
    
    // Add text prompt first
    contentParts.push({
      type: 'text',
      text: prompt,
    });
    
    // Add images
    for (const imageUrl of images) {
      contentParts.push({
        type: 'image_url',
        image_url: {
          url: imageUrl,
        },
      });
    }
    
    // Build messages array
    const messages = [];
    
    // Add system prompt if provided
    if (systemPrompt) {
      messages.push({
        role: 'system',
        content: systemPrompt,
      });
    }
    
    // Add user message with image(s)
    messages.push({
      role: 'user',
      content: contentParts,
    });
    
    console.log('🖼️ Vision request - messages structure:', JSON.stringify(messages.map(m => ({
      role: m.role,
      contentType: Array.isArray(m.content) ? `array[${m.content.length}]` : typeof m.content,
      contentParts: Array.isArray(m.content) ? m.content.map(p => p.type) : null,
    })), null, 2));
    
    const generationConfig = {
      messages,
      max_tokens: maxTokens,
      temperature,
      top_p: 0.95,
    };
    
    // Non-streaming for image analysis (more reliable)
    const response = await localAIEngine.chat.completions.create(generationConfig);
    
    localAIGenerating = false;
    const rawContent = response.choices[0]?.message?.content || '';
    console.log('🖼️ Vision model response:', rawContent.substring(0, 500) || '(empty)');
    
    // Check for empty response - this indicates the model failed to process the image
    if (!rawContent || rawContent.trim().length === 0) {
      console.warn('⚠️ Vision model returned empty response');
      // Return with empty flag so caller can handle appropriately
      return {
        text: '',
        mode: 'local',
        isVisionResponse: true,
        isEmpty: true,
      };
    }
    
    return {
      text: rawContent,
      mode: 'local',
      isVisionResponse: true,
    };
    
  } catch (err) {
    localAIGenerating = false;
    console.error('Vision model error:', err);
    
    const errorMsg = err.message || '';
    
    if (errorMsg.includes('not of type ModelType.VLM')) {
      throw new Error('The loaded model does not support image input. Please load a vision model like Vet-Rate Vision Phi.');
    }
    if (errorMsg.includes('image_url')) {
      throw new Error('Image format error. Please ensure images are valid base64 data URLs.');
    }
    
    throw new Error(`Vision model error: ${errorMsg}`);
  }
};

/**
 * Unified AI Generation Function
 * Automatically routes to the appropriate AI backend based on user preference
 * 
 * @param {string} prompt - The user prompt
 * @param {Object} options - Generation options
 * @param {string} options.taskType - Type of task for system prompt (cfile, nexus, statement, etc.)
 * @param {object} options.context - Additional context for system prompt
 * @param {string} options.systemPrompt - Override system prompt for context
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @param {string} options.preset - AI preset name (LEGAL, CREATIVE, ADVERSARIAL, BALANCED)
 * @param {function} options.onStream - Callback for streaming (local AI only)
 * @param {boolean} options.skipCrisisCheck - Skip crisis interception (for internal use)
 * @param {boolean} options.skipValidation - Skip AI response validation
 * @param {boolean} options.skipHallucinationCheck - Skip diagnostic code validation
 * @param {boolean} options.skipFeatureCheck - Skip feature flag check
 * @returns {Promise<{text: string, mode: string}>} Generated text and mode used
 */
export const generateAI = async (prompt, options = {}) => {
  // Feature flag check (unless explicitly skipped)
  if (!options.skipFeatureCheck) {
    const aiEnabled = await isFeatureEnabled('ai_enabled');
    if (!aiEnabled) {
      throw new Error('AI features are temporarily disabled. Please try again later.');
    }
    
    // Check mode-specific flags
    const effectiveMode = getEffectiveAIMode();
    if (effectiveMode === AI_MODES.LOCAL) {
      const localEnabled = await isFeatureEnabled('local_ai');
      if (!localEnabled) {
        throw new Error('Local AI is temporarily disabled. Please use Cloud AI or try again later.');
      }
    } else if (effectiveMode === AI_MODES.CLOUD) {
      const cloudEnabled = await isFeatureEnabled('cloud_ai');
      if (!cloudEnabled) {
        throw new Error('Cloud AI is temporarily disabled. Please use Local AI or try again later.');
      }
    }
  }

  // Crisis safety check (unless explicitly skipped)
  if (!options.skipCrisisCheck) {
    const crisisResult = await interceptBeforeAICall(prompt);
    if (crisisResult.shouldBlock) {
      throw new Error('CRISIS_DETECTED');
    }
  }

  const effectiveMode = getEffectiveAIMode();
  
  if (!effectiveMode) {
    throw new Error('No AI available. Please configure a Gemini API key or initialize Local AI.');
  }

  // Build system prompt with anti-hallucination guardrails (unless overridden)
  const { buildSystemPrompt } = await getAISystemPrompts();
  const systemPrompt = options.systemPrompt || buildSystemPrompt({
    task: options.taskType || 'general',
    toolContext: options.toolContext,
    includeAppContext: true,
    includeRegulations: true,
    includeVeteranData: true,
  });
  
  // Apply user's saved preset if no preset specified in options
  const effectivePreset = options.preset || getUserPreset();
  
  // Merge options with preset (options take precedence)
  const enhancedOptions = {
    ...options,
    preset: effectivePreset
  };
  
  // Prepend system prompt to user prompt
  const fullPrompt = systemPrompt 
    ? `${systemPrompt}\n\n---\n\nUser Request:\n${prompt}`
    : prompt;

  try {
    let text;
    let usedMode;
    let agentUsed = null;
    
    // Determine which AI to use - Warrant Council is primary, then Wllama, then Local Server
    const useSwarm = effectiveMode === AI_MODES.SWARM || isDiamondSwarmReady();
    const useWllama = effectiveMode === AI_MODES.WLLAMA || (!useSwarm && isWllamaAvailable());
    const useLocalServer = effectiveMode === AI_MODES.LOCAL_SERVER || (!useSwarm && !useWllama && isLocalServerAvailable());
    const useCloud = (options.preferCloud && isCloudAIAvailable()) || effectiveMode === AI_MODES.CLOUD;
    const useLocal = !useSwarm && !useWllama && !useLocalServer && !useCloud && effectiveMode === AI_MODES.LOCAL;
    
    if (useSwarm && isDiamondSwarmReady()) {
      // 🎖️ Warrant Council - Primary AI Engine (WebGPU)
      text = await generateWithWarrantCouncil(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.SWARM;
      agentUsed = getCurrentAgent() || 'auditor';
      console.log(`🎖️ Generated with Warrant Council (${agentUsed.toUpperCase()} agent)`);
    } else if (useWllama && isWllamaAvailable()) {
      // 🌐 Wllama - Browser WASM inference
      text = await generateWithWllama(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.WLLAMA;
      agentUsed = wllamaCurrentModel || 'auditor';
      console.log(`🌐 Generated with Wllama (${agentUsed.toUpperCase()} model)`);
    } else if (useLocalServer && isLocalServerAvailable()) {
      // 🖥️ Local Server - llama.cpp API
      text = await generateWithLocalServer(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.LOCAL_SERVER;
      console.log('🖥️ Generated with local llama.cpp server');
    } else if (useLocal && isLocalAIReady()) {
      // Legacy local AI (fallback)
      text = await generateWithLocalAI(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.LOCAL;
    } else if (useCloud || isCloudAIAvailable()) {
      // Cloud AI (Gemini - fallback)
      text = await generateWithCloudAI(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.CLOUD;
    } else if (isWllamaAvailable()) {
      // Fallback: Wllama
      text = await generateWithWllama(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.WLLAMA;
    } else if (isLocalServerAvailable()) {
      // Fallback: Local Server
      text = await generateWithLocalServer(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.LOCAL_SERVER;
    } else if (isLocalAIReady()) {
      // Final fallback: try legacy local
      text = await generateWithLocalAI(fullPrompt, enhancedOptions);
      usedMode = AI_MODES.LOCAL;
    } else {
      throw new Error('No AI available. Please initialize Warrant Council, start the local server, or configure a Gemini API key.');
    }
    
    // Hallucination Trap: Filter invalid diagnostic codes (unless explicitly skipped)
    let hallucinationReport = null;
    if (!options.skipHallucinationCheck) {
      try {
        const validation = validateHallucinations(text);
        
        // Only process if validation actually found diagnostic codes to check
        // (skipped=true means response didn't contain diagnostic codes)
        if (!validation.skipped && validation.rejected && validation.rejected.length > 0) {
          console.warn('🚫 Hallucination Trap triggered:', validation.rejected);
          hallucinationReport = {
            filtered: validation.rejected,
            valid: validation.safeData,
            stats: validation.stats
          };
          
          // If the response had structured data that was filtered, optionally reconstruct
          if (validation.success && validation.safeData) {
            // For JSON responses, we can return the filtered version
            if (options.expectJSON) {
              text = JSON.stringify(validation.safeData, null, 2);
              console.info('✅ Reconstructed AI response with valid codes only');
            }
          }
        }
      } catch (hallucinationErr) {
        // Don't fail the entire request if hallucination check fails
        console.warn('Hallucination check failed:', hallucinationErr);
      }
    }
    
    // Validate AI response for hallucinations (unless explicitly skipped)
    if (!options.skipValidation && options.taskType) {
      const { validateAIResponse } = await getAISystemPrompts();
      const validation = validateAIResponse(text, options.taskType);
      if (!validation.isValid) {
        console.warn('⚠️ AI response validation warnings:', validation.warnings);
        return {
          text,
          mode: usedMode,
          validationWarnings: validation.warnings,
          hallucinationReport
        };
      }
    }
    
    return { 
      text, 
      mode: usedMode,
      ...(agentUsed && { agent: agentUsed }),
      ...(hallucinationReport && { hallucinationReport })
    };
    
  } catch (err) {
    const errorMsg = err.message || '';
    
    // 🔥 CONTEXT WINDOW OVERFLOW HANDLING
    // When Local AI (4096 tokens) can't handle large input, auto-fallback to Cloud AI (1M tokens)
    const isContextOverflow = errorMsg.includes('ContextWindowSizeExceeded') ||
                              errorMsg.includes('context window') ||
                              errorMsg.includes('prompt tokens exceed');
    
    if (isContextOverflow) {
      console.warn('📏 Context window overflow detected - document too large for Local AI');
      
      // Try Cloud AI (Gemini has 1M token context window)
      if (isCloudAIAvailable() && !options.noFallback) {
        console.log('☁️ Auto-falling back to Cloud AI for large document...');
        try {
          const text = await generateWithCloudAI(fullPrompt, {
            ...enhancedOptions,
            // Use minimal system prompt for large documents to save tokens
            systemPrompt: options.systemPrompt || null,
          });
          return {
            text,
            mode: AI_MODES.CLOUD,
            fallback: true,
            fallbackReason: 'context_overflow',
            note: 'Document was too large for Local AI (4096 tokens). Processed with Cloud AI instead.'
          };
        } catch (cloudErr) {
          console.error('☁️ Cloud AI fallback also failed:', cloudErr.message);
          throw new Error(
            `Document is too large for Local AI (4096 token limit) and Cloud AI also failed. ` +
            `Please try with a shorter document, or paste only the most important sections of your decision letter.`
          );
        }
      } else {
        // No Cloud AI available - give helpful error
        throw new Error(
          `📏 Document is too large for Local AI (4096 token limit). ` +
          `Options: 1) Configure a Gemini API key in Settings to enable Cloud AI fallback for large documents, ` +
          `2) Paste only the key sections of your decision letter (look for "Reasons for Decision" or "Denial" sections), ` +
          `3) Try uploading fewer pages at once.`
        );
      }
    }
    
    // If preferred mode fails, try fallback chain: Swarm -> Local -> Cloud
    let fallbackMode = null;
    let canFallback = false;
    
    if (effectiveMode === AI_MODES.SWARM) {
      fallbackMode = isLocalAIReady() ? AI_MODES.LOCAL : AI_MODES.CLOUD;
      canFallback = fallbackMode === AI_MODES.LOCAL ? isLocalAIReady() : isCloudAIAvailable();
    } else if (effectiveMode === AI_MODES.LOCAL) {
      fallbackMode = AI_MODES.CLOUD;
      canFallback = isCloudAIAvailable();
    } else {
      fallbackMode = isDiamondSwarmReady() ? AI_MODES.SWARM : AI_MODES.LOCAL;
      canFallback = isDiamondSwarmReady() || isLocalAIReady();
    }
    
    if (canFallback && !options.noFallback) {
      console.warn(`💎 Primary AI (${effectiveMode}) failed, falling back to ${fallbackMode}:`, err.message);
      try {
        if (fallbackMode === AI_MODES.SWARM) {
          const text = await generateWithWarrantCouncil(fullPrompt, options);
          return { text, mode: AI_MODES.SWARM, agent: getCurrentAgent(), fallback: true };
        } else if (fallbackMode === AI_MODES.LOCAL) {
          const text = await generateWithLocalAI(fullPrompt, options);
          return { text, mode: AI_MODES.LOCAL, fallback: true };
        } else {
          const text = await generateWithCloudAI(fullPrompt, options);
          return { text, mode: AI_MODES.CLOUD, fallback: true };
        }
      } catch (fallbackErr) {
        throw new Error(`All AI modes failed. Primary: ${err.message}. Fallback: ${fallbackErr.message}`);
      }
    }
    
    throw err;
  }
};

/**
 * Get the currently loaded AI model name
 * Prioritizes Warrant Council agents over legacy models
 */
export const getLocalModelName = () => {
  // Diamond Swarm takes priority
  if (isDiamondSwarmReady()) {
    const agent = getCurrentAgent();
    if (agent) {
      const agentInfo = SWARM_AGENTS[agent.toUpperCase()];
      return agentInfo ? `💎 ${agentInfo.name}` : `💎 Diamond ${agent}`;
    }
    return '🎖️ Warrant Council';
  }
  
  const modelId = localStorage.getItem('vet_rate_local_ai_model');
  if (!modelId) return 'Local AI';  // Generic name when no specific model selected
  
  // Warrant Council agents (fine-tuned VetRate models)
  if (modelId.includes('vetrate-auditor')) return '🎖️ CW5 Auditor';
  if (modelId.includes('vetrate-writer')) return '🎖️ CW4 Writer';
  if (modelId.includes('vetrate-rater')) return '🎖️ CW3 Rater';
  
  // Extract friendly name from model ID
  // DeepSeek R1 Reasoning Models
  if (modelId.includes('DeepSeek-R1-Distill-Qwen-7B')) return 'DeepSeek R1 7B';
  if (modelId.includes('DeepSeek-R1-Distill-Llama-8B')) return 'DeepSeek R1 8B';
  if (modelId.includes('DeepSeek')) return 'DeepSeek R1';
  
  // Qwen 3 Series (Latest)
  if (modelId.includes('Qwen3-0.6B')) return 'Qwen 3 0.6B';
  if (modelId.includes('Qwen3-1.7B')) return 'Qwen 3 1.7B';
  if (modelId.includes('Qwen3-4B')) return 'Qwen 3 4B';
  if (modelId.includes('Qwen3-8B')) return 'Qwen 3 8B';
  
  // Qwen 2.5 Series
  if (modelId.includes('Qwen2.5-0.5B')) return 'Qwen 2.5 0.5B';
  if (modelId.includes('Qwen2.5-1.5B')) return 'Qwen 2.5 1.5B';
  if (modelId.includes('Qwen2.5-3B')) return 'Qwen 2.5 3B';
  if (modelId.includes('Qwen2.5-7B')) return 'Qwen 2.5 7B';
  if (modelId.includes('Qwen')) return 'Qwen';
  
  // SmolLM2 Series (Tiny models)
  if (modelId.includes('SmolLM2-135M')) return 'SmolLM2 135M';
  if (modelId.includes('SmolLM2-360M')) return 'SmolLM2 360M';
  if (modelId.includes('SmolLM2-1.7B')) return 'SmolLM2 1.7B';
  if (modelId.includes('SmolLM2')) return 'SmolLM2';
  
  // Hermes Series (Function Calling)
  if (modelId.includes('Hermes-3-Llama-3.2-3B')) return 'Hermes 3 3B';
  if (modelId.includes('Hermes-3-Llama-3.1-8B')) return 'Hermes 3 8B';
  if (modelId.includes('Hermes-2-Pro')) return 'Hermes 2 Pro';
  if (modelId.includes('Hermes')) return 'Hermes';
  
  // Llama Series
  if (modelId.includes('Llama-3.2-1B')) return 'Llama 3.2 1B';
  if (modelId.includes('Llama-3.2-3B')) return 'Llama 3.2 3B';
  if (modelId.includes('Llama-3.1-8B')) return 'Llama 3.1 8B';
  if (modelId.includes('Llama')) return 'Llama';
  
  // Phi Series (Microsoft) & Custom Vision Models
  if (modelId.includes('Vet-Rate-Vision-Phi-Float32')) return 'Vet-Rate Vision Phi';
  if (modelId.includes('Vet-Rate-Vision-Phi')) return 'Vet-Rate Vision Phi (Legacy)';
  if (modelId.includes('Phi-3.5-vision')) return 'Phi 3.5 Vision';
  if (modelId.includes('Phi-3.5')) return 'Phi 3.5 Mini';
  if (modelId.includes('Phi')) return 'Phi';
  
  // Mistral Series
  if (modelId.includes('Mistral-7B')) return 'Mistral 7B';
  if (modelId.includes('Mistral')) return 'Mistral';
  
  // Gemma Series (Google)
  if (modelId.includes('gemma-2-9b')) return 'Gemma 2 9B';
  if (modelId.includes('gemma-2-2b')) return 'Gemma 2 2B';
  if (modelId.includes('Gemma') || modelId.includes('gemma')) return 'Gemma';
  
  // Fallback: try to extract a readable name from the model ID
  // e.g., "Some-Model-Name-q4f32_1-MLC" -> "Some Model Name"
  const cleanName = modelId
    .replace(/-q\d+f\d+.*$/, '')  // Remove quantization suffix
    .replace(/-MLC$/, '')          // Remove MLC suffix
    .replace(/-Instruct$/, '')     // Remove Instruct suffix
    .replace(/-/g, ' ')            // Replace dashes with spaces
    .trim();
  
  return cleanName || 'Local AI';
};

/**
 * Get AI status information for UI display
 */
export const getAIStatus = () => {
  const mode = getAIMode();
  const effectiveMode = getEffectiveAIMode();
  const localModelName = getLocalModelName();
  const swarmStatus = getSwarmStatus();
  const currentAgent = getCurrentAgent();
  
  // Check if using Warrant Council or other local backends
  const isSwarm = effectiveMode === AI_MODES.SWARM || isDiamondSwarmReady();
  const isWllama = effectiveMode === AI_MODES.WLLAMA;
  const isLocalServer = effectiveMode === AI_MODES.LOCAL_SERVER;
  
  // Determine status text
  let statusText = 'No AI Available';
  let fullStatusText = '⚠️ No AI Available';
  
  if (isSwarm) {
    statusText = `🎖️ Warrant Council: ${currentAgent?.toUpperCase() || 'AUDITOR'}`;
    fullStatusText = `🎖️ Warrant Council (${currentAgent?.toUpperCase() || 'AUDITOR'}) - 100% Private`;
  } else if (isWllama) {
    statusText = `🌐 Wllama: ${wllamaCurrentModel?.toUpperCase() || 'AUDITOR'}`;
    fullStatusText = `🌐 Wllama (Browser WASM) - 100% Private`;
  } else if (isLocalServer) {
    statusText = '🖥️ Local Server: llama.cpp';
    fullStatusText = '🖥️ Local Server (llama.cpp) - 100% Private';
  } else if (effectiveMode === AI_MODES.LOCAL) {
    statusText = `Local: ${localModelName}`;
    fullStatusText = `🔒 ${localModelName} (Local)`;
  } else if (effectiveMode === AI_MODES.CLOUD) {
    statusText = 'Cloud: Gemini 2.5 Flash';
    fullStatusText = '☁️ Gemini 2.5 Flash (Cloud)';
  }
  
  return {
    preferredMode: mode,
    effectiveMode,
    cloudAvailable: isCloudAIAvailable(),
    localAvailable: isLocalAIReady(),
    swarmAvailable: isDiamondSwarmReady(),
    wllamaAvailable: isWllamaAvailable(),
    localServerAvailable: isLocalServerAvailable(),
    swarmStatus,
    currentAgent,
    localInitializing: isLocalAIInitializing(),
    wllamaInitializing: isWllamaInitializing(),
    localGenerating: localAIGenerating || swarmGenerating,
    anyAvailable: isAnyAIAvailable(),
    isPrivate: effectiveMode !== AI_MODES.CLOUD, // All local options are private
    cloudModelName: 'Gemini 2.5 Flash',
    localModelName,
    statusText,
    fullStatusText,
  };
};

/**
 * Privacy disclosure text based on current AI mode
 */
export const getAIDataDisclosure = () => {
  const status = getAIStatus();
  
  if (status.effectiveMode === AI_MODES.SWARM) {
    return {
      title: '🎖️ Warrant Council - 100% Private',
      description: 'All AI processing uses specialized VetRate agents running directly on your device. No data ever leaves.',
      bullets: [
        '✅ Your data NEVER leaves your device',
        '✅ 3 specialized agents: Auditor, Writer, Rater',
        '✅ Fine-tuned on official VA regulations',
        '✅ Diamond Standard accuracy & privacy',
      ],
      isPrivate: true,
      isDiamond: true,
    };
  }
  
  if (status.effectiveMode === AI_MODES.LOCAL) {
    return {
      title: '🔒 100% Private - Local AI Active',
      description: 'All AI processing happens directly on your device using WebGPU. No data is sent to any server.',
      bullets: [
        '✅ Your data NEVER leaves your device',
        '✅ Works even offline once loaded',
        '✅ No API keys required',
        '💡 Upgrade to Warrant Council for specialized VA agents',
      ],
      isPrivate: true,
    };
  }
  
  if (status.effectiveMode === AI_MODES.CLOUD) {
    return {
      title: '☁️ Cloud AI Active',
      description: 'AI processing uses Google\'s Gemini API. Only condition names and symptom descriptions are sent - never PII.',
      bullets: [
        '⚠️ Data is sent to Google\'s servers',
        '✅ No personal identifying information sent',
        '✅ Your API key, your control',
        '💡 Switch to Warrant Council for 100% privacy + specialized VA agents',
      ],
      isPrivate: false,
    };
  }
  
  return {
    title: '⚠️ No AI Available',
    description: 'Configure AI to enable intelligent features.',
    bullets: [
      '🎖️ Option 1: Enable Warrant Council (recommended - specialized VA agents)',
      '🌐 Option 2: Enable Wllama (browser WASM - works everywhere)',
      '🖥️ Option 3: Start local llama.cpp server (desktop inference)',
      '🔒 Option 4: Enable Local AI (100% private legacy)',
      '☁️ Option 5: Add Gemini API key (cloud)',
    ],
    isPrivate: null,
  };
};

// Re-export Diamond Swarm functions for convenience
export {
  SWARM_AGENTS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getSwarmStatus,
  initializeSwarm,
  switchAgent,
  unloadSwarm
} from './diamondSwarm';

export default {
  AI_MODES,
  AI_PRESETS,
  getAIMode,
  setAIMode,
  getEffectiveAIMode,
  getAIPreset,
  getUserPreset,
  isLocalAIReady,
  isLocalAIInitializing,
  isLocalAIVisionModel,
  getLocalAIModelId,
  isDiamondSwarmReady,
  isCloudAIAvailable,
  isAnyAIAvailable,
  // New backends
  isWllamaAvailable,
  isWllamaInitializing,
  initializeWllama,
  isLocalServerAvailable,
  checkLocalServer,
  checkWebGPUSupport,
  registerLocalAIEngine,
  registerSwarmEngine,
  generateAI,
  generateAIWithImage,
  getAIStatus,
  getAIDataDisclosure,
  // Diamond Swarm
  SWARM_AGENTS,
  TOOL_AGENT_MAP,
  getAgentForTool,
  isSwarmReady,
  isSwarmInitializing,
  getCurrentAgent,
  getSwarmStatus,
  initializeSwarm,
  switchAgent,
  unloadSwarm
};
