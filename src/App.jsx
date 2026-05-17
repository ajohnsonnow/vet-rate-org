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

import React, { useState } from "react";
import AppHeader from "./features/header/AppHeader";
import HomeMain from "./features/home/HomeMain";
import AppModals from "./features/modals/AppModals";
import AppShellOverlays from "./features/app-shell/AppShellOverlays";
import AppShellTop from "./features/app-shell/AppShellTop";
import BuyMeCoffee from "./components/BuyMeCoffee";
import FloatingBugButton from "./components/FloatingBugButton";
import AppProviders from "./features/providers/AppProviders";
import { useUpdateOrchestrator } from "./features/update/useUpdateOrchestrator";
import MaintenancePage from "./features/maintenance/MaintenancePage";
import MigrationScreen from "./features/boot/MigrationScreen";
import { useBootSequence } from "./features/boot/useBootSequence";
import { useDisabilitySearch } from "./features/search/useDisabilitySearch";
import { useAppStateSnapshot } from "./features/feedback/useAppStateSnapshot";
import AIAssistantBubble from "./features/ai-assistant/AIAssistantBubble";
import AppFooter from "./features/footer/AppFooter";
import "./index.css";

function App() {
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

  // Snapshot of App-level state for bug reports + feature requests.
  // See features/feedback/useAppStateSnapshot.js (audit #35, B80).
  const getCurrentAppState = useAppStateSnapshot({
    searchTerm,
    results,
    selectedResult,
    hasSearched,
    error,
    userConditions,
  });

  if (isMigrating) return <MigrationScreen />;
  if (maintenanceMode) return <MaintenancePage message={maintenanceMessage} />;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-emerald-950 flex flex-col transition-colors duration-200">
      <AppShellTop whatsNewOpen={whatsNewOpen} />

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

export default function AppWrapper() {
  return (
    <AppProviders>
      <App />
    </AppProviders>
  );
}
