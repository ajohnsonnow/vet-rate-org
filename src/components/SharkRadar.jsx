/**
 * Vet-Rate.org - Shark Radar Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Contract scanner that detects predatory practices
 * targeting veterans from "claim consulting" firms.
 */

import { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  analyzeContract,
  getRiskLevelColors,
  getSeverityColor,
  getSharkRadarPrivacyDisclosure,
} from "../utils/sharkRadar";
import {
  isAnyAIAvailable,
  getAIStatus,
  AI_MODES,
} from "../utils/unifiedAIService";
import { AIStatusBadge, AIModeSelector } from "./AIModeSelector";
import VoiceInputButton from "./VoiceInput";

// Icons
const _SharkIcon = () => (
  <svg
    className="w-6 h-6"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
    />
  </svg>
);

const ShieldIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z"
    />
  </svg>
);

const AlertIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 13l4 4L19 7"
    />
  </svg>
);

const InfoIcon = () => (
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
);

const SearchIcon = () => (
  <svg
    className="w-5 h-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
);

const ExternalLinkIcon = () => (
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
      d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"
    />
  </svg>
);

/**
 * Risk Meter Component
 */
const RiskMeter = ({ score, riskLevel }) => {
  const colors = getRiskLevelColors(riskLevel);
  const rotation = (score / 100) * 180 - 90; // -90 to 90 degrees

  return (
    <div className="relative w-48 h-24 mx-auto">
      {/* Meter background */}
      <div className="absolute inset-0 overflow-hidden">
        <div
          className="w-48 h-48 rounded-full border-[16px] border-gray-200 dark:border-gray-700"
          style={{ clipPath: "polygon(0 50%, 100% 50%, 100% 0, 0 0)" }}
        ></div>
        {/* Colored segments */}
        <div className="absolute inset-0">
          <div
            className="w-48 h-48 rounded-full border-[16px] border-transparent"
            style={{
              borderTopColor: "#22c55e",
              borderRightColor: "#eab308",
              clipPath: "polygon(0 50%, 100% 50%, 100% 0, 0 0)",
              transform: "rotate(-90deg)",
            }}
          ></div>
        </div>
      </div>

      {/* Needle */}
      <div
        className="absolute bottom-0 left-1/2 w-1 h-20 bg-gray-800 dark:bg-white origin-bottom transition-transform duration-1000 ease-out"
        style={{ transform: `translateX(-50%) rotate(${rotation}deg)` }}
      >
        <div className="w-3 h-3 bg-gray-800 dark:bg-white rounded-full -ml-1 -mt-1"></div>
      </div>

      {/* Score display */}
      <div className="absolute -bottom-2 left-1/2 transform -translate-x-1/2 text-center">
        <div className={`text-3xl font-bold ${colors.text}`}>{score}</div>
        <div className="text-xs text-gray-500 dark:text-gray-400">
          Risk Score
        </div>
      </div>

      {/* Labels */}
      <div className="absolute bottom-0 left-0 text-xs text-green-600 dark:text-green-400 font-medium">
        Safe
      </div>
      <div className="absolute bottom-0 right-0 text-xs text-red-600 dark:text-red-400 font-medium">
        Danger
      </div>
    </div>
  );
};

const ConsentGate = ({ onConsent }) => (
  <div className="bg-gray-50 dark:bg-gray-700/50 rounded-xl p-6 border border-gray-200 dark:border-gray-600">
    <div className="text-center mb-6">
      <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-full mb-3">
        <ShieldIcon />
      </div>
      <h2 className="text-xl font-semibold text-gray-900 dark:text-white mb-2">
        Privacy First
      </h2>
      <p className="text-gray-600 dark:text-gray-400 text-sm">
        Before scanning, please review how we protect your information.
      </p>
    </div>

    <div className="bg-gray-50 dark:bg-gray-900 rounded-xl p-4 mb-6 text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap">
      {getSharkRadarPrivacyDisclosure()}
    </div>

    <div className="flex gap-3">
      <button
        onClick={onConsent}
        className="flex-1 px-6 py-3 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-xl font-semibold hover:from-red-600 hover:to-orange-600 transition-all flex items-center justify-center gap-2"
      >
        <CheckIcon /> I Understand, Continue
      </button>
    </div>
  </div>
);

