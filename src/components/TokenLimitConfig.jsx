/**
 * Token Limit Configuration Component
 * Allows users to adjust max token limits for LLM responses
 * with presets and warnings about capabilities and VRAM requirements
 */

import React, { useState, useEffect } from 'react';
import { getAIStatus } from '../utils/unifiedAIService';

// Storage keys
const TOKEN_LIMIT_KEY = 'vetrate_token_limit_config';

// Preset configurations with detailed info
const TOKEN_PRESETS = {
  MIN: {
    value: 512,
    label: 'Minimum (512)',
    description: 'Quick, short responses',
    cloudNote: 'Fastest responses, lowest cost',
    localNote: 'Uses minimal VRAM (~0.5 GB extra)',
    useCase: 'Simple questions, brief answers',
    recommended: false,
  },
  MID: {
    value: 2048,
    label: 'Balanced (2,048)',
    description: 'Good for most tasks',
    cloudNote: 'Standard quality responses',
    localNote: 'Moderate VRAM usage (~2 GB extra)',
    useCase: 'Detailed statements, medical analysis',
    recommended: true,
  },
  MAX: {
    value: 4096,
    label: 'Maximum (4,096)',
    description: 'Longest, most detailed responses',
    cloudNote: 'Higher costs, slower responses',
    localNote: 'High VRAM usage (~4 GB extra)',
    useCase: 'Complex analysis, comprehensive reports',
    recommended: false,
  },
};

// Model-specific capabilities and warnings
const MODEL_CAPABILITIES = {
  // Cloud AI (Gemini)
  'gemini-2.5-flash': {
    name: 'Google Gemini 2.5 Flash',
    maxContext: 1000000, // 1M tokens
    recommendedMax: 8192,
    absoluteMax: 8192, // API limit
    warnings: {
      512: null,
      2048: null,
      4096: 'Higher token counts increase API costs and response time.',
      8192: '⚠️ Maximum limit. Responses may be slower and more expensive.',
    },
    vramImpact: 'N/A - Cloud Processing',
  },
  
  // Local AI Models
  'Llama-3.2-1B-Instruct-q4f32_1-MLC': {
    name: 'Llama 3.2 1B (Fastest)',
    maxContext: 8192,
    recommendedMax: 2048,
    absoluteMax: 4096,
    warnings: {
      512: null,
      2048: 'Good balance for this model.',
      4096: '⚠️ May slow down significantly on lower-end devices.',
      8192: '🚫 Not recommended - will likely fail or timeout on most devices.',
    },
    vramImpact: {
      512: '+0.5 GB',
      2048: '+1 GB',
      4096: '+2 GB',
      8192: '+3 GB (Not recommended)',
    },
  },
  
  'Llama-3.2-3B-Instruct-q4f32_1-MLC': {
    name: 'Llama 3.2 3B (Balanced)',
    maxContext: 8192,
    recommendedMax: 2048,
    absoluteMax: 4096,
    warnings: {
      512: null,
      2048: 'Recommended for this model.',
      4096: '⚠️ Requires strong GPU. May cause slowdowns.',
      8192: '🚫 Not recommended - requires high-end GPU with 8+ GB VRAM.',
    },
    vramImpact: {
      512: '+1 GB',
      2048: '+2 GB',
      4096: '+3 GB',
      8192: '+5 GB (Requires high-end GPU)',
    },
  },
  
  'Phi-3.5-mini-instruct-q4f32_1-MLC': {
    name: 'Phi 3.5 Mini',
    maxContext: 4096,
    recommendedMax: 2048,
    absoluteMax: 4096,
    warnings: {
      512: null,
      2048: 'Recommended. Good quality responses.',
      4096: '⚠️ Maximum for this model. May be slower.',
      8192: '🚫 Exceeds model capacity - will be capped at 4,096.',
    },
    vramImpact: {
      512: '+1 GB',
      2048: '+2 GB',
      4096: '+3 GB',
      8192: 'N/A - Model limit is 4,096',
    },
  },
  
  'Mistral-7B-Instruct-v0.3-q4f32_1-MLC': {
    name: 'Mistral 7B (Powerful)',
    maxContext: 32768,
    recommendedMax: 4096,
    absoluteMax: 8192,
    warnings: {
      512: 'Underutilizing this powerful model.',
      2048: 'Good for most tasks.',
      4096: 'Recommended maximum for reliable performance.',
      8192: '⚠️ High VRAM required. Only use with 8+ GB VRAM GPU.',
    },
    vramImpact: {
      512: '+2 GB',
      2048: '+3 GB',
      4096: '+4 GB',
      8192: '+6 GB (Requires high-end GPU)',
    },
  },
};

