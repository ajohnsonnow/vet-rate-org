/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 */

import { useState, useEffect } from "react";
import {
  findSecondaryClaims,
  getSecondaryClaimsSummary,
  filterByProbability,
} from "../utils/secondaryClaimsEngine.js";
import { saveClaim, isClaimSaved } from "../utils/claimsStorage.js";
import BuyMeCoffee from "./BuyMeCoffee";
import DoctorsPacket from "./DoctorsPacket";
import { useLanguage } from "../contexts/LanguageContext";

function getMechanismBadgeColor(mechanism) {
  switch (mechanism) {
    case "Direct":
      return "bg-red-100 text-red-800 border-red-300";
    case "Medication":
      return "bg-purple-100 text-purple-800 border-purple-300";
    case "Altered Gait":
      return "bg-blue-100 text-blue-800 border-blue-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function getProbabilityBadgeColor(probability) {
  switch (probability) {
    case "High":
      return "bg-orange-100 text-orange-800 border-orange-300";
    case "Medium":
      return "bg-yellow-100 text-yellow-800 border-yellow-300";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300";
  }
}

function createClaimHandlers({ savedClaims, setSavedClaims, onLearnHow }) {
  const handleSaveClaim = (suggestion) => {
    const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;

    if (!savedClaims.has(claimKey)) {
      const saved = saveClaim({
        conditionName: suggestion.secondaryCondition,
        parentCondition: suggestion.primaryCondition,
        probability: suggestion.probability,
        mechanism: suggestion.mechanism,
        nexusTheory: suggestion.nexusTheory,
        medicalEvidence:
          suggestion.medicalEvidence || suggestion.medicalCitations,
        ecfrDiagnosticCode: suggestion.ecfrDiagnosticCode,
        evidenceType: suggestion.evidenceType,
        status: "Drafting",
      });

      if (saved) {
        setSavedClaims((prev) => new Set([...prev, claimKey]));
      }
    }
  };

  const handleLearnHow = (suggestion) => {
    // Save the claim first if not already saved
    handleSaveClaim(suggestion);
    // Then open the Nexus Builder
    if (onLearnHow) {
      onLearnHow(suggestion);
    }
  };

  const isClaimAlreadySaved = (suggestion) => {
    return savedClaims.has(
      `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`,
    );
  };

  return { handleSaveClaim, handleLearnHow, isClaimAlreadySaved };
}

function createSelectionHandlers({
  selectedForPacket,
  setSelectedForPacket,
  savedClaims,
  filteredSuggestions,
}) {
  const toggleSelectForPacket = (suggestion) => {
    const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
    setSelectedForPacket((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(claimKey)) {
        newSet.delete(claimKey);
      } else {
        newSet.add(claimKey);
      }
      return newSet;
    });
  };

  const isSelectedForPacket = (suggestion) => {
    return selectedForPacket.has(
      `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`,
    );
  };

  const selectAllFiltered = () => {
    const newSet = new Set(selectedForPacket);
    filteredSuggestions.forEach((suggestion) => {
      const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
      // Only select if not already saved
      if (!savedClaims.has(claimKey)) {
        newSet.add(claimKey);
      }
    });
    setSelectedForPacket(newSet);
  };

  const clearSelection = () => {
    setSelectedForPacket(new Set());
  };

  // Count how many selected are not already saved
  const getUnsavedSelectedCount = () => {
    let count = 0;
    selectedForPacket.forEach((key) => {
      if (!savedClaims.has(key)) count++;
    });
    return count;
  };

  return {
    toggleSelectForPacket,
    isSelectedForPacket,
    selectAllFiltered,
    clearSelection,
    getUnsavedSelectedCount,
  };
}

