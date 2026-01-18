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
    showUserManual
  }), [
    searchTerm, results, selectedResult, hasSearched, error,
    showPrivacyPolicy, showAboutUs, showContactUs,
    showSecondaryScoutLauncher, showSecondaryScout, userConditions,
    showNexusBuilder, nexusBuilderData, showMyPacket, showCAPSimulator, showVAResources, showFormsHelper, showCFileAnalyzer, showUserManual
  ]);

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-900 flex flex-col transition-colors duration-200">
      {/* Disclaimer Splash - shows on first visit */}
      <DisclaimerSplash onAcknowledge={() => setDisclaimerAcknowledged(true)} />
      
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
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-6">🛠️ Claims Building Tools</h2>
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

          {/* C-File Analyzer CTA - Full Width - Featured */}
          <div className="mt-6 bg-gradient-to-br from-rose-50 via-pink-50 to-fuchsia-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-fuchsia-900/40 border-2 border-pink-300 dark:border-pink-700 rounded-xl p-5 hover:shadow-lg transition-shadow relative overflow-hidden">
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

          {/* Shark Radar & Pathfinder - Two Column */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-6">
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

            {/* Pathfinder CTA */}
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 dark:from-blue-900/40 dark:to-indigo-900/40 border border-blue-200 dark:border-blue-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
              <div className="flex items-start gap-3 mb-3">
                <div className="bg-blue-100 dark:bg-blue-800/50 rounded-lg p-2">
                  <span className="text-2xl">🧭</span>
                </div>
                <div className="flex-1">
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    The Pathfinder
                    <span className="px-2 py-0.5 bg-blue-500 text-white text-xs rounded-full">NEW</span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                <strong>Strategic claims analysis.</strong> Enter your current ratings and let AI suggest 
                <strong> high-probability secondary claims</strong> you may be missing, with direct links to build your case.
              </p>
              <button
                onClick={() => setShowPathfinder(true)}
                className="w-full px-4 py-2.5 bg-gradient-to-r from-blue-500 to-indigo-600 text-white rounded-lg font-semibold hover:from-blue-600 hover:to-indigo-700 transition-colors"
              >
                📊 Analyze My Strategy
              </button>
            </div>
          </div>

          {/* Quick Condition Picker - Full Width */}
          <div className="mt-6">
            <QuickConditionPicker onViewPacket={() => setShowMyPacket(true)} />
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
                The most comprehensive free VA claims toolkit—748 disabilities, official rating criteria, secondary condition discovery, C&P exam prep, and evidence-building tools.
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
      
      {/* Funding Modal */}
      <FundingModal 
        show={showFundingModal} 
        onClose={() => setShowFundingModal(false)} 
      />
    </div>
  );
}

export default App;