/**
 * Get default token limit from storage or use balanced preset
 */
export const getTokenLimit = () => {
  try {
    const stored = localStorage.getItem(TOKEN_LIMIT_KEY);
    if (stored) {
      const config = JSON.parse(stored);
      return config.value || TOKEN_PRESETS.MID.value;
    }
  } catch (e) {
    console.warn('Error loading token limit config:', e);
  }
  return TOKEN_PRESETS.MID.value;
};

/**
 * Save token limit to storage
 */
export const saveTokenLimit = (value) => {
  try {
    localStorage.setItem(TOKEN_LIMIT_KEY, JSON.stringify({ value, timestamp: Date.now() }));
  } catch (e) {
    console.error('Error saving token limit:', e);
  }
};

/**
 * TokenLimitConfig Component
 */
const TokenLimitConfig = () => {
  const [tokenLimit, setTokenLimit] = useState(getTokenLimit());
  const [customValue, setCustomValue] = useState('');
  const [isCustom, setIsCustom] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  
  // Update AI status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 500);
    return () => clearInterval(interval);
  }, []);
  
  // Determine current model
  const getCurrentModel = () => {
    if (aiStatus.effectiveMode === 'local') {
      const modelId = localStorage.getItem('vet_rate_local_ai_model') || 'Llama-3.2-3B-Instruct-q4f32_1-MLC';
      return MODEL_CAPABILITIES[modelId] || MODEL_CAPABILITIES['Llama-3.2-3B-Instruct-q4f32_1-MLC'];
    }
    return MODEL_CAPABILITIES['gemini-2.5-flash'];
  };
  
  const currentModel = getCurrentModel();
  
  // Get warning for current token limit
  const getCurrentWarning = () => {
    if (!currentModel.warnings) return null;
    
    // Find closest warning threshold
    const thresholds = Object.keys(currentModel.warnings).map(Number).sort((a, b) => a - b);
    let closestThreshold = thresholds[0];
    for (const threshold of thresholds) {
      if (tokenLimit >= threshold) {
        closestThreshold = threshold;
      }
    }
    return currentModel.warnings[closestThreshold];
  };
  
  // Get VRAM impact
  const getVRAMImpact = () => {
    if (aiStatus.effectiveMode !== 'local') {
      return currentModel.vramImpact;
    }
    
    if (typeof currentModel.vramImpact === 'string') {
      return currentModel.vramImpact;
    }
    
    // Find closest VRAM threshold
    const thresholds = Object.keys(currentModel.vramImpact).map(Number).sort((a, b) => a - b);
    let closestThreshold = thresholds[0];
    for (const threshold of thresholds) {
      if (tokenLimit >= threshold) {
        closestThreshold = threshold;
      }
    }
    return currentModel.vramImpact[closestThreshold];
  };
  
  // Handle preset selection
  const handlePresetSelect = (preset) => {
    const value = TOKEN_PRESETS[preset].value;
    setTokenLimit(value);
    saveTokenLimit(value);
    setIsCustom(false);
    setCustomValue('');
  };
  
  // Handle custom value change
  const handleCustomChange = (e) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    setCustomValue(value);
  };
  
  // Apply custom value
  const handleCustomApply = () => {
    const value = parseInt(customValue, 10);
    if (value && value >= 128 && value <= currentModel.absoluteMax) {
      setTokenLimit(value);
      saveTokenLimit(value);
      setIsCustom(true);
    }
  };
  
  // Check if value exceeds model capacity
  const exceedsCapacity = tokenLimit > currentModel.maxContext;
  const exceedsRecommended = tokenLimit > currentModel.recommendedMax;
  
  const warning = getCurrentWarning();
  const vramImpact = getVRAMImpact();
  
  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎚️</span>
          <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100">
            Response Length (Tokens)
          </h3>
        </div>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className="text-sm text-purple-600 dark:text-purple-400 hover:underline"
        >
          {showAdvanced ? 'Hide Details' : 'Show Details'}
        </button>
      </div>
      
      {/* Current Model Info */}
      <div className="bg-gray-100 dark:bg-gray-800 rounded-lg p-3 border border-gray-300 dark:border-gray-700">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-gray-900 dark:text-gray-100">
              Current Model: {currentModel.name}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
              Context Window: {currentModel.maxContext.toLocaleString()} tokens
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold text-purple-600 dark:text-purple-400">
              {tokenLimit.toLocaleString()}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-400">tokens</p>
          </div>
        </div>
      </div>
      
      {/* Preset Buttons */}
      <div className="grid grid-cols-3 gap-2">
        {Object.entries(TOKEN_PRESETS).map(([key, preset]) => {
          const isSelected = !isCustom && tokenLimit === preset.value;
          return (
            <button
              key={key}
              onClick={() => handlePresetSelect(key)}
              className={`p-3 rounded-lg border-2 transition-all ${
                isSelected
                  ? 'border-purple-600 bg-purple-50 dark:bg-purple-900/30'
                  : 'border-gray-300 dark:border-gray-700 hover:border-purple-400 dark:hover:border-purple-600'
              }`}
            >
              <div className="text-center">
                <p className={`text-sm font-bold ${
                  isSelected 
                    ? 'text-purple-700 dark:text-purple-300' 
                    : 'text-gray-900 dark:text-gray-100'
                }`}>
                  {preset.label}
                </p>
                {preset.recommended && (
                  <span className="text-xs bg-green-500 text-white px-2 py-0.5 rounded-full mt-1 inline-block">
                    ⭐ Recommended
                  </span>
                )}
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {preset.description}
                </p>
              </div>
            </button>
          );
        })}
      </div>
      
      {/* Custom Input */}
      <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg p-3">
        <div className="flex items-center gap-2 mb-2">
          <span className="text-lg">⚙️</span>
          <p className="text-sm font-semibold text-amber-900 dark:text-amber-200">
            Custom Token Limit (Advanced)
          </p>
        </div>
        <div className="flex gap-2">
          <input
            type="text"
            value={customValue}
            onChange={handleCustomChange}
            placeholder={`128 - ${currentModel.absoluteMax}`}
            className="flex-1 px-3 py-2 text-sm border border-amber-300 dark:border-amber-700 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100"
          />
          <button
            onClick={handleCustomApply}
            disabled={!customValue || parseInt(customValue, 10) < 128 || parseInt(customValue, 10) > currentModel.absoluteMax}
            className="px-4 py-2 bg-amber-500 hover:bg-amber-600 disabled:bg-gray-400 text-white rounded-lg font-semibold text-sm transition-colors"
          >
            Apply
          </button>
        </div>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-2">
          💡 Range: 128 - {currentModel.absoluteMax.toLocaleString()} tokens. Use presets unless you have specific needs.
        </p>
      </div>
      
      {/* Warnings and VRAM Info */}
      {(warning || exceedsRecommended || exceedsCapacity) && (
        <div className={`rounded-lg p-4 border-2 ${
          exceedsCapacity
            ? 'bg-red-50 dark:bg-red-900/20 border-red-500 dark:border-red-700'
            : exceedsRecommended
              ? 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-500 dark:border-yellow-700'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-500 dark:border-blue-700'
        }`}>
          <div className="flex items-start gap-3">
            <span className="text-2xl">
              {exceedsCapacity ? '🚫' : exceedsRecommended ? '⚠️' : 'ℹ️'}
            </span>
            <div>
              {exceedsCapacity && (
                <p className="text-red-800 dark:text-red-200 font-bold mb-2">
                  ⛔ Exceeds Model Capacity
                </p>
              )}
              {exceedsRecommended && !exceedsCapacity && (
                <p className="text-yellow-800 dark:text-yellow-200 font-bold mb-2">
                  ⚠️ Exceeds Recommended Maximum
                </p>
              )}
              {warning && (
                <p className="text-sm mb-2 text-gray-900 dark:text-gray-100">
                  {warning}
                </p>
              )}
              
              {/* VRAM Impact for Local AI */}
              {aiStatus.effectiveMode === 'local' && vramImpact && (
                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                  <p className="text-sm font-semibold text-gray-900 dark:text-gray-100 mb-1">
                    💾 VRAM Impact: {vramImpact}
                  </p>
                  <p className="text-xs text-gray-700 dark:text-gray-300">
                    This is additional VRAM needed <strong>on top of</strong> the model's base requirements.
                  </p>
                </div>
              )}
              
              {/* Cloud Cost Impact */}
              {aiStatus.effectiveMode === 'cloud' && tokenLimit >= 4096 && (
                <div className="mt-2 pt-2 border-t border-gray-300 dark:border-gray-700">
                  <p className="text-sm text-gray-700 dark:text-gray-300">
                    💰 Higher token limits increase API costs and response times with Google Gemini.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      
      {/* Advanced Details */}
      {showAdvanced && (
        <div className="bg-gray-50 dark:bg-gray-900 rounded-lg p-4 border border-gray-300 dark:border-gray-700 space-y-3">
          <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
            📚 Understanding Tokens
          </h4>
          
          <div className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
            <p>
              <strong>What are tokens?</strong> Tokens are the building blocks of text for AI models. 
              Roughly, 1 token ≈ 0.75 words, so 1,000 tokens ≈ 750 words.
            </p>
            
            <p>
              <strong>Why does it matter?</strong> The token limit determines how long the AI's response can be:
            </p>
            
            <ul className="list-disc ml-5 space-y-1">
              <li><strong>512 tokens</strong> = ~380 words = Brief paragraph</li>
              <li><strong>2,048 tokens</strong> = ~1,500 words = Detailed statement (3-4 pages)</li>
              <li><strong>4,096 tokens</strong> = ~3,000 words = Comprehensive report (6-8 pages)</li>
            </ul>
            
            <div className="bg-blue-100 dark:bg-blue-900/30 rounded p-2 mt-2">
              <p className="text-blue-900 dark:text-blue-100 font-semibold mb-1">
                💡 For most veterans:
              </p>
              <p className="text-blue-800 dark:text-blue-200">
                The <strong>Balanced (2,048)</strong> preset is perfect for personal statements, 
                DBQs, and nexus letters. You rarely need more unless doing comprehensive research analysis.
              </p>
            </div>
          </div>
          
          {/* Model-Specific Recommendations */}
          <div className="pt-3 border-t border-gray-300 dark:border-gray-700">
            <h5 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
              For {currentModel.name}:
            </h5>
            <ul className="list-disc ml-5 space-y-1 text-sm text-gray-700 dark:text-gray-300">
              <li>
                <strong>Recommended Maximum:</strong> {currentModel.recommendedMax.toLocaleString()} tokens
              </li>
              <li>
                <strong>Context Window:</strong> {currentModel.maxContext.toLocaleString()} tokens total
              </li>
              {aiStatus.effectiveMode === 'local' && (
                <li>
                  <strong>VRAM Consideration:</strong> Higher token limits require more GPU memory. 
                  If generation is slow or fails, reduce the token limit.
                </li>
              )}
              {aiStatus.effectiveMode === 'cloud' && (
                <li>
                  <strong>API Cost:</strong> Higher limits consume more API quota. 
                  Google's free tier is generous, but larger responses use more quota.
                </li>
              )}
            </ul>
          </div>
        </div>
      )}
      
      {/* Use Case Guide */}
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-300 dark:border-purple-700 rounded-lg p-3">
        <h4 className="font-bold text-purple-900 dark:text-purple-200 mb-2 flex items-center gap-2">
          <span>🎯</span> When to Use Each Setting
        </h4>
        <div className="space-y-2 text-sm">
          {Object.entries(TOKEN_PRESETS).map(([key, preset]) => (
            <div key={key} className="flex items-start gap-2">
              <span className="text-purple-600 dark:text-purple-400 font-bold mt-0.5">•</span>
              <div>
                <p className="font-semibold text-purple-900 dark:text-purple-200">
                  {preset.label}:
                </p>
                <p className="text-purple-800 dark:text-purple-300">
                  {preset.useCase}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default TokenLimitConfig;
