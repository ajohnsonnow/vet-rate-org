import React, { useState } from 'react';
import PDFButton from './PDFButton';
import { saveClaim, isClaimSaved } from '../utils/claimsStorage';
import { PACTActInfoCard, PACTActBadge } from './PACTActIndicator';
import StaleDataIndicator from './StaleDataIndicator';
import FundingModal from './FundingModal';

function DisabilityDetails({ result, searchTerm, onClose, onBuildStatement, onSecondaryConditionClick }) {
  const [expandedSection, setExpandedSection] = useState('documentation');
  const [isSaved, setIsSaved] = useState(isClaimSaved(result.conditionName, null));
  const [showFundingModal, setShowFundingModal] = useState(false);

  const VAResources = {
    emergency: [
      { label: 'VETERANS CRISIS LINE', value: 'Dial 988 then Press 1' },
      {
        label: 'HOMELESS VET CALL CENTER',
        value: '1-877-4AID-VET (1-877-424-3838)',
      },
      { label: 'VA HOMELESS PROGRAMS', value: 'www.va.gov/homeless' },
    ],
    essential: [
      {
        label: 'File a Disability Claim',
        url: 'https://www.va.gov/disability/how-to-file-claim/',
      },
      {
        label: 'Check Claim or Appeal Status',
        url: 'https://www.va.gov/claim-or-appeal-status/',
      },
      {
        label: 'Find an Accredited VSO / Attorney',
        url: 'https://www.va.gov/ogc/apps/accreditation/index.asp',
      },
      {
        label: 'Download Benefit Summary Letters',
        url: 'https://www.va.gov/records/download-va-letters/',
      },
      { label: 'Medical Records (MyHealtheVet)', url: 'https://www.va.gov/health-care/manage-health/' },
      {
        label: 'VA Home Loans (COE & Assistance)',
        url: 'https://www.va.gov/housing-assistance/',
      },
      {
        label: 'GI Bill & Education Benefits',
        url: 'https://www.va.gov/education/',
      },
      { label: 'Center for Women Veterans', url: 'https://www.va.gov/womenvet/' },
    ],
  };

  const handleSaveToPacket = () => {
    const success = saveClaim({
      conditionName: result.conditionName,
      diagnosticCode: result.diagnosticCode,
      parentCondition: null,
      status: 'Drafting'
    });
    
    if (success) {
      setIsSaved(true);
      alert(`${result.conditionName} has been saved to your claim packet!`);
    } else {
      alert('Error saving claim. Please try again.');
    }
  };

  const handleBuildStatement = () => {
    // First save the claim if not already saved
    if (!isSaved) {
      saveClaim({
        conditionName: result.conditionName,
        diagnosticCode: result.diagnosticCode,
        parentCondition: null,
        status: 'Drafting'
      });
      setIsSaved(true);
    }
    
    // Open NexusBuilder directly
    if (onBuildStatement) {
      onBuildStatement(result.conditionName);
    }
  };

  return (
    <div id="diagnostic-header" className="mt-12 bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border border-gray-200 dark:border-gray-700">
      {/* Header */}
      <div className="bg-gradient-to-r from-va-blue to-green-900 text-white p-8">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <div className="flex items-center gap-3 mb-2 flex-wrap">
              <h2 className="text-3xl md:text-4xl font-bold">
                {result.conditionName}
              </h2>
              <PACTActBadge diagnosticCode={result.diagnosticCode} showTooltip={false} />
              <StaleDataIndicator disability={result} variant="compact" />
            </div>
            <p className="text-blue-100 text-lg">
              Diagnostic Code: <span className="font-bold">{result.diagnosticCode}</span>
            </p>
          </div>
          <button
            onClick={onClose}
            className="text-white hover:text-blue-200 transition"
            aria-label="Close details"
          >
            <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>
        <div className="flex flex-wrap gap-3">
          <button
            onClick={handleSaveToPacket}
            disabled={isSaved}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg font-semibold transition ${
              isSaved 
                ? 'bg-gray-300 text-gray-500 cursor-not-allowed' 
                : 'bg-indigo-600 text-white hover:bg-indigo-700'
            }`}
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
            {isSaved ? 'Saved to Packet' : 'Save to Packet'}
          </button>
          
          <button
            onClick={handleBuildStatement}
            className="inline-flex items-center gap-2 bg-purple-600 text-white px-4 py-2 rounded-lg font-semibold hover:bg-purple-700 transition"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
            Build Statement
          </button>
          
          <PDFButton result={result} searchTerm={searchTerm} />
          {result.ecfrUrl && (
            <a
              href={result.ecfrUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 bg-white text-va-blue px-4 py-2 rounded-lg font-semibold hover:bg-green-50 transition"
            >
              <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                <path d="M11 3a1 1 0 100 2h3.586L9.293 9.293a1 1 0 001.414 1.414L16 6.414V10a1 1 0 102 0V4a1 1 0 00-1-1h-6z" />
                <path d="M5 5a2 2 0 00-2 2v8a2 2 0 002 2h8a2 2 0 002-2v-3a1 1 0 10-2 0v3H5V7h3a1 1 0 000-2H5z" />
              </svg>
              View on eCFR
            </a>
          )}
          <button
            onClick={() => setShowFundingModal(true)}
            className="inline-flex items-center gap-2 bg-va-gold text-va-blue px-4 py-2 rounded-lg font-bold hover:bg-yellow-400 hover:scale-105 shadow-md hover:shadow-lg transition-all"
            title="Help keep Vet-Rate free for all veterans"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M3.172 5.172a4 4 0 015.656 0L10 6.343l1.172-1.171a4 4 0 115.656 5.656L10 17.657l-6.828-6.829a4 4 0 010-5.656z" clipRule="evenodd" />
            </svg>
            <span className="hidden sm:inline">Back the Mission</span>
            <span className="sm:hidden">💚 Support</span>
          </button>
        </div>
      </div>
      
      {/* Funding Modal */}
      <FundingModal show={showFundingModal} onClose={() => setShowFundingModal(false)} />

      {/* Content */}
      <div id="diagnostic-content" className="p-8">
        {/* PACT Act Info Card - Show if applicable */}
        <PACTActInfoCard diagnosticCode={result.diagnosticCode} conditionName={result.conditionName} />
        
        {/* Rating Schedule */}
        <div className="mb-8 p-4 bg-green-50 dark:bg-green-900/30 rounded-lg border border-green-200 dark:border-green-700">
          <p className="text-gray-700 dark:text-gray-300">
            <span className="font-bold text-va-blue dark:text-blue-100">📊 Rating Schedule:</span> {result.ratingSchedule}
          </p>
        </div>

        {/* Rating Criteria */}
        {result.ratingCriteria && (
          <div className="mb-8">
            <button
              onClick={() =>
                setExpandedSection(
                  expandedSection === 'ratingCriteria' ? '' : 'ratingCriteria'
                )
              }
              className="w-full flex justify-between items-center p-4 bg-gradient-to-r from-va-blue to-green-900 hover:from-va-blue-dark hover:to-green-800 rounded-lg border border-va-blue shadow-md transition text-white"
            >
              <h3 className="text-xl font-bold">
                📊 Rating Schedules & Criteria
              </h3>
              <svg
                className={`w-6 h-6 transition-transform ${
                  expandedSection === 'ratingCriteria' ? 'transform rotate-180' : ''
                }`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 14l-7 7m0 0l-7-7m7 7V3"
                />
              </svg>
            </button>
            {expandedSection === 'ratingCriteria' && (
              <div className="mt-4 border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden">
                {/* Type Badge */}
                <div className="bg-gray-50 dark:bg-gray-800 px-4 py-2 border-b border-gray-200 dark:border-gray-700">
                  <span className="text-xs font-semibold text-gray-600 dark:text-gray-400 uppercase">
                    Rating Type: {result.ratingCriteria.type.replace(/-/g, ' ')}
                  </span>
                </div>

                {/* Rated-As Instructions */}
                {result.ratingCriteria.ratedUnder && (
                  <div className="p-4 bg-amber-50 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-700">
                    <p className="text-sm font-semibold text-amber-900 dark:text-amber-100 mb-2">⚠️ Rating Instructions:</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{result.ratingCriteria.ratedUnder}</p>
                  </div>
                )}

                {/* Formula */}
                {result.ratingCriteria.formula && (
                  <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border-b border-blue-200 dark:border-blue-700">
                    <p className="text-sm font-semibold text-blue-900 dark:text-blue-100 mb-1">📋 Formula:</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm font-mono">{result.ratingCriteria.formula}</p>
                  </div>
                )}

                {/* Special Instructions */}
                {result.ratingCriteria.specialInstructions && (
                  <div className="p-4 bg-purple-50 dark:bg-purple-900/30 border-b border-purple-200 dark:border-purple-700">
                    <p className="text-sm font-semibold text-purple-900 dark:text-purple-100 mb-2">ℹ️ Special Instructions:</p>
                    <p className="text-gray-700 dark:text-gray-300 text-sm">{result.ratingCriteria.specialInstructions}</p>
                  </div>
                )}

                {/* Percentage Ratings Table */}
                {result.ratingCriteria.ratings && Object.keys(result.ratingCriteria.ratings).length > 0 && (
                  <div className="overflow-x-auto">
                    <table className="w-full">
                      <thead>
                        <tr className="bg-va-blue text-white">
                          <th className="px-4 py-3 text-left font-bold w-32">Rating %</th>
                          <th className="px-4 py-3 text-left font-bold">Criteria</th>
                        </tr>
                      </thead>
                      <tbody>
                        {/* Sort ratings in descending order */}
                        {Object.entries(result.ratingCriteria.ratings)
                          .sort(([a], [b]) => parseInt(b) - parseInt(a))
                          .map(([percentage, criteria], idx) => (
                            <tr
                              key={percentage}
                              className={idx % 2 === 0 ? 'bg-white dark:bg-gray-800' : 'bg-gray-50 dark:bg-gray-700'}
                            >
                              <td className="px-4 py-4 border-b border-gray-200 dark:border-gray-700">
                                <span className="inline-block bg-va-gold text-va-blue font-bold px-3 py-1 rounded-lg text-lg">
                                  {percentage}%
                                </span>
                              </td>
                              <td className="px-4 py-4 border-b border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">
                                {criteria}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}

                {/* Notes */}
                {result.ratingCriteria.notes && (
                  <div className="p-4 bg-green-50 dark:bg-green-900/30 border-t border-green-200 dark:border-green-700">
                    <p className="text-sm font-semibold text-green-900 dark:text-green-100 mb-2">📝 Important Notes:</p>
                    <div className="text-gray-700 dark:text-gray-300 text-sm leading-relaxed pl-4 border-l-2 border-green-400 dark:border-green-600">
                      {typeof result.ratingCriteria.notes === 'string' ? (
                        <p>{result.ratingCriteria.notes}</p>
                      ) : (
                        <ul className="space-y-2">
                          {result.ratingCriteria.notes.map((note, idx) => (
                            <li key={idx}>{note}</li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Documentation Requirements */}
        <div className="mb-8">
          <button
            onClick={() =>
              setExpandedSection(
                expandedSection === 'documentation' ? '' : 'documentation'
              )
            }
            className="w-full flex justify-between items-center p-4 bg-gray-50 dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg border border-gray-200 dark:border-gray-700 transition"
          >
            <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100">
              Documentation Requirements for Medical Providers
            </h3>
            <svg
              className={`w-6 h-6 text-gray-600 dark:text-gray-400 transition-transform ${
                expandedSection === 'documentation' ? 'transform rotate-180' : ''
              }`}
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19 14l-7 7m0 0l-7-7m7 7V3"
              />
            </svg>
          </button>
          {expandedSection === 'documentation' && (
            <div className="mt-4 p-4 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg">
              <p className="text-gray-700 dark:text-gray-300 mb-4">
                Please ensure your medical documentation includes the following information
                to support disability rating decisions:
              </p>
              <div className="prose prose-sm max-w-none text-gray-700 dark:text-gray-300">
                {result.documentationRequirements.split('\n').map((line, idx) => (
                  line.trim() && (
                    <p key={idx} className="mb-2">
                      • {line.trim()}
                    </p>
                  )
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Related Secondary Conditions */}
        {result.relatedSecondaryConditions && result.relatedSecondaryConditions.length > 0 && (
          <div className="mb-8 p-4 bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg">
            <h3 className="font-bold text-gray-800 dark:text-gray-100 mb-3">🔗 Related Secondary Conditions</h3>
            <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
              These conditions may arise as a result of your primary service-connected disability:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.relatedSecondaryConditions.map((condition, idx) => {
                // Support both string and object format for backwards compatibility
                const conditionName = typeof condition === 'string' ? condition : condition.name;
                const diagnosticCode = typeof condition === 'object' ? condition.diagnosticCode : null;
                
                return (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 dark:text-amber-400 font-bold mt-0.5">→</span>
                    {onSecondaryConditionClick && diagnosticCode ? (
                      <button
                        onClick={() => onSecondaryConditionClick(diagnosticCode, conditionName)}
                        className="text-left group hover:bg-amber-100 dark:hover:bg-amber-800/50 rounded px-1 -mx-1 transition-colors"
                      >
                        <span className="text-va-blue dark:text-blue-400 group-hover:underline font-medium">
                          {conditionName}
                        </span>
                        <span className="ml-2 text-xs font-mono text-amber-700 dark:text-amber-300 bg-amber-100 dark:bg-amber-800/50 px-1.5 py-0.5 rounded group-hover:bg-amber-200 dark:group-hover:bg-amber-700/50 transition-colors">
                          DC {diagnosticCode}
                        </span>
                      </button>
                    ) : (
                      <span className="text-gray-800 dark:text-gray-200">
                        {conditionName}
                        {diagnosticCode && (
                          <span className="ml-1 text-xs font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                            DC {diagnosticCode}
                          </span>
                        )}
                      </span>
                    )}
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-gray-600 dark:text-gray-400 mt-4 pt-3 border-t border-amber-200 dark:border-amber-700">
              <strong>Note:</strong> Veterans must provide medical evidence establishing a nexus (medical link) 
              between their service-connected condition and any secondary condition. This requires a medical 
              opinion stating it is "at least as likely as not" (50% or greater probability) that the secondary 
              condition is related to the service-connected disability.
            </p>
          </div>
        )}

        {/* Veteran Support & Resources */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-800 dark:text-gray-100 mb-6">
            Veteran Support & Resources
          </h3>

          {/* Emergency Support */}
          <div className="mb-8 p-4 bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 rounded">
            <h4 className="font-bold text-red-800 dark:text-red-100 mb-3">🚨 EMERGENCY & CRISIS SUPPORT</h4>
            <ul className="space-y-2">
              {VAResources.emergency.map((resource, idx) => (
                <li key={idx} className="text-gray-700 dark:text-gray-300">
                  <span className="font-semibold text-gray-800 dark:text-gray-200">{resource.label}:</span>{' '}
                  <span className="text-red-700 dark:text-red-400 font-bold">{resource.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Essential VA Tools */}
          <div className="mb-8">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-4">📋 ESSENTIAL VA TOOLS & BENEFITS</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {VAResources.essential.map((resource, idx) => (
                <li key={idx}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-va-blue dark:text-blue-400 hover:text-green-900 dark:hover:text-green-400 font-semibold underline hover:no-underline transition"
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Rating Schedule Link */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded">
            <h4 className="font-bold text-gray-800 dark:text-gray-100 mb-2">
              38 CFR Part 4 - The Rating Schedule
            </h4>
            <a
              href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-va-blue dark:text-blue-400 hover:text-blue-900 dark:hover:text-blue-300 font-semibold underline"
            >
              https://www.ecfr.gov/current/title-38/chapter-I/part-4
            </a>
          </div>
        </div>

        {/* Glossary Preview */}
        <div className="mt-8 p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <h3 className="text-xl font-bold text-gray-800 dark:text-gray-100 mb-4">📖 Quick Reference Glossary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">Diagnostic Code (DC)</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A 4-digit number used by the VA to classify and rate specific disabilities
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">Secondary Condition</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                A disability that is proximately due to or the result of a service-connected
                disease or injury
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">Service Connection</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Acknowledgment by the VA that a disability was incurred or aggravated during
                military service
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-800 dark:text-gray-100">Nexus</p>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                The mandatory medical link between a current disability and an event, injury,
                or disease in service
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Legal Notice */}
      <div className="bg-gray-100 dark:bg-gray-900 border-t border-gray-200 dark:border-gray-700 p-6">
        <p className="text-xs text-gray-600 dark:text-gray-400">
          <strong>LEGAL NOTICE:</strong> This information is for educational purposes only. It
          does not constitute legal or medical advice. Please consult with VA officials or
          qualified professionals for specific guidance regarding your disability claim or
          rating.
        </p>
      </div>
    </div>
  );
}

export default DisabilityDetails;
