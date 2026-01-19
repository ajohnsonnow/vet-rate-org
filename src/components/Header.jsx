import React, { useState, useEffect } from 'react';
import AccessibilityMenu from './AccessibilityMenu';
import FundingModal from './FundingModal';
import HelperModeToggle from './HelperModeToggle';
import KnowledgeBaseStatus from './KnowledgeBaseStatus';
import VersionDropdown from './VersionDropdown';
import { ConsistencyBadge } from './ConsistencyEngine';
import { AIStatusBadge } from './AIModeSelector';
import { useTheme } from '../contexts/ThemeContext';
import { useHelperMode } from '../contexts/HelperModeContext';
import { hasUnsavedChanges } from '../utils/dataPersistence';
import { useColorSchemas } from '../hooks/useColorSchemas';

function Header({ 
  // Core Navigation
  onMyPacketClick, 
  onUserManualClick,
  onVAResourcesClick,
  // Calculate Your Rating (Blue)
  onTacticalCalculatorClick,
  onMillionDollarDashboardClick,
  onWhatIfSandboxClick,
  onRetroPayHunterClick,
  onTimeMachineClick,
  // Discover Your Claims (Teal)
  onSecondaryScoutClick,
  onCAPSimulatorClick,
  // ExamPrepRoom merged into CAPSimulator
  onPathfinderClick,
  onMOSHazardMatcherClick,
  onPACTActNavigatorClick,
  onWebOfConditionsClick,
  // Build Your Evidence (Violet)
  onCFileAnalyzerClick,
  onBlueButtonXRayClick,
  onRecordSearchClick,
  onWitnessBenchClick,
  onNexusBuilderClick,
  onFormsHelperClick,
  onSymptomLoggerClick,
  onPainPainterClick,
  onEvidenceTimelineClick,
  onFOIAGeneratorClick,
  // Quality Control (Rose)
  onRedTeamClick,
  onClaimStressTestClick,
  onDecisionDecoderClick,
  onDenialDecoderClick,
  onSharkRadarClick,
  onConsistencyEngineClick,
  onEvidenceGapVisualizerClick,
  onRiskAssessmentClick,
  // Maximize Your Rating (Amber)
  onTDIUBuilderClick,
  onStateBenefitHunterClick,
  onTheTribunalClick,
  onLegislativeWatchdogClick,
  // Support & Resources (Sky)
  onVSOFinderClick,
  onBackupManagerClick,
  onCloudSyncClick,
  onAISettingsClick
}) {
  const { isDark, toggleTheme } = useTheme();
  const { isHelperMode } = useHelperMode();
  const { getDropdownClasses, getColorClass, colors } = useColorSchemas();
  const dropdownClasses = getDropdownClasses();
  
  const [showResourcesMenu, setShowResourcesMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [shouldPulseBackup, setShouldPulseBackup] = useState(false);

  // Check for unsaved changes periodically
  useEffect(() => {
    const checkForChanges = () => {
      setShouldPulseBackup(hasUnsavedChanges());
    };
    
    // Check immediately
    checkForChanges();
    
    // Check every 10 seconds
    const interval = setInterval(checkForChanges, 10000);
    
    return () => clearInterval(interval);
  }, []);

  const veteranResources = [
    // CRISIS - Always first
    {
      name: '🆘 Veterans Crisis Line',
      url: 'https://www.veteranscrisisline.net/',
      description: 'Call 988, Press 1 | Text 838255',
      urgent: true
    },
    // HEALTH & MEDICAL
    {
      name: '🏥 VA Health Care',
      url: 'https://www.va.gov/health-care/',
      description: 'Apply for VA health benefits'
    },
    {
      name: '🧠 Mental Health & PTSD',
      url: 'https://www.ptsd.va.gov/',
      description: 'PTSD treatment & resources'
    },
    {
      name: '⚠️ PACT Act Benefits',
      url: 'https://www.va.gov/resources/the-pact-act-and-your-va-benefits/',
      description: 'New presumptive conditions & eligibility',
      highlight: true
    },
    {
      name: '🧪 Toxic Exposure Assessment',
      url: 'https://www.publichealth.va.gov/MEEA/index.asp',
      description: 'Free MEEA evaluations'
    },
    // SPECIALIZED VETERAN POPULATIONS
    {
      name: '👩 Women Veterans',
      url: 'https://www.va.gov/womenvet/',
      description: 'Resources for women Veterans'
    },
    {
      name: '🏳️‍🌈 LGBTQ+ Veterans',
      url: 'https://www.patientcare.va.gov/lgbt/',
      description: 'LGBTQ+ Veteran Care Coordinators at every VA'
    },
    {
      name: '🏠 Homeless Veterans',
      url: 'https://www.va.gov/homeless/',
      description: 'Call 1-877-4AID-VET (1-877-424-3838)'
    },
    // BENEFITS & SERVICES
    {
      name: '🎓 GI Bill Benefits',
      url: 'https://www.va.gov/education/',
      description: 'Education & training benefits'
    },
    {
      name: '💼 Veteran Jobs',
      url: 'https://www.va.gov/careers-employment/',
      description: 'Employment resources & training'
    },
    {
      name: '🏡 VA Home Loans',
      url: 'https://www.va.gov/housing-assistance/',
      description: 'Home loan & housing assistance'
    },
    {
      name: '👨‍👩‍👧‍👦 Caregiver Support',
      url: 'https://www.caregiver.va.gov/',
      description: 'Support for veteran caregivers'
    },
    // APPEALS & COMPREHENSIVE RESOURCES
    {
      name: '⚖️ Board of Veterans Appeals',
      url: 'https://www.bva.va.gov/',
      description: 'Appeal your VA decision'
    },
    {
      name: '📚 National Resource Directory',
      url: 'https://nrd.gov/',
      description: 'Database of vetted resources & services',
      highlight: true
    }
  ];

  return (
    <header className="bg-gradient-to-r from-va-blue to-green-900 dark:from-emerald-900 dark:to-emerald-950 text-white shadow-lg" role="banner">
      {/* Skip Link for Screen Readers */}
      <a href="#main-content" className="skip-link sr-only focus:not-sr-only">
        Skip to main content
      </a>
      
      {/* Crisis Line Banner - Always Visible */}
      <div className="bg-red-700 dark:bg-red-900 text-white text-center py-1.5 px-4 text-sm">
        <a 
          href="https://www.veteranscrisisline.net/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="hover:underline font-medium"
        >
          🆘 Veterans Crisis Line: <strong>Call 988, Press 1</strong> | Text 838255 | Chat online 24/7
        </a>
      </div>
      
      <div className="container mx-auto px-4 py-6 max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="rounded-full h-16 w-16 md:h-20 md:w-20 flex-shrink-0 overflow-hidden shadow-md">
              <img 
                src="/images/Vet-Rate-org-logo-official.png" 
                alt="Vet-Rate.org Logo" 
                className="h-full w-full object-cover"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold whitespace-nowrap">Vet-Rate.org</h1>
              <p className="text-green-100 dark:text-gray-300 text-sm md:text-base whitespace-nowrap">
                Free VA Claims Toolkit for Veterans
              </p>
              <div className="mt-2 flex items-center gap-2">
                <KnowledgeBaseStatus compact />
                <AIStatusBadge showLabel={false} onClick={onAISettingsClick} />
                <VersionDropdown />
              </div>
            </div>
          </div>

          <nav className="flex flex-wrap justify-center gap-4 md:gap-6 items-center" role="navigation" aria-label="Main navigation">
            {/* Help - First thing users need */}
            <button
              id="tour-help-btn"
              onClick={onUserManualClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="User Manual - Documentation & Help"
              aria-label="Open User Manual for documentation and help"
            >
              ❓ Help
            </button>
            
            {/* My Packet - Where users save everything */}
            <button
              id="tour-my-packet-btn"
              onClick={onMyPacketClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="My Packet - View saved claims"
              aria-label="Open My Packet to view your saved claims"
            >
              📁 My Packet
            </button>
            
            {/* Tools Dropdown - Main feature tools */}
            <div id="tour-tools-dropdown" className="relative static sm:relative">
              <button
                onClick={() => setShowToolsMenu(!showToolsMenu)}
                onBlur={() => setTimeout(() => setShowToolsMenu(false), 200)}
                className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1 flex items-center gap-1"
                title="Claims Tools"
                aria-expanded={showToolsMenu}
                aria-haspopup="true"
              >
                🛠️ Tools
                <svg className={`w-4 h-4 transition-transform ${showToolsMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showToolsMenu && (
                <div className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-96 rounded-lg shadow-xl z-50 overflow-hidden max-h-[80vh] overflow-y-auto ${dropdownClasses.menu.replace('absolute mt-2', '')}`}>
                  <div className="p-2">
                    
                    {/* CALCULATE - Blue Theme */}
                    <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-lg p-2 mb-2">
                      <p className="text-xs text-blue-700 dark:text-blue-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        📊 Calculate Your Rating
                      </p>
                      <button
                        onClick={() => { setShowToolsMenu(false); onTacticalCalculatorClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40 bg-white/50 dark:bg-blue-800/30"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🧮 Tactical Calculator
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">CORE</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          VA Math calculator with 2026 rates
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onMillionDollarDashboardClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          💰 Million Dollar Dashboard
                          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded animate-pulse">WOW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          See your lifetime benefits value
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onWhatIfSandboxClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🎯 What-If Sandbox
                          <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">DRAG&DROP</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Scenario planner with real VA math
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onRetroPayHunterClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          ⏰ Retro Pay Hunter
                          <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">💰</span>
                          <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Find missed back pay & CUE claims
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onTimeMachineClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-100 dark:hover:bg-blue-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          📅 Time Machine
                          <span className="px-1.5 py-0.5 bg-blue-600 text-white text-[10px] font-bold rounded">ITF</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Intent to File countdown & backpay tracker
                        </p>
                      </button>
                    </div>
                    
                    {/* DISCOVER - Teal Theme */}
                    <div className="bg-gradient-to-r from-teal-50 to-emerald-50 dark:from-teal-900/20 dark:to-emerald-900/20 rounded-lg p-2 mb-2">
                      <p className="text-xs text-teal-700 dark:text-teal-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 bg-teal-500 rounded-full"></span>
                        🔍 Discover Your Claims
                      </p>
                      <button
                        onClick={() => { setShowToolsMenu(false); onSecondaryScoutClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔍 Secondary Scout
                          <span className="px-1.5 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded">INSTANT</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Quick lookup: 500+ known secondary connections
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onCAPSimulatorClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          ✅ C&P Exam Simulator
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Practice with DBQ-aligned exam questions + Exam Prep
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onPathfinderClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🧭 Pathfinder
                          <span className="px-1.5 py-0.5 bg-teal-600 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          AI strategy: increases, secondaries & next steps
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onMOSHazardMatcherClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🎖️ MOS Hazard Matcher
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Find injuries linked to your MOS
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onPACTActNavigatorClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40 bg-white/50 dark:bg-teal-800/30"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          ☢️ PACT Act Navigator
                          <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">HOT</span>
                        </span>
                        <p className="text-xs mt-0.5 text-teal-700 dark:text-teal-400">
                          Find your presumptive conditions
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onWebOfConditionsClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-100 dark:hover:bg-teal-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🕸️ Web of Conditions
                          <span className="px-1.5 py-0.5 bg-teal-500 text-white text-[10px] font-bold rounded">INTERACTIVE</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Visual map of connected conditions
                        </p>
                      </button>
                    </div>
                    
                    {/* BUILD YOUR EVIDENCE - Violet Theme */}
                    <div className="bg-gradient-to-r from-violet-50 to-purple-50 dark:from-violet-900/20 dark:to-purple-900/20 rounded-lg p-2 mb-2">
                      <p className="text-xs text-violet-700 dark:text-violet-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 bg-violet-500 rounded-full"></span>
                        📋 Build Your Evidence
                      </p>
                      <button
                        onClick={() => { setShowToolsMenu(false); onCFileAnalyzerClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40 bg-white/50 dark:bg-violet-800/30"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔬 C-File AI Analyzer
                          <span className="px-1.5 py-0.5 bg-violet-600 text-white text-[10px] font-bold rounded">AI</span>
                          <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">FREE</span>
                        </span>
                        <p className="text-xs mt-0.5 text-violet-600 dark:text-violet-400">
                          AI analysis of your claims file (worth $500+)
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onBlueButtonXRayClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          💙 Blue Button X-Ray
                          <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Analyze VA Blue Button health records
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onRecordSearchClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔍 PDF Evidence Finder
                          <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">NEW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Search 2,000+ page STRs for keywords
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onWitnessBenchClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          👥 Witness Bench
                          <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          AI-assisted buddy statement generator
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onNexusBuilderClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔗 Nexus Builder
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Build medical connection arguments
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onFormsHelperClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          ✏️ Forms Helper
                          <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">16+</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Guided VA forms with Auto-Scribe
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onSymptomLoggerClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          📝 Symptom Logger
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Track symptoms with timestamp evidence
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onPainPainterClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🎯 Somatic Target
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Interactive body map selector
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onEvidenceTimelineClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🧵 Evidence Timeline
                          <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">NEW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Visual continuity tracker with gap detection
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onFOIAGeneratorClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-violet-100 dark:hover:bg-violet-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔑 FOIA Keysmith
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Generate FOIA requests for records
                        </p>
                      </button>
                    </div>
                    
                    {/* QUALITY CONTROL - Rose Theme */}
                    <div className="bg-gradient-to-r from-rose-50 to-red-50 dark:from-rose-900/20 dark:to-red-900/20 rounded-lg p-2 mb-2">
                      <p className="text-xs text-rose-700 dark:text-rose-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 bg-rose-500 rounded-full"></span>
                        ✅ Quality Control
                      </p>
                      <button
                        onClick={() => { setShowToolsMenu(false); onRedTeamClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔴 Red Team
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Devil's advocate for your claims
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onClaimStressTestClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          ⚔️ The War Game
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Skeptical Examiner stress-tests your claim
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onDecisionDecoderClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          📄 Decision Decoder
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Analyze VA decision letters
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onDenialDecoderClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40 bg-white/50 dark:bg-rose-800/30"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔍 Denials Decoder
                          <span className="px-1.5 py-0.5 bg-rose-600 text-white text-[10px] font-bold rounded">AI</span>
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">NEW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-rose-600 dark:text-rose-400">
                          Scan denial letters & decode in plain English
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onSharkRadarClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🦈 Shark Radar
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Identify and avoid claims predators
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onConsistencyEngineClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔍 Consistency Engine
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Auto-detect contradictions before VA finds them
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onEvidenceGapVisualizerClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🔗 Evidence Gap Finder
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">NEW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          See exactly what evidence is missing
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onRiskAssessmentClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-rose-100 dark:hover:bg-rose-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🐻 Risk Assessment
                          <span className="px-1.5 py-0.5 bg-rose-500 text-white text-[10px] font-bold rounded">DEFENSE</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Check protections before filing
                        </p>
                      </button>
                    </div>
                    
                    {/* MAXIMIZE YOUR RATING - Amber Theme */}
                    <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/20 dark:to-orange-900/20 rounded-lg p-2 mb-2">
                      <p className="text-xs text-amber-700 dark:text-amber-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 bg-amber-500 rounded-full"></span>
                        💰 Maximize Your Rating
                      </p>
                      <button
                        onClick={() => { setShowToolsMenu(false); onTDIUBuilderClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          💼 TDIU Builder
                          <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">100%</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Total Disability Individual Unemployability
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onStateBenefitHunterClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40 bg-white/50 dark:bg-amber-800/30"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          💵 State Benefit Hunter
                          <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded animate-pulse">$$$</span>
                          <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-400">
                          Find state-specific veteran benefits
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onTheTribunalClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          ⚖️ The Tribunal
                          <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded">VOICE</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Mock BVA hearing simulator
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onLegislativeWatchdogClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-amber-100 dark:hover:bg-amber-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          📡 Legislative Watchdog
                          <span className="px-1.5 py-0.5 bg-amber-600 text-white text-[10px] font-bold rounded animate-pulse">LIVE</span>
                          <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Track VA rule changes & new presumptives
                        </p>
                      </button>
                    </div>
                    
                    {/* SUPPORT & RESOURCES - Sky Theme */}
                    <div className="bg-gradient-to-r from-sky-50 to-cyan-50 dark:from-sky-900/20 dark:to-cyan-900/20 rounded-lg p-2">
                      <p className="text-xs text-sky-700 dark:text-sky-300 px-2 py-1 font-bold uppercase tracking-wide flex items-center gap-2">
                        <span className="w-2 h-2 bg-sky-500 rounded-full"></span>
                        🤝 Support & Resources
                      </p>
                      <button
                        onClick={() => { setShowToolsMenu(false); onVSOFinderClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🤝 VSO Finder
                          <span className="px-1.5 py-0.5 bg-sky-600 text-white text-[10px] font-bold rounded">FREE</span>
                          <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">AI</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Find free accredited representation
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onBackupManagerClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          🏰 The Bunker
                          <span className="px-1.5 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded">NEW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Export/Import your data - never lose it
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onCloudSyncClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          📤 Google Drive Backup
                          <span className="px-1.5 py-0.5 bg-sky-500 text-white text-[10px] font-bold rounded">NEW</span>
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Sync your packet to YOUR Google Drive
                        </p>
                      </button>
                      <button
                        onClick={() => { setShowToolsMenu(false); onUserManualClick?.(); }}
                        className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-sky-100 dark:hover:bg-sky-800/40"
                      >
                        <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          📖 User Manual
                        </span>
                        <p className="text-xs mt-0.5 text-gray-600 dark:text-gray-400">
                          Complete guide to all features
                        </p>
                      </button>
                    </div>
                    
                  </div>
                </div>
              )}
            </div>
            
            {/* Veteran Resources Dropdown */}
            <div className="relative static sm:relative">
              <button
                onClick={() => setShowResourcesMenu(!showResourcesMenu)}
                onBlur={() => setTimeout(() => setShowResourcesMenu(false), 200)}
                className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1 flex items-center gap-1"
                title="Veteran Resources"
                aria-expanded={showResourcesMenu}
                aria-haspopup="true"
              >
                🎖️ <span className="hidden lg:inline">Resources</span><span className="lg:hidden">VA Links</span>
                <svg className={`w-4 h-4 transition-transform ${showResourcesMenu ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </button>
              
              {showResourcesMenu && (
                <div className={`fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-72 rounded-lg shadow-xl z-50 overflow-hidden max-h-[70vh] sm:max-h-[80vh] overflow-y-auto ${dropdownClasses.menu.replace('absolute mt-2', '')}`}>
                  <div className="p-2">
                    <p className="text-xs text-gray-500 dark:text-gray-400 px-3 py-1 font-semibold uppercase tracking-wide">
                      Veteran Resources
                    </p>
                    
                    {/* VA Resources Hub Button */}
                    <button
                      onClick={() => {
                        setShowResourcesMenu(false);
                        onVAResourcesClick();
                      }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-l-4 border-green-600 mb-2"
                    >
                      <span className="font-medium text-green-700 dark:text-green-100">
                        🌐 VA Resources Hub
                      </span>
                      <p className="text-xs mt-0.5 text-green-600 dark:text-green-400">
                        Comprehensive VA benefits & programs guide
                      </p>
                    </button>
                    
                    <div className="border-t border-gray-200 dark:border-gray-700 my-2"></div>
                    
                    {veteranResources.map((resource, index) => (
                      <a
                        key={index}
                        href={resource.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`block px-3 py-2 rounded-md transition-colors ${
                          resource.urgent 
                            ? 'bg-red-50 dark:bg-red-900/30 hover:bg-red-100 dark:hover:bg-red-900/50 border-l-4 border-red-500' 
                            : resource.highlight
                            ? 'bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-l-4 border-amber-500'
                            : 'hover:bg-gray-100 dark:hover:bg-gray-700'
                        }`}
                      >
                        <span className={`font-medium ${
                          resource.urgent 
                            ? 'text-red-700 dark:text-red-100' 
                            : resource.highlight
                            ? 'text-amber-700 dark:text-amber-100'
                            : 'text-gray-800 dark:text-gray-200'
                        }`}>
                          {resource.name}
                        </span>
                        <p className={`text-xs mt-0.5 ${
                          resource.urgent 
                            ? 'text-red-600 dark:text-red-400' 
                            : resource.highlight
                            ? 'text-amber-600 dark:text-amber-400'
                            : 'text-gray-500 dark:text-gray-400'
                        }`}>
                          {resource.description}
                        </p>
                      </a>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <a
              href="https://www.va.gov/disability/"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="VA Disability Benefits"
              aria-label="Visit VA Disability Benefits page (opens in new tab)"
            >
              🏛️ <span className="hidden lg:inline">Disability Benefits</span><span className="lg:hidden">VA</span>
            </a>
            <a
              href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="eCFR 38 Part 4"
              aria-label="Visit official eCFR Rating Schedule (opens in new tab)"
            >
              ⚖️ <span className="hidden lg:inline">Rating Schedule</span><span className="lg:hidden">eCFR</span>
            </a>
            
            {/* Quick Dark Mode Toggle */}
            <button
              onClick={toggleTheme}
              className="p-2 rounded-lg bg-white/10 hover:bg-white/20 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold"
              aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
              title={`Switch to ${isDark ? 'light' : 'dark'} mode`}
            >
              {isDark ? (
                <svg className="w-5 h-5 text-yellow-300" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path fillRule="evenodd" d="M10 2a1 1 0 011 1v1a1 1 0 11-2 0V3a1 1 0 011-1zm4 8a4 4 0 11-8 0 4 4 0 018 0zm-.464 4.95l.707.707a1 1 0 001.414-1.414l-.707-.707a1 1 0 00-1.414 1.414zm2.12-10.607a1 1 0 010 1.414l-.706.707a1 1 0 11-1.414-1.414l.707-.707a1 1 0 011.414 0zM17 11a1 1 0 100-2h-1a1 1 0 100 2h1zm-7 4a1 1 0 011 1v1a1 1 0 11-2 0v-1a1 1 0 011-1zM5.05 6.464A1 1 0 106.465 5.05l-.708-.707a1 1 0 00-1.414 1.414l.707.707zm1.414 8.486l-.707.707a1 1 0 01-1.414-1.414l.707-.707a1 1 0 011.414 1.414zM4 11a1 1 0 100-2H3a1 1 0 000 2h1z" clipRule="evenodd" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                  <path d="M17.293 13.293A8 8 0 016.707 2.707a8.001 8.001 0 1010.586 10.586z" />
                </svg>
              )}
            </button>

            {/* Legislative Watchdog - Rule Change Alerts */}
            <button
              onClick={onLegislativeWatchdogClick}
              className="p-2 rounded-lg bg-amber-500/20 hover:bg-amber-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold relative"
              aria-label="Legislative Watchdog - VA Rule Change Alerts"
              title="Legislative Watchdog - Track VA rule changes"
            >
              <span className="text-lg">📡</span>
              <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-400 rounded-full animate-pulse"></span>
            </button>

            {/* Consistency Engine Badge - Auto Contradiction Detection */}
            <ConsistencyBadge onClick={onConsistencyEngineClick} />

            {/* The Bunker - Data Backup */}
            <button
              onClick={onBackupManagerClick}
              className={`p-2 rounded-lg bg-blue-500/20 hover:bg-blue-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold relative group ${shouldPulseBackup ? 'animate-pulse-glow' : ''}`}
              aria-label="The Bunker - Backup Your Data"
              title={shouldPulseBackup ? "⚠️ You have unsaved changes! Click to backup your data." : "The Bunker - Export/Import your data"}
            >
              <span className="text-lg">🏰</span>
              {shouldPulseBackup && (
                <span className="absolute -top-1 -right-1 w-3 h-3 bg-amber-500 rounded-full animate-pulse"></span>
              )}
              {!shouldPulseBackup && (
                <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-blue-500 text-white text-[8px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity">NEW</span>
              )}
            </button>

            {/* Time Machine - ITF Countdown */}
            <button
              onClick={onTimeMachineClick}
              className="p-2 rounded-lg bg-red-500/20 hover:bg-red-500/40 transition-colors focus:outline-none focus:ring-2 focus:ring-va-gold relative group"
              aria-label="Time Machine - Intent to File Countdown"
              title="Time Machine - Track your ITF deadline"
            >
              <span className="text-lg">⏰</span>
              <span className="absolute -top-1 -right-1 px-1 py-0.5 bg-red-500 text-white text-[8px] font-bold rounded opacity-0 group-hover:opacity-100 transition-opacity">NEW</span>
            </button>

            {/* Helper Mode Toggle (Spouse/Caregiver Mode) */}
            <HelperModeToggle compact />

            {/* Accessibility Menu */}
            <AccessibilityMenu />
            
            <button
              onClick={() => setShowFundingModal(true)}
              className="inline-flex items-center gap-1.5 bg-va-gold hover:bg-yellow-400 hover:scale-105 text-va-blue px-4 py-1.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-white animate-pulse-subtle"
              title="Support Vet-Rate.org - Help keep this free for veterans"
              aria-label="Back the Mission - Support Vet-Rate.org"
            >
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
                <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
              </svg>
              <span className="hidden md:inline">Back the Mission</span>
            </button>
          </nav>
        </div>
      </div>
      
      {/* Funding Modal */}
      <FundingModal show={showFundingModal} onClose={() => setShowFundingModal(false)} />
    </header>
  );
}

export default Header;
