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

import React, { useState, useCallback } from "react";
import AppHeader from "./features/header/AppHeader";
import HomeMain from "./features/home/HomeMain";
import AppModals from "./features/modals/AppModals";
import AppShellOverlays from "./features/app-shell/AppShellOverlays";
import BuyMeCoffee from "./components/BuyMeCoffee";
import FloatingBugButton from "./components/FloatingBugButton";
import { AdminAuthProvider } from "./contexts/AdminAuthContext";
import MobileNotice from "./components/MobileNotice";
import ActiveDevBanner from "./features/active-dev-banner/ActiveDevBanner";
import { useUpdateOrchestrator } from "./features/update/useUpdateOrchestrator";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import ToastContainer, { useToast } from "./components/Toast";
import LoadingBunker from "./components/LoadingBunker";
import { LocalAIProvider } from "./components/LocalAIPanel";
import OnboardingGate from "./features/onboarding/OnboardingGate";
import { VaApiStatusBanner } from "./components/VaApiStatus";
import { isVaApiEnabled } from "./config/vaAuth";
import StressReliefDivision from "./components/StressReliefDivision";
import GlobalCommandSearchWrapper from "./features/global-command-search/GlobalCommandSearchWrapper";
import AtomicWipe from "./components/AtomicWipe";
import { HelperModeProvider } from "./contexts/HelperModeContext";
import { ToastProvider } from "./contexts/ToastContext";
import { FocusModeProvider } from "./contexts/FocusModeContext";
import { LanguageProvider } from "./contexts/LanguageContext";
import { useBootSequence } from "./features/boot/useBootSequence";
import { useDisabilitySearch } from "./features/search/useDisabilitySearch";
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

      <HomeMain
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        results={results}
        selectedResult={selectedResult}
        setSelectedResult={setSelectedResult}
        isLoading={isLoading}
        error={error}
        setHasSearched={setHasSearched}
        handleClearSearch={handleClearSearch}
        handleBuildStatementFromSearch={handleBuildStatementFromSearch}
        handleSecondaryConditionClick={handleSecondaryConditionClick}
      />

      {/* Floating Bug Report Button */}
      <FloatingBugButton
        onClick={() => window.dispatchEvent(new CustomEvent("openBugSquasher"))}
      />

      <AIAssistantBubble
        currentTool={selectedResult ? "Disability Details" : "Home"}
      />

      <AppFooter />

      <AppModals
        userConditions={userConditions}
        setUserConditions={setUserConditions}
        getAppState={getCurrentAppState}
        updateBanner={updateBanner}
        whatsNewModal={whatsNewModal}
      />

      <AppShellOverlays userConditions={userConditions} />
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
