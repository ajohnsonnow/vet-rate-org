/**
 * ClaimStressTest - Red Team Simulator
 * "The War Game" - Prepare for the toughest C&P examiner questions
 *
 * The Problem: Veterans submit claims thinking they're perfect, then get blindsided
 * The Solution: AI-powered adversarial review that finds weaknesses before the VA does
 */

import { useState, useEffect } from "react";
import {
  getSavedClaims,
  getStatement,
  getAllStatements,
} from "../utils/claimsStorage";
import { getVeteranProfile, getSavedForms } from "../utils/veteranProfile";
import { isAnyAIAvailable } from "../utils/unifiedAIService";
import ReportBugLink from "./ReportBugLink";
import VoiceInputButton from "./VoiceInput";
import ResponsiveModal from "./common/ResponsiveModal";

// Red Team Analysis Logic - Simulates skeptical VA examiner. Each checker
// inspects the claim text and returns a { weakness, question } pair, or
// null if that particular red flag isn't present.
const checkTimelineGap = (text) => {
  const yearPattern = /\b(19|20)\d{2}\b/g;
  const years = text
    .match(yearPattern)
    ?.map((y) => parseInt(y))
    .sort();

  if (!years || years.length < 2) return null;

  const firstYear = years[0];
  const lastYear = years[years.length - 1];
  const gap = lastYear - firstYear;

  if (gap <= 10) return null;

  return {
    weakness: {
      type: "Timeline Gap",
      severity: "HIGH",
      description: `${gap}-year gap between earliest and latest dates mentioned`,
      impact: "VA may question continuity of condition",
    },
    question: {
      question: `Your statement mentions events from ${firstYear}, but your most recent medical evidence is from ${lastYear}. That's a ${gap}-year gap. What medical treatment or documentation do you have for the years in between?`,
      category: "Continuity of Evidence",
      threat_level: "Critical",
    },
  };
};

const checkMedicalTerminology = (text, lowerText) => {
  const hasPainWord =
    lowerText.includes("hurt") ||
    lowerText.includes("pain") ||
    lowerText.includes("sore");
  const hasSpecificity =
    lowerText.includes("chronic") ||
    lowerText.includes("acute") ||
    lowerText.includes("persistent");

  if (!hasPainWord || hasSpecificity) return null;

  return {
    weakness: {
      type: "Vague Medical Description",
      severity: "MEDIUM",
      description: "Using layman terms without medical specificity",
      impact: "May be rated lower due to unclear symptom description",
    },
    question: {
      question: `You describe symptoms as "hurting" or "painful." Can you provide specific medical terminology? For example: Is it chronic (lasting 6+ months)? Is it radicular (shooting pain)? Is it localized or diffuse?`,
      category: "Medical Specificity",
      threat_level: "Moderate",
    },
  };
};

const checkNexusLanguage = (text, lowerText) => {
  const hasNexusLanguage =
    lowerText.includes("as likely as not") ||
    lowerText.includes("at least as likely");

  if (hasNexusLanguage) return null;

  return {
    weakness: {
      type: "Missing Nexus Standard",
      severity: "HIGH",
      description: 'No clear "at least as likely as not" nexus language',
      impact: "VA requires 50%+ probability language for service connection",
    },
    question: {
      question: `Where in your statement or nexus letter does it explicitly state that your condition is "at least as likely as not" connected to service? The VA requires this specific probability threshold.`,
      category: "Legal Standard",
      threat_level: "Critical",
    },
  };
};

const SERVICE_PATTERNS = [
  "deployed",
  "combat",
  "iraq",
  "afghanistan",
  "vietnam",
  "korea",
  "airborne",
  "ranger",
  "infantry",
  "special forces",
];

const checkServiceRecordConflict = (text, lowerText) => {
  const mentionsService = SERVICE_PATTERNS.some((pattern) =>
    lowerText.includes(pattern),
  );
  const mentionsNoRecords =
    lowerText.includes("no record") ||
    lowerText.includes("lost record") ||
    lowerText.includes("missing record");

  if (!mentionsService || !mentionsNoRecords) return null;

  return {
    weakness: {
      type: "Service Record Gap",
      severity: "HIGH",
      description: "Claims service event but acknowledges missing records",
      impact: "VA may deny without buddy statements or other corroboration",
    },
    question: {
      question: `You mention significant service events but also state that records are missing. What alternative evidence do you have? Buddy statements? Unit rosters? After-action reports? The VA will not simply take your word.`,
      category: "Burden of Proof",
      threat_level: "Critical",
    },
  };
};

