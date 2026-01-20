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

// Check WebGPU support with better browser compatibility
const checkWebGPUSupport = async () => {
  if (!navigator.gpu) {
    return { supported: false, reason: 'WebGPU not available in this browser. Try Chrome 113+, Edge 113+, or Firefox Nightly.' };
  }
  
  try {
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return { supported: false, reason: 'No WebGPU adapter found (GPU may not be compatible)' };
    }
    
    // Request device to verify full support
    const device = await adapter.requestDevice();
    
    // Get adapter info with fallback for older browser versions
    let adapterInfo = { vendor: 'Unknown', architecture: 'Unknown', device: 'Unknown GPU', description: '' };
    
    try {
      // Modern browsers (Chrome 121+)
      if (typeof adapter.requestAdapterInfo === 'function') {
        adapterInfo = await adapter.requestAdapterInfo();
      } 
      // Fallback: Try direct property access (older implementations)
      else if (adapter.info) {
        adapterInfo = adapter.info;
      }
      // Some browsers expose it as a getter
      else if (adapter.features && adapter.limits) {
        // At minimum, we know it works
        adapterInfo = { vendor: 'WebGPU Compatible', device: 'GPU Detected', description: 'WebGPU is functional' };
      }
    } catch (infoErr) {
      // adapter.requestAdapterInfo might throw in some browsers - that's okay
      console.log('Could not get detailed adapter info, but WebGPU is available');
      adapterInfo = { vendor: 'WebGPU Compatible', device: 'GPU Detected', description: 'WebGPU is functional' };
    }
    
    return {
      supported: true,
      adapter: adapterInfo,
      vendor: adapterInfo.vendor || 'Unknown',
      device: adapterInfo.device || adapterInfo.description || 'Unknown GPU',
    };
  } catch (err) {
    return { supported: false, reason: `WebGPU initialization failed: ${err.message}` };
  }
};

// Available models (smallest to largest)
// Note: These model IDs must match exactly what's in @mlc-ai/web-llm's prebuiltAppConfig
const AVAILABLE_MODELS = [
  {
    id: 'Llama-3.2-1B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 1B (Fastest)',
    size: '0.7 GB',
    description: 'Ultra-fast, good for simple queries',
    contextInfo: 'Best for: Quick questions and small documents',
    vramRequired: '2 GB',
    recommended: false,
  },
  {
    id: 'Llama-3.2-3B-Instruct-q4f32_1-MLC',
    name: 'Llama 3.2 3B (Balanced)',
    size: '1.8 GB',
    description: 'Good balance of speed and quality',
    contextInfo: 'Best for: Most tasks, including medium-sized medical records',
    vramRequired: '4 GB',
    recommended: true,
  },
  {
    id: 'Phi-3.5-mini-instruct-q4f32_1-MLC',
    name: 'Phi 3.5 Mini (Specialized)',
    size: '2.3 GB',
    description: 'Microsoft model, great for reasoning',
    contextInfo: 'Best for: Detailed analysis, but splits large documents automatically',
    vramRequired: '4 GB',
    recommended: false,
  },
  {
    id: 'Mistral-7B-Instruct-v0.3-q4f32_1-MLC',
    name: 'Mistral 7B (Powerful)',
    size: '4.1 GB',
    description: 'High quality, requires more VRAM',
    contextInfo: 'Best for: Complex analysis and longer documents',
    vramRequired: '8 GB',
    recommended: false,
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
  
  // Engine state
  const [engine, setEngine] = useState(null);
  const [loadedModelId, setLoadedModelId] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ progress: 0, text: '' });
  const [isReady, setIsReady] = useState(false);
  const [error, setError] = useState(null);
  
  // Chat state
  const [isGenerating, setIsGenerating] = useState(false);

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
      
      // Register with unified AI service for seamless integration
      registerLocalAIEngine(mlcEngine, true);
      
      // Save preference
      localStorage.setItem('vet_rate_local_ai_model', modelId);
      
      return mlcEngine;
    } catch (err) {
      console.error('Failed to initialize local AI:', err);
      setError(err.message || 'Failed to initialize local AI');
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

    const {
      systemPrompt = 'You are a helpful assistant specializing in VA disability claims and veteran benefits. Provide accurate, helpful information.',
      maxTokens = 1024,
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
          
          // Check if generation was stopped
          if (!isGenerating) {
            break;
          }
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
    initializeEngine,
    generate,
    interruptGeneration,
    switchModel,
  } = useLocalAI();

  const [testPrompt, setTestPrompt] = useState('');
  const [testResponse, setTestResponse] = useState('');
  const [streamedResponse, setStreamedResponse] = useState('');

  // Handle test generation
  const handleTestGenerate = async () => {
    if (!testPrompt.trim()) return;
    
    setStreamedResponse('');
    setTestResponse('');
    
    try {
      await generate(testPrompt, {
        onStream: (delta, full) => {
          setStreamedResponse(full);
        },
      });
      setTestResponse(streamedResponse);
    } catch (err) {
      setTestResponse(`Error: ${err.message}`);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 overflow-y-auto">
      <div className="min-h-screen px-4 py-8">
        <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl shadow-2xl max-w-3xl mx-auto border border-gray-700">
          {/* Header */}
          <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-cyan-600 text-white px-6 py-6 rounded-t-2xl relative overflow-hidden">
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
          <div className="p-6 space-y-6">
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
                <div>
                  <h3 className={`font-bold ${
                    webGPUStatus.supported ? 'text-green-400' : 'text-red-400'
                  }`}>
                    {webGPUStatus.supported ? 'WebGPU Available' : 'WebGPU Not Available'}
                  </h3>
                  {webGPUStatus.supported ? (
                    <p className="text-gray-400 text-sm">
                      GPU: {webGPUStatus.device} ({webGPUStatus.vendor})
                    </p>
                  ) : (
                    <p className="text-red-400/80 text-sm">
                      {webGPUStatus.reason || 'Your browser or device does not support WebGPU'}
                    </p>
                  )}
                </div>
              </div>
            </div>

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

                    {/* Test Input */}
                    <div className="space-y-3">
                      <textarea
                        value={testPrompt}
                        onChange={(e) => setTestPrompt(e.target.value)}
                        placeholder="Test the local AI... e.g., 'What evidence do I need for a PTSD claim?'"
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
          <div className="px-6 py-4 bg-gray-800/50 rounded-b-2xl border-t border-gray-700">
            <div className="flex items-center justify-center gap-2 text-xs text-gray-500">
              <span>🔒</span>
              <span>Military-grade privacy: Your data never leaves your device</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default LocalAIPanel;
