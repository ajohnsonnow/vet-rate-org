import React from 'react';

function Disclaimer() {
  return (
    <div className="max-w-4xl mx-auto mb-8">
      <div 
        className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl shadow-sm p-6"
        role="alert"
        aria-labelledby="disclaimer-title"
      >
        <div className="flex flex-col items-center text-center">
          {/* Warning Icon */}
          <div className="bg-amber-100 dark:bg-amber-800/50 rounded-full p-3 mb-4">
            <svg className="h-8 w-8 text-amber-600 dark:text-amber-400" fill="currentColor" viewBox="0 0 20 20" aria-hidden="true">
              <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
            </svg>
          </div>
          
          {/* Title */}
          <h3 id="disclaimer-title" className="text-lg font-bold text-amber-800 dark:text-amber-200 mb-3 tracking-wide">
            ⚠️ IMPORTANT DISCLAIMER
          </h3>
          
          {/* Content */}
          <div className="text-amber-700 dark:text-amber-300 space-y-3 max-w-2xl">
            <p>
              <strong className="text-amber-800 dark:text-amber-200">Vet-Rate.org is an informational resource</strong> created by a disabled veteran. 
              This is not a Veterans Service Organization (VSO) or law firm. This website is for{' '}
              <strong className="text-amber-800 dark:text-amber-200">informational purposes only</strong> and does not constitute legal, medical, or official VA guidance.
            </p>
            <p className="text-sm text-amber-600 dark:text-amber-400">
              For official assistance with your disability claim, please consult with an accredited VSO, 
              VA Regional Office representative, or qualified attorney. Always verify information with official VA sources.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Disclaimer;
