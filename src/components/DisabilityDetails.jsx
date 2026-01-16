import React, { useState } from 'react';
import PDFButton from './PDFButton';

function DisabilityDetails({ result, searchTerm, onClose }) {
  const [expandedSection, setExpandedSection] = useState('documentation');

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
      { label: 'Medical Records (MyHealtheVet)', url: 'https://www.myhealth.va.gov/' },
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

  return (
    <div className="mt-12 bg-white rounded-xl shadow-lg overflow-hidden border border-gray-200">
      {/* Header */}
      <div className="bg-gradient-to-r from-va-blue to-green-900 text-white p-8">
        <div className="flex justify-between items-start gap-4 mb-4">
          <div>
            <h2 className="text-3xl md:text-4xl font-bold mb-2">
              {result.conditionName}
            </h2>
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
          <a
            href="https://buymeacoffee.com/vetrate"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-va-gold text-va-blue px-4 py-2 rounded-lg font-semibold hover:bg-yellow-400 transition"
          >
            <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
              <path d="M8 3a1 1 0 011-1h2a1 1 0 110 2H9a1 1 0 01-1-1z" />
              <path d="M6 3a2 2 0 00-2 2v11a2 2 0 002 2h8a2 2 0 002-2V5a2 2 0 00-2-2 3 3 0 01-3 3H9a3 3 0 01-3-3z" />
            </svg>
            <span className="hidden sm:inline">Support Us</span>
            <span className="sm:hidden">☕</span>
          </a>
        </div>
      </div>

      {/* Content */}
      <div className="p-8">
        {/* Rating Schedule */}
        <div className="mb-8 p-4 bg-green-50 rounded-lg border border-green-200">
          <p className="text-gray-700">
            <span className="font-bold text-va-blue">Rating Schedule:</span> {result.ratingSchedule}
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
              <div className="mt-4 border border-gray-200 rounded-lg overflow-hidden">
                {/* Type Badge */}
                <div className="bg-gray-50 px-4 py-2 border-b border-gray-200">
                  <span className="text-xs font-semibold text-gray-600 uppercase">
                    Rating Type: {result.ratingCriteria.type.replace(/-/g, ' ')}
                  </span>
                </div>

                {/* Rated-As Instructions */}
                {result.ratingCriteria.ratedUnder && (
                  <div className="p-4 bg-amber-50 border-b border-amber-200">
                    <p className="text-sm font-semibold text-amber-900 mb-2">⚠️ Rating Instructions:</p>
                    <p className="text-gray-700 text-sm">{result.ratingCriteria.ratedUnder}</p>
                  </div>
                )}

                {/* Formula */}
                {result.ratingCriteria.formula && (
                  <div className="p-4 bg-blue-50 border-b border-blue-200">
                    <p className="text-sm font-semibold text-blue-900 mb-1">📋 Formula:</p>
                    <p className="text-gray-700 text-sm font-mono">{result.ratingCriteria.formula}</p>
                  </div>
                )}

                {/* Special Instructions */}
                {result.ratingCriteria.specialInstructions && (
                  <div className="p-4 bg-purple-50 border-b border-purple-200">
                    <p className="text-sm font-semibold text-purple-900 mb-2">ℹ️ Special Instructions:</p>
                    <p className="text-gray-700 text-sm">{result.ratingCriteria.specialInstructions}</p>
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
                              className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}
                            >
                              <td className="px-4 py-4 border-b border-gray-200">
                                <span className="inline-block bg-va-gold text-va-blue font-bold px-3 py-1 rounded-lg text-lg">
                                  {percentage}%
                                </span>
                              </td>
                              <td className="px-4 py-4 border-b border-gray-200 text-gray-700 text-sm leading-relaxed">
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
                  <div className="p-4 bg-green-50 border-t border-green-200">
                    <p className="text-sm font-semibold text-green-900 mb-2">📝 Important Notes:</p>
                    <div className="text-gray-700 text-sm leading-relaxed pl-4 border-l-2 border-green-400">
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
            className="w-full flex justify-between items-center p-4 bg-gray-50 hover:bg-gray-100 rounded-lg border border-gray-200 transition"
          >
            <h3 className="text-xl font-bold text-gray-800">
              Documentation Requirements for Medical Providers
            </h3>
            <svg
              className={`w-6 h-6 text-gray-600 transition-transform ${
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
            <div className="mt-4 p-4 bg-white border border-gray-200 rounded-lg">
              <p className="text-gray-700 mb-4">
                Please ensure your medical documentation includes the following information
                to support disability rating decisions:
              </p>
              <div className="prose prose-sm max-w-none text-gray-700">
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
          <div className="mb-8 p-4 bg-amber-50 border border-amber-200 rounded-lg">
            <h3 className="font-bold text-gray-800 mb-3">Related Secondary Conditions</h3>
            <p className="text-sm text-gray-700 mb-3">
              These conditions may arise as a result of your primary service-connected disability:
            </p>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {result.relatedSecondaryConditions.map((condition, idx) => {
                // Support both string and object format for backwards compatibility
                const conditionName = typeof condition === 'string' ? condition : condition.name;
                const diagnosticCode = typeof condition === 'object' ? condition.diagnosticCode : null;
                
                return (
                  <li key={idx} className="flex items-start gap-2">
                    <span className="text-amber-600 font-bold mt-0.5">→</span>
                    <span className="text-gray-800">
                      {conditionName}
                      {diagnosticCode && (
                        <span className="ml-1 text-xs font-mono text-amber-700 bg-amber-100 px-1.5 py-0.5 rounded">
                          DC {diagnosticCode}
                        </span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
            <p className="text-xs text-gray-600 mt-4 pt-3 border-t border-amber-200">
              <strong>Note:</strong> Veterans must provide medical evidence establishing a nexus (medical link) 
              between their service-connected condition and any secondary condition. This requires a medical 
              opinion stating it is "at least as likely as not" (50% or greater probability) that the secondary 
              condition is related to the service-connected disability.
            </p>
          </div>
        )}

        {/* Veteran Support & Resources */}
        <div className="mb-8">
          <h3 className="text-2xl font-bold text-gray-800 mb-6">
            Veteran Support & Resources
          </h3>

          {/* Emergency Support */}
          <div className="mb-8 p-4 bg-red-50 border-l-4 border-red-500 rounded">
            <h4 className="font-bold text-red-800 mb-3">🚨 EMERGENCY & CRISIS SUPPORT</h4>
            <ul className="space-y-2">
              {VAResources.emergency.map((resource, idx) => (
                <li key={idx} className="text-gray-700">
                  <span className="font-semibold text-gray-800">{resource.label}:</span>{' '}
                  <span className="text-red-700 font-bold">{resource.value}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* Essential VA Tools */}
          <div className="mb-8">
            <h4 className="font-bold text-gray-800 mb-4">📋 ESSENTIAL VA TOOLS & BENEFITS</h4>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {VAResources.essential.map((resource, idx) => (
                <li key={idx}>
                  <a
                    href={resource.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-va-blue hover:text-green-900 font-semibold underline hover:no-underline transition"
                  >
                    {resource.label}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          {/* Rating Schedule Link */}
          <div className="p-4 bg-blue-50 border border-blue-200 rounded">
            <h4 className="font-bold text-gray-800 mb-2">
              38 CFR Part 4 - The Rating Schedule
            </h4>
            <a
              href="https://www.ecfr.gov/current/title-38/chapter-I/part-4"
              target="_blank"
              rel="noopener noreferrer"
              className="text-va-blue hover:text-blue-900 font-semibold underline"
            >
              https://www.ecfr.gov/current/title-38/chapter-I/part-4
            </a>
          </div>
        </div>

        {/* Glossary Preview */}
        <div className="mt-8 p-6 bg-gray-50 rounded-lg">
          <h3 className="text-xl font-bold text-gray-800 mb-4">Quick Reference Glossary</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <p className="font-bold text-gray-800">Diagnostic Code (DC)</p>
              <p className="text-sm text-gray-600">
                A 4-digit number used by the VA to classify and rate specific disabilities
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-800">Secondary Condition</p>
              <p className="text-sm text-gray-600">
                A disability that is proximately due to or the result of a service-connected
                disease or injury
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-800">Service Connection</p>
              <p className="text-sm text-gray-600">
                Acknowledgment by the VA that a disability was incurred or aggravated during
                military service
              </p>
            </div>
            <div>
              <p className="font-bold text-gray-800">Nexus</p>
              <p className="text-sm text-gray-600">
                The mandatory medical link between a current disability and an event, injury,
                or disease in service
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Footer Legal Notice */}
      <div className="bg-gray-100 border-t border-gray-200 p-6">
        <p className="text-xs text-gray-600">
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
