/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * LoadingBunker Component
 * Reusable loading spinner for async operations (IndexedDB, API calls, etc.)
 * Shows "Loading Bunker..." with military-themed spinner
 */

import React from 'react';

const LoadingBunker = ({ message = 'Loading Bunker...', size = 'medium' }) => {
  const sizeClasses = {
    small: 'h-8 w-8 border-2',
    medium: 'h-12 w-12 border-3',
    large: 'h-16 w-16 border-4'
  };

  const textSizeClasses = {
    small: 'text-sm',
    medium: 'text-base',
    large: 'text-lg'
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-8">
      <div className="relative">
        {/* Spinning border */}
        <div className={`${sizeClasses[size]} border-amber-500 border-t-transparent rounded-full animate-spin`}></div>
        
        {/* Inner static circle */}
        <div className={`absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 ${sizeClasses[size]} border border-gray-600 rounded-full opacity-30`}></div>
      </div>
      
      {message && (
        <div className={`${textSizeClasses[size]} text-gray-300 font-semibold animate-pulse`}>
          {message}
        </div>
      )}
    </div>
  );
};

export default LoadingBunker;