function createAddSelectedToPacketHandler({
  filteredSuggestions,
  selectedForPacket,
  savedClaims,
  setSavedClaims,
  setSelectedForPacket,
}) {
  return () => {
    let addedCount = 0;
    filteredSuggestions.forEach((suggestion) => {
      const claimKey = `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`;
      if (selectedForPacket.has(claimKey) && !savedClaims.has(claimKey)) {
        const saved = saveClaim({
          conditionName: suggestion.secondaryCondition,
          parentCondition: suggestion.primaryCondition,
          probability: suggestion.probability,
          mechanism: suggestion.mechanism,
          nexusTheory: suggestion.nexusTheory,
          medicalEvidence:
            suggestion.medicalEvidence || suggestion.medicalCitations,
          ecfrDiagnosticCode: suggestion.ecfrDiagnosticCode,
          evidenceType: suggestion.evidenceType,
          status: "Drafting",
        });
        if (saved) {
          addedCount++;
        }
      }
    });

    // Update saved claims state
    const newSavedClaims = new Set(savedClaims);
    selectedForPacket.forEach((key) => newSavedClaims.add(key));
    setSavedClaims(newSavedClaims);

    // Clear selection
    setSelectedForPacket(new Set());

    // Show success message
    if (addedCount > 0) {
      alert(
        `Successfully added ${addedCount} claim${addedCount > 1 ? "s" : ""} to My Packet!`,
      );
    }
  };
}

function EmptyDisabilitiesNotice({ t }) {
  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4">
        <div className="flex">
          <div className="flex-shrink-0">
            <svg
              className="h-5 w-5 text-blue-400"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path
                fillRule="evenodd"
                d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z"
                clipRule="evenodd"
              />
            </svg>
          </div>
          <div className="ml-3">
            <p className="text-sm text-blue-700">
              {t("secondaryScoutSection.enterDisabilitiesInfo")}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function SecondaryScoutHeader({ t }) {
  return (
    <div className="mb-8">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">
        🔍 {t("secondaryScoutSection.title")}{" "}
        <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
          BETA
        </span>
      </h1>
      <p className="text-gray-600">
        {t("secondaryScoutSection.potentialClaimsSubtitle")}
      </p>
    </div>
  );
}

function SecondaryScoutSummary({ summary, t }) {
  if (!summary) return null;

  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
        <div className="text-2xl font-bold text-gray-900">
          {summary.totalSuggestions}
        </div>
        <div className="text-sm text-gray-600">
          📊 {t("secondaryScoutSection.totalSuggestions")}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-orange-500">
        <div className="text-2xl font-bold text-gray-900">
          {summary.highProbability}
        </div>
        <div className="text-sm text-gray-600">
          🔥 {t("secondaryScoutSection.highProbability")}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-purple-500">
        <div className="text-2xl font-bold text-gray-900">
          {summary.byMechanism.medication}
        </div>
        <div className="text-sm text-gray-600">
          💊 {t("secondaryScoutSection.medicationRelated")}
        </div>
      </div>
      <div className="bg-white rounded-lg shadow p-4 border-l-4 border-blue-500">
        <div className="text-2xl font-bold text-gray-900">
          {summary.byMechanism.alteredGait}
        </div>
        <div className="text-sm text-gray-600">
          🚶 {t("secondaryScoutSection.biomechanical")}
        </div>
      </div>
    </div>
  );
}

