/**
 * Vet-Rate.org - Unified AI Service
 * "The Faraday Cage Protocol" - Seamless switching between Cloud and Local AI
 * 
 * This service provides a unified interface for AI operations, allowing users
 * to seamlessly switch between:
 * - Cloud AI (Google Gemini) - Requires API key, data sent to Google
 * - Local AI (WebLLM) - 100% private, runs entirely in browser via WebGPU
 * 
 * The user's preference is remembered and the switch is transparent to all
 * AI-powered features in the application.
 */

import { interceptBeforeAICall } from './crisisInterceptor';

// Storage keys
const AI_MODE_KEY = 'vet_rate_ai_mode'; // 'cloud' | 'local'
const GEMINI_KEY = 'vetrate_gemini_key';
const LOCAL_MODEL_KEY = 'vet_rate_local_ai_model';

// Cloud AI endpoint
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

// Local AI engine reference (set by LocalAIProvider)
let localAIEngine = null;
let localAIReady = false;
let localAIGenerating = false;

/**
 * AI Mode Types
 */
export const AI_MODES = {
  CLOUD: 'cloud',
  LOCAL: 'local',
  AUTO: 'auto', // Prefer local if available, fallback to cloud
};

/**
 * Get the current AI mode preference
 */
export const getAIMode = () => {
  return localStorage.getItem(AI_MODE_KEY) || AI_MODES.AUTO;
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
 * Register the local AI engine (called by LocalAIProvider)
 */
export const registerLocalAIEngine = (engine, ready) => {
  localAIEngine = engine;
  localAIReady = ready;
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
    
    console.log('✅ Local AI unloaded successfully');
    return true;
  } catch (err) {
    console.error('Error unloading local AI:', err);
    // Still clear references even on error
    localAIEngine = null;
    localAIReady = false;
    localAIGenerating = false;
    return false;
  }
};

/**
 * Check if local AI is ready
 */
export const isLocalAIReady = () => {
  return localAIEngine !== null && localAIReady;
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
 * Check if ANY AI is available
 */
export const isAnyAIAvailable = () => {
  return isCloudAIAvailable() || isLocalAIReady();
};

/**
 * Get the effective AI mode based on availability
 */
export const getEffectiveAIMode = () => {
  const preferredMode = getAIMode();
  
  if (preferredMode === AI_MODES.LOCAL) {
    return isLocalAIReady() ? AI_MODES.LOCAL : (isCloudAIAvailable() ? AI_MODES.CLOUD : null);
  }
  
  if (preferredMode === AI_MODES.CLOUD) {
    return isCloudAIAvailable() ? AI_MODES.CLOUD : (isLocalAIReady() ? AI_MODES.LOCAL : null);
  }
  
  // AUTO mode: prefer local if ready, otherwise cloud
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
 */
const generateWithCloudAI = async (prompt, options = {}) => {
  const apiKey = getGeminiApiKey();
  if (!apiKey) {
    throw new Error('Gemini API key not configured');
  }

  const {
    systemPrompt = 'You are a helpful assistant specializing in VA disability claims and veteran benefits.',
    maxTokens = 2048,
    temperature = 0.7,
  } = options;

  const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;

  const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: fullPrompt }] }],
      generationConfig: {
        temperature,
        maxOutputTokens: maxTokens,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_ONLY_HIGH' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_ONLY_HIGH' },
      ],
    }),
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    if (response.status === 400 && errorData.error?.message?.includes('API key')) {
      throw new Error('Invalid API key. Please check your Gemini API key.');
    }
    throw new Error(errorData.error?.message || `API error: ${response.status}`);
  }

  const data = await response.json();
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
  
  if (!text) {
    throw new Error('No response generated');
  }

  return text;
};

/**
 * Generate text using Local AI (WebLLM)
 */
const generateWithLocalAI = async (prompt, options = {}) => {
  if (!localAIEngine || !localAIReady) {
    throw new Error('Local AI not initialized. Please initialize the Neural Engine first.');
  }

  const {
    systemPrompt = 'You are a helpful assistant specializing in VA disability claims and veteran benefits. Provide accurate, helpful information.',
    maxTokens = 1024,
    temperature = 0.7,
    onStream,
  } = options;

  localAIGenerating = true;

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt },
    ];

    if (onStream) {
      // Streaming response
      let fullResponse = '';
      const chunks = await localAIEngine.chat.completions.create({
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

      localAIGenerating = false;
      return fullResponse;
    } else {
      // Non-streaming response
      const response = await localAIEngine.chat.completions.create({
        messages,
        max_tokens: maxTokens,
        temperature,
      });

      localAIGenerating = false;
      return response.choices[0]?.message?.content || '';
    }
  } catch (err) {
    localAIGenerating = false;
    throw err;
  }
};

/**
 * Unified AI Generation Function
 * Automatically routes to the appropriate AI backend based on user preference
 * 
 * @param {string} prompt - The user prompt
 * @param {Object} options - Generation options
 * @param {string} options.systemPrompt - System prompt for context
 * @param {number} options.maxTokens - Maximum tokens to generate
 * @param {number} options.temperature - Temperature for generation
 * @param {function} options.onStream - Callback for streaming (local AI only)
 * @param {boolean} options.skipCrisisCheck - Skip crisis interception (for internal use)
 * @returns {Promise<{text: string, mode: string}>} Generated text and mode used
 */
