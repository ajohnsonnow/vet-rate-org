/**
 * Vet-Rate.org - LLM Recommendation Badge Component
 * Shows contextual AI model recommendations for each tool
 * 
 * This component provides guidance to users about which local AI model
 * is best suited for the tool they're using.
 */

import React, { useState, useEffect } from 'react';
import { getToolRecommendation, analyzeCurrentModel } from '../utils/llmRecommendations';
import { getAIStatus, AI_MODES } from '../utils/unifiedAIService';

/**
 * Compact badge showing current model and recommendation
 */
export const LLMRecommendationBadge = ({ toolId, className = '' }) => {
  const [isExpanded, setIsExpanded] = useState(false);
  const [aiStatus, setAiStatus] = useState(getAIStatus());
  
  useEffect(() => {
    setAiStatus(getAIStatus());
  }, []);
  
  const recommendation = getToolRecommendation(toolId);
  if (!recommendation) return null;
  
  const currentModelId = localStorage.getItem('vet_rate_local_ai_model');
  const analysis = analyzeCurrentModel(toolId, currentModelId);
  
  // If using cloud AI, show different message
  if (aiStatus.effectiveMode === AI_MODES.CLOUD) {
    return (
      <div className={`text-xs bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full ${className}`}>
        ☁️ Cloud AI (Gemini)
      </div>
    );
  }
  
  // If no AI available
  if (!aiStatus.effectiveMode) {
    return null;
  }
  
  return (
    <div className={`relative ${className}`}>
      <button
        onClick={() => setIsExpanded(!isExpanded)}
        className={`text-xs px-2 py-1 rounded-full flex items-center gap-1 transition-colors ${
          analysis.isOptimal
            ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50'
            : 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50'
        }`}
        title="View AI model recommendations for this tool"
      >
        {analysis.isOptimal ? '✓' : '💡'} {recommendation.primary.badge || 'AI Ready'}
        <svg className={`w-3 h-3 transition-transform ${isExpanded ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      
      {isExpanded && (
        <div className="absolute top-full left-0 mt-1 w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 p-3">
          <div className="text-xs space-y-2">
            <div className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
              {recommendation.category.icon} Best AI for {recommendation.name}
            </div>
            
            {/* Primary Recommendation */}
            <div className="bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded p-2 border border-green-200 dark:border-green-800">
              <div className="font-medium text-green-800 dark:text-green-300">
                ⭐ {recommendation.primary.modelName}
              </div>
              <div className="text-green-600 dark:text-green-400 text-[10px]">
                {recommendation.primary.reason}
              </div>
            </div>
            
            {/* Current Status */}
            {analysis.message && (
              <div className={`text-[10px] p-2 rounded ${
                analysis.isOptimal 
                  ? 'bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-300'
                  : 'bg-amber-50 dark:bg-amber-900/20 text-amber-700 dark:text-amber-300'
              }`}>
                {analysis.message}
              </div>
            )}
            
            {/* Alternatives */}
            {recommendation.alternatives.length > 0 && (
              <div>
                <div className="text-gray-500 dark:text-gray-400 text-[10px] mb-1">Also works well:</div>
                <div className="space-y-1">
                  {recommendation.alternatives.slice(0, 2).map((alt, i) => (
                    <div key={i} className="text-gray-600 dark:text-gray-300 text-[10px]">
                      • <strong>{alt.modelName}</strong>: {alt.reason}
                    </div>
                  ))}
                </div>
              </div>
            )}
            
            {/* Tips */}
            {recommendation.tips && recommendation.tips.length > 0 && (
              <div className="border-t border-gray-200 dark:border-gray-700 pt-2 mt-2">
                <div className="text-gray-500 dark:text-gray-400 text-[10px]">
                  💡 {recommendation.tips[0]}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

/**
 * Full panel showing complete recommendations (for AI Settings or tool modals)
 */
export const LLMRecommendationPanel = ({ toolId, onModelSelect, className = '' }) => {
  const recommendation = getToolRecommendation(toolId);
  if (!recommendation) return null;
  
  const currentModelId = localStorage.getItem('vet_rate_local_ai_model');
  const analysis = analyzeCurrentModel(toolId, currentModelId);
  
  return (
    <div className={`bg-gradient-to-r from-indigo-50 to-purple-50 dark:from-indigo-900/20 dark:to-purple-900/20 rounded-xl p-4 border border-indigo-200 dark:border-indigo-800 ${className}`}>
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-2xl">{recommendation.category.icon}</span>
        <div>
          <h4 className="font-bold text-gray-800 dark:text-gray-200">
            AI Recommendation for {recommendation.name}
          </h4>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            {recommendation.category.description}
          </p>
        </div>
      </div>
      
      {/* Primary Recommendation */}
      <div className="bg-white dark:bg-gray-800 rounded-lg p-3 mb-3 border-2 border-green-400 dark:border-green-600">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-lg">⭐</span>
            <span className="font-bold text-gray-800 dark:text-gray-200">
              {recommendation.primary.modelName}
            </span>
            {recommendation.primary.badge && (
              <span className="text-xs bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                {recommendation.primary.badge}
              </span>
            )}
          </div>
          {onModelSelect && (
            <button
              onClick={() => onModelSelect(recommendation.primary.modelId)}
              className="text-xs bg-green-600 hover:bg-green-700 text-white px-3 py-1 rounded-lg transition-colors"
            >
              Load Model
            </button>
          )}
        </div>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          {recommendation.primary.reason}
        </p>
      </div>
      
      {/* Current Model Status */}
      {analysis.message && (
        <div className={`p-3 rounded-lg mb-3 ${
          analysis.isOptimal 
            ? 'bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700'
            : 'bg-amber-100 dark:bg-amber-900/30 border border-amber-300 dark:border-amber-700'
        }`}>
          <p className={`text-sm ${
            analysis.isOptimal 
              ? 'text-green-700 dark:text-green-300'
              : 'text-amber-700 dark:text-amber-300'
          }`}>
            {analysis.message}
          </p>
        </div>
      )}
      
      {/* Alternatives */}
      {recommendation.alternatives.length > 0 && (
        <div className="mb-3">
          <h5 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
            Alternative Models
          </h5>
          <div className="space-y-2">
            {recommendation.alternatives.map((alt, i) => (
              <div 
                key={i}
                className="bg-white dark:bg-gray-800 rounded-lg p-2 border border-gray-200 dark:border-gray-700 flex items-center justify-between"
              >
                <div>
                  <span className="font-medium text-gray-800 dark:text-gray-200 text-sm">
                    {alt.modelName}
                  </span>
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    {alt.reason}
                  </p>
                </div>
                {onModelSelect && (
                  <button
                    onClick={() => onModelSelect(alt.modelId)}
                    className="text-xs bg-gray-200 dark:bg-gray-700 hover:bg-gray-300 dark:hover:bg-gray-600 text-gray-700 dark:text-gray-300 px-2 py-1 rounded transition-colors"
                  >
                    Load
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
      
      {/* Tips */}
      {recommendation.tips && recommendation.tips.length > 0 && (
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-3 border border-blue-200 dark:border-blue-800">
          <h5 className="text-sm font-semibold text-blue-700 dark:text-blue-300 mb-2 flex items-center gap-1">
            💡 Pro Tips
          </h5>
          <ul className="text-xs text-blue-600 dark:text-blue-400 space-y-1">
            {recommendation.tips.map((tip, i) => (
              <li key={i}>• {tip}</li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

/**
 * Inline hint for tool headers
 */
export const LLMHint = ({ toolId, className = '' }) => {
  const recommendation = getToolRecommendation(toolId);
  if (!recommendation) return null;
  
  const aiStatus = getAIStatus();
  if (!aiStatus.effectiveMode) return null;
  
  return (
    <div className={`text-xs text-gray-500 dark:text-gray-400 flex items-center gap-1 ${className}`}>
      <span>💡</span>
      <span>
        Best with <strong className="text-indigo-600 dark:text-indigo-400">{recommendation.primary.modelName}</strong>
      </span>
    </div>
  );
};

export default {
  LLMRecommendationBadge,
  LLMRecommendationPanel,
  LLMHint,
};
