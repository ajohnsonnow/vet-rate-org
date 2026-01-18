import React, { useState } from 'react';
import AccessibilityMenu from './AccessibilityMenu';
import FundingModal from './FundingModal';
import { useTheme } from '../contexts/ThemeContext';

function Header({ 
  // Core Navigation
  onMyPacketClick, 
  onUserManualClick,
  onVAResourcesClick,
  // Calculate
  onTacticalCalculatorClick,
  // Discover  
  onSecondaryScoutClick,
  onCAPSimulatorClick,
  onPathfinderClick,
  // Evidence
  onCFileAnalyzerClick,
  onBlueButtonXRayClick,
  onWitnessBenchClick,
  onFormsHelperClick,
  // Quality Control
  onRedTeamClick,
  onDecisionDecoderClick,
  onSharkRadarClick,
  // Advanced Strategy
  onTDIUBuilderClick,
  onRiskAssessmentClick,
  onSymptomLoggerClick,
  onPACTActNavigatorClick,
  onFOIAGeneratorClick,
  // Shock & Awe
  onMillionDollarDashboardClick,
  onMOSHazardMatcherClick,
  onWebOfConditionsClick,
  // Support & Resources
  onVSOFinderClick,
  onStateBenefitHunterClick,
  // Special
  onNexusBuilderClick
}) {
  const { isDark, toggleTheme } = useTheme();
  const [showResourcesMenu, setShowResourcesMenu] = useState(false);
  const [showToolsMenu, setShowToolsMenu] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);

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
    <header className="bg-gradient-to-r from-va-blue to-green-900 dark:from-gray-800 dark:to-gray-900 text-white shadow-lg" role="banner">
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
            <div className="bg-white rounded-full h-16 w-16 md:h-20 md:w-20 flex items-center justify-center overflow-hidden shadow-md">
              <img 
                src="/images/Vet-Rate-org-logo-official.png" 
                alt="Vet-Rate.org Logo" 
                className="h-full w-full object-contain"
              />
            </div>
            <div>
              <h1 className="text-2xl md:text-3xl font-bold whitespace-nowrap">Vet-Rate.org</h1>
              <p className="text-green-100 dark:text-gray-300 text-sm md:text-base whitespace-nowrap">
                Free VA Claims Toolkit for Veterans
              </p>
            </div>
          </div>

          <nav className="flex flex-wrap justify-center gap-4 md:gap-6 items-center" role="navigation" aria-label="Main navigation">
            {/* Help - First thing users need */}
            <button
              onClick={onUserManualClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="User Manual - Documentation & Help"
              aria-label="Open User Manual for documentation and help"
            >
              ❓ Help
            </button>
            
            {/* My Packet - Where users save everything */}
            <button
              onClick={onMyPacketClick}
              className="hover:text-va-gold transition duration-200 focus:outline-none focus:ring-2 focus:ring-va-gold focus:ring-offset-2 focus:ring-offset-va-blue rounded px-2 py-1"
              title="My Packet - View saved claims"
              aria-label="Open My Packet to view your saved claims"
            >
              📁 My Packet
            </button>
            
            {/* Tools Dropdown - Main feature tools */}
            <div className="relative static sm:relative">
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
                <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-96 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden max-h-[80vh] overflow-y-auto">
                  <div className="p-2">
                    
                    {/* CALCULATE */}
                    <p className="text-xs text-blue-600 dark:text-blue-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-blue-200 dark:border-blue-800 mb-1">
                      📊 Calculate Your Rating
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onTacticalCalculatorClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-blue-50 dark:hover:bg-blue-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🧮 Tactical Calculator
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        VA Math calculator with 2026 rates
                      </p>
                    </button>
                    
                    {/* DISCOVER */}
                    <p className="text-xs text-purple-600 dark:text-purple-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-purple-200 dark:border-purple-800 mb-1 mt-3">
                      🔍 Discover Your Claims
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onSecondaryScoutClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🔍 Secondary Scout
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Discover 500+ linked secondary conditions
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onCAPSimulatorClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        ✅ C&P Exam Simulator
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Practice with DBQ-aligned exam questions
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onPathfinderClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🧭 Pathfinder
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Step-by-step claims guidance
                      </p>
                    </button>
                    
                    {/* BUILD YOUR EVIDENCE */}
                    <p className="text-xs text-green-600 dark:text-green-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-green-200 dark:border-green-800 mb-1 mt-3">
                      📋 Build Your Evidence
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onCFileAnalyzerClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors bg-purple-50 dark:bg-purple-900/30 hover:bg-purple-100 dark:hover:bg-purple-900/50 border-l-4 border-purple-500"
                    >
                      <span className="font-medium text-purple-700 dark:text-purple-100 flex items-center gap-2">
                        🔬 C-File AI Analyzer
                        <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">AI</span>
                      </span>
                      <p className="text-xs mt-0.5 text-purple-600 dark:text-purple-400">
                        AI analysis of your claims file (worth $500+)
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onBlueButtonXRayClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-green-50 dark:hover:bg-green-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        💙 Blue Button X-Ray
                        <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">AI</span>
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Analyze VA Blue Button health records
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onWitnessBenchClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-green-50 dark:hover:bg-green-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        👥 Witness Bench
                        <span className="px-1.5 py-0.5 bg-green-500 text-white text-[10px] font-bold rounded">AI</span>
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        AI-assisted buddy statement generator
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onNexusBuilderClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-green-50 dark:hover:bg-green-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🔗 Nexus Builder
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Build medical connection arguments
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onFormsHelperClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-green-50 dark:hover:bg-green-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        ✏️ Forms Helper
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Guided assistance for VA forms & statements
                      </p>
                    </button>
                    
                    {/* QUALITY CONTROL */}
                    <p className="text-xs text-red-600 dark:text-red-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-red-200 dark:border-red-800 mb-1 mt-3">
                      🎯 Quality Control
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onRedTeamClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🔴 Red Team
                        <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">AI</span>
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Devil's advocate for your claims
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onDecisionDecoderClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        📄 Decision Decoder
                        <span className="px-1.5 py-0.5 bg-orange-500 text-white text-[10px] font-bold rounded">AI</span>
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Analyze VA decision letters
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onSharkRadarClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-red-50 dark:hover:bg-red-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🦈 Shark Radar
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Identify and avoid claims predators
                      </p>
                    </button>
                    
                    {/* ADVANCED STRATEGY */}
                    <p className="text-xs text-orange-600 dark:text-orange-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-orange-200 dark:border-orange-800 mb-1 mt-3">
                      ⚡ Advanced Strategy
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onTDIUBuilderClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        💼 TDIU Builder
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Total Disability Individual Unemployability
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onRiskAssessmentClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        ⚠️ Risk Assessment
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Evaluate claim risks & reduction triggers
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onSymptomLoggerClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        📝 Symptom Logger
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Track symptoms with timestamp evidence
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onPACTActNavigatorClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors bg-amber-50 dark:bg-amber-900/30 hover:bg-amber-100 dark:hover:bg-amber-900/50 border-l-4 border-amber-500"
                    >
                      <span className="font-medium text-amber-700 dark:text-amber-100 flex items-center gap-2">
                        ☢️ PACT Act Navigator
                        <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">HOT</span>
                      </span>
                      <p className="text-xs mt-0.5 text-amber-600 dark:text-amber-400">
                        Find your presumptive conditions
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onFOIAGeneratorClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-orange-50 dark:hover:bg-orange-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🔑 FOIA Keysmith
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Generate FOIA requests for records
                      </p>
                    </button>
                    
                    {/* SHOCK & AWE */}
                    <p className="text-xs text-amber-600 dark:text-amber-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-amber-200 dark:border-amber-800 mb-1 mt-3">
                      💎 Shock & Awe Tools
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onMillionDollarDashboardClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-emerald-50 dark:hover:bg-emerald-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        💰 Million Dollar Dashboard
                        <span className="px-1.5 py-0.5 bg-emerald-500 text-white text-[10px] font-bold rounded animate-pulse">WOW</span>
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        See your lifetime benefits value
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onMOSHazardMatcherClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-slate-50 dark:hover:bg-slate-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🎖️ MOS Hazard Matcher
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Find injuries linked to your MOS
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onWebOfConditionsClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-purple-50 dark:hover:bg-purple-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🕸️ Web of Conditions
                        <span className="px-1.5 py-0.5 bg-purple-500 text-white text-[10px] font-bold rounded">INTERACTIVE</span>
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Visual map of connected conditions
                      </p>
                    </button>
                    
                    {/* SUPPORT & RESOURCES */}
                    <p className="text-xs text-teal-600 dark:text-teal-400 px-3 py-1 font-bold uppercase tracking-wide border-b border-teal-200 dark:border-teal-800 mb-1 mt-3">
                      🤝 Support & Resources
                    </p>
                    <button
                      onClick={() => { setShowToolsMenu(false); onVSOFinderClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors hover:bg-teal-50 dark:hover:bg-teal-900/30"
                    >
                      <span className="font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                        🏢 VSO Finder
                      </span>
                      <p className="text-xs mt-0.5 text-gray-500 dark:text-gray-400">
                        Find Veteran Service Organizations near you
                      </p>
                    </button>
                    <button
                      onClick={() => { setShowToolsMenu(false); onStateBenefitHunterClick?.(); }}
                      className="w-full text-left block px-3 py-2 rounded-md transition-colors bg-green-50 dark:bg-green-900/30 hover:bg-green-100 dark:hover:bg-green-900/50 border-l-4 border-green-500"
                    >
                      <span className="font-medium text-green-700 dark:text-green-100 flex items-center gap-2">
                        💵 State Benefit Hunter
                        <span className="px-1.5 py-0.5 bg-yellow-400 text-yellow-900 text-[10px] font-bold rounded animate-pulse">$$$</span>
                      </span>
                      <p className="text-xs mt-0.5 text-green-600 dark:text-green-400">
                        Find state-specific veteran benefits
                      </p>
                    </button>
                    
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
                <div className="fixed sm:absolute left-2 right-2 sm:left-auto sm:right-0 mt-2 sm:w-72 bg-white dark:bg-gray-800 rounded-lg shadow-xl border border-gray-200 dark:border-gray-700 z-50 overflow-hidden max-h-[70vh] sm:max-h-[80vh] overflow-y-auto">
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
