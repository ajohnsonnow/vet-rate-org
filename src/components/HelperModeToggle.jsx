import React, { useState } from 'react';
import { useHelperMode, TERMINOLOGY } from '../contexts/HelperModeContext';

/**
 * HelperModeToggle Component - "I Am Helping a Veteran"
 * 
 * A prominent toggle that switches the entire app into Helper/Spouse/Caregiver mode.
 * When enabled:
 * - Military/VA jargon is replaced with plain English
 * - Tooltips explain acronyms
 * - Caregiver-relevant tools are highlighted
 */

const HelperModeToggle = ({ compact = false }) => {
  const { isHelperMode, toggleHelperMode, showHelperTooltips, setShowHelperTooltips } = useHelperMode();
  const [showInfo, setShowInfo] = useState(false);

  if (compact) {
    // Compact version for header
    return (
      <button
        onClick={toggleHelperMode}
        className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-all flex items-center gap-1.5 ${
          isHelperMode
            ? 'bg-pink-500 text-white shadow-md'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-pink-100 dark:hover:bg-pink-900/30'
        }`}
        title={isHelperMode ? 'Helper Mode Active - Click to deactivate' : 'Activate Helper Mode for simplified language'}
      >
        <span>{isHelperMode ? '💝' : '🤝'}</span>
        <span className="hidden sm:inline">{isHelperMode ? 'Helper Mode ON' : 'I\'m Helping'}</span>
      </button>
    );
  }

  // Full version for settings or standalone
  return (
    <div className="bg-gradient-to-r from-pink-50 via-rose-50 to-purple-50 dark:from-pink-900/30 dark:via-rose-900/30 dark:to-purple-900/30 border border-pink-200 dark:border-pink-700 rounded-xl p-4">
      <div className="flex items-start gap-4">
        <div className="flex-shrink-0">
          <div className={`w-14 h-14 rounded-xl flex items-center justify-center transition-colors ${
            isHelperMode 
              ? 'bg-pink-500 text-white' 
              : 'bg-white dark:bg-gray-800 border-2 border-pink-200 dark:border-pink-700'
          }`}>
            <span className="text-2xl">{isHelperMode ? '💝' : '🤝'}</span>
          </div>
        </div>
        
        <div className="flex-1">
          <div className="flex items-center justify-between mb-2">
            <h3 className="font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
              Helper Mode
              <span className="px-2 py-0.5 bg-pink-500 text-white text-xs font-bold rounded-full">
                FOR CAREGIVERS
              </span>
            </h3>
            
            {/* Toggle Switch */}
            <button
              onClick={toggleHelperMode}
              className={`relative w-14 h-7 rounded-full transition-colors ${
                isHelperMode ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'
              }`}
              role="switch"
              aria-checked={isHelperMode}
            >
              <span
                className={`absolute top-1 w-5 h-5 bg-white rounded-full shadow-md transition-transform ${
                  isHelperMode ? 'translate-x-8' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
          
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
            <strong>"I am helping a Veteran."</strong> Enable this mode to simplify military/VA jargon 
            into plain English. Perfect for spouses, family members, or caregivers navigating the claims process.
          </p>
          
          {/* Info toggle */}
          <button
            onClick={() => setShowInfo(!showInfo)}
            className="text-sm text-pink-600 dark:text-pink-400 hover:underline flex items-center gap-1"
          >
            <span>{showInfo ? '▼' : '▶'}</span>
            What changes in Helper Mode?
          </button>
          
          {showInfo && (
            <div className="mt-3 p-3 bg-white dark:bg-gray-800 rounded-lg space-y-3">
              {/* Example translations */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  📝 Term Simplifications (examples):
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
                  {Object.entries(TERMINOLOGY).slice(0, 6).map(([term, info]) => (
                    <div key={term} className="flex items-center gap-2">
                      <span className="text-gray-400 dark:text-gray-500 line-through">{term}</span>
                      <span className="text-gray-400">→</span>
                      <span className="text-pink-600 dark:text-pink-400 font-medium">{info.simple}</span>
                    </div>
                  ))}
                </div>
              </div>
              
              {/* Highlighted tools */}
              <div>
                <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-2">
                  ⭐ Highlighted Tools for Caregivers:
                </p>
                <div className="flex flex-wrap gap-1">
                  {['Witness Bench', 'State Benefits', 'Symptom Logger', 'Forms Helper', 'VSO Finder'].map(tool => (
                    <span 
                      key={tool}
                      className="px-2 py-0.5 bg-pink-100 dark:bg-pink-900/50 text-pink-700 dark:text-pink-300 text-xs rounded-full"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
              
              {/* Tooltips toggle */}
              <div className="flex items-center justify-between pt-2 border-t dark:border-gray-700">
                <span className="text-sm text-gray-700 dark:text-gray-300">
                  Show explanatory tooltips on hover
                </span>
                <button
                  onClick={() => setShowHelperTooltips(!showHelperTooltips)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${
                    showHelperTooltips ? 'bg-pink-500' : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  role="switch"
                  aria-checked={showHelperTooltips}
                >
                  <span
                    className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow-md transition-transform ${
                      showHelperTooltips ? 'translate-x-5' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
      
      {/* Active indicator banner */}
      {isHelperMode && (
        <div className="mt-4 px-4 py-2 bg-pink-500 text-white rounded-lg text-center">
          <p className="text-sm font-medium">
            ✨ Helper Mode Active - Simplified language is now being used throughout the app
          </p>
        </div>
      )}
    </div>
  );
};

/**
 * HelperTooltip - Wrap terms to show tooltips in Helper Mode
 */
export const HelperTooltip = ({ term, children }) => {
  const { isHelperMode, showHelperTooltips, getTerm, getTooltip } = useHelperMode();
  const [showTooltip, setShowTooltip] = useState(false);
  
  const tooltip = getTooltip(term);
  const displayTerm = isHelperMode ? getTerm(term) : term;
  
  if (!isHelperMode || !showHelperTooltips || !tooltip) {
    return <>{children || displayTerm}</>;
  }
  
  return (
    <span 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      <span className="border-b border-dotted border-pink-400 cursor-help">
        {children || displayTerm}
      </span>
      {showTooltip && (
        <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-3 py-2 bg-gray-900 text-white text-xs rounded-lg whitespace-nowrap z-50 shadow-lg">
          {tooltip}
          <span className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900" />
        </span>
      )}
    </span>
  );
};

/**
 * Smart Term - Automatically translates terms in Helper Mode
 */
export const SmartTerm = ({ term }) => {
  const { getTerm } = useHelperMode();
  return <HelperTooltip term={term}>{getTerm(term)}</HelperTooltip>;
};

export default HelperModeToggle;
