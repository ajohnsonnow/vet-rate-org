/*
 * Vet-Rate.org - VA Disability Claims Command Center
 * Copyright (C) 2024-2026 Anthony Johnson
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published
 * by the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * This is the main application component for the VA Disability Calculator.
 * Built by a fellow service-disabled veteran to help veterans navigate the
 * VA disability claims process.
 */

import React, { useState, useEffect, useCallback, Suspense } from "react";
import AppHeader from "./features/header/AppHeader";
import SearchBar from "./components/SearchBar";
import SearchResultCard from "./components/SearchResultCard";
import DisabilityDetails from "./components/DisabilityDetails";
import HomeFeatureCards from "./features/home-cta/HomeFeatureCards";
import BuyMeCoffee from "./components/BuyMeCoffee";
import FloatingBugButton from "./components/FloatingBugButton";
import ReportBugLink from "./components/ReportBugLink";
import AdminLogin from "./components/AdminLogin";
import AdminPanel from "./components/AdminPanel";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import QuickConditionPicker from "./components/QuickConditionPicker";
import MobileNotice from "./components/MobileNotice";
import SmallScreenWarning from "./features/small-screen-warning/SmallScreenWarning";
import TermsOfServiceModal from "./components/TermsOfServiceModal";
import CommandersChecklist from "./components/CommandersChecklist";
import CrisisListener from "./features/crisis/CrisisListener";
import { useUpdateOrchestrator } from "./features/update/useUpdateOrchestrator";
import VisionSimulator from "./features/vision/VisionSimulator";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import MusterCallFlow from "./features/muster-call/MusterCallFlow";
import FeedbackHub from "./features/feedback/FeedbackHub";
import LegalPages from "./features/legal/LegalPages";
import VaDemoTools from "./features/va-demo/VaDemoTools";
import PublicationsLibraryModal from "./features/publications/PublicationsLibraryModal";
import VKBTimelineModal from "./features/vkb/VKBTimelineModal";
import AppealsToolsCluster from "./features/appeals-tools/AppealsToolsCluster";
import DataManagementCluster from "./features/data-management/DataManagementCluster";
import DecisionToolsCluster from "./features/decision-tools/DecisionToolsCluster";
import AITransparencyCluster from "./features/ai-transparency/AITransparencyCluster";
import ResourcesCluster from "./features/resources/ResourcesCluster";
import AdversarialTestingCluster from "./features/adversarial-testing/AdversarialTestingCluster";
import MaximizeRatingCluster from "./features/maximize-rating/MaximizeRatingCluster";
import BodyMappingCluster from "./features/body-mapping/BodyMappingCluster";
import WorkflowGuidesCluster from "./features/workflow-guides/WorkflowGuidesCluster";
import KnowledgeCluster from "./features/knowledge/KnowledgeCluster";
import ClaimPrepCluster from "./features/claim-prep/ClaimPrepCluster";
import QualityControlCluster from "./features/quality-control/QualityControlCluster";
import SpecializedToolsCluster from "./features/specialized-tools/SpecializedToolsCluster";
import EvidenceInvestigationCluster from "./features/evidence-investigation/EvidenceInvestigationCluster";
import SystemToolsCluster from "./features/system-tools/SystemToolsCluster";
import CalculateCluster from "./features/calculate/CalculateCluster";
import ClaimNavigatorModal from "./features/navigator/ClaimNavigatorModal";
import MyPacketModal from "./features/my-packet/MyPacketModal";
import PathfinderModal from "./features/pathfinder/PathfinderModal";
import BlueButtonXRayModal from "./features/blue-button/BlueButtonXRayModal";
import DiscoverCluster from "./features/discover/DiscoverCluster";
import ToastContainer, { useToast } from "./components/Toast";
import PWAInstallButton from "./components/PWAInstallButton";
import ZonkButton from "./components/ZonkButton";
import LoadingBunker from "./components/LoadingBunker";
import QuickExitButton from "./components/QuickExitButton";
import { LocalAIProvider } from "./components/LocalAIPanel";
import OnboardingGate from "./features/onboarding/OnboardingGate";
import DemoDataLoader from "./components/DemoDataLoader";
import ShareButton, { PIISensitive } from "./components/ShareButton";
import SecurityBadge from "./components/SecurityBadge";
import { VaApiStatusBanner } from "./components/VaApiStatus";
import { isVaApiEnabled } from "./config/vaAuth";
import { MobileSaveReminder } from "./components/PacketPersistence";
import StressReliefDivision from "./components/StressReliefDivision";
import MobileBottomNav, { MobileNavSpacer } from "./components/MobileBottomNav";
import GlobalCommandSearchWrapper from "./features/global-command-search/GlobalCommandSearchWrapper";
import AtomicWipe from "./components/AtomicWipe";
import { HelperModeProvider } from "./contexts/HelperModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FocusModeProvider } from "./contexts/FocusModeContext";
import { LanguageProvider } from "./contexts/LanguageContext";

