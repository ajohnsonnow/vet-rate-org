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

import React, { useState, useEffect, useCallback, lazy, Suspense } from "react";
import BRAND from "./config/branding";
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
import GlobalCommandSearch from "./components/GlobalCommandSearch";
import MobileBottomNav, { MobileNavSpacer } from "./components/MobileBottomNav";
import AtomicWipe from "./components/AtomicWipe";
import { HelperModeProvider } from "./contexts/HelperModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FocusModeProvider } from "./contexts/FocusModeContext";
import { LanguageProvider } from "./contexts/LanguageContext";

// Lazy-loaded modal-shaped feature surfaces (B21, audit #23 #28 #35).
// Each becomes its own Vite bundle chunk, fetched only when the user opens
// that surface. Suspense boundary for the cluster lives below, fallback is
// <LoadingBunker />. Components rendered unconditionally (Header, SearchBar,
// CommandersChecklist, etc.) and safety-critical surfaces (CrisisListener,
// update banner, What's-New modal) stay eager.
const SecondaryScout = lazy(() => import("./components/SecondaryScout"));
const SecondaryScoutLauncher = lazy(
  () => import("./components/SecondaryScoutLauncher"),
);
const NexusBuilder = lazy(() => import("./components/NexusBuilder"));
import { initializeCompassionateVoice } from "./utils/voiceIndex";
import { searchDisabilityData, validateSearchTerm } from "./utils/searchUtils";
import {
  saveStatement,
  getSavedClaims,
  getStatement,
} from "./utils/claimsStorage";
import { initializeErrorCapture } from "./utils/bugReportUtils";
import { setupBeforeUnloadWarning } from "./utils/dataPersistence";
import { migrateUserData } from "./utils/migrationManager";
import { createDebugDumpHandler } from "./utils/debugDump";
import { needsMigration, migrateFromLocalStorage } from "./utils/storage";
import { initPersistentStorage } from "./utils/persistentStorage";
import { initAutoBackup } from "./utils/autoBackup";
import disabilityData from "./data/disabilityData.json";
import { PROJECT_STATS } from "./data/projectStats";
import { getTotalToolCount } from "./data/toolkitData";
import { getSquashedBugCount } from "./data/squashedBugs";
import { getFormsCount } from "./utils/formsCount";
import AnimatedBug from "./components/AnimatedBug";
import AIAssistant from "./components/AIAssistant";
import { useAIAssistant } from "./hooks/useAIAssistant";
import "./index.css";

