/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See COPYRIGHT.js for full license terms.
 * 
 * This is the main application component for the VA Disability Calculator.
 * Built by a fellow service-disabled veteran to help veterans navigate the
 * VA disability claims process.
 */

import React, { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import SearchBar from './components/SearchBar';
import SearchResultCard from './components/SearchResultCard';
import DisabilityDetails from './components/DisabilityDetails';
import Disclaimer from './components/Disclaimer';
import DisclaimerSplash from './components/DisclaimerSplash';
import BuyMeCoffee from './components/BuyMeCoffee';
import PrivacyPolicy from './components/PrivacyPolicy';
import AboutUs from './components/AboutUs';
import ContactUs from './components/ContactUs';
import SecondaryScout from './components/SecondaryScout';
import SecondaryScoutLauncher from './components/SecondaryScoutLauncher';
import NexusBuilder from './components/NexusBuilder';
import MyPacket from './components/MyPacket';
import CAPSimulator from './components/CAPSimulator';
import VAResources from './components/VAResources';
import FormsHelper from './components/FormsHelper';
import CFileAnalyzer from './components/CFileAnalyzer';
import SharkRadar from './components/SharkRadar';
import Pathfinder from './components/Pathfinder';
import BugSquasher from './components/BugSquasher';
import FloatingBugButton from './components/FloatingBugButton';
import ReportBugLink from './components/ReportBugLink';
import FundingModal from './components/FundingModal';
import QuickConditionPicker from './components/QuickConditionPicker';
import UserManual from './components/UserManual';
import StateBenefitHunter from './components/StateBenefitHunter';
import VSOFinder from './components/VSOFinder';
import RedTeam from './components/RedTeam';
import SymptomLogger from './components/SymptomLogger';
import DecisionDecoder from './components/DecisionDecoder';
import TacticalCalculator from './components/TacticalCalculator';
import MobileNotice from './components/MobileNotice';
import BlueButtonXRay from './components/BlueButtonXRay';
import WitnessBench from './components/WitnessBench';
import RiskAssessment from './components/RiskAssessment';
import TDIUBuilder from './components/TDIUBuilder';
import PACTActNavigator from './components/PACTActNavigator';
import FOIAGenerator from './components/FOIAGenerator';
import MillionDollarDashboard from './components/MillionDollarDashboard';
import MOSHazardMatcher from './components/MOSHazardMatcher';
import WebOfConditions from './components/WebOfConditions';
import { searchDisabilityData, validateSearchTerm } from './utils/searchUtils';
import { saveStatement, getSavedClaims, getStatement } from './utils/claimsStorage';
import { initializeErrorCapture } from './utils/bugReportUtils';
import disabilityData from './data/disabilityData.json';
import './index.css';

function App() {
  const [searchTerm, setSearchTerm] = useState('');
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showPrivacyPolicy, setShowPrivacyPolicy] = useState(false);
  const [showAboutUs, setShowAboutUs] = useState(false);
  const [showContactUs, setShowContactUs] = useState(false);
  const [showSecondaryScoutLauncher, setShowSecondaryScoutLauncher] = useState(false);
  const [showSecondaryScout, setShowSecondaryScout] = useState(false);
  const [userConditions, setUserConditions] = useState([]);
  const [showNexusBuilder, setShowNexusBuilder] = useState(false);
  const [nexusBuilderData, setNexusBuilderData] = useState(null);
  const [showMyPacket, setShowMyPacket] = useState(false);
  const [showCAPSimulator, setShowCAPSimulator] = useState(false);
  const [showVAResources, setShowVAResources] = useState(false);
  const [showFormsHelper, setShowFormsHelper] = useState(false);
  const [showCFileAnalyzer, setShowCFileAnalyzer] = useState(false);
  const [showSharkRadar, setShowSharkRadar] = useState(false);
  const [showPathfinder, setShowPathfinder] = useState(false);
  const [showBugSquasher, setShowBugSquasher] = useState(false);
  const [showFundingModal, setShowFundingModal] = useState(false);
  const [showUserManual, setShowUserManual] = useState(false);
  const [showStateBenefitHunter, setShowStateBenefitHunter] = useState(false);
  const [showVSOFinder, setShowVSOFinder] = useState(false);
  const [showRedTeam, setShowRedTeam] = useState(false);
  const [showSymptomLogger, setShowSymptomLogger] = useState(false);
  const [showDecisionDecoder, setShowDecisionDecoder] = useState(false);
  const [showTacticalCalculator, setShowTacticalCalculator] = useState(false);
  const [showBlueButtonXRay, setShowBlueButtonXRay] = useState(false);
  const [showWitnessBench, setShowWitnessBench] = useState(false);
  const [showRiskAssessment, setShowRiskAssessment] = useState(false);
  const [showTDIUBuilder, setShowTDIUBuilder] = useState(false);
  const [showPACTActNavigator, setShowPACTActNavigator] = useState(false);
  const [showFOIAGenerator, setShowFOIAGenerator] = useState(false);
  const [showMillionDollarDashboard, setShowMillionDollarDashboard] = useState(false);
  const [showMOSHazardMatcher, setShowMOSHazardMatcher] = useState(false);
  const [showWebOfConditions, setShowWebOfConditions] = useState(false);
  const [capSimulatorResults, setCapSimulatorResults] = useState([]);
  const [disclaimerAcknowledged, setDisclaimerAcknowledged] = useState(
    () => localStorage.getItem('vetrate-disclaimer-acknowledged') === 'true'
  );

  // Initialize error capture for bug reports
  useEffect(() => {
    initializeErrorCapture();
  }, []);

  const handleLaunchSecondaryScout = (conditions) => {
    setUserConditions(conditions);
    setShowSecondaryScoutLauncher(false);
    setShowSecondaryScout(true);
  };

  const handleLearnHow = (suggestion) => {
    setNexusBuilderData({
      condition: suggestion.secondaryCondition,
      primaryCondition: suggestion.primaryCondition
    });
    setShowSecondaryScout(false);
    setShowNexusBuilder(true);
  };

  const handleSaveStatement = (statementData) => {
    // Find the matching claim by condition name and parent condition
    const savedClaims = getSavedClaims();
    const matchingClaim = savedClaims.find(c => 
      c.conditionName === statementData.condition && 
      c.parentCondition === (statementData.primaryCondition || null)
    );
    
    if (matchingClaim) {
      // Save statement with the claim's ID
      saveStatement(matchingClaim.id, statementData);
    } else {
      alert('Error: Could not find matching claim. Please save the claim first from Secondary Scout.');
    }
    
    // Close Nexus Builder and show success
    setShowNexusBuilder(false);
    setShowMyPacket(true);
  };

  const handleResumeFromPacket = (claim) => {
    // Get existing statement for editing
    const existingStatement = getStatement(claim.id);
    
    setNexusBuilderData({
      condition: claim.conditionName,
      primaryCondition: claim.parentCondition,
      existingStatement: existingStatement
    });
    setShowMyPacket(false);
    setShowNexusBuilder(true);
  };

  const handleBuildStatementFromSearch = (conditionName) => {
    // Open NexusBuilder for a primary (non-secondary) condition
    setNexusBuilderData({
      condition: conditionName,
      primaryCondition: null,
      existingStatement: null
    });
    setSelectedResult(null); // Close the details view
    setShowNexusBuilder(true);
  };

  // Handler for Pathfinder navigation to other tools
  const handlePathfinderNavigate = (tool, data) => {
    setShowPathfinder(false);
    
    if (tool === 'nexus') {
      setNexusBuilderData({
        condition: data.condition,
        primaryCondition: data.primaryCondition,
        existingStatement: null
      });
      setShowNexusBuilder(true);
    } else if (tool === 'dbq') {
      // Navigate to C&P Simulator with condition
      setShowCAPSimulator(true);
    } else if (tool === 'secondary-scout') {
      setShowSecondaryScoutLauncher(true);
    }
  };

  // Handler for sending C&P Simulator results to Tactical Calculator
  const handleSendToCalculator = (result, conditionName, diagnosticCode) => {
    const newResult = {
      id: Date.now(),
      conditionName: conditionName,
      diagnosticCode: diagnosticCode,
      rating: result.predictedRating,
      source: 'C&P Simulator',
      dateAdded: new Date().toISOString()
    };
    setCapSimulatorResults(prev => [...prev, newResult]);
    setShowCAPSimulator(false);
    setShowTacticalCalculator(true);
  };

  // Handler for navigating to a secondary condition from DisabilityDetails
  const handleSecondaryConditionClick = (diagnosticCode, conditionName) => {
    // First try to find by diagnostic code
    const foundCondition = disabilityData.disabilities.find(
      d => d.diagnosticCode === diagnosticCode
    );
    
    if (foundCondition) {
      setSelectedResult(foundCondition);
      // Scroll to diagnostic header to position heading at top of view
      setTimeout(() => {
        const headerElement = document.getElementById('diagnostic-header');
        if (headerElement) {
          headerElement.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      }, 100);
    } else {
      // If not found by exact code, search by name
      setSearchTerm(conditionName);
      setSelectedResult(null);
    }
  };

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchTerm.trim()) {
        setResults([]);
        setError(null);
        return;
      }

      // Validate search term
      if (!validateSearchTerm(searchTerm)) {
        setError('Invalid search term. Please use only letters, numbers, spaces, hyphens, or slashes.');
        setResults([]);
        return;
      }

      setIsLoading(true);
      setError(null);

      try {
        const foundResults = searchDisabilityData(searchTerm, disabilityData);
        setResults(foundResults);
        setHasSearched(true);
        
        if (foundResults.length === 0) {
          setError(`No disabilities found for "${searchTerm}". Try searching by condition name (e.g., "PTSD", "arthritis") or diagnostic code (e.g., "9411", "5002").`);
        }
      } catch (err) {
        console.error('Search error:', err);
        setError('An error occurred while searching. Please try again.');
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm('');
    setResults([]);
    setSelectedResult(null);
    setError(null);
  }, []);

  // Gather current app state for bug reports
  const getCurrentAppState = useCallback(() => ({
    searchTerm,
    results,
    selectedResult,
    hasSearched,
    error,
    showPrivacyPolicy,
    showAboutUs,
    showContactUs,
    showSecondaryScoutLauncher,
    showSecondaryScout,
    userConditions,
    showNexusBuilder,
    nexusBuilderData,
    showMyPacket,
    showCAPSimulator,
    showVAResources,
    showFormsHelper,
    showCFileAnalyzer,
    showUserManual,
    showStateBenefitHunter,
    showVSOFinder,
    showRedTeam,
    showSymptomLogger,
    showDecisionDecoder,
    showTacticalCalculator,
    showBlueButtonXRay,
    showWitnessBench,
    showRiskAssessment,
    showTDIUBuilder,
    showPACTActNavigator,
    showFOIAGenerator,
    showMillionDollarDashboard,
    showMOSHazardMatcher,
    showWebOfConditions
  }), [
    searchTerm, results, selectedResult, hasSearched, error,
    showPrivacyPolicy, showAboutUs, showContactUs,
    showSecondaryScoutLauncher, showSecondaryScout, userConditions,
    showNexusBuilder, nexusBuilderData, showMyPacket, showCAPSimulator, showVAResources, showFormsHelper, showCFileAnalyzer, showUserManual,
    showStateBenefitHunter, showVSOFinder, showRedTeam, showSymptomLogger, showDecisionDecoder, showTacticalCalculator,
    showBlueButtonXRay, showWitnessBench, showRiskAssessment, showTDIUBuilder, showPACTActNavigator, showFOIAGenerator,
    showMillionDollarDashboard, showMOSHazardMatcher, showWebOfConditions
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Disclaimer Splash - shows on first visit */}
      <DisclaimerSplash onAcknowledge={() => setDisclaimerAcknowledged(true)} />
      
      {/* Mobile device notice */}
      <MobileNotice />
      
      <Header 
        onSecondaryScoutClick={() => setShowSecondaryScoutLauncher(true)}
        onMyPacketClick={() => setShowMyPacket(true)}
        onCAPSimulatorClick={() => setShowCAPSimulator(true)}
        onVAResourcesClick={() => setShowVAResources(true)}
        onFormsHelperClick={() => setShowFormsHelper(true)}
        onCFileAnalyzerClick={() => setShowCFileAnalyzer(true)}
        onUserManualClick={() => setShowUserManual(true)}
      />
      <BuyMeCoffee 
        show={hasSearched && results.length > 0} 
        trigger="search"
        context={{ count: results.length, query: searchTerm }}
      />

      <main id="main-content" className="flex-1 container mx-auto px-4 py-8 max-w-7xl" role="main" aria-label="Main content">
        
        {/* Hero Section with Search */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            🛡️ Your VA Claims Command Center
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Search <strong>748 rated disabilities</strong> with official rating criteria, discover secondary conditions, practice for C&P exams, and build your evidence packet—all in one place.
          </p>
        </div>

        {/* SEARCH BAR - Prominent Position */}
        <div className="max-w-4xl mx-auto mb-8">
          <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-lg border-2 border-blue-200 dark:border-gray-600 p-6">
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onClear={handleClearSearch}
              isLoading={isLoading}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-3">
              💡 <strong>Tip:</strong> Search by condition name, diagnostic code, or keyword — covers all 15 body systems from 38 CFR Part 4
            </p>
          </div>
        </div>

        {/* Quick Condition Picker - Prominent Position */}
        <div className="max-w-4xl mx-auto mb-8">
          <QuickConditionPicker onViewPacket={() => setShowMyPacket(true)} />
        </div>

        {error && (
          <div className="max-w-4xl mx-auto mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg" role="alert">
            <p className="text-yellow-800 dark:text-yellow-200">
              <strong>Info:</strong> {error}
            </p>
          </div>
        )}

        {isLoading && (
          <div className="flex justify-center my-12">
            <div className="animate-spin rounded-full h-12 w-12 border-4 border-va-blue border-t-va-gold"></div>
          </div>
        )}

        {!isLoading && results.length > 0 && (
          <div className="mt-10">
            <h2 className="text-2xl font-bold text-gray-800 mb-6">
              ✅ Search Results ({results.length} found)
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {results.slice(0, 3).map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => setSelectedResult(result)}
                  isSelected={selectedResult?.id === result.id}
                />
              ))}
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
              {results.slice(3).map((result) => (
                <SearchResultCard
                  key={result.id}
                  result={result}
                  onSelect={() => setSelectedResult(result)}
                  isSelected={selectedResult?.id === result.id}
                />
              ))}
            </div>
          </div>
        )}

        {!isLoading && searchTerm.trim() !== '' && results.length === 0 && !error && (
          <div className="text-center py-12">
            <p className="text-gray-600 text-lg">No matching disabilities found.</p>
          </div>
        )}

        {selectedResult && (
          <DisabilityDetails
            result={selectedResult}
            searchTerm={searchTerm}
            onClose={() => setSelectedResult(null)}
            onBuildStatement={handleBuildStatementFromSearch}
            onSecondaryConditionClick={handleSecondaryConditionClick}
          />
        )}

        {/* Feature CTAs - Below Search */}
        <div className="mt-12 max-w-4xl mx-auto">
          {/* SECTION 1: ESSENTIAL TOOLS - What Everyone Needs First */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">⚡ Essential Tools</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">Start here — calculate your rating and organize your claims</p>
          
          {/* TACTICAL CALCULATOR - THE Core Feature */}
          <div className="mb-6">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-40 h-40 bg-white/10 rounded-full -translate-y-20 translate-x-20"></div>
              <div className="absolute bottom-0 left-0 w-32 h-32 bg-white/5 rounded-full translate-y-16 -translate-x-16"></div>
              
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-20 h-20 bg-white/20 backdrop-blur rounded-2xl flex items-center justify-center">
                    <span className="text-5xl">🧮</span>
                  </div>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <h3 className="text-2xl font-bold">Tactical Calculator</h3>
                    <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full animate-pulse">CORE FEATURE</span>
                  </div>
                  <p className="text-blue-100 max-w-xl">
                    <strong>Calculate your REAL rating</strong> using official VA math (38 CFR § 4.25). 
                    Includes <strong>Bilateral Factor</strong>, gap analysis to reach 100%, and 
                    <strong> 2026 pay estimates</strong> with dependents.
                  </p>
                </div>
                
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setShowTacticalCalculator(true)}
                    className="px-8 py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>🎯</span>
                    <span>Calculate My Rating</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DISCOVER YOUR CLAIMS - Find What to Claim */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2 mt-12">🔍 Discover Your Claims</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">Find secondary conditions, practice for exams, and strategize your approach</p>
          
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Secondary Scout CTA */}
            <div className="bg-gradient-to-br from-emerald-50 to-teal-50 dark:from-emerald-900/40 dark:to-teal-900/40 border border-emerald-200 dark:border-emerald-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-emerald-100 dark:bg-emerald-800/50 rounded-lg p-2">
                  <svg className="w-6 h-6 text-emerald-600 dark:text-emerald-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    Secondary Scout
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">NEW</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Discover <strong>secondary claims</strong> linked to your service-connected disabilities — powered by our comprehensive nexus database and 38 CFR § 3.310.
              </p>
              <button
                onClick={() => setShowSecondaryScoutLauncher(true)}
                className="w-full px-4 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition-colors"
              >
                🚀 Launch Secondary Scout
              </button>
            </div>

            {/* C&P Simulator CTA */}
            <div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/40 dark:to-yellow-900/40 border border-amber-200 dark:border-amber-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-amber-100 dark:bg-amber-800/50 rounded-lg p-2">
                  <svg className="w-6 h-6 text-amber-600 dark:text-amber-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    C&P Exam Simulator
                    <span className="px-2 py-0.5 bg-orange-500 text-white text-xs rounded-full">NEW</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Practice for your <strong>C&P exam</strong> with condition-specific questions, DBQ-aligned scenarios, and real-time feedback to maximize your rating.
              </p>
              <button
                onClick={() => setShowCAPSimulator(true)}
                className="w-full px-4 py-2.5 bg-amber-600 text-white rounded-lg font-semibold hover:bg-amber-700 transition-colors"
              >
                🎯 Launch C&P Simulator
              </button>
            </div>
          </div>

          {/* Pathfinder CTA - Full Width Featured */}
          <div className="mt-6">
            <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
              {/* Decorative elements */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
              
              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <span className="text-4xl">🧭</span>
                  </div>
                </div>
                
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <h3 className="text-xl font-bold">The Pathfinder</h3>
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">AI STRATEGY</span>
                  </div>
                  <p className="text-blue-100 max-w-2xl">
                    <strong>Your personal claims strategist.</strong> Enter your current ratings and let AI analyze your profile to suggest 
                    <strong> high-probability secondary claims</strong> you may be missing, with direct links to build your case. Like having a VSO in your pocket.
                  </p>
                </div>
                
                <div className="flex-shrink-0">
                  <button
                    onClick={() => setShowPathfinder(true)}
                    className="px-6 py-3 bg-white text-indigo-700 rounded-lg font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>Analyze My Strategy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: BUILD YOUR EVIDENCE - Documentation & Medical Records */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2 mt-12">📋 Build Your Evidence</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">Gather medical records, fill out forms, and create supporting statements</p>

          {/* C-File Analyzer CTA - Full Width - Featured */}
          <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-fuchsia-900/40 border-2 border-pink-300 dark:border-pink-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden mb-6">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse"></div>
            
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-pink-100 dark:bg-pink-800/50 rounded-lg p-3">
                  <span className="text-3xl">🔬</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    C-File AI Analyzer
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-pink-500 text-white text-xs font-bold rounded-full">BETA</span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">FREE</span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <strong>What competitors charge $500+ for.</strong> Upload your C-File (Claims File) and let AI analyze thousands of pages to find 
                    <strong> in-service events, diagnoses, and nexus evidence</strong>—all processed locally in your browser for maximum privacy.
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowCFileAnalyzer(true)}
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-purple-600 to-pink-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl whitespace-nowrap transform hover:-translate-y-0.5"
              >
                🚀 Analyze My C-File
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blue Button X-Ray CTA */}
            <div className="bg-gradient-to-br from-cyan-50 via-blue-50 to-indigo-50 dark:from-cyan-900/40 dark:via-blue-900/40 dark:to-indigo-900/40 border-2 border-cyan-300 dark:border-cyan-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-cyan-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-cyan-500 to-blue-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">📋</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Blue Button X-Ray
                    <span className="px-2 py-0.5 bg-gradient-to-r from-cyan-500 to-blue-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">INSTANT</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Instant Evidence Mining.</strong> Upload your <strong>Blue Button</strong> from MyHealtheVet (instant download!) and find <strong>unclaimed diagnoses</strong> hiding in your records.
              </p>
              <button
                onClick={() => setShowBlueButtonXRay(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-cyan-600 to-blue-600 text-white rounded-lg font-bold hover:from-cyan-700 hover:to-blue-700 transition-colors shadow-md hover:shadow-lg"
              >
                🔬 Scan My Records
              </button>
            </div>

            {/* Witness Bench CTA */}
            <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 dark:from-purple-900/40 dark:via-violet-900/40 dark:to-fuchsia-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">👥</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Witness Bench
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-bold rounded-full">AI</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Buddy Letter Wizard.</strong> Hand off to your <strong>spouse, friend, or battle buddy</strong>. AI asks the RIGHT questions to capture powerful <strong>witness evidence</strong>.
              </p>
              <button
                onClick={() => setShowWitnessBench(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-md hover:shadow-lg"
              >
                ✍️ Create Buddy Statement
              </button>
            </div>
          </div>

          {/* Forms Helper CTA - Full Width */}
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/40 dark:to-indigo-900/40 border border-purple-200 dark:border-purple-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-purple-100 dark:bg-purple-800/50 rounded-lg p-2">
                  <svg className="w-6 h-6 text-purple-600 dark:text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    📋 Forms Helper
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">NEW</span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get guided help filling out VA forms, especially <strong>buddy statements</strong> – one of the most powerful but hardest-to-get forms of evidence!
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowFormsHelper(true)}
                className="w-full md:w-auto px-6 py-2.5 bg-purple-600 text-white rounded-lg font-semibold hover:bg-purple-700 transition-colors whitespace-nowrap"
              >
                📝 Open Forms Helper
              </button>
            </div>
          </div>

          {/* SECTION 4: QUALITY CONTROL - Check Before You Submit */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2 mt-12">✅ Quality Control</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">Review your work, decode VA decisions, and protect yourself from scams</p>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Red Team CTA */}
            <div className="bg-gradient-to-br from-red-50 via-orange-50 to-amber-50 dark:from-red-900/40 dark:via-orange-900/40 dark:to-amber-900/40 border-2 border-red-300 dark:border-red-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-red-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-red-500 to-orange-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">🎖️</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Red Team
                    <span className="px-2 py-0.5 bg-gradient-to-r from-red-500 to-orange-500 text-white text-xs font-bold rounded-full">NEW</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Statement Stress Test.</strong> Find weak language that's <strong>hurting your claim</strong> before the VA does. "Tough guy" language = denials.
              </p>
              <button
                onClick={() => setShowRedTeam(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg font-bold hover:from-red-700 hover:to-orange-700 transition-colors shadow-md hover:shadow-lg"
              >
                🔍 Stress Test My Statement
              </button>
            </div>

            {/* Decision Decoder CTA */}
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">🔓</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Decision Decoder
                    <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">NEW</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Denial Translator.</strong> Got a confusing VA letter? Paste it in and get <strong>plain English</strong> + what's missing + next steps.
              </p>
              <button
                onClick={() => setShowDecisionDecoder(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold hover:from-amber-600 hover:to-orange-600 transition-colors shadow-md hover:shadow-lg"
              >
                🔓 Decode My Decision
              </button>
            </div>

            {/* Shark Radar CTA */}
            <div className="bg-gradient-to-br from-red-50 to-orange-50 dark:from-red-900/40 dark:to-orange-900/40 border border-red-200 dark:border-red-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-red-100 dark:bg-red-800/50 rounded-lg p-2">
                  <span className="text-2xl">🦈</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    Shark Radar
                    <span className="px-2 py-0.5 bg-red-500 text-white text-xs rounded-full">NEW</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                <strong>Before you sign ANYTHING!</strong> Paste contract or email text from "VA consultants" to scan for 
                <strong> illegal fees, predatory practices, and scams</strong> based on 38 CFR § 14.636.
              </p>
              <button
                onClick={() => setShowSharkRadar(true)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-orange-600 transition-colors"
              >
                🔍 Scan Contract
              </button>
            </div>
          </div>

          {/* SECTION 5: ADVANCED STRATEGY - Power User Tools */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2 mt-12">🚀 Advanced Strategy</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">Power tools for maximizing your rating and protecting what you have</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TDIU Work Impact Builder CTA */}
            <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/40 dark:via-emerald-900/40 dark:to-teal-900/40 border-2 border-green-300 dark:border-green-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-green-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">💼</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    TDIU Builder
                    <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">💰 100%</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>The 100% Backdoor.</strong> Translate your symptoms into <strong>vocational language</strong> for VA Form 21-8940. Get paid at 100% even with a 60-70% rating.
              </p>
              <button
                onClick={() => setShowTDIUBuilder(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-colors shadow-md hover:shadow-lg"
              >
                📝 Build My TDIU Case
              </button>
            </div>

            {/* Poke the Bear Calculator CTA */}
            <div className="bg-gradient-to-br from-orange-50 via-red-50 to-rose-50 dark:from-orange-900/40 dark:via-red-900/40 dark:to-rose-900/40 border-2 border-orange-300 dark:border-orange-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-orange-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-orange-500 to-red-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">🐻</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Risk Calculator
                    <span className="px-2 py-0.5 bg-gradient-to-r from-orange-500 to-red-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-red-600 text-white text-xs font-bold rounded-full">DEFENSE</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Don't Poke the Bear!</strong> Check 5-Year, 20-Year, and P&T protections <strong>BEFORE</strong> you file. Sharks push frivolous claims that <strong>trigger rating reductions</strong>.
              </p>
              <button
                onClick={() => setShowRiskAssessment(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-orange-600 to-red-600 text-white rounded-lg font-bold hover:from-orange-700 hover:to-red-700 transition-colors shadow-md hover:shadow-lg"
              >
                ⚖️ Check My Risk
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mt-6">
            {/* Symptom Logger CTA */}
            <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 dark:from-purple-900/40 dark:via-violet-900/40 dark:to-fuchsia-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-purple-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-purple-500 to-violet-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">📊</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Symptom Logger
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-violet-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-yellow-500 text-black text-xs font-bold rounded-full">50%</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>The 50% Maker.</strong> Track <strong>migraines/IBS frequency</strong> for your C&P exam. Export PDF proof of "prostrating attacks per month."
              </p>
              <button
                onClick={() => setShowSymptomLogger(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-violet-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-violet-700 transition-colors shadow-md hover:shadow-lg"
              >
                📝 Log My Symptoms
              </button>
            </div>

            {/* PACT Act Navigator CTA */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-violet-50 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-violet-900/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">🔥</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    PACT Act Navigator
                    <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs font-bold rounded-full">PRESUMPTIVE</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Skip the Nexus Letter.</strong> Check if your condition is <strong>presumptive</strong> under PACT Act—Agent Orange, burn pits, Gulf War, radiation. <strong>No proof needed.</strong>
              </p>
              <button
                onClick={() => setShowPACTActNavigator(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-md hover:shadow-lg"
              >
                🗺️ Check My Presumptives
              </button>
            </div>

            {/* FOIA Keysmith CTA */}
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-amber-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">🔑</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    The Keysmith
                    <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-gray-700 text-white text-xs font-bold rounded-full">FOIA</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Unlock Your C-File.</strong> Generate a <strong>FOIA request</strong> for your complete VA claims file. See what VA used—and <strong>what they ignored</strong>.
              </p>
              <button
                onClick={() => setShowFOIAGenerator(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-colors shadow-md hover:shadow-lg"
              >
                🔓 Generate FOIA Request
              </button>
            </div>
          </div>

          {/* SECTION 6: SUPPORT & RESOURCES - Get Free Help */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2 mt-12">🤝 Support & Resources</h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">Find free representation and unlock state-specific benefits</p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* VSO Finder CTA */}
            <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-purple-900/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              {/* Decorative element */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-blue-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-blue-500 to-indigo-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">🤝</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    VSO Finder
                    <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs font-bold rounded-full">FREE HELP</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>The Honest Broker.</strong> Find <strong>FREE, Accredited</strong> representation near you. 
                Connect with County VSOs, DAV, VFW, and avoid <strong>"Claim Sharks"</strong> forever.
              </p>
              <button
                onClick={() => setShowVSOFinder(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-colors shadow-md hover:shadow-lg"
              >
                🔍 Find Free Help Near Me
              </button>
            </div>

            {/* State Benefit Hunter CTA */}
            <div className="bg-gradient-to-br from-green-50 via-emerald-50 to-teal-50 dark:from-green-900/40 dark:via-emerald-900/40 dark:to-teal-900/40 border-2 border-green-300 dark:border-green-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
              {/* Decorative shimmer */}
              <div className="absolute top-0 right-0 w-20 h-20 bg-gradient-to-br from-yellow-300/30 to-transparent rounded-full -translate-y-10 translate-x-10"></div>
              
              <div className="flex items-start gap-3 mb-3 relative">
                <div className="bg-gradient-to-br from-green-500 to-emerald-600 rounded-lg p-3 shadow-lg">
                  <span className="text-2xl">💰</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    State Benefit Hunter
                    <span className="px-2 py-0.5 bg-gradient-to-r from-green-500 to-emerald-500 text-white text-xs font-bold rounded-full">NEW</span>
                    <span className="px-2 py-0.5 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full animate-pulse">$$$</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                <strong>Money on the Table!</strong> Discover state-specific benefits many veterans miss: 
                <strong> property tax exemptions, free vehicle registration, education grants,</strong> and more.
              </p>
              <button
                onClick={() => setShowStateBenefitHunter(true)}
                className="w-full px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-lg font-bold hover:from-green-700 hover:to-emerald-700 transition-colors shadow-md hover:shadow-lg"
              >
                🎯 Find My State Benefits
              </button>
            </div>
          </div>

          {/* SECTION 7: PREMIUM VISUALIZATIONS - Shock & Awe */}
          <div className="mt-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400 bg-clip-text text-transparent">
                💎 SHOCK & AWE TOOLS 💎
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">Premium visualizations that make you say "Whoa"</p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              {/* Million Dollar Dashboard */}
              <div className="bg-gradient-to-br from-emerald-50 via-green-50 to-teal-50 dark:from-emerald-900/40 dark:via-green-900/40 dark:to-teal-900/40 border-2 border-emerald-300 dark:border-emerald-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-emerald-300/20 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                
                <div className="flex items-start gap-3 mb-3 relative">
                  <div className="bg-gradient-to-br from-emerald-500 to-green-600 rounded-lg p-3 shadow-lg">
                    <span className="text-2xl">💰</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                      Million Dollar Dashboard
                      <span className="px-2 py-0.5 bg-gradient-to-r from-emerald-500 to-green-500 text-white text-xs font-bold rounded-full animate-pulse">WOW</span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                  <strong>Your rating is worth MORE than you think.</strong> See your <strong>lifetime value</strong>—VA pay, property tax savings, education benefits, healthcare. Watch the number climb.
                </p>
                <button
                  onClick={() => setShowMillionDollarDashboard(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-emerald-600 to-green-600 text-white rounded-lg font-bold hover:from-emerald-700 hover:to-green-700 transition-colors shadow-md hover:shadow-lg"
                >
                  💵 Show Me The Money
                </button>
              </div>

              {/* MOS Hazard Matcher */}
              <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-zinc-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-zinc-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-slate-300/20 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                
                <div className="flex items-start gap-3 mb-3 relative">
                  <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-lg p-3 shadow-lg">
                    <span className="text-2xl">🎖️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                      MOS Hazard Matcher
                      <span className="px-2 py-0.5 bg-gradient-to-r from-slate-500 to-gray-600 text-white text-xs font-bold rounded-full">JOB→INJURY</span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                  <strong>Your MOS broke your body.</strong> Enter your job code, see <strong>what injuries that job causes</strong>. Hearing loss? Back pain? <strong>It's not just you—it's the job.</strong>
                </p>
                <button
                  onClick={() => setShowMOSHazardMatcher(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-colors shadow-md hover:shadow-lg"
                >
                  🔍 Match My MOS
                </button>
              </div>

              {/* Web of Conditions */}
              <div className="bg-gradient-to-br from-purple-50 via-indigo-50 to-violet-50 dark:from-purple-900/40 dark:via-indigo-900/40 dark:to-violet-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-purple-300/20 to-transparent rounded-full -translate-y-16 translate-x-16"></div>
                
                <div className="flex items-start gap-3 mb-3 relative">
                  <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-lg p-3 shadow-lg">
                    <span className="text-2xl">🕸️</span>
                  </div>
                  <div className="flex-1">
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                      Web of Conditions
                      <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold rounded-full">INTERACTIVE</span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 relative">
                  <strong>See how conditions connect.</strong> Interactive node map—click a condition, watch secondaries <strong>orbit around it</strong>. Click a link, see the medical nexus.
                </p>
                <button
                  onClick={() => setShowWebOfConditions(true)}
                  className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-bold hover:from-purple-700 hover:to-indigo-700 transition-colors shadow-md hover:shadow-lg"
                >
                  🗺️ Explore The Web
                </button>
              </div>
            </div>
          </div>

          {/* Compact Disclaimer */}
          <Disclaimer compact />
        </div>
      </main>

      {/* Floating Bug Report Button */}
      <FloatingBugButton onClick={() => setShowBugSquasher(true)} />

      <footer className="bg-gray-900 dark:bg-black text-white py-8 mt-12" role="contentinfo">
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-3">ℹ️ About Vet-Rate.org</h4>
              <p className="text-gray-400 text-sm mb-3">
                The most comprehensive free VA claims arsenal—28 professional-grade tools covering research, calculators, AI analysis, C&P prep, evidence builders, and strategic planning. What claim sharks charge thousands for, absolutely free.
              </p>
              <button
                onClick={() => setShowAboutUs(true)}
                className="text-va-gold hover:underline text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-va-gold rounded"
              >
                Learn More →
              </button>
            </div>
            <div>
              <h4 className="font-bold mb-3">🔒 Data Privacy</h4>
              <p className="text-gray-400 text-sm mb-3">
                This system operates locally and does not store Personally Identifiable Information (PII) on external servers. All data processing happens in your browser.
              </p>
              <button
                onClick={() => setShowPrivacyPolicy(true)}
                className="text-va-gold hover:underline text-sm font-semibold"
              >
                Privacy Policy →
              </button>
            </div>
            <div>
              <h4 className="font-bold mb-3">⚖️ Legal Notice</h4>
              <p className="text-gray-400 text-sm">
                This tool is for educational purposes only. It does not constitute legal or medical advice. Consult with VA officials or qualified professionals for specific guidance.
              </p>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <button
                onClick={() => setShowPrivacyPolicy(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Privacy Policy
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowAboutUs(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                About Us
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowContactUs(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Contact Us
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowFormsHelper(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                📋 Forms Helper
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowUserManual(true)}
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                📖 User Manual
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowBugSquasher(true)}
                className="text-gray-400 hover:text-red-400 text-sm transition-colors flex items-center gap-1"
              >
                🐛 Report Bug
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() => setShowFundingModal(true)}
                className="inline-flex items-center gap-1.5 bg-va-gold hover:bg-yellow-400 text-va-blue px-4 py-1.5 rounded-lg font-bold shadow-md hover:shadow-lg transition-all hover:scale-105"
              >
                <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
                </svg>
                Back the Mission
              </button>
            </div>
            <p className="text-center text-gray-400 text-sm">
              &copy; 2024-2026 Vet-Rate.org — Your Complete VA Claims Toolkit. Data sourced from{' '}
              <a
                href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-va-gold hover:underline"
              >
                38 CFR Part 4
              </a>
            </p>
          </div>
        </div>
      </footer>

      {/* Modals */}
      {showPrivacyPolicy && <PrivacyPolicy onClose={() => setShowPrivacyPolicy(false)} onReportBug={() => setShowBugSquasher(true)} />}
      {showAboutUs && <AboutUs onClose={() => setShowAboutUs(false)} onReportBug={() => setShowBugSquasher(true)} />}
      {showContactUs && <ContactUs onClose={() => setShowContactUs(false)} onReportBug={() => setShowBugSquasher(true)} />}
      
      {/* Secondary Scout Launcher */}
      {showSecondaryScoutLauncher && (
        <SecondaryScoutLauncher
          onLaunch={handleLaunchSecondaryScout}
          onClose={() => setShowSecondaryScoutLauncher(false)}
          onReportBug={() => setShowBugSquasher(true)}
        />
      )}
      
      {/* Secondary Scout Results */}
      {showSecondaryScout && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
          <div className="min-h-screen px-4 py-8">
            <div className="bg-white dark:bg-gray-900 rounded-lg shadow-xl max-w-7xl mx-auto">
              <div className="sticky top-0 bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 sm:px-6 py-4 z-10 rounded-t-lg">
                {/* Mobile: Stack vertically, Desktop: Side by side */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xl sm:text-2xl font-bold truncate">🔍 Secondary Scout Results</h2>
                    <p className="text-sm text-blue-100 mt-1">
                      Based on {userConditions.length} service-connected condition{userConditions.length !== 1 ? 's' : ''}
                    </p>
                  </div>
                  {/* Mobile: Full width buttons, Desktop: Inline */}
                  <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                    <ReportBugLink onClick={() => setShowBugSquasher(true)} variant="light" moduleName="Secondary Scout Results" />
                    <button
                      onClick={() => {
                        setShowSecondaryScout(false);
                        setShowMyPacket(true);
                      }}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-va-gold text-va-blue rounded-lg font-medium hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                    >
                      <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                      <span className="hidden xs:inline">My </span>Packet
                    </button>
                    <button
                      onClick={() => {
                        setShowSecondaryScout(false);
                        setShowSecondaryScoutLauncher(true);
                      }}
                      className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm sm:text-base"
                    >
                      <span className="hidden sm:inline">Change </span>Conditions
                    </button>
                    <button
                      onClick={() => setShowSecondaryScout(false)}
                      className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                      aria-label="Close"
                    >
                      <svg className="w-5 h-5 sm:w-6 sm:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="p-4 sm:p-6">
                <SecondaryScout 
                  userDisabilities={userConditions}
                  onLearnHow={handleLearnHow}
                  onViewPacket={() => {
                    setShowSecondaryScout(false);
                    setShowMyPacket(true);
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
      
      {/* Nexus Builder */}
      {showNexusBuilder && nexusBuilderData && (
        <NexusBuilder
          condition={nexusBuilderData.condition}
          primaryCondition={nexusBuilderData.primaryCondition}
          existingStatement={nexusBuilderData.existingStatement}
          onClose={() => setShowNexusBuilder(false)}
          onSave={handleSaveStatement}
          onReportBug={() => setShowBugSquasher(true)}
        />
      )}
      
      {/* My Packet */}
      {showMyPacket && (
        <MyPacket
          onResume={handleResumeFromPacket}
          onClose={() => setShowMyPacket(false)}
          onReportBug={() => setShowBugSquasher(true)}
          onAnalyzeStrategy={() => { setShowMyPacket(false); setShowPathfinder(true); }}
        />
      )}
      
      {/* C&P Simulator */}
      {showCAPSimulator && (
        <CAPSimulator
          onClose={() => setShowCAPSimulator(false)}
          onReportBug={() => setShowBugSquasher(true)}
          onSendToCalculator={handleSendToCalculator}
        />
      )}
      
      {/* VA Resources Hub */}
      {showVAResources && (
        <VAResources
          onClose={() => setShowVAResources(false)}
          onReportBug={() => setShowBugSquasher(true)}
        />
      )}
      
      {/* Forms Helper */}
      {showFormsHelper && (
        <FormsHelper
          onClose={() => setShowFormsHelper(false)}
          onReportBug={() => setShowBugSquasher(true)}
        />
      )}
      
      {/* C-File Analyzer */}
      {showCFileAnalyzer && (
        <CFileAnalyzer
          onClose={() => setShowCFileAnalyzer(false)}
        />
      )}
      
      {/* Shark Radar */}
      {showSharkRadar && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-screen">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowSharkRadar(false)}></div>
            <div className="relative bg-gray-50 dark:bg-gray-900 min-h-screen">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-red-600 to-orange-500 p-4 shadow-lg">
                <div className="max-w-4xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🦈</span>
                    <div>
                      <h2 className="text-xl font-bold text-white">Shark Radar</h2>
                      <p className="text-sm text-red-100">Contract & Email Scanner</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowSharkRadar(false)}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <SharkRadar />
            </div>
          </div>
        </div>
      )}
      
      {/* Pathfinder */}
      {showPathfinder && (
        <div className="fixed inset-0 z-50 overflow-y-auto">
          <div className="min-h-screen">
            <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setShowPathfinder(false)}></div>
            <div className="relative bg-gray-50 dark:bg-gray-900 min-h-screen">
              <div className="sticky top-0 z-10 bg-gradient-to-r from-blue-600 to-indigo-600 p-4 shadow-lg">
                <div className="max-w-5xl mx-auto flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className="text-3xl">🧭</span>
                    <div>
                      <h2 className="text-xl font-bold text-white">The Pathfinder</h2>
                      <p className="text-sm text-blue-100">Strategic Claims Analysis</p>
                    </div>
                  </div>
                  <button
                    onClick={() => setShowPathfinder(false)}
                    className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                    aria-label="Close"
                  >
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>
              </div>
              <Pathfinder onNavigate={handlePathfinderNavigate} />
            </div>
          </div>
        </div>
      )}
      
      {/* Bug Squasher */}
      {showBugSquasher && (
        <BugSquasher
          onClose={() => setShowBugSquasher(false)}
          appState={getCurrentAppState()}
        />
      )}
      
      {/* User Manual */}
      {showUserManual && (
        <UserManual
          onClose={() => setShowUserManual(false)}
          onReportBug={() => {
            setShowUserManual(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* State Benefit Hunter */}
      {showStateBenefitHunter && (
        <StateBenefitHunter
          onClose={() => setShowStateBenefitHunter(false)}
          onReportBug={() => {
            setShowStateBenefitHunter(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* VSO Finder */}
      {showVSOFinder && (
        <VSOFinder
          onClose={() => setShowVSOFinder(false)}
          onReportBug={() => {
            setShowVSOFinder(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Red Team - Statement Stress Test */}
      {showRedTeam && (
        <RedTeam
          onClose={() => setShowRedTeam(false)}
          onReportBug={() => {
            setShowRedTeam(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Symptom Logger */}
      {showSymptomLogger && (
        <SymptomLogger
          onClose={() => setShowSymptomLogger(false)}
          onReportBug={() => {
            setShowSymptomLogger(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Decision Decoder */}
      {showDecisionDecoder && (
        <DecisionDecoder
          onClose={() => setShowDecisionDecoder(false)}
          onReportBug={() => {
            setShowDecisionDecoder(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Tactical Calculator */}
      {showTacticalCalculator && (
        <TacticalCalculator
          onClose={() => setShowTacticalCalculator(false)}
          onReportBug={() => {
            setShowTacticalCalculator(false);
            setShowBugSquasher(true);
          }}
          capSimulatorResults={capSimulatorResults}
          onClearCapResults={() => setCapSimulatorResults([])}
        />
      )}
      
      {/* Blue Button X-Ray - Diamond Tier Data Mining */}
      {showBlueButtonXRay && (
        <BlueButtonXRay
          onClose={() => setShowBlueButtonXRay(false)}
          onAddToCalculator={(conditions) => {
            // Add conditions to Pathfinder for analysis
            setShowBlueButtonXRay(false);
            setShowPathfinder(true);
          }}
          onCheckRatingCriteria={(conditionName) => {
            // Search for the condition in the database
            setShowBlueButtonXRay(false);
            setSearchTerm(conditionName);
          }}
        />
      )}
      
      {/* Witness Bench - Diamond Tier Buddy Letter Wizard */}
      {showWitnessBench && (
        <WitnessBench
          onClose={() => setShowWitnessBench(false)}
          onReportBug={() => {
            setShowWitnessBench(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Risk Assessment - Diamond Tier Poke the Bear Calculator */}
      {showRiskAssessment && (
        <RiskAssessment
          onClose={() => setShowRiskAssessment(false)}
          onReportBug={() => {
            setShowRiskAssessment(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* TDIU Work Impact Builder - Specialized Tool */}
      {showTDIUBuilder && (
        <TDIUBuilder
          onClose={() => setShowTDIUBuilder(false)}
          onReportBug={() => {
            setShowTDIUBuilder(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* PACT Act Navigator - Specialized Tool */}
      {showPACTActNavigator && (
        <PACTActNavigator
          onClose={() => setShowPACTActNavigator(false)}
          onReportBug={() => {
            setShowPACTActNavigator(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* FOIA Generator (The Keysmith) - Specialized Tool */}
      {showFOIAGenerator && (
        <FOIAGenerator
          onClose={() => setShowFOIAGenerator(false)}
          onReportBug={() => {
            setShowFOIAGenerator(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Million Dollar Dashboard - Shock & Awe */}
      {showMillionDollarDashboard && (
        <MillionDollarDashboard
          onClose={() => setShowMillionDollarDashboard(false)}
          onReportBug={() => {
            setShowMillionDollarDashboard(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* MOS Hazard Matcher - Shock & Awe */}
      {showMOSHazardMatcher && (
        <MOSHazardMatcher
          onClose={() => setShowMOSHazardMatcher(false)}
          onAddToPathfinder={(conditions) => {
            // Could integrate with Pathfinder or My Packet in the future
            console.log('Add to pathfinder:', conditions);
            setShowMOSHazardMatcher(false);
          }}
          onReportBug={() => {
            setShowMOSHazardMatcher(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Web of Conditions - Shock & Awe */}
      {showWebOfConditions && (
        <WebOfConditions
          onClose={() => setShowWebOfConditions(false)}
          onSelectCondition={(condition) => {
            // Could navigate to search for the condition
            console.log('Selected condition:', condition);
          }}
          onReportBug={() => {
            setShowWebOfConditions(false);
            setShowBugSquasher(true);
          }}
        />
      )}
      
      {/* Funding Modal */}
      <FundingModal 
        show={showFundingModal} 
        onClose={() => setShowFundingModal(false)} 
      />
    </div>
  );
}

export default App;

