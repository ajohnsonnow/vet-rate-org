import React from 'react';

function SearchResultCard({ result, onSelect, isSelected }) {
  return (
    <button
      onClick={onSelect}
      className={`w-full text-left border-2 rounded-lg p-5 transition-all duration-200 hover:shadow-lg ${
        isSelected
          ? 'border-va-blue bg-green-50 shadow-md'
          : 'border-gray-200 bg-white hover:border-va-blue'
      }`}
    >
      <div className="flex justify-between items-start gap-3 mb-2">
        <h3 className="font-bold text-lg text-gray-900 flex-1">
          {result.conditionName}
        </h3>
        <span className="bg-va-blue text-white text-xs font-bold px-3 py-1 rounded-full whitespace-nowrap">
          DC {result.diagnosticCode}
        </span>
      </div>

      <p className="text-sm text-gray-600 mb-3 line-clamp-2">
        {result.ratingSchedule}
      </p>

      {result.aliases && result.aliases.length > 0 && (
        <div className="mb-3">
          <p className="text-xs text-gray-500 font-semibold mb-1">Also known as:</p>
          <div className="flex flex-wrap gap-1">
            {result.aliases.slice(0, 2).map((alias, idx) => (
              <span
                key={idx}
                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
              >
                {alias}
              </span>
            ))}
            {result.aliases.length > 2 && (
              <span className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded">
                +{result.aliases.length - 2} more
              </span>
            )}
          </div>
        </div>
      )}

      <div className="flex items-center text-sm text-va-blue font-semibold">
        <svg
          className="w-4 h-4 mr-1"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Click to view full details
      </div>
    </button>
  );
}

export default SearchResultCard;
