/**
 * Vet-Rate.org - AI Settings Modal
 * Global AI configuration accessible from the header AI badge
 */

import React, { useState, useEffect } from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { AIModeSelector } from './AIModeSelector';
import { getAIStatus, isCloudAIAvailable, isLocalAIReady, unloadLocalAI } from '../utils/unifiedAIService';
import ToolCardButton from './ToolCardButton';
import ReportBugLink from './ReportBugLink';

const GEMINI_KEY_STORAGE = 'vetrate_gemini_key';

const AISettingsModal = ({ onClose, onOpenLocalAI, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [isUnloading, setIsUnloading] = useState(false);
  const localAIReady = isLocalAIReady();

  // Load API key on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
    }
  }, []);

  // Update AI status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 500);
    return () => clearInterval(interval);
  }, []);

  // Save API key
  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    }
  };

  // Clear API key
  const handleClearApiKey = () => {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    setApiKey('');
    setApiKeySaved(false);
  };

  // Unload Local AI
  const handleUnloadLocalAI = async () => {
    setIsUnloading(true);
    try {
      await unloadLocalAI();
      setAIStatus(getAIStatus());
    } catch (err) {
      console.error('Failed to unload AI:', err);
    } finally {
      setIsUnloading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 px-6 py-4 flex items-center justify-between rounded-t-2xl">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🤖</span>
            <div>
              <h2 className="text-xl font-bold text-white">AI Settings</h2>
              <p className="text-sm text-purple-200">Configure your AI assistant</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="AI Settings" />}
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

        <div className="p-6 space-y-6">
          {/* Current Status */}
          <div className={`p-4 rounded-xl border-2 ${
            aiStatus.isPrivate 
              ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' 
              : aiStatus.effectiveMode 
                ? 'bg-blue-50 dark:bg-blue-900/30 border-blue-300 dark:border-blue-700'
                : 'bg-yellow-50 dark:bg-yellow-900/30 border-yellow-300 dark:border-yellow-700'
          }`}>
            <div className="flex items-center gap-3">
              <span className="text-3xl">
                {aiStatus.effectiveMode === 'local' ? '🔒' : 
                 aiStatus.effectiveMode === 'cloud' ? '☁️' : '⚠️'}
              </span>
              <div>
                <p className={`font-bold text-lg ${
                  aiStatus.isPrivate ? 'text-green-700 dark:text-green-300' : 
                  aiStatus.effectiveMode ? 'text-blue-700 dark:text-blue-300' : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {aiStatus.statusText}
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  {aiStatus.isPrivate 
                    ? 'Your data never leaves your device' 
                    : aiStatus.effectiveMode 
                      ? 'Connected to Google Gemini'
                      : 'Set up Local AI below for maximum privacy'}
                </p>
              </div>
            </div>
          </div>

          {/* LOCAL AI SECTION - FIRST for maximum privacy emphasis */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">🔒</span>
              <h3 className="font-bold text-gray-900 dark:text-white">Local AI (100% Private) - Recommended</h3>
              <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                MOST SECURE
              </span>
            </div>
            
            <div className={`p-4 rounded-xl border-2 ${
              localAIReady 
                ? 'bg-green-50 dark:bg-green-900/30 border-green-300 dark:border-green-700' 
                : 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700'
            }`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{localAIReady ? '✅' : '💻'}</span>
                  <div>
                    <p className={`font-semibold ${localAIReady ? 'text-green-700 dark:text-green-300' : 'text-gray-700 dark:text-gray-300'}`}>
                      {localAIReady ? 'Local AI Running!' : 'Local AI Not Set Up'}
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-400">
                      {localAIReady 
                        ? 'AI runs entirely in your browser - zero data leaves your device' 
                        : 'Run AI completely offline using WebGPU - your data never leaves your device'}
                    </p>
                  </div>
                </div>
              </div>
              
              {!localAIReady && (
                <ToolCardButton className="mt-4 w-full" type="button" onClick={onOpenLocalAI}>
                  <span>🚀</span> Set Up Local AI (Recommended)
                </ToolCardButton>
              )}
              
              {localAIReady && (
                <div className="mt-4 flex gap-2">
                  <button
                    onClick={onOpenLocalAI}
                    className="flex-1 py-2 px-4 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 font-medium rounded-xl hover:bg-green-200 dark:hover:bg-green-900/70 transition-colors"
                  >
                    ⚙️ Manage Settings
                  </button>
                  <button
                    onClick={handleUnloadLocalAI}
                    disabled={isUnloading}
                    className="py-2 px-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-medium rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors disabled:opacity-50 flex items-center gap-2"
                  >
                    {isUnloading ? (
                      <>
                        <div className="w-4 h-4 border-2 border-red-400 border-t-transparent rounded-full animate-spin"></div>
                        Unloading...
                      </>
                    ) : (
                      <>⏹️ Unload AI</>
                    )}
                  </button>
                </div>
              )}
              
              {/* Faraday Cage Button - Always visible */}
              <button
                onClick={onOpenLocalAI}
                className="mt-3 w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/25"
              >
                <span className="text-xl">🛡️</span>
                Open Faraday Cage Protocol
              </button>
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Requirements:</strong> Modern browser with WebGPU support (Chrome 113+, Edge 113+). 
              Downloads a 0.7-4GB model to your device. <strong>Unload</strong> frees GPU memory when not in use.
            </p>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* API Key Section - SECOND (less private option) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2">
              <span className="text-xl">☁️</span>
              <h3 className="font-bold text-gray-900 dark:text-white">Cloud AI - Gemini API Key (Free)</h3>
            </div>
            
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border border-amber-200 dark:border-amber-800">
              <p className="text-sm text-amber-700 dark:text-amber-300">
                ⚠️ <strong>Privacy Note:</strong> Cloud AI sends your condition names and symptoms to Google's servers. 
                Use Local AI above for maximum privacy.
              </p>
            </div>
            
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Get your free API key from Google AI Studio to enable AI-powered features. Faster than Local AI but requires internet.
            </p>
            
            <div className="relative">
              <input
                type={showApiKey ? 'text' : 'password'}
                value={apiKey}
                onChange={(e) => setApiKey(e.target.value)}
                placeholder="Enter your Gemini API key..."
                className="w-full px-4 py-3 pr-12 text-base border-2 border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
              />
              <button
                type="button"
                onClick={() => setShowApiKey(!showApiKey)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 p-1"
                aria-label={showApiKey ? 'Hide API key' : 'Show API key'}
              >
                {showApiKey ? (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
            
            <div className="flex gap-3">
              <button
                onClick={handleSaveApiKey}
                disabled={!apiKey.trim()}
                className="flex-1 py-3 px-4 bg-purple-600 text-white font-semibold rounded-xl hover:bg-purple-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {apiKeySaved ? '✓ Saved!' : '💾 Save Key'}
              </button>
              {apiKey && (
                <button
                  onClick={handleClearApiKey}
                  className="py-3 px-4 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 font-semibold rounded-xl hover:bg-red-200 dark:hover:bg-red-900/50 transition-colors"
                >
                  Clear
                </button>
              )}
            </div>
            
            <a
              href="https://aistudio.google.com/app/apikey"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 text-sm text-purple-600 dark:text-purple-400 hover:underline font-medium"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
              Get free API key from Google AI Studio →
            </a>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* AI Mode Selector */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🛡️</span>
              <h3 className="font-bold text-gray-900 dark:text-white">Privacy Mode</h3>
            </div>
            <AIModeSelector 
              onModeChange={() => setAIStatus(getAIStatus())}
              compact={false}
            />
          </div>

          {/* Help Section */}
          <div className="bg-gray-100 dark:bg-gray-800 rounded-xl p-4">
            <h4 className="font-semibold text-gray-900 dark:text-white mb-2 flex items-center gap-2">
              <span>💡</span> Quick Tips
            </h4>
            <ul className="text-sm text-gray-600 dark:text-gray-400 space-y-2">
              <li>• <strong>Local AI (Recommended)</strong> - 100% private, works offline, data never leaves your device</li>
              <li>• <strong>Cloud AI (Gemini)</strong> - Faster responses, requires internet, data sent to Google</li>
              <li>• Your API key is stored only in your browser - we never see it</li>
              <li>• <strong>Unload AI</strong> frees up GPU memory when you're done using AI features</li>
            </ul>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-800 px-6 py-4 rounded-b-2xl border-t border-gray-200 dark:border-gray-700">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 font-semibold rounded-xl hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
};

export default AISettingsModal;
