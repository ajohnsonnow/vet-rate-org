/**
 * SupplyLocker.org - AI Consent Modal
 * 
 * Displays privacy disclosure and gets user consent before
 * sending any data to the AI service (Google Gemini).
 */

import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { getAIDataDisclosure } from '../utils/aiStatementHelper';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';

const AIConsentModal = ({ 
  isOpen, 
  onConsent, 
  onCancel, 
  statementType = 'personal' // 'personal', 'buddy', or 'ptsd'
}) => {
  const { t } = useLanguage();
  useBodyScrollLock(isOpen);
  
  if (!isOpen) return null;

  const disclosure = getAIDataDisclosure(statementType);

  const statementTypeLabels = {
    personal: 'Personal Statement',
    buddy: 'Buddy/Lay Statement',
    ptsd: 'PTSD Stressor Statement'
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-60 z-[60] flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-consent-title"
    >
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-indigo-600 text-white px-6 py-5 rounded-t-xl">
          <div className="flex items-center gap-3">
            <div className="bg-white/20 rounded-full p-2">
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
              </svg>
            </div>
            <div>
              <h2 id="ai-consent-title" className="text-xl font-bold">✨ AI Statement Assistant</h2>
              <p className="text-purple-200 text-sm">Powered by Google Gemini</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* What it does */}
          <div>
            <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-2 flex items-center gap-2">
              <span className="text-green-500">✓</span> What This Does
            </h3>
            <p className="text-gray-600 dark:text-gray-400 text-sm">
              The AI assistant uses the <strong>"Three Pillars"</strong> approach to generate a professionally-written 
              <strong> {statementTypeLabels[statementType]}</strong> that follows VA formatting guidelines. 
              You can edit the result before downloading.
            </p>
          </div>

          {/* Three Pillars explanation - only show if available */}
          {disclosure.pillars && (
            <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-4">
              <h3 className="font-semibold text-purple-800 dark:text-purple-200 mb-3 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                </svg>
                The Three Pillars of Your Statement
              </h3>
              <div className="space-y-3">
                {disclosure.pillars.map((pillar, index) => (
                  <div key={index} className="flex items-start gap-3">
                    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-purple-600 text-white text-sm font-bold flex items-center justify-center">
                      {index + 1}
                    </span>
                    <div>
                      <p className="font-medium text-purple-900 dark:text-purple-100">{pillar.name}</p>
                      <p className="text-xs text-purple-700 dark:text-purple-300">{pillar.description}</p>
                      <p className="text-xs text-purple-500 dark:text-purple-400 italic mt-0.5">{pillar.example}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Data that WILL be shared */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <h3 className="font-semibold text-amber-800 dark:text-amber-200 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
              </svg>
              Information That Will Be Sent to Google
            </h3>
            <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-1">
              {disclosure.dataShared.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-amber-500 mt-0.5">•</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Data that will NOT be shared */}
          <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
            <h3 className="font-semibold text-green-800 dark:text-green-200 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
              Information That Will NOT Be Sent
            </h3>
            <ul className="text-sm text-green-700 dark:text-green-300 space-y-1">
              {disclosure.notShared.map((item, index) => (
                <li key={index} className="flex items-start gap-2">
                  <span className="text-green-500 mt-0.5">✓</span>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          {/* Privacy note */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-2 flex items-center gap-2">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              Privacy Information
            </h3>
            <ul className="text-sm text-blue-700 dark:text-blue-300 space-y-1">
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                Provider: <strong>{disclosure.provider}</strong> (Google's AI service)
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                Google's free API tier does not use your prompts to train their models
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                This feature is optional - you can always use the standard template instead
              </li>
              <li className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                See our <a href="/docs/privacy/ai-assistant/" className="underline hover:text-blue-600 dark:hover:text-blue-400">AI Privacy Policy</a> for full details
              </li>
            </ul>
          </div>

          {/* Alternative option */}
          <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
            Don't want to use AI? No problem! Click "No Thanks" to use the standard template that processes everything locally on your device.
          </p>
        </div>

        {/* Footer with buttons */}
        <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-xl border-t dark:border-gray-700 flex flex-col sm:flex-row gap-3 sm:justify-end">
          <button
            onClick={onCancel}
            className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors order-2 sm:order-1"
          >
            No Thanks, Use Standard Template
          </button>
          <button
            onClick={onConsent}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-colors flex items-center justify-center gap-2 order-1 sm:order-2"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            I Understand, Enhance with AI
          </button>
        </div>
      </div>
    </div>
  );
};

export default AIConsentModal;
