import { useState, useEffect, useCallback } from "react";
import {
  searchDisabilityData,
  validateSearchTerm,
} from "../../utils/searchUtils";
import disabilityData from "../../data/disabilityData.json";

/**
 * Disability search subsystem — owns every piece of state, every
 * effect, and every handler that drives the home-page search:
 *
 *   - state: searchTerm, results, selectedResult, isLoading, error,
 *     hasSearched
 *   - debounced search effect (300ms) over searchDisabilityData
 *   - `searchDisability` window event bridge: BlueButtonXRayModal's
 *     "Check Rating Criteria" callback dispatches into setSearchTerm
 *   - handleClearSearch: wipe term + results + selection + error
 *   - handleBuildStatementFromSearch(conditionName): close detail,
 *     dispatch openNexusBuilder with the condition pre-filled
 *   - handleSecondaryConditionClick(diagnosticCode, conditionName):
 *     jump to a secondary by code, falling back to a name search,
 *     scrolling to the diagnostic header on success
 *
 * setHasSearched is exposed for the CommandersChecklist "Conditions
 * Search" entry, which uses it to collapse the results list.
 *
 * Extracted from App.jsx (audit #35, B74).
 */
export function useDisabilitySearch() {
  const [searchTerm, setSearchTerm] = useState("");
  const [results, setResults] = useState([]);
  const [selectedResult, setSelectedResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [hasSearched, setHasSearched] = useState(false);

  useEffect(() => {
    const searchDisabilityBridge = (e) => {
      if (e?.detail?.term !== undefined) setSearchTerm(e.detail.term);
    };
    window.addEventListener("searchDisability", searchDisabilityBridge);
    return () => {
      window.removeEventListener("searchDisability", searchDisabilityBridge);
    };
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (!searchTerm.trim()) {
        setResults([]);
        setError(null);
        return;
      }

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

  const handleBuildStatementFromSearch = useCallback((conditionName) => {
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
  }, []);

  const handleSecondaryConditionClick = useCallback(
    (diagnosticCode, conditionName) => {
      const foundCondition = disabilityData.disabilities.find(
        (d) => d.diagnosticCode === diagnosticCode,
      );

      if (foundCondition) {
        setSelectedResult(foundCondition);
        setTimeout(() => {
          const headerElement = document.getElementById("diagnostic-header");
          if (headerElement) {
            headerElement.scrollIntoView({
              behavior: "smooth",
              block: "start",
            });
          }
        }, 100);
      } else {
        setSearchTerm(conditionName);
        setSelectedResult(null);
      }
    },
    [],
  );

  return {
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
  };
}