import { initializeCompassionateVoice } from "./utils/voiceIndex";
import { searchDisabilityData, validateSearchTerm } from "./utils/searchUtils";
import { initializeErrorCapture } from "./utils/bugReportUtils";
import { setupBeforeUnloadWarning } from "./utils/dataPersistence";
import { useBootSequence } from "./features/boot/useBootSequence";
import disabilityData from "./data/disabilityData.json";
import { PROJECT_STATS } from "./data/projectStats";
import AIAssistantBubble from "./features/ai-assistant/AIAssistantBubble";
import AppFooter from "./features/footer/AppFooter";
import "./index.css";

function App() {
  // Toast notification system
  const { toasts, onClose, onAction } = useToast();

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [userConditions, setUserConditions] = useState([]);
  // ExamPrepRoom state removed - functionality merged into CAPSimulator

  // FORCE MULTIPLIER FEATURES
  // showAISettings hoisted into SystemToolsCluster (audit #35, B52).

  // VKB: Veteran Knowledge Base Viewer

  // AAAAA DIAMOND STANDARD: Command Search & Privacy
  const [showAtomicWipe, setShowAtomicWipe] = useState(false);

  // CLEAR COAT: Onboarding & Trust Features

  // SAFETY-CRITICAL: Crisis Intervention surface lives in
  // src/features/crisis/CrisisListener.jsx — state + listener + render
  // colocated there (audit #35, B25).

  // LIVE OPS: Update banner + What's-New modal live in
  // src/features/update/useUpdateOrchestrator.jsx — banner/modal JSX, version
  // bookkeeping, and SW update checker colocated there (audit #35, B25).
  const { whatsNewOpen, updateBanner, whatsNewModal } = useUpdateOrchestrator();

  // Boot sequence: maintenance check, IndexedDB migration, persistent
  // storage + auto-backup init, user-data migrations. See
  // features/boot/useBootSequence.js (audit #35, B59).
  const { isMigrating, maintenanceMode, maintenanceMessage } =
    useBootSequence();

  // openBugSquasher / openAISettings / openSymptomLogger event bridges
  // now live in SystemToolsCluster, which also handles the
  // openVisionSimulator → close-AI-Command-Center side-effect
  // (audit #35, B52).

  // Initialize error capture for bug reports
  useEffect(() => {
    initializeErrorCapture();
  }, []);

  // Initialize Compassionate Voice System (panic key, crisis listener)
  useEffect(() => {
    initializeCompassionateVoice();
    console.log("🎙️ Compassionate Voice System initialized");
  }, []);

  // Helper function to get current tool name for AI Assistant context
  const getCurrentToolName = () => {
    if (selectedResult) return "Disability Details";
    return "Home";
  };

  // Setup beforeunload warning for unsaved changes
  useEffect(() => {
    setupBeforeUnloadWarning();
  }, []);

  // searchDisability bridge: BlueButtonXRayModal's Check Rating Criteria
  // callback dispatches into App.jsx's searchTerm state.
  useEffect(() => {
    const searchDisabilityBridge = (e) => {
      if (e?.detail?.term !== undefined) setSearchTerm(e.detail.term);
    };
    window.addEventListener("searchDisability", searchDisabilityBridge);
    return () => {
      window.removeEventListener("searchDisability", searchDisabilityBridge);
    };
  }, []);

  // DEMO: Keyboard shortcut to open Demo Dashboard (Ctrl+Shift+D)
  // CMD+K (GlobalCommandSearch) lives in GlobalCommandSearchWrapper.
  // Admin panel (Ctrl+Shift+A) is handled by AdminAuthContext.
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.ctrlKey && e.shiftKey && e.key === "D" && isVaApiEnabled()) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("openDemoDashboard"));
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  const handleBuildStatementFromSearch = (conditionName) => {
    setSelectedResult(null);
    window.dispatchEvent(
      new CustomEvent("openNexusBuilder", {
        detail: {
          condition: conditionName,
          primaryCondition: null,
          existingStatement: null,
        },
      }),
    );
  };

  // Handler for navigating to a secondary condition from DisabilityDetails
  const handleSecondaryConditionClick = (diagnosticCode, conditionName) => {
    // First try to find by diagnostic code
    const foundCondition = disabilityData.disabilities.find(
      (d) => d.diagnosticCode === diagnosticCode,
    );

    if (foundCondition) {
      setSelectedResult(foundCondition);
      // Scroll to diagnostic header to position heading at top of view
      setTimeout(() => {
        const headerElement = document.getElementById("diagnostic-header");
        if (headerElement) {
          headerElement.scrollIntoView({ behavior: "smooth", block: "start" });
        }
      }, 100);
    } else {
      // If not found by exact code, search by name
      setSearchTerm(conditionName);
      setSelectedResult(null);
    }
  };

  // Handler for Workflow Guide tool navigation (WorkflowGuidesCluster
  // closes its own panel before invoking this).
  const handleToolSelect = (toolId) => {
    const toolMap = {
      "forms-helper": () =>
        window.dispatchEvent(new CustomEvent("openFormsHelper")),
      "veteran-profile": () =>
        window.dispatchEvent(new CustomEvent("openMyPacket")),
      "conditions-search": () => {}, // Main search is always visible
      "tactical-calculator": () =>
        window.dispatchEvent(new CustomEvent("openTacticalCalculator")),
      "secondary-scout": () =>
        window.dispatchEvent(new CustomEvent("openSecondaryScoutLauncher")),
      "my-packet": () => window.dispatchEvent(new CustomEvent("openMyPacket")),
      "knowledge-base": () =>
        window.dispatchEvent(new CustomEvent("openVKBViewer")),
      "nexus-builder": () =>
        window.dispatchEvent(new CustomEvent("openNexusBuilder")),
      "statement-analyzer": () =>
        window.dispatchEvent(new CustomEvent("openNexusBuilder")),
      "mos-hazard": () =>
        window.dispatchEvent(new CustomEvent("openMOSHazardMatcher")),
      "timeline-wizard": () =>
        window.dispatchEvent(new CustomEvent("openEvidenceTimeline")), // Timeline Wizard maps to Evidence Timeline
      "dd214-analyzer": () =>
        window.dispatchEvent(new CustomEvent("openDD214Analyzer")),
      "web-of-conditions": () =>
        window.dispatchEvent(new CustomEvent("openWebOfConditions")),
      "cap-simulator": () =>
        window.dispatchEvent(new CustomEvent("openCAPSimulator")),
      "pain-painter": () =>
        window.dispatchEvent(new CustomEvent("openPainPainter")),
      "evidence-gap": () =>
        window.dispatchEvent(new CustomEvent("openEvidenceGapVisualizer")),
      "cfile-analyzer": () =>
        window.dispatchEvent(new CustomEvent("openCFileAnalyzer")),
      "foia-generator": () =>
        window.dispatchEvent(new CustomEvent("openFOIAGenerator")),
      "retro-pay-hunter": () =>
        window.dispatchEvent(new CustomEvent("openRetroPayHunter")),
      "tdiu-builder": () =>
        window.dispatchEvent(new CustomEvent("openTDIUBuilder")),
      pathfinder: () => window.dispatchEvent(new CustomEvent("openPathfinder")),
      "million-dollar-dashboard": () =>
        window.dispatchEvent(new CustomEvent("openMillionDollarDashboard")),
      "vso-finder": () =>
        window.dispatchEvent(new CustomEvent("openVSOFinder")),
      "witness-bench": () =>
        window.dispatchEvent(new CustomEvent("openWitnessBench")),
      "claim-navigator": () =>
        window.dispatchEvent(new CustomEvent("openClaimNavigator")),
      "va-resources": () =>
        window.dispatchEvent(new CustomEvent("openVAResources")),
      "user-manual": () =>
        window.dispatchEvent(new CustomEvent("openUserManual")),
      "nexus-analyzer": () =>
        window.dispatchEvent(new CustomEvent("openNexusQualityAnalyzer")),
      "remand-checker": () =>
        window.dispatchEvent(new CustomEvent("openRemandRiskChecker")),
      "appeals-advisor": () =>
        window.dispatchEvent(new CustomEvent("openAppealsLaneAdvisor")),
      "bdd-builder": () =>
        window.dispatchEvent(new CustomEvent("openBDDBuilder")),
    };

    // Execute the tool opener if it exists
    if (toolMap[toolId]) {
      toolMap[toolId]();
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
        setError(
          "Invalid search term. Please use only letters, numbers, spaces, hyphens, or slashes.",
        );
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
          setError(
            `No disabilities found for "${searchTerm}". Try searching by condition name (e.g., "PTSD", "arthritis") or diagnostic code (e.g., "9411", "5002").`,
          );
        }
      } catch (err) {
        console.error("Search error:", err);
        setError("An error occurred while searching. Please try again.");
        setResults([]);
      } finally {
        setIsLoading(false);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [searchTerm]);

  const handleClearSearch = useCallback(() => {
    setSearchTerm("");
    setResults([]);
    setSelectedResult(null);
    setError(null);
  }, []);

  // Gather current app state for bug reports - DIAMOND LEVEL: All 45+ tools tracked!
  const getCurrentAppState = useCallback(
    () => ({
      // Search & Core
      searchTerm,
      results,
      selectedResult,
      hasSearched,
      error,

      userConditions,

      // Helper to determine current module - DIAMOND LEVEL SMART DETECTION
      currentModule: (() => {
        if (selectedResult) return "Disability Details View";
        return "Disability Search";
      })(),
    }),
    [searchTerm, results, selectedResult, hasSearched, error, userConditions],
  );

  // Show migration loading screen if migrating
  if (isMigrating) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <LoadingBunker
            size="large"
            message="Migrating to Enhanced Storage..."
          />
          <p className="text-gray-400 mt-4 text-sm">
            Upgrading your data storage. This only happens once.
          </p>
        </div>
      </div>
    );
  }

  // KILL SWITCH: If maintenance mode is active, show static maintenance page
  if (maintenanceMode) {
    return <MaintenancePage message={maintenanceMessage} />;
  }

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-emerald-950 flex flex-col transition-colors duration-200">
      {/* 🎮 Stress Relief Division Easter Egg - Type IDDQD anywhere */}
      <StressReliefDivision />

      {/* Toast Notification System */}
      <ToastContainer toasts={toasts} onClose={onClose} onAction={onAction} />

      {/* Onboarding — DisclaimerSplash + BootCampTour, gated on whatsNewOpen */}
      <OnboardingGate whatsNewOpen={whatsNewOpen} />

      {/* VA API Status Banner — only when the VA-API surface is enabled */}
      {isVaApiEnabled() && <VaApiStatusBanner />}

      {/* Mobile device notice */}
      <MobileNotice />

      {/* Active Development Banner */}
      <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white py-2 px-4 text-center shadow-md">
        <div className="flex items-center justify-center space-x-2 text-sm">
          <span className="animate-pulse text-lg">🎖️</span>
          <span className="font-semibold">ACTIVE DEVELOPMENT:</span>
          <span>
            We're on a ruck march bringing code improvements to you! Save your
            work often.
          </span>
          <span className="animate-pulse text-lg">🎖️</span>
        </div>
      </div>

      <GlobalCommandSearchWrapper />

      {/* AAAAA Diamond Standard: Atomic Wipe (Panic Button) */}
      <AtomicWipe
        isOpen={showAtomicWipe}
        onClose={() => setShowAtomicWipe(false)}
        onWipeComplete={() => {
          setShowAtomicWipe(false);
          // Reset all state to initial values
          setUserConditions([]);
          setSearchTerm("");
          setResults([]);
          setSelectedResult(null);
        }}
      />

      <AppHeader />
      <BuyMeCoffee
        show={hasSearched && results.length > 0}
        trigger="search"
        context={{ count: results.length, query: searchTerm }}
      />

      <main
        id="main-content"
        className="flex-1 container mx-auto px-4 py-8 max-w-7xl"
        role="main"
        aria-label="Main content"
      >
        {/* Hero Section with Search */}
        <div className="text-center mb-8">
          <h1 className="text-4xl md:text-5xl font-bold text-gray-900 dark:text-white mb-4">
            🛡️ Your VA Claims Command Center
          </h1>
          <p className="text-lg text-gray-700 dark:text-gray-300 max-w-3xl mx-auto mb-6">
            Search{" "}
            <strong>
              {PROJECT_STATS.disabilitiesValidated} rated disabilities
            </strong>{" "}
            with official rating criteria, discover secondary conditions,
            practice for C&P exams, and build your evidence packet - all in one
            place.
          </p>
        </div>

        {/* SEARCH BAR - Prominent Position */}
        <div className="max-w-4xl mx-auto mb-8">
          {/* Mission Readiness Progress Bar - Embedded */}
          <div className="mb-6">
            <CommandersChecklist
              isEmbedded={true}
              onToolSelect={(toolName) => {
                // Handle tool navigation from checklist
                if (toolName === "veteran-profile")
                  window.dispatchEvent(new CustomEvent("openFormsHelper"));
                else if (toolName === "conditions-search")
                  setHasSearched(false);
                else if (toolName === "cfile-analyzer")
                  window.dispatchEvent(new CustomEvent("openCFileAnalyzer"));
                else if (toolName === "symptom-logger")
                  window.dispatchEvent(new CustomEvent("openSymptomLogger"));
                else if (toolName === "my-packet")
                  window.dispatchEvent(new CustomEvent("openMyPacket"));
                else if (toolName === "nexus-builder")
                  window.dispatchEvent(new CustomEvent("openNexusBuilder"));
                else if (toolName === "secondary-scout")
                  window.dispatchEvent(
                    new CustomEvent("openSecondaryScoutLauncher"),
                  );
                else if (toolName === "tactical-calculator")
                  window.dispatchEvent(
                    new CustomEvent("openTacticalCalculator"),
                  );
                else if (toolName === "forms-helper")
                  window.dispatchEvent(new CustomEvent("openFormsHelper"));
              }}
            />
          </div>

          <div
            id="tour-search-section"
            className="bg-white dark:bg-emerald-900 rounded-2xl shadow-lg border-2 border-blue-200 dark:border-emerald-600 p-6"
          >
            <SearchBar
              searchTerm={searchTerm}
              setSearchTerm={setSearchTerm}
              onClear={handleClearSearch}
              isLoading={isLoading}
            />
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center mt-3">
              💡 <strong>Tip:</strong> Search by condition name, diagnostic
              code, or keyword - covers all 15 body systems from 38 CFR Part 4
            </p>

            {/* Demo Data Loader - "Gold Standard" Example */}
            <div className="text-center mt-4">
              <DemoDataLoader
                onDataLoaded={() =>
                  window.dispatchEvent(new CustomEvent("openMyPacket"))
                }
                variant="link"
              />
            </div>
          </div>

          {/* SEARCH RESULTS - Directly under search bar */}
          {error && (
            <div
              className="mt-4 p-4 bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg"
              role="alert"
            >
              <p className="text-yellow-800 dark:text-yellow-200">
                <strong>Info:</strong> {error}
              </p>
            </div>
          )}

          {isLoading && (
            <div className="flex justify-center my-8">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-va-blue border-t-va-gold"></div>
            </div>
          )}

          {!isLoading && results.length > 0 && (
            <div className="mt-6">
              <h2 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">
                ✅ Search Results ({results.length} found)
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {results.map((result) => (
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

          {!isLoading &&
            searchTerm.trim() !== "" &&
            results.length === 0 &&
            !error && (
              <div className="text-center py-8">
                <p className="text-gray-600 dark:text-gray-400 text-lg">
                  No matching disabilities found.
                </p>
              </div>
            )}
        </div>

        {/* Quick Condition Picker - Below Search Results */}
        <div id="tour-quick-picker" className="max-w-4xl mx-auto mb-8">
          <QuickConditionPicker
            onViewPacket={() =>
              window.dispatchEvent(new CustomEvent("openMyPacket"))
            }
          />
        </div>

        {selectedResult && (
          <DisabilityDetails
            result={selectedResult}
            searchTerm={searchTerm}
            onClose={() => setSelectedResult(null)}
            onBuildStatement={handleBuildStatementFromSearch}
            onSecondaryConditionClick={handleSecondaryConditionClick}
          />
        )}

        <HomeFeatureCards />
      </main>

      {/* Floating Bug Report Button */}
      <FloatingBugButton
        onClick={() => window.dispatchEvent(new CustomEvent("openBugSquasher"))}
      />

      <AIAssistantBubble currentTool={getCurrentToolName()} />

      <AppFooter />

      {/* Modals — lazy cluster with Suspense boundary (B21, audit #28).
          Each <Show...> conditional below mounts a React.lazy component
          declared at the top of this file; the chunk is fetched on first
          open. <LoadingBunker /> is the shared fallback. */}
      <Suspense fallback={<LoadingBunker />}>
        {/* Legal/info modals — Privacy, About, Contact, Terms (features/legal) */}
        <LegalPages />

        <DiscoverCluster
          userConditions={userConditions}
          setUserConditions={setUserConditions}
        />

        <MyPacketModal />

        <PublicationsLibraryModal />

        <EvidenceInvestigationCluster />

        {/* Muster Call → Intelligence Briefing — owned by features/muster-call */}
        <MusterCallFlow
          onOpenDD214Analyzer={() =>
            window.dispatchEvent(new CustomEvent("openDD214Analyzer"))
          }
        />

        <KnowledgeCluster />

        <VKBTimelineModal />

        <QualityControlCluster />

        <PathfinderModal />

        <ClaimNavigatorModal />

        <SystemToolsCluster getAppState={getCurrentAppState} />

        {/* Feature Request + Community Roadmap — owned by features/feedback */}
        <FeedbackHub getAppState={getCurrentAppState} />

        {/* Admin Authentication & Panel - Access via Ctrl+Shift+A */}
        <AdminLogin />
        <AdminPanel />

        <ClaimPrepCluster onToolSelect={handleToolSelect} />

        <VaDemoTools />

        <AdversarialTestingCluster />

        <CalculateCluster />

        <BlueButtonXRayModal />

        <SpecializedToolsCluster />

        <MaximizeRatingCluster />

        {/* The Consistency Engine - Data Auditor */}
        <AITransparencyCluster />

        <AppealsToolsCluster />

        <DecisionToolsCluster />

        <BodyMappingCluster />

        {/* ExamPrepRoom functionality merged into CAPSimulator - use "Exam Prep" button in C&P Exam Simulator */}

        <ResourcesCluster />

        <DataManagementCluster />

        {/* Vision Simulator — owned by features/vision/VisionSimulator (listens to `openVisionSimulator`) */}
        <VisionSimulator />

        {/* DIAMOND-TIER: PWA Install Prompt */}
        <PWAInstallButton />

        {/* Terms of Service Modal - Critical First-Visit Legal Protection */}
        <TermsOfServiceModal />

        {/* LIVE OPS: Update banner + What's-New modal — owned by useUpdateOrchestrator */}
        {updateBanner}
        {whatsNewModal}

        <WorkflowGuidesCluster onToolSelect={handleToolSelect} />
      </Suspense>

      {/* SAFETY-CRITICAL: Crisis interception — highest z-index, blocks all other UI */}
      <CrisisListener />

      <SmallScreenWarning />

      {/* FORCE MULTIPLIER: Focus Mode Toggle for TBI/ADHD users - Now integrated into modal headers */}

      {/* COMPASSIONATE VOICE: Quick Exit Button - Trauma-informed safety */}
      <QuickExitButton position="bottom-left" variant="subtle" />

      {/* Security Badge - Always visible proof of privacy */}
      <SecurityBadge />

      {/* AAAAA Diamond Standard: Mobile Bottom Navigation */}
      <MobileBottomNav
        onSearchClick={() =>
          window.dispatchEvent(new CustomEvent("openGlobalCommandSearch"))
        }
        onCalculatorClick={() =>
          window.dispatchEvent(new CustomEvent("openTacticalCalculator"))
        }
        onPacketClick={() =>
          window.dispatchEvent(new CustomEvent("openMyPacket"))
        }
        onMissionsClick={() =>
          window.dispatchEvent(new CustomEvent("openWorkflowGuide"))
        }
        packetCount={userConditions.length}
        currentRating={
          userConditions.length > 0
            ? userConditions.reduce((acc, c) => Math.max(acc, c.rating || 0), 0)
            : null
        }
      />
      <MobileNavSpacer />
    </div>
  );
}

// Wrap App with all required providers including secure admin authentication
function AppWrapper() {
  return (
    <AdminAuthProvider>
      <LanguageProvider>
        <LocalAIProvider>
          <ToastProvider>
            <FocusModeProvider>
              <HelperModeProvider>
                <App />
              </HelperModeProvider>
            </FocusModeProvider>
          </ToastProvider>
        </LocalAIProvider>
      </LanguageProvider>
    </AdminAuthProvider>
  );
}

export default AppWrapper;