const AIModeSection = ({
  aiStatus,
  showAISettings,
  setShowAISettings,
  setAIStatus,
}) => (
  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 mb-4 border border-gray-200 dark:border-gray-600">
    <div className="flex items-center justify-between mb-2">
      <div className="flex items-center gap-3">
        <AIStatusBadge showLabel={true} />
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {aiStatus.effectiveMode === AI_MODES.LOCAL
            ? "100% Private - runs on your device"
            : "Cloud AI - fast & powerful"}
        </span>
      </div>
      <button
        onClick={() => setShowAISettings(!showAISettings)}
        className="text-sm text-red-600 dark:text-red-400 hover:text-red-800 dark:hover:text-red-200"
      >
        {showAISettings ? "Hide Settings" : "AI Settings"}
      </button>
    </div>
    {isAnyAIAvailable() && (
      <div className="text-xs text-gray-600 dark:text-gray-400 flex items-center gap-1 mt-2">
        <span>💡</span>
        <span>
          <strong>Tip:</strong> All AI models work great for contract scanning -
          even long documents!
        </span>
      </div>
    )}

    {showAISettings && (
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <AIModeSelector onModeChange={() => setAIStatus(getAIStatus())} />
      </div>
    )}
  </div>
);

const ScanButton = ({ onClick, disabled, isAnalyzing }) => (
  <button
    onClick={onClick}
    disabled={disabled}
    className="px-6 py-2 bg-gradient-to-r from-red-500 to-orange-500 text-white rounded-lg font-semibold hover:from-red-600 hover:to-orange-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
  >
    {isAnalyzing ? (
      <>
        <svg className="w-5 h-5 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          ></circle>
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
          ></path>
        </svg>
        Scanning...
      </>
    ) : (
      <>
        <SearchIcon /> Scan for Red Flags
      </>
    )}
  </button>
);

