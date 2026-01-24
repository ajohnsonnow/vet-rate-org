/**
 * DBQ Finder - Disability Benefits Questionnaire Search
 * 
 * Helps veterans find the specific VA medical form (DBQ) for their condition.
 * DBQs are standardized forms that allow private doctors to document symptoms
 * in a format the VA understands, often eliminating the need for C&P exams.
 * 
 * Features:
 * - Search by condition name (e.g., "Sleep Apnea", "PTSD", "Knee")
 * - Filters for 21-0960 prefix (DBQ form numbers)
 * - Direct PDF download from official VA servers
 * - Common condition shortcuts for quick access
 * 
 * @see https://developer.va.gov/explore/forms/docs/va_forms
 */

import React, { useState, useCallback, useEffect } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  Search, 
  FileText, 
  Download, 
  ExternalLink, 
  Loader2, 
  AlertCircle,
  CheckCircle,
  Info,
  Sparkles,
  BookOpen,
  X,
  ChevronDown,
  ChevronUp,
  FileSearch,
  Lightbulb,
} from 'lucide-react';
import { searchForms, formatForms } from '../api/vaSandbox';

// Common DBQ categories for quick access - translation keys
const DBQ_CATEGORIES = [
  { 
    labelKey: 'catMentalHealth', 
    queries: ['PTSD', 'Mental Disorders', 'Eating Disorders', 'TBI'],
    icon: '🧠',
    descKey: 'catMentalHealthDesc'
  },
  { 
    labelKey: 'catMusculoskeletal', 
    queries: ['Knee', 'Back', 'Shoulder', 'Neck', 'Hip', 'Ankle', 'Wrist'],
    icon: '🦴',
    descKey: 'catMusculoskeletalDesc'
  },
  { 
    labelKey: 'catRespiratory', 
    queries: ['Sleep Apnea', 'Respiratory', 'Sinusitis', 'Rhinitis'],
    icon: '🫁',
    descKey: 'catRespiratoryDesc'
  },
  { 
    labelKey: 'catCardiovascular', 
    queries: ['Heart', 'Hypertension', 'Artery'],
    icon: '❤️',
    descKey: 'catCardiovascularDesc'
  },
  { 
    labelKey: 'catNeurological', 
    queries: ['Headaches', 'Migraine', 'Peripheral Nerves', 'Seizures'],
    icon: '⚡',
    descKey: 'catNeurologicalDesc'
  },
  { 
    labelKey: 'catDigestive', 
    queries: ['GERD', 'Intestinal', 'Liver', 'Stomach'],
    icon: '🩺',
    descKey: 'catDigestiveDesc'
  },
  { 
    labelKey: 'catSkin', 
    queries: ['Skin Diseases', 'Scars', 'Burns'],
    icon: '🩹',
    descKey: 'catSkinDesc'
  },
  { 
    labelKey: 'catHearingVision', 
    queries: ['Hearing Loss', 'Tinnitus', 'Eye', 'Vision'],
    icon: '👁️',
    descKey: 'catHearingVisionDesc'
  },
];

// Form number prefixes that indicate DBQs
const DBQ_PREFIXES = ['21-0960'];

