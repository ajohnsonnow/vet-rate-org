/**
 * Vet-Rate.org - AI Settings Modal
 * Global AI configuration accessible from the header AI badge
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { AIModeSelector } from './AIModeSelector';
import { getAIStatus, isCloudAIAvailable, isLocalAIReady, unloadLocalAI } from '../utils/unifiedAIService';
import { useDeviceCapability, DEVICE_TIERS } from '../utils/useDeviceCapability';
import { getGPUPreference, GPU_PREFERENCES } from './LocalAIPanel';
import ToolCardButton from './ToolCardButton';
import ReportBugLink from './ReportBugLink';
import TokenLimitConfig from './TokenLimitConfig';
import PresetSelector from './PresetSelector';

const GEMINI_KEY_STORAGE = 'vetrate_gemini_key';

const AISettingsModal = ({ onClose, onOpenLocalAI, onReportBug }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [isUnloading, setIsUnloading] = useState(false);
  const [gpuInfo, setGpuInfo] = useState(null);
  const [selectedPreset, setSelectedPreset] = useState('BALANCED');
  const localAIReady = isLocalAIReady();
  
  // Device capability detection
  const deviceCapability = useDeviceCapability();

  // Load API key and GPU info on mount
  useEffect(() => {
    const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedKey) {
      setApiKey(savedKey);
    }
    
    // Load saved preset
    const savedPreset = localStorage.getItem('vetrate_ai_preset');
    if (savedPreset && ['LEGAL', 'CREATIVE', 'ADVERSARIAL', 'BALANCED'].includes(savedPreset)) {
      setSelectedPreset(savedPreset);
    }
    
    // Get GPU info
    const checkGPU = async () => {
      if (navigator.gpu) {
        try {
          // Get current GPU
          const adapter = await navigator.gpu.requestAdapter();
          if (adapter) {
            let info = { device: 'GPU Detected', vendor: 'Unknown', description: '' };
            try {
              if (typeof adapter.requestAdapterInfo === 'function') {
                info = await adapter.requestAdapterInfo();
                console.log('🎮 Current Active GPU Info:', info);
              } else if (adapter.info) {
                info = adapter.info;
                console.log('🎮 Current Active GPU Info (fallback):', info);
              }
            } catch (e) { 
              console.warn('Could not get current GPU info:', e);
            }
            
            const gpuName = info.description || info.device || `${(info.vendor || 'Unknown').toUpperCase()} GPU`;
            
            setGpuInfo({
              device: gpuName,
              vendor: info.vendor || 'Unknown',
              preference: getGPUPreference(),
            });
          }
        } catch (e) {
          console.warn('Could not get GPU info:', e);
        }
      }
    };
    checkGPU();
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

  // Handle preset change
  const handlePresetChange = (presetName, presetConfig) => {
    setSelectedPreset(presetName);
    localStorage.setItem('vetrate_ai_preset', presetName);
    console.log('AI Preset changed to:', presetName, presetConfig);
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
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">🔒</span>
              <h3 className="font-bold text-gray-900 dark:text-white">Local AI (100% Private)</h3>
              {/* Device-aware badge */}
              {deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED ? (
                <span className="px-2 py-0.5 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 text-xs font-bold rounded-full">
                  ❌ NOT SUPPORTED
                </span>
              ) : deviceCapability.tier === DEVICE_TIERS.LEGACY ? (
                <span className="px-2 py-0.5 bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 text-xs font-bold rounded-full">
                  ⚠️ LIMITED SUPPORT
                </span>
              ) : (
                <>
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                    ✨ RECOMMENDED
                  </span>
                  <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 text-xs font-bold rounded-full">
                    MOST SECURE
                  </span>
                </>
              )}
            </div>
            
            {/* Device capability warning for legacy/unsupported devices */}
            {(deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED || deviceCapability.tier === DEVICE_TIERS.LEGACY) && (
              <div className={`p-3 rounded-lg border ${
                deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED 
                  ? 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800' 
                  : 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800'
              }`}>
                <p className={`text-sm font-medium ${
                  deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED 
                    ? 'text-red-700 dark:text-red-300' 
                    : 'text-yellow-700 dark:text-yellow-300'
                }`}>
                  {deviceCapability.advice.localAI.warning}
                </p>
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-1">
                  {deviceCapability.advice.localAI.description}
                </p>
                {deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED && (
                  <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
                    💡 <strong>Recommendation:</strong> Use Cloud AI below - it works on all devices and is still very secure.
                  </p>
                )}
              </div>
            )}
            
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
              
              {/* GPU Info Display */}
              {gpuInfo && deviceCapability.tier !== DEVICE_TIERS.UNSUPPORTED && (
                <div className="mt-3 p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-lg">🎮</span>
                      <div>
                        <p className="text-sm font-medium text-purple-700 dark:text-purple-300">
                          {gpuInfo.device}
                        </p>
                        <p className="text-xs text-gray-500 dark:text-gray-400">
                          {gpuInfo.vendor} • Mode: {
                            gpuInfo.preference === GPU_PREFERENCES.HIGH_PERFORMANCE ? '🚀 High Performance' :
                            gpuInfo.preference === GPU_PREFERENCES.LOW_POWER ? '🔋 Power Saver' :
                            '🤖 Auto'
                          }
                        </p>
                      </div>
                    </div>
                    <button
                      onClick={onOpenLocalAI}
                      className="text-xs px-3 py-1.5 bg-purple-100 dark:bg-purple-900/50 text-purple-600 dark:text-purple-300 rounded-lg hover:bg-purple-200 dark:hover:bg-purple-900/70 transition-colors"
                    >
                      Change GPU
                    </button>
                  </div>
                </div>
              )}
              
              {!localAIReady && deviceCapability.tier !== DEVICE_TIERS.UNSUPPORTED && (
                <button
                  onClick={onOpenLocalAI}
                  className="mt-3 w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all flex items-center justify-center gap-2 shadow-lg hover:shadow-cyan-500/25"
                >
                  <span className="text-xl">🛡️</span>
                  Open Faraday Cage Protocol
                </button>
              )}
              
              {!localAIReady && deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED && (
                <button 
                  disabled 
                  className="mt-4 w-full py-3 px-4 bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 font-medium rounded-xl cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span>🚫</span> Local AI Not Available on This Device
                </button>
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
            </div>
            
            <p className="text-xs text-gray-500 dark:text-gray-400">
              {deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED ? (
                <>
                  <strong>Why isn't Local AI available?</strong> Your device doesn't support WebGPU, which is required for running AI models locally. 
                  This is common on older Android versions (10 and below) and some iOS devices.
                </>
              ) : deviceCapability.tier === DEVICE_TIERS.LEGACY ? (
                <>
                  <strong>⚠️ Performance Warning:</strong> Your device may struggle with Local AI due to limited GPU/memory. 
                  Consider using Cloud AI for a smoother experience, or try the smallest model in Local AI settings.
                </>
              ) : (
                <>
                  <strong>Requirements:</strong> Modern browser with WebGPU support (Chrome 113+, Edge 113+). 
                  Downloads a 0.7-4GB model to your device. <strong>Unload</strong> frees GPU memory when not in use.
                </>
              )}
            </p>
          </div>

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* API Key Section - SECOND (less private option) */}
          <div className="space-y-4">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xl">☁️</span>
              <h3 className="font-bold text-gray-900 dark:text-white">Cloud AI - Gemini API Key (Free)</h3>
              {/* Show recommended badge for legacy/unsupported devices */}
              {(deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED || deviceCapability.tier === DEVICE_TIERS.LEGACY) && (
                <span className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs font-bold rounded-full">
                  ✨ RECOMMENDED FOR YOUR DEVICE
                </span>
              )}
            </div>
            
            {/* DKB Enhancement Notice */}
            <div className="p-3 bg-gradient-to-r from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
              <div className="flex items-start gap-2">
                <span className="text-lg">💎</span>
                <div>
                  <p className="text-sm font-semibold text-purple-800 dark:text-purple-300">
                    Enhanced with Diamond Knowledge Base
                  </p>
                  <p className="text-xs text-purple-600 dark:text-purple-400 mt-1">
                    Gemini uses <strong>8,000 web-optimized</strong> entries from our DKB (38 CFR, BVA, CAVC).
                  </p>
                  <p className="text-xs text-amber-600 dark:text-amber-500 mt-1">
                    ⚡ <strong>Note:</strong> Full database has 130K+ entries. Load Local AI (above) for complete access.
                  </p>
                </div>
              </div>
            </div>
            
            {/* Show positive message for legacy devices */}
            {(deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED || deviceCapability.tier === DEVICE_TIERS.LEGACY) && (
              <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
                <p className="text-sm text-blue-700 dark:text-blue-300">
                  ✅ <strong>Best option for your device!</strong> Cloud AI works on all devices and is fast and reliable. 
                  Your data is still protected by Google's enterprise-grade security.
                </p>
              </div>
            )}
            
            <div className="p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg border-2 border-amber-300 dark:border-amber-700">
              <p className="text-sm text-amber-700 dark:text-amber-300 font-medium">
                ⚠️ <strong>Data Center Warning:</strong> Using your Gemini API key sends your condition names, symptoms,
                and any text you enter to Google's data centers. Your data will be processed on remote servers.
              </p>
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-2">
                💡 <strong>Your API key is yours</strong> - we never see it and it stays in your browser.
                But any AI queries you make will travel to Google. Use Local AI above for 100% offline, zero-transmission privacy.
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

          {/* Token Limit Configuration */}
          <TokenLimitConfig />

          {/* Divider */}
          <hr className="border-gray-200 dark:border-gray-700" />

          {/* AI Preset Configuration */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <span className="text-xl">🎯</span>
              <h3 className="font-bold text-gray-900 dark:text-white">AI Configuration</h3>
            </div>
            <PresetSelector 
              value={selectedPreset}
              onChange={handlePresetChange}
            />
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
              <li>• <strong>Cloud AI (Gemini)</strong> - Faster responses, but <strong>sends data to Google's data centers</strong></li>
              <li>• <strong>BYOK (Bring Your Own Key)</strong> - Your API key stays in YOUR browser - we never see it</li>
              <li>• <strong>Response Length</strong> - Adjust token limits above to control response length and resource usage</li>
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
