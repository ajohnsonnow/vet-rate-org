/**
 * Vet-Rate.org - Guided Onboarding Flow
 * Copyright (c) 2024-2026 Anthony Johnson
 * 
 * AAAAA Design System - "Mission Planning" Intake
 * 
 * Progressive Disclosure: Instead of showing 41 tools, ask 3 questions
 * to surface the 5 most relevant tools for the user's specific stage.
 * 
 * Steps:
 * 1. Claim Status - Where are you in your journey?
 * 2. Health Focus - Which body systems?
 * 3. Privacy & AI Setup - Choose intelligence level
 */

import React, { useState, useEffect } from 'react';
import { useTheme } from '../contexts/ThemeContext';

const CLAIM_STAGES = [
  {
    id: 'just-starting',
    icon: '🔭',
    title: 'Just Starting',
    description: 'I want to learn what conditions I may be entitled to claim',
    tools: ['smart-search', 'pact-navigator', 'mos-hazard', 'secondary-scout', 'web-conditions'],
    color: 'blue',
  },
  {
    id: 'building-evidence',
    icon: '📂',
    title: 'Building Evidence',
    description: 'I have conditions identified and need to gather supporting evidence',
    tools: ['cfile-analyzer', 'blue-button', 'nexus-builder', 'witness-bench', 'dd214-analyzer'],
    color: 'violet',
  },
  {
    id: 'preparing-exam',
    icon: '🎯',
    title: 'Preparing for C&P Exam',
    description: 'I have an upcoming Compensation & Pension examination',
    tools: ['cap-simulator', 'symptom-logger', 'consistency-engine', 'red-team', 'forms-helper'],
    color: 'amber',
  },
  {
    id: 'recently-denied',
    icon: '⚖️',
    title: 'Recently Denied',
    description: 'I received a denial and want to understand my options',
    tools: ['denial-decoder', 'red-team', 'evidence-gaps', 'nexus-builder', 'vso-finder'],
    color: 'rose',
  },
  {
    id: 'maximize-rating',
    icon: '💰',
    title: 'Maximize My Rating',
    description: 'I want to understand my full rating potential and benefits',
    tools: ['tactical-calc', 'million-dollar', 'whatif-sandbox', 'tdiu-builder', 'retro-hunter'],
    color: 'green',
  },
];

const BODY_SYSTEMS = [
  { id: 'musculoskeletal', icon: '🦴', name: 'Musculoskeletal', desc: 'Back, joints, spine, orthopedic' },
  { id: 'mental-health', icon: '🧠', name: 'Mental Health', desc: 'PTSD, anxiety, depression, TBI' },
  { id: 'respiratory', icon: '🫁', name: 'Respiratory', desc: 'Lungs, asthma, sleep apnea' },
  { id: 'cardiovascular', icon: '❤️', name: 'Cardiovascular', desc: 'Heart, hypertension, circulation' },
  { id: 'neurological', icon: '⚡', name: 'Neurological', desc: 'Nerve damage, migraines, seizures' },
  { id: 'digestive', icon: '🔥', name: 'Digestive', desc: 'GERD, IBS, liver conditions' },
  { id: 'skin', icon: '🩹', name: 'Skin', desc: 'Scars, eczema, burn injuries' },
  { id: 'hearing-vision', icon: '👁️', name: 'Hearing & Vision', desc: 'Tinnitus, hearing loss, vision' },
  { id: 'toxic-exposure', icon: '☢️', name: 'Toxic Exposure', desc: 'Burn pits, Agent Orange, radiation', highlight: true },
];

const AI_OPTIONS = [
  {
    id: 'local-ai',
    icon: '🎖️',
    title: 'Warrant Council (Local AI)',
    description: '100% offline, maximum privacy. AI runs entirely on your device.',
    badge: 'Recommended',
    privacy: 'Maximum',
  },
  {
    id: 'cloud-ai',
    icon: '☁️',
    title: 'Cloud AI (Gemini)',
    description: 'Use your own Google Gemini API key for advanced analysis.',
    badge: null,
    privacy: 'Your API Key',
  },
  {
    id: 'no-ai',
    icon: '📊',
    title: 'Manual Mode',
    description: 'Use all tools without AI assistance. Full functionality, your expertise.',
    badge: null,
    privacy: 'No AI',
  },
];

