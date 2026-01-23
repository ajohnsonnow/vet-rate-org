/**
 * useVetRateSwarm.ts
 * 
 * Diamond-tier React hook for WebLLM integration with VetRate LoRA Swarm models.
 * Provides hot-swappable LLM inference with browser-based GPU acceleration.
 * 
 * Features:
 * - WebGPU-accelerated inference (2GB models, 100% client-side)
 * - Hot-swapping between specialized swarm members (Auditor, Writer, Rater)
 * - Progress tracking during model loading
 * - Comprehensive error handling and recovery
 * - Conversation history management
 * - Streaming response support
 * 
 * @author VetRate.org Development Team
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { CreateMLCEngine, MLCEngine, InitProgressReport, ChatCompletionMessageParam } from '@mlc-ai/web-llm';

// ============================================================================
// TYPE DEFINITIONS
// ============================================================================

/**
 * Swarm member specializations
 */
export type SwarmMember = 'auditor' | 'writer' | 'rater';

/**
 * Model loading status
 */
export type LoadingStatus = 'idle' | 'loading' | 'ready' | 'error' | 'switching';

/**
 * Progress information during model loading
 */
export interface LoadingProgress {
  status: LoadingStatus;
  progress: number;        // 0-100
  text: string;            // Human-readable status
  timeElapsed: number;     // Milliseconds since start
  estimatedTimeRemaining?: number;  // Milliseconds (if available)
}

/**
 * Swarm member configuration
 */
export interface SwarmConfig {
  modelId: string;
  modelUrl: string;
  modelLibUrl: string;
  systemPrompt: string;
  displayName: string;
  description: string;
  expertise: string[];
  vramRequiredMB: number;
  contextWindow: number;
}

/**
 * Chat message
 */
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string;
  timestamp?: number;
}

/**
 * Generation configuration
 */
export interface GenerationConfig {
  temperature?: number;       // 0-2, default 0.7
  maxTokens?: number;         // Max output tokens, default 1000
  topP?: number;              // Nucleus sampling, default 0.95
  frequencyPenalty?: number;  // -2 to 2, default 0
  presencePenalty?: number;   // -2 to 2, default 0
  stream?: boolean;           // Enable streaming, default false
}

/**
 * Hook return type
 */
export interface UseVetRateSwarmReturn {
  // State
  currentSwarm: SwarmMember | null;
  loadingProgress: LoadingProgress;
  isReady: boolean;
  error: string | null;
  conversationHistory: ChatMessage[];
  
  // Actions
  initEngine: (swarmMember?: SwarmMember) => Promise<void>;
  switchSwarm: (swarmMember: SwarmMember) => Promise<void>;
  sendMessage: (message: string, config?: GenerationConfig) => Promise<string>;
  sendMessageStream: (message: string, onChunk: (chunk: string) => void, config?: GenerationConfig) => Promise<void>;
  clearHistory: () => void;
  resetEngine: () => Promise<void>;
  
  // Utilities
  getSwarmConfig: (swarmMember: SwarmMember) => SwarmConfig;
  isWebGPUSupported: () => boolean;
}

// ============================================================================
// SWARM CONFIGURATIONS
// ============================================================================

/**
 * Production swarm member configurations
 * Updated after MLC compilation in Step 5
 * 
 * NOTE: Models use HuggingFace fallback IDs. Custom LoRA models
 * can be served from /models/ path when deployed.
 */

// Fallback to stable HuggingFace models if custom models unavailable
const FALLBACK_MODEL_ID = 'Qwen2.5-1.5B-Instruct-q4f16_1-MLC';