function App() {
  // Toast notification system
  const { toasts, onClose, onAction } = useToast();

  // AI Assistant (The Navigator)
  const aiAssistant = useAIAssistant();

  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);
  const [showSecondaryScoutLauncher, setShowSecondaryScoutLauncher] =
    useState(false);
  const [showSecondaryScout, setShowSecondaryScout] = useState(false);
  const [userConditions, setUserConditions] = useState([]);
  const [showNexusBuilder, setShowNexusBuilder] = useState(false);
  const [nexusBuilderData, setNexusBuilderData] = useState(null);
  // ExamPrepRoom state removed - functionality merged into CAPSimulator

  // FORCE MULTIPLIER FEATURES
  // showAISettings hoisted into SystemToolsCluster (audit #35, B52).

  // VKB: Veteran Knowledge Base Viewer

  // AAAAA DIAMOND STANDARD: Command Search & Privacy
  const [showCommandSearch, setShowCommandSearch] = useState(false);
  const [showAtomicWipe, setShowAtomicWipe] = useState(false);

  // MOBILE: Small screen warning
  const [dismissedSmallScreenWarning, setDismissedSmallScreenWarning] =
    useState(
      sessionStorage.getItem("vetrate-small-screen-dismissed") === "true",
    );

  // CLEAR COAT: Onboarding & Trust Features

  // SAFETY-CRITICAL: Crisis Intervention surface lives in
  // src/features/crisis/CrisisListener.jsx — state + listener + render
  // colocated there (audit #35, B25).

  // LIVE OPS: Update banner + What's-New modal live in
  // src/features/update/useUpdateOrchestrator.jsx — banner/modal JSX, version
  // bookkeeping, and SW update checker colocated there (audit #35, B25).
  const { whatsNewOpen, updateBanner, whatsNewModal } = useUpdateOrchestrator();

  // KILL SWITCH: Maintenance mode state
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [maintenanceMessage, setMaintenanceMessage] = useState("");

  // IndexedDB Migration State
  const [isMigrating, setIsMigrating] = useState(false);

  // LIVE OPS: Debug dump handler (Easter egg)
  const debugDumpHandler = createDebugDumpHandler();

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
    if (showSecondaryScout) return "Secondary Scout";
    if (showNexusBuilder) return "Nexus Builder";
    if (selectedResult) return "Disability Details";
    return "Home";
  };

  // Setup beforeunload warning for unsaved changes
  useEffect(() => {
    setupBeforeUnloadWarning();
  }, []);

  // Bridge listeners for events dispatched by extracted clusters whose
  // targets (NexusBuilder, SecondaryScoutLauncher) still live in App.jsx.
  // These move into the DiscoverCluster when it extracts (B57+).
  useEffect(() => {
    const openNexusBuilderBridge = (e) => {
      if (e?.detail) setNexusBuilderData(e.detail);
      setShowNexusBuilder(true);
    };
    const openSecondaryScoutLauncherBridge = () =>
      setShowSecondaryScoutLauncher(true);
    const resumeFromPacketBridge = (e) => {
      if (e?.detail) handleResumeFromPacket(e.detail);
    };
    const searchDisabilityBridge = (e) => {
      if (e?.detail?.term !== undefined) setSearchTerm(e.detail.term);
    };
    window.addEventListener("openNexusBuilder", openNexusBuilderBridge);
    window.addEventListener(
      "openSecondaryScoutLauncher",
      openSecondaryScoutLauncherBridge,
    );
    window.addEventListener("resumeFromPacket", resumeFromPacketBridge);
    window.addEventListener("searchDisability", searchDisabilityBridge);
    return () => {
      window.removeEventListener("openNexusBuilder", openNexusBuilderBridge);
      window.removeEventListener(
        "openSecondaryScoutLauncher",
        openSecondaryScoutLauncherBridge,
      );
      window.removeEventListener("resumeFromPacket", resumeFromPacketBridge);
      window.removeEventListener("searchDisability", searchDisabilityBridge);
    };
  }, []);

  // DEMO: Keyboard shortcut to open Demo Dashboard (Ctrl+Shift+D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // CMD/Ctrl + K: Open Global Command Search
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setShowCommandSearch(true);
      }
      // Ctrl+Shift+D: Open Demo Dashboard (gated to VA-API surface)
      if (e.ctrlKey && e.shiftKey && e.key === "D" && isVaApiEnabled()) {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent("openDemoDashboard"));
      }
      // NOTE: Admin panel access (Ctrl+Shift+A) is handled by AdminAuthContext
      // Bug Lookup and Feature Lookup are only accessible via Admin Panel
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // LIVE OPS: Data migration and update checking
  useEffect(() => {
    // Step 0A: KILL SWITCH - Check maintenance mode FIRST
    const checkMaintenanceMode = async () => {
      try {
        const response = await fetch("/version.json?t=" + Date.now());
        const data = await response.json();

        if (data.maintenance_mode === true) {
          console.warn("🚨 MAINTENANCE MODE ACTIVE - App disabled");
          setMaintenanceMode(true);
          setMaintenanceMessage(
            data.maintenance_message ||
              "System maintenance in progress. Please check back later.",
          );
          return true; // Stop all other initialization
        }
        return false;
      } catch (error) {
        console.error("⚠️ Could not check maintenance mode:", error);
        return false; // If check fails, allow app to continue (fail-open)
      }
    };

    // Step 0B: IndexedDB Migration (CRITICAL - runs FIRST before everything)
    const runStorageMigration = async () => {
      try {
        const shouldMigrate = await needsMigration();

        if (shouldMigrate) {
          console.log(
            "🔄 IndexedDB Migration: Migrating data from localStorage...",
          );
          setIsMigrating(true);

          const migrationResult = await migrateFromLocalStorage();

          if (migrationResult.success) {
            console.log(
              "✅ IndexedDB Migration: Successfully migrated",
              migrationResult.itemsMigrated,
              "items",
            );
            console.log("   Migrated keys:", migrationResult.keysProcessed);
          } else {
            console.error(
              "⚠️ IndexedDB Migration: Failed",
              migrationResult.errors,
            );
          }

          setIsMigrating(false);
        } else {
          console.log(
            "✅ IndexedDB Migration: Already complete, using IndexedDB",
          );
        }
      } catch (error) {
        console.error("❌ IndexedDB Migration: Critical error", error);
        setIsMigrating(false);
      }
    };

    const initializeApp = async () => {
      // CRITICAL: Check maintenance mode before anything else
      const inMaintenanceMode = await checkMaintenanceMode();
      if (inMaintenanceMode) {
        return; // Stop all initialization if in maintenance mode
      }

      // Continue with normal initialization
      await runStorageMigration();

      // Initialize crash-proof persistent storage system ("The Bunker")
      try {
        const persistentResult = await initPersistentStorage();
        console.log("🛡️ Persistent Storage: Initialized", persistentResult);
        if (persistentResult.hasUnsavedChanges) {
          console.log(
            "⚠️ Found unsaved changes from previous session - will auto-save",
          );
        }
      } catch (error) {
        console.error(
          "⚠️ Persistent Storage: Initialization failed, continuing anyway",
          error,
        );
      }

      // Initialize auto-backup system ("Zero Data Loss Protocol")
      try {
        await initAutoBackup();
        console.log(
          "💾 Auto-Backup: System initialized - all data will be backed up after every action",
        );
      } catch (error) {
        console.error(
          "⚠️ Auto-Backup: Initialization failed, continuing anyway",
          error,
        );
      }

      // Step 1: Migrate user data if needed (CRITICAL - runs after IndexedDB migration)
      console.log("🛡️ LIVE OPS: Initializing protection systems...");
      const migrationResult = migrateUserData();

      if (migrationResult.migrationsRun.length > 0) {
        console.log(
          `✅ Ran ${migrationResult.migrationsRun.length} migration(s):`,
          migrationResult.migrationsRun,
        );
      }

      if (!migrationResult.success) {
        console.error("⚠️ Some migrations failed:", migrationResult.errors);
        // Could show a warning to user, but app should still function
      }

      // Step 2 (What's-New modal) and Step 3 (SW update checker) live in
      // useUpdateOrchestrator now — see src/features/update/.
    };

    // Run initialization
    initializeApp();
  }, []);

  const handleLaunchSecondaryScout = (conditions) => {
    setUserConditions(conditions);
    setShowSecondaryScoutLauncher(false);
    setShowSecondaryScout(true);
  };

  const handleLearnHow = (suggestion) => {
    setNexusBuilderData({
      condition: suggestion.secondaryCondition,
      primaryCondition: suggestion.primaryCondition,
    });
    setShowSecondaryScout(false);
    setShowNexusBuilder(true);
  };

  const handleSaveStatement = (statementData) => {
    // Find the matching claim by condition name and parent condition
    const savedClaims = getSavedClaims();
    const matchingClaim = savedClaims.find(
      (c) =>
        c.conditionName === statementData.condition &&
        c.parentCondition === (statementData.primaryCondition || null),
    );

    if (matchingClaim) {
      // Save statement with the claim's ID
      saveStatement(matchingClaim.id, statementData);
    } else {
      alert(
        "Error: Could not find matching claim. Please save the claim first from Secondary Scout.",
      );
    }

    // Close Nexus Builder and show success
    setShowNexusBuilder(false);
    window.dispatchEvent(new CustomEvent("openMyPacket"));
  };

  const handleResumeFromPacket = (claim) => {
    // Get existing statement for editing
    const existingStatement = getStatement(claim.id);

    setNexusBuilderData({
      condition: claim.conditionName,
      primaryCondition: claim.parentCondition,
      existingStatement: existingStatement,
    });
    setShowNexusBuilder(true);
  };

  const handleBuildStatementFromSearch = (conditionName) => {
    // Open NexusBuilder for a primary (non-secondary) condition
    setNexusBuilderData({
      condition: conditionName,
      primaryCondition: null,
      existingStatement: null,
    });
    setSelectedResult(null); // Close the details view
    setShowNexusBuilder(true);
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
      "secondary-scout": () => setShowSecondaryScoutLauncher(true),
      "my-packet": () => window.dispatchEvent(new CustomEvent("openMyPacket")),
      "knowledge-base": () =>
        window.dispatchEvent(new CustomEvent("openVKBViewer")),
      "nexus-builder": () => setShowNexusBuilder(true),
      "statement-analyzer": () => setShowNexusBuilder(true), // Statement Analyzer is embedded in Nexus Builder
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

      // Discover Tools
      showSecondaryScoutLauncher,
      showSecondaryScout,
      userConditions,

      // Build Evidence Tools
      showNexusBuilder,
      nexusBuilderData,

      // Helper to determine current module - DIAMOND LEVEL SMART DETECTION
      currentModule: (() => {
        // Priority order: most specific tools first
        if (showSecondaryScout) return "Secondary Scout";
        if (showSecondaryScoutLauncher) return "Secondary Scout Launcher";
        if (showNexusBuilder) return "Nexus Builder";
        if (selectedResult) return "Disability Details View";
        return "Disability Search";
      })(),
    }),
    [
      // Search & Core
      searchTerm,
      results,
      selectedResult,
      hasSearched,
      error,
      // Discover Tools
      showSecondaryScoutLauncher,
      showSecondaryScout,
      userConditions,
      // Build Evidence Tools
      showNexusBuilder,
      nexusBuilderData,
    ],
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

      {/* AAAAA Diamond Standard: Global Command Search (CMD+K) */}
      <GlobalCommandSearch
        isOpen={showCommandSearch}
        onClose={() => setShowCommandSearch(false)}
        onSelectTool={(toolId) => {
          setShowCommandSearch(false);
          // Map tool IDs to their respective state setters
          const toolHandlers = {
            "tactical-calculator": () =>
              window.dispatchEvent(new CustomEvent("openTacticalCalculator")),
            "my-packet": () =>
              window.dispatchEvent(new CustomEvent("openMyPacket")),
            "secondary-scout": () => setShowSecondaryScoutLauncher(true),
            "cap-simulator": () =>
              window.dispatchEvent(new CustomEvent("openCAPSimulator")),
            "nexus-builder": () => setShowNexusBuilder(true),
            pathfinder: () =>
              window.dispatchEvent(new CustomEvent("openPathfinder")),
            "claim-navigator": () =>
              window.dispatchEvent(new CustomEvent("openClaimNavigator")),
            "cfile-analyzer": () =>
              window.dispatchEvent(new CustomEvent("openCFileAnalyzer")),
            "forms-helper": () =>
              window.dispatchEvent(new CustomEvent("openFormsHelper")),
            "red-team": () =>
              window.dispatchEvent(new CustomEvent("openRedTeam")),
            "shark-radar": () =>
              window.dispatchEvent(new CustomEvent("openSharkRadar")),
            "denial-decoder": () =>
              window.dispatchEvent(new CustomEvent("openDenialDecoder")),
            "decision-decoder": () =>
              window.dispatchEvent(new CustomEvent("openDecisionDecoder")),
            "consistency-engine": () =>
              window.dispatchEvent(new CustomEvent("openConsistencyEngine")),
            "claim-stress-test": () =>
              window.dispatchEvent(new CustomEvent("openClaimStressTest")),
            "evidence-gap": () =>
              window.dispatchEvent(
                new CustomEvent("openEvidenceGapVisualizer"),
              ),
            "risk-assessment": () =>
              window.dispatchEvent(new CustomEvent("openRiskAssessment")),
            "tdiu-builder": () =>
              window.dispatchEvent(new CustomEvent("openTDIUBuilder")),
            "state-benefits": () =>
              window.dispatchEvent(new CustomEvent("openStateBenefitHunter")),
            "the-tribunal": () =>
              window.dispatchEvent(new CustomEvent("openTheTribunal")),
            "vso-finder": () =>
              window.dispatchEvent(new CustomEvent("openVSOFinder")),
            "user-manual": () =>
              window.dispatchEvent(new CustomEvent("openUserManual")),
            "knowledge-base": () =>
              window.dispatchEvent(new CustomEvent("openVKBViewer")),
            "million-dollar": () =>
              window.dispatchEvent(
                new CustomEvent("openMillionDollarDashboard"),
              ),
            "what-if-sandbox": () =>
              window.dispatchEvent(new CustomEvent("openWhatIfSandbox")),
            "retro-pay": () =>
              window.dispatchEvent(new CustomEvent("openRetroPayHunter")),
            "time-machine": () =>
              window.dispatchEvent(new CustomEvent("openTimeMachine")),
            "pact-act": () =>
              window.dispatchEvent(new CustomEvent("openPACTActNavigator")),
            "mos-hazard": () =>
              window.dispatchEvent(new CustomEvent("openMOSHazardMatcher")),
            "web-of-conditions": () =>
              window.dispatchEvent(new CustomEvent("openWebOfConditions")),
            "blue-button": () =>
              window.dispatchEvent(new CustomEvent("openBlueButtonXRay")),
            "witness-bench": () =>
              window.dispatchEvent(new CustomEvent("openWitnessBench")),
            "symptom-logger": () =>
              window.dispatchEvent(new CustomEvent("openSymptomLogger")),
            "pain-painter": () =>
              window.dispatchEvent(new CustomEvent("openPainPainter")),
            "evidence-timeline": () =>
              window.dispatchEvent(new CustomEvent("openEvidenceTimeline")),
            "foia-generator": () =>
              window.dispatchEvent(new CustomEvent("openFOIAGenerator")),
            "legislative-watchdog": () =>
              window.dispatchEvent(new CustomEvent("openLegislativeWatchdog")),
            "backup-manager": () =>
              window.dispatchEvent(new CustomEvent("openBackupManager")),
            "ai-settings": () =>
              window.dispatchEvent(new CustomEvent("openAISettings")),
            "workflow-guide": () =>
              window.dispatchEvent(new CustomEvent("openWorkflowGuide")),
            "record-search": () =>
              window.dispatchEvent(new CustomEvent("openRecordSearch")),
            "dd214-analyzer": () =>
              window.dispatchEvent(new CustomEvent("openDD214Analyzer")),
            "bdd-builder": () =>
              window.dispatchEvent(new CustomEvent("openBDDBuilder")),
          };
          const handler = toolHandlers[toolId];
          if (handler) handler();
        }}
        onSelectDiagnosticCode={(code) => {
          setShowCommandSearch(false);
          // Search for the diagnostic code
          setSearchTerm(code.code);
          handleSearch(code.code);
        }}
      />

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
        onSecondaryScoutClick={() => setShowSecondaryScoutLauncher(true)}
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
        onNexusBuilderClick={() => setShowNexusBuilder(true)}
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
                  setShowNexusBuilder(true);
                else if (toolName === "secondary-scout")
                  setShowSecondaryScoutLauncher(true);
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
                onClick={() => setShowSecondaryScoutLauncher(true)}
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

      {/* AI Assistant (The Navigator) - Always available */}
      {aiAssistant.isOpen && (
        <AIAssistant
          currentTool={getCurrentToolName()}
          onClose={aiAssistant.close}
          onOpenAISettings={() =>
            window.dispatchEvent(new CustomEvent("openAISettings"))
          }
        />
      )}

      {/* AI Assistant Launch Button - Fixed position, bottom-left */}
      {!aiAssistant.isOpen && (
        <button
          id="tour-ai-navigator-btn"
          onClick={() => aiAssistant.open(getCurrentToolName())}
          className="fixed bottom-4 left-4 z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 group"
          aria-label="Open AI Navigator - Your personal claims guide"
        >
          <div className="relative">
            <span className="text-2xl">🧭</span>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
          </div>
          <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
            Ask me anything about VA claims! 💬
          </div>
        </button>
      )}

      <footer
        className="bg-gray-900 dark:bg-black text-white py-8 mt-12"
        role="contentinfo"
      >
        <div className="container mx-auto px-4 max-w-7xl">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mb-8">
            <div>
              <h4 className="font-bold mb-3">ℹ️ About {BRAND.appName}</h4>
              <p className="text-gray-400 text-sm mb-3">
                The most comprehensive free VA claims arsenal -{" "}
                {getTotalToolCount()} professional-grade tools covering
                research, calculators, AI analysis, C&P prep, evidence builders,
                and strategic planning. What claim sharks charge thousands for,
                absolutely free.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openAboutUs"))
                }
                className="text-va-gold hover:underline text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-va-gold rounded"
              >
                Learn More →
              </button>
            </div>
            <div>
              <h4 className="font-bold mb-3">🔒 Data Privacy</h4>
              <p className="text-gray-400 text-sm mb-3">
                This system operates locally and does not store Personally
                Identifiable Information (PII) on external servers. All data
                processing happens in your browser.
              </p>
              <div className="flex flex-col gap-2">
                <button
                  onClick={() =>
                    window.dispatchEvent(new CustomEvent("openPrivacyPolicy"))
                  }
                  className="text-va-gold hover:underline text-sm font-semibold text-left"
                >
                  Privacy Policy →
                </button>
                <a
                  href={BRAND.goatCounterUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-green-400 hover:underline text-sm font-semibold inline-flex items-center gap-1"
                >
                  📊 View Live Analytics →
                </a>
              </div>
            </div>
            <div>
              <h4 className="font-bold mb-3">⚖️ Legal Notice</h4>
              <p className="text-gray-400 text-sm mb-3">
                This tool is for educational purposes only. It does not
                constitute legal or medical advice. Consult with VA officials or
                qualified professionals for specific guidance.
              </p>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openTermsOfService"))
                }
                className="text-va-gold hover:underline text-sm font-semibold"
              >
                Terms of Service →
              </button>
            </div>
          </div>

          <div className="border-t border-gray-700 pt-6">
            <div className="flex flex-wrap justify-center gap-4 mb-6">
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openPrivacyPolicy"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Privacy Policy
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openAboutUs"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                About Us
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openMissionProtocol"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                🎖️ Our Promise
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openWorkflowGuide"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                🗺️ Workflow Guide
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openContactUs"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Contact Us
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openTermsOfService"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                Terms of Service
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openFormsHelper"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                📋 Forms Helper
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openUserManual"))
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                📖 Field Manual
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(
                    new CustomEvent("openPublicationsLibrary"),
                  )
                }
                className="text-gray-400 hover:text-va-gold text-sm transition-colors"
              >
                📚 Pubs Library
              </button>
              <span className="text-gray-600">|</span>
              <button
                onClick={() =>
                  window.dispatchEvent(new CustomEvent("openBugSquasher"))
                }
                className="text-gray-400 hover:text-red-400 text-sm transition-colors flex items-center gap-1 group"
              >
                🐛 Report Bug
                <span
                  className="bg-green-600 text-white text-xs font-bold px-1.5 py-0.5 rounded-full group-hover:bg-green-500 transition-colors"
                  aria-label={`${getSquashedBugCount()} bugs squashed`}
                >
                  {getSquashedBugCount()}
                  <AnimatedBug size="xs" />✓
                </span>
              </button>
            </div>
            <p className="text-center text-gray-400 text-sm">
              <span
                onClick={debugDumpHandler}
                className="cursor-default select-none"
                aria-label="Copyright Notice"
              >
                {BRAND.copyright}
              </span>{" "}
              - Your Complete VA Claims Toolkit. Data sourced from{" "}
              <a
                href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
                target="_blank"
                rel="noopener noreferrer"
                className="text-va-gold hover:underline"
              >
                38 CFR Part 4
              </a>
            </p>
            <p className="text-center text-gray-500 text-xs mt-3 border-t border-gray-800 pt-3">
              <strong>Important:</strong> {BRAND.appName} is a private,
              veteran-built project and is{" "}
              <strong>
                not affiliated with, endorsed by, or a part of the Department of
                Veterans Affairs or the United States Government.
              </strong>
            </p>
          </div>
        </div>
      </footer>

      {/* Modals — lazy cluster with Suspense boundary (B21, audit #28).
          Each <Show...> conditional below mounts a React.lazy component
          declared at the top of this file; the chunk is fetched on first
          open. <LoadingBunker /> is the shared fallback. */}
      <Suspense fallback={<LoadingBunker />}>
        {/* Legal/info modals — Privacy, About, Contact, Terms (features/legal) */}
        <LegalPages />

        {/* Secondary Scout Launcher */}
        {showSecondaryScoutLauncher && (
          <SecondaryScoutLauncher
            onLaunch={handleLaunchSecondaryScout}
            onClose={() => setShowSecondaryScoutLauncher(false)}
            onReportBug={() =>
              window.dispatchEvent(new CustomEvent("openBugSquasher"))
            }
          />
        )}

        {/* Secondary Scout Results */}
        {showSecondaryScout && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto">
            <div className="min-h-screen px-4 py-8">
              <div className="bg-white dark:bg-emerald-950 rounded-lg shadow-xl max-w-7xl mx-auto">
                <div className="sticky top-0 bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-4 sm:px-6 py-4 z-10 rounded-t-lg">
                  {/* Mobile: Stack vertically, Desktop: Side by side */}
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <h2 className="text-xl sm:text-3xl font-bold truncate">
                        🔍 Secondary Scout Results
                      </h2>
                      <p className="text-sm text-blue-100 mt-1">
                        Based on {userConditions.length} service-connected
                        condition{userConditions.length !== 1 ? "s" : ""}
                      </p>
                    </div>
                    {/* Mobile: Full width buttons, Desktop: Inline */}
                    <div className="flex flex-wrap items-center gap-2 sm:gap-3">
                      <ReportBugLink
                        onClick={() =>
                          window.dispatchEvent(
                            new CustomEvent("openBugSquasher"),
                          )
                        }
                        variant="light"
                        moduleName="Secondary Scout Results"
                      />
                      <button
                        onClick={() => {
                          setShowSecondaryScout(false);
                          window.dispatchEvent(new CustomEvent("openMyPacket"));
                        }}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-va-gold text-va-blue rounded-lg font-medium hover:bg-yellow-400 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base"
                      >
                        <svg
                          className="w-4 h-4 sm:w-5 sm:h-5"
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
                        <span className="hidden xs:inline">My </span>Packet
                      </button>
                      <button
                        onClick={() => {
                          setShowSecondaryScout(false);
                          setShowSecondaryScoutLauncher(true);
                        }}
                        className="flex-1 sm:flex-none px-3 sm:px-4 py-2 bg-white text-blue-600 rounded-lg font-medium hover:bg-blue-50 transition-colors text-sm sm:text-base"
                      >
                        <span className="hidden sm:inline">Change </span>
                        Conditions
                      </button>
                      <button
                        onClick={() => setShowSecondaryScout(false)}
                        className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                        aria-label="Close"
                      >
                        <svg
                          className="w-5 h-5 sm:w-6 sm:h-6"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M6 18L18 6M6 6l12 12"
                          />
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
                      window.dispatchEvent(new CustomEvent("openMyPacket"));
                    }}
                    onOpenAISettings={() =>
                      window.dispatchEvent(new CustomEvent("openAISettings"))
                    }
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
            onReportBug={() =>
              window.dispatchEvent(new CustomEvent("openBugSquasher"))
            }
            onOpenAISettings={() =>
              window.dispatchEvent(new CustomEvent("openAISettings"))
            }
          />
        )}

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

      {/* MOBILE OPTIMIZATION: Small Screen Warning */}
      {window.innerWidth < 640 && !dismissedSmallScreenWarning && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-slate-900 border-2 border-amber-500 rounded-lg p-6 max-w-md shadow-2xl">
            <div className="flex items-start gap-3 mb-4">
              <svg
                className="w-8 h-8 text-amber-500 flex-shrink-0 mt-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
                />
              </svg>
              <div>
                <h3 className="text-xl font-bold text-amber-400 mb-2">
                  Screen Size Warning
                </h3>
                <p className="text-slate-300 text-sm leading-relaxed mb-3">
                  VetRate is optimized for tablet and desktop screens. Some
                  features may not work properly on smaller devices.
                </p>
                <p className="text-slate-400 text-xs leading-relaxed">
                  For the best experience, please use a device with a screen
                  width of at least 640px, or switch to landscape mode.
                </p>
              </div>
            </div>
            <div className="flex flex-col gap-2">
              <button
                onClick={() => {
                  setDismissedSmallScreenWarning(true);
                  sessionStorage.setItem(
                    "vetrate-small-screen-dismissed",
                    "true",
                  );
                }}
                className="w-full bg-amber-600 hover:bg-amber-700 text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                I Understand, Continue Anyway
              </button>
              <a
                href="mailto:support@vetrate.org?subject=Mobile%20Support%20Request"
                className="w-full text-center bg-slate-700 hover:bg-slate-600 text-slate-300 hover:text-white font-semibold py-2 px-4 rounded transition-colors"
              >
                Email Us About Mobile Support
              </a>
            </div>
          </div>
        </div>
      )}

      {/* FORCE MULTIPLIER: Focus Mode Toggle for TBI/ADHD users - Now integrated into modal headers */}

      {/* COMPASSIONATE VOICE: Quick Exit Button - Trauma-informed safety */}
      <QuickExitButton position="bottom-left" variant="subtle" />

      {/* Security Badge - Always visible proof of privacy */}
      <SecurityBadge />

      {/* AAAAA Diamond Standard: Mobile Bottom Navigation */}
      <MobileBottomNav
        onSearchClick={() => setShowCommandSearch(true)}
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
