import CommandersChecklist from "../../components/CommandersChecklist";
import SearchBar from "../../components/SearchBar";
import SearchResultCard from "../../components/SearchResultCard";
import QuickConditionPicker from "../../components/QuickConditionPicker";
import DisabilityDetails from "../../components/DisabilityDetails";
import DemoDataLoader from "../../components/DemoDataLoader";
import HomeFeatureCards from "../home-cta/HomeFeatureCards";
import { dispatchToolById } from "../../utils/dispatchToolById";
import { PROJECT_STATS } from "../../data/projectStats";

/**
 * Home page <main> region — the hero, search bar, CommandersChecklist,
 * results list, QuickConditionPicker, the optional DisabilityDetails
 * panel, and the HomeFeatureCards grid below it.
 *
 * Takes its search-related state + handlers from useDisabilitySearch
 * (called in App.jsx so siblings like BuyMeCoffee and AIAssistantBubble
 * can also read the values). All other dependencies (CommandersChecklist
 * tool routing, MyPacket dispatch for DemoDataLoader, etc.) are
 * self-contained.
 *
 * Extracted from App.jsx (audit #35, B75).
 */
export default function HomeMain({
  searchTerm,
  setSearchTerm,
  results,
  selectedResult,
  setSelectedResult,
  isLoading,
  error,
  setHasSearched,
  handleClearSearch,
  handleBuildStatementFromSearch,
  handleSecondaryConditionClick,
}) {
  return (
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
          with official rating criteria, discover secondary conditions, practice
          for C&P exams, and build your evidence packet - all in one place.
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
            💡 <strong>Tip:</strong> Search by condition name, diagnostic code,
            or keyword - covers all 15 body systems from 38 CFR Part 4
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
  );
}