const SWARM_CONFIGS: Record<SwarmMember, SwarmConfig> = {
  auditor: {
    // Custom model with HuggingFace fallback
    modelId: 'VetRate-Auditor-3B-q4f16_1',
    modelUrl: '/models/vetrate-auditor-web/',
    modelLibUrl: '/models/vetrate-auditor-web/VetRate-Auditor-3B-webgpu.wasm',
    displayName: 'VA Regulations Expert',
    description: 'Specialized in 38 CFR interpretation and rating calculations',
    expertise: [
      '38 CFR Part 4 diagnostic codes',
      'Combined ratings calculations',
      'Bilateral factor application',
      'Pyramiding regulations',
      'TDIU eligibility',
      'Special Monthly Compensation (SMC)'
    ],
    systemPrompt: `You are VetRate Auditor, a VA disability rating expert with deep knowledge of 38 CFR Part 4 (Schedule for Rating Disabilities).

Your expertise includes:
- Diagnostic code interpretation (DC 5000-9999)
- Combined ratings math (bilateral, pyramiding, TDIU)
- Regulatory precedents and M21-1 guidance
- Special Monthly Compensation (SMC) calculations

Always cite specific CFR sections (e.g., "38 CFR §4.25 for combined ratings"). Be precise with percentages and regulatory requirements.`,
    vramRequiredMB: 2500,
    contextWindow: 4096
  },
  
  writer: {
    modelId: 'VetRate-Writer-3B-q4f16_1',
    modelUrl: '/models/vetrate-writer-web/',
    modelLibUrl: '/models/vetrate-writer-web/VetRate-Writer-3B-webgpu.wasm',
    displayName: 'Veteran Advocacy Specialist',
    description: 'Expert in nexus letters and claim narrative development',
    expertise: [
      'Nexus letter composition',
      'Service connection arguments',
      'Medical evidence analysis',
      'Claim narrative structure',
      'Appeal brief writing',
      'DBQ interpretation'
    ],
    systemPrompt: `You are VetRate Writer, a veteran advocacy specialist focused on claim documentation and nexus letter composition.

Your expertise includes:
- Medical nexus letter writing (linking conditions to service)
- Claim narrative development with compelling evidence
- Personal statement guidance for veterans
- DBQ (Disability Benefits Questionnaire) interpretation
- Appeal brief structure and argumentation

Write in clear, professional language that demonstrates medical plausibility while advocating for veterans. Always emphasize evidence-based connections.`,
    vramRequiredMB: 2500,
    contextWindow: 4096
  },
  
  rater: {
    modelId: 'VetRate-Rater-3B-q4f16_1',
    modelUrl: '/models/vetrate-rater-web/',
    modelLibUrl: '/models/vetrate-rater-web/VetRate-Rater-3B-webgpu.wasm',
    displayName: 'Combined Rating Calculator',
    description: 'Specialized in multi-condition rating mathematics',
    expertise: [
      'Combined ratings formula',
      'Bilateral factor calculations',
      'Pyramiding prevention',
      'TDIU threshold analysis',
      'SMC calculation logic',
      'Dependency allowances'
    ],
    systemPrompt: `You are VetRate Rater, a combined rating calculation specialist with expertise in VA math.

Your expertise includes:
- Combined ratings formula (VA Table or iterative calculation)
- Bilateral factor for paired body parts (DC 5061)
- Pyramiding rules (38 CFR §4.14)
- TDIU eligibility (38 CFR §4.16)
- Special Monthly Compensation (38 CFR §3.350)

Always show your work step-by-step. Cite the specific regulation for each calculation (e.g., "Per 38 CFR §4.25, combined value = ...").`,
    vramRequiredMB: 2500,
    contextWindow: 4096
  }
};

// ============================================================================
// UTILITY FUNCTIONS
// ============================================================================

/**
 * Check if WebGPU is supported in the current browser
 */
const checkWebGPUSupport = (): boolean => {
  if (typeof navigator === 'undefined') {
    return false;
  }
  return 'gpu' in navigator;
};

/**
 * Estimate remaining time based on progress
 */
const estimateRemainingTime = (
  progress: number, 
  timeElapsed: number
): number | undefined => {
  if (progress <= 0 || progress >= 100) {
    return undefined;
  }
  const estimatedTotal = (timeElapsed / progress) * 100;
  return Math.max(0, estimatedTotal - timeElapsed);
};

/**
 * Format milliseconds to human-readable string
 */
