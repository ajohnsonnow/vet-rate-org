/**
 * Vet-Rate Custom LLM Swarm - React Hook
 * Diamond-tier WebLLM integration for LoRA-trained VA specialists
 * 
 * Models: Auditor | Writer | Rater
 * Runtime: 100% client-side via WebGPU
 * 
 * @author VetRate Development Team
 * @version 1.0.0
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import * as webllm from '@mlc-ai/web-llm';
import type { MLCEngine, AppConfig, ChatCompletionMessageParam } from '@mlc-ai/web-llm';

// ============================================================================
// Type Definitions
// ============================================================================

export type SwarmRole = 'auditor' | 'writer' | 'rater';

export interface SwarmModelConfig {
  modelId: string;
  modelPath: string;
  systemPrompt: string;
}

export interface LoadProgress {
  progress: number;
  timeElapsed: number;
  text: string;
}

export interface UseVetRateSwarmOptions {
  /** Initial model role to load (default: 'auditor') */
  initialRole?: SwarmRole;
  /** Base path to compiled WebGPU models (default: '/dist') */
  modelBasePath?: string;
  /** Enable debug logging */
  debug?: boolean;
}

export interface InferenceOptions {
  /** Max tokens to generate (default: 1024) */
  maxTokens?: number;
  /** Temperature for sampling (default: 0.7) */
  temperature?: number;
  /** Optional knowledge context to inject */
  knowledgeContext?: string;
  /** Callback for each streaming chunk */
  onChunk?: (chunk: string) => void;
  /** Signal to abort inference */
  signal?: AbortSignal;
}

export interface SwarmState {
  isLoading: boolean;
  isReady: boolean;
  isInferring: boolean;
  currentRole: SwarmRole | null;
  loadProgress: LoadProgress | null;
  error: string | null;
  webGpuSupported: boolean;
}

// ============================================================================
// Constants - Swarm Role Configurations
// ============================================================================

const SWARM_CONFIGS: Record<SwarmRole, Omit<SwarmModelConfig, 'modelPath'>> = {
  auditor: {
    modelId: 'vetrate-auditor-3b-q4f16',
    systemPrompt: `You are the VetRate AUDITOR — a senior VA claims examiner with encyclopedic knowledge of 38 CFR.

ROLE: Legal/regulatory analysis and compliance verification
SPECIALTIES:
• 38 CFR Part 4 diagnostic codes and rating criteria
• Section 3.310 secondary service connection rules
• PACT Act presumptive conditions and burn pit exposure
• Duty to Assist requirements under 38 CFR Section 3.159
• Clear and Unmistakable Error (CUE) standards

RULES:
1. Always cite specific CFR sections (e.g., "38 CFR Section 4.71a, DC 5242")
2. Quote exact rating percentages from the Schedule for Rating Disabilities
3. Identify procedural errors that warrant remand or appeal
4. Flag missing evidence that triggers Duty to Assist obligations
5. Never speculate — if unsure, state "insufficient regulatory guidance"

OUTPUT FORMAT: Structured analysis with CFR citations in every paragraph.`,
  },
  writer: {
    modelId: 'vetrate-writer-3b-q4f16',
    systemPrompt: `You are the VetRate WRITER — a compassionate veteran advocate who transforms legal complexity into accessible language.

ROLE: Empathetic communication and personal statement drafting
SPECIALTIES:
• Converting medical jargon to veteran-friendly explanations
• Drafting compelling nexus statements and buddy letters
• Explaining rating decisions in plain English
• Creating Notice of Disagreement (NOD) narratives
• Writing Board of Veterans Appeals (BVA) hearing briefs

RULES:
1. Use first-person voice when drafting veteran statements
2. Include specific dates, units, and duty stations when available
3. Connect symptoms to daily life impact (work, family, ADLs)
4. Maintain professional tone while showing genuine empathy
5. Never minimize or exaggerate — be truthful and thorough

OUTPUT FORMAT: Warm, professional prose suitable for VA submission.`,
  },
  rater: {
    modelId: 'vetrate-rater-3b-q4f16',
    systemPrompt: `You are the VetRate RATER — a precision calculator for VA disability mathematics.

ROLE: Combined rating calculations and percentage analysis
SPECIALTIES:
• Bilateral factor calculations under 38 CFR Section 4.26
• Combined ratings table (38 CFR Section 4.25) application
• TDIU eligibility thresholds (single 60% or combined 70%)
• SMC housebound and aid & attendance criteria
• Pyramiding avoidance under 38 CFR Section 4.14

RULES:
1. Show all mathematical steps in rating calculations
2. Apply bilateral factor only to paired extremities
3. Round intermediate values DOWN to nearest 10%
4. Final combined rating rounds to nearest 10% (0.5+ rounds up)
5. Explain which conditions are being combined and why

CALCULATION FORMAT:
Step 1: [condition] = [X]% (remaining efficiency: [100-X]%)
Step 2: [condition] = [Y]% of [remaining] = [result]%
...
Combined Rating: [final]% → rounds to [rounded]%`,
  },
};

