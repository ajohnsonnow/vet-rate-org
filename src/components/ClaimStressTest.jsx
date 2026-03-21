/**
 * ClaimStressTest - Red Team Simulator
 * "The War Game" - Prepare for the toughest C&P examiner questions
 *
 * The Problem: Veterans submit claims thinking they're perfect, then get blindsided
 * The Solution: AI-powered adversarial review that finds weaknesses before the VA does
 */

import React, { useState, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  getSavedClaims,
  getStatement,
  getAllStatements,
} from "../utils/claimsStorage";
import { getVeteranProfile, getSavedForms } from "../utils/veteranProfile";
import { isAnyAIAvailable, generateAI } from "../utils/unifiedAIService";
import ReportBugLink from "./ReportBugLink";
import VoiceInputButton from "./VoiceInput";

const ClaimStressTest = ({ claimData = {}, onClose, onReportBug }) => {
  const { t } = useLanguage();
  const [testResults, setTestResults] = useState(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [practiceAnswers, setPracticeAnswers] = useState({});
  const [selectedClaim, setSelectedClaim] = useState("");

  // My Packet Integration
  const [savedClaims, setSavedClaims] = useState([]);
  const [savedStatements, setSavedStatements] = useState([]);
  const [savedForms, setSavedForms] = useState([]);
  const [veteranProfile, setVeteranProfile] = useState({});
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
    let text = "";

    if (type === "claim") {
      const statement = getStatement(item.id);
      text =
        statement ||
        `Condition: ${item.condition}\nCode: ${item.code}\nRating: ${item.rating || "N/A"}%\nNotes: ${item.notes || "None"}`;
    } else if (type === "statement") {
      text = item.content || item.generatedContent || "";
    } else if (type === "form") {
      text = item.generatedContent || JSON.stringify(item.formData, null, 2);
    }

    setSelectedClaim(text);
    setShowPacketSelector(false);
    setSelectedPacketItem({ ...item, type });
  };

  // Check if My Packet has any data
  const hasPacketData =
    savedClaims.length > 0 ||
    savedStatements.length > 0 ||
    savedForms.length > 0;

  // Red Team Analysis Logic - Simulates skeptical VA examiner
  const analyzeClaimWeaknesses = (claim) => {
    const weaknesses = [];
    const questions = [];
    const gaps = [];

    // Parse claim data
    const text = typeof claim === "string" ? claim : JSON.stringify(claim);
    const lowerText = text.toLowerCase();

    // Timeline Gap Detection
    const yearPattern = /\b(19|20)\d{2}\b/g;
    const years = text
      .match(yearPattern)
      ?.map((y) => parseInt(y))
      .sort();

    if (years && years.length >= 2) {
      const firstYear = years[0];
      const lastYear = years[years.length - 1];
      const gap = lastYear - firstYear;

      if (gap > 10) {
        weaknesses.push({
          type: "Timeline Gap",
          severity: "HIGH",
          description: `${gap}-year gap between earliest and latest dates mentioned`,
          impact: "VA may question continuity of condition",
        });

        questions.push({
          question: `Your statement mentions events from ${firstYear}, but your most recent medical evidence is from ${lastYear}. That's a ${gap}-year gap. What medical treatment or documentation do you have for the years in between?`,
          category: "Continuity of Evidence",
          threat_level: "Critical",
        });
      }
    }

    // Medical Terminology Inconsistency
    if (
      lowerText.includes("hurt") ||
      lowerText.includes("pain") ||
      lowerText.includes("sore")
    ) {
      if (
        !lowerText.includes("chronic") &&
        !lowerText.includes("acute") &&
        !lowerText.includes("persistent")
      ) {
        weaknesses.push({
          type: "Vague Medical Description",
          severity: "MEDIUM",
          description: "Using layman terms without medical specificity",
          impact: "May be rated lower due to unclear symptom description",
        });

        questions.push({
          question: `You describe symptoms as "hurting" or "painful." Can you provide specific medical terminology? For example: Is it chronic (lasting 6+ months)? Is it radicular (shooting pain)? Is it localized or diffuse?`,
          category: "Medical Specificity",
          threat_level: "Moderate",
        });
      }
    }

    // Missing Nexus Language
    if (
      !lowerText.includes("as likely as not") &&
      !lowerText.includes("at least as likely")
    ) {
      weaknesses.push({
        type: "Missing Nexus Standard",
        severity: "HIGH",
        description: 'No clear "at least as likely as not" nexus language',
        impact: "VA requires 50%+ probability language for service connection",
      });

      questions.push({
        question: `Where in your statement or nexus letter does it explicitly state that your condition is "at least as likely as not" connected to service? The VA requires this specific probability threshold.`,
        category: "Legal Standard",
        threat_level: "Critical",
      });
    }

    // Service Record Conflict Detection
    const servicePatterns = [
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

    const mentionsService = servicePatterns.some((pattern) =>
      lowerText.includes(pattern),
    );
    const mentionsNoRecords =
      lowerText.includes("no record") ||
      lowerText.includes("lost record") ||
      lowerText.includes("missing record");

    if (mentionsService && mentionsNoRecords) {
      weaknesses.push({
        type: "Service Record Gap",
        severity: "HIGH",
        description: "Claims service event but acknowledges missing records",
        impact: "VA may deny without buddy statements or other corroboration",
      });

      questions.push({
        question: `You mention significant service events but also state that records are missing. What alternative evidence do you have? Buddy statements? Unit rosters? After-action reports? The VA will not simply take your word.`,
        category: "Burden of Proof",
        threat_level: "Critical",
      });
    }

    // Inconsistent Dates
    const hasDateInconsistency =
      lowerText.includes("2010") &&
      lowerText.includes("2012") &&
      (lowerText.includes("started") || lowerText.includes("began"));

    if (hasDateInconsistency) {
      weaknesses.push({
        type: "Date Inconsistency",
        severity: "MEDIUM",
        description: "Multiple dates mentioned for same event",
        impact: "Credibility concerns if dates conflict",
      });

      questions.push({
        question: `I see multiple dates in your statement. Can you clarify the exact timeline? Which date is when the injury occurred vs. when you first sought treatment vs. when you were diagnosed?`,
        category: "Factual Accuracy",
        threat_level: "Moderate",
      });
    }

    // Aggravation vs. Causation
    if (lowerText.includes("made worse") || lowerText.includes("aggravated")) {
      if (
        !lowerText.includes("pre-existing") &&
        !lowerText.includes("before service")
      ) {
        weaknesses.push({
          type: "Aggravation Claim Unclear",
          severity: "MEDIUM",
          description:
            "Mentions aggravation but unclear if condition pre-existed service",
          impact:
            "VA distinguishes between service-connected conditions and aggravated conditions",
        });

        questions.push({
          question: `You state your condition was "made worse" during service. Did this condition exist before service? If so, you're filing an aggravation claim, not a direct service connection claim. Can you clarify?`,
          category: "Claim Type",
          threat_level: "Moderate",
        });
      }
    }

    // No Functional Impact Described
    const functionalKeywords = [
      "unable",
      "cannot",
      "difficulty",
      "limitation",
      "restricted",
      "prevents me from",
    ];
    const hasFunctionalImpact = functionalKeywords.some((keyword) =>
      lowerText.includes(keyword),
    );

    if (!hasFunctionalImpact) {
      weaknesses.push({
        type: "Missing Functional Impact",
        severity: "HIGH",
        description:
          "Does not describe how condition affects daily life or work",
        impact: "VA rates based on functional impairment, not just diagnosis",
      });

      questions.push({
        question: `How does this condition affect your daily life? Can you work? Can you walk? Can you sleep? The VA rates disabilities based on functional impairment, not just the diagnosis itself.`,
        category: "Functional Assessment",
        threat_level: "Critical",
      });
    }

    // Lack of Current Treatment
    const currentTreatment =
      lowerText.includes("currently taking") ||
      lowerText.includes("see a doctor") ||
      lowerText.includes("physical therapy") ||
      lowerText.includes("medication");

    if (
      !currentTreatment &&
      !lowerText.includes("no longer") &&
      !lowerText.includes("stopped treatment")
    ) {
      weaknesses.push({
        type: "No Current Treatment Mentioned",
        severity: "MEDIUM",
        description: "No mention of current medical treatment",
        impact: "VA may question severity if not seeking treatment",
      });

      questions.push({
        question: `Are you currently receiving treatment for this condition? If not, why not? The VA may question the severity of your condition if you're not actively seeking medical care.`,
        category: "Treatment History",
        threat_level: "Moderate",
      });
    }

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

  const getSeverityColor = (severity) => {
    switch (severity) {
      case "HIGH":
        return "text-red-500 border-red-500";
      case "MEDIUM":
        return "text-yellow-500 border-yellow-500";
      case "LOW":
        return "text-green-500 border-green-500";
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

  return (
    <div className="bg-gray-900 border border-red-500/30 rounded-lg p-6 relative">
      {/* Close Button and Bug Report */}
      <div className="absolute top-4 right-4 flex items-center gap-2 z-10">
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="dark"
            moduleName="The War Game"
          />
        )}
        {onClose && (
          <button
            onClick={onClose}
            className="w-10 h-10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-gray-700 rounded-full transition-colors"
            aria-label="Close"
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>

      {/* Header */}
      <div className="mb-6 pr-12">
        <h2 className="text-2xl font-bold text-red-400 mb-2 flex items-center gap-2">
          ⚔️ The War Game - Red Team Simulator
          <span className="px-1.5 py-0.5 bg-red-500 text-white text-[10px] font-bold rounded">
            AI
          </span>
          <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
            BETA
          </span>
        </h2>
        <p className="text-gray-300 text-sm">
          Stress-test your claim. See the tough questions{" "}
          <span className="font-bold">before</span> the C&P examiner asks them.
        </p>
      </div>

      {/* Mission Brief */}
      <div className="bg-red-900/20 border border-red-500/30 rounded p-4 mb-6">
        <h3 className="text-red-400 font-bold mb-2">🎯 MISSION BRIEF</h3>
        <p className="text-gray-300 text-sm mb-3">
          This tool adopts the persona of a{" "}
          <span className="font-bold text-red-400">Skeptical VA Rater</span>. It
          will identify logical gaps, timeline issues, and missing evidence in
          your claim.
        </p>
        <p className="text-yellow-400 text-xs font-semibold">
          Better to panic now in the safety of this app than freeze up in the
          exam room.
        </p>
      </div>

      {/* AI Required Warning */}
      {!isAnyAIAvailable() && (
        <div className="bg-amber-900/30 border-l-4 border-amber-500 p-4 mb-6 rounded-r-lg">
          <div className="flex items-start gap-3">
            <span className="text-2xl">💡</span>
            <div>
              <h3 className="font-bold text-amber-300">
                AI Required for Analysis
              </h3>
              <p className="text-amber-200 text-sm mt-1">
                Click the <strong>AI Status button</strong> in the header above
                to load your secure Local AI (100% private) or enter your Gemini
                API key.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Input Section */}
      {!testResults && (
        <div className="mb-6">
          {/* Load from My Packet Button */}
          {hasPacketData && (
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

              {/* Packet Selector Dropdown */}
              {showPacketSelector && (
                <div className="mt-3 bg-gray-800 border border-blue-500/50 rounded-lg p-4 max-h-64 overflow-y-auto">
                  <p className="text-gray-400 text-sm mb-3">
                    Select an item from your packet to analyze:
                  </p>

                  {/* Saved Claims */}
                  {savedClaims.length > 0 && (
                    <div className="mb-4">
                      <h4 className="text-blue-400 font-semibold text-sm mb-2">
                        📋 Saved Claims
                      </h4>
                      <div className="space-y-2">
                        {savedClaims.map((claim) => (
                          <button
                            key={claim.id}
                            onClick={() => loadFromPacket(claim, "claim")}
                            className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                          >
                            <span className="text-white font-medium">
                              {claim.condition}
                            </span>
                            <span className="text-gray-400 ml-2">
                              ({claim.code})
                            </span>
                            {claim.rating && (
                              <span className="text-green-400 ml-2">
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
                      <h4 className="text-yellow-400 font-semibold text-sm mb-2">
                        📝 Saved Forms & Statements
                      </h4>
                      <div className="space-y-2">
                        {savedForms.map((form) => (
                          <button
                            key={form.id}
                            onClick={() => loadFromPacket(form, "form")}
                            className="w-full text-left p-2 bg-gray-700 hover:bg-gray-600 rounded text-sm transition"
                          >
                            <span className="text-white font-medium">
                              {form.title || form.formName}
                            </span>
                            <span className="text-gray-400 ml-2 text-xs">
                              {form.formType
                                ?.replace("-", " ")
                                .replace(/\b\w/g, (l) => l.toUpperCase())}
                            </span>
                            <span className="text-gray-500 ml-2 text-xs">
                              {new Date(form.dateSaved).toLocaleDateString()}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Close Selector */}
                  <button
                    onClick={() => setShowPacketSelector(false)}
                    className="w-full py-2 bg-gray-600 hover:bg-gray-500 text-gray-300 text-sm rounded mt-2"
                  >
                    Cancel
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Selected Item Indicator */}
          {selectedPacketItem && (
            <div className="mb-3 p-2 bg-blue-900/30 border border-blue-500/30 rounded flex items-center justify-between">
              <span className="text-blue-300 text-sm">
                📁 Loaded:{" "}
                <strong>
                  {selectedPacketItem.condition ||
                    selectedPacketItem.title ||
                    selectedPacketItem.formName}
                </strong>
              </span>
              <button
                onClick={() => {
                  setSelectedPacketItem(null);
                  setSelectedClaim("");
                }}
                className="text-blue-400 hover:text-blue-300 text-sm"
              >
                ✕ Clear
              </button>
            </div>
          )}

          <label className="block text-gray-300 font-semibold mb-2">
            {hasPacketData
              ? "Or paste your text manually:"
              : "Paste Your Personal Statement or Nexus Letter:"}
          </label>
          <div className="relative">
            <textarea
              value={selectedClaim}
              onChange={(e) => setSelectedClaim(e.target.value)}
              placeholder="Paste your claim text here, or use the microphone to speak. Include dates, medical terms, and service connection details..."
              className="w-full h-48 bg-gray-800 border border-gray-700 rounded p-3 pr-14 text-white resize-none focus:border-red-500 focus:outline-none"
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
              isAnalyzing ||
              (!selectedClaim && Object.keys(claimData).length === 0)
            }
            className={`mt-4 w-full py-3 font-bold rounded transition ${
              isAnalyzing
                ? "bg-gray-600 text-gray-400 cursor-not-allowed"
                : "bg-red-500 hover:bg-red-600 text-white"
            }`}
          >
            {isAnalyzing
              ? "🔄 Analyzing Your Claim..."
              : "⚔️ Run Red Team Analysis"}
          </button>
        </div>
      )}

      {/* Analysis Results */}
      {testResults && (
        <div className="space-y-6">
          {/* Weaknesses Detected */}
          <div>
            <h3 className="text-xl font-bold text-red-400 mb-3">
              🚨 Weaknesses Detected: {testResults.weaknesses.length}
            </h3>
            <div className="space-y-3">
              {testResults.weaknesses.map((weakness, idx) => (
                <div
                  key={idx}
                  className={`border-l-4 ${getSeverityColor(weakness.severity)} bg-gray-800 p-4 rounded`}
                >
                  <div className="flex items-center justify-between mb-2">
                    <h4
                      className={`font-bold ${getSeverityColor(weakness.severity)}`}
                    >
                      {weakness.type}
                    </h4>
                    <span
                      className={`px-2 py-1 text-xs font-bold rounded ${getSeverityColor(weakness.severity)}`}
                    >
                      {weakness.severity}
                    </span>
                  </div>
                  <p className="text-white text-sm mb-2">
                    {weakness.description}
                  </p>
                  <p className="text-gray-400 text-xs">
                    <span className="font-semibold">Impact:</span>{" "}
                    {weakness.impact}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Hard Questions (Mock Exam) */}
          <div>
            <h3 className="text-xl font-bold text-yellow-400 mb-3">
              💬 Mock C&P Examiner Questions:
            </h3>
            <p className="text-gray-400 text-sm mb-4">
              These are the tough questions you might face. Practice your
              answers below:
            </p>
            <div className="space-y-4">
              {testResults.questions.map((q, idx) => (
                <div
                  key={idx}
                  className="bg-gray-800 border border-gray-700 rounded p-4"
                >
                  {/* Question */}
                  <div className="mb-3">
                    <div className="flex items-start justify-between mb-2">
                      <span className="text-gray-500 font-bold text-sm">
                        Question {idx + 1}
                      </span>
                      <span
                        className={`px-2 py-1 text-xs font-bold rounded ${getThreatBadge(q.threat_level)}`}
                      >
                        {q.threat_level}
                      </span>
                    </div>
                    <p className="text-white font-semibold mb-1">
                      {q.question}
                    </p>
                    <p className="text-gray-500 text-xs">
                      Category: {q.category}
                    </p>
                  </div>

                  {/* Practice Answer */}
                  <div>
                    <label className="block text-gray-400 text-sm mb-1">
                      Your Practice Answer (use microphone to speak):
                    </label>
                    <div className="relative">
                      <textarea
                        value={practiceAnswers[idx] || ""}
                        onChange={(e) =>
                          handleAnswerChange(idx, e.target.value)
                        }
                        placeholder="Type or speak your response. Be specific, provide dates, and reference evidence..."
                        className="w-full h-24 bg-gray-700 border border-gray-600 rounded p-2 pr-12 text-white text-sm resize-none focus:border-yellow-500 focus:outline-none"
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

          {/* Recommendations */}
          <div className="bg-blue-900/30 border border-blue-500/30 rounded p-4">
            <h4 className="text-blue-400 font-bold mb-2">
              📋 Recommended Actions:
            </h4>
            <ul className="text-gray-300 text-sm space-y-2">
              {testResults.weaknesses.some((w) => w.severity === "HIGH") && (
                <li>
                  •{" "}
                  <span className="text-red-400 font-semibold">
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
                • Replace vague terms with specific medical terminology (use the
                Somatic Target tool)
              </li>
              <li>
                • Ensure your nexus letter includes "at least as likely as not"
                language
              </li>
              <li>• Have a VSO or attorney review your final packet</li>
              <li>
                • Gather buddy statements for any periods lacking medical
                records
              </li>
            </ul>
          </div>

          {/* Reset Button */}
          <button
            onClick={() => {
              setTestResults(null);
              setPracticeAnswers({});
            }}
            className="w-full py-2 bg-gray-700 hover:bg-gray-600 text-white font-semibold rounded transition"
          >
            ↺ Run Another Analysis
          </button>
        </div>
      )}

      {/* Footer Warning */}
      <div className="mt-6 bg-yellow-900/20 border border-yellow-500/30 rounded p-3">
        <p className="text-yellow-400 text-xs font-semibold">
          ⚠️ This is a simulation. Real C&P examiners may ask different
          questions. Always consult with a VSO or attorney before submitting
          your claim.
        </p>
      </div>
    </div>
  );
};

export default ClaimStressTest;
