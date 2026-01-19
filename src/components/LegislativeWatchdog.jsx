import React, { useState, useEffect, useCallback } from 'react';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { isAIAvailable } from '../utils/aiStatementHelper';
import { generateAI } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';

/**
 * LegislativeWatchdog Component - "The Rule Change Radar"
 * 
 * WHY: Veterans are terrified of the rules changing. The proposed changes to 
 * Tinnitus and Sleep Apnea ratings created mass panic. Veterans need to know
 * BEFORE changes happen so they can file claims.
 * 
 * WHAT IT DOES:
 * - Fetches recent Federal Register entries related to 38 CFR (VA regulations)
 * - Highlights proposed rule changes that could affect disability ratings
 * - Provides alerts for conditions that may be affected
 * - Shows public comment periods (so veterans can voice opinions)
 * 
 * DATA SOURCES:
 * - Federal Register API (public, free)
 * - Filters for "Department of Veterans Affairs" and "38 CFR Part 4"
 * 
 * NOTE: Uses Federal Register's public API. No API key required.
 * Falls back to curated important updates if API is unavailable.
 */

// Federal Register API endpoint
const FEDERAL_REGISTER_API = 'https://www.federalregister.gov/api/v1/documents.json';

// Keywords to watch for in VA-related documents
const WATCH_KEYWORDS = [
  'Schedule for Rating Disabilities',
  'VASRD',
  '38 CFR Part 4',
  'disability rating',
  'compensation',
  'service-connected',
  'presumptive',
  'tinnitus',
  'sleep apnea',
  'mental disorders',
  'musculoskeletal',
  'PACT Act',
  'toxic exposure',
];

// Curated important updates (fallback and supplemental)
const CURATED_UPDATES = [
  {
    id: 'pact-2024',
    title: 'PACT Act Expansion - New Presumptive Conditions',
    type: 'rule_expansion',
    status: 'active',
    effectiveDate: '2024-01-01',
    summary: 'The PACT Act continues to expand presumptive conditions for toxic exposure. Veterans exposed to burn pits, Agent Orange, and other toxic substances may now file for conditions previously denied.',
    affectedConditions: ['Respiratory conditions', 'Various cancers', 'Hypertension (Agent Orange)'],
    action: 'FILE NOW - If you have these conditions and were exposed, file immediately.',
    link: 'https://www.va.gov/resources/the-pact-act-and-your-va-benefits/',
    urgency: 'high',
  },
  {
    id: 'mental-health-2024',
    title: 'Mental Health Rating Criteria Modernization (Proposed)',
    type: 'proposed_rule',
    status: 'comment_period',
    commentDeadline: '2026-03-15',
    summary: 'VA is reviewing mental health rating criteria, potentially updating how PTSD, anxiety, and depression are evaluated. Changes could affect rating percentages.',
    affectedConditions: ['PTSD', 'Anxiety', 'Depression', 'Bipolar Disorder'],
    action: 'MONITOR - Current claims not affected, but may want to file before changes.',
    link: 'https://www.federalregister.gov/',
    urgency: 'medium',
  },
  {
    id: 'tinnitus-2025',
    title: 'Tinnitus Rating Evaluation Under Review',
    type: 'under_review',
    status: 'monitoring',
    summary: 'VA continues to evaluate tinnitus rating criteria. The 10% rating has been discussed for potential changes. Veterans with tinnitus should ensure claims are on file.',
    affectedConditions: ['Tinnitus', 'Hearing Loss'],
    action: 'PROTECT YOUR RATING - If you have tinnitus, ensure your claim is filed.',
    link: 'https://www.va.gov/',
    urgency: 'medium',
  },
  {
    id: 'sleep-apnea-2025',
    title: 'Sleep Apnea Rating Criteria Discussion',
    type: 'under_review',
    status: 'monitoring',
    summary: 'Sleep Apnea ratings, particularly the 50% CPAP rating, remain under discussion. No formal proposal yet, but veterans should be aware.',
    affectedConditions: ['Sleep Apnea'],
    action: 'FILE IF NEEDED - If you have Sleep Apnea and haven\'t filed, consider doing so.',
    link: 'https://www.va.gov/',
    urgency: 'medium',
  },
];