const ContractInputSection = ({
  textInput,
  setTextInput,
  handleClear,
  handleAnalyze,
  isAnalyzing,
  results,
}) => (
  <div className="bg-gray-50 dark:bg-gray-700/30 rounded-lg p-4 border border-gray-200 dark:border-gray-600 mb-4">
    {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      Paste Contract or Email Text (or use microphone to read aloud)
    </label>
    <div className="relative">
      <textarea
        value={textInput}
        onChange={(e) => setTextInput(e.target.value)}
        placeholder="Paste the contract, agreement, email, or marketing material from a VA claim consulting company here...

Example red flags to look for:
• 'We charge 5x your monthly increase'
• 'Provide your VA.gov login credentials'
• 'Guaranteed 100% rating'
• 'Pay $3,000 upfront to start'"
        className="w-full h-64 px-4 py-3 pr-14 bg-gray-50 dark:bg-gray-900 border border-gray-300 dark:border-gray-600 rounded-xl text-gray-900 dark:text-white placeholder-gray-400 focus:ring-2 focus:ring-red-500 focus:border-transparent resize-none"
      />
      <div className="absolute right-3 top-3">
        <VoiceInputButton
          onTranscript={(text) =>
            setTextInput((prev) => (prev ? `${prev} ${text}` : text))
          }
          size="md"
        />
      </div>
    </div>

    <div className="flex items-center justify-between mt-4">
      <span className="text-sm text-gray-500 dark:text-gray-400">
        {textInput.length} characters
      </span>
      <div className="flex gap-2">
        <button
          onClick={handleClear}
          disabled={!textInput && !results}
          className="px-4 py-2 text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors disabled:opacity-50"
        >
          Clear
        </button>
        <ScanButton
          onClick={handleAnalyze}
          disabled={isAnalyzing || !isAnyAIAvailable() || !textInput.trim()}
          isAnalyzing={isAnalyzing}
        />
      </div>
    </div>
  </div>
);

const ErrorBanner = ({ error }) => {
  if (!error) return null;

  return (
    <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-700 rounded-xl p-4 mb-6 flex items-start gap-3">
      <AlertIcon />
      <div className="text-red-700 dark:text-red-300">{error}</div>
    </div>
  );
};

function getRiskBadgeClasses(riskLevel) {
  if (riskLevel === "PREDATORY") return "bg-red-600 text-white";
  if (riskLevel === "CAUTION") return "bg-yellow-500 text-black";
  return "bg-green-500 text-white";
}

function getSeverityBadgeClasses(severity) {
  if (severity === "HIGH") {
    return "bg-red-200 text-red-800 dark:bg-red-800 dark:text-red-200";
  }
  if (severity === "MEDIUM") {
    return "bg-yellow-200 text-yellow-800 dark:bg-yellow-800 dark:text-yellow-200";
  }
  return "bg-blue-200 text-blue-800 dark:bg-blue-800 dark:text-blue-200";
}

const RiskLevelCard = ({ data }) => (
  <div
    className={`rounded-2xl shadow-xl p-6 border-2 ${getRiskLevelColors(data.risk_level).border} ${getRiskLevelColors(data.risk_level).bgLight}`}
  >
    <div className="flex flex-col md:flex-row md:items-center gap-6">
      {/* Risk Meter */}
      <div className="flex-shrink-0">
        <RiskMeter score={data.score} riskLevel={data.risk_level} />
      </div>

      {/* Verdict */}
      <div className="flex-1">
        <div
          className={`inline-flex items-center gap-2 px-4 py-2 rounded-full font-bold text-lg mb-3 ${getRiskBadgeClasses(data.risk_level)}`}
        >
          {data.risk_level === "PREDATORY" && "🚨"}
          {data.risk_level === "CAUTION" && "⚠️"}
          {data.risk_level === "SAFE" && "✅"}
          {data.risk_level}
        </div>
        <p className="text-gray-700 dark:text-gray-300 text-lg">
          {data.verdict_summary}
        </p>
        {data.recommendation && (
          <p
            className={`mt-2 font-semibold ${
              data.recommendation === "RUN" ||
              data.recommendation === "DO_NOT_SIGN"
                ? "text-red-600 dark:text-red-400"
                : "text-yellow-600 dark:text-yellow-400"
            }`}
          >
            Recommendation: {data.recommendation.replace(/_/g, " ")}
          </p>
        )}
      </div>
    </div>
  </div>
);

const FallbackNotice = ({ data }) => {
  if (!data._usedFallback) return null;

  return (
    <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-lg flex items-start gap-2">
      <span className="text-amber-500 flex-shrink-0">🔍</span>
      <div>
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">
          Keyword Analysis (No AI Loaded)
        </p>
        <p className="text-xs text-amber-700 dark:text-amber-300 mt-0.5">
          {data._fallbackNote}
        </p>
      </div>
    </div>
  );
};

const RedFlagCard = ({ flag }) => (
  <div className={`p-4 rounded-xl border ${getSeverityColor(flag.severity)}`}>
    <div className="flex items-start justify-between gap-4 mb-2">
      <span className="font-semibold">{flag.violation}</span>
      <span
        className={`px-2 py-0.5 rounded text-xs font-bold ${getSeverityBadgeClasses(flag.severity)}`}
      >
        {flag.severity}
      </span>
    </div>
    <div className="text-sm mb-2 bg-gray-100 dark:bg-gray-900 p-2 rounded border-l-4 border-red-500">
      <span className="font-medium">Found: </span>&quot;
      {flag.trigger_text}&quot;
    </div>
    <p className="text-sm opacity-90">{flag.advice}</p>
    {flag.legal_reference && (
      <p className="text-xs mt-2 opacity-75">📜 {flag.legal_reference}</p>
    )}
  </div>
);

const RedFlagsList = ({ flags }) => {
  if (!flags || flags.length === 0) return null;

  return (
    <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-6 border border-gray-200 dark:border-gray-700">
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
        <span className="text-red-500">⚠️</span> Red Flags Detected (
        {flags.length})
      </h3>
      <div className="space-y-4">
        {flags.map((flag, index) => (
          <RedFlagCard key={index} flag={flag} />
        ))}
      </div>
    </div>
  );
};

const PositiveSignsList = ({ signs }) => {
  if (!signs || signs.length === 0) return null;

  return (
    <div className="bg-green-50 dark:bg-green-900/20 rounded-2xl p-6 border border-green-200 dark:border-green-700">
      <h3 className="text-lg font-bold text-green-800 dark:text-green-300 mb-3 flex items-center gap-2">
        <CheckIcon /> Positive Signs
      </h3>
      <ul className="space-y-2">
        {signs.map((sign, index) => (
          <li
            key={index}
            className="flex items-start gap-2 text-green-700 dark:text-green-300"
          >
            <span className="text-green-500 mt-0.5">✓</span>
            {sign}
          </li>
        ))}
      </ul>
    </div>
  );
};

const PredatoryWarningActions = ({ riskLevel }) => {
  if (riskLevel !== "PREDATORY") return null;

  return (
    <div className="bg-red-900 text-white rounded-2xl p-6">
      <h3 className="text-xl font-bold mb-4 flex items-center gap-2">
        🚨 Protect Yourself - Take Action
      </h3>
      <p className="mb-4">
        This contract contains serious red flags. Do NOT sign or share personal
        information with this company.
      </p>
      <div className="grid sm:grid-cols-2 gap-4">
        <a
          href="https://www.va.gov/ogc/apps/accreditation/index.asp"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-white text-red-900 rounded-xl font-semibold hover:bg-gray-100 transition-colors"
        >
          Find Accredited Rep <ExternalLinkIcon />
        </a>
        <a
          href="https://www.va.gov/oig/hotline/"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center justify-center gap-2 px-4 py-3 bg-yellow-400 text-black rounded-xl font-semibold hover:bg-yellow-300 transition-colors"
        >
          Report to VA OIG <ExternalLinkIcon />
        </a>
      </div>
    </div>
  );
};

const ScanResults = ({ results }) => {
  if (!results || !results.success) return null;

  const { data } = results;

  return (
    <div className="space-y-6">
      <RiskLevelCard data={data} />
      <FallbackNotice data={data} />
      <RedFlagsList flags={data.flags} />
      <PositiveSignsList signs={data.positive_signs} />
      <PredatoryWarningActions riskLevel={data.risk_level} />
    </div>
  );
};

const KnowYourRightsSection = () => (
  <div className="mt-8 bg-blue-50 dark:bg-blue-900/20 rounded-xl p-6 border border-blue-200 dark:border-blue-700">
    <h3 className="font-semibold text-blue-800 dark:text-blue-300 mb-3">
      Know Your Rights
    </h3>
    <ul className="space-y-2 text-sm text-blue-700 dark:text-blue-300">
      <li className="flex items-start gap-2">
        <span className="text-blue-500 mt-0.5">•</span>
        <span>
          <strong>Free Help Exists:</strong> VA-accredited VSOs (like DAV, VFW,
          American Legion) help veterans for FREE.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-blue-500 mt-0.5">•</span>
        <span>
          <strong>Fees Are Regulated:</strong> Only VA-accredited
          attorneys/agents can charge fees, and only AFTER an initial claim
          decision.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-blue-500 mt-0.5">•</span>
        <span>
          <strong>Never Share Passwords:</strong> Legitimate representatives
          never need your VA.gov or ID.me login credentials.
        </span>
      </li>
      <li className="flex items-start gap-2">
        <span className="text-blue-500 mt-0.5">•</span>
        <span>
          <strong>No Guarantees:</strong> No one can guarantee a specific
          rating. Anyone who does is being deceptive.
        </span>
      </li>
    </ul>
  </div>
);

const PrivacyToggle = ({ showPrivacy, setShowPrivacy }) => (
  <>
    <button
      onClick={() => setShowPrivacy(!showPrivacy)}
      className="mt-4 text-sm text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 flex items-center gap-2"
    >
      <InfoIcon /> {showPrivacy ? "Hide" : "View"} Privacy Information
    </button>

    {showPrivacy && (
      <div className="mt-2 p-4 bg-gray-50 dark:bg-gray-900 rounded-lg text-sm text-gray-600 dark:text-gray-400 whitespace-pre-wrap">
        {getSharkRadarPrivacyDisclosure()}
      </div>
    )}
  </>
);

// Loads the saved API key/consent and polls AI status on mount
function useSharkRadarPersistence({ setApiKey, setHasConsented, setAIStatus }) {
  useEffect(() => {
    const storedKey = localStorage.getItem("vetrate_gemini_key");
    if (storedKey) {
      setApiKey(storedKey);
    }
    const consent = localStorage.getItem("vetrate_ai_consent");
    if (consent === "true") {
      setHasConsented(true);
    }

    // Update AI status periodically
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);

    return () => clearInterval(interval);
  }, [setApiKey, setHasConsented, setAIStatus]);
}