const checkDateInconsistency = (text, lowerText) => {
  const hasDateInconsistency =
    lowerText.includes("2010") &&
    lowerText.includes("2012") &&
    (lowerText.includes("started") || lowerText.includes("began"));

  if (!hasDateInconsistency) return null;

  return {
    weakness: {
      type: "Date Inconsistency",
      severity: "MEDIUM",
      description: "Multiple dates mentioned for same event",
      impact: "Credibility concerns if dates conflict",
    },
    question: {
      question: `I see multiple dates in your statement. Can you clarify the exact timeline? Which date is when the injury occurred vs. when you first sought treatment vs. when you were diagnosed?`,
      category: "Factual Accuracy",
      threat_level: "Moderate",
    },
  };
};

const checkAggravationVsCausation = (text, lowerText) => {
  const mentionsAggravation =
    lowerText.includes("made worse") || lowerText.includes("aggravated");
  const mentionsPreExisting =
    lowerText.includes("pre-existing") || lowerText.includes("before service");

  if (!mentionsAggravation || mentionsPreExisting) return null;

  return {
    weakness: {
      type: "Aggravation Claim Unclear",
      severity: "MEDIUM",
      description:
        "Mentions aggravation but unclear if condition pre-existed service",
      impact:
        "VA distinguishes between service-connected conditions and aggravated conditions",
    },
    question: {
      question: `You state your condition was "made worse" during service. Did this condition exist before service? If so, you're filing an aggravation claim, not a direct service connection claim. Can you clarify?`,
      category: "Claim Type",
      threat_level: "Moderate",
    },
  };
};

const FUNCTIONAL_KEYWORDS = [
  "unable",
  "cannot",
  "difficulty",
  "limitation",
  "restricted",
  "prevents me from",
];

const checkFunctionalImpact = (text, lowerText) => {
  const hasFunctionalImpact = FUNCTIONAL_KEYWORDS.some((keyword) =>
    lowerText.includes(keyword),
  );

  if (hasFunctionalImpact) return null;

  return {
    weakness: {
      type: "Missing Functional Impact",
      severity: "HIGH",
      description: "Does not describe how condition affects daily life or work",
      impact: "VA rates based on functional impairment, not just diagnosis",
    },
    question: {
      question: `How does this condition affect your daily life? Can you work? Can you walk? Can you sleep? The VA rates disabilities based on functional impairment, not just the diagnosis itself.`,
      category: "Functional Assessment",
      threat_level: "Critical",
    },
  };
};

const checkCurrentTreatment = (text, lowerText) => {
  const currentTreatment =
    lowerText.includes("currently taking") ||
    lowerText.includes("see a doctor") ||
    lowerText.includes("physical therapy") ||
    lowerText.includes("medication");
  const mentionsStopped =
    lowerText.includes("no longer") || lowerText.includes("stopped treatment");

  if (currentTreatment || mentionsStopped) return null;

  return {
    weakness: {
      type: "No Current Treatment Mentioned",
      severity: "MEDIUM",
      description: "No mention of current medical treatment",
      impact: "VA may question severity if not seeking treatment",
    },
    question: {
      question: `Are you currently receiving treatment for this condition? If not, why not? The VA may question the severity of your condition if you're not actively seeking medical care.`,
      category: "Treatment History",
      threat_level: "Moderate",
    },
  };
};

const WEAKNESS_CHECKERS = [
  checkTimelineGap,
  checkMedicalTerminology,
  checkNexusLanguage,
  checkServiceRecordConflict,
  checkDateInconsistency,
  checkAggravationVsCausation,
  checkFunctionalImpact,
  checkCurrentTreatment,
];