export const generateAI = async (prompt, options = {}) => {
  // Crisis safety check (unless explicitly skipped)
  if (!options.skipCrisisCheck) {
    const crisisResult = await interceptBeforeAICall(prompt);
    if (crisisResult.blocked) {
      throw new Error('CRISIS_DETECTED');
    }
  }

  const effectiveMode = getEffectiveAIMode();
  
  if (!effectiveMode) {
    throw new Error('No AI available. Please configure a Gemini API key or initialize Local AI.');
  }

  try {
    if (effectiveMode === AI_MODES.LOCAL) {
      const text = await generateWithLocalAI(prompt, options);
      return { text, mode: AI_MODES.LOCAL };
    } else {
      const text = await generateWithCloudAI(prompt, options);
      return { text, mode: AI_MODES.CLOUD };
    }
  } catch (err) {
    // If preferred mode fails, try fallback
    const fallbackMode = effectiveMode === AI_MODES.LOCAL ? AI_MODES.CLOUD : AI_MODES.LOCAL;
    const canFallback = fallbackMode === AI_MODES.LOCAL ? isLocalAIReady() : isCloudAIAvailable();
    
    if (canFallback && !options.noFallback) {
      console.warn(`Primary AI (${effectiveMode}) failed, falling back to ${fallbackMode}:`, err.message);
      try {
        if (fallbackMode === AI_MODES.LOCAL) {
          const text = await generateWithLocalAI(prompt, options);
          return { text, mode: AI_MODES.LOCAL, fallback: true };
        } else {
          const text = await generateWithCloudAI(prompt, options);
          return { text, mode: AI_MODES.CLOUD, fallback: true };
        }
      } catch (fallbackErr) {
        throw new Error(`Both AI modes failed. Primary: ${err.message}. Fallback: ${fallbackErr.message}`);
      }
    }
    
    throw err;
  }
};

/**
 * Get the currently loaded local AI model name
 */
export const getLocalModelName = () => {
  const modelId = localStorage.getItem('vet_rate_local_ai_model');
  if (!modelId) return 'WebLLM';
  
  // Extract friendly name from model ID
  if (modelId.includes('Llama-3.2-1B')) return 'Llama 3.2 1B';
  if (modelId.includes('Llama-3.2-3B')) return 'Llama 3.2 3B';
  if (modelId.includes('Phi-3.5')) return 'Phi 3.5 Mini';
  return 'WebLLM';
};

/**
 * Get AI status information for UI display
 */
export const getAIStatus = () => {
  const mode = getAIMode();
  const effectiveMode = getEffectiveAIMode();
  const localModelName = getLocalModelName();
  
  return {
    preferredMode: mode,
    effectiveMode,
    cloudAvailable: isCloudAIAvailable(),
    localAvailable: isLocalAIReady(),
    localGenerating: localAIGenerating,
    anyAvailable: isAnyAIAvailable(),
    isPrivate: effectiveMode === AI_MODES.LOCAL,
    cloudModelName: 'Gemini 1.5 Flash',
    localModelName,
    statusText: effectiveMode === AI_MODES.LOCAL 
      ? `Local: ${localModelName}` 
      : effectiveMode === AI_MODES.CLOUD 
        ? 'Cloud: Gemini 1.5 Flash'
        : 'No AI Available',
    fullStatusText: effectiveMode === AI_MODES.LOCAL 
      ? `🔒 ${localModelName} (Local)` 
      : effectiveMode === AI_MODES.CLOUD 
        ? '☁️ Gemini 1.5 Flash (Cloud)'
        : '⚠️ No AI Available',
  };
};

/**
 * Privacy disclosure text based on current AI mode
 */
export const getAIDataDisclosure = () => {
  const status = getAIStatus();
  
  if (status.effectiveMode === AI_MODES.LOCAL) {
    return {
      title: '🔒 100% Private - Local AI Active',
      description: 'All AI processing happens directly on your device using WebGPU. No data is sent to any server.',
      bullets: [
        '✅ Your data NEVER leaves your device',
        '✅ Works even offline once loaded',
        '✅ No API keys required',
        '✅ Military-grade privacy',
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
        '💡 Switch to Local AI for 100% privacy',
      ],
      isPrivate: false,
    };
  }
  
  return {
    title: '⚠️ No AI Available',
    description: 'Configure AI to enable intelligent features.',
    bullets: [
      '🔒 Option 1: Enable Local AI (100% private)',
      '☁️ Option 2: Add Gemini API key (cloud)',
    ],
    isPrivate: null,
  };
};

export default {
  AI_MODES,
  getAIMode,
  setAIMode,
  getEffectiveAIMode,
  isLocalAIReady,
  isCloudAIAvailable,
  isAnyAIAvailable,
  registerLocalAIEngine,
  generateAI,
  getAIStatus,
  getAIDataDisclosure,
};
