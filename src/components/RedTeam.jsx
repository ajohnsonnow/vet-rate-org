import React, { useState } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { stressTestStatement, isAIAvailable } from '../utils/aiStatementHelper';

/**
 * RedTeam Component - "The Statement Stress Test"
 * 
 * Problem: Veterans are trained to be tough. They write "My back hurts a bit, but I push through."
 * Result: Denial. (The VA reads: "Not severe.")
 * 
 * This AI "Drill Sergeant" reviews their draft and flags "Weak Language"
 * without rewriting it (that would be fake) - just highlights issues and suggests clinical equivalents.
 */

const RedTeam = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [draftStatement, setDraftStatement] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleStressTest = async () => {
    if (!draftStatement.trim()) {
      setError('Please paste your draft statement first.');
      return;
    }

    if (draftStatement.trim().length < 50) {
      setError('Your statement seems too short. Please paste a more complete draft.');
      return;
    }

    if (!isAIAvailable()) {
      setError('AI features are not available. Please add your Gemini API key in Settings to use the Red Team.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await stressTestStatement(draftStatement);
      
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.error || 'Failed to analyze statement. Please try again.');
      }
    } catch (err) {
      console.error('Stress test error:', err);
      setError('An error occurred during analysis. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const getScoreColor = (score) => {
    if (score >= 8) return 'text-green-600 dark:text-green-400';
    if (score >= 6) return 'text-yellow-600 dark:text-yellow-400';
    if (score >= 4) return 'text-orange-600 dark:text-orange-400';
    return 'text-red-600 dark:text-red-400';
  };

  const getScoreEmoji = (score) => {
    if (score >= 8) return '🎯';
    if (score >= 6) return '⚠️';
    if (score >= 4) return '🔶';
    return '🚨';
  };

  const getScoreMessage = (score) => {
    if (score >= 8) return 'Strong Statement!';
    if (score >= 6) return 'Good, But Could Be Stronger';
    if (score >= 4) return 'Needs Significant Work';
    return 'Major Revisions Needed';
  };

  // Highlight weak spots in the original text
  const highlightWeakSpots = () => {
    if (!results?.weak_spots || results.weak_spots.length === 0) {
      return draftStatement;
    }

    let highlightedText = draftStatement;
    
    // Sort by length descending to avoid overlapping replacements
    const sortedSpots = [...results.weak_spots].sort((a, b) => 
      (b.quote?.length || 0) - (a.quote?.length || 0)
    );

    sortedSpots.forEach((spot, index) => {
      if (spot.quote) {
        const escapedQuote = spot.quote.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const regex = new RegExp(escapedQuote, 'gi');
        highlightedText = highlightedText.replace(
          regex, 
          `<mark class="bg-red-200 dark:bg-red-900/50 text-red-800 dark:text-red-200 px-1 rounded cursor-pointer" data-spot="${index}">${spot.quote}</mark>`
        );
      }
    });

    return highlightedText;
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="red-team-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-5xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-red-600 via-red-700 to-orange-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🎖️</span>
                </div>
                <div>
                  <h2 id="red-team-title" className="text-2xl sm:text-3xl font-bold">
                    The Red Team
                  </h2>
                  <p className="text-red-100 text-sm sm:text-base mt-1">
                    Statement Stress Test • Find Weak Language
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Red Team" />}
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
            {/* Warning Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-2xl">🎖️</span>
                <div>
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">Attention, Soldier!</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    You were trained to "push through" and "be tough." <strong>That mindset LOSES claims.</strong> 
                    The VA isn't reading for courage—they're reading for <strong>severity and frequency</strong>. 
                    Let the Red Team find where you're hurting your own case.
                  </p>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Input Section */}
              <div>
                <label className="block text-sm font-semibold text-gray-700 dark:text-gray-300 mb-2">
                  📝 Paste Your Draft Statement
                </label>
                <textarea
                  value={draftStatement}
                  onChange={(e) => setDraftStatement(e.target.value)}
                  placeholder="Paste your Statement in Support of Claim, Personal Statement, or any written testimony here...

Example: 'My back hurts sometimes after standing for a while, but I try to push through it. I've learned to manage the pain by taking breaks.'"
                  rows={12}
                  className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
                />
                <div className="flex items-center justify-between mt-2">
                  <span className="text-xs text-gray-500 dark:text-gray-400">
                    {draftStatement.length} characters
                  </span>
                  <button
                    onClick={() => setDraftStatement('')}
                    className="text-xs text-gray-500 hover:text-red-600 dark:text-gray-400 dark:hover:text-red-400"
                  >
                    Clear
                  </button>
                </div>

                <button
                  onClick={handleStressTest}
                  disabled={isLoading || !draftStatement.trim()}
                  className="w-full mt-4 px-6 py-4 bg-gradient-to-r from-red-600 to-orange-600 text-white rounded-lg font-bold text-lg hover:from-red-700 hover:to-orange-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span>Analyzing...</span>
                    </>
                  ) : (
                    <>
                      <span>🔍</span>
                      <span>Stress Test My Statement</span>
                    </>
                  )}
                </button>
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
                    {/* Score Card */}
                    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 border border-gray-200 dark:border-gray-700">
                      <div className="flex items-center justify-between">
                        <div>
                          <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                            Statement Score
                          </h3>
                          <div className="flex items-center gap-2 mt-1">
                            <span className={`text-4xl font-bold ${getScoreColor(results.score)}`}>
                              {results.score}/10
                            </span>
                            <span className="text-2xl">{getScoreEmoji(results.score)}</span>
                          </div>
                          <p className={`text-sm font-medium ${getScoreColor(results.score)}`}>
                            {getScoreMessage(results.score)}
                          </p>
                        </div>
                        <div className="w-20 h-20 rounded-full border-4 border-gray-200 dark:border-gray-700 flex items-center justify-center">
                          <div 
                            className="w-16 h-16 rounded-full flex items-center justify-center"
                            style={{
                              background: `conic-gradient(${results.score >= 6 ? '#22c55e' : results.score >= 4 ? '#f59e0b' : '#ef4444'} ${results.score * 10}%, #e5e7eb ${results.score * 10}%)`
                            }}
                          >
                            <div className="w-12 h-12 bg-white dark:bg-gray-900 rounded-full flex items-center justify-center">
                              <span className="text-xl font-bold">{results.score}</span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Critique Summary */}
                    {results.critique && (
                      <div className="bg-blue-50 dark:bg-blue-900/30 rounded-xl p-4 border border-blue-200 dark:border-blue-700">
                        <h4 className="font-semibold text-blue-800 dark:text-blue-200 flex items-center gap-2 mb-2">
                          <span>📋</span> Overall Assessment
                        </h4>
                        <p className="text-sm text-blue-700 dark:text-blue-300">
                          {results.critique}
                        </p>
                      </div>
                    )}

                    {/* Weak Spots */}
                    {results.weak_spots && results.weak_spots.length > 0 && (
                      <div className="space-y-3">
                        <h4 className="font-semibold text-gray-800 dark:text-gray-200 flex items-center gap-2">
                          <span>🚨</span> Weak Spots Found ({results.weak_spots.length})
                        </h4>
                        
                        <div className="space-y-3 max-h-80 overflow-y-auto">
                          {results.weak_spots.map((spot, index) => (
                            <div 
                              key={index}
                              className="bg-red-50 dark:bg-red-900/20 rounded-lg p-4 border-l-4 border-red-500"
                            >
                              <div className="flex items-start gap-3">
                                <span className="text-red-500 font-bold text-lg">#{index + 1}</span>
                                <div className="flex-1 min-w-0">
                                  {spot.quote && (
                                    <p className="text-sm font-medium text-red-800 dark:text-red-200 bg-red-100 dark:bg-red-900/50 px-2 py-1 rounded inline-block mb-2">
                                      "{spot.quote}"
                                    </p>
                                  )}
                                  {spot.issue && (
                                    <p className="text-sm text-red-700 dark:text-red-300 mb-2">
                                      <strong>Problem:</strong> {spot.issue}
                                    </p>
                                  )}
                                  {spot.suggestion && (
                                    <div className="bg-green-50 dark:bg-green-900/30 rounded p-2 border border-green-200 dark:border-green-700">
                                      <p className="text-sm text-green-700 dark:text-green-300">
                                        <strong>✅ Try Instead:</strong> {spot.suggestion}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* No Issues Found */}
                    {(!results.weak_spots || results.weak_spots.length === 0) && results.score >= 8 && (
                      <div className="bg-green-50 dark:bg-green-900/30 rounded-xl p-6 border border-green-200 dark:border-green-700 text-center">
                        <span className="text-4xl mb-2 block">🎯</span>
                        <h4 className="font-bold text-green-800 dark:text-green-200 text-lg">
                          Strong Statement!
                        </h4>
                        <p className="text-sm text-green-700 dark:text-green-300 mt-1">
                          Your statement uses appropriate clinical language and clearly describes your limitations.
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Empty State */}
                {!results && !isLoading && !error && (
                  <div className="h-full flex items-center justify-center py-12 text-center text-gray-500 dark:text-gray-400">
                    <div>
                      <div className="text-6xl mb-4">🎖️</div>
                      <p className="text-lg font-medium">Ready for Inspection</p>
                      <p className="text-sm mt-2">
                        Paste your statement and click "Stress Test" to begin analysis
                      </p>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Tips Section */}
            <div className="mt-6 p-4 bg-gray-100 dark:bg-gray-900 rounded-xl">
              <h4 className="font-semibold text-gray-800 dark:text-gray-200 mb-3 flex items-center gap-2">
                <span>💡</span> Common Weak Language to Avoid
              </h4>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 text-sm">
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 line-through">"a little bit"</p>
                  <p className="text-green-600 dark:text-green-400">→ "moderate to severe"</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 line-through">"sometimes"</p>
                  <p className="text-green-600 dark:text-green-400">→ "approximately 3-4 times weekly"</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 line-through">"I manage"</p>
                  <p className="text-green-600 dark:text-green-400">→ "I struggle to cope with"</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 line-through">"push through"</p>
                  <p className="text-green-600 dark:text-green-400">→ "forces me to stop activities"</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 line-through">"hurts"</p>
                  <p className="text-green-600 dark:text-green-400">→ "causes debilitating pain rated 7/10"</p>
                </div>
                <div className="bg-white dark:bg-gray-800 rounded-lg p-3">
                  <p className="text-red-600 dark:text-red-400 line-through">"trouble sleeping"</p>
                  <p className="text-green-600 dark:text-green-400">→ "chronic insomnia, 3-4 hours nightly"</p>
                </div>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <BuyMeCoffee show={results !== null} trigger="red-team" />
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

export default RedTeam;