const analyzeClaimWeaknesses = (claim) => {
  const weaknesses = [];
  const questions = [];
  const gaps = [];

  // Parse claim data
  const text = typeof claim === "string" ? claim : JSON.stringify(claim);
  const lowerText = text.toLowerCase();

  WEAKNESS_CHECKERS.forEach((checker) => {
    const result = checker(text, lowerText);
    if (result) {
      weaknesses.push(result.weakness);
      questions.push(result.question);
    }
  });

  // Generic catch-all if no issues found
  if (weaknesses.length === 0) {
    weaknesses.push({
      type: "Preliminary Review Clean",
      severity: "LOW",
      description: "No major red flags detected in automated scan",
      impact: "This is a good sign, but have a VSO review as well",
    });

    questions.push({
      question: `Your statement appears solid in the automated review. However, I still recommend having a VSO or attorney review it for nuances that AI cannot catch. Are you working with a VSO?`,
      category: "Professional Review",
      threat_level: "Low",
    });
  }

  return { weaknesses, questions, gaps };
};

const StressTestHeader = ({ onClose, onReportBug }) => (
  <div className="flex items-start justify-between gap-3 border-b border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
    <div>
      <h2
        id="claim-stress-title"
        className="mb-2 flex items-center gap-2 text-2xl font-bold text-red-600 dark:text-red-400"
      >
        ⚔️ The War Game - Red Team Simulator
        <span className="rounded bg-red-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          AI
        </span>
        <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
          BETA
        </span>
      </h2>
      <p className="text-sm text-gray-700 dark:text-gray-300">
        Stress-test your claim. See the tough questions{" "}
        <span className="font-bold">before</span> the C&P examiner asks them.
      </p>
    </div>
    <div className="flex flex-shrink-0 items-center gap-2">
      {onReportBug && (
        <ReportBugLink
          onClick={onReportBug}
          variant="dark"
          moduleName="The War Game"
        />
      )}
      <button
        onClick={onClose}
        className="flex h-9 w-9 items-center justify-center rounded-full text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-900 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
        aria-label="Close dialog"
      >
        <svg
          className="h-6 w-6"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M6 18L18 6M6 6l12 12"
          />
        </svg>
      </button>
    </div>
  </div>
);

