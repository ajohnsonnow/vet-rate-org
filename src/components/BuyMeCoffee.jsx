import React, { useState, useEffect } from 'react';

/**
 * BuyMeCoffee - Subtle funding request that appears after valuable actions
 * @param {boolean} show - Whether to show the popup
 * @param {string} trigger - What action triggered this (search, secondary-scout, cap-sim, packet)
 * @param {function} onDismiss - Optional callback when dismissed
 */
function BuyMeCoffee({ show, trigger = 'search', onDismiss }) {
  const [isVisible, setIsVisible] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  // Show with a slight delay for better UX
  useEffect(() => {
    if (show && !isDismissed) {
      const timer = setTimeout(() => setIsVisible(true), 2000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [show, isDismissed]);

  // Reset dismissed state when trigger changes (new action)
  useEffect(() => {
    setIsDismissed(false);
  }, [trigger]);

  const handleDismiss = () => {
    setIsVisible(false);
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  if (!isVisible) return null;

  // Shorter, less intrusive messages
  const messages = {
    'search': {
      body: "Built by a veteran, for veterans. If this helped, consider keeping it free for the next vet.",
      cta: "Back the Mission"
    },
    'secondary-scout': {
      body: "This research would cost $100+ with a consultant. Your support keeps it free.",
      cta: "Back the Mission"
    },
    'cap-sim': {
      body: "Walking in prepared can mean hundreds more per month. Help the next vet find this.",
      cta: "Back the Mission"
    },
    'packet': {
      body: "No VSO fees, no lawyer cuts, no data sold. Just one vet helping another.",
      cta: "Back the Mission"
    },
    'terminology': {
      body: "Speaking the VA's language gets you the rating you deserve. Took 100s of hours to build.",
      cta: "Back the Mission"
    }
  };

  const msg = messages[trigger] || messages['search'];

  return (
    <div className="fixed bottom-4 right-4 z-50 animate-fade-in">
      <div className="bg-white rounded-lg shadow-lg p-3 max-w-xs border border-gray-200 relative">
        <button
          onClick={handleDismiss}
          className="absolute -top-2 -right-2 bg-gray-100 rounded-full p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-200 transition shadow-sm"
          aria-label="Dismiss"
        >
          <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        <div className="flex items-center gap-3">
          {/* Developer photo */}
          <img 
            src="/images/Anth.jpg" 
            alt="Anthony - Vet-Rate Developer"
            className="w-10 h-10 rounded-full object-cover flex-shrink-0 border-2 border-va-gold"
          />
          <div className="flex-1 min-w-0">
            <p className="text-xs text-gray-600 leading-snug">
              {msg.body}
            </p>
          </div>
        </div>
        
        <a
          href="https://buymeacoffee.com/vetrate"
          target="_blank"
          rel="noopener noreferrer"
          className="mt-2.5 inline-flex items-center justify-center gap-1.5 bg-va-gold hover:bg-yellow-500 text-va-blue text-sm font-semibold py-1.5 px-3 rounded-md transition-all w-full"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
          </svg>
          {msg.cta}
        </a>
      </div>
    </div>
  );
}

export default BuyMeCoffee;