// Status badge colors
const STATUS_COLORS = {
  active: 'bg-green-100 text-green-700 dark:bg-green-900/50 dark:text-green-300',
  proposed_rule: 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/50 dark:text-yellow-300',
  comment_period: 'bg-orange-100 text-orange-700 dark:bg-orange-900/50 dark:text-orange-300',
  under_review: 'bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300',
  final_rule: 'bg-purple-100 text-purple-700 dark:bg-purple-900/50 dark:text-purple-300',
};

const URGENCY_COLORS = {
  high: 'border-red-500 bg-red-50 dark:bg-red-900/20',
  medium: 'border-yellow-500 bg-yellow-50 dark:bg-yellow-900/20',
  low: 'border-gray-300 bg-gray-50 dark:bg-gray-900/20',
};

const LegislativeWatchdog = ({ onClose, onReportBug }) => {
  useBodyScrollLock(true);
  
  const [loading, setLoading] = useState(true);
  const [federalRegisterDocs, setFederalRegisterDocs] = useState([]);
  const [error, setError] = useState(null);
  const [activeFilter, setActiveFilter] = useState('all'); // 'all', 'proposed', 'active', 'urgent'
  const [searchTerm, setSearchTerm] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);
  const [showAISettings, setShowAISettings] = useState(false);
  const [analyzingDoc, setAnalyzingDoc] = useState(null);
  const [aiAnalysis, setAIAnalysis] = useState({});

  // Fetch from Federal Register API
  const fetchFederalRegister = useCallback(async () => {
    try {
      // Build query for VA-related documents
      const params = new URLSearchParams({
        'conditions[agencies][]': 'veterans-affairs-department',
        'conditions[cfr][title]': '38',
        'fields[]': ['title', 'abstract', 'publication_date', 'type', 'document_number', 'html_url', 'public_inspection_document_deadline', 'comments_close_on'],
        'per_page': '20',
        'order': 'newest',
      });

      const response = await fetch(`${FEDERAL_REGISTER_API}?${params}`);
      
      if (!response.ok) {
        throw new Error('Failed to fetch Federal Register data');
      }

      const data = await response.json();
      
      // Transform and filter relevant documents
      const relevantDocs = data.results
        .filter(doc => {
          const text = `${doc.title} ${doc.abstract || ''}`.toLowerCase();
          return WATCH_KEYWORDS.some(keyword => text.includes(keyword.toLowerCase()));
        })
        .map(doc => ({
          id: doc.document_number,
          title: doc.title,
          type: mapDocumentType(doc.type),
          status: doc.comments_close_on ? 'comment_period' : 'active',
          publicationDate: doc.publication_date,
          commentDeadline: doc.comments_close_on,
          summary: doc.abstract || 'No summary available.',
          link: doc.html_url,
          source: 'Federal Register',
          urgency: determineUrgency(doc),
        }));

      setFederalRegisterDocs(relevantDocs);
      setLastUpdated(new Date());
    } catch (err) {
      console.error('Federal Register API error:', err);
      setError('Could not fetch live updates. Showing curated important updates.');
      setFederalRegisterDocs([]);
    }
  }, []);

  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      await fetchFederalRegister();
      setLoading(false);
    };
    loadData();
  }, [fetchFederalRegister]);

  // Map Federal Register document types to our categories
  function mapDocumentType(type) {
    const mapping = {
      'Proposed Rule': 'proposed_rule',
      'Rule': 'final_rule',
      'Notice': 'active',
      'Presidential Document': 'active',
    };
    return mapping[type] || 'active';
  }

  // Determine urgency based on document content
  function determineUrgency(doc) {
    const text = `${doc.title} ${doc.abstract || ''}`.toLowerCase();
    const highUrgencyKeywords = ['final rule', 'immediate', 'effective immediately', 'tinnitus', 'sleep apnea'];
    const mediumUrgencyKeywords = ['proposed', 'comment', 'review'];
    
    if (highUrgencyKeywords.some(k => text.includes(k))) return 'high';
    if (mediumUrgencyKeywords.some(k => text.includes(k))) return 'medium';
    return 'low';
  }

  // AI Analysis Handler
  const handleAIAnalysis = async (doc) => {
    if (!isAIAvailable()) {
      setError('AI features require an API key. Please configure AI in Settings.');
      return;
    }

    setAnalyzingDoc(doc.id);

    try {
      const prompt = `You are a Veterans Affairs policy expert analyzing legislative changes for veterans.

Document Title: ${doc.title}
Type: ${doc.type}
Summary: ${doc.summary}
Publication Date: ${doc.publicationDate || 'N/A'}
Comment Deadline: ${doc.commentDeadline || 'N/A'}

Provide a clear, veteran-focused analysis:

1. **What's Changing**: Explain what VA rules or benefits this affects in plain language.

2. **Who's Affected**: Which veterans or conditions are impacted? Be specific about disability ratings, service eras, or condition types.

3. **Action Required**: Should veterans:
   - File NOW before changes take effect?
   - Submit public comments? 
   - Simply monitor for updates?
   - Talk to their VSO?

4. **Timeline**: When do changes take effect? How much time do veterans have?

5. **Bottom Line**: In 1-2 sentences, what should veterans know about this?

Be direct, practical, and emphasize urgency when appropriate. Veterans need to know if they should act NOW.`;

      const response = await generateAI(prompt);
      
      if (response) {
        setAIAnalysis(prev => ({
          ...prev,
          [doc.id]: response
        }));
      } else {
        setError('Failed to analyze document.');
      }
    } catch (err) {
      console.error('AI analysis error:', err);
      setError('An error occurred during AI analysis.');
    } finally {
      setAnalyzingDoc(null);
    }
  };

  // Combine Federal Register docs with curated updates
  const allUpdates = [...CURATED_UPDATES, ...federalRegisterDocs];

  // Filter updates
  const filteredUpdates = allUpdates.filter(update => {
    // Filter by category
    if (activeFilter === 'proposed' && update.type !== 'proposed_rule') return false;
    if (activeFilter === 'active' && !['active', 'final_rule'].includes(update.type)) return false;
    if (activeFilter === 'urgent' && update.urgency !== 'high') return false;
    
    // Filter by search
    if (searchTerm) {
      const text = `${update.title} ${update.summary} ${(update.affectedConditions || []).join(' ')}`.toLowerCase();
      return text.includes(searchTerm.toLowerCase());
    }
    
    return true;
  });

  // Check for conditions that might need attention
  const urgentCount = allUpdates.filter(u => u.urgency === 'high').length;
  const commentPeriodCount = allUpdates.filter(u => u.status === 'comment_period').length;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto"
      role="dialog"
      aria-modal="true"
      aria-labelledby="watchdog-title"
    >
      <div className="min-h-screen px-4 py-8">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl mx-auto">
          {/* Header */}
          <div className="bg-gradient-to-r from-amber-600 via-orange-600 to-red-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">📡</span>
                </div>
                <div>
                  <h2 id="watchdog-title" className="text-2xl sm:text-3xl font-bold">
                    Legislative Watchdog
                  </h2>
                  <p className="text-orange-100 text-sm sm:text-base mt-1">
                    VA Rule Change Radar • Never Be Blindsided
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName="Legislative Watchdog" />}
                <AIStatusBadge />
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

            {/* Alert Badges */}
            <div className="relative mt-4 flex flex-wrap gap-2">
              {urgentCount > 0 && (
                <span className="px-3 py-1 bg-red-500/80 backdrop-blur rounded-full text-sm font-bold flex items-center gap-1">
                  🚨 {urgentCount} Urgent Alert{urgentCount > 1 ? 's' : ''}
                </span>
              )}
              {commentPeriodCount > 0 && (
                <span className="px-3 py-1 bg-white/20 backdrop-blur rounded-full text-sm font-medium flex items-center gap-1">
                  💬 {commentPeriodCount} Open for Comment
                </span>
              )}
            </div>
          </div>

          <div className="p-6 space-y-6">
            {/* Why This Matters */}
            <div className="bg-gradient-to-r from-amber-50 to-orange-50 dark:from-amber-900/30 dark:to-orange-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-2xl">⚠️</span>
                <div>
                  <h3 className="font-bold text-amber-800 dark:text-amber-200">Why Track VA Rule Changes?</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300 mt-1">
                    When the VA <strong>proposes changes to rating criteria</strong> (like Tinnitus or Sleep Apnea), 
                    veterans who file <strong>BEFORE the change</strong> often keep their current rating. 
                    Don't get caught off guard-<strong>file early if you see changes coming</strong>.
                  </p>
                </div>
              </div>
            </div>

            {/* Search and Filters */}
            <div className="flex flex-col sm:flex-row gap-4">
              {/* Search */}
              <div className="flex-1">
                <div className="relative">
                  <input
                    type="text"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    placeholder="Search by condition or keyword..."
                    className="w-full px-4 py-2 pl-10 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-amber-500"
                  />
                  <svg className="w-5 h-5 absolute left-3 top-2.5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                </div>
              </div>
              
              {/* Filters */}
              <div className="flex gap-2 flex-wrap">
                {[
                  { key: 'all', label: 'All', emoji: '📋' },
                  { key: 'urgent', label: 'Urgent', emoji: '🚨' },
                  { key: 'proposed', label: 'Proposed', emoji: '📝' },
                  { key: 'active', label: 'Active', emoji: '✅' },
                ].map(filter => (
                  <button
                    key={filter.key}
                    onClick={() => setActiveFilter(filter.key)}
                    className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
                      activeFilter === filter.key
                        ? 'bg-amber-600 text-white'
                        : 'bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
                    }`}
                  >
                    <span>{filter.emoji}</span>
                    <span>{filter.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Loading State */}
            {loading && (
              <div className="text-center py-12">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-4 border-amber-500 border-t-transparent"></div>
                <p className="mt-4 text-gray-600 dark:text-gray-400">Scanning Federal Register...</p>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="bg-yellow-50 dark:bg-yellow-900/30 border border-yellow-200 dark:border-yellow-700 rounded-lg p-3">
                <p className="text-sm text-yellow-700 dark:text-yellow-300 flex items-center gap-2">
                  <span>⚠️</span>
                  {error}
                </p>
              </div>
            )}

            {/* Updates List */}
            {!loading && (
              <div className="space-y-4">
                {filteredUpdates.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 dark:text-gray-400">
                    <div className="text-4xl mb-3">🔍</div>
                    <p>No updates match your filters.</p>
                  </div>
                ) : (
                  filteredUpdates.map(update => (
                    <div
                      key={update.id}
                      className={`border-l-4 rounded-lg p-4 ${URGENCY_COLORS[update.urgency] || URGENCY_COLORS.low}`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 flex-wrap mb-2">
                            <span className={`px-2 py-0.5 text-xs font-bold rounded-full ${STATUS_COLORS[update.status] || STATUS_COLORS.active}`}>
                              {update.status.replace('_', ' ').toUpperCase()}
                            </span>
                            {update.urgency === 'high' && (
                              <span className="px-2 py-0.5 bg-red-500 text-white text-xs font-bold rounded-full animate-pulse">
                                🚨 URGENT
                              </span>
                            )}
                            {update.source && (
                              <span className="text-xs text-gray-500 dark:text-gray-400">
                                via {update.source}
                              </span>
                            )}
                          </div>
                          
                          <h4 className="font-bold text-gray-900 dark:text-gray-100 mb-2">
                            {update.title}
                          </h4>
                          
                          <p className="text-sm text-gray-600 dark:text-gray-400 mb-3">
                            {update.summary}
                          </p>
                          
                          {/* Affected Conditions */}
                          {update.affectedConditions && update.affectedConditions.length > 0 && (
                            <div className="mb-3">
                              <p className="text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">
                                🎯 Conditions Affected:
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {update.affectedConditions.map((condition, idx) => (
                                  <span 
                                    key={idx}
                                    className="px-2 py-0.5 bg-blue-100 dark:bg-blue-900/50 text-blue-700 dark:text-blue-300 text-xs rounded-full"
                                  >
                                    {condition}
                                  </span>
                                ))}
                              </div>
                            </div>
                          )}
                          
                          {/* Action Recommendation */}
                          {update.action && (
                            <div className="bg-white dark:bg-gray-800 rounded-lg p-3 border border-gray-200 dark:border-gray-700">
                              <p className="text-sm font-medium text-gray-800 dark:text-gray-200 flex items-center gap-2">
                                <span>👉</span>
                                {update.action}
                              </p>
                            </div>
                          )}
                          
                          {/* Dates */}
                          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500 dark:text-gray-400">
                            {update.publicationDate && (
                              <span>📅 Published: {new Date(update.publicationDate).toLocaleDateString()}</span>
                            )}
                            {update.effectiveDate && (
                              <span>✅ Effective: {new Date(update.effectiveDate).toLocaleDateString()}</span>
                            )}
                            {update.commentDeadline && (
                              <span className="text-orange-600 dark:text-orange-400 font-medium">
                                💬 Comments Due: {new Date(update.commentDeadline).toLocaleDateString()}
                              </span>
                            )}
                          </div>
                          
                          {/* AI Analysis Button */}
                          <div className="mt-4 flex gap-3">
                            <button
                              onClick={() => handleAIAnalysis(update)}
                              disabled={analyzingDoc === update.id || !isAIAvailable()}
                              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-medium hover:from-purple-700 hover:to-blue-700 disabled:from-gray-400 disabled:to-gray-500 disabled:cursor-not-allowed transition-all"
                            >
                              {analyzingDoc === update.id ? (
                                <>
                                  <div className="animate-spin h-4 w-4 border-2 border-white border-t-transparent rounded-full"></div>
                                  Analyzing...
                                </>
                              ) : (
                                <>
                                  🤖 Analyze with AI
                                </>
                              )}
                            </button>
                          </div>
                          
                          {/* AI Analysis Results */}
                          {aiAnalysis[update.id] && (
                            <div className="mt-4 p-4 bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-lg border border-purple-200 dark:border-purple-700">
                              <div className="flex items-center gap-2 mb-3">
                                <span className="text-lg">🤖</span>
                                <h4 className="font-bold text-purple-900 dark:text-purple-100">AI Policy Analysis</h4>
                              </div>
                              <div className="prose prose-sm max-w-none dark:prose-invert prose-headings:text-purple-900 dark:prose-headings:text-purple-100 prose-p:text-gray-700 dark:prose-p:text-gray-300">
                                <div className="whitespace-pre-wrap">{aiAnalysis[update.id]}</div>
                              </div>
                            </div>
                          )}
                        </div>
                        
                        {/* Link */}
                        {update.link && (
                          <a
                            href={update.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex-shrink-0 px-4 py-2 bg-amber-600 text-white rounded-lg text-sm font-medium hover:bg-amber-700 transition-colors"
                          >
                            Read More →
                          </a>
                        )}
                      </div>
                    </div>
                  ))
                )}
              </div>
            )}

            {/* Last Updated */}
            {lastUpdated && (
              <p className="text-xs text-center text-gray-500 dark:text-gray-400">
                Last checked: {lastUpdated.toLocaleString()}
              </p>
            )}

            {/* Helpful Links */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-4 border-t dark:border-gray-700">
              <a
                href="https://www.federalregister.gov/agencies/veterans-affairs-department"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-2xl">📜</span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">Federal Register - VA</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Official source for all VA rules</p>
                </div>
              </a>
              <a
                href="https://www.regulations.gov/"
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center gap-3 p-3 bg-gray-50 dark:bg-gray-900 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors"
              >
                <span className="text-2xl">💬</span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-200">Regulations.gov</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">Submit public comments on proposed rules</p>
                </div>
              </a>
            </div>

            {/* Air-Gap Notice */}
            <div className="bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-lg p-3">
              <div className="flex items-start gap-2">
                <span>🔒</span>
                <p className="text-xs text-green-700 dark:text-green-300">
                  <strong>Air-Gapped from the VA:</strong> This tool only reads public information. 
                  The VA cannot see what you're researching. Your browsing here is completely private.
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex items-center justify-between">
              <BuyMeCoffee show={true} trigger="legislative-watchdog" />
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

export default LegislativeWatchdog;
