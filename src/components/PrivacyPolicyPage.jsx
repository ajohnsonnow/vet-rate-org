import React from 'react';
import { useLanguage } from '../contexts/LanguageContext';
import ReportBugLink from './ReportBugLink';
import { useBodyScrollLock } from '../utils/useBodyScrollLock';
import { useColorSchemas } from '../hooks/useColorSchemas';

const PrivacyPolicy = ({ onClose, onReportBug }) => {
  const { t } = useLanguage();
  
  // Lock body scroll when modal is open
  useBodyScrollLock(true);
  
  // Get color schemas
  const { getModalClasses, getColorClass, colors } = useColorSchemas();
  const modalClasses = getModalClasses();

  return (
    <div 
      className={modalClasses.backdrop}
      role="dialog"
      aria-modal="true"
      aria-labelledby="privacy-policy-title"
    >
      <div className={`${modalClasses.content} max-w-4xl my-8 max-h-[90vh] flex flex-col overflow-hidden`}>
        <div className={`flex-shrink-0 border-b px-6 py-4 flex justify-between items-center rounded-t-lg z-10 ${getColorClass(colors.base.modal)} ${getColorClass(colors.border.default)}`}>
          <h2 id="privacy-policy-title" className={`text-2xl font-bold ${getColorClass(colors.text.primary)}`}>{t('privacyPolicy', 'title')}</h2>
          <div className="flex items-center gap-3">
            {onReportBug && <ReportBugLink onClick={onReportBug} variant="auto" moduleName="Privacy Policy" />}
            <button
              onClick={onClose}
              className={`text-3xl font-bold leading-none ${getColorClass(colors.text.tertiary)} hover:${getColorClass(colors.text.secondary)}`}
              aria-label={t('privacyPolicy', 'closeAriaLabel')}
            >
              ×
            </button>
          </div>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-6">
          <p className={`text-sm mb-6 ${getColorClass(colors.text.secondary)}`}>
            <strong>{t('privacyPolicy', 'lastUpdated')}</strong> January 23, 2026
          </p>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section1Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section1Text')}
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section2Title')}</h3>
            
            <h4 className="text-lg font-semibold text-gray-800 mb-2">{t('privacyPolicy', 'section2_1Title')}</h4>
            <p className="text-gray-700 mb-3">
              <strong>{t('privacyPolicy', 'section2_1Text')}</strong>
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>{t('privacyPolicy', 'piiItem1')}</li>
              <li>{t('privacyPolicy', 'piiItem2')}</li>
              <li>{t('privacyPolicy', 'piiItem3')}</li>
              <li>{t('privacyPolicy', 'piiItem4')}</li>
            </ul>

            <h4 className="text-lg font-semibold text-gray-800 mb-2">{t('privacyPolicy', 'section2_2Title')}</h4>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-3">
              <p className="text-gray-700 mb-2">
                <strong>{t('privacyPolicy', 'analyticsTransparency')}</strong>{' '}
                {t('privacyPolicy', 'analyticsIntro').split('GoatCounter')[0]}
                <a href="https://www.goatcounter.com" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">GoatCounter</a>
                {t('privacyPolicy', 'analyticsIntro').split('GoatCounter')[1]}
              </p>
              <p className="text-gray-700 mb-2">
                <strong>{t('privacyPolicy', 'analyticsCollects')}</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-2 ml-4">
                <li>{t('privacyPolicy', 'analyticsItem1')}</li>
                <li>{t('privacyPolicy', 'analyticsItem2')}</li>
                <li>{t('privacyPolicy', 'analyticsItem3')}</li>
                <li>{t('privacyPolicy', 'analyticsItem4')}</li>
              </ul>
              <p className="text-gray-700 mb-2">
                <strong>{t('privacyPolicy', 'analyticsNotCollect')}</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-2 ml-4">
                <li>{t('privacyPolicy', 'analyticsNotItem1')}</li>
                <li>{t('privacyPolicy', 'analyticsNotItem2')}</li>
                <li>{t('privacyPolicy', 'analyticsNotItem3')}</li>
                <li>{t('privacyPolicy', 'analyticsNotItem4')}</li>
                <li>{t('privacyPolicy', 'analyticsNotItem5')}</li>
              </ul>
              <p className="text-gray-700 text-sm">
                {t('privacyPolicy', 'analyticsGDPR').split('.')[0]}.{' '}
                <a href="https://www.goatcounter.com/help/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">{t('privacyPolicy', 'analyticsGDPR').split('.')[1]?.trim() || 'Read their privacy policy'}</a>.
              </p>
            </div>

            <h4 className="text-lg font-semibold text-gray-800 mb-2">{t('privacyPolicy', 'section2_3Title')}</h4>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section2_3Text')}
            </p>

            <h4 className="text-lg font-semibold text-gray-800 mb-2">{t('privacyPolicy', 'section2_4Title')}</h4>
            <p className="text-gray-700 mb-3">
              <strong>{t('privacyPolicy', 'section2_4Text')}</strong>
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section3Title')}</h3>
            <p className="text-gray-700 mb-3">
              <strong>{t('privacyPolicy', 'section3Text')}</strong>
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section4Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section4Intro')}
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li>{t('privacyPolicy', 'section4Item1')}</li>
              <li>{t('privacyPolicy', 'section4Item2')}</li>
              <li>{t('privacyPolicy', 'section4Item3')}</li>
              <li>{t('privacyPolicy', 'section4Item4')}</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section5Title')}</h3>
            <p className="text-gray-700 mb-3">
              <strong>{t('privacyPolicy', 'section5Text')}</strong>
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section6Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section6Intro')}
            </p>
            <ul className="list-disc list-inside text-gray-700 mb-3 ml-4">
              <li><strong>{t('privacyPolicy', 'section6Item1Title')}</strong> {t('privacyPolicy', 'section6Item1Text')}</li>
              <li><strong>{t('privacyPolicy', 'section6Item2Title')}</strong> {t('privacyPolicy', 'section6Item2Text')}</li>
              <li><strong>{t('privacyPolicy', 'section6Item3Title')}</strong> {t('privacyPolicy', 'section6Item3Text')}</li>
            </ul>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section7Title')}</h3>
            <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-3">
              <p className="text-gray-700 mb-2">
                <strong>{t('privacyPolicy', 'section7OptionalAI')}</strong> {t('privacyPolicy', 'section7OptionalAIText')}
              </p>
              <p className="text-gray-700 mb-2">
                <strong>{t('privacyPolicy', 'section7WhatThisMeans')}</strong>
              </p>
              <ul className="list-disc list-inside text-gray-700 mb-2 ml-4">
                <li>{t('privacyPolicy', 'section7AIItem1')}</li>
                <li>{t('privacyPolicy', 'section7AIItem2')}</li>
                <li>{t('privacyPolicy', 'section7AIItem3')}</li>
                <li>{t('privacyPolicy', 'section7AIItem4')}</li>
              </ul>
              <p className="text-gray-700 text-sm">
                <strong>{t('privacyPolicy', 'analyticsTransparency')}</strong>{' '}
                {t('privacyPolicy', 'section7TransparencyNote').split('Google')[0]}
                <a href="https://ai.google.dev/gemini-api/terms" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Google's Gemini API Terms
                </a>{' '}
                and{' '}
                <a href="https://www.anthropic.com/legal/privacy" target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                  Anthropic's Privacy Policy
                </a>.
                {' '}{t('privacyPolicy', 'section7TransparencyNote').split('Privacy Policy.')[1]?.trim() || 'We strive to use zero-retention settings where available.'}
              </p>
            </div>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section8Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section8Text')}
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section9Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section9Text')}
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section10Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section10Text')}
            </p>
          </section>

          <section className="mb-6">
            <h3 className="text-xl font-bold text-gray-800 mb-3">{t('privacyPolicy', 'section11Title')}</h3>
            <p className="text-gray-700 mb-3">
              {t('privacyPolicy', 'section11Text')}
            </p>
          </section>

          <div className="bg-green-50 border-l-4 border-green-500 p-4 mt-6">
            <p className="text-sm text-green-800">
              <strong>{t('privacyPolicy', 'privacyFirstTitle')}</strong> {t('privacyPolicy', 'privacyFirstText')}
            </p>
          </div>
        </div>

        <div className="flex-shrink-0 border-t px-6 py-4 bg-gray-50 rounded-b-lg">
          <button
            onClick={onClose}
            className="w-full md:w-auto px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            {t('privacyPolicy', 'closeButton')}
          </button>
        </div>
      </div>
    </div>
  );
};

export default PrivacyPolicy;