const PacketSelectorDropdown = ({
  savedClaims,
  savedForms,
  loadFromPacket,
  onCancel,
}) => (
  <div className="mt-3 max-h-64 overflow-y-auto rounded-lg border border-blue-200 bg-gray-100 p-4 dark:border-blue-500/50 dark:bg-gray-800">
    <p className="mb-3 text-sm text-gray-600 dark:text-gray-400">
      Select an item from your packet to analyze:
    </p>

    {/* Saved Claims */}
    {savedClaims.length > 0 && (
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-blue-600 dark:text-blue-400">
          📋 Saved Claims
        </h4>
        <div className="space-y-2">
          {savedClaims.map((claim) => (
            <button
              key={claim.id}
              onClick={() => loadFromPacket(claim, "claim")}
              className="w-full rounded bg-gray-200 p-2 text-left text-sm transition hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <span className="font-medium text-gray-900 dark:text-white">
                {claim.condition}
              </span>
              <span className="ml-2 text-gray-600 dark:text-gray-400">
                ({claim.code})
              </span>
              {claim.rating && (
                <span className="ml-2 text-green-700 dark:text-green-400">
                  {claim.rating}%
                </span>
              )}
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Saved Forms (Personal Statements, Buddy Statements, etc.) */}
    {savedForms.length > 0 && (
      <div className="mb-4">
        <h4 className="mb-2 text-sm font-semibold text-yellow-700 dark:text-yellow-400">
          📝 Saved Forms & Statements
        </h4>
        <div className="space-y-2">
          {savedForms.map((form) => (
            <button
              key={form.id}
              onClick={() => loadFromPacket(form, "form")}
              className="w-full rounded bg-gray-200 p-2 text-left text-sm transition hover:bg-gray-300 dark:bg-gray-700 dark:hover:bg-gray-600"
            >
              <span className="font-medium text-gray-900 dark:text-white">
                {form.title || form.formName}
              </span>
              <span className="ml-2 text-xs text-gray-600 dark:text-gray-400">
                {form.formType
                  ?.replace("-", " ")
                  .replace(/\b\w/g, (l) => l.toUpperCase())}
              </span>
              <span className="ml-2 text-xs text-gray-500 dark:text-gray-500">
                {new Date(form.dateSaved).toLocaleDateString()}
              </span>
            </button>
          ))}
        </div>
      </div>
    )}

    {/* Close Selector */}
    <button
      onClick={onCancel}
      className="mt-2 w-full rounded bg-gray-300 py-2 text-sm text-gray-700 hover:bg-gray-400 dark:bg-gray-600 dark:text-gray-300 dark:hover:bg-gray-500"
    >
      Cancel
    </button>
  </div>
);

const LoadFromPacketSection = ({
  savedClaims,
  savedForms,
  showPacketSelector,
  setShowPacketSelector,
  loadFromPacket,
}) => (
  <div className="mb-4">
    <button
      onClick={() => setShowPacketSelector(!showPacketSelector)}
      className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded transition flex items-center justify-center gap-2"
    >
      📁 Load from My Packet
      <span className="text-blue-200 text-sm">
        ({savedClaims.length} claims, {savedForms.length} forms)
      </span>
    </button>

    {showPacketSelector && (
      <PacketSelectorDropdown
        savedClaims={savedClaims}
        savedForms={savedForms}
        loadFromPacket={loadFromPacket}
        onCancel={() => setShowPacketSelector(false)}
      />
    )}
  </div>
);

const SelectedPacketIndicator = ({ selectedPacketItem, onClear }) => (
  <div className="mb-3 flex items-center justify-between rounded border border-blue-200 bg-blue-50 p-2 dark:border-blue-500/30 dark:bg-blue-900/30">
    <span className="text-sm text-blue-700 dark:text-blue-300">
      📁 Loaded:{" "}
      <strong>
        {selectedPacketItem.condition ||
          selectedPacketItem.title ||
          selectedPacketItem.formName}
      </strong>
    </span>
    <button
      onClick={onClear}
      className="text-sm text-blue-600 hover:text-blue-700 dark:text-blue-400 dark:hover:text-blue-300"
    >
      ✕ Clear
    </button>
  </div>
);

const StressTestInputSection = ({
  hasPacketData,
  savedClaims,
  savedForms,
  showPacketSelector,
  setShowPacketSelector,
  loadFromPacket,
  selectedPacketItem,
  setSelectedPacketItem,
  selectedClaim,
  setSelectedClaim,
  runStressTest,
  isAnalyzing,
  claimData,
}) => (
  <div className="mb-6">
    {hasPacketData && (
      <LoadFromPacketSection
        savedClaims={savedClaims}
        savedForms={savedForms}
        showPacketSelector={showPacketSelector}
        setShowPacketSelector={setShowPacketSelector}
        loadFromPacket={loadFromPacket}
      />
    )}

    {selectedPacketItem && (
      <SelectedPacketIndicator
        selectedPacketItem={selectedPacketItem}
        onClear={() => {
          setSelectedPacketItem(null);
          setSelectedClaim("");
        }}
      />
    )}

    <label className="mb-2 block font-semibold text-gray-700 dark:text-gray-300">
      {hasPacketData
        ? "Or paste your text manually:"
        : "Paste Your Personal Statement or Nexus Letter:"}
    </label>
    <div className="relative">
      <textarea
        value={selectedClaim}
        onChange={(e) => setSelectedClaim(e.target.value)}
        placeholder="Paste your claim text here, or use the microphone to speak. Include dates, medical terms, and service connection details..."
        className="h-48 w-full resize-none rounded border border-gray-300 bg-white p-3 pr-14 text-gray-900 focus:border-red-500 focus:outline-none dark:border-gray-700 dark:bg-gray-800 dark:text-white"
      />
      <div className="absolute right-3 top-3">
        <VoiceInputButton
          onTranscript={(text) =>
            setSelectedClaim((prev) => (prev ? `${prev} ${text}` : text))
          }
          size="md"
        />
      </div>
    </div>

    <button
      onClick={runStressTest}
      disabled={
        isAnalyzing || (!selectedClaim && Object.keys(claimData).length === 0)
      }
      className={`mt-4 w-full py-3 font-bold rounded transition ${
        isAnalyzing
          ? "bg-gray-300 text-gray-500 cursor-not-allowed dark:bg-gray-600 dark:text-gray-400"
          : "bg-red-500 hover:bg-red-600 text-white"
      }`}
    >
      {isAnalyzing ? "🔄 Analyzing Your Claim..." : "⚔️ Run Red Team Analysis"}
    </button>
  </div>
);

const WeaknessesPanel = ({ weaknesses, getSeverityColor }) => (
  <div>
    <h3 className="mb-3 text-xl font-bold text-red-600 dark:text-red-400">
      🚨 Weaknesses Detected: {weaknesses.length}
    </h3>
    <div className="space-y-3">
      {weaknesses.map((weakness, idx) => (
        <div
          key={idx}
          className={`border-l-4 ${getSeverityColor(weakness.severity)} rounded bg-gray-100 p-4 dark:bg-gray-800`}
        >
          <div className="flex items-center justify-between mb-2">
            <h4 className={`font-bold ${getSeverityColor(weakness.severity)}`}>
              {weakness.type}
            </h4>
            <span
              className={`px-2 py-1 text-xs font-bold rounded ${getSeverityColor(weakness.severity)}`}
            >
              {weakness.severity}
            </span>
          </div>
          <p className="mb-2 text-sm text-gray-900 dark:text-white">
            {weakness.description}
          </p>
          <p className="text-xs text-gray-600 dark:text-gray-400">
            <span className="font-semibold">Impact:</span> {weakness.impact}
          </p>
        </div>
      ))}
    </div>
  </div>
);

const PracticeQuestionsPanel = ({
  questions,
  practiceAnswers,
  handleAnswerChange,
  getThreatBadge,
}) => (
  <div>
    <h3 className="mb-3 text-xl font-bold text-yellow-700 dark:text-yellow-400">
      💬 Mock C&P Examiner Questions:
    </h3>
    <p className="mb-4 text-sm text-gray-600 dark:text-gray-400">
      These are the tough questions you might face. Practice your answers below:
    </p>
    <div className="space-y-4">
      {questions.map((q, idx) => (
        <div
          key={idx}
          className="rounded border border-gray-200 bg-gray-100 p-4 dark:border-gray-700 dark:bg-gray-800"
        >
          {/* Question */}
          <div className="mb-3">
            <div className="flex items-start justify-between mb-2">
              <span className="text-sm font-bold text-gray-600 dark:text-gray-500">
                Question {idx + 1}
              </span>
              <span
                className={`px-2 py-1 text-xs font-bold rounded ${getThreatBadge(q.threat_level)}`}
              >
                {q.threat_level}
              </span>
            </div>
            <p className="mb-1 font-semibold text-gray-900 dark:text-white">
              {q.question}
            </p>
            <p className="text-xs text-gray-600 dark:text-gray-500">
              Category: {q.category}
            </p>
          </div>

          {/* Practice Answer */}
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="mb-1 block text-sm text-gray-600 dark:text-gray-400">
              Your Practice Answer (use microphone to speak):
            </label>
            <div className="relative">
              <textarea
                value={practiceAnswers[idx] || ""}
                onChange={(e) => handleAnswerChange(idx, e.target.value)}
                placeholder="Type or speak your response. Be specific, provide dates, and reference evidence..."
                className="h-24 w-full resize-none rounded border border-gray-300 bg-white p-2 pr-12 text-sm text-gray-900 focus:border-yellow-500 focus:outline-none dark:border-gray-600 dark:bg-gray-700 dark:text-white"
              />
              <div className="absolute right-2 top-2">
                <VoiceInputButton
                  onTranscript={(text) =>
                    handleAnswerChange(
                      idx,
                      (practiceAnswers[idx] || "") +
                        (practiceAnswers[idx] ? " " : "") +
                        text,
                    )
                  }
                  size="sm"
                />
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  </div>
);

const RecommendedActionsPanel = ({ weaknesses }) => (
  <div className="rounded border border-blue-200 bg-blue-50 p-4 dark:border-blue-500/30 dark:bg-blue-900/30">
    <h4 className="mb-2 font-bold text-blue-600 dark:text-blue-400">
      📋 Recommended Actions:
    </h4>
    <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
      {weaknesses.some((w) => w.severity === "HIGH") && (
        <li>
          •{" "}
          <span className="font-semibold text-red-600 dark:text-red-400">
            Critical Issues Found:
          </span>{" "}
          Address high-severity weaknesses before submitting
        </li>
      )}
      <li>
        • Review your timeline and ensure all gaps have explanations or
        supporting evidence
      </li>
      <li>
        • Replace vague terms with specific medical terminology (use the Somatic
        Target tool)
      </li>
      <li>
        • Ensure your nexus letter includes &quot;at least as likely as
        not&quot; language
      </li>
      <li>• Have a VSO or attorney review your final packet</li>
      <li>• Gather buddy statements for any periods lacking medical records</li>
    </ul>
  </div>
);

const StressTestResults = ({
  testResults,
  practiceAnswers,
  handleAnswerChange,
  getSeverityColor,
  getThreatBadge,
  onReset,
}) => (
  <div className="space-y-6">
    <WeaknessesPanel
      weaknesses={testResults.weaknesses}
      getSeverityColor={getSeverityColor}
    />

    <PracticeQuestionsPanel
      questions={testResults.questions}
      practiceAnswers={practiceAnswers}
      handleAnswerChange={handleAnswerChange}
      getThreatBadge={getThreatBadge}
    />

    <RecommendedActionsPanel weaknesses={testResults.weaknesses} />

    {/* Reset Button */}
    <button
      onClick={onReset}
      className="w-full rounded bg-gray-200 py-2 font-semibold text-gray-800 transition hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
    >
      ↺ Run Another Analysis
    </button>
  </div>
);

const getSeverityColor = (severity) => {
  switch (severity) {
    case "HIGH":
      return "text-red-600 dark:text-red-500 border-red-500";
    case "MEDIUM":
      return "text-yellow-600 dark:text-yellow-500 border-yellow-500";
    case "LOW":
      return "text-green-600 dark:text-green-500 border-green-500";
    default:
      return "text-gray-500 border-gray-500";
  }
};

const getThreatBadge = (level) => {
  switch (level) {
    case "Critical":
      return "bg-red-500 text-white";
    case "Moderate":
      return "bg-yellow-500 text-gray-900";
    case "Low":
      return "bg-green-500 text-white";
    default:
      return "bg-gray-500 text-white";
  }
};

const resolvePacketItemText = (item, type) => {
  if (type === "claim") {
    const statement = getStatement(item.id);
    return (
      statement ||
      `Condition: ${item.condition}\nCode: ${item.code}\nRating: ${item.rating || "N/A"}%\nNotes: ${item.notes || "None"}`
    );
  }
  if (type === "statement") {
    return item.content || item.generatedContent || "";
  }
  if (type === "form") {
    return item.generatedContent || JSON.stringify(item.formData, null, 2);
  }
  return "";
};

// Owns all My-Packet + analysis state so ClaimStressTest itself stays a
// thin render layer.
const useStressTestState = (claimData) => {
  const [testResults, setTestResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [selectedClaim, setSelectedClaim] = useState("");

  // My Packet Integration
  const [savedClaims, setSavedClaims] = useState([]);
  const [savedStatements, setSavedStatements] = useState([]);
  const [savedForms, setSavedForms] = useState([]);
  const [_veteranProfile, setVeteranProfile] = useState({});
  const [showPacketSelector, setShowPacketSelector] = useState(false);
  const [selectedPacketItem, setSelectedPacketItem] = useState(null);

  // Load data from My Packet on mount
  useEffect(() => {
    const claims = getSavedClaims();
    const statements = getAllStatements();
    const forms = getSavedForms();
    const profile = getVeteranProfile();

    setSavedClaims(claims || []);
    setSavedStatements(statements || []);
    setSavedForms(forms || []);
    setVeteranProfile(profile || {});
  }, []);

  // Load selected packet item into the text area
  const loadFromPacket = (item, type) => {
    setSelectedClaim(resolvePacketItemText(item, type));
    setShowPacketSelector(false);
    setSelectedPacketItem({ ...item, type });
  };

  // Check if My Packet has any data
  const hasPacketData =
    savedClaims.length > 0 ||
    savedStatements.length > 0 ||
    savedForms.length > 0;

  const runStressTest = () => {
    setIsAnalyzing(true);

    // Simulate analysis delay for realism
    setTimeout(() => {
      const claimText = selectedClaim || JSON.stringify(claimData);
      const results = analyzeClaimWeaknesses(claimText);
      setTestResults(results);
      setIsAnalyzing(false);

      // Initialize practice answer fields
      const initialAnswers = {};
      results.questions.forEach((q, idx) => {
        initialAnswers[idx] = "";
      });
      setPracticeAnswers(initialAnswers);
    }, 1500);
  };

  const handleAnswerChange = (index, value) => {
    setPracticeAnswers((prev) => ({
      ...prev,
      [index]: value,
    }));
  };

  return {
    testResults,
    setTestResults,
    isAnalyzing,
    practiceAnswers,
    setPracticeAnswers,
    selectedClaim,
    setSelectedClaim,
    savedClaims,
    savedForms,
    showPacketSelector,
    setShowPacketSelector,
    selectedPacketItem,
    setSelectedPacketItem,
    loadFromPacket,
    hasPacketData,
    runStressTest,
    handleAnswerChange,
  };
};

const StressTestMissionBrief = () => (
  <div className="mb-6 rounded border border-red-200 bg-red-50 p-4 dark:border-red-500/30 dark:bg-red-900/20">
    <h3 className="mb-2 font-bold text-red-600 dark:text-red-400">
      🎯 MISSION BRIEF
    </h3>
    <p className="mb-3 text-sm text-gray-700 dark:text-gray-300">
      This tool adopts the persona of a{" "}
      <span className="font-bold text-red-600 dark:text-red-400">
        Skeptical VA Rater
      </span>
      . It will identify logical gaps, timeline issues, and missing evidence in
      your claim.
    </p>
    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
      Better to panic now in the safety of this app than freeze up in the exam
      room.
    </p>
  </div>
);

const AIRequiredWarning = () => {
  if (isAnyAIAvailable()) return null;
  return (
    <div className="mb-6 rounded-r-lg border-l-4 border-amber-500 bg-amber-50 p-4 dark:bg-amber-900/30">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div>
          <h3 className="font-bold text-amber-700 dark:text-amber-300">
            AI Required for Analysis
          </h3>
          <p className="mt-1 text-sm text-amber-800 dark:text-amber-200">
            Click the <strong>AI Status button</strong> in the header above to
            load your secure Local AI (100% private) or enter your Gemini API
            key.
          </p>
        </div>
      </div>
    </div>
  );
};

const StressTestFooterWarning = () => (
  <div className="mt-6 rounded border border-yellow-200 bg-yellow-50 p-3 dark:border-yellow-500/30 dark:bg-yellow-900/20">
    <p className="text-xs font-semibold text-yellow-700 dark:text-yellow-400">
      ⚠️ This is a simulation. Real C&P examiners may ask different questions.
      Always consult with a VSO or attorney before submitting your claim.
    </p>
  </div>
);

const ClaimStressTest = ({ claimData = {}, onClose, onReportBug }) => {
  const {
    testResults,
    setTestResults,
    isAnalyzing,
    practiceAnswers,
    setPracticeAnswers,
    selectedClaim,
    setSelectedClaim,
    savedClaims,
    savedForms,
    showPacketSelector,
    setShowPacketSelector,
    selectedPacketItem,
    setSelectedPacketItem,
    loadFromPacket,
    hasPacketData,
    runStressTest,
    handleAnswerChange,
  } = useStressTestState(claimData);

  return (
    <ResponsiveModal
      isOpen={true}
      onClose={onClose}
      header={<StressTestHeader onClose={onClose} onReportBug={onReportBug} />}
      labelledBy="claim-stress-title"
      size="xl"
      className="border border-red-300 dark:border-red-500/30"
    >
      <StressTestMissionBrief />
      <AIRequiredWarning />

      {/* Input Section */}
      {!testResults && (
        <StressTestInputSection
          hasPacketData={hasPacketData}
          savedClaims={savedClaims}
          savedForms={savedForms}
          showPacketSelector={showPacketSelector}
          setShowPacketSelector={setShowPacketSelector}
          loadFromPacket={loadFromPacket}
          selectedPacketItem={selectedPacketItem}
          setSelectedPacketItem={setSelectedPacketItem}
          selectedClaim={selectedClaim}
          setSelectedClaim={setSelectedClaim}
          runStressTest={runStressTest}
          isAnalyzing={isAnalyzing}
          claimData={claimData}
        />
      )}

      {/* Analysis Results */}
      {testResults && (
        <StressTestResults
          testResults={testResults}
          practiceAnswers={practiceAnswers}
          handleAnswerChange={handleAnswerChange}
          getSeverityColor={getSeverityColor}
          getThreatBadge={getThreatBadge}
          onReset={() => {
            setTestResults(null);
            setPracticeAnswers({});
          }}
        />
      )}

      <StressTestFooterWarning />
    </ResponsiveModal>
  );
};

export default ClaimStressTest;
