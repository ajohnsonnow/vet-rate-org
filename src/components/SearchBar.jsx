import { useState, useEffect, useRef } from "react";
import { getSearchSuggestions } from "../utils/searchUtils";
import disabilityData from "../data/disabilityData.json";
import { useLanguage } from "../contexts/LanguageContext";

function SearchBar({ searchTerm, setSearchTerm, onClear, isLoading }) {
  const { t } = useLanguage();
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  // B-H04: index of the keyboard-active option (-1 = none) for aria-activedescendant.
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef(null);

  useEffect(() => {
    setActiveIndex(-1);
    if (searchTerm.trim().length >= 2) {
      const newSuggestions = getSearchSuggestions(
        searchTerm,
        disabilityData,
        8,
      );
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm]);

  // Close suggestions when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target)
      ) {
        setShowSuggestions(false);
      }
    };
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, []);

  const handleSuggestionClick = (suggestion) => {
    // Use mousedown instead of click to fire before blur
    setSearchTerm(suggestion);
    setShowSuggestions(false);
    setActiveIndex(-1);
  };

  // B-H04: keyboard navigation for the combobox. Focus stays on the input; the
  // active option is tracked via aria-activedescendant so screen readers announce
  // the highlighted suggestion as the user arrows through them.
  const handleInputKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % suggestions.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? suggestions.length - 1 : i - 1));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSuggestionClick(suggestions[activeIndex]);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
      setActiveIndex(-1);
    }
  };

  return (
    <div className="max-w-3xl mx-auto" ref={containerRef}>
      <div className="relative">
        <div className="relative flex items-center">
          <div className="absolute left-4 text-gray-400">
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
                d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
              />
            </svg>
          </div>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            onFocus={() => {
              if (suggestions.length > 0) setShowSuggestions(true);
            }}
            placeholder={t("searchBar", "placeholder")}
            className="w-full pl-12 pr-12 py-4 text-base sm:text-lg border-2 border-gray-300 dark:border-gray-600 rounded-xl shadow-sm focus:outline-none focus:border-va-blue focus:ring-2 focus:ring-va-blue focus:ring-opacity-50 transition bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-400 min-h-[44px]"
            autoComplete="off"
            disabled={isLoading}
            aria-label={t("searchBar", "ariaLabel")}
            role="combobox"
            aria-expanded={showSuggestions && suggestions.length > 0}
            aria-haspopup="listbox"
            aria-controls="search-suggestions"
            aria-activedescendant={
              activeIndex >= 0 ? `search-option-${activeIndex}` : undefined
            }
            onKeyDown={handleInputKeyDown}
            style={{ fontSize: "16px" }}
          />
          {searchTerm && (
            <button
              onClick={onClear}
              className="absolute right-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition"
              aria-label={t("searchBar", "clearSearch")}
            >
              <svg
                className="w-5 h-5"
                fill="currentColor"
                viewBox="0 0 20 20"
                aria-hidden="true"
              >
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Suggestions dropdown - limited height with scroll */}
        {showSuggestions && suggestions.length > 0 && (
          <div
            id="search-suggestions"
            role="listbox"
            aria-label={t("searchBar", "suggestionsLabel")}
            className="absolute top-full left-0 right-0 mt-2 bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-600 rounded-lg shadow-lg z-50 max-h-64 overflow-y-auto"
          >
            {suggestions.map((suggestion, index) => (
              // role="option" must live on a non-interactive element (not a
              // <button>); selection is tracked via aria-activedescendant on the
              // input, so options are not individual tab stops (B-H04).
              <div
                key={index}
                id={`search-option-${index}`}
                role="option"
                aria-selected={index === activeIndex}
                onMouseDown={(e) => {
                  e.preventDefault(); // Prevent blur before click completes
                  handleSuggestionClick(suggestion);
                }}
                onMouseEnter={() => setActiveIndex(index)}
                className={`w-full text-left px-4 py-3 ${
                  index === activeIndex ? "bg-blue-50 dark:bg-gray-700" : ""
                } hover:bg-blue-50 dark:hover:bg-gray-700 border-b border-gray-100 dark:border-gray-700 last:border-b-0 transition cursor-pointer text-sm min-h-[44px] flex items-center`}
              >
                <span className="text-gray-900 dark:text-gray-100">
                  {suggestion}
                </span>
              </div>
            ))}
            {/* Hint to close dropdown */}
            <div className="px-4 py-2 bg-gray-50 dark:bg-gray-900 text-xs text-gray-500 dark:text-gray-400 text-center border-t border-gray-200 dark:border-gray-700">
              {t("searchBar", "suggestionHint")}
            </div>
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <span className="font-semibold">
            {t("searchBar", "examplesLabel")}
          </span>{" "}
          {t("searchBar", "examplesText")}
        </p>
      </div>
    </div>
  );
}

export default SearchBar;