function SecondaryScoutFilterControls({
  probabilityFilter,
  setProbabilityFilter,
  selectAllFiltered,
  clearSelection,
  selectedForPacket,
  t,
}) {
  return (
    <div className="bg-white rounded-lg shadow p-4 mb-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <label className="text-sm font-medium text-gray-700">
            {t("secondaryScoutSection.filterByProbability")}:
          </label>
          <div className="flex gap-2">
            <button type="button"
              onClick={() => setProbabilityFilter("High")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                probabilityFilter === "High"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {t("secondaryScoutSection.highOnly")}
            </button>
            <button type="button"
              onClick={() => setProbabilityFilter("Medium")}
              className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
                probabilityFilter === "Medium"
                  ? "bg-orange-600 text-white"
                  : "bg-gray-200 text-gray-700 hover:bg-gray-300"
              }`}
            >
              {t("secondaryScoutSection.highAndMedium")}
            </button>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button type="button"
            onClick={selectAllFiltered}
            className="px-3 py-2 text-sm font-medium text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
          >
            {t("secondaryScoutSection.selectAll")}
          </button>
          {selectedForPacket.size > 0 && (
            <button type="button"
              onClick={clearSelection}
              className="px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-100 rounded-md transition-colors"
            >
              {t("secondaryScoutSection.clearSelection")}
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

function FloatingActionBarSummary({
  selectedForPacket,
  getUnsavedSelectedCount,
  t,
}) {
  return (
    <div className="flex items-center gap-2">
      <svg
        className="w-5 h-5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
        />
      </svg>
      <span className="font-semibold text-sm sm:text-base">
        {selectedForPacket.size}{" "}
        {t("secondaryScoutSection.claimsSelected", {
          count: selectedForPacket.size,
        })}
      </span>
      {getUnsavedSelectedCount() < selectedForPacket.size && (
        <span className="text-blue-200 text-xs sm:text-sm hidden sm:inline">
          ({selectedForPacket.size - getUnsavedSelectedCount()}{" "}
          {t("secondaryScoutSection.saved")})
        </span>
      )}
    </div>
  );
}

function FloatingActionBarButtons({
  getUnsavedSelectedCount,
  addSelectedToPacket,
  clearSelection,
  t,
}) {
  return (
    <div className="flex items-center gap-2">
      <button type="button"
        onClick={addSelectedToPacket}
        disabled={getUnsavedSelectedCount() === 0}
        className="flex-1 sm:flex-none bg-white text-blue-600 px-3 sm:px-4 py-2 rounded-lg font-semibold hover:bg-blue-50 transition-colors flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed text-sm"
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
            d="M12 6v6m0 0v6m0-6h6m-6 0H6"
          />
        </svg>
        {t("secondaryScoutSection.addToPacket")}
      </button>
      <button type="button"
        onClick={clearSelection}
        className="text-white hover:bg-white/20 p-2 rounded-lg transition-colors"
        aria-label={t("secondaryScoutSection.clearSelection")}
      >
        <svg
          className="w-5 h-5"
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
  );
}

function FloatingActionBar({
  selectedForPacket,
  getUnsavedSelectedCount,
  addSelectedToPacket,
  clearSelection,
  t,
}) {
  if (selectedForPacket.size === 0) return null;

  return (
    <div className="fixed bottom-4 sm:bottom-6 left-2 right-2 sm:left-1/2 sm:right-auto sm:transform sm:-translate-x-1/2 z-40">
      <div className="bg-gradient-to-r from-emerald-700 to-teal-700 text-white px-3 sm:px-6 py-3 sm:py-4 rounded-xl shadow-2xl flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-4">
        <FloatingActionBarSummary
          selectedForPacket={selectedForPacket}
          getUnsavedSelectedCount={getUnsavedSelectedCount}
          t={t}
        />
        <FloatingActionBarButtons
          getUnsavedSelectedCount={getUnsavedSelectedCount}
          addSelectedToPacket={addSelectedToPacket}
          clearSelection={clearSelection}
          t={t}
        />
      </div>
    </div>
  );
}

function useSecondaryClaimsData(userDisabilities, probabilityFilter) {
  const [suggestions, setSuggestions] = useState([]);
  const [filteredSuggestions, setFilteredSuggestions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [savedClaims, setSavedClaims] = useState(new Set());

  useEffect(() => {
    if (userDisabilities && userDisabilities.length > 0) {
      const results = findSecondaryClaims(userDisabilities);
      setSuggestions(results);
      setFilteredSuggestions(filterByProbability(results, probabilityFilter));
      setSummary(getSecondaryClaimsSummary(results));

      // Check which claims are already saved
      const saved = new Set();
      results.forEach((suggestion) => {
        if (
          isClaimSaved(
            suggestion.secondaryCondition,
            suggestion.primaryCondition,
          )
        ) {
          saved.add(
            `${suggestion.secondaryCondition}-${suggestion.primaryCondition}`,
          );
        }
      });
      setSavedClaims(saved);
    } else {
      setSuggestions([]);
      setFilteredSuggestions([]);
      setSummary(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [userDisabilities]);

  useEffect(() => {
    setFilteredSuggestions(filterByProbability(suggestions, probabilityFilter));
  }, [probabilityFilter, suggestions]);

  return {
    suggestions,
    filteredSuggestions,
    summary,
    savedClaims,
    setSavedClaims,
  };
}

function SecondaryClaimsGrid({
  filteredSuggestions,
  selectedCondition,
  setSelectedCondition,
  handleLearnHow,
  handleSaveClaim,
  isClaimAlreadySaved,
  onViewPacket,
  isSelectedForPacket,
  toggleSelectForPacket,
  setPacketPrimary,
  setPacketSecondary,
  setShowDoctorsPacket,
}) {
  return (
    <div className="grid grid-cols-1 gap-4">
      {filteredSuggestions.map((suggestion, index) => (
        <SecondaryConditionCard
          key={index}
          suggestion={suggestion}
          isExpanded={selectedCondition === index}
          onToggle={() =>
            setSelectedCondition(selectedCondition === index ? null : index)
          }
          getMechanismBadgeColor={getMechanismBadgeColor}
          getProbabilityBadgeColor={getProbabilityBadgeColor}
          onLearnHow={() => handleLearnHow(suggestion)}
          onSave={() => handleSaveClaim(suggestion)}
          isSaved={isClaimAlreadySaved(suggestion)}
          onViewPacket={onViewPacket}
          isSelected={isSelectedForPacket(suggestion)}
          onToggleSelect={() => toggleSelectForPacket(suggestion)}
          onGetDoctorsPacket={() => {
            setPacketPrimary(suggestion.primaryCondition);
            setPacketSecondary(suggestion.secondaryCondition);
            setShowDoctorsPacket(true);
          }}
        />
      ))}
    </div>
  );
}

function SecondaryScoutDisclaimer({ t }) {
  return (
    <div className="mt-8 bg-yellow-50 border-l-4 border-yellow-400 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-yellow-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-yellow-700">
            <strong>{t("secondaryScoutSection.important")}:</strong>{" "}
            {t("secondaryScoutSection.disclaimerText")}
          </p>
        </div>
      </div>
    </div>
  );
}

/**
 * SecondaryScout Component
 * Main UI for the Secondary Conditions Scout module
 * Displays potential secondary claims based on user's service-connected disabilities
 */
function useSecondaryScoutState({ userDisabilities, onLearnHow }) {
  const { t } = useLanguage();
  const [selectedCondition, setSelectedCondition] = useState(null);
  const [probabilityFilter, setProbabilityFilter] = useState("Medium"); // 'High' or 'Medium'
  const [selectedForPacket, setSelectedForPacket] = useState(new Set());
  // Doctor's Packet modal state
  const [showDoctorsPacket, setShowDoctorsPacket] = useState(false);
  const [packetPrimary, setPacketPrimary] = useState("");
  const [packetSecondary, setPacketSecondary] = useState("");

  const {
    suggestions,
    filteredSuggestions,
    summary,
    savedClaims,
    setSavedClaims,
  } = useSecondaryClaimsData(userDisabilities, probabilityFilter);

  const { handleSaveClaim, handleLearnHow, isClaimAlreadySaved } =
    createClaimHandlers({ savedClaims, setSavedClaims, onLearnHow });

  const {
    toggleSelectForPacket,
    isSelectedForPacket,
    selectAllFiltered,
    clearSelection,
    getUnsavedSelectedCount,
  } = createSelectionHandlers({
    selectedForPacket,
    setSelectedForPacket,
    savedClaims,
    filteredSuggestions,
  });

  const addSelectedToPacket = createAddSelectedToPacketHandler({
    filteredSuggestions,
    selectedForPacket,
    savedClaims,
    setSavedClaims,
    setSelectedForPacket,
  });

  return {
    t,
    selectedCondition,
    setSelectedCondition,
    probabilityFilter,
    setProbabilityFilter,
    selectedForPacket,
    showDoctorsPacket,
    setShowDoctorsPacket,
    packetPrimary,
    setPacketPrimary,
    packetSecondary,
    setPacketSecondary,
    suggestions,
    filteredSuggestions,
    summary,
    handleSaveClaim,
    handleLearnHow,
    isClaimAlreadySaved,
    toggleSelectForPacket,
    isSelectedForPacket,
    selectAllFiltered,
    clearSelection,
    getUnsavedSelectedCount,
    addSelectedToPacket,
  };
}

// SecondaryScoutFilterControls/SecondaryClaimsGrid/FloatingActionBar each
// destructure only the specific props they need, and every one of those
// names matches a key on the state object returned by
// useSecondaryScoutState, so spreading it through is behaviorally identical
// to building a separate prop bag per component.
const SecondaryScout = ({
  userDisabilities = [],
  onLearnHow,
  onViewPacket,
  onOpenAISettings,
}) => {
  const scoutState = useSecondaryScoutState({ userDisabilities, onLearnHow });
  const {
    t,
    suggestions,
    filteredSuggestions,
    summary,
    showDoctorsPacket,
    setShowDoctorsPacket,
    packetPrimary,
    packetSecondary,
  } = scoutState;

  if (!userDisabilities || userDisabilities.length === 0) {
    return <EmptyDisabilitiesNotice t={t} />;
  }

  return (
    <div className="max-w-7xl mx-auto p-6">
      <SecondaryScoutHeader t={t} />
      <SecondaryScoutSummary summary={summary} t={t} />
      <SecondaryScoutFilterControls {...scoutState} />
      <SecondaryClaimsGrid {...scoutState} onViewPacket={onViewPacket} />
      <FloatingActionBar {...scoutState} />

      {filteredSuggestions.length === 0 && suggestions.length > 0 && (
        <div className="text-center py-8 text-gray-500">
          {t("secondaryScoutSection.noSuggestionsFilter")}
        </div>
      )}

      <SecondaryScoutDisclaimer t={t} />

      <BuyMeCoffee
        show={filteredSuggestions.length > 0}
        trigger="secondary-scout"
        context={{ count: filteredSuggestions.length }}
        componentKey="secondary-scout"
      />

      <DoctorsPacket
        isOpen={showDoctorsPacket}
        onClose={() => setShowDoctorsPacket(false)}
        primaryCondition={packetPrimary}
        secondaryCondition={packetSecondary}
        onOpenAISettings={onOpenAISettings}
      />
    </div>
  );
};

function getSelectionBadgeClasses(isSaved, isSelected) {
  if (isSaved) return "bg-green-100 border-green-500";
  if (isSelected) return "bg-blue-600 border-blue-600";
  return "border-gray-300 hover:border-blue-400";
}

function SelectionIcon({ isSaved, isSelected }) {
  if (isSaved) {
    return (
      <svg
        className="w-4 h-4 text-green-600"
        fill="currentColor"
        viewBox="0 0 20 20"
      >
        <path
          fillRule="evenodd"
          d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
          clipRule="evenodd"
        />
      </svg>
    );
  }
  if (isSelected) {
    return (
      <svg
        className="w-4 h-4 text-white"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={3}
          d="M5 13l4 4L19 7"
        />
      </svg>
    );
  }
  return null;
}

function SelectionCheckbox({ isSaved, isSelected, onToggleSelect, t }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="mr-4 flex-shrink-0"
      onClick={(e) => {
        e.stopPropagation();
        onToggleSelect();
      }}
    >
      <div
        className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-all cursor-pointer ${getSelectionBadgeClasses(isSaved, isSelected)}`}
      >
        <SelectionIcon isSaved={isSaved} isSelected={isSelected} />
      </div>
      {isSaved && (
        <span className="text-xs text-green-600 font-medium mt-1 block">
          {t("secondaryScoutSection.saved")}
        </span>
      )}
    </div>
  );
}

