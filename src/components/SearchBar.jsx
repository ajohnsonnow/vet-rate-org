import React, { useState, useEffect } from 'react';
import { getSearchSuggestions } from '../utils/searchUtils';
import disabilityData from '../data/disabilityData.json';

function SearchBar({ searchTerm, setSearchTerm, onClear, isLoading }) {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  useEffect(() => {
    if (searchTerm.trim().length >= 2) {
      const newSuggestions = getSearchSuggestions(searchTerm, disabilityData, 8);
      setSuggestions(newSuggestions);
      setShowSuggestions(true);
    } else {
      setSuggestions([]);
      setShowSuggestions(false);
    }
  }, [searchTerm]);

  const handleSuggestionClick = (suggestion) => {
    setSearchTerm(suggestion);
    setShowSuggestions(false);
  };

  return (
    <div className="max-w-3xl mx-auto">
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
            placeholder="Search by condition name (PTSD, arthritis), diagnostic code (9411, 5002), or synonym (posttraumatic stress)..."
            className="w-full pl-12 pr-12 py-4 text-lg border-2 border-gray-300 rounded-xl shadow-sm focus:outline-none focus:border-va-blue focus:ring-2 focus:ring-va-blue focus:ring-opacity-50 transition"
            autoComplete="off"
            disabled={isLoading}
            aria-label="Search disabilities"
          />
          {searchTerm && (
            <button
              onClick={onClear}
              className="absolute right-4 text-gray-400 hover:text-gray-600 transition"
              aria-label="Clear search"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path
                  fillRule="evenodd"
                  d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                  clipRule="evenodd"
                />
              </svg>
            </button>
          )}
        </div>

        {/* Suggestions dropdown */}
        {showSuggestions && suggestions.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-2 bg-white border border-gray-300 rounded-lg shadow-lg z-50">
            {suggestions.map((suggestion, index) => (
              <button
                key={index}
                onClick={() => handleSuggestionClick(suggestion)}
                className="w-full text-left px-4 py-3 hover:bg-gray-100 border-b border-gray-200 last:border-b-0 transition"
              >
                <span className="text-gray-900">{suggestion}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-4 text-center">
        <p className="text-sm text-gray-600">
          <span className="font-semibold">Examples:</span> Try "PTSD", "9411", "arthritis", "migraine", "5002", "posttraumatic stress disorder"
        </p>
      </div>
    </div>
  );
}

export default SearchBar;
