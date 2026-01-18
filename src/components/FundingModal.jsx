import React from 'react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

/**
 * FundingModal - Modal with multiple ways to support Vet-Rate.org
 * Shows context-specific development stats when provided
 * @param {boolean} show - Whether to show the modal
 * @param {function} onClose - Callback when modal is closed
 * @param {object} componentStats - Optional stats about the component { name, hours, lines, description }
 */
function FundingModal({ show, onClose, componentStats = null }) {
  // Lock body scroll when modal is open
  useBodyScrollLock(show);

  if (!show) return null;

  const fundingOptions = [
    {
      name: 'Buy Me a Coffee',
      url: 'https://buymeacoffee.com/vetrate',
      icon: '☕',
      color: 'bg-yellow-400 hover:bg-yellow-500',
      textColor: 'text-gray-900 dark:text-gray-900',
      descColor: 'text-yellow-900 dark:text-yellow-900',
      description: 'vet-rate.org'
    },
    {
      name: 'PayPal',
      url: 'https://paypal.me/ajohnsonnow',
      icon: '💳',
      color: 'bg-blue-600 hover:bg-blue-700',
      textColor: 'text-white dark:text-white',
      descColor: 'text-blue-100 dark:text-blue-100',
      description: 'ajohnsonnow'
    },
    {
      name: 'Cash App',
      url: 'https://cash.app/$ajnow',
      icon: '💵',
      color: 'bg-green-600 hover:bg-green-700',
      textColor: 'text-white dark:text-white',
      descColor: 'text-green-100 dark:text-green-100',
      description: '$ajnow'
    },
    {
      name: 'Venmo',
      url: 'https://venmo.com/ajnow',
      icon: '📱',
      color: 'bg-sky-600 hover:bg-sky-700',
      textColor: 'text-white dark:text-white',
      descColor: 'text-sky-100 dark:text-sky-100',
      description: '@ajnow'
    }
  ];

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      onClick={onClose}
    >
      <div 
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-md w-full p-6 relative modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
          aria-label="Close"
        >
          <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
          </svg>
        </button>

        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex justify-center mb-3">
            <img 
              src="/images/Anth.jpg" 
              alt="SGT Johnson"
              className="w-16 h-16 rounded-full object-cover border-4 border-va-gold shadow-lg"
            />
          </div>
          <h2 className="text-2xl font-bold text-gray-900 dark:text-white mb-2">
            💚 Back the Mission
          </h2>
          
          {/* Component-specific stats */}
          {componentStats && (
            <div className="bg-gradient-to-r from-blue-50 to-purple-50 dark:from-blue-900/30 dark:to-purple-900/30 rounded-lg p-3 mb-3 border border-blue-200 dark:border-blue-700">
              <p className="text-sm font-bold text-gray-800 dark:text-gray-200 mb-1">
                {componentStats.name}
              </p>
              <div className="flex justify-center gap-4 text-xs text-gray-600 dark:text-gray-400">
                <div>
                  <span className="font-semibold">⏱️ {componentStats.hours} hrs</span> to build
                </div>
                <div>
                  <span className="font-semibold">📝 {componentStats.lines.toLocaleString()} lines</span> of code
                </div>
              </div>
              {componentStats.description && (
                <p className="text-xs text-gray-600 dark:text-gray-400 mt-2 italic">
                  {componentStats.description}
                </p>
              )}
            </div>
          )}
          
          <p className="text-gray-600 dark:text-gray-300 text-sm">
            100% of contributions go toward keeping Vet-Rate.org free for all veterans.
            No ads, no tracking, no data selling - just vets helping vets.
          </p>
        </div>

        {/* Funding Options */}
        <div className="space-y-3">
          {fundingOptions.map((option) => (
            <a
              key={option.name}
              href={option.url}
              target="_blank"
              rel="noopener noreferrer"
              className={`flex items-center gap-4 w-full p-3 rounded-lg ${option.color} ${option.textColor} font-semibold transition-all hover:scale-[1.02] hover:shadow-lg`}
            >
              <span className="text-2xl">{option.icon}</span>
              <div className="flex-1 text-left">
                <div className="font-bold">{option.name}</div>
                <div className={`text-xs font-medium ${option.descColor}`}>{option.description}</div>
              </div>
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
              </svg>
            </a>
          ))}
        </div>

        {/* Footer message */}
        <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
          Thank you for supporting veteran-built tools! 💚
        </p>
      </div>
    </div>
  );
}

export default FundingModal;