/**
 * Main Shark Radar Component
 */
export default function SharkRadar() {
  const { _t } = useLanguage();
  const [textInput, setTextInput] = useState("");
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [results, setResults] = useState(null);
  const [error, setError] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  const [apiKey, setApiKey] = useState("");
  const [hasConsented, setHasConsented] = useState(false);
  const [aiStatus, setAIStatus] = useState(getAIStatus());

  useSharkRadarPersistence({ setApiKey, setHasConsented, setAIStatus });

  const _handleSaveKey = (key) => {
    localStorage.setItem("vetrate_gemini_key", key);
    setApiKey(key);
  };

  const handleConsent = () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    setHasConsented(true);
  };

  const handleAnalyze = async () => {
    if (!textInput.trim()) {
      setError("Please paste contract or email text to analyze");
      return;
    }

    setIsAnalyzing(true);
    setError(null);
    setResults(null);

    try {
      const result = await analyzeContract(apiKey, textInput);
      setResults(result);
    } catch (err) {
      setError(err.message);
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleClear = () => {
    setTextInput("");
    setResults(null);
    setError(null);
  };

  // Consent Check
  if (!hasConsented) {
    return (
      <div className="max-w-4xl mx-auto">
        <ConsentGate onConsent={handleConsent} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto">
      <AIModeSection
        aiStatus={aiStatus}
        showAISettings={showAISettings}
        setShowAISettings={setShowAISettings}
        setAIStatus={setAIStatus}
      />
      <ContractInputSection
        textInput={textInput}
        setTextInput={setTextInput}
        handleClear={handleClear}
        handleAnalyze={handleAnalyze}
        isAnalyzing={isAnalyzing}
        results={results}
      />
      <ErrorBanner error={error} />
      <ScanResults results={results} />
      <KnowYourRightsSection />
      <PrivacyToggle
        showPrivacy={showPrivacy}
        setShowPrivacy={setShowPrivacy}
      />
    </div>
  );
}