const formatTime = (ms: number): string => {
  const seconds = Math.floor(ms / 1000);
  if (seconds < 60) {
    return `${seconds}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}m ${remainingSeconds}s`;
};

// ============================================================================
// MAIN HOOK
// ============================================================================

/**
 * useVetRateSwarm - React hook for WebLLM swarm integration
 * 
 * @example
 * ```tsx
 * function MyComponent() {
 *   const {
 *     initEngine,
 *     sendMessage,
 *     loadingProgress,
 *     isReady
 *   } = useVetRateSwarm();
 * 
 *   useEffect(() => {
 *     initEngine('auditor');
 *   }, []);
 * 
 *   const handleSubmit = async (userMessage: string) => {
 *     const response = await sendMessage(userMessage);
 *     console.log('AI:', response);
 *   };
 * 
 *   return (
 *     <div>
 *       {!isReady && (
 *         <div>Loading: {loadingProgress.text} ({loadingProgress.progress}%)</div>
 *       )}
 *       {isReady && <ChatInterface onSubmit={handleSubmit} />}
 *     </div>
 *   );
 * }
 * ```
 */
export const useVetRateSwarm = (): UseVetRateSwarmReturn => {
  // ============================================================================
  // STATE
  // ============================================================================
  
  const [currentSwarm, setCurrentSwarm] = useState<SwarmMember | null>(null);
  const [loadingProgress, setLoadingProgress] = useState<LoadingProgress>({
    status: 'idle',
    progress: 0,
    text: 'Not initialized',
    timeElapsed: 0
  });
  const [error, setError] = useState(null);
  const [conversationHistory, setConversationHistory] = useState<ChatMessage[]>([]);
  
  // Refs for engine and timers
  const engineRef = useRef<MLCEngine | null>(null);
  const loadingStartTimeRef = useRef<number>(0);
  const loadingIntervalRef = useRef(null);
  
  // Derived state
  const isReady = loadingProgress.status === 'ready';
  
  // ============================================================================
  // CLEANUP
  // ============================================================================
  
  useEffect(() => {
    return () => {
      // Cleanup on unmount
      if (loadingIntervalRef.current) {
        clearInterval(loadingIntervalRef.current);
      }
      if (engineRef.current) {
        engineRef.current.unload().catch(console.error);
      }
    };
  }, []);
  
  // ============================================================================
  // PROGRESS TRACKING
  // ============================================================================
  
  /**
   * Start tracking loading time
   */
  const startLoadingTimer = useCallback(() => {
    loadingStartTimeRef.current = Date.now();
    
    // Update elapsed time every 100ms
    loadingIntervalRef.current = setInterval(() => {
      const elapsed = Date.now() - loadingStartTimeRef.current;
      setLoadingProgress(prev => ({
        ...prev,
        timeElapsed: elapsed,
        estimatedTimeRemaining: estimateRemainingTime(prev.progress, elapsed)
      }));
    }, 100);
  }, []);
  
  /**
   * Stop tracking loading time
   */
  const stopLoadingTimer = useCallback(() => {
    if (loadingIntervalRef.current) {
      clearInterval(loadingIntervalRef.current);
      loadingIntervalRef.current = null;
    }
  }, []);
  
  /**
   * Progress callback for WebLLM initialization
   */
  const handleInitProgress = useCallback((report: InitProgressReport) => {
    const progress = Math.round(report.progress * 100);
    
    setLoadingProgress(prev => ({
      ...prev,
      progress,
      text: report.text,
      estimatedTimeRemaining: estimateRemainingTime(progress, prev.timeElapsed)
    }));
  }, []);
  
  // ============================================================================
  // ENGINE INITIALIZATION
  // ============================================================================
  
  /**
   * Initialize WebLLM engine with specified swarm member
   * 
   * @param swarmMember - Which swarm to load (defaults to 'auditor')
   * @throws Error if WebGPU not supported or initialization fails
   */
  const initEngine = useCallback(async (swarmMember: SwarmMember = 'auditor') => {
    try {
      setError(null);
      setLoadingProgress({
        status: 'loading',
        progress: 0,
        text: 'Initializing...',
        timeElapsed: 0
      });
      
      // Check WebGPU support
      if (!checkWebGPUSupport()) {
        throw new Error(
          'WebGPU not supported. Please use Chrome 113+ or Edge 113+ with hardware acceleration enabled.'
        );
      }
      
      // Get configuration
      const config = SWARM_CONFIGS[swarmMember];
      if (!config) {
        throw new Error(`Unknown swarm member: ${swarmMember}`);
      }
      
      startLoadingTimer();
      
      // Create engine with fallback support
      let engine: MLCEngine;
      let usedFallback = false;
      
      try {
        // Try custom VetRate model first
        engine = await CreateMLCEngine(
          config.modelId,
          {
            initProgressCallback: handleInitProgress,
            logLevel: 'WARN'
          }
        );
      } catch (primaryError) {
        // Fallback to stable HuggingFace model
        console.warn(`⚠️ Custom model ${config.modelId} unavailable, using fallback`);
        usedFallback = true;
        engine = await CreateMLCEngine(
          FALLBACK_MODEL_ID,
          {
            initProgressCallback: handleInitProgress,
            logLevel: 'WARN'
          }
        );
      }
      
      engineRef.current = engine;
      setCurrentSwarm(swarmMember);
      
      // Initialize conversation with system prompt
      setConversationHistory([
        {
          role: 'system',
          content: config.systemPrompt,
          timestamp: Date.now()
        }
      ]);
      
      stopLoadingTimer();
      setLoadingProgress(prev => ({
        ...prev,
        status: 'ready',
        progress: 100,
        text: usedFallback 
          ? `${config.displayName} ready (fallback mode)`
          : `${config.displayName} ready`
      }));
      
      console.log(`✅ VetRate Swarm initialized: ${config.displayName}${usedFallback ? ' (fallback)' : ''}`);
      
    } catch (err) {
      stopLoadingTimer();
      const errorMessage = err instanceof Error ? err.message : 'Unknown initialization error';
      setError(errorMessage);
      setLoadingProgress(prev => ({
        ...prev,
        status: 'error',
        text: 'Initialization failed'
      }));
      console.error('❌ Engine initialization failed:', err);
      throw err;
    }
  }, [handleInitProgress, startLoadingTimer, stopLoadingTimer]);
  
  // ============================================================================
  // SWARM SWITCHING
  // ============================================================================
  
  /**
   * Hot-swap to a different swarm member
   * 
   * @param swarmMember - Target swarm to switch to
   * @throws Error if switch fails
   */
  const switchSwarm = useCallback(async (swarmMember: SwarmMember) => {
    if (!engineRef.current) {
      throw new Error('Engine not initialized. Call initEngine() first.');
    }
    
    if (currentSwarm === swarmMember) {
      console.log(`Already using ${swarmMember} swarm`);
      return;
    }
    
    try {
      setError(null);
      setLoadingProgress({
        status: 'switching',
        progress: 0,
        text: 'Switching swarm member...',
        timeElapsed: 0
      });
      
      const config = SWARM_CONFIGS[swarmMember];
      if (!config) {
        throw new Error(`Unknown swarm member: ${swarmMember}`);
      }
      
      startLoadingTimer();
      
      // Unload current model
      await engineRef.current.unload();
      
      // Reload with new model
      await engineRef.current.reload(
        config.modelId,
        {
          initProgressCallback: handleInitProgress
        }
      );
      
      setCurrentSwarm(swarmMember);
      
      // Update conversation with new system prompt
      setConversationHistory(prev => [
        {
          role: 'system',
          content: config.systemPrompt,
          timestamp: Date.now()
        },
        ...prev.slice(1) // Keep previous conversation (optional)
      ]);
      
      stopLoadingTimer();
      setLoadingProgress(prev => ({
        ...prev,
        status: 'ready',
        progress: 100,
        text: `Switched to ${config.displayName}`
      }));
      
      console.log(`✅ Switched to: ${config.displayName}`);
      
    } catch (err) {
      stopLoadingTimer();
      const errorMessage = err instanceof Error ? err.message : 'Unknown switch error';
      setError(errorMessage);
      setLoadingProgress(prev => ({
        ...prev,
        status: 'error',
        text: 'Switch failed'
      }));
      console.error('❌ Swarm switch failed:', err);
      throw err;
    }
  }, [currentSwarm, handleInitProgress, startLoadingTimer, stopLoadingTimer]);
  
  // ============================================================================
  // MESSAGING
  // ============================================================================
  
  /**
   * Send message to current swarm and get response
   * 
   * @param message - User message
   * @param config - Generation configuration (optional)
   * @returns AI response text
   * @throws Error if engine not ready or generation fails
   */
  const sendMessage = useCallback(async (
    message: string,
    config: GenerationConfig = {}
  ): Promise<string> => {
    if (!engineRef.current) {
      throw new Error('Engine not initialized. Call initEngine() first.');
    }
    
    if (loadingProgress.status !== 'ready') {
      throw new Error('Engine not ready. Wait for initialization to complete.');
    }
    
    try {
      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => [...prev, userMessage]);
      
      // Prepare messages for API
      const messages: ChatCompletionMessageParam[] = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      messages.push({ role: 'user', content: message });
      
      // Generate response
      const response = await engineRef.current.chat.completions.create({
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
        top_p: config.topP ?? 0.95,
        frequency_penalty: config.frequencyPenalty ?? 0,
        presence_penalty: config.presencePenalty ?? 0,
        stream: false
      });
      
      const assistantMessage = response.choices[0]?.message?.content || '';
      
      // Add assistant response to history
      setConversationHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: assistantMessage,
          timestamp: Date.now()
        }
      ]);
      
      return assistantMessage;
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Message generation failed';
      setError(errorMessage);
      console.error('❌ Message generation failed:', err);
      throw err;
    }
  }, [loadingProgress.status, conversationHistory]);
  
  /**
   * Send message with streaming response
   * 
   * @param message - User message
   * @param onChunk - Callback for each token/chunk
   * @param config - Generation configuration (optional)
   * @throws Error if engine not ready or generation fails
   */
  const sendMessageStream = useCallback(async (
    message: string,
    onChunk: (chunk: string) => void,
    config: GenerationConfig = {}
  ): Promise<void> => {
    if (!engineRef.current) {
      throw new Error('Engine not initialized. Call initEngine() first.');
    }
    
    if (loadingProgress.status !== 'ready') {
      throw new Error('Engine not ready. Wait for initialization to complete.');
    }
    
    try {
      // Add user message to history
      const userMessage: ChatMessage = {
        role: 'user',
        content: message,
        timestamp: Date.now()
      };
      
      setConversationHistory(prev => [...prev, userMessage]);
      
      // Prepare messages for API
      const messages: ChatCompletionMessageParam[] = conversationHistory.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      messages.push({ role: 'user', content: message });
      
      // Generate streaming response
      const stream = await engineRef.current.chat.completions.create({
        messages,
        temperature: config.temperature ?? 0.7,
        max_tokens: config.maxTokens ?? 1000,
        top_p: config.topP ?? 0.95,
        frequency_penalty: config.frequencyPenalty ?? 0,
        presence_penalty: config.presencePenalty ?? 0,
        stream: true
      });
      
      let fullResponse = '';
      
      // Process stream
      for await (const chunk of stream) {
        const content = chunk.choices[0]?.delta?.content || '';
        if (content) {
          fullResponse += content;
          onChunk(content);
        }
      }
      
      // Add complete response to history
      setConversationHistory(prev => [
        ...prev,
        {
          role: 'assistant',
          content: fullResponse,
          timestamp: Date.now()
        }
      ]);
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Streaming generation failed';
      setError(errorMessage);
      console.error('❌ Streaming generation failed:', err);
      throw err;
    }
  }, [loadingProgress.status, conversationHistory]);
  
  // ============================================================================
  // UTILITIES
  // ============================================================================
  
  /**
   * Clear conversation history
   */
  const clearHistory = useCallback(() => {
    if (currentSwarm) {
      const config = SWARM_CONFIGS[currentSwarm];
      setConversationHistory([
        {
          role: 'system',
          content: config.systemPrompt,
          timestamp: Date.now()
        }
      ]);
    } else {
      setConversationHistory([]);
    }
  }, [currentSwarm]);
  
  /**
   * Reset engine (unload and reinitialize)
   */
  const resetEngine = useCallback(async () => {
    if (engineRef.current) {
      await engineRef.current.unload();
      engineRef.current = null;
    }
    
    setCurrentSwarm(null);
    setConversationHistory([]);
    setError(null);
    setLoadingProgress({
      status: 'idle',
      progress: 0,
      text: 'Not initialized',
      timeElapsed: 0
    });
    
    if (currentSwarm) {
      await initEngine(currentSwarm);
    }
  }, [currentSwarm, initEngine]);
  
  /**
   * Get configuration for a swarm member
   */
  const getSwarmConfig = useCallback((swarmMember: SwarmMember): SwarmConfig => {
    return SWARM_CONFIGS[swarmMember];
  }, []);
  
  /**
   * Check if WebGPU is supported
   */
  const isWebGPUSupported = useCallback((): boolean => {
    return checkWebGPUSupport();
  }, []);
  
  // ============================================================================
  // RETURN
  // ============================================================================
  
  return {
    // State
    currentSwarm,
    loadingProgress,
    isReady,
    error,
    conversationHistory,
    
    // Actions
    initEngine,
    switchSwarm,
    sendMessage,
    sendMessageStream,
    clearHistory,
    resetEngine,
    
    // Utilities
    getSwarmConfig,
    isWebGPUSupported
  };
};

// ============================================================================
// EXPORT DEFAULT
// ============================================================================

export default useVetRateSwarm;
