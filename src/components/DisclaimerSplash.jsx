import React, { useState, useEffect } from 'react';
import { Shield, Lock, UserCheck, Sparkles, ExternalLink } from 'lucide-react';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { useColorSchemas } from '../hooks/useColorSchemas';
import { PROJECT_STATS } from '../data/projectStats';
import { getTotalToolCount } from '../data/toolkitData';
import { useLanguage } from '../contexts/LanguageContext';

function DisclaimerSplash({ onAcknowledge }) {
  const [isVisible, setIsVisible] = useState(false);
  const { t } = useLanguage();

  // Lock body scroll when modal is visible
  useBodyScrollLock(isVisible);
  
  // Get color schemas
  const { getModalClasses, getColorClass, colors } = useColorSchemas();
  const modalClasses = getModalClasses();

  useEffect(() => {
    // Check if user has already acknowledged
    const hasAcknowledged = localStorage.getItem('vetrate-disclaimer-acknowledged');
    if (!hasAcknowledged) {
      setIsVisible(true);
    } else {
      onAcknowledge?.();
    }
  }, [onAcknowledge]);

  const handleAcknowledge = () => {
    localStorage.setItem('vetrate-disclaimer-acknowledged', 'true');
    setIsVisible(false);
    onAcknowledge?.();
  };

  if (!isVisible) return null;

  return (
    <div 
      className={`${modalClasses.backdrop} z-[100] bg-gradient-to-br from-va-blue/95 to-green-900/95 backdrop-blur-sm`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="splash-title"
    >
      <div className={`${modalClasses.content} max-w-2xl rounded-2xl max-h-[90vh]`}>
        {/* Header - Warm Welcome */}
        <div className="bg-gradient-to-r from-va-blue to-green-800 dark:from-gray-700 dark:to-gray-800 p-6 text-center">
          <div className="inline-flex items-center justify-center bg-white rounded-full p-1 mb-4 overflow-hidden w-24 h-24">
            <img 
              src="/images/Vet-Rate-org-logo-official.png" 
              alt="Vet-Rate.org Logo" 
              className="h-full w-full object-cover rounded-full"
            />
          </div>
          <h1 id="splash-title" className="text-2xl md:text-3xl font-bold text-white mb-2">
            {t('splash', 'welcomeVeteran')} 🎖️
          </h1>
          <p className="text-green-100 text-lg">
            {t('splash', 'yourClaimsToolkit')}
          </p>
        </div>

        {/* Content */}
        <div className="p-6 md:p-8">
          {/* Personal Message */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 mb-6">
            <p className="text-blue-800 dark:text-blue-200 text-sm leading-relaxed">
              <span className="font-semibold">{t('splash', 'fromOneVeteran')}</span> {t('splash', 'personalMessage')} {t('splash', 'coveringEverything')} - <strong>{PROJECT_STATS.disabilitiesValidated.toLocaleString()} {t('splash', 'ratedConditions')}</strong>, {t('splash', 'advancedCalculators')} {t('splash', 'allFreeNoTricks')}
            </p>
            <p className="text-blue-600 dark:text-blue-100 text-xs mt-2 italic">
              - {t('splash', 'fellowDisabledVeteran')}
            </p>
          </div>

          {/* Trust Signals */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
            <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Lock className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-200">{t('splash', 'noLoginRequired')}</span>
              <span className="text-xs text-green-600 dark:text-green-400">{t('splash', 'yourPrivacyMatters')}</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Sparkles className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-200">{t('splash', 'hundredPercentFree')}</span>
              <span className="text-xs text-green-600 dark:text-green-400">{t('splash', 'noHiddenFees')}</span>
            </div>
            <div className="flex flex-col items-center text-center p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
              <Shield className="h-6 w-6 text-green-600 dark:text-green-400 mb-2" />
              <span className="text-xs font-medium text-green-800 dark:text-green-200">{t('splash', 'noDataSold')}</span>
              <span className="text-xs text-green-600 dark:text-green-400">{t('splash', 'youAreNotTracked')}</span>
            </div>
          </div>

          {/* What You Can Do Here */}
          <div className="mb-6">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-gray-300 mb-3 uppercase tracking-wide">
              {t('splash', 'yourClaimsArsenal')}
            </h2>
            <ul className="space-y-2 text-gray-700 dark:text-gray-300 text-sm">
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{PROJECT_STATS.disabilitiesValidated.toLocaleString()} {t('splash', 'conditionsWithCriteria')}</strong></span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'tacticalCalculator')}</strong> - {t('splash', 'tacticalCalculatorDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'secondaryScout')}</strong> - {t('splash', 'secondaryScoutDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'cpExamSimulator')}</strong> - {t('splash', 'cpExamSimulatorDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'cFileAiAnalyzer')}</strong> - {t('splash', 'cFileAiAnalyzerDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'formsHelperEvidence')}</strong> - {t('splash', 'formsHelperEvidenceDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'strategicTools')}</strong> - {t('splash', 'strategicToolsDesc')}</span>
              </li>
              <li className="flex items-start gap-2">
                <span className="text-green-600 font-bold">✓</span>
                <span><strong>{t('splash', 'myPacket')}</strong> - {t('splash', 'myPacketDesc')}</span>
              </li>
            </ul>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-3 italic text-center">
              🎖️ {getTotalToolCount()} {t('splash', 'professionalToolsFooter')}
            </p>
          </div>

          {/* Important Note - Softened */}
          <div className="bg-gray-100 dark:bg-gray-700/50 rounded-lg p-4 mb-6 text-sm">
            <p className="text-gray-600 dark:text-gray-300">
              <span className="font-medium">{t('splash', 'quickNote')}</span> {t('splash', 'notVSOOrLawFirm')}
            </p>
          </div>

          {/* Acknowledge Button */}
          <button
            onClick={handleAcknowledge}
            className="w-full bg-gradient-to-r from-va-blue to-green-700 hover:from-green-700 hover:to-va-blue text-white font-bold py-4 px-6 rounded-xl transition-all duration-300 transform hover:scale-[1.02] shadow-lg hover:shadow-xl text-lg"
          >
            {t('splash', 'enterVetRate')}
          </button>

          <p className="text-center text-xs text-gray-500 dark:text-gray-400 mt-4">
            {t('splash', 'thankYouForService')}
          </p>
        </div>
      </div>
    </div>
  );
}

export default DisclaimerSplash;