function ConditionTitleAndBadges({
  suggestion,
  getMechanismBadgeColor: mechanismBadgeColor,
  getProbabilityBadgeColor: probabilityBadgeColor,
  t,
}) {
  return (
    <div className="flex-1">
      <h3 className="text-xl font-semibold text-gray-900 mb-2">
        {suggestion.secondaryCondition}
      </h3>
      <p className="text-sm text-gray-600 mb-3">
        {t("secondaryScoutSection.secondaryTo")}:{" "}
        <span className="font-medium text-gray-800">
          {suggestion.primaryCondition}
        </span>
      </p>
      <div className="flex flex-wrap gap-2">
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${probabilityBadgeColor(suggestion.probability)}`}
        >
          {suggestion.probability === "High"
            ? t("secondaryScoutSection.highProbability")
            : t("secondaryScoutSection.mediumProbability")}
        </span>
        <span
          className={`px-3 py-1 rounded-full text-xs font-semibold border ${mechanismBadgeColor(suggestion.mechanism)}`}
        >
          {suggestion.mechanism}
        </span>
        {suggestion.ecfrDiagnosticCode && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-300">
            📋 {suggestion.ecfrDiagnosticCode}
          </span>
        )}
        {suggestion.warning && (
          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 border border-amber-300">
            ⚠️ {t("secondaryScoutSection.medicationRelated")}
          </span>
        )}
      </div>
      {suggestion.smcNote && (
        <div className="mt-3 p-3 bg-emerald-50 border border-emerald-300 rounded-lg text-sm text-emerald-800">
          💰 <strong>{suggestion.smcNote.code}:</strong>{" "}
          {suggestion.smcNote.message}{" "}
          <span className="text-emerald-600">
            ({suggestion.smcNote.citation})
          </span>
        </div>
      )}
    </div>
  );
}

function CardHeader({
  suggestion,
  isExpanded,
  onToggle,
  isSaved,
  isSelected,
  onToggleSelect,
  getMechanismBadgeColor,
  getProbabilityBadgeColor,
  t,
}) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div className="p-6 cursor-pointer" onClick={onToggle}>
      <div className="flex items-start justify-between">
        <SelectionCheckbox
          isSaved={isSaved}
          isSelected={isSelected}
          onToggleSelect={onToggleSelect}
          t={t}
        />
        <ConditionTitleAndBadges
          suggestion={suggestion}
          getMechanismBadgeColor={getMechanismBadgeColor}
          getProbabilityBadgeColor={getProbabilityBadgeColor}
          t={t}
        />
        <button type="button" className="ml-4 text-gray-400 hover:text-gray-600">
          <svg
            className={`w-6 h-6 transition-transform ${isExpanded ? "transform rotate-180" : ""}`}
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 9l-7 7-7-7"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}

function NexusTheorySection({ suggestion, t }) {
  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-900 mb-3 flex items-center">
        <svg
          className="w-5 h-5 mr-2 text-blue-600"
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
        {t("secondaryScoutSection.nexusTheory")}
      </h4>
      <div className="bg-blue-50 border-l-4 border-blue-400 p-4 rounded">
        <p className="text-sm text-gray-800 leading-relaxed">
          {suggestion.nexusTheory}
        </p>
      </div>
    </div>
  );
}

function WarningNotice({ warning, t }) {
  if (!warning) return null;

  return (
    <div className="mb-6 bg-amber-50 border-l-4 border-amber-400 p-4 rounded">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg
            className="h-5 w-5 text-amber-400"
            viewBox="0 0 20 20"
            fill="currentColor"
          >
            <path
              fillRule="evenodd"
              d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div className="ml-3">
          <p className="text-sm text-amber-800">
            <strong>{t("secondaryScoutSection.note")}:</strong> {warning}
          </p>
        </div>
      </div>
    </div>
  );
}

function MedicalEvidenceSection({ evidenceList, evidenceType, t }) {
  if (evidenceList.length === 0) return null;

  return (
    <div className="mb-6">
      <h4 className="text-lg font-semibold text-gray-900 mb-3">
        {t("secondaryScoutSection.medicalLiteratureSupport")}
      </h4>
      {evidenceType && (
        <p className="text-xs text-gray-500 mb-2 italic">{evidenceType}</p>
      )}
      <ul className="space-y-2">
        {evidenceList.map((citation, idx) => (
          <li key={idx} className="flex items-start text-sm text-gray-700">
            <svg
              className="w-4 h-4 mr-2 mt-0.5 text-green-600 flex-shrink-0"
              fill="currentColor"
              viewBox="0 0 20 20"
            >
              <path
                fillRule="evenodd"
                d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                clipRule="evenodd"
              />
            </svg>
            <span>{citation}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

function BuildStatementButton({ onLearnHow, t }) {
  return (
    <button type="button"
      onClick={(e) => {
        e.stopPropagation();
        onLearnHow();
      }}
      className="flex-1 min-w-[200px] bg-green-600 text-white px-6 py-3 rounded-md font-semibold hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
    >
      <svg
        className="w-5 h-5"
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
      {t("secondaryScoutSection.buildStatement")}
    </button>
  );
}

function DoctorsPacketButton({ onGetDoctorsPacket, t }) {
  return (
    <button type="button"
      onClick={(e) => {
        e.stopPropagation();
        onGetDoctorsPacket();
      }}
      className="flex-1 min-w-[200px] bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-3 rounded-md font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all flex items-center justify-center gap-2"
    >
      <svg
        className="w-5 h-5"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
        />
      </svg>
      {t("secondaryScoutSection.getDoctorsPacket")}
    </button>
  );
}

function SaveOrViewButton({ isSaved, onSave, onViewPacket, t }) {
  return (
    <button type="button"
      onClick={(e) => {
        e.stopPropagation();
        if (isSaved && onViewPacket) {
          onViewPacket();
        } else {
          onSave();
        }
      }}
      className={`px-6 py-3 rounded-md font-semibold border-2 transition-colors flex items-center gap-2 ${
        isSaved
          ? "border-green-600 text-green-600 bg-green-50"
          : "border-gray-300 text-gray-700 hover:bg-gray-50"
      }`}
    >
      {isSaved ? (
        <>
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
          {t("secondaryScoutSection.savedViewPacket")}
        </>
      ) : (
        <>
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z"
            />
          </svg>
          {t("secondaryScoutSection.saveForLater")}
        </>
      )}
    </button>
  );
}

function CardActionButtons({
  onLearnHow,
  onGetDoctorsPacket,
  onSave,
  onViewPacket,
  isSaved,
  t,
}) {
  return (
    <div className="flex flex-wrap gap-3">
      <BuildStatementButton onLearnHow={onLearnHow} t={t} />
      <DoctorsPacketButton onGetDoctorsPacket={onGetDoctorsPacket} t={t} />
      <SaveOrViewButton
        isSaved={isSaved}
        onSave={onSave}
        onViewPacket={onViewPacket}
        t={t}
      />
    </div>
  );
}

function ExpandedCardContent({
  suggestion,
  evidenceList,
  onLearnHow,
  onGetDoctorsPacket,
  onSave,
  onViewPacket,
  isSaved,
  t,
}) {
  return (
    <div className="px-6 pb-6 border-t border-gray-200 pt-4">
      <NexusTheorySection suggestion={suggestion} t={t} />

      <div className="mb-6">
        <h4 className="text-lg font-semibold text-gray-900 mb-3">
          {t("secondaryScoutSection.connectionType")}
        </h4>
        <MechanismExplanation mechanism={suggestion.mechanism} t={t} />
      </div>

      <WarningNotice warning={suggestion.warning} t={t} />

      <MedicalEvidenceSection
        evidenceList={evidenceList}
        evidenceType={suggestion.evidenceType}
        t={t}
      />

      <CardActionButtons
        onLearnHow={onLearnHow}
        onGetDoctorsPacket={onGetDoctorsPacket}
        onSave={onSave}
        onViewPacket={onViewPacket}
        isSaved={isSaved}
        t={t}
      />
    </div>
  );
}

/**
 * Individual Secondary Condition Card Component
 */
const SecondaryConditionCard = ({
  suggestion,
  isExpanded,
  onToggle,
  getMechanismBadgeColor,
  getProbabilityBadgeColor,
  onLearnHow,
  onSave,
  isSaved,
  onViewPacket,
  isSelected,
  onToggleSelect,
  onGetDoctorsPacket,
}) => {
  const { t } = useLanguage();
  const evidenceList =
    suggestion.medicalEvidence || suggestion.medicalCitations || [];

  return (
    <div
      className={`bg-white rounded-lg shadow-md border-2 overflow-hidden transition-all hover:shadow-lg ${
        isSelected ? "border-blue-500 bg-blue-50/30" : "border-gray-200"
      }`}
    >
      <CardHeader
        suggestion={suggestion}
        isExpanded={isExpanded}
        onToggle={onToggle}
        isSaved={isSaved}
        isSelected={isSelected}
        onToggleSelect={onToggleSelect}
        getMechanismBadgeColor={getMechanismBadgeColor}
        getProbabilityBadgeColor={getProbabilityBadgeColor}
        t={t}
      />

      {isExpanded && (
        <ExpandedCardContent
          suggestion={suggestion}
          evidenceList={evidenceList}
          onLearnHow={onLearnHow}
          onGetDoctorsPacket={onGetDoctorsPacket}
          onSave={onSave}
          onViewPacket={onViewPacket}
          isSaved={isSaved}
          t={t}
        />
      )}
    </div>
  );
};

/**
 * Mechanism Explanation Component
 */
const MechanismExplanation = ({ mechanism, t }) => {
  const explanations = {
    Direct: {
      icon: "🎯",
      titleKey: "directCausation",
      descriptionKey: "directCausationDesc",
      exampleKey: "directCausationExample",
    },
    Medication: {
      icon: "💊",
      titleKey: "iatrogenic",
      descriptionKey: "iatrogenicDesc",
      exampleKey: "iatrogenicExample",
    },
    "Altered Gait": {
      icon: "🚶",
      titleKey: "biomechanicalCompensation",
      descriptionKey: "biomechanicalCompensationDesc",
      exampleKey: "biomechanicalCompensationExample",
    },
  };

  const info = explanations[mechanism] || explanations["Direct"];

  return (
    <div className="bg-gray-50 p-4 rounded-lg">
      <div className="flex items-start">
        <span className="text-3xl mr-3">{info.icon}</span>
        <div>
          <h5 className="font-semibold text-gray-900 mb-1">
            {t(`secondaryScoutSection.${info.titleKey}`)}
          </h5>
          <p className="text-sm text-gray-700 mb-2">
            {t(`secondaryScoutSection.${info.descriptionKey}`)}
          </p>
          <p className="text-sm text-gray-600 italic">
            {t(`secondaryScoutSection.${info.exampleKey}`)}
          </p>
        </div>
      </div>
    </div>
  );
};

export default SecondaryScout;
