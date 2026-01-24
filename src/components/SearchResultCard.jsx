import React from 'react';
import { PACTActBadge } from './PACTActIndicator';
import StaleDataIndicator from './StaleDataIndicator';
import { useLanguage } from '../contexts/LanguageContext';

function SearchResultCard({ result, onSelect, isSelected }) {
  const { t } = useLanguage();
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border-2 rounded-lg p-5 transition-all duration-200 hover:shadow-lg focus:outline-none focus:ring-2 focus:ring-va-blue focus:ring-offset-2 ${
        isSelected
          ? 'border-va-blue bg-green-50 dark:bg-green-900/30 shadow-md'
          : 'border-gray-200 dark:border-gray-600 bg-white dark:bg-gray-800 hover:border-va-blue'
      }`}
      aria-pressed={isSelected}
      aria-label={`View details for ${result.conditionName}, diagnostic code ${result.diagnosticCode}`}
    >
      <div className="flex justify-between items-start gap-3 mb-2">
        <div className="flex-1">
          <h3 className="font-bold text-lg text-gray-900 dark:text-white mb-1">
            {result.conditionName}
          </h3>
          <div className="flex items-center gap-2 flex-wrap">
            <PACTActBadge diagnosticCode={result.diagnosticCode} />
            <StaleDataIndicator disability={result} variant="compact" />
          </div>
        </div>
        <span className="bg-va-blue text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
          DC {result.diagnosticCode}
        </span>
      </div>

      <p className="text-sm text-gray-600 dark:text-gray-300 mb-3 line-clamp-2">
        {result.ratingSchedule}
      </p>

      {result.aliases && result.aliases.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 dark:text-gray-400 font-semibold mb-1">Also known as:</p>
          <div className="flex flex-wrap gap-1">
            {result.aliases.slice(0, 2).map((alias, idx) => (
              <span
                key={idx}
                className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded"
              >
                {alias}
              </span>
            ))}
            {result.aliases.length > 2 && (
              <span className="text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 px-2 py-1 rounded">
                +{result.aliases.length - 2} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center text-sm text-va-blue dark:text-va-gold font-semibold">
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        👆 Click to view full details
      </div>
    </button>
  );
}

export default SearchResultCard;
