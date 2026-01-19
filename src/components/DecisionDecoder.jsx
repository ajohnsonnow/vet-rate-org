import React, { useState, useEffect } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { decodeDecision, isAIAvailable } from '../utils/aiStatementHelper';
import { getAIStatus, AI_MODES } from '../utils/unifiedAIService';
import { AIStatusBadge, AIModeSelector } from './AIModeSelector';

/**
 * DecisionDecoder Component - "The Denial Translator"
 * 
 * WHY: VA denial letters are written in legalese. A veteran reads:
 * "The evidence does not establish a nexus between your current condition 
 * and your service-connected disability."
 * And thinks: "WTF does that mean?"
 * 
 * THIS TOOL: Translates it into:
 * - PLAIN ENGLISH: "They're saying your doctor didn't explicitly say 'X caused Y.'"
 * - MISSING ELEMENT: "A Nexus Letter from a doctor."
 * - ACTION PLAN: "Get a Nexus Letter from a private physician, or request an Independent Medical Opinion."
 */

const DecisionDecoder = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [denialText, setDenialText] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());
  
  // Monitor AI status changes
  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const handleDecode = async () => {
    if (!denialText.trim()) {
      setError('Please paste your denial letter or decision text first.');
      return;
    }

    if (denialText.trim().length < 50) {
      setError('The text seems too short. Please paste more of the denial letter.');
      return;
    }

    if (!isAIAvailable()) {
      setError('AI features are not available. Please add your Gemini API key in Settings to use the Decision Decoder.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await decodeDecision(denialText);
      
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.error || 'Failed to decode decision. Please try again.');
      }
    } catch (err) {
      console.error('Decode error:', err);
      setError('An error occurred during decoding. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getDecisionTypeColor = (type) => {
    switch (type?.toLowerCase()) {
      case 'full denial':
        return 'bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 border-red-200 dark:border-red-700';
      case 'partial denial':
        return 'bg-orange-100 dark:bg-orange-900/50 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-700';
      case 'reduction':
        return 'bg-yellow-100 dark:bg-yellow-900/50 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
      case 'deferred':
        return 'bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-700';
      case 'granted':
        return 'bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300 border-green-200 dark:border-green-700';
      default:
        return 'bg-gray-100 dark:bg-gray-900/50 text-gray-700 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    }
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="decoder-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-rose-600 via-red-600 to-rose-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🔓</span>
                </div>
                <div>
                  <h2 id="decoder-title" className="text-2xl sm:text-3xl font-bold flex items-center gap-2">
                    Decision Decoder
                    <span className="inline-block px-2 py-0.5 bg-white/20 backdrop-blur text-white text-xs font-bold rounded-full">AI</span>
                  </h2>
                  <p className="text-rose-100 text-sm sm:text-base mt-1">
                    The Denial Translator • VA Legalese → Plain English
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Decision Decoder" />}
                <button
                  onClick={onClose}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label="Close"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content */}
          <div className="p-6">
            {/* AI Mode Section */}
            <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <AIStatusBadge showLabel={true} />
                  <span className="text-sm text-gray-600 dark:text-gray-400">
                    {aiStatus.effectiveMode === AI_MODES.LOCAL 
                      ? '🔒 100% Private - runs on your device'
                      : '☁️ Cloud AI - fast & powerful'}
                  </span>
                </div>
                <button
                  onClick={() => setShowAISettings(!showAISettings)}
                  className="text-sm text-rose-600 dark:text-rose-400 hover:text-rose-800 dark:hover:text-rose-200"
                >
                  {showAISettings ? 'Hide Settings' : 'AI Settings'}
                </button>
              </div>
              
              {showAISettings && (
                <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                  <AIModeSelector 
                    onModeChange={() => setAIStatus(getAIStatus())}
                  />
                </div>
              )}
            </div>
            
            {/* Info Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">📬</span>
                <div>
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">Got a Confusing VA Letter?</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    VA decisions are written in complex legal language. Paste the key paragraphs below 
                    and we'll translate what they're <em>actually</em> saying, what's missing from your claim, 
                    and exactly what you need to do next.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📄 Paste Your VA Decision Letter
                </label>
                <textarea
                  value={denialText}
                  onChange={(e) => setDenialText(e.target.value)}
                  placeholder={`Paste the relevant paragraphs from your VA decision letter here...

Example: "The evidence does not establish a nexus between your current lumbar spine condition and your service-connected right knee disability. While the medical evidence shows a current diagnosis of lumbar degenerative disc disease, there is no competent medical evidence linking this condition to your service or to your service-connected disabilities."`}
                  rows={14}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500 focus:border-transparent resize-none font-mono text-sm"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {denialText.length} characters
                  </span>
                  <button
                    onClick={() => setDenialText('')}
                    className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    Clear
                  </button>
                </div>

                <button
                  onClick={handleDecode}
                  disabled={isLoading || !denialText.trim()}
                  className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-amber-500 to-orange-500 text-white rounded-lg font-bold text-lg hover:from-amber-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span>Decoding...</span>
                    </>
                  ) : (
                    <>
                      <span>🔓</span>
                      <span>Decode This Decision</span>
                    </>
                  )}
                </button>

                {/* Privacy Note */}
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                  🔒 Your decision letter is processed securely and never stored on our servers.
                </p>
              </div>

              {/* Results Section */}
              <div>
                {error && (
                  <div className="p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg mb-4">
                    <div className="flex items-center gap-2">
                      <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span className="text-red-700 dark:text-red-300">{error}</span>
                    </div>
                  </div>
                )}

                {results && (
                  <div className="space-y-4">
                    {/* Decision Type Badge */}
                    {results.decision_type && (
                      <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-semibold text-sm border ${getDecisionTypeColor(results.decision_type)}`}>
                        {results.decision_type === 'Full Denial' && '❌'}
                        {results.decision_type === 'Partial Denial' && '⚠️'}
                        {results.decision_type === 'Reduction' && '📉'}
                        {results.decision_type === 'Deferred' && '⏳'}
                        {results.decision_type === 'Granted' && '✅'}
                        {results.decision_type}
                      </div>
                    )}

                    {/* Plain English Translation */}
                    {results.plain_english && (
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                          <span>💬</span> In Plain English
                        </h4>
                        <p className="text-blue-700 dark:text-blue-300">
                          {results.plain_english}
                        </p>
                      </div>
                    )}

                    {/* VA's Reasoning */}
                    {results.va_reasoning && (
                      <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2 mb-2">
                          <span>🏛️</span> Why the VA Made This Decision
                        </h4>
                        <p className="text-sm text-gray-700 dark:text-gray-300">
                          {results.va_reasoning}
                        </p>
                      </div>
                    )}

                    {/* Missing Elements */}
                    {results.missing_elements && results.missing_elements.length > 0 && (
                      <div className="bg-red-50 dark:bg-red-900/20 rounded-xl p-4 border border-red-200 dark:border-red-700">
                        <h4 className="font-semibold text-red-800 dark:text-red-200 flex items-center gap-2 mb-3">
                          <span>🚨</span> What's Missing From Your Claim
                        </h4>
                        <ul className="space-y-2">
                          {results.missing_elements.map((element, index) => (
                            <li key={index} className="flex items-start gap-2">
                              <span className="text-red-500 mt-0.5">•</span>
                              <span className="text-sm text-red-700 dark:text-red-300">{element}</span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}

                    {/* Action Plan */}
                    {results.action_plan && results.action_plan.length > 0 && (
                      <div className="bg-green-50 dark:bg-green-900/20 rounded-xl p-4 border border-green-200 dark:border-green-700">
                        <h4 className="font-semibold text-green-800 dark:text-green-200 flex items-center gap-2 mb-3">
                          <span>✅</span> Your Action Plan
                        </h4>
                        <ol className="space-y-3">
                          {results.action_plan.map((step, index) => (
                            <li key={index} className="flex items-start gap-3">
                              <span className="flex-shrink-0 w-6 h-6 bg-green-600 text-white rounded-full flex items-center justify-center text-sm font-bold">
                                {index + 1}
                              </span>
                              <span className="text-sm text-green-700 dark:text-green-300">{step}</span>
                            </li>
                          ))}
                        </ol>
                      </div>
                    )}

                    {/* Appeal Options */}
                    {results.appeal_options && (
                      <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4 border border-purple-200 dark:border-purple-700">
                        <h4 className="font-semibold text-purple-800 dark:text-purple-200 flex items-center gap-2 mb-3">
                          <span>⚖️</span> Appeal Options
                        </h4>
                        <div className="space-y-2 text-sm text-purple-700 dark:text-purple-300">
                          {typeof results.appeal_options === 'string' ? (
                            <p>{results.appeal_options}</p>
                          ) : (
                            results.appeal_options.map((option, index) => (
                              <div key={index} className="p-2 bg-white dark:bg-gray-800 rounded-lg">
                                {option}
                              </div>
                            ))
                          )}
                        </div>
                      </div>
                    )}

                    {/* Deadline Warning */}
                    {results.deadline_warning && (
                      <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-xl p-4 border-2 border-yellow-400 dark:border-yellow-600">
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">⏰</span>
                          <div>
                            <h4 className="font-bold text-yellow-800 dark:text-yellow-200">
                              Important Deadline
                            </h4>
                            <p className="text-sm text-yellow-700 dark:text-yellow-300">
                              {results.deadline_warning}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {!results && !isLoading && !error && (
                  <div className="h-full flex items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                    <div>
                      <div className="text-6xl mb-4">🔓</div>
                      <p className="text-lg font-medium">Ready to Decode</p>
                      <p className="text-sm mt-2">
                        Paste your VA decision letter and click "Decode" to translate
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Common Denial Reasons Reference */}
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span>📚</span> Common VA Denial Language
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"No nexus established"</p>
                  <p className="text-gray-600 dark:text-gray-400">= They need a doctor's letter connecting your condition to service</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"Not incurred in service"</p>
                  <p className="text-gray-600 dark:text-gray-400">= They didn't find evidence in your service records</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"No current disability"</p>
                  <p className="text-gray-600 dark:text-gray-400">= Need a current diagnosis from a doctor</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 font-medium mb-1">"Not at least as likely as not"</p>
                  <p className="text-gray-600 dark:text-gray-400">= The examiner said less than 50% chance of connection</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <BuyMeCoffee show={results !== null} trigger="decision-decoder" />
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DecisionDecoder;
