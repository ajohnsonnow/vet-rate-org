/**
 * Copyright (c) 2025 Vet-Rate.org
 * All rights reserved.
 *
 * This source code is proprietary and confidential.
 */

import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { getPactActData } from "../services/knowledgeQuery";

const pactActData = getPactActData();

/**
 * PACTActBadge - A small badge to indicate PACT Act presumptive status
 */
export const PACTActBadge = ({ diagnosticCode, showTooltip = true }) => {
  const { _t } = useLanguage();
  const [isHovered, setIsHovered] = useState(false);

  const pactInfo = pactActData.diagnosticCodePactMapping[diagnosticCode];

  if (!pactInfo?.pactAct) return null;

  const exposureNames = {
    burnPit: "🔥 Burn Pit",
    agentOrange: "🍊 Agent Orange",
    radiation: "☢️ Radiation",
    campLejeune: "💧 Camp Lejeune",
    gulfWar: "🏜️ Gulf War",
  };

  return (
    // eslint-disable-next-line jsx-a11y/no-static-element-interactions -- hover-only tooltip trigger; badge content is fully accessible without it
    <div
      className="relative inline-flex"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold bg-gradient-to-r from-green-600 to-emerald-600 text-white shadow-sm cursor-help"
        aria-label="PACT Act Presumptive Condition"
      >
        <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
            clipRule="evenodd"
          />
        </svg>
        PACT Act
      </span>

      {showTooltip && isHovered && (
        <div className="absolute bottom-full left-0 mb-2 z-50 w-72 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-xl">
          <div className="font-semibold text-green-400 mb-1">
            ✓ Presumptive Condition
          </div>
          <p className="mb-2">{pactInfo.claimTip}</p>
          <div className="flex flex-wrap gap-1">
            {pactInfo.exposures.map((exp) => (
              <span
                key={exp}
                className="px-1.5 py-0.5 bg-gray-700 rounded text-xs"
              >
                {exposureNames[exp] || exp}
              </span>
            ))}
          </div>
          <div className="absolute left-4 -bottom-1.5 w-3 h-3 bg-gray-900 transform rotate-45"></div>
        </div>
      )}
    </div>
  );
};

const exposureDetails = {
  burnPit: {
    icon: "🔥",
    color: "from-orange-500 to-red-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  agentOrange: {
    icon: "🍊",
    color: "from-orange-400 to-yellow-500",
    bgColor: "bg-orange-50",
    borderColor: "border-orange-200",
  },
  radiation: {
    icon: "☢️",
    color: "from-yellow-500 to-amber-500",
    bgColor: "bg-yellow-50",
    borderColor: "border-yellow-200",
  },
  campLejeune: {
    icon: "💧",
    color: "from-blue-500 to-cyan-500",
    bgColor: "bg-blue-50",
    borderColor: "border-blue-200",
  },
  gulfWar: {
    icon: "🏜️",
    color: "from-amber-500 to-yellow-600",
    bgColor: "bg-amber-50",
    borderColor: "border-amber-200",
  },
};

const exposureData = pactActData.exposureCategories;

/**
 * PACTActInfoCardHeader - Collapsible header toggle for the info card
 */
function PACTActInfoCardHeader({ isExpanded, setIsExpanded }) {
  return (
    // eslint-disable-next-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions
    <div
      className="px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white cursor-pointer flex items-center justify-between"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center gap-2">
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
          <path
            fillRule="evenodd"
            d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
            clipRule="evenodd"
          />
        </svg>
        <span className="font-bold">PACT Act Presumptive Condition</span>
      </div>
      <svg
        className={`w-5 h-5 transform transition-transform ${isExpanded ? "rotate-180" : ""}`}
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M19 9l-7 7-7-7"
        />
      </svg>
    </div>
  );
}

/**
 * PACTActSummary - Always-visible claim tip and exposure badges
 */