const DbqFinder = ({ onClose }) => {
  const { t } = useLanguage();
  
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [expandedCategory, setExpandedCategory] = useState(null);
  const [recentSearches, setRecentSearches] = useState([]);
  const [showInfo, setShowInfo] = useState(true);

  // Load recent searches from localStorage
  useEffect(() => {
    const saved = localStorage.getItem('vet-rate-dbq-recent-searches');
    if (saved) {
      try {
        setRecentSearches(JSON.parse(saved));
      } catch (e) {
        console.warn('Failed to load recent searches');
      }
    }
  }, []);

  // Save recent search
  const saveRecentSearch = (query) => {
    const updated = [query, ...recentSearches.filter(s => s !== query)].slice(0, 5);
    setRecentSearches(updated);
    localStorage.setItem('vet-rate-dbq-recent-searches', JSON.stringify(updated));
  };

  // Filter results to prioritize DBQ forms
  const filterDbqForms = (forms) => {
    return forms.filter(form => {
      const formNumber = form.name?.toUpperCase() || '';
      const title = form.title?.toLowerCase() || '';
      
      // Check if it's a DBQ (21-0960 prefix) or contains "questionnaire"
      const isDbq = DBQ_PREFIXES.some(prefix => formNumber.startsWith(prefix));
      const isQuestionnaire = title.includes('questionnaire') || title.includes('dbq');
      
      return isDbq || isQuestionnaire;
    });
  };

  // Sort results: DBQs first, then by relevance
  const sortResults = (forms) => {
    return forms.sort((a, b) => {
      const aIsDbq = DBQ_PREFIXES.some(prefix => a.name?.startsWith(prefix));
      const bIsDbq = DBQ_PREFIXES.some(prefix => b.name?.startsWith(prefix));
      
      if (aIsDbq && !bIsDbq) return -1;
      if (!aIsDbq && bIsDbq) return 1;
      return 0;
    });
  };

  // Search for DBQ forms
  const handleSearch = useCallback(async (query) => {
    if (!query || query.length < 2) {
      setError(t('dbqFinder', 'minCharsError'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults([]);

    try {
      const response = await searchForms(query);
      const formatted = formatForms(response);
      
      // Filter for DBQs and questionnaires
      const dbqForms = filterDbqForms(formatted);
      const sorted = sortResults(dbqForms);
      
      setResults(sorted);
      saveRecentSearch(query);
      
      if (sorted.length === 0) {
        setError(t('dbqFinder', 'noResultsError').replace('{query}', query));
      }
    } catch (err) {
      console.error('[DBQ Finder] Search error:', err);
      setError(err.message || t('dbqFinder', 'searchError'));
    } finally {
      setIsLoading(false);
    }
  }, [recentSearches]);

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    handleSearch(searchQuery);
  };

  // Quick search from category
  const handleCategorySearch = (query) => {
    setSearchQuery(query);
    handleSearch(query);
  };

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="bg-gradient-to-r from-teal-600 via-emerald-600 to-teal-600 text-white p-6 relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white/80 hover:text-white hover:bg-white/20 rounded-full p-2 transition-colors"
            aria-label="Close"
          >
            <X className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-3 mb-2">
            <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
              <FileSearch className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-bold">{t('dbqFinder', 'title')} <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">{t('common', 'beta')}</span></h2>
              <p className="text-teal-100 text-sm">
                {t('dbqFinder', 'subtitle')}
              </p>
            </div>
          </div>
        </div>

        {/* Content - Scrollable */}
        <div className="flex-1 overflow-y-auto p-6">
          {/* Info Banner */}
          {showInfo && (
            <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4 mb-6">
              <div className="flex items-start gap-3">
                <Lightbulb className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-1">{t('dbqFinder', 'whatIsDbq')}</h3>
                  <p className="text-sm text-amber-700 dark:text-amber-300" dangerouslySetInnerHTML={{ __html: t('dbqFinder', 'dbqDescription') }} />
                </div>
                <button 
                  onClick={() => setShowInfo(false)}
                  className="text-amber-600 dark:text-amber-400 hover:text-amber-800 dark:hover:text-amber-200"
                  aria-label={t('common', 'close')}
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Search Form */}
          <form onSubmit={handleSubmit} className="mb-6">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={t('dbqFinder', 'searchPlaceholder')}
                className="w-full pl-12 pr-24 py-4 text-lg rounded-xl border-2 border-gray-200 dark:border-gray-600 dark:bg-gray-700 dark:text-white focus:border-teal-500 dark:focus:border-teal-400 focus:outline-none transition-colors"
              />
              <button
                type="submit"
                disabled={isLoading || searchQuery.length < 2}
                className="absolute right-2 top-1/2 -translate-y-1/2 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors flex items-center gap-2"
              >
                {isLoading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Search className="w-4 h-4" />
                )}
                {t('common', 'search')}
              </button>
            </div>
          </form>

          {/* Recent Searches */}
          {recentSearches.length > 0 && !results.length && !isLoading && (
            <div className="mb-6">
              <h3 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-2">{t('dbqFinder', 'recentSearches')}</h3>
              <div className="flex flex-wrap gap-2">
                {recentSearches.map((search, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleCategorySearch(search)}
                    className="px-3 py-1 bg-gray-100 dark:bg-gray-700 rounded-full text-sm text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors"
                  >
                    {search}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Error Message */}
          {error && (
            <div className="bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-6 flex items-start gap-3">
              <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
              <p className="text-red-700 dark:text-red-300">{error}</p>
            </div>
          )}

          {/* Search Results */}
          {results.length > 0 && (
            <div className="mb-6">
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <CheckCircle className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                {t('dbqFinder', 'foundForms').replace('{count}', results.length).replace('{s}', results.length !== 1 ? 's' : '')}
              </h3>
              <div className="space-y-3">
                {results.map((form, idx) => (
                  <div
                    key={form.id || idx}
                    className="border-2 border-gray-100 dark:border-gray-700 rounded-xl p-4 hover:border-teal-200 dark:hover:border-teal-700 transition-colors bg-white dark:bg-gray-800"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="px-2 py-0.5 bg-teal-100 dark:bg-teal-900 text-teal-700 dark:text-teal-300 text-xs font-bold rounded">
                            {form.name}
                          </span>
                          {form.name?.startsWith('21-0960') && (
                            <span className="px-2 py-0.5 bg-green-100 dark:bg-green-900 text-green-700 dark:text-green-300 text-xs font-medium rounded flex items-center gap-1">
                              <Sparkles className="w-3 h-3" />
                              {t('dbqFinder', 'officialDbq')}
                            </span>
                          )}
                        </div>
                        <h4 className="font-semibold text-gray-900 dark:text-white mb-1">
                          {form.title}
                        </h4>
                        {form.lastRevision && (
                          <p className="text-xs text-gray-500 dark:text-gray-400">
                            {t('dbqFinder', 'lastUpdated')}: {form.lastRevision} • {form.pages} {t('dbqFinder', 'pages')}{form.pages !== 1 ? '' : ''}
                          </p>
                        )}
                      </div>
                      <div className="flex flex-col gap-2">
                        {form.url && (
                          <a
                            href={form.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-teal-600 text-white rounded-lg font-medium hover:bg-teal-700 transition-colors"
                          >
                            <Download className="w-4 h-4" />
                            {t('dbqFinder', 'downloadPdf')}
                          </a>
                        )}
                        {form.formToolUrl && (
                          <a
                            href={form.formToolUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 px-4 py-2 bg-blue-100 dark:bg-blue-900 text-blue-700 dark:text-blue-300 rounded-lg font-medium hover:bg-blue-200 dark:hover:bg-blue-800 transition-colors text-sm"
                          >
                            <ExternalLink className="w-4 h-4" />
                            {t('dbqFinder', 'onlineTool')}
                          </a>
                        )}
                      </div>
                    </div>
                    {form.formUsage && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mt-2 border-t border-gray-100 dark:border-gray-700 pt-2">
                        {form.formUsage}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Category Browser */}
          {!isLoading && results.length === 0 && (
            <div>
              <h3 className="text-lg font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                <BookOpen className="w-5 h-5 text-teal-600 dark:text-teal-400" />
                {t('dbqFinder', 'browseByCategory')}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {DBQ_CATEGORIES.map((category, idx) => (
                  <div 
                    key={idx}
                    className="border-2 border-gray-100 dark:border-gray-700 rounded-xl overflow-hidden"
                  >
                    <button
                      onClick={() => setExpandedCategory(expandedCategory === idx ? null : idx)}
                      className="w-full p-4 flex items-center justify-between bg-gray-50 dark:bg-gray-700 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
                    >
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{category.icon}</span>
                        <div className="text-left">
                          <h4 className="font-semibold text-gray-900 dark:text-white">{t('dbqFinder', category.labelKey)}</h4>
                          <p className="text-xs text-gray-500 dark:text-gray-400">{t('dbqFinder', category.descKey)}</p>
                        </div>
                      </div>
                      {expandedCategory === idx ? (
                        <ChevronUp className="w-5 h-5 text-gray-400" />
                      ) : (
                        <ChevronDown className="w-5 h-5 text-gray-400" />
                      )}
                    </button>
                    {expandedCategory === idx && (
                      <div className="p-3 bg-white dark:bg-gray-800 border-t border-gray-100 dark:border-gray-700">
                        <div className="flex flex-wrap gap-2">
                          {category.queries.map((query, qIdx) => (
                            <button
                              key={qIdx}
                              onClick={() => handleCategorySearch(query)}
                              className="px-3 py-1.5 bg-teal-50 dark:bg-teal-900/30 text-teal-700 dark:text-teal-300 rounded-lg text-sm font-medium hover:bg-teal-100 dark:hover:bg-teal-900/50 transition-colors"
                            >
                              {query}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-gray-200 dark:border-gray-700 p-4 bg-gray-50 dark:bg-gray-900">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400">
              <Info className="w-4 h-4" />
              <span>{t('dbqFinder', 'footerNote')}</span>
            </div>
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
            >
              {t('common', 'close')}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DbqFinder;
