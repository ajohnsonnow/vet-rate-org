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

import React, { useState, useCallback, Suspense } from "react";
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
import ActiveDevBanner from "./features/active-dev-banner/ActiveDevBanner";
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
import MobileBottomNavWrapper from "./features/mobile-nav/MobileBottomNavWrapper";
import GlobalCommandSearchWrapper from "./features/global-command-search/GlobalCommandSearchWrapper";
import AtomicWipe from "./components/AtomicWipe";
import { HelperModeProvider } from "./contexts/HelperModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FocusModeProvider } from "./contexts/FocusModeContext";
import { LanguageProvider } from "./contexts/LanguageContext";

import { dispatchToolById } from "./utils/dispatchToolById";
import { useBootSequence } from "./features/boot/useBootSequence";
import { useDisabilitySearch } from "./features/search/useDisabilitySearch";
import { PROJECT_STATS } from "./data/projectStats";
import AIAssistantBubble from "./features/ai-assistant/AIAssistantBubble";
import AppFooter from "./features/footer/AppFooter";
import "./index.css";

function App() {
  // Toast notification system
  const { toasts, onClose, onAction } = useToast();

  // Disability search subsystem (state, debounce, bridge, handlers)
  // lives in features/search/useDisabilitySearch.js (audit #35, B74).
  const {
    searchTerm,
    setSearchTerm,
    results,
    selectedResult,
    setSelectedResult,
    isLoading,
    error,
    hasSearched,
    setHasSearched,
    handleClearSearch,
    handleBuildStatementFromSearch,
    handleSecondaryConditionClick,
  } = useDisabilitySearch();

  const [userConditions, setUserConditions] = useState([]);

  // What's-New / SW-update banner + modal — owned by
  // useUpdateOrchestrator (audit #35, B25).
  const { whatsNewOpen, updateBanner, whatsNewModal } = useUpdateOrchestrator();

  // Boot sequence: maintenance check, IndexedDB migration, persistent
  // storage + auto-backup init, user-data migrations, and three
  // unconditional sync inits (error-capture, panic-key,
  // beforeunload warning). See features/boot/useBootSequence.js
  // (audit #35, B59; sync inits absorbed in B70).
  const { isMigrating, maintenanceMode, maintenanceMessage } =
    useBootSequence();

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
      <ActiveDevBanner />

      <GlobalCommandSearchWrapper />

      {/* AAAAA Diamond Standard: Atomic Wipe (Panic Button) */}
      <AtomicWipe />

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
                // 3 mappings diverge from dispatchToolById:
                // conditions-search clears the search instead of
                // opening a modal; veteran-profile here means
                // "edit profile" (FormsHelper), not "view packet"
                // (MyPacket) like the other surfaces; symptom-logger
                // isn't in the shared map. Everything else delegates.
                if (toolName === "conditions-search") setHasSearched(false);
                else if (toolName === "veteran-profile")
                  window.dispatchEvent(new CustomEvent("openFormsHelper"));
                else if (toolName === "symptom-logger")
                  window.dispatchEvent(new CustomEvent("openSymptomLogger"));
                else dispatchToolById(toolName);
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

      <AIAssistantBubble
        currentTool={selectedResult ? "Disability Details" : "Home"}
      />

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

        <ClaimPrepCluster onToolSelect={dispatchToolById} />

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

        <WorkflowGuidesCluster onToolSelect={dispatchToolById} />
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
      <MobileBottomNavWrapper userConditions={userConditions} />
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