function PACTActSummary({ claimTip, exposures }) {
  return (
    <div className="px-4 py-3">
      <p className="text-gray-700 text-sm">
        <span className="font-semibold text-green-700">Good news!</span>{" "}
        {claimTip}
      </p>

      {/* Exposure badges */}
      <div className="mt-2 flex flex-wrap gap-2">
        {exposures.map((expKey) => {
          const details = exposureDetails[expKey];
          const expData = exposureData[expKey];
          return (
            <span
              key={expKey}
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium ${details.bgColor} ${details.borderColor} border`}
            >
              <span>{details.icon}</span>
              <span>{expData?.name || expKey}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}

/**
 * PACTActServiceRequirementLinks - VA.gov and registry links for an exposure
 */
function PACTActServiceRequirementLinks({ vaUrl, registryUrl }) {
  return (
    <div className="flex flex-wrap gap-3 mt-3">
      <a
        href={vaUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 hover:underline"
      >
        Learn more on VA.gov
        <svg
          className="w-3 h-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
          />
        </svg>
      </a>
      {registryUrl && (
        <a
          href={registryUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-sm text-emerald-600 hover:text-emerald-800 hover:underline font-medium"
        >
          📋 Join Burn Pit Registry
          <svg
            className="w-3 h-3"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
            />
          </svg>
        </a>
      )}
    </div>
  );
}

/**
 * PACTActServiceRequirement - Qualifying service details for one exposure
 */
function PACTActServiceRequirement({ expKey, expData, details }) {
  if (!expData) return null;

  return (
    <div
      className={`p-3 rounded-lg ${details.bgColor} ${details.borderColor} border`}
    >
      <h4 className="font-semibold text-gray-800 mb-2 flex items-center gap-2">
        <span>{details.icon}</span> {expData.name} - Service Requirements
      </h4>

      {expData.serviceRequirements?.locations && (
        <div className="mb-2">
          <span className="text-sm font-medium text-gray-700">
            Qualifying Locations:
          </span>
          <ul className="text-sm text-gray-600 ml-4 mt-1 list-disc">
            {expData.serviceRequirements.locations.slice(0, 5).map((loc, i) => (
              <li key={i}>{loc}</li>
            ))}
            {expData.serviceRequirements.locations.length > 5 && (
              <li className="text-gray-500">...and more</li>
            )}
          </ul>
        </div>
      )}

      {expData.serviceRequirements?.dateRange && (
        <div className="text-sm">
          <span className="font-medium text-gray-700">Service Dates: </span>
          <span className="text-gray-600">
            {typeof expData.serviceRequirements.dateRange === "string"
              ? expData.serviceRequirements.dateRange
              : "Various - see VA.gov for details"}
          </span>
        </div>
      )}

      {/* Airborne Hazards Details - only for burn pit exposure */}
      {expKey === "burnPit" && expData.airborneHazards && (
        <div className="mt-3 pt-3 border-t border-orange-200">
          <span className="text-sm font-medium text-gray-700">
            Types of Airborne Hazards:
          </span>
          <ul className="text-sm text-gray-600 ml-4 mt-1 list-disc">
            {expData.airborneHazards.map((hazard, i) => (
              <li key={i}>{hazard}</li>
            ))}
          </ul>
        </div>
      )}

      {expData.vaUrl && (
        <PACTActServiceRequirementLinks
          vaUrl={expData.vaUrl}
          registryUrl={expData.registryUrl}
        />
      )}
    </div>
  );
}

/**
 * PACTActFilingTips - Static filing guidance list
 */
function PACTActFilingTips() {
  return (
    <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
      <h4 className="font-semibold text-blue-800 mb-2 flex items-center gap-2">
        <span>💡</span> Filing Tips
      </h4>
      <ul className="text-sm text-gray-700 space-y-1">
        <li>
          • File your claim as a <strong>presumptive condition</strong> related
          to your qualifying service
        </li>
        <li>
          • You&apos;ll still need medical evidence of your current diagnosis
        </li>
        <li>
          • Include your DD-214 showing qualifying service locations/dates
        </li>
        <li>
          • Consider registering for the{" "}
          <a
            href="https://www.publichealth.va.gov/exposures/burnpits/registry.asp"
            target="_blank"
            rel="noopener noreferrer"
            className="text-blue-600 hover:text-blue-800 hover:underline font-medium"
          >
            Airborne Hazards and Open Burn Pit Registry
          </a>
        </li>
      </ul>
    </div>
  );
}

/**
 * PACTActResourceLink - Link to the VA PACT Act resource page
 */
function PACTActResourceLink({ vaResourceUrl }) {
  return (
    <div className="text-center">
      <a
        href={vaResourceUrl}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 hover:bg-green-700 text-white font-medium rounded-lg transition-colors"
      >
        <svg
          className="w-4 h-4"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        Learn More About the PACT Act on VA.gov
      </a>
    </div>
  );
}

/**
 * PACTActInfoCard - Full information card about PACT Act status for a condition
 */
export const PACTActInfoCard = ({ diagnosticCode, _conditionName }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  const pactInfo = pactActData.diagnosticCodePactMapping[diagnosticCode];

  if (!pactInfo?.pactAct) return null;

  return (
    <div className="mt-4 border-2 border-green-200 rounded-lg overflow-hidden bg-gradient-to-r from-green-50 to-emerald-50">
      {/* Header */}
      <PACTActInfoCardHeader
        isExpanded={isExpanded}
        setIsExpanded={setIsExpanded}
      />

      {/* Summary - Always visible */}
      <PACTActSummary
        claimTip={pactInfo.claimTip}
        exposures={pactInfo.exposures}
      />

      {/* Expanded details */}
      {isExpanded && (
        <div className="px-4 pb-4 space-y-4">
          <hr className="border-green-200" />

          {/* What is a presumptive condition */}
          <div>
            <h4 className="font-semibold text-gray-800 mb-1 flex items-center gap-2">
              <span>❓</span> What does &quot;presumptive&quot; mean?
            </h4>
            <p className="text-sm text-gray-600">
              For presumptive conditions, you{" "}
              <strong>don&apos;t need to prove</strong> that your service caused
              the condition. The VA automatically assumes (&quot;presumes&quot;)
              that your service caused it if you meet the service requirements.
            </p>
          </div>

          {/* Service requirements */}
          {pactInfo.exposures.map((expKey) => (
            <PACTActServiceRequirement
              key={expKey}
              expKey={expKey}
              expData={exposureData[expKey]}
              details={exposureDetails[expKey]}
            />
          ))}

          {/* Filing tips */}
          <PACTActFilingTips />

          {/* VA Resource link */}
          <PACTActResourceLink
            vaResourceUrl={pactActData.pactActInfo.vaResourceUrl}
          />
        </div>
      )}
    </div>
  );
};

/**
 * PACTActAlert - A prominent alert for search results with PACT Act conditions
 */
export const PACTActAlert = ({ diagnosticCodes = [] }) => {
  const pactCodes = diagnosticCodes.filter(
    (code) => pactActData.diagnosticCodePactMapping[code]?.pactAct,
  );

  if (pactCodes.length === 0) return null;

  return (
    <div className="mb-4 p-4 bg-gradient-to-r from-green-100 to-emerald-100 border-l-4 border-green-600 rounded-r-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg
            className="w-6 h-6 text-green-600"
            fill="currentColor"
            viewBox="0 0 20 20"
          >
            <path
              fillRule="evenodd"
              d="M6.267 3.455a3.066 3.066 0 001.745-.723 3.066 3.066 0 013.976 0 3.066 3.066 0 001.745.723 3.066 3.066 0 012.812 2.812c.051.643.304 1.254.723 1.745a3.066 3.066 0 010 3.976 3.066 3.066 0 00-.723 1.745 3.066 3.066 0 01-2.812 2.812 3.066 3.066 0 00-1.745.723 3.066 3.066 0 01-3.976 0 3.066 3.066 0 00-1.745-.723 3.066 3.066 0 01-2.812-2.812 3.066 3.066 0 00-.723-1.745 3.066 3.066 0 010-3.976 3.066 3.066 0 00.723-1.745 3.066 3.066 0 012.812-2.812zm7.44 5.252a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
              clipRule="evenodd"
            />
          </svg>
        </div>
        <div>
          <h3 className="font-bold text-green-800">
            PACT Act Presumptive Condition Found!
          </h3>
          <p className="text-sm text-green-700 mt-1">
            This condition may qualify for presumptive service connection under
            the PACT Act. Veterans with qualifying toxic exposure don&apos;t
            need to prove service causation.
          </p>
          <a
            href={pactActData.pactActInfo.vaResourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-2 text-sm font-medium text-green-700 hover:text-green-900 hover:underline"
          >
            Learn about PACT Act eligibility →
          </a>
        </div>
      </div>
    </div>
  );
};

/**
 * Utility function to check if a diagnostic code is PACT Act presumptive
 */
export const isPactActPresumptive = (diagnosticCode) => {
  return (
    pactActData.diagnosticCodePactMapping[diagnosticCode]?.pactAct === true
  );
};

/**
 * Utility function to get PACT Act info for a diagnostic code
 */
export const getPactActInfo = (diagnosticCode) => {
  return pactActData.diagnosticCodePactMapping[diagnosticCode] || null;
};

export default {
  PACTActBadge,
  PACTActInfoCard,
  PACTActAlert,
  isPactActPresumptive,
  getPactActInfo,
};
