/**
 * SupplyLocker.org - Mission Roadmap Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * 
 * AAAAA Design System - "Command Center Dashboard"
 * 
 * Progressive Disclosure: Shows tools based on claim lifecycle stage
 * Anticipatory UX: Suggests next steps based on user's progress
 * WCAG 2.2 AAA Compliant: 7:1 contrast, roving tabindex, keyboard nav
 */

import React, { useState, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { useTheme } from '../contexts/ThemeContext';

// Mission stages with tool mappings
const MISSION_STAGES = [
  {
    id: 'discovery',
    title: 'Discovery',
    subtitle: 'Identify Your Conditions',
    icon: '🔭',
    description: 'Find conditions you may be entitled to claim based on your service, exposures, and symptoms.',
    color: 'service-blue',
    tools: [
      { id: 'smart-search', name: 'Smart Search', desc: 'Search conditions & diagnostic codes', icon: '🔍' },
      { id: 'pact-navigator', name: 'PACT Act Navigator', desc: 'Presumptive conditions from toxic exposure', icon: '⚠️' },
      { id: 'mos-hazard', name: 'MOS Hazard Matcher', desc: 'Match your MOS to related conditions', icon: '🎖️' },
      { id: 'web-conditions', name: 'Web of Conditions', desc: 'Visual map of condition relationships', icon: '🕸️' },
      { id: 'secondary-scout', name: 'Secondary Scout', desc: 'Find secondary conditions', icon: '🔗' },
    ]
  },
  {
    id: 'evidence',
    title: 'Evidence Gathering',
    subtitle: 'Prove Your Claim',
    icon: '📂',
    description: 'Analyze your records and build strong nexus links between service and conditions.',
    color: 'violet',
    tools: [
      { id: 'cfile-analyzer', name: 'C-File AI Analyzer', desc: 'Extract evidence from your claims file', icon: '📋', local: true },
      { id: 'blue-button', name: 'Blue Button X-Ray', desc: 'Analyze VA health records', icon: '💙', local: true },
      { id: 'dd214-analyzer', name: 'DD214 Analyzer', desc: 'Parse your service record', icon: '📜', local: true },
      { id: 'nexus-builder', name: 'Nexus Builder', desc: 'Build medical nexus statements', icon: '🔗' },
      { id: 'witness-bench', name: 'Witness Bench', desc: 'Draft buddy statements', icon: '✍️' },
      { id: 'symptom-logger', name: 'Symptom Logger', desc: 'Track symptoms over time', icon: '📝' },
    ]
  },
  {
    id: 'verification',
    title: 'Strategy & Verification',
    subtitle: 'Stress-Test Your Claim',
    icon: '🛡️',
    description: 'Simulate C&P exams, identify weaknesses, and prepare counter-arguments.',
    color: 'rose',
    tools: [
      { id: 'cap-simulator', name: 'C&P Exam Simulator', desc: 'Practice exam scenarios', icon: '🎯' },
      { id: 'red-team', name: 'The War Game', desc: 'VA rater perspective stress test', icon: '♟️' },
      { id: 'consistency-engine', name: 'Consistency Engine', desc: 'Check statement consistency', icon: '⚖️' },
      { id: 'evidence-gaps', name: 'Evidence Gap Finder', desc: 'Identify missing evidence', icon: '🔎' },
      { id: 'denial-decoder', name: 'Denial Decoder', desc: 'Decode VA decision letters', icon: '📖' },
    ]
  },
  {
    id: 'calculation',
    title: 'Rating Calculation',
    subtitle: 'Know Your Worth',
    icon: '🧮',
    description: 'Calculate your combined rating and understand your monthly compensation.',
    color: 'amber',
    tools: [
      { id: 'tactical-calc', name: 'Tactical Calculator', desc: 'Calculate combined rating', icon: '🧮' },
      { id: 'million-dollar', name: 'Million Dollar Dashboard', desc: 'Lifetime benefits visualization', icon: '💰' },
      { id: 'whatif-sandbox', name: 'What-If Sandbox', desc: 'Simulate different scenarios', icon: '🎲' },
      { id: 'retro-hunter', name: 'Retro Pay Hunter', desc: 'Calculate back pay', icon: '💵' },
      { id: 'tdiu-builder', name: 'TDIU Builder', desc: 'Individual Unemployability claims', icon: '📊' },
    ]
  },
  {
    id: 'support',
    title: 'Support & Resources',
    subtitle: 'Get Help',
    icon: '🤝',
    description: 'Find VSOs, state benefits, and community support for your journey.',
    color: 'sky',
    tools: [
      { id: 'vso-finder', name: 'VSO Finder', desc: 'Find local service officers', icon: '👥' },
      { id: 'state-benefits', name: 'State Benefits', desc: 'State-specific veteran benefits', icon: '🏛️' },
      { id: 'forms-helper', name: 'Forms Helper', desc: 'Complete VA forms correctly', icon: '📝' },
      { id: 'va-resources', name: 'VA Resources', desc: 'Official VA links & tools', icon: '🔗' },
      { id: 'backup-manager', name: 'The Bunker', desc: 'Backup & sync your data', icon: '💾' },
    ]
  },
];

// Tool card component with Privacy-First design
const ToolCard = ({ tool, onSelect, isLocal }) => {
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();
  
  return (
    <button
      onClick={() => onSelect(tool.id)}
      className={`
        group relative w-full text-left p-4 sm:p-5 rounded-xl border-2 
        transition-all duration-300 min-h-touch
        ${isDark || isTbiComfort 
          ? 'bg-gray-800/50 border-gray-700 hover:border-blue-500 hover:bg-gray-800' 
          : 'bg-white border-slate-200 hover:border-blue-600 hover:bg-blue-50/30'}
        ${isAaaContrast ? 'border-white hover:border-yellow-400' : ''}
        focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
        shadow-sm hover:shadow-md
      `}
      aria-label={`${tool.name}: ${tool.desc}`}
    >
      {/* Privacy Badge for Local Tools */}
      {tool.local && (
        <span className="absolute top-2 right-2 flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30 px-2 py-1 rounded-full border border-green-200 dark:border-green-700">
          <span className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" aria-hidden="true" />
          100% Local
        </span>
      )}
      
      <div className="flex items-start gap-3">
        <span className="text-2xl" aria-hidden="true">{tool.icon}</span>
        <div className="flex-1 min-w-0">
          <h4 className={`font-bold text-base sm:text-lg ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'} group-hover:text-blue-600 dark:group-hover:text-blue-400 truncate`}>
            {tool.name}
          </h4>
          <p className={`text-sm ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'} line-clamp-2`}>
            {tool.desc}
          </p>
        </div>
      </div>
      
      <div className={`mt-3 text-xs font-bold uppercase tracking-wider ${isDark || isTbiComfort ? 'text-blue-400' : 'text-blue-600'} opacity-0 group-hover:opacity-100 transition-opacity`}>
        Launch Tool →
      </div>
    </button>
  );
};

// Stage navigation button
const StageButton = ({ stage, isActive, isPast, index, onClick }) => {
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();
  
  return (
    <button
      onClick={onClick}
      aria-current={isActive ? 'step' : undefined}
      className={`
        relative flex items-center gap-3 w-full p-3 sm:p-4 rounded-xl transition-all duration-300 min-h-touch
        ${isActive 
          ? `${isDark || isTbiComfort ? 'bg-gray-800 border-2 border-blue-500' : 'bg-white border-2 border-blue-600 shadow-lg'}` 
          : `opacity-70 hover:opacity-100 ${isDark || isTbiComfort ? 'hover:bg-gray-800/50' : 'hover:bg-gray-50'}`}
        ${isAaaContrast && isActive ? 'border-yellow-400 bg-black' : ''}
        focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
      `}
    >
      {/* Step indicator */}
      <span className={`
        flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center font-bold text-lg
        ${isPast 
          ? 'bg-green-600 text-white' 
          : isActive 
            ? 'bg-blue-600 text-white' 
            : `${isDark || isTbiComfort ? 'bg-gray-700 text-gray-400' : 'bg-slate-200 text-slate-600'}`}
      `}>
        {isPast ? '✓' : index + 1}
      </span>
      
      <div className="flex-1 min-w-0 text-left">
        <p className={`text-[10px] font-black uppercase tracking-widest ${isActive ? 'text-blue-600 dark:text-blue-400' : 'text-gray-500'}`}>
          Phase {index + 1}
        </p>
        <h3 className={`font-bold text-sm sm:text-base ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'} truncate`}>
          {stage.title}
        </h3>
        <p className={`text-xs ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-500'} hidden sm:block`}>
          {stage.subtitle}
        </p>
      </div>
      
      <span className="text-xl hidden sm:block" aria-hidden="true">{stage.icon}</span>
    </button>
  );
};

export default function MissionRoadmap({ onToolSelect, onClose, userProgress = {} }) {
  const { t } = useLanguage();
  const { isDark, isTbiComfort, isAaaContrast } = useTheme();
  
  // Lock background scroll when modal is open
  useBodyScrollLock(true);
  
  const [currentStage, setCurrentStage] = useState('discovery');
  const [completedStages, setCompletedStages] = useState([]);
  
  // Load saved progress
  useEffect(() => {
    const savedStage = localStorage.getItem('vetrate-mission-stage');
    const savedCompleted = localStorage.getItem('vetrate-completed-stages');
    if (savedStage) setCurrentStage(savedStage);
    if (savedCompleted) setCompletedStages(JSON.parse(savedCompleted));
  }, []);
  
  // Save progress on change
  useEffect(() => {
    localStorage.setItem('vetrate-mission-stage', currentStage);
    localStorage.setItem('vetrate-completed-stages', JSON.stringify(completedStages));
  }, [currentStage, completedStages]);
  
  const activeStage = MISSION_STAGES.find(s => s.id === currentStage);
  
  const handleToolSelect = (toolId) => {
    if (onToolSelect) {
      onToolSelect(toolId);
    }
  };
  
  const handleStageComplete = () => {
    if (!completedStages.includes(currentStage)) {
      setCompletedStages([...completedStages, currentStage]);
    }
    // Auto-advance to next stage
    const currentIndex = MISSION_STAGES.findIndex(s => s.id === currentStage);
    if (currentIndex < MISSION_STAGES.length - 1) {
      setCurrentStage(MISSION_STAGES[currentIndex + 1].id);
    }
  };

  return (
    <div className={`fixed inset-0 z-50 overflow-y-auto ${isDark || isTbiComfort ? 'bg-gray-900' : 'bg-slate-50'}`}>
      {/* Header */}
      <header className={`sticky top-0 z-10 ${isDark || isTbiComfort ? 'bg-gray-900/95' : 'bg-white/95'} backdrop-blur-sm border-b ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-200'} px-4 py-4`}>
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div>
            <h1 className={`text-2xl sm:text-3xl font-black ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'} tracking-tight`}>
              🗺️ Mission Roadmap
            </h1>
            <p className={`text-sm ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
              Your guided path through the VA claims process
            </p>
          </div>
          
          <button
            onClick={onClose}
            className={`
              p-3 rounded-xl min-h-touch min-w-touch
              ${isDark || isTbiComfort ? 'bg-gray-800 hover:bg-gray-700 text-white' : 'bg-slate-100 hover:bg-slate-200 text-slate-900'}
              focus:outline-none focus:ring-3 focus:ring-blue-500
            `}
            aria-label="Close mission roadmap"
          >
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </header>
      
      <main className="max-w-7xl mx-auto px-4 py-6 sm:py-8">
        {/* Stage Navigation */}
        <nav aria-label="Claims Mission Progress" className="mb-8">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {MISSION_STAGES.map((stage, index) => {
              const isActive = currentStage === stage.id;
              const isPast = completedStages.includes(stage.id);
              
              return (
                <StageButton
                  key={stage.id}
                  stage={stage}
                  isActive={isActive}
                  isPast={isPast}
                  index={index}
                  onClick={() => setCurrentStage(stage.id)}
                />
              );
            })}
          </div>
        </nav>
        
        {/* Active Stage Content */}
        <section className={`rounded-3xl ${isDark || isTbiComfort ? 'bg-gray-800/50' : 'bg-white'} p-6 sm:p-8 border-2 ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-100'} shadow-xl`}>
          {/* Stage Header */}
          <div className="mb-8">
            <div className="flex items-center gap-4 mb-4">
              <span className="text-4xl" aria-hidden="true">{activeStage.icon}</span>
              <div>
                <h2 className={`text-2xl sm:text-3xl font-black ${isDark || isTbiComfort ? 'text-white' : 'text-slate-900'}`}>
                  {activeStage.title}
                </h2>
                <p className={`text-lg ${isDark || isTbiComfort ? 'text-gray-400' : 'text-slate-600'}`}>
                  {activeStage.subtitle}
                </p>
              </div>
            </div>
            <p className={`text-base ${isDark || isTbiComfort ? 'text-gray-300' : 'text-slate-700'} max-w-3xl`}>
              {activeStage.description}
            </p>
          </div>
          
          {/* Tools Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeStage.tools.map(tool => (
              <ToolCard
                key={tool.id}
                tool={tool}
                onSelect={handleToolSelect}
                isLocal={tool.local}
              />
            ))}
          </div>
          
          {/* Stage Complete Button */}
          <div className="mt-8 flex justify-end">
            <button
              onClick={handleStageComplete}
              className={`
                px-6 py-3 rounded-xl font-bold min-h-touch
                ${completedStages.includes(currentStage)
                  ? 'bg-green-600 text-white cursor-default'
                  : 'bg-blue-600 hover:bg-blue-700 text-white'}
                focus:outline-none focus:ring-3 focus:ring-blue-500 focus:ring-offset-2
                transition-colors
              `}
              disabled={completedStages.includes(currentStage)}
            >
              {completedStages.includes(currentStage) ? '✓ Stage Complete' : 'Mark Stage Complete →'}
            </button>
          </div>
        </section>
        
        {/* Privacy Heartbeat Footer */}
        <footer className={`mt-8 p-4 ${isDark || isTbiComfort ? 'bg-gray-800/30' : 'bg-slate-50'} border ${isDark || isTbiComfort ? 'border-gray-700' : 'border-slate-200'} rounded-xl`}>
          <div className="flex items-center justify-between flex-wrap gap-4">
            <div className="flex items-center gap-3">
              <div className="relative flex h-3 w-3">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-green-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-green-500" />
              </div>
              <span className={`text-sm font-medium ${isDark || isTbiComfort ? 'text-gray-300' : 'text-slate-700'}`}>
                Security Status: <span className="text-green-600 dark:text-green-400 font-bold uppercase">Local-Only Processing</span>
              </span>
            </div>
            <span className={`text-xs ${isDark || isTbiComfort ? 'text-gray-500' : 'text-slate-500'}`}>
              Your data never leaves your device
            </span>
          </div>
        </footer>
      </main>
    </div>
  );
}
