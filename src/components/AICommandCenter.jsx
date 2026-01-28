/**
 * Vet-Rate.org - AI Command Center
 * "The Faraday Cage Protocol" - ONE place for ALL AI settings
 * 
 * Simplified for infantry: Veterans don't need to hunt through multiple panels.
 * Everything AI-related in one mission briefing.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { 
  getAIStatus, 
  isLocalAIReady, 
  unloadLocalAI,
  registerLocalAIEngine
} from '../utils/unifiedAIService';
import { useDeviceCapability, DEVICE_TIERS } from '../utils/useDeviceCapability';
import { getGPUPreference, GPU_PREFERENCES, setGPUPreference } from './LocalAIPanel';
import TokenLimitConfig from './TokenLimitConfig';
import PresetSelector from './PresetSelector';
import ReportBugLink from './ReportBugLink';
import GPUSelector from './GPUSelector';
import { gpuManager } from '../utils/WebGPUManager';

const GEMINI_KEY_STORAGE = 'vetrate_gemini_key';

// ╔══════════════════════════════════════════════════════════════════════════════╗
// ║  🎖️ THE WARRANT COUNCIL - VetRate's Custom Fine-Tuned AI Models             ║
// ║══════════════════════════════════════════════════════════════════════════════║
// ║  Each model maps to a REAL Army Warrant Officer MOS specialty:              ║
// ║  • 350F - All Source Intelligence Technician (analyzes everything)          ║
// ║  • 270A - Legal Administrator (documents & regulations)                      ║
// ║  • 352N - SIGINT Analysis Technician (deciphers signals & patterns)         ║
// ║══════════════════════════════════════════════════════════════════════════════║
// ║  Desktop 7B = Senior Warrants (CWO3-CWO5) - Full SCIF-level analysis        ║
// ║  Mobile 1.7B = Junior Warrants (WO1-CWO2) - Field-deployable ops            ║
// ╚══════════════════════════════════════════════════════════════════════════════╝
const MODELS = [
  // ═══════════════════════════════════════════════════════════════════════════
  // 🖥️ DESKTOP EDITIONS (7B) - Senior Warrants - SCIF-Level Analysis
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'vetrate-auditor-7b-v2',
    name: '🎖️ CWO3 "HAWKEYE" - 350F All Source Intel',
    description: 'Fuses all claim intel: service records, medical evidence, 38 CFR regs, and BVA precedent',
    size: '4.4 GB',
    vramRequired: '6 GB',
    recommended: true,
    bestFor: 'Deep claim audits, evidence correlation, multi-source analysis',
    tier: 'full',
    callSign: 'HAWKEYE',
    mos: '350F',
  },
  {
    id: 'vetrate-writer-7b-v2',
    name: '🎖️ CWO4 "PHANTOM" - 270A Legal Admin',
    description: 'JAG-trained documentation expert: personal statements, nexus letters, and appeal briefs',
    size: '4.4 GB',
    vramRequired: '6 GB',
    bestFor: 'Legal documents, NODs, HLR scripts, formal correspondence',
    tier: 'full',
    callSign: 'PHANTOM',
    mos: '270A',
  },
  {
    id: 'vetrate-rater-7b-v2',
    name: '🎖️ CWO5 "ORACLE" - 352N SIGINT Analyst',
    description: 'Muster Call SigInt specialist: deciphers rating patterns, bilateral math, SMC codes, and TDIU thresholds',
    size: '4.4 GB',
    vramRequired: '6 GB',
    bestFor: 'Complex calculations, pattern analysis, SMC/TDIU strategy',
    tier: 'full',
    callSign: 'ORACLE',
    mos: '352N',
  },
  // ═══════════════════════════════════════════════════════════════════════════
  // 📱 MOBILE EDITIONS (1.7B) - Junior Warrants - Field Ops
  // Knowledge-distilled from Senior Warrants for tactical deployment
  // ═══════════════════════════════════════════════════════════════════════════
  {
    id: 'vetrate-auditor-1.7b-mobile-v1',
    name: '📱 WO1 "SCOUT" - 350F Field Intel',
    description: 'Quick intel sweep: spots red flags, gathers initial HUMINT, preps for Senior analysis',
    size: '0.8 GB',
    vramRequired: '2 GB',
    bestFor: 'Fast claim triage, evidence spotting, mobile recon',
    tier: 'mobile',
    mobileOptimized: true,
    callSign: 'SCOUT',
    mos: '350F',
  },
  {
    id: 'vetrate-writer-1.7b-mobile-v1',
    name: '📱 CWO2 "SCRIBE" - 270A Field Admin',
    description: 'Rapid field documentation: captures testimony, outlines statements, secures the narrative',
    size: '0.8 GB',
    vramRequired: '2 GB',
    bestFor: 'Quick statement drafts, bullet capture, field notes',
    tier: 'mobile',
    mobileOptimized: true,
    callSign: 'SCRIBE',
    mos: '270A',
  },
  {
    id: 'vetrate-rater-1.7b-mobile-v1',
    name: '📱 CWO2 "CIPHER" - 352N Field SIGINT',
    description: 'Tactical signal decoding: quick rating reads, basic pattern recognition on-the-move',
    size: '0.8 GB',
    vramRequired: '2 GB',
    bestFor: 'Fast rating estimates, quick math checks, field calculations',
    tier: 'mobile',
    mobileOptimized: true,
    callSign: 'CIPHER',
    mos: '352N',
  },
];

const AICommandCenter = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  // Tab state
  const [activeTab, setActiveTab] = useState('setup'); // 'setup' | 'advanced'
  
  // AI Status
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  const [isUnloading, setIsUnloading] = useState(false);
  const localAIReady = isLocalAIReady();
  
  // API Key
  const [apiKey, setApiKey] = useState('');
  const [showApiKey, setShowApiKey] = useState(false);
  const [apiKeySaved, setApiKeySaved] = useState(false);
  
  // Local AI state
  const [webGPUStatus, setWebGPUStatus] = useState({ supported: false, checked: false });
  const [selectedModel, setSelectedModel] = useState(MODELS[0]);
  const [isLoading, setIsLoading] = useState(false);
  const [loadProgress, setLoadProgress] = useState({ progress: 0, text: 'Ready' });
  const [isReady, setIsReady] = useState(false);
  const [loadedModelId, setLoadedModelId] = useState(null);
  const [installedModels, setInstalledModels] = useState(new Set());
  
  // Preset
  const [selectedPreset, setSelectedPreset] = useState('BALANCED');
  
  // Device capability
  const deviceCapability = useDeviceCapability();

  // Check WebGPU on mount
  useEffect(() => {
    const checkWebGPU = async () => {
      if (!navigator.gpu) {
        setWebGPUStatus({ supported: false, checked: true, reason: 'WebGPU not supported by browser' });
        return;
      }
      
      try {
        const adapter = await navigator.gpu.requestAdapter();
        if (!adapter) {
          setWebGPUStatus({ supported: false, checked: true, reason: 'No GPU adapter found' });
          return;
        }
        
        let adapterInfo = { vendor: 'Unknown', device: 'GPU Detected' };
        try {
          if (adapter.info) {
            adapterInfo = adapter.info;
          } else if (adapter.requestAdapterInfo) {
            adapterInfo = await adapter.requestAdapterInfo();
          }
        } catch (e) {
          console.log('Could not get adapter info');
        }
        
        setWebGPUStatus({
          supported: true,
          checked: true,
          device: adapterInfo.description || adapterInfo.device || 'GPU Detected',
          vendor: adapterInfo.vendor || 'Unknown',
        });
      } catch (e) {
        setWebGPUStatus({ supported: false, checked: true, reason: e.message });
      }
    };
    
    checkWebGPU();
    
    // Load API key
    const savedKey = localStorage.getItem(GEMINI_KEY_STORAGE);
    if (savedKey) setApiKey(savedKey);
    
    // Load preset
    const savedPreset = localStorage.getItem('vetrate_ai_preset');
    if (savedPreset) setSelectedPreset(savedPreset);
    
    // Check if AI is already ready
    const status = getAIStatus();
    if (status.effectiveMode === 'local') {
      setIsReady(true);
    }
  }, []);

  // Update AI status periodically
  useEffect(() => {
    const interval = setInterval(() => {
      const status = getAIStatus();
      setAIStatus(status);
      if (status.effectiveMode === 'local' && !isReady) {
        setIsReady(true);
      }
    }, 500);
    return () => clearInterval(interval);
  }, [isReady]);

  // Save API Key
  const handleSaveApiKey = () => {
    if (apiKey.trim()) {
      localStorage.setItem(GEMINI_KEY_STORAGE, apiKey.trim());
      setApiKeySaved(true);
      setTimeout(() => setApiKeySaved(false), 2000);
    }
  };

  // Clear API Key
  const handleClearApiKey = () => {
    localStorage.removeItem(GEMINI_KEY_STORAGE);
    setApiKey('');
  };

  // Unload Local AI
  const handleUnloadLocalAI = async () => {
    setIsUnloading(true);
    try {
      await unloadLocalAI();
      setIsReady(false);
      setLoadedModelId(null);
      setAIStatus(getAIStatus());
    } catch (err) {
      console.error('Failed to unload AI:', err);
    } finally {
      setIsUnloading(false);
    }
  };

  // Initialize Local AI Engine
  const initializeEngine = async () => {
    if (!webGPUStatus.supported || isLoading) return;
    
    setIsLoading(true);
    setLoadProgress({ progress: 0, text: 'Starting...' });
    
    try {
      // Dynamically import the Diamond Swarm
      const { initializeSwarm, generateWithSwarm, isSwarmReady, getSwarmStatus } = await import('../utils/diamondSwarm');
      
      // Initialize with selected model
      await initializeSwarm({
        modelId: selectedModel.id,
        onProgress: (report) => {
          // diamondSwarm passes { stage, message, progress } object
          const progressValue = typeof report === 'object' ? (report.progress || 0) : (report || 0);
          const textValue = typeof report === 'object' ? (report.message || 'Loading...') : 'Loading...';
          setLoadProgress({ 
            progress: Math.round(progressValue), 
            text: textValue 
          });
        },
      });
      
      // Register with unified AI service
      registerLocalAIEngine({
        generate: async (prompt, options) => {
          const result = await generateWithSwarm(prompt, options);
          return result?.text || result;
        },
        isReady: isSwarmReady,
        getStatus: getSwarmStatus,
      });
      
      setIsReady(true);
      setLoadedModelId(selectedModel.id);
      setInstalledModels(prev => new Set([...prev, selectedModel.id]));
      setAIStatus(getAIStatus());
      
    } catch (err) {
      console.error('Failed to initialize AI:', err);
      setLoadProgress({ progress: 0, text: `Error: ${err.message}` });
    } finally {
      setIsLoading(false);
    }
  };

  // Handle preset change
  const handlePresetChange = (presetName) => {
    setSelectedPreset(presetName);
    localStorage.setItem('vetrate_ai_preset', presetName);
  };

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-gradient-to-b from-gray-900 to-gray-950 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col border border-gray-700">
        
        {/* Header */}
        <div className="bg-gradient-to-r from-cyan-600 via-blue-600 to-purple-600 text-white px-6 py-5 rounded-t-2xl relative overflow-hidden flex-shrink-0">
          <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16" />
          
          <div className="relative flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                <span className="text-3xl">🛡️</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold">
                  AI Command Center
                </h2>
                <p className="text-cyan-200 text-sm mt-1">
                  Faraday Cage Protocol • All AI Settings in One Place
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="AI Command Center" />}
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
          
          {/* Status Indicator */}
          <div className={`mt-4 px-4 py-2 rounded-lg inline-flex items-center gap-2 ${
            aiStatus.isPrivate 
              ? 'bg-green-500/30 text-green-200' 
              : aiStatus.effectiveMode 
                ? 'bg-blue-500/30 text-blue-200'
                : 'bg-yellow-500/30 text-yellow-200'
          }`}>
            <span className="text-lg">
              {aiStatus.effectiveMode === 'local' ? '🔒' : 
               aiStatus.effectiveMode === 'cloud' ? '☁️' : '⚠️'}
            </span>
            <span className="font-semibold">{aiStatus.statusText}</span>
          </div>
        </div>

        {/* Tab Navigation */}
        <div className="flex border-b border-gray-700 bg-gray-800/50 flex-shrink-0">
          <button
            onClick={() => setActiveTab('setup')}
            className={`flex-1 px-6 py-3 font-semibold transition-colors ${
              activeTab === 'setup'
                ? 'text-cyan-400 border-b-2 border-cyan-400 bg-gray-900/50'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            ⚡ Quick Setup
          </button>
          <button
            onClick={() => setActiveTab('advanced')}
            className={`flex-1 px-6 py-3 font-semibold transition-colors ${
              activeTab === 'advanced'
                ? 'text-purple-400 border-b-2 border-purple-400 bg-gray-900/50'
                : 'text-gray-400 hover:text-gray-200'
            }`}
          >
            🔧 Advanced
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 overflow-y-auto flex-1">
          
          {activeTab === 'setup' && (
            <>
              {/* STEP 1: Choose Your AI Mode */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span className="w-8 h-8 bg-cyan-500/20 text-cyan-400 rounded-full flex items-center justify-center text-sm font-bold">1</span>
                  Choose Your AI
                </h3>
                
                {/* Option A: Local AI (Privacy First) */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  aiStatus.effectiveMode === 'local'
                    ? 'bg-green-900/30 border-green-500'
                    : webGPUStatus.supported
                      ? 'bg-gray-800/50 border-gray-700 hover:border-cyan-500/50'
                      : 'bg-gray-800/30 border-gray-700 opacity-60'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-green-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">🔒</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white">Local AI - 100% Private</h4>
                        {deviceCapability.tier !== DEVICE_TIERS.UNSUPPORTED && (
                          <span className="px-2 py-0.5 bg-green-500/30 text-green-300 text-xs font-bold rounded-full">
                            RECOMMENDED
                          </span>
                        )}
                        {aiStatus.effectiveMode === 'local' && (
                          <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full animate-pulse">
                            ACTIVE
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        Runs entirely on your device. Zero data transmitted. Works offline.
                      </p>
                      
                      {webGPUStatus.supported && webGPUStatus.device && (
                        <p className="text-cyan-400 text-xs mt-2">
                          🎮 GPU Ready: {webGPUStatus.device}
                        </p>
                      )}
                      
                      {!webGPUStatus.supported && webGPUStatus.checked && (
                        <p className="text-red-400 text-xs mt-2">
                          ❌ WebGPU not available on this device
                        </p>
                      )}
                      
                      {/* Model Selection - Simple */}
                      {webGPUStatus.supported && !isReady && (
                        <div className="mt-4 space-y-3">
                          <p className="text-gray-300 text-sm font-medium">Select AI Model:</p>
                          <div className="grid gap-2">
                            {MODELS.map(model => (
                              <button
                                key={model.id}
                                onClick={() => setSelectedModel(model)}
                                className={`p-3 rounded-lg border-2 text-left transition-all ${
                                  selectedModel.id === model.id
                                    ? 'bg-cyan-900/30 border-cyan-500'
                                    : 'bg-gray-800/50 border-gray-700 hover:border-gray-600'
                                }`}
                              >
                                <div className="flex items-center justify-between">
                                  <div>
                                    <p className="font-semibold text-white text-sm">{model.name}</p>
                                    <p className="text-gray-400 text-xs">{model.description}</p>
                                    <p className="text-gray-500 text-xs mt-1">
                                      {model.size} download • {model.vramRequired} VRAM
                                    </p>
                                  </div>
                                  {selectedModel.id === model.id && (
                                    <span className="text-cyan-400">✓</span>
                                  )}
                                </div>
                              </button>
                            ))}
                          </div>
                          
                          <button
                            onClick={initializeEngine}
                            disabled={isLoading}
                            className="w-full py-3 px-4 bg-gradient-to-r from-cyan-600 to-blue-600 hover:from-cyan-500 hover:to-blue-500 text-white font-bold rounded-xl transition-all disabled:opacity-50"
                          >
                            {isLoading ? (
                              <span className="flex items-center justify-center gap-2">
                                <span className="animate-spin">⏳</span> {loadProgress.text} ({loadProgress.progress}%)
                              </span>
                            ) : (
                              <span>🚀 Download & Activate Local AI</span>
                            )}
                          </button>
                          
                          {isLoading && (
                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-gradient-to-r from-cyan-500 to-blue-500 transition-all duration-300"
                                style={{ width: `${loadProgress.progress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                      
                      {/* Active State */}
                      {isReady && (
                        <div className="mt-4 flex gap-2">
                          <span className="flex-1 py-2 px-4 bg-green-500/20 text-green-300 font-medium rounded-lg text-center text-sm">
                            ✅ AI Active & Private
                          </span>
                          <button
                            onClick={handleUnloadLocalAI}
                            disabled={isUnloading}
                            className="py-2 px-4 bg-red-500/20 text-red-400 font-medium rounded-lg hover:bg-red-500/30 transition-colors text-sm disabled:opacity-50"
                          >
                            {isUnloading ? '⏳' : '⏹️ Unload'}
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                
                {/* Divider */}
                <div className="flex items-center gap-4">
                  <hr className="flex-1 border-gray-700" />
                  <span className="text-gray-500 text-sm">OR</span>
                  <hr className="flex-1 border-gray-700" />
                </div>
                
                {/* Option B: Cloud AI (Gemini) */}
                <div className={`p-4 rounded-xl border-2 transition-all ${
                  aiStatus.effectiveMode === 'cloud'
                    ? 'bg-blue-900/30 border-blue-500'
                    : 'bg-gray-800/50 border-gray-700 hover:border-blue-500/50'
                }`}>
                  <div className="flex items-start gap-4">
                    <div className="w-12 h-12 bg-blue-500/20 rounded-xl flex items-center justify-center flex-shrink-0">
                      <span className="text-2xl">☁️</span>
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h4 className="font-bold text-white">Cloud AI - Gemini (Free)</h4>
                        {aiStatus.effectiveMode === 'cloud' && (
                          <span className="px-2 py-0.5 bg-blue-500 text-white text-xs font-bold rounded-full animate-pulse">
                            ACTIVE
                          </span>
                        )}
                        {(deviceCapability.tier === DEVICE_TIERS.UNSUPPORTED || deviceCapability.tier === DEVICE_TIERS.LEGACY) && (
                          <span className="px-2 py-0.5 bg-blue-500/30 text-blue-300 text-xs font-bold rounded-full">
                            BEST FOR YOUR DEVICE
                          </span>
                        )}
                      </div>
                      <p className="text-gray-400 text-sm mt-1">
                        Fast responses via Google Gemini. Requires internet connection.
                      </p>
                      
                      {/* Warning */}
                      <div className="mt-3 p-2 bg-amber-900/20 border border-amber-500/30 rounded-lg">
                        <p className="text-amber-300 text-xs">
                          ⚠️ Your queries are sent to Google's servers. API key stays in YOUR browser only.
                        </p>
                      </div>
                      
                      {/* API Key Input */}
                      <div className="mt-3 space-y-2">
                        <div className="relative">
                          <input
                            type={showApiKey ? 'text' : 'password'}
                            value={apiKey}
                            onChange={(e) => setApiKey(e.target.value)}
                            placeholder="Enter Gemini API key..."
                            className="w-full px-4 py-2 pr-10 text-sm border-2 border-gray-600 rounded-lg bg-gray-800 text-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                          <button
                            type="button"
                            onClick={() => setShowApiKey(!showApiKey)}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-white p-1"
                          >
                            {showApiKey ? '👁️' : '👁️‍🗨️'}
                          </button>
                        </div>
                        
                        <div className="flex gap-2">
                          <button
                            onClick={handleSaveApiKey}
                            disabled={!apiKey.trim()}
                            className="flex-1 py-2 px-4 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 text-sm"
                          >
                            {apiKeySaved ? '✓ Saved!' : '💾 Save Key'}
                          </button>
                          {apiKey && (
                            <button
                              onClick={handleClearApiKey}
                              className="py-2 px-4 bg-red-500/20 text-red-400 rounded-lg hover:bg-red-500/30 transition-colors text-sm"
                            >
                              Clear
                            </button>
                          )}
                        </div>
                        
                        <a
                          href="https://aistudio.google.com/app/apikey"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs text-blue-400 hover:underline"
                        >
                          🔗 Get free API key from Google AI Studio →
                        </a>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Quick Tips */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h4 className="font-bold text-white mb-2 flex items-center gap-2">
                  <span>💡</span> Quick Tips
                </h4>
                <ul className="text-sm text-gray-400 space-y-1">
                  <li>• <strong className="text-green-400">Local AI</strong> = 100% private, works offline</li>
                  <li>• <strong className="text-blue-400">Cloud AI</strong> = faster but sends data to Google</li>
                  <li>• Both use the same Diamond Knowledge Base (130K+ VA entries)</li>
                </ul>
              </div>
            </>
          )}

          {activeTab === 'advanced' && (
            <>
              {/* Token Limit */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>📊</span> Response Length
                </h3>
                <TokenLimitConfig />
              </div>

              <hr className="border-gray-700" />

              {/* AI Preset */}
              <div className="space-y-4">
                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                  <span>🎯</span> AI Personality
                </h3>
                <PresetSelector 
                  value={selectedPreset}
                  onChange={(name) => handlePresetChange(name)}
                />
              </div>

              <hr className="border-gray-700" />

              {/* GPU Selection (if WebGPU available) */}
              {webGPUStatus.supported && (
                <div className="space-y-4">
                  <h3 className="text-lg font-bold text-white flex items-center gap-2">
                    <span>🎮</span> GPU Settings
                  </h3>
                  <GPUSelector 
                    onGPUSelected={() => {}}
                    autoSelect={false}
                  />
                </div>
              )}

              {/* DKB Info */}
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-xl p-4">
                <div className="flex items-start gap-3">
                  <span className="text-2xl">💎</span>
                  <div>
                    <h4 className="font-bold text-purple-300">Diamond Knowledge Base</h4>
                    <p className="text-gray-400 text-sm mt-1">
                      Both Local and Cloud AI use our 130,000+ entry database of VA regulations, 
                      38 CFR, BVA decisions, and CAVC rulings.
                    </p>
                    <p className="text-purple-400/80 text-xs mt-2">
                      Local AI: 6-8 entries per query (optimized for GPU memory)
                      <br />
                      Cloud AI: 8-10 entries per query (full context)
                    </p>
                  </div>
                </div>
              </div>

              {/* Device Info */}
              <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700">
                <h4 className="font-bold text-white mb-3 flex items-center gap-2">
                  <span>📱</span> Device Capability
                </h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <p className="text-gray-500 text-xs">Device Tier</p>
                    <p className="text-white font-semibold">
                      {deviceCapability.tier === DEVICE_TIERS.HIGH_END ? '🚀 High-End' :
                       deviceCapability.tier === DEVICE_TIERS.MID_RANGE ? '⚡ Mid-Range' :
                       deviceCapability.tier === DEVICE_TIERS.LEGACY ? '📱 Legacy' :
                       '❓ Unknown'}
                    </p>
                  </div>
                  <div className="bg-gray-900/50 p-3 rounded-lg">
                    <p className="text-gray-500 text-xs">WebGPU</p>
                    <p className={`font-semibold ${webGPUStatus.supported ? 'text-green-400' : 'text-red-400'}`}>
                      {webGPUStatus.supported ? '✅ Supported' : '❌ Not Available'}
                    </p>
                  </div>
                  {webGPUStatus.supported && webGPUStatus.device && (
                    <div className="bg-gray-900/50 p-3 rounded-lg col-span-2">
                      <p className="text-gray-500 text-xs">Active GPU</p>
                      <p className="text-cyan-400 font-semibold">{webGPUStatus.device}</p>
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-gray-800/50 rounded-b-2xl border-t border-gray-700 flex-shrink-0">
          <button
            onClick={onClose}
            className="w-full py-3 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded-xl transition-colors"
          >
            Done
          </button>
          <div className="flex items-center justify-center gap-2 text-xs text-gray-500 mt-3">
            <span>🔒</span>
            <span>Your data, your device, your control</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AICommandCenter;