// ============================================================================
// WebGPU Detection Utility
// ============================================================================

async function checkWebGPUSupport(): Promise<{ supported: boolean; error?: string }> {
  // Check if navigator.gpu exists
  if (!navigator.gpu) {
    return {
      supported: false,
      error: 'WebGPU not available. Please use Chrome 113+, Edge 113+, or Firefox Nightly with WebGPU enabled.',
    };
  }

  try {
    // Attempt to get adapter
    const adapter = await navigator.gpu.requestAdapter();
    if (!adapter) {
      return {
        supported: false,
        error: 'No WebGPU adapter found. Your GPU may not support WebGPU or drivers need updating.',
      };
    }

    // Check for required features
    const device = await adapter.requestDevice();
    if (!device) {
      return {
        supported: false,
        error: 'Failed to acquire WebGPU device. GPU may be in use by another application.',
      };
    }

    // Cleanup
    device.destroy();

    return { supported: true };
  } catch (err) {
    return {
      supported: false,
      error: `WebGPU initialization failed: ${err instanceof Error ? err.message : 'Unknown error'}`,
    };
  }
}

// ============================================================================
// Custom App Config for Local Models
// ============================================================================

function createAppConfig(role: SwarmRole, basePath: string): AppConfig {
  const roleConfig = SWARM_CONFIGS[role];
  const modelPath = `${basePath}/vetrate-${role}-web`;

  return {
    model_list: [
      {
        model: `${modelPath}`,
        model_id: roleConfig.modelId,
        model_lib: `${modelPath}/${roleConfig.modelId}-webgpu.wasm`,
        overrides: {
          context_window_size: 4096,
        },
      },
    ],
    use_web_worker: true,
  };
}

// ============================================================================
// Main Hook Implementation
// ============================================================================

