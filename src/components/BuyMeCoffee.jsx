import React from 'react';

function BuyMeCoffee({ show }) {
  if (!show) return null;

  return (
    <div className="fixed bottom-20 right-6 z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-2xl p-4 max-w-sm border-2 border-va-gold">
        <div className="flex items-start gap-3">
          <div className="flex-shrink-0">
            <svg className="w-8 h-8 text-va-gold" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-gray-900 mb-1">
              Finding this helpful?
            </p>
            <p className="text-xs text-gray-600 mb-3">
              I built this tool to keep claims data free. I don't sell your data and I don't take cuts from lawyers. If this helped you, a $5 coffee helps pay the server bill.
            </p>
            <a
              href="https://buymeacoffee.com/vetrate"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-va-gold hover:bg-yellow-500 text-va-blue font-bold py-2 px-4 rounded-lg transition-all transform hover:scale-105 w-full justify-center"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
                <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
              </svg>
              Buy Me a Coffee
            </a>
          </div>
          <button
            onClick={() => document.querySelector('.fixed.bottom-20').style.display = 'none'}
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

export default BuyMeCoffee;
