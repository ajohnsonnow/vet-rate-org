import React, { useState } from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import ReportBugLink from './ReportBugLink';
import BuyMeCoffee from './BuyMeCoffee';
import { FocusToggle } from '../contexts/FocusModeContext';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { searchVSOs } from '../utils/aiStatementHelper';
import { generateAI, isAnyAIAvailable } from '../utils/unifiedAIService';
import { AIStatusBadge } from './AIModeSelector';
import VoiceInputButton from './VoiceInput';

/**
 * VSOFinder Component
 * "The Honest Broker" - Helps veterans find free, accredited representation
 * 
 * This tool proves SupplyLocker.org isn't a "Claim Shark" by connecting
 * veterans with free, legitimate help from:
 * - County Veterans Service Officers (CVSOs)
 * - State VA Offices
 * - National VSOs (DAV, VFW, American Legion, etc.)
 */

const VSOFinder = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();
  useBodyScrollLock(true);
  
  const [zipCode, setZipCode] = useState('');
  const [results, setResults] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(null);
  const [showAISettings, setShowAISettings] = useState(false);
  const [aiQuestion, setAIQuestion] = useState('');
  const [aiResponse, setAIResponse] = useState(null);
  const [isAIThinking, setIsAIThinking] = useState(false);

  const handleZipCodeChange = (e) => {
    // Only allow numbers and limit to 5 digits
    const value = e.target.value.replace(/\D/g, '').slice(0, 5);
    setZipCode(value);
    setError(null);
  };

  const handleOfficialSearch = () => {
    // Open VA's official accreditation search
    window.open('https://www.va.gov/ogc/apps/accreditation/index.asp', '_blank', 'noopener,noreferrer');
  };

  const handleAISearch = async () => {
    if (zipCode.length !== 5) {
      setError(t('vsoFinder', 'invalidZipCode'));
      return;
    }

    if (!isAnyAIAvailable()) {
      setError(t('vsoFinder', 'aiNotAvailable'));
      return;
    }

    setIsLoading(true);
    setError(null);
    setResults(null);

    try {
      const response = await searchVSOs(zipCode);
      
      if (response.success) {
        setResults(response.data);
      } else {
        setError(response.error || t('vsoFinder', 'searchFailed'));
      }
    } catch (err) {
      console.error('VSO search error:', err);
      setError(t('vsoFinder', 'errorOccurred'));
    } finally {
      setIsLoading(false);
    }
  };

  const handleAIQuestion = async () => {
    if (!aiQuestion.trim()) return;
    
    if (!isAnyAIAvailable()) {
      setError(t('vsoFinder', 'aiRequiresKey'));
      return;
    }

    setIsAIThinking(true);
    setAIResponse(null);

    try {
      const prompt = `You are a knowledgeable Veterans Service Officer (VSO) advisor helping veterans understand their representation options.

Veteran's Question: "${aiQuestion}"

Provide a clear, helpful answer about:
- What VSOs do and how they help veterans
- The difference between County VSOs, State VA offices, and National VSOs (DAV, VFW, etc.)
- How to choose the right type of representation
- What to expect from VSO services
- How to verify accreditation
- Red flags for "claim sharks" (anyone charging fees for initial claims)

Be encouraging, informative, and emphasize that legitimate VSO help is FREE.`;

      const response = await generateAI(prompt);
      
      // generateAI returns { text, mode } object - extract the text content
      const aiText = response?.text || response;
      if (aiText) {
        setAIResponse(typeof aiText === 'string' ? aiText : JSON.stringify(aiText));
      } else {
        setError(t('vsoFinder', 'failedAIResponse'));
      }
    } catch (err) {
      console.error('AI consultation error:', err);
      setError(t('vsoFinder', 'aiConsultationError'));
    } finally {
      setIsAIThinking(false);
    }
  };

  // Get organization type label
  const getOrgTypeLabel = (type) => {
    switch (type) {
      case 'County VSO':
        return t('vsoFinder', 'countyVSO');
      case 'State VA Office':
        return t('vsoFinder', 'stateVAOffice');
      case 'National Organization':
        return t('vsoFinder', 'nationalOrganization');
      default:
        return type;
    }
  };

  const renderOrganizationCard = (org, index) => {
    const typeColors = {
      'County VSO': 'from-blue-500 to-indigo-600',
      'State VA Office': 'from-purple-500 to-violet-600',
      'National Organization': 'from-green-500 to-emerald-600'
    };

    const bgColors = {
      'County VSO': 'bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700',
      'State VA Office': 'bg-purple-50 dark:bg-purple-900/30 border-purple-200 dark:border-purple-700',
      'National Organization': 'bg-green-50 dark:bg-green-900/30 border-green-200 dark:border-green-700'
    };

    const gradientClass = typeColors[org.type] || 'from-gray-500 to-slate-600';
    const bgClass = bgColors[org.type] || 'bg-gray-50 dark:bg-gray-900/30 border-gray-200 dark:border-gray-700';

    return (
      <div 
        key={index}
        className={`${bgClass} border rounded-xl p-4 transition-all hover:shadow-lg`}
      >
        <div className="flex items-start gap-3">
          <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${gradientClass} flex items-center justify-center text-white shadow-sm flex-shrink-0`}>
            {org.type === 'County VSO' && '🏛️'}
            {org.type === 'State VA Office' && '🏢'}
            {org.type === 'National Organization' && '🎖️'}
            {!org.type && '📍'}
          </div>
          <div className="flex-1 min-w-0">
            <h4 className="font-semibold text-gray-900 dark:text-white">
              {org.name}
            </h4>
            <span className="inline-block px-2 py-0.5 bg-gray-200 dark:bg-gray-700 text-xs text-gray-600 dark:text-gray-300 rounded-full mt-1">
              {getOrgTypeLabel(org.type)}
            </span>
            
            {org.address && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-2">
                📍 {org.address}
              </p>
            )}
            
            {org.phone && (
              <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                📞 <a href={`tel:${org.phone.replace(/\D/g, '')}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                  {org.phone}
                </a>
              </p>
            )}
            
            {org.website && (
              <p className="text-sm mt-1">
                🌐 <a 
                  href={org.website} 
                  target="_blank" 
                  rel="noopener noreferrer" 
                  className="text-blue-600 dark:text-blue-400 hover:underline break-all"
                >
                  {t('vsoFinder', 'visitWebsite')}
                </a>
              </p>
            )}
            
            {org.notes && (
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-2 italic">
                💡 {org.notes}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 z-50 overflow-y-auto modal-backdrop overscroll-contain"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vso-finder-title"
    >
      <div className="min-h-screen px-4 py-8 flex items-start justify-center">
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
          {/* Header - Sticky */}
          <div className="bg-gradient-to-r from-sky-600 via-cyan-600 to-sky-600 text-white px-6 py-6 rounded-t-lg relative overflow-hidden flex-shrink-0">
            {/* Decorative elements */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
            <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/10 rounded-full translate-y-12 -translate-x-12"></div>
            
            <div className="relative flex items-start justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 bg-white/20 backdrop-blur rounded-xl flex items-center justify-center">
                  <span className="text-3xl">🤝</span>
                </div>
                <div>
                  <h2 id="vso-finder-title" className="text-2xl sm:text-3xl font-bold">
                    {t('vsoFinder', 'title')} <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded align-middle">{t('common', 'beta')}</span>
                  </h2>
                  <p className="text-blue-100 text-sm sm:text-base mt-1">
                    {t('vsoFinder', 'subtitle')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AIStatusBadge onClick={() => setShowAISettings(!showAISettings)} />
                {onReportBug && <ReportBugLink onClick={onReportBug} variant="light" moduleName={t('vsoFinder', 'title')} />}
                <button
                  onClick={onClose}
                  className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
                  aria-label={t('vsoFinder', 'close')}
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          {/* Content - Scrollable */}
          <div className="p-6 overflow-y-auto flex-1">
            {/* Critical Warning Banner */}
            <div className="mb-6 p-4 bg-gradient-to-r from-red-50 to-orange-50 dark:from-red-900/30 dark:to-orange-900/30 border-2 border-red-300 dark:border-red-600 rounded-xl">
              <div className="flex items-start gap-3">
                <span className="text-3xl flex-shrink-0">⚠️</span>
                <div>
                  <h3 className="font-bold text-red-800 dark:text-red-200 text-lg">{t('vsoFinder', 'bewareClaimSharks')}</h3>
                  <div className="text-sm text-red-700 dark:text-red-300 mt-2 space-y-2">
                    <p>
                      <strong>🚫 {t('vsoFinder', 'neverPayFees')}</strong>
                    </p>
                    <p>
                      {t('vsoFinder', 'legitimateVSOsFree')}
                    </p>
                    <p className="font-medium">
                      {t('vsoFinder', 'alwaysVerify')}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* Search Form */}
            <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-6 mb-6">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                {t('vsoFinder', 'findAccreditedHelp')}
              </h3>
              
              {/* ZIP Code Input */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
                  {t('vsoFinder', 'yourZipCode')}
                </label>
                <input
                  type="text"
                  value={zipCode}
                  onChange={handleZipCodeChange}
                  placeholder={t('vsoFinder', 'enterZipCode')}
                  className="w-full px-4 py-3 rounded-lg border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500 focus:border-transparent text-lg tracking-wider"
                  maxLength={5}
                />
              </div>

              {/* Search Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Official VA Database Search */}
                <button
                  onClick={handleOfficialSearch}
                  className="px-6 py-4 bg-gradient-to-r from-sky-700 to-cyan-700 text-white rounded-lg font-bold text-base hover:from-sky-800 hover:to-cyan-800 transition-all shadow-lg hover:shadow-xl flex items-center justify-center gap-2"
                >
                  <span>🏛️</span>
                  <span>{t('vsoFinder', 'searchOfficialVA')}</span>
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                </button>

                {/* AI-Powered Local Search */}
                <button
                  onClick={handleAISearch}
                  disabled={isLoading || zipCode.length !== 5}
                  className="px-6 py-4 bg-gradient-to-r from-sky-600 to-cyan-600 text-white rounded-lg font-bold text-base hover:from-sky-700 hover:to-cyan-700 transition-all shadow-lg hover:shadow-xl disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span>{t('vsoFinder', 'searching')}</span>
                    </>
                  ) : (
                    <>
                      <span>✨</span>
                      <span>{t('vsoFinder', 'findLocalVSOsAI')}</span>
                    </>
                  )}
                </button>
              </div>

              <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 text-center">
                {t('vsoFinder', 'officialVADisclaimer')}
              </p>
            </div>

            {/* AI Consultation */}
            <div className="bg-gradient-to-br from-purple-50 to-blue-50 dark:from-purple-900/20 dark:to-blue-900/20 rounded-xl p-6 mb-6 border border-purple-200 dark:border-purple-700">
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl">🤖</span>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  {t('vsoFinder', 'askAIAboutVSO')}
                </h3>
              </div>
              <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                {t('vsoFinder', 'aiConsultationDesc')}
              </p>
              
              <div className="space-y-3">
                <div className="relative">
                  <textarea
                    value={aiQuestion}
                    onChange={(e) => setAIQuestion(e.target.value)}
                    placeholder={t('vsoFinder', 'aiQuestionPlaceholder')}
                    className="w-full px-4 py-3 pr-14 rounded-lg border border-purple-300 dark:border-purple-600 bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-purple-500 resize-none"
                    rows={3}
                  />
                  <div className="absolute right-3 top-3">
                    <VoiceInputButton
                      onTranscript={(text) => setAIQuestion(prev => prev ? `${prev} ${text}` : text)}
                      size="sm"
                    />
                  </div>
                </div>
                <button
                  onClick={handleAIQuestion}
                  disabled={isAIThinking || !aiQuestion.trim()}
                  className="w-full px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  {isAIThinking ? (
                    <>
                      <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
                      </svg>
                      <span>{t('vsoFinder', 'consultingAI')}</span>
                    </>
                  ) : (
                    <>
                      <span>💬</span>
                      <span>{t('vsoFinder', 'getAIAdvice')}</span>
                    </>
                  )}
                </button>

                {aiResponse && (
                  <div className="mt-4 p-4 bg-white dark:bg-gray-800 rounded-lg border border-purple-200 dark:border-purple-700">
                    <div className="flex items-start gap-2 mb-2">
                      <span className="text-xl">💡</span>
                      <h4 className="font-semibold text-gray-900 dark:text-white">{t('vsoFinder', 'aiAdvisorResponse')}</h4>
                    </div>
                    <div className="text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap leading-relaxed">
                      {aiResponse}
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* Error Display */}
            {error && (
              <div className="mb-6 p-4 bg-red-50 dark:bg-red-900/30 border border-red-200 dark:border-red-700 rounded-lg">
                <div className="flex items-center gap-2">
                  <svg className="w-5 h-5 text-red-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span className="text-red-700 dark:text-red-300">{error}</span>
                </div>
              </div>
            )}

            {/* Results Display */}
            {results && (
              <div className="space-y-6">
                {/* Warning Banner from AI */}
                {results.warning && (
                  <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-xl p-4">
                    <div className="flex items-start gap-3">
                      <span className="text-2xl">⚡</span>
                      <p className="text-sm text-amber-800 dark:text-amber-200 font-medium">
                        {results.warning}
                      </p>
                    </div>
                  </div>
                )}

                {/* Local Organizations */}
                {results.organizations && results.organizations.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="text-xl">📍</span>
                      {t('vsoFinder', 'localVSOsNear')} {results.zipCode}
                      <span className="px-2 py-1 bg-blue-100 dark:bg-blue-800 text-blue-700 dark:text-blue-200 text-sm rounded-full">
                        {results.organizations.length} {t('vsoFinder', 'found')}
                      </span>
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      {results.organizations.map((org, index) => renderOrganizationCard(org, index))}
                    </div>
                  </div>
                )}

                {/* National Resources */}
                {results.nationalResources && results.nationalResources.length > 0 && (
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
                      <span className="text-xl">🇺🇸</span>
                      {t('vsoFinder', 'nationalVSOResources')}
                    </h3>
                    
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                      {results.nationalResources.map((resource, index) => (
                        <div 
                          key={index}
                          className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 hover:shadow-md transition-shadow"
                        >
                          <h4 className="font-semibold text-gray-900 dark:text-white mb-2">
                            {resource.name}
                          </h4>
                          {resource.phone && (
                            <p className="text-sm text-gray-600 dark:text-gray-300">
                              📞 <a href={`tel:${resource.phone.replace(/\D/g, '')}`} className="text-blue-600 dark:text-blue-400 hover:underline">
                                {resource.phone}
                              </a>
                            </p>
                          )}
                          {resource.website && (
                            <a 
                              href={resource.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="mt-2 inline-flex items-center gap-1 text-sm text-blue-600 dark:text-blue-400 hover:underline"
                            >
                              {t('vsoFinder', 'findLocalOffice')}
                              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                              </svg>
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Verification Link */}
                <div className="mt-6 p-4 bg-green-50 dark:bg-green-900/30 border border-green-200 dark:border-green-700 rounded-xl">
                  <div className="flex items-center justify-between gap-4 flex-wrap">
                    <div className="flex items-center gap-3">
                      <span className="text-xl">✅</span>
                      <div>
                        <p className="font-medium text-green-800 dark:text-green-200">{t('vsoFinder', 'verifyAccreditation')}</p>
                        <p className="text-sm text-green-600 dark:text-green-300">{t('vsoFinder', 'alwaysConfirmVSO')}</p>
                      </div>
                    </div>
                    <a
                      href={results.verificationLink || 'https://www.va.gov/ogc/apps/accreditation/index.asp'}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
                    >
                      <span>{t('vsoFinder', 'verifyAtVA')}</span>
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                      </svg>
                    </a>
                  </div>
                </div>

                {/* Disclaimer */}
                <div className="mt-4 p-4 bg-gray-100 dark:bg-gray-900 rounded-lg">
                  <p className="text-xs text-gray-500 dark:text-gray-400">
                    <strong>⚠️ {t('vsoFinder', 'disclaimer')}</strong> {t('vsoFinder', 'disclaimerText')}
                  </p>
                </div>
              </div>
            )}

            {/* Loading State */}
            {isLoading && (
              <div className="text-center py-12">
                <div className="relative mb-6 inline-block">
                  <div className="text-6xl animate-pulse">🤝</div>
                  <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-20 h-20 border-4 border-sky-200 dark:border-sky-800 border-t-sky-500 rounded-full animate-spin"></div>
                  </div>
                </div>
                <p className="text-lg font-medium text-sky-700 dark:text-sky-300">
                  {t('vsoFinder', 'searchingForVSOs')} {zipCode}...
                </p>
                <p className="text-sm mt-2 text-gray-600 dark:text-gray-400">
                  {t('vsoFinder', 'findingAccredited')}
                </p>
                <div className="mt-4 space-y-2 text-xs text-gray-500 dark:text-gray-500 max-w-xs mx-auto">
                  <p className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">🏛️</span> {t('vsoFinder', 'checkingCountyVSOs')}
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">🏢</span> {t('vsoFinder', 'findingStateVA')}
                  </p>
                  <p className="flex items-center justify-center gap-2">
                    <span className="animate-pulse">🎖️</span> {t('vsoFinder', 'locatingNationalOrgs')}
                  </p>
                </div>
                <p className="text-xs text-sky-600 dark:text-sky-400 mt-4">
                  {t('vsoFinder', 'usuallyTakes')}
                </p>
              </div>
            )}

            {/* No Results State */}
            {!results && !isLoading && !error && (
              <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                <div className="text-6xl mb-4">🔍</div>
                <p className="text-lg">{t('vsoFinder', 'enterZipToFind')}</p>
                <p className="text-sm mt-2">
                  {t('vsoFinder', 'willHelpFind')}
                </p>
              </div>
            )}

            {/* What is a VSO? Info Section */}
            <div className="mt-6 bg-blue-50 dark:bg-blue-900/30 rounded-xl p-5 border border-blue-200 dark:border-blue-700">
              <h3 className="font-semibold text-blue-800 dark:text-blue-200 mb-3 flex items-center gap-2">
                <span>ℹ️</span>
                {t('vsoFinder', 'whatIsVSO')}
              </h3>
              <div className="text-sm text-blue-700 dark:text-blue-300 space-y-2">
                <p>
                  <strong>{t('vsoFinder', 'vsoExplanation')}</strong>
                </p>
                <p>
                  <strong>{t('vsoFinder', 'commonVSOs')}</strong> {t('vsoFinder', 'commonVSOsList')}
                </p>
                <p>
                  <strong>{t('vsoFinder', 'whyUseVSO')}</strong> {t('vsoFinder', 'whyUseVSOText')}
                </p>
              </div>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t dark:border-gray-700 px-6 py-4 bg-gray-50 dark:bg-gray-900 rounded-b-lg">
            <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
              <BuyMeCoffee show={results !== null} trigger="vso-finder" />
              <button
                onClick={onClose}
                className="px-6 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
              >
                {t('vsoFinder', 'close')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default VSOFinder;