export default function GuidedOnboarding({ onComplete, onSkip }) {
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();
  const [step, setStep] = useState(1);
  const [selections, setSelections] = useState({
    claimStage: null,
    bodySystems: [],
    aiMode: 'local-ai',
  });
  
  const handleClaimStageSelect = (stageId) => {
    setSelections(prev => ({ ...prev, claimStage: stageId }));
  };
  
  const handleBodySystemToggle = (systemId) => {
    setSelections(prev => ({
      ...prev,
      bodySystems: prev.bodySystems.includes(systemId)
        ? prev.bodySystems.filter(id => id !== systemId)
        : [...prev.bodySystems, systemId]
    }));
  };
  
  const handleAiModeSelect = (modeId) => {
    setSelections(prev => ({ ...prev, aiMode: modeId }));
  };
  
  const handleNext = () => {
    if (step < 3) {
      setStep(step + 1);
    } else {
      // Save selections and complete
      localStorage.setItem('vetrate-onboarding-complete', 'true');
      localStorage.setItem('vetrate-user-profile', JSON.stringify(selections));
      if (onComplete) onComplete(selections);
    }
  };
  
  const handleBack = () => {
    if (step > 1) setStep(step - 1);
  };
  
  const canProceed = () => {
    if (step === 1) return selections.claimStage !== null;
    if (step === 2) return true; // Body systems optional
    if (step === 3) return selections.aiMode !== null;
    return true;
  };
  
  const containerClasses = `
    min-h-screen flex flex-col
    ${isDark || isTbiComfort ? 'bg-gray-900' : 'bg-gradient-to-b from-slate-50 to-slate-100'}
  `;
  
  return (
    <div className={containerClasses}>
      {/* Header */}
      <header className={`px-4 py-6 ${isDark || isTbiComfort ? 'bg-gray-800/50' : 'bg-white/80'} backdrop-blur-sm border-b ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-200'}`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <div>
            <h1 className={`text-2xl font-black ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
              🎖️ Mission Planning
            </h1>
            <p className={`text-sm ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
              Let's personalize your claims journey
            </p>
          </div>
          
          <button
            onClick={onSkip}
            className={`
              text-sm font-medium px-4 py-2 rounded-lg
              ${isDark || isTbiComfort ? 'text-gray-400 hover:text-white hover:bg-gray-700' : 'text-slate-500 hover:text-slate-900 hover:bg-slate-100'}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          >
            Skip for now
          </button>
        </div>
        
        {/* Progress Bar */}
        <div className="max-w-3xl mx-auto mt-4">
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <div key={s} className="flex-1 flex items-center gap-2">
                <div className={`
                  flex-shrink-0 w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold
                  ${s < step 
                    ? 'bg-green-600 text-white' 
                    : s === step 
                      ? `${isDark || isTbiComfort ? 'bg-blue-600' : 'bg-blue-600'} text-white`
                      : `${isDark || isTbiComfort ? 'bg-gray-700 text-gray-500' : 'bg-slate-200 text-slate-400'}`}
                `}>
                  {s < step ? '✓' : s}
                </div>
                {s < 3 && (
                  <div className={`flex-1 h-1 rounded-full ${s < step ? 'bg-green-600' : `${isDark || isTbiComfort ? 'bg-gray-700' : 'bg-slate-200'}`}`} />
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2 text-xs font-medium">
            <span className={step >= 1 ? `${isDark || isTbiComfort ? 'text-blue-400' : 'text-blue-600'}` : `${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`}>
              Claim Stage
            </span>
            <span className={step >= 2 ? `${isDark || isTbiComfort ? 'text-blue-400' : 'text-blue-600'}` : `${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`}>
              Health Focus
            </span>
            <span className={step >= 3 ? `${isDark || isTbiComfort ? 'text-blue-400' : 'text-blue-600'}` : `${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-400'}`}>
              AI Setup
            </span>
          </div>
        </div>
      </header>
      
      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-8">
        <div className="max-w-3xl mx-auto">
          
          {/* Step 1: Claim Stage */}
          {step === 1 && (
            <div className="space-y-4">
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                  Where are you in your claims journey?
                </h2>
                <p className={`mt-2 ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
                  This helps us show you the most relevant tools first
                </p>
              </div>
              
              <div className="space-y-3">
                {CLAIM_STAGES.map((stage) => (
                  <button
                    key={stage.id}
                    onClick={() => handleClaimStageSelect(stage.id)}
                    className={`
                      w-full p-5 rounded-2xl border-2 text-left transition-all
                      ${selections.claimStage === stage.id
                        ? `${isDark || isTbiComfort ? 'border-blue-500 bg-blue-900/30' : 'border-blue-600 bg-blue-50'}`
                        : `${isDark || isTbiComfort ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{stage.icon}</span>
                      <div className="flex-1">
                        <h3 className={`text-lg font-bold ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                          {stage.title}
                        </h3>
                        <p className={`text-sm ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
                          {stage.description}
                        </p>
                      </div>
                      {selections.claimStage === stage.id && (
                        <span className="text-blue-500 text-2xl">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Step 2: Body Systems */}
          {step === 2 && (
            <div className="space-y-4">
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                  Which body systems are you addressing?
                </h2>
                <p className={`mt-2 ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
                  Select all that apply (optional) • This pre-loads relevant diagnostic codes
                </p>
              </div>
              
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {BODY_SYSTEMS.map((system) => (
                  <button
                    key={system.id}
                    onClick={() => handleBodySystemToggle(system.id)}
                    className={`
                      relative p-4 rounded-xl border-2 text-center transition-all
                      ${selections.bodySystems.includes(system.id)
                        ? `${isDark || isTbiComfort ? 'border-blue-500 bg-blue-900/30' : 'border-blue-600 bg-blue-50'}`
                        : `${isDark || isTbiComfort ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
                    `}
                  >
                    {system.highlight && (
                      <span className="absolute -top-1 -right-1 px-1.5 py-0.5 text-[9px] font-bold bg-amber-400 text-gray-900 rounded uppercase">
                        PACT
                      </span>
                    )}
                    <span className="text-2xl block mb-2">{system.icon}</span>
                    <h3 className={`text-sm font-bold ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                      {system.name}
                    </h3>
                    <p className={`text-xs mt-1 ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'}`}>
                      {system.desc}
                    </p>
                    {selections.bodySystems.includes(system.id) && (
                      <span className="absolute top-2 left-2 text-blue-500 text-lg">✓</span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          
          {/* Step 3: AI Setup */}
          {step === 3 && (
            <div className="space-y-4">
              <div className="text-center mb-8">
                <h2 className={`text-2xl font-bold ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                  Choose your intelligence level
                </h2>
                <p className={`mt-2 ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
                  All modes provide full tool access • AI enhances analysis capabilities
                </p>
              </div>
              
              <div className="space-y-3">
                {AI_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    onClick={() => handleAiModeSelect(option.id)}
                    className={`
                      w-full p-5 rounded-2xl border-2 text-left transition-all
                      ${selections.aiMode === option.id
                        ? `${isDark || isTbiComfort ? 'border-blue-500 bg-blue-900/30' : 'border-blue-600 bg-blue-50'}`
                        : `${isDark || isTbiComfort ? 'border-gray-700 bg-gray-800/50 hover:border-gray-600' : 'border-slate-200 bg-white hover:border-slate-300'}`}
                      focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
                    `}
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-3xl">{option.icon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h3 className={`text-lg font-bold ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                            {option.title}
                          </h3>
                          {option.badge && (
                            <span className="px-2 py-0.5 text-[10px] font-bold bg-green-600 text-white rounded-full uppercase">
                              {option.badge}
                            </span>
                          )}
                        </div>
                        <p className={`text-sm ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
                          {option.description}
                        </p>
                        <p className={`text-xs mt-1 font-medium ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'}`}>
                          Privacy: {option.privacy}
                        </p>
                      </div>
                      {selections.aiMode === option.id && (
                        <span className="text-blue-500 text-2xl">✓</span>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
          
        </div>
      </main>
      
      {/* Footer */}
      <footer className={`px-4 py-4 ${isDark || isTbiComfort ? 'bg-gray-800/50' : 'bg-white/80'} backdrop-blur-sm border-t ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-200'}`}>
        <div className="max-w-3xl mx-auto flex items-center justify-between">
          <button
            onClick={handleBack}
            disabled={step === 1}
            className={`
              px-6 py-3 rounded-xl font-medium min-h-touch
              ${step === 1 
                ? 'opacity-50 cursor-not-allowed' 
                : `${isDark || isTbiComfort ? 'text-gray-300 hover:bg-gray-700' : 'text-slate-700 hover:bg-slate-100'}`}
              focus:outline-none focus:ring-2 focus:ring-blue-500
            `}
          >
            ← Back
          </button>
          
          <button
            onClick={handleNext}
            disabled={!canProceed()}
            className={`
              px-8 py-3 rounded-xl font-bold min-h-touch
              ${canProceed()
                ? 'bg-blue-600 hover:bg-blue-700 text-white'
                : `${isDark || isTbiComfort ? 'bg-gray-700 text-gray-500' : 'bg-slate-200 text-slate-400'} cursor-not-allowed`}
              focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
              transition-colors
            `}
          >
            {step === 3 ? 'Complete Setup →' : 'Continue →'}
          </button>
        </div>
      </footer>
    </div>
  );
}

/**
 * Hook to check if user has completed onboarding
 */
export function useOnboardingStatus() {
  const [hasCompleted, setHasCompleted] = useState(false);
  const [userProfile, setUserProfile] = useState(null);
  
  useEffect(() => {
    const completed = localStorage.getItem('vetrate-onboarding-complete') === 'true';
    const profile = localStorage.getItem('vetrate-user-profile');
    
    setHasCompleted(completed);
    if (profile) {
      try {
        setUserProfile(JSON.parse(profile));
      } catch (e) {
        // Invalid JSON
      }
    }
  }, []);
  
  const resetOnboarding = () => {
    localStorage.removeItem('vetrate-onboarding-complete');
    localStorage.removeItem('vetrate-user-profile');
    setHasCompleted(false);
    setUserProfile(null);
  };
  
  return { hasCompleted, userProfile, resetOnboarding };
}
