import React from 'react';

function Disclaimer() {
  return (
    <div className="bg-amber-50 border-l-4 border-amber-500 p-4 mb-6">
      <div className="flex">
        <div className="flex-shrink-0">
          <svg className="h-5 w-5 text-amber-500" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
          </svg>
        </div>
        <div className="ml-3">
          <h3 className="text-sm font-bold text-amber-800">IMPORTANT DISCLAIMER</h3>
          <div className="mt-2 text-sm text-amber-700">
            <p className="mb-2">
              <strong>Vet-Rate.org is an informational resource.</strong> We are not Veterans Service Officers (VSOs) or attorneys. This website is for <strong>informational purposes only</strong> and does not constitute legal, medical, or official VA guidance.
            </p>
            <p>
              For official assistance with your disability claim, please consult with an accredited VSO, VA Regional Office representative, or qualified attorney. Always verify information with official VA sources.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

export default Disclaimer;
