import React, { useState, useEffect, useCallback } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { triggerPanicRedirect } from '../utils/safetyRedirect';
import { getAvailableVoices, setVoice, previewVoice, getVoiceSettings, updateVoiceSettings } from '../utils/voiceEngine';
import { getVoiceOrchestrator } from '../services/VoiceOrchestrator';
import { getPrivacyPromise } from '../utils/toneMapper';

/**
 * InclusiveVoiceSetup Component
 * 
 * Comprehensive voice setup with:
 * - Safety verification (safe space check)
 * - Inclusive voice selection by cultural region
 * - Voice preview
 * - Settings (pitch, rate, volume)
 * - Panic key information
 * 
 * This is the main entry point for enabling the "Talk Back" feature
 */
const InclusiveVoiceSetup = ({ 
  onComplete, 
  onCancel,
  showSafetyCheck = true,
  defaultLanguage = 'en',
  className = ''
}) => {
  const { t } = useLanguage();
  // Steps: SAFETY -> LANGUAGE -> SELECT -> SETTINGS
  const [step, setStep] = useState(showSafetyCheck ? 'SAFETY' : 'LANGUAGE');
  const [voices, setVoices] = useState({ all: [], categorized: {} });
  const [selectedVoice, setSelectedVoice] = useState(null);
  const [selectedLanguage, setSelectedLanguage] = useState(defaultLanguage);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [settings, setSettings] = useState(getVoiceSettings());
  const [isLoading, setIsLoading] = useState(true);
  
  // Load available voices
  useEffect(() => {
    const loadVoices = () => {
      const available = getAvailableVoices();
      setVoices(available);
      setIsLoading(false);
    };
    
    loadVoices();
    
    // Some browsers load voices async
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.onvoiceschanged = loadVoices;
    }
    
    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);
  
  // Handle voice selection
  const handleVoiceSelect = useCallback((voice) => {
    setSelectedVoice(voice);
    setVoice(voice);
  }, []);
  
  // Handle voice preview
  const handlePreview = useCallback((voice) => {
    previewVoice(voice, "I'm here to support you with your claim. Together, we've got this.");
  }, []);
  
  // Handle settings change
  const handleSettingsChange = useCallback((key, value) => {
    const newSettings = { ...settings, [key]: value };
    setSettings(newSettings);
    updateVoiceSettings(newSettings);
  }, [settings]);
  
  // Handle completion
  const handleComplete = useCallback(() => {
    // Configure the voice orchestrator
    const orchestrator = getVoiceOrchestrator();
    orchestrator.setLanguage(selectedLanguage);
    if (selectedBranch) {
      orchestrator.setBranch(selectedBranch);
    }
    orchestrator.enable();
    
    // Call completion callback
    if (onComplete) {
      onComplete({
        voice: selectedVoice,
        language: selectedLanguage,
        branch: selectedBranch,
        settings
      });
    }
  }, [selectedVoice, selectedLanguage, selectedBranch, settings, onComplete]);
  
  // Language options
  const languages = [
    { code: 'en', name: 'English', flag: '🇺🇸' },
    { code: 'es', name: 'Español', flag: '🇲🇽' },
    { code: 'tl', name: 'Tagalog', flag: '🇵🇭' },
    { code: 'vi', name: 'Tiếng Việt', flag: '🇻🇳' },
    { code: 'ko', name: '한국어', flag: '🇰🇷' }
  ];
  
  // Branch options
  const branches = [
    { value: 'Army', label: 'Army', emoji: '⭐' },
    { value: 'Marine', label: 'Marine Corps', emoji: '🦅' },
    { value: 'Navy', label: 'Navy', emoji: '⚓' },
    { value: 'Air Force', label: 'Air Force', emoji: '✈️' },
    { value: 'Coast Guard', label: 'Coast Guard', emoji: '🚢' },
    { value: 'Space Force', label: 'Space Force', emoji: '🚀' }
  ];
  
  // Render Safety Check Step
  if (step === 'SAFETY') {
    return (
      <div className={`p-6 bg-slate-900 border-2 border-yellow-500/50 rounded-xl shadow-xl ${className}`}>
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/20 rounded-lg">
            <svg className="w-6 h-6 text-yellow-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-white">Safety Verification</h2>
        </div>
        
        <p className="text-slate-300 mb-6 leading-relaxed">
          Before we enable voice features, please confirm you are in a safe, private space 
          to discuss your service and medical history.
        </p>
        
        <ul className="space-y-3 mb-6 text-sm text-slate-400">
          <li className="flex items-center gap-3">
            <span className="text-green-400">✓</span>
            I am in a private place where others won't overhear
          </li>
          <li className="flex items-center gap-3">
            <span className="text-green-400">✓</span>
            I feel grounded and ready to discuss my claim
          </li>
          <li className="flex items-center gap-3">
            <span className="text-green-400">✓</span>
            I know I can stop this conversation at any time
          </li>
        </ul>
        
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
          <p className="text-xs text-slate-400 flex items-center gap-2">
            <span className="text-blue-400">💡</span>
            <span>
              <strong>Quick Exit:</strong> Triple-tap the <kbd className="px-1.5 py-0.5 bg-slate-700 rounded text-xs">Esc</kbd> key 
              at any time to instantly hide this app.
            </span>
          </p>
        </div>
        
        <div className="flex flex-col gap-3">
          <button
            onClick={() => setStep('LANGUAGE')}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 px-4 rounded-lg transition-all shadow-lg hover:shadow-blue-500/25"
          >
            I'm in a safe space - Let's continue
          </button>
          
          {onCancel && (
            <button
              onClick={onCancel}
              className="w-full bg-transparent border border-slate-700 text-slate-400 hover:text-slate-300 py-2 px-4 rounded-lg transition-colors"
            >
              Not right now
            </button>
          )}
        </div>
      </div>
    );
  }
  
  // Render Language Selection Step
  if (step === 'LANGUAGE') {
    return (
      <div className={`p-6 bg-slate-900 border border-blue-500/30 rounded-xl ${className}`}>
        <h2 className="text-xl font-bold text-white mb-2">Choose Your Language</h2>
        <p className="text-slate-400 mb-6 text-sm">
          Select the language you're most comfortable with. The AI will speak to you in this language.
        </p>
        
        <div className="grid grid-cols-1 gap-3 mb-6">
          {languages.map((lang) => (
            <button
              key={lang.code}
              onClick={() => setSelectedLanguage(lang.code)}
              className={`p-4 rounded-lg border-2 text-left transition-all flex items-center gap-4 ${
                selectedLanguage === lang.code
                  ? 'border-blue-500 bg-blue-500/10'
                  : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
              }`}
            >
              <span className="text-2xl">{lang.flag}</span>
              <span className="text-white font-medium">{lang.name}</span>
              {selectedLanguage === lang.code && (
                <span className="ml-auto text-blue-400">✓</span>
              )}
            </button>
          ))}
        </div>
        
        <div className="mb-6">
          <label className="block text-sm text-slate-400 mb-2">
            Your Service Branch (optional)
          </label>
          <div className="grid grid-cols-2 gap-2">
            {branches.map((branch) => (
              <button
                key={branch.value}
                onClick={() => setSelectedBranch(branch.value)}
                className={`p-2 rounded-lg border text-sm transition-all ${
                  selectedBranch === branch.value
                    ? 'border-blue-500 bg-blue-500/10 text-white'
                    : 'border-slate-700 bg-slate-800/50 text-slate-400 hover:text-white'
                }`}
              >
                {branch.emoji} {branch.label}
              </button>
            ))}
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setStep('SAFETY')}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={() => setStep('SELECT')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-lg transition-all"
          >
            Continue to Voice Selection
          </button>
        </div>
      </div>
    );
  }
  
  // Render Voice Selection Step
  if (step === 'SELECT') {
    return (
      <div className={`p-6 bg-slate-900 border border-blue-500/30 rounded-xl ${className}`}>
        <h2 className="text-xl font-bold text-white mb-2">Choose Your Peer Voice</h2>
        <p className="text-slate-400 mb-4 text-sm">
          Select the voice that feels most supportive to you. This choice stays 100% private.
        </p>
        
        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full" />
          </div>
        ) : (
          <div className="space-y-4 mb-6 max-h-[400px] overflow-y-auto pr-2 custom-scrollbar">
            {Object.entries(voices.categorized).map(([category, categoryVoices]) => 
              categoryVoices.length > 0 && (
                <div key={category}>
                  <h3 className="text-xs uppercase tracking-wider text-slate-500 mb-2 sticky top-0 bg-slate-900 py-1">
                    {category}
                  </h3>
                  <div className="grid grid-cols-1 gap-2">
                    {categoryVoices.map((voice) => (
                      <button
                        key={voice.name}
                        onClick={() => handleVoiceSelect(voice)}
                        className={`p-3 rounded-lg border-2 text-left transition-all ${
                          selectedVoice?.name === voice.name
                            ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/10'
                            : 'border-slate-700 bg-slate-800/50 hover:border-slate-600'
                        }`}
                      >
                        <div className="flex justify-between items-center">
                          <div>
                            <span className="text-white font-medium block">{voice.name}</span>
                            <span className="text-xs text-slate-500">{voice.lang}</span>
                          </div>
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              handlePreview(voice);
                            }}
                            className="text-xs bg-slate-700 hover:bg-slate-600 px-3 py-1.5 rounded-full text-blue-300 transition-colors"
                          >
                            ▶ Sample
                          </button>
                        </div>
                      </button>
                    ))}
                  </div>
                </div>
              )
            )}
          </div>
        )}
        
        <div className="flex gap-3">
          <button
            onClick={() => setStep('LANGUAGE')}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <button
            disabled={!selectedVoice}
            onClick={() => setStep('SETTINGS')}
            className="flex-1 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-700 disabled:cursor-not-allowed text-white font-bold py-3 rounded-lg transition-all"
          >
            Continue to Settings
          </button>
        </div>
      </div>
    );
  }
  
  // Render Settings Step
  if (step === 'SETTINGS') {
    return (
      <div className={`p-6 bg-slate-900 border border-blue-500/30 rounded-xl ${className}`}>
        <h2 className="text-xl font-bold text-white mb-2">Voice Settings</h2>
        <p className="text-slate-400 mb-6 text-sm">
          Adjust the voice to your preference. Slower speeds can help with focus.
        </p>
        
        <div className="space-y-6 mb-8">
          {/* Speed */}
          <div>
            <label className="flex justify-between text-sm text-slate-300 mb-2">
              <span>Speed</span>
              <span className="text-slate-500">{Math.round(settings.rate * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.rate}
              onChange={(e) => handleSettingsChange('rate', parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Slower (TBI-friendly)</span>
              <span>Faster</span>
            </div>
          </div>
          
          {/* Pitch */}
          <div>
            <label className="flex justify-between text-sm text-slate-300 mb-2">
              <span>Pitch</span>
              <span className="text-slate-500">{Math.round(settings.pitch * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.5"
              max="1.5"
              step="0.05"
              value={settings.pitch}
              onChange={(e) => handleSettingsChange('pitch', parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
            <div className="flex justify-between text-xs text-slate-500 mt-1">
              <span>Lower</span>
              <span>Higher</span>
            </div>
          </div>
          
          {/* Volume */}
          <div>
            <label className="flex justify-between text-sm text-slate-300 mb-2">
              <span>Volume</span>
              <span className="text-slate-500">{Math.round(settings.volume * 100)}%</span>
            </label>
            <input
              type="range"
              min="0.1"
              max="1"
              step="0.1"
              value={settings.volume}
              onChange={(e) => handleSettingsChange('volume', parseFloat(e.target.value))}
              className="w-full accent-blue-500"
            />
          </div>
          
          {/* Test Voice */}
          <button
            onClick={() => handlePreview(selectedVoice)}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-300 py-2 rounded-lg border border-slate-700 transition-colors"
          >
            🔊 Test Voice with Current Settings
          </button>
        </div>
        
        {/* Privacy Promise */}
        <div className="bg-slate-800/50 rounded-lg p-4 mb-6 border border-slate-700">
          <div className="flex items-start gap-3">
            <span className="text-2xl">🔒</span>
            <p className="text-xs text-slate-400 leading-relaxed">
              {getPrivacyPromise(selectedLanguage)}
            </p>
          </div>
        </div>
        
        <div className="flex gap-3">
          <button
            onClick={() => setStep('SELECT')}
            className="px-4 py-2 text-slate-400 hover:text-white transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={handleComplete}
            className="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-3 rounded-lg transition-all shadow-lg hover:shadow-green-500/25"
          >
            ✓ Save & Enable Voice
          </button>
        </div>
        
        {/* Emergency Exit */}
        <div className="mt-6 flex justify-center">
          <button
            onClick={triggerPanicRedirect}
            className="text-xs text-red-400 hover:text-red-300 hover:underline"
          >
            Emergency Exit (Hide Now)
          </button>
        </div>
      </div>
    );
  }
  
  return null;
};

export default InclusiveVoiceSetup;
