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
import Header from "./components/Header";
import SearchBar from "./components/SearchBar";
import SearchResultCard from "./components/SearchResultCard";
import DisabilityDetails from "./components/DisabilityDetails";
import Disclaimer from "./components/Disclaimer";
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
import { getFormsCount } from "./utils/formsCount";
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

      <Header
        // Core Navigation
        onMyPacketClick={() =>
          window.dispatchEvent(new CustomEvent("openMyPacket"))
        }
        onKnowledgeBaseClick={() =>
          window.dispatchEvent(new CustomEvent("openVKBViewer"))
        }
        onVKBTimelineClick={() =>
          window.dispatchEvent(new CustomEvent("openVKBTimeline"))
        }
        onUserManualClick={() =>
          window.dispatchEvent(new CustomEvent("openUserManual"))
        }
        onVAResourcesClick={() =>
          window.dispatchEvent(new CustomEvent("openVAResources"))
        }
        // Calculate
        onTacticalCalculatorClick={() =>
          window.dispatchEvent(new CustomEvent("openTacticalCalculator"))
        }
        onMillionDollarDashboardClick={() =>
          window.dispatchEvent(new CustomEvent("openMillionDollarDashboard"))
        }
        onWhatIfSandboxClick={() =>
          window.dispatchEvent(new CustomEvent("openWhatIfSandbox"))
        }
        onRetroPayHunterClick={() =>
          window.dispatchEvent(new CustomEvent("openRetroPayHunter"))
        }
        onTimeMachineClick={() =>
          window.dispatchEvent(new CustomEvent("openTimeMachine"))
        }
        // Discover
        onSecondaryScoutClick={() =>
          window.dispatchEvent(new CustomEvent("openSecondaryScoutLauncher"))
        }
        onCAPSimulatorClick={() =>
          window.dispatchEvent(new CustomEvent("openCAPSimulator"))
        }
        // ExamPrepRoom merged into CAPSimulator - access via "Exam Prep" button
        onPathfinderClick={() =>
          window.dispatchEvent(new CustomEvent("openPathfinder"))
        }
        onClaimNavigatorClick={() =>
          window.dispatchEvent(new CustomEvent("openClaimNavigator"))
        }
        onMOSHazardMatcherClick={() =>
          window.dispatchEvent(new CustomEvent("openMOSHazardMatcher"))
        }
        onPACTActNavigatorClick={() =>
          window.dispatchEvent(new CustomEvent("openPACTActNavigator"))
        }
        onWebOfConditionsClick={() =>
          window.dispatchEvent(new CustomEvent("openWebOfConditions"))
        }
        onBDDBuilderClick={() =>
          window.dispatchEvent(new CustomEvent("openBDDBuilder"))
        }
        // Build Evidence
        onCFileAnalyzerClick={() =>
          window.dispatchEvent(new CustomEvent("openCFileAnalyzer"))
        }
        onBlueButtonXRayClick={() =>
          window.dispatchEvent(new CustomEvent("openBlueButtonXRay"))
        }
        onRecordSearchClick={() =>
          window.dispatchEvent(new CustomEvent("openRecordSearch"))
        }
        onWitnessBenchClick={() =>
          window.dispatchEvent(new CustomEvent("openWitnessBench"))
        }
        onNexusBuilderClick={() =>
          window.dispatchEvent(new CustomEvent("openNexusBuilder"))
        }
        onFormsHelperClick={() =>
          window.dispatchEvent(new CustomEvent("openFormsHelper"))
        }
        onSymptomLoggerClick={() =>
          window.dispatchEvent(new CustomEvent("openSymptomLogger"))
        }
        onPainPainterClick={() =>
          window.dispatchEvent(new CustomEvent("openPainPainter"))
        }
        onEvidenceTimelineClick={() =>
          window.dispatchEvent(new CustomEvent("openEvidenceTimeline"))
        }
        onFOIAGeneratorClick={() =>
          window.dispatchEvent(new CustomEvent("openFOIAGenerator"))
        }
        // Quality Control
        onRedTeamClick={() =>
          window.dispatchEvent(new CustomEvent("openRedTeam"))
        }
        onClaimStressTestClick={() =>
          window.dispatchEvent(new CustomEvent("openClaimStressTest"))
        }
        onDecisionDecoderClick={() =>
          window.dispatchEvent(new CustomEvent("openDecisionDecoder"))
        }
        onDenialDecoderClick={() =>
          window.dispatchEvent(new CustomEvent("openDenialDecoder"))
        }
        onSharkRadarClick={() =>
          window.dispatchEvent(new CustomEvent("openSharkRadar"))
        }
        onConsistencyEngineClick={() =>
          window.dispatchEvent(new CustomEvent("openConsistencyEngine"))
        }
        onEvidenceGapVisualizerClick={() =>
          window.dispatchEvent(new CustomEvent("openEvidenceGapVisualizer"))
        }
        onRiskAssessmentClick={() =>
          window.dispatchEvent(new CustomEvent("openRiskAssessment"))
        }
        // Maximize Your Rating
        onTDIUBuilderClick={() =>
          window.dispatchEvent(new CustomEvent("openTDIUBuilder"))
        }
        onStateBenefitHunterClick={() =>
          window.dispatchEvent(new CustomEvent("openStateBenefitHunter"))
        }
        onTheTribunalClick={() =>
          window.dispatchEvent(new CustomEvent("openTheTribunal"))
        }
        onLegislativeWatchdogClick={() =>
          window.dispatchEvent(new CustomEvent("openLegislativeWatchdog"))
        }
        // Support & Resources
        onVSOFinderClick={() =>
          window.dispatchEvent(new CustomEvent("openVSOFinder"))
        }
        onVaIntegrationDemoClick={
          isVaApiEnabled()
            ? () =>
                window.dispatchEvent(new CustomEvent("openVaIntegrationDemo"))
            : undefined
        }
        onBackupManagerClick={() =>
          window.dispatchEvent(new CustomEvent("openBackupManager"))
        }
        onCloudSyncClick={() =>
          window.dispatchEvent(new CustomEvent("openCloudSyncManager"))
        }
        onAISettingsClick={() =>
          window.dispatchEvent(new CustomEvent("openAISettings"))
        }
        // Onboarding & Guides
        onWorkflowGuideClick={() =>
          window.dispatchEvent(new CustomEvent("openWorkflowGuide"))
        }
        // Feature Request & Community Roadmap — handled by FeedbackHub
        onFeatureRequestClick={() =>
          window.dispatchEvent(new CustomEvent("openFeatureRequest"))
        }
        onCommunityRoadmapClick={() =>
          window.dispatchEvent(new CustomEvent("openCommunityRoadmap"))
        }
      />
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

        {/* Feature CTAs - Below Search */}
        <div className="mt-12 max-w-4xl mx-auto">
          {/* SECTION 1: ESSENTIAL TOOLS - What Everyone Needs First */}
          <h2 className="text-2xl font-bold text-gray-800 dark:text-gray-100 text-center mb-2">
            ⚡ Essential Tools
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Start here - calculate your rating and organize your claims
          </p>

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
                    <h3 className="text-3xl font-bold">Tactical Calculator</h3>
                    <span className="px-3 py-1 bg-yellow-400 text-yellow-900 text-xs font-bold rounded-full animate-pulse">
                      CORE FEATURE
                    </span>
                  </div>
                  <p className="text-blue-100 max-w-xl">
                    <strong>Calculate your REAL rating</strong> using official
                    VA math (38 CFR § 4.25). Includes{" "}
                    <strong>Bilateral Factor</strong>, gap analysis to reach
                    100%, and
                    <strong> 2026 pay estimates</strong> with dependents.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("openTacticalCalculator"),
                      )
                    }
                    className="px-8 py-4 bg-white text-indigo-700 rounded-xl font-bold text-lg hover:bg-blue-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>🎯</span>
                    <span>Calculate My Rating</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: DISCOVER YOUR CLAIMS - Teal Theme */}
          <h2 className="text-2xl font-bold text-teal-700 dark:text-teal-300 text-center mb-2 mt-12">
            🔍 Discover Your Claims
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Find secondary conditions, practice for exams, and strategize your
            approach
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Secondary Scout CTA */}
            <div className="bg-gradient-to-br from-teal-50 to-emerald-50 dark:from-teal-900/40 dark:to-emerald-900/40 border-2 border-teal-300 dark:border-teal-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-teal-500 to-emerald-600 rounded-xl p-3 shadow-lg flex-shrink-0">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Secondary Scout
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-teal-500 text-white text-xs font-bold rounded-full">
                    INSTANT
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                Discover <strong>secondary claims</strong> linked to your
                service-connected disabilities - powered by our comprehensive
                nexus database and 38 CFR § 3.310.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("openSecondaryScoutLauncher"),
                  )
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-emerald-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-emerald-700 transition-all shadow-md hover:shadow-lg"
              >
                🚀 Launch Secondary Scout
              </button>
            </div>

            {/* C&P Simulator CTA */}
            <div className="bg-gradient-to-br from-teal-50 to-cyan-50 dark:from-teal-900/40 dark:to-cyan-900/40 border-2 border-teal-300 dark:border-teal-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-teal-500 to-cyan-600 rounded-xl p-3 shadow-lg flex-shrink-0">
                  <svg
                    className="w-7 h-7 text-white"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    C&P Exam Simulator
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-teal-500 text-white text-xs font-bold rounded-full">
                    PRACTICE
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                Practice for your <strong>C&P exam</strong> with
                condition-specific questions, DBQ-aligned scenarios, and
                real-time feedback to maximize your rating.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openCAPSimulator"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-teal-600 to-cyan-600 text-white rounded-lg font-semibold hover:from-teal-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg"
              >
                🎯 Launch C&P Simulator
              </button>
            </div>
          </div>

          {/* BDD Builder CTA - Active Duty Transitioning */}
          <div className="mt-6">
            <div className="bg-gradient-to-r from-amber-500 via-yellow-500 to-amber-500 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>

              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="w-16 h-16 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                    <span className="text-4xl">🎖️</span>
                  </div>
                </div>

                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <h3 className="text-xl font-bold">BDD Builder</h3>
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                    <span className="px-2 py-0.5 bg-red-500/80 text-white text-xs font-bold rounded-full">
                      ACTIVE DUTY
                    </span>
                  </div>
                  <p className="text-amber-100 max-w-2xl">
                    <strong>Leaving the service?</strong> File your VA claim{" "}
                    <strong>before</strong> you separate. The BDD program (38
                    CFR &sect; 3.326) lets you claim{" "}
                    <strong>180-90 days</strong> before discharge &mdash;
                    benefits start Day 1 as a veteran.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent("openBDDBuilder"))
                    }
                    className="px-6 py-3 bg-white text-amber-700 rounded-lg font-bold text-lg hover:bg-amber-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>🎖️</span>
                    <span>Plan My BDD Claim</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Pathfinder CTA - Full Width Featured - Teal Theme for Discover Section */}
          <div className="mt-6">
            <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 rounded-xl p-6 text-white relative overflow-hidden shadow-xl">
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
                    <span className="px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">
                      AI STRATEGY
                    </span>
                  </div>
                  <p className="text-teal-100 max-w-2xl">
                    <strong>Your personal claims strategist.</strong> Enter your
                    current ratings and let AI analyze your profile to suggest
                    <strong> high-probability secondary claims</strong> you may
                    be missing, with direct links to build your case. Like
                    having a VSO in your pocket.
                  </p>
                </div>

                <div className="flex-shrink-0">
                  <button
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent("openPathfinder"))
                    }
                    className="px-6 py-3 bg-white text-teal-700 rounded-lg font-bold text-lg hover:bg-teal-50 transition-colors shadow-lg hover:shadow-xl flex items-center gap-2"
                  >
                    <span>📊</span>
                    <span>Analyze My Strategy</span>
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 3: BUILD YOUR EVIDENCE - Violet Theme */}
          <h2 className="text-2xl font-bold text-violet-700 dark:text-violet-300 text-center mb-2 mt-12">
            📋 Build Your Evidence
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Gather medical records, fill out forms, and create supporting
            statements
          </p>

          {/* Muster Call CTA - Full Width - Featured */}
          <div className="bg-gradient-to-br from-blue-50 via-indigo-50 to-blue-50 dark:from-blue-900/40 dark:via-indigo-900/40 dark:to-blue-900/40 border-2 border-blue-300 dark:border-blue-700 rounded-xl p-6 hover:shadow-xl transition-all mb-6">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse"></div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-blue-100 dark:bg-blue-800/50 rounded-xl p-3 flex-shrink-0">
                  <span className="text-3xl">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    Muster Call
                    <span className="px-2 py-0.5 bg-gradient-to-r from-blue-500 to-indigo-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                    <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                      AI
                    </span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                      FREE
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <strong>Drop your entire VA file</strong> - 32+ claim
                    letters, 320MB C-File, poor-quality DD214s. AI analyzes
                    everything, auto-populates your profile, and generates a
                    comprehensive action plan. What would take weeks, done in
                    minutes.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openMusterCall"))
                }
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-lg font-bold hover:from-blue-700 hover:to-indigo-700 transition-all shadow-lg hover:shadow-xl whitespace-nowrap transform hover:-translate-y-0.5"
              >
                🎯 Answer the Call
              </button>
            </div>
          </div>

          {/* C-File Analyzer CTA - Full Width - Featured */}
          <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-violet-50 dark:from-violet-900/40 dark:via-purple-900/40 dark:to-violet-900/40 border-2 border-violet-300 dark:border-violet-700 rounded-xl p-6 hover:shadow-xl transition-all mb-6">
            {/* Shimmer Effect */}
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full animate-pulse"></div>

            <div className="flex flex-col md:flex-row items-start md:items-center gap-4 relative">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-violet-100 dark:bg-violet-800/50 rounded-xl p-3 flex-shrink-0">
                  <span className="text-3xl">🔬</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap">
                    C-File AI Analyzer
                    <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                      AI
                    </span>
                    <span className="px-2 py-0.5 bg-green-500 text-white text-xs rounded-full">
                      FREE
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    <strong>What competitors charge $500+ for.</strong> Drop in
                    your C-File (Claims File) and let AI analyze thousands of
                    pages to find
                    <strong>
                      {" "}
                      in-service events, diagnoses, and nexus evidence
                    </strong>{" "}
                    - all processed locally in your browser for maximum privacy.
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openCFileAnalyzer"))
                }
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-lg hover:shadow-xl whitespace-nowrap transform hover:-translate-y-0.5"
              >
                🚀 Analyze My C-File
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Blue Button X-Ray CTA */}
            <div className="bg-gradient-to-br from-violet-50 via-purple-50 to-violet-50 dark:from-violet-900/40 dark:via-purple-900/40 dark:to-violet-900/40 border-2 border-violet-300 dark:border-violet-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-violet-500 to-purple-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">📋</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Blue Button X-Ray
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs font-bold rounded-full">
                    AI
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Instant Evidence Mining.</strong> Drop in your{" "}
                <strong>Blue Button</strong> from MyHealtheVet (instant
                download!) and find <strong>unclaimed diagnoses</strong> hiding
                in your records.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openBlueButtonXRay"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🔬 Scan My Records
              </button>
            </div>

            {/* Witness Bench CTA */}
            <div className="bg-gradient-to-br from-purple-50 via-violet-50 to-fuchsia-50 dark:from-purple-900/40 dark:via-violet-900/40 dark:to-fuchsia-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-purple-500 to-indigo-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">👥</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                    Witness Bench
                    <span className="px-2 py-0.5 bg-gradient-to-r from-purple-500 to-indigo-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                    <span className="px-2 py-0.5 bg-amber-500 text-black text-xs font-bold rounded-full">
                      AI
                    </span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Buddy Letter Wizard.</strong> Hand off to your{" "}
                <strong>spouse, friend, or battle buddy</strong>. AI asks the
                RIGHT questions to capture powerful{" "}
                <strong>witness evidence</strong>.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openWitnessBench"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                ✍️ Create Buddy Statement
              </button>
            </div>
          </div>

          {/* Forms Helper CTA - Full Width */}
          <div className="mt-6 bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/40 dark:to-indigo-900/40 border-2 border-purple-300 dark:border-purple-700 rounded-xl p-5 hover:shadow-lg transition-shadow">
            <div className="flex flex-col md:flex-row items-start md:items-center gap-4">
              <div className="flex items-center gap-3 flex-1">
                <div className="bg-purple-100 dark:bg-purple-800/50 rounded-lg p-2">
                  <svg
                    className="w-6 h-6 text-purple-600 dark:text-purple-400"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2">
                    📋 Forms Helper
                    <span className="px-2 py-0.5 bg-purple-600 text-white text-xs rounded-full">
                      {getFormsCount()} FORMS
                    </span>
                    <span className="px-2 py-0.5 bg-gradient-to-r from-violet-500 to-purple-500 text-white text-xs rounded-full">
                      AUTO-FILL
                    </span>
                  </h3>
                  <p className="text-sm text-gray-600 dark:text-gray-300">
                    Get guided help filling out VA forms, especially{" "}
                    <strong>buddy statements</strong> - one of the most powerful
                    but hardest-to-get forms of evidence!
                  </p>
                </div>
              </div>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openFormsHelper"))
                }
                className="w-full md:w-auto px-6 py-3 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-lg font-bold hover:from-violet-700 hover:to-purple-700 transition-all shadow-md hover:shadow-lg whitespace-nowrap"
              >
                📝 Open Forms Helper
              </button>
            </div>
          </div>

          {/* SECTION 4: QUALITY CONTROL - Rose Theme */}
          <h2 className="text-2xl font-bold text-rose-700 dark:text-rose-300 text-center mb-2 mt-12">
            ✅ Quality Control
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Review your work, decode VA decisions, and protect yourself from
            scams
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Red Team CTA */}
            <div className="bg-gradient-to-br from-rose-50 via-red-50 to-rose-50 dark:from-rose-900/40 dark:via-red-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl p-3 shadow-lg flex-shrink-0">
                  <span className="text-3xl">🎖️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Red Team
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-bold rounded-full">
                    AI
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Statement Stress Test.</strong> Find weak language
                that's <strong>hurting your claim</strong> before the VA does.
                "Tough guy" language = denials.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openRedTeam"))
                }
                className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
              >
                🔍 Stress Test Statement
              </button>
            </div>

            {/* Decision Decoder CTA */}
            <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-3 shadow-lg flex-shrink-0">
                  <span className="text-3xl">🔓</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Decision Decoder
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full">
                    AI
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Denial Translator.</strong> Got a confusing VA letter?
                Paste it in and get <strong>plain English</strong> + what's
                missing + next steps.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openDecisionDecoder"))
                }
                className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
              >
                🔓 Decode Decision
              </button>
            </div>

            {/* Time Machine CTA */}
            <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">⏰</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Time Machine
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full">
                    ITF DEADLINE
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Intent to File Tracker.</strong> Don't lose your
                effective date! Countdown timer + backpay calculator for your
                ITF deadline.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openTimeMachine"))
                }
                className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
              >
                ⏰ Track Deadline
              </button>
            </div>

            {/* Shark Radar CTA */}
            <div className="bg-gradient-to-br from-rose-50 to-red-50 dark:from-rose-900/40 dark:to-red-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-rose-500 to-red-600 rounded-xl p-3 shadow-lg flex-shrink-0">
                  <span className="text-3xl">🦈</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Shark Radar
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-red-500 text-white text-xs font-bold rounded-full">
                    SCAM ALERT
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Before you sign ANYTHING!</strong> Paste contract or
                email text from "VA consultants" to scan for
                <strong>
                  {" "}
                  illegal fees, predatory practices, and scams
                </strong>{" "}
                based on 38 CFR § 14.636.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openSharkRadar"))
                }
                className="w-full px-4 py-3 min-h-[68px] bg-gradient-to-r from-rose-600 to-red-600 text-white rounded-lg font-bold hover:from-rose-700 hover:to-red-700 transition-all shadow-md hover:shadow-lg mt-auto flex items-center justify-center"
              >
                🔍 Scan Contract
              </button>
            </div>
          </div>

          {/* Evidence Gap Visualizer - Full Width Rose theme continuation */}
          <div className="mt-6">
            {/* Evidence Gap Visualizer CTA - Full Width */}
            <div className="bg-gradient-to-br from-rose-50 via-pink-50 to-rose-50 dark:from-rose-900/40 dark:via-pink-900/40 dark:to-rose-900/40 border-2 border-rose-300 dark:border-rose-700 rounded-xl p-6 hover:shadow-xl transition-all">
              <div className="flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="bg-gradient-to-br from-rose-500 to-pink-600 rounded-xl p-4 shadow-lg">
                    <span className="text-4xl">🔗</span>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
                      Evidence Gap Finder
                    </h3>
                    <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-rose-500 to-pink-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                    <span className="inline-block px-2 py-0.5 bg-rose-600 text-white text-xs font-bold rounded-full">
                      CHECKLIST
                    </span>
                  </div>
                  <p className="text-gray-600 dark:text-gray-300 mb-4 leading-relaxed">
                    <strong>The Missing Link.</strong> See exactly what evidence
                    you're <strong>missing</strong> for higher ratings.
                    Interactive completeness gauge shows your gaps - fill them{" "}
                    <strong>before</strong> submission. Now saves directly to My
                    Packet!
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start">
                    <span className="px-3 py-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold rounded-full">
                      📋 Visual Checklist
                    </span>
                    <span className="px-3 py-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold rounded-full">
                      📦 Save to Packet
                    </span>
                    <span className="px-3 py-1 bg-rose-200 dark:bg-rose-800 text-rose-800 dark:text-rose-200 text-sm font-semibold rounded-full">
                      🎯 Target Rating
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() =>
                      window.dispatchEvent(
                        new CustomEvent("openEvidenceGapVisualizer"),
                      )
                    }
                    className="px-8 py-4 bg-gradient-to-r from-rose-600 to-pink-600 text-white rounded-xl font-bold text-lg hover:from-rose-700 hover:to-pink-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    🔗 Find My Gaps
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 5: MAXIMIZE YOUR RATING - Amber Theme */}
          <h2 className="text-2xl font-bold text-amber-700 dark:text-amber-300 text-center mb-2 mt-12">
            💰 Maximize Your Rating
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Get every dollar you deserve - TDIU, PACT Act, and strategic claims
          </p>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* TDIU Work Impact Builder CTA */}
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">💼</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    TDIU Builder
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-white text-xs font-bold rounded-full">
                    💰 100%
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>The 100% Backdoor.</strong> Translate your symptoms into{" "}
                <strong>vocational language</strong> for VA Form 21-8940. Get
                paid at 100% even with a 60-70% rating.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openTDIUBuilder"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                📝 Build My TDIU Case
              </button>
            </div>

            {/* Poke the Bear Calculator CTA */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/40 dark:via-orange-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🐻</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Risk Calculator
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    DEFENSE
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Don't Poke the Bear!</strong> Check 5-Year, 20-Year, and
                P&T protections <strong>BEFORE</strong> you file. Sharks push
                frivolous claims that <strong>trigger rating reductions</strong>
                .
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openRiskAssessment"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                ⚖️ Check My Risk
              </button>
            </div>
          </div>

          {/* FEATURED: Symptom Logger - Prominent Full-Width Card */}
          <div className="mt-6 mb-6">
            <div className="relative bg-gradient-to-br from-amber-100 via-yellow-50 to-orange-100 dark:from-amber-900/60 dark:via-yellow-900/50 dark:to-orange-900/60 border-2 border-amber-400 dark:border-amber-600 rounded-2xl p-8 hover:shadow-2xl transition-all overflow-hidden">
              <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-br from-amber-300/30 to-transparent rounded-full -translate-y-32 translate-x-32 pointer-events-none"></div>
              <div className="absolute bottom-0 left-0 w-48 h-48 bg-gradient-to-tr from-yellow-300/20 to-transparent rounded-full translate-y-24 -translate-x-24 pointer-events-none"></div>

              <div className="relative flex flex-col md:flex-row items-center gap-6">
                <div className="flex-shrink-0">
                  <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-2xl p-5 shadow-xl">
                    <span className="text-5xl">📊</span>
                  </div>
                </div>
                <div className="flex-1 text-center md:text-left">
                  <div className="flex items-center justify-center md:justify-start gap-2 mb-2">
                    <h3 className="text-2xl font-black text-gray-900 dark:text-gray-100">
                      Symptom Logger
                    </h3>
                    <span className="px-3 py-1 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-sm font-bold rounded-full animate-pulse">
                      ⭐ KEY TOOL
                    </span>
                  </div>
                  <p className="text-lg text-gray-700 dark:text-gray-200 mb-4 leading-relaxed">
                    <strong className="text-amber-700 dark:text-amber-400">
                      The 50% Maker.
                    </strong>{" "}
                    Ratings for migraines, IBS, and GERD depend on{" "}
                    <strong>frequency</strong>. Track every attack with
                    severity, duration, and triggers. Export{" "}
                    <strong>professional PDF evidence</strong> that proves your
                    rating.
                  </p>
                  <div className="flex flex-wrap gap-2 justify-center md:justify-start mb-4">
                    <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
                      📅 Date/Time Tracking
                    </span>
                    <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
                      📈 Severity Charts
                    </span>
                    <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
                      📄 PDF Export
                    </span>
                    <span className="px-3 py-1 bg-amber-200 dark:bg-amber-800 text-amber-800 dark:text-amber-200 text-sm font-semibold rounded-full">
                      🎯 C&P Ready
                    </span>
                  </div>
                </div>
                <div className="flex-shrink-0">
                  <button
                    onClick={() =>
                      window.dispatchEvent(new CustomEvent("openSymptomLogger"))
                    }
                    className="px-8 py-4 bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-xl font-bold text-lg hover:from-amber-700 hover:to-orange-700 transition-all shadow-lg hover:shadow-xl hover:scale-105"
                  >
                    📝 Start Logging
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* PACT Act Navigator CTA */}
            <div className="bg-gradient-to-br from-amber-50 via-orange-50 to-amber-50 dark:from-amber-900/40 dark:via-orange-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🔥</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    PACT Act Navigator
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                    HOT
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Skip the Nexus Letter.</strong> Check if your condition
                is <strong>presumptive</strong> under PACT Act - Agent Orange,
                burn pits, Gulf War, radiation.{" "}
                <strong>No proof needed.</strong>
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openPACTActNavigator"))
                }
                className="w-full px-4 py-3 min-h-[52px] bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🗺️ Check My Presumptives
              </button>
            </div>

            {/* FOIA Keysmith CTA */}
            <div className="bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🔑</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                    The Keysmith
                    <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-orange-500 text-white text-xs font-bold rounded-full">
                      NEW
                    </span>
                    <span className="px-2 py-0.5 bg-gray-700 text-white text-xs font-bold rounded-full">
                      FOIA
                    </span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Unlock Your C-File.</strong> Generate a{" "}
                <strong>FOIA request</strong> for your complete VA claims file.
                See what VA used - and <strong>what they ignored</strong>.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openFOIAGenerator"))
                }
                className="w-full px-4 py-3 min-h-[52px] bg-gradient-to-r from-amber-600 to-orange-600 text-white rounded-lg font-bold hover:from-amber-700 hover:to-orange-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🔓 Generate FOIA Request
              </button>
            </div>
          </div>

          {/* SECTION 6: FORCE MULTIPLIERS - Slate Theme */}
          <h2 className="text-2xl font-bold text-slate-700 dark:text-slate-300 text-center mb-2 mt-12">
            ⚔️ Force Multipliers
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Advanced simulators and interactive tools that transform how you
            build your claim
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* Somatic Target - Body Map CTA */}
            <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🎯</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Somatic Target
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-600 text-white text-xs font-bold rounded-full">
                    MAP
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Click, Don't Type.</strong> Interactive body map that
                translates your clicks into{" "}
                <strong>exact medical terminology</strong>. Turn "My back hurts"
                into proper diagnosis language.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openPainPainter"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🎯 Map My Pain
              </button>
            </div>

            {/* War Game - Red Team Simulator CTA */}
            <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">⚔️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    The War Game
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-700 text-white text-xs font-bold rounded-full">
                    AI
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Red Team Your Claim.</strong> AI adopts a{" "}
                <strong>Skeptical C&P Examiner</strong> persona. Find weaknesses{" "}
                <strong>before</strong> the VA does. Practice tough questions
                now.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openClaimStressTest"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                ⚔️ Stress Test My Claim
              </button>
            </div>

            {/* Continuity Thread - Timeline CTA */}
            <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🧵</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Continuity Thread
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-600 text-white text-xs font-bold rounded-full">
                    TIMELINE
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Visualize Your Nexus.</strong> Timeline shows evidence
                from service to now. Automatically flags{" "}
                <strong>dangerous gaps over 5 years</strong>. Fill them before
                it's too late.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openEvidenceTimeline"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🧵 Build My Timeline
              </button>
            </div>

            {/* The Tribunal CTA */}
            <div className="bg-gradient-to-br from-slate-50 via-gray-50 to-slate-50 dark:from-slate-900/40 dark:via-gray-900/40 dark:to-slate-900/40 border-2 border-slate-300 dark:border-slate-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-slate-600 to-gray-700 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">⚖️</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    The Tribunal
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-slate-600 to-gray-600 text-white text-xs font-bold rounded-full">
                    VOICE
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Mock BVA Hearing.</strong> Voice-interactive simulator
                with AI judge asking tough questions. Practice before the real
                Board of Veterans' Appeals.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openTheTribunal"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-slate-600 to-gray-700 text-white rounded-lg font-bold hover:from-slate-700 hover:to-gray-800 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                ⚖️ Start Mock Hearing
              </button>
            </div>
          </div>

          {/* SECTION 7: SUPPORT & RESOURCES - Sky Theme */}
          <h2 className="text-2xl font-bold text-sky-700 dark:text-sky-300 text-center mb-2 mt-12">
            🤝 Support & Resources
          </h2>
          <p className="text-center text-gray-600 dark:text-gray-400 text-sm mb-6">
            Find free representation, track VA rule changes, understand VA's AI
            systems, and unlock state-specific benefits
          </p>

          <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
            {/* VSO Finder CTA */}
            <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-50 dark:from-sky-900/40 dark:via-cyan-900/40 dark:to-sky-900/40 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              {/* Decorative element */}
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🤝</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    VSO Finder
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-bold rounded-full">
                    FREE HELP
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>The Honest Broker.</strong> Find{" "}
                <strong>FREE, Accredited</strong> representation near you.
                Connect with County VSOs, DAV, VFW, and avoid{" "}
                <strong>"Claim Sharks"</strong> forever.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openVSOFinder"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold hover:from-sky-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🔍 Find Free Help
              </button>
            </div>

            {/* State Benefit Hunter CTA */}
            <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-50 dark:from-sky-900/40 dark:via-cyan-900/40 dark:to-sky-900/40 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              {/* Decorative shimmer */}
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">💰</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                    State Benefit Hunter
                    <span className="px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-bold rounded-full animate-pulse">
                      $$$
                    </span>
                  </h3>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Money on the Table!</strong> Discover state-specific
                benefits many veterans miss:
                <strong>
                  {" "}
                  property tax exemptions, free vehicle registration, education
                  grants,
                </strong>{" "}
                and more.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("openStateBenefitHunter"),
                  )
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold hover:from-sky-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🎯 Find My State Benefits
              </button>
            </div>

            {/* Legislative Watchdog CTA */}
            <div className="bg-gradient-to-br from-sky-50 via-cyan-50 to-sky-50 dark:from-sky-900/40 dark:via-cyan-900/40 dark:to-sky-900/40 border-2 border-sky-300 dark:border-sky-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-sky-500 to-cyan-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">📡</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    Legislative Watchdog
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-sky-500 to-cyan-500 text-white text-xs font-bold rounded-full">
                    38 CFR
                  </span>
                  <span className="inline-block px-2 py-0.5 bg-sky-600 text-white text-xs font-bold rounded-full">
                    LIVE
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Track Rule Changes.</strong> Monitor Federal Register
                for updates to 38 CFR that affect your claim. Never miss a new
                presumptive condition.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("openLegislativeWatchdog"),
                  )
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold hover:from-sky-700 hover:to-cyan-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                📡 Watch Regulations
              </button>
            </div>

            {/* VA AI Transparency Hub CTA */}
            <div className="bg-gradient-to-br from-indigo-50 via-blue-50 to-indigo-50 dark:from-indigo-900/40 dark:via-blue-900/40 dark:to-indigo-900/40 border-2 border-indigo-300 dark:border-indigo-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col text-center">
              <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                <div className="bg-gradient-to-br from-indigo-500 to-blue-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                  <span className="text-3xl">🤖</span>
                </div>
                <div>
                  <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 mb-1">
                    VA AI Transparency
                  </h3>
                  <span className="inline-block px-2 py-0.5 bg-gradient-to-r from-indigo-500 to-blue-500 text-white text-xs font-bold rounded-full">
                    227 SYSTEMS
                  </span>
                </div>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                <strong>Know How AI Affects You.</strong> Learn about VA's 227
                AI systems: fraud detection, faster claims, health diagnostics,
                and your privacy protections.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openVAAITransparency"))
                }
                className="w-full px-4 py-3 bg-gradient-to-r from-indigo-600 to-blue-600 text-white rounded-lg font-bold hover:from-indigo-700 hover:to-blue-700 transition-all shadow-md hover:shadow-lg mt-auto"
              >
                🧠 Understand VA AI
              </button>
            </div>
          </div>

          {/* SECTION 8: PREMIUM VISUALIZATIONS - Shock & Awe */}
          <div className="mt-8">
            <div className="text-center mb-6">
              <h2 className="text-2xl font-black bg-gradient-to-r from-amber-600 via-yellow-600 to-amber-600 bg-clip-text text-transparent">
                💎 SHOCK & AWE TOOLS 💎
              </h2>
              <p className="text-gray-500 dark:text-gray-400 text-sm mt-1">
                Premium visualizations that make you say "Whoa"
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-6">
              {/* Million Dollar Dashboard - Gold/Yellow Theme */}
              <div className="relative bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 dark:from-yellow-900/40 dark:via-amber-900/40 dark:to-yellow-900/40 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

                <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                  <div className="bg-gradient-to-br from-yellow-500 to-amber-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                    <span className="text-3xl">💰</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                      Million Dollar Dashboard
                      <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-amber-500 text-black text-xs font-bold rounded-full animate-pulse">
                        WOW
                      </span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                  <strong>Your rating is worth MORE than you think.</strong> See
                  your <strong>lifetime value</strong> - VA pay, property tax
                  savings, education benefits, healthcare. Watch the number
                  climb.
                </p>
                <button
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("openMillionDollarDashboard"),
                    )
                  }
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-amber-500 text-black rounded-lg font-bold hover:from-yellow-600 hover:to-amber-600 transition-all shadow-md hover:shadow-lg mt-auto"
                >
                  💵 Show Me The Money
                </button>
              </div>

              {/* MOS Hazard Matcher - Gold/Yellow Theme */}
              <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-amber-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-amber-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

                <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                  <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                    <span className="text-3xl">🎖️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                      MOS Hazard Matcher
                      <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold rounded-full">
                        JOB→INJURY
                      </span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                  <strong>Your MOS broke your body.</strong> Enter your job
                  code, see <strong>what injuries that job causes</strong>.
                  Hearing loss? Back pain?{" "}
                  <strong>It's not just you - it's the job.</strong>
                </p>
                <button
                  onClick={() =>
                    window.dispatchEvent(
                      new CustomEvent("openMOSHazardMatcher"),
                    )
                  }
                  className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded-lg font-bold hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md hover:shadow-lg mt-auto"
                >
                  🔍 Match My MOS
                </button>
              </div>

              {/* Web of Conditions - Gold/Yellow Theme */}
              <div className="relative bg-gradient-to-br from-yellow-50 via-amber-50 to-orange-50 dark:from-yellow-900/40 dark:via-amber-900/40 dark:to-orange-900/40 border-2 border-yellow-300 dark:border-yellow-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-yellow-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

                <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                  <div className="bg-gradient-to-br from-yellow-500 to-orange-500 rounded-xl p-3 flex-shrink-0 shadow-lg">
                    <span className="text-3xl">🕸️</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                      Web of Conditions
                      <span className="px-2 py-0.5 bg-gradient-to-r from-yellow-500 to-orange-500 text-black text-xs font-bold rounded-full">
                        INTERACTIVE
                      </span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                  <strong>See how conditions connect.</strong> Interactive node
                  map - click a condition, watch secondaries{" "}
                  <strong>orbit around it</strong>. Click a link, see the
                  medical nexus.
                </p>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("openWebOfConditions"))
                  }
                  className="w-full px-4 py-3 bg-gradient-to-r from-yellow-500 to-orange-500 text-black rounded-lg font-bold hover:from-yellow-600 hover:to-orange-600 transition-all shadow-md hover:shadow-lg mt-auto"
                >
                  🗺️ Explore The Web
                </button>
              </div>

              {/* Retro Pay Hunter - Gold/Yellow Theme */}
              <div className="relative bg-gradient-to-br from-amber-50 via-yellow-50 to-orange-50 dark:from-amber-900/40 dark:via-yellow-900/40 dark:to-orange-900/40 border-2 border-amber-300 dark:border-amber-700 rounded-xl p-6 hover:shadow-xl transition-all flex flex-col overflow-hidden text-center">
                <div className="absolute top-0 right-0 w-32 h-32 bg-gradient-to-br from-amber-300/20 to-transparent rounded-full -translate-y-16 translate-x-16 pointer-events-none"></div>

                <div className="flex items-center justify-center gap-4 mb-4 flex-col">
                  <div className="bg-gradient-to-br from-amber-500 to-yellow-600 rounded-xl p-3 flex-shrink-0 shadow-lg">
                    <span className="text-3xl">⏰</span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-gray-900 dark:text-gray-100 flex items-center gap-2 flex-wrap justify-center">
                      Retro Pay Hunter
                      <span className="px-2 py-0.5 bg-gradient-to-r from-amber-500 to-yellow-500 text-black text-xs font-bold rounded-full animate-pulse">
                        💰 MONEY
                      </span>
                    </h3>
                  </div>
                </div>
                <p className="text-sm text-gray-600 dark:text-gray-300 mb-4 flex-1 leading-relaxed">
                  <strong>The Time Machine.</strong> Find missed back pay from{" "}
                  <strong>rating history errors</strong>. Check for CUE claims,
                  missing bilateral factors, and underpayments.
                </p>
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("openRetroPayHunter"))
                  }
                  className="w-full px-4 py-3 bg-gradient-to-r from-amber-500 to-yellow-500 text-black rounded-lg font-bold hover:from-amber-600 hover:to-yellow-600 transition-all shadow-md hover:shadow-lg mt-auto"
                >
                  💰 Hunt My Back Pay
                </button>
              </div>
            </div>
          </div>

          {/* Compact Disclaimer */}
          <Disclaimer compact />
        </div>
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