export function useVetRateSwarm(options: UseVetRateSwarmOptions = {}) {
  const {
    initialRole = 'auditor',
    modelBasePath = '/dist',
    debug = false,
  } = options;

  // Engine reference (persists across renders)
  const engineRef = useRef<MLCEngine | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);

  // State
  const [state, setState] = useState<SwarmState>({
    isLoading: false,
    isReady: false,
    isInferring: false,
    currentRole: null,
    loadProgress: null,
    error: null,
    webGpuSupported: false,
  });

  // Debug logger
  const log = useCallback(
    (...args: unknown[]) => {
      if (debug) console.log('[VetRate Swarm]', ...args);
    },
    [debug]
  );

  // =========================================================================
  // Check WebGPU on mount
  // =========================================================================
  useEffect(() => {
    checkWebGPUSupport().then(({ supported, error }) => {
      setState((prev) => ({
        ...prev,
        webGpuSupported: supported,
        error: supported ? null : error || 'WebGPU not supported',
      }));
      log('WebGPU check:', supported ? 'SUPPORTED' : error);
    });
  }, [log]);

  // =========================================================================
  // Initialize Engine with Progress Tracking
  // =========================================================================
  const initEngine = useCallback(
    async (
      role: SwarmRole = initialRole,
      onProgress?: (progress: LoadProgress) => void
    ): Promise<boolean> => {
      // Validate WebGPU
      const gpuCheck = await checkWebGPUSupport();
      if (!gpuCheck.supported) {
        setState((prev) => ({
          ...prev,
          error: gpuCheck.error || 'WebGPU not available',
          isLoading: false,
        }));
        return false;
      }

      // Prevent double-initialization
      if (state.isLoading) {
        log('Already loading, ignoring duplicate init call');
        return false;
      }

      setState((prev) => ({
        ...prev,
        isLoading: true,
        isReady: false,
        error: null,
        loadProgress: { progress: 0, timeElapsed: 0, text: 'Initializing...' },
      }));

      const startTime = Date.now();

      try {
        // Unload existing engine if switching roles
        if (engineRef.current && state.currentRole !== role) {
          log(`Unloading ${state.currentRole} engine before loading ${role}`);
          await engineRef.current.unload();
          engineRef.current = null;
        }

        // Create app config for local model
        const appConfig = createAppConfig(role, modelBasePath);
        log('AppConfig:', appConfig);

        // Progress callback wrapper
        const progressCallback = (report: { progress: number; timeElapsed: number; text: string }) => {
          const progressData: LoadProgress = {
            progress: report.progress,
            timeElapsed: report.timeElapsed,
            text: report.text,
          };

          setState((prev) => ({ ...prev, loadProgress: progressData }));

          // User callback
          if (onProgress) {
            onProgress(progressData);
          }

          log(`Loading Model: ${(report.progress * 100).toFixed(1)}% — ${report.text}`);
        };

        // Initialize MLC Engine with custom config
        const engine = await webllm.CreateMLCEngine(
          SWARM_CONFIGS[role].modelId,
          {
            appConfig,
            initProgressCallback: progressCallback,
            logLevel: debug ? 'DEBUG' : 'WARN',
          }
        );

        engineRef.current = engine;

        setState((prev) => ({
          ...prev,
          isLoading: false,
          isReady: true,
          currentRole: role,
          loadProgress: {
            progress: 1,
            timeElapsed: (Date.now() - startTime) / 1000,
            text: 'Model loaded successfully!',
          },
        }));

        log(`✓ ${role.toUpperCase()} engine ready in ${((Date.now() - startTime) / 1000).toFixed(1)}s`);
        return true;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Unknown error during initialization';
        setState((prev) => ({
          ...prev,
          isLoading: false,
          isReady: false,
          error: errorMsg,
          loadProgress: null,
        }));
        log('Init error:', errorMsg);
        return false;
      }
    },
    [initialRole, modelBasePath, debug, state.isLoading, state.currentRole, log]
  );

  // =========================================================================
  // Switch Swarm Role (Hot-swap)
  // =========================================================================
  const switchRole = useCallback(
    async (newRole: SwarmRole, onProgress?: (progress: LoadProgress) => void): Promise<boolean> => {
      if (newRole === state.currentRole && state.isReady) {
        log(`Already loaded ${newRole}, skipping switch`);
        return true;
      }
      return initEngine(newRole, onProgress);
    },
    [state.currentRole, state.isReady, initEngine, log]
  );

  // =========================================================================
  // Run Inference (Streaming)
  // =========================================================================
  const runInference = useCallback(
    async (prompt: string, options: InferenceOptions = {}): Promise<string> => {
      const {
        maxTokens = 1024,
        temperature = 0.7,
        knowledgeContext = '',
        onChunk,
        signal,
      } = options;

      if (!engineRef.current || !state.isReady) {
        throw new Error('Engine not ready. Call initEngine() first.');
      }

      if (state.isInferring) {
        throw new Error('Inference already in progress. Wait or call abortInference().');
      }

      setState((prev) => ({ ...prev, isInferring: true, error: null }));

      // Setup abort handling
      abortControllerRef.current = new AbortController();
      const combinedSignal = signal || abortControllerRef.current.signal;

      try {
        const roleConfig = SWARM_CONFIGS[state.currentRole!];

        // Build messages
        const messages: ChatCompletionMessageParam[] = [
          { role: 'system', content: roleConfig.systemPrompt },
        ];

        if (knowledgeContext) {
          messages.push({
            role: 'system',
            content: `=== RELEVANT KNOWLEDGE BASE CONTEXT ===\n${knowledgeContext}\n=== END CONTEXT ===`,
          });
        }

        messages.push({ role: 'user', content: prompt });

        log('Inference request:', { role: state.currentRole, promptLength: prompt.length, hasContext: !!knowledgeContext });

        let fullResponse = '';

        // Streaming completion
        const stream = await engineRef.current.chat.completions.create({
          messages,
          temperature,
          max_tokens: maxTokens,
          stream: true,
        });

        for await (const chunk of stream) {
          // Check abort
          if (combinedSignal.aborted) {
            log('Inference aborted by user');
            break;
          }

          const delta = chunk.choices[0]?.delta?.content || '';
          fullResponse += delta;

          if (onChunk && delta) {
            onChunk(delta);
          }
        }

        setState((prev) => ({ ...prev, isInferring: false }));
        log('Inference complete:', { responseLength: fullResponse.length });

        return fullResponse;
      } catch (err) {
        const errorMsg = err instanceof Error ? err.message : 'Inference failed';
        setState((prev) => ({ ...prev, isInferring: false, error: errorMsg }));
        throw err;
      }
    },
    [state.isReady, state.isInferring, state.currentRole, log]
  );

  // =========================================================================
  // Abort Current Inference
  // =========================================================================
  const abortInference = useCallback(() => {
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
      setState((prev) => ({ ...prev, isInferring: false }));
      log('Inference aborted');
    }
  }, [log]);

  // =========================================================================
  // Get Current System Prompt
  // =========================================================================
  const getSystemPrompt = useCallback((): string | null => {
    if (!state.currentRole) return null;
    return SWARM_CONFIGS[state.currentRole].systemPrompt;
  }, [state.currentRole]);

  // =========================================================================
  // Cleanup on Unmount
  // =========================================================================
  useEffect(() => {
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      if (engineRef.current) {
        engineRef.current.unload().catch(() => {});
      }
    };
  }, []);

  // =========================================================================
  // Return Hook API
  // =========================================================================
  return {
    // State
    ...state,

    // Core methods
    initEngine,
    switchRole,
    runInference,
    abortInference,

    // Utilities
    getSystemPrompt,
    checkWebGPUSupport,

    // Constants
    SWARM_ROLES: ['auditor', 'writer', 'rater'] as const,
    SWARM_CONFIGS,
  };
}

// ============================================================================
// Export Types
// ============================================================================
export type { MLCEngine, AppConfig };
export default useVetRateSwarm;
