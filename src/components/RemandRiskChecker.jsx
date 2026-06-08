/**
 * Vet-Rate.org - Pre-Submission Remand Risk Checker
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * Helps veterans identify gaps BEFORE submitting claims.
 * Based on top remand reasons from 18,609 BVA decisions.
 */

import { useState, useMemo } from "react";
import {
  TOP_REMAND_REASONS,
  TOP_DENIAL_REASONS,
  BVA_OVERALL_OUTCOMES,
  getPersistenceMessage,
} from "../data/bvaSuccessData";
import ResponsiveModal from "./common/ResponsiveModal";

const RemandRiskChecker = ({ onClose }) => {
  const [answers, setAnswers] = useState({});
  const [priorDenials, setPriorDenials] = useState(0);
  const [showDetails, setShowDetails] = useState(false);

  const questions = [
    {
      id: "currentDiagnosis",
      question: "Do you have a current medical diagnosis for the condition?",
      risk: "Diagnosis missing",
      weight: 3,
      tip: "VA requires a current diagnosis. Even if you had it in service, you need proof you still have it.",
    },
    {
      id: "nexusOpinion",
      question:
        "Do you have a nexus opinion linking your condition to service?",
      risk: "Nexus gap",
      weight: 4,
      tip: 'This is the #1 reason for denials. A doctor needs to say "it is at least as likely as not" that your condition is related to service.',
    },
    {
      id: "nexusRationale",
      question:
        "Does your nexus letter include detailed rationale explaining WHY the conditions are connected?",
      risk: "Inadequate nexus opinion",
      weight: 3,
      tip: "Conclusory opinions without explanation are frequently remanded. Ask your doctor to explain the medical mechanism.",
    },
    {
      id: "serviceRecordEvent",
      question:
        "Do your service records document the in-service event, injury, or illness?",
      risk: "In-service event missing",
      weight: 3,
      tip: "If not in your STRs, lay statements from you and buddies can establish the in-service event.",
    },
    {
      id: "layStatements",
      question:
        "Have you provided personal and/or buddy statements about your condition?",
      risk: "Lay evidence gap",
      weight: 2,
      tip: "Lay evidence showing symptom continuity from service to now is often decisive at BVA.",
    },
    {
      id: "medicalRecordsContinuity",
      question:
        "Do you have medical records showing treatment from separation to now?",
      risk: "Continuity gap",
      weight: 2,
      tip: "Gaps in treatment can be explained with lay evidence about self-treatment or financial barriers.",
    },
    {
      id: "cpExamScheduled",
      question:
        "Are you prepared to request a new C&P exam if the one you get seems inadequate?",
      risk: "Inadequate examination",
      weight: 2,
      tip: "If the exam is too short, the examiner doesn't review your records, or the rationale is missing - challenge it.",
    },
    {
      id: "rightSpecialist",
      question:
        "Will your C&P exam be with an appropriate specialist for your condition?",
      risk: "Inadequate specialist",
      weight: 2,
      tip: "A back condition should be seen by an orthopedist, not a general practitioner. Request the right specialist.",
    },
  ];

  const handleAnswer = (id, value) => {
    setAnswers((prev) => ({ ...prev, [id]: value }));
  };

  const analysis = useMemo(() => {
    const totalQuestions = questions.length;
    const answeredCount = Object.keys(answers).length;
    const yesCount = Object.values(answers).filter((v) => v === "yes").length;
    const noCount = Object.values(answers).filter((v) => v === "no").length;

    let riskScore = 0;
    const gaps = [];

    questions.forEach((q) => {
      if (answers[q.id] === "no") {
        riskScore += q.weight;
        gaps.push({
          question: q.question,
          risk: q.risk,
          tip: q.tip,
          weight: q.weight,
        });
      }
    });

    // Normalize risk score to 0-100
    const maxRisk = questions.reduce((sum, q) => sum + q.weight, 0);
    const riskPercentage = Math.round((riskScore / maxRisk) * 100);

    let riskLevel;
    if (riskPercentage <= 20) riskLevel = "low";
    else if (riskPercentage <= 50) riskLevel = "moderate";
    else if (riskPercentage <= 75) riskLevel = "high";
    else riskLevel = "critical";

    return {
      answeredCount,
      totalQuestions,
      yesCount,
      noCount,
      riskScore,
      riskPercentage,
      riskLevel,
      gaps,
      isComplete: answeredCount === totalQuestions,
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [answers]);

  const persistenceMsg = getPersistenceMessage(priorDenials);

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="remand-risk-title"
      header={
        <div className="flex items-center justify-between bg-gradient-to-r from-amber-500 to-orange-600 p-4 text-white">
          <div>
            <h2
              id="remand-risk-title"
              className="text-xl font-bold flex items-center gap-2"
            >
              🔍 Pre-Submission Remand Risk Checker
            </h2>
            <p className="text-amber-100 text-sm">
              Find gaps before VA finds them
            </p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="text-white hover:text-amber-200 text-2xl"
          >
            ×
          </button>
        </div>
      }
    >
      <div className="space-y-6">
        {/* BVA Stats Banner */}
        <div className="bg-gray-100 dark:bg-gray-700 rounded-lg p-4 flex flex-wrap gap-4 justify-around text-center">
          <div>
            <div className="text-3xl font-bold text-green-600">
              {BVA_OVERALL_OUTCOMES.granted}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Granted
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-yellow-600">
              {BVA_OVERALL_OUTCOMES.remanded}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Remanded
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-red-600">
              {BVA_OVERALL_OUTCOMES.denied}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Denied
            </div>
          </div>
          <div>
            <div className="text-3xl font-bold text-indigo-600">
              {BVA_OVERALL_OUTCOMES.favorableRate}%
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Favorable (Grant+Remand)
            </div>
          </div>
        </div>

        {/* Prior Denials Input */}
        <div className="bg-blue-50 dark:bg-blue-900/30 rounded-lg p-4">
          {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
          <label className="block text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
            How many times has this claim been previously denied? (0 if first
            time)
          </label>
          <input
            type="number"
            min="0"
            max="10"
            value={priorDenials}
            onChange={(e) => setPriorDenials(parseInt(e.target.value) || 0)}
            className="w-24 p-2 border rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
          />
          <div className="mt-2 text-sm text-blue-700 dark:text-blue-400">
            {persistenceMsg.emoji} {persistenceMsg.message}
          </div>
          <div className="text-xs text-blue-600 dark:text-blue-500 mt-1">
            {persistenceMsg.encouragement}
          </div>
        </div>

        {/* Questions */}
        <div className="space-y-4">
          <h3 className="font-semibold text-lg text-gray-900 dark:text-white">
            Evidence Checklist
          </h3>
          {questions.map((q, idx) => (
            <div
              key={q.id}
              className={`p-4 rounded-lg border-2 transition-colors ${
                answers[q.id] === "yes"
                  ? "border-green-300 bg-green-50 dark:bg-green-900/20 dark:border-green-700"
                  : answers[q.id] === "no"
                    ? "border-red-300 bg-red-50 dark:bg-red-900/20 dark:border-red-700"
                    : "border-gray-200 dark:border-gray-600"
              }`}
            >
              <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">
                    {idx + 1}. {q.question}
                  </p>
                  <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                    {q.tip}
                  </p>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => handleAnswer(q.id, "yes")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      answers[q.id] === "yes"
                        ? "bg-green-600 text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-green-100 dark:hover:bg-green-800"
                    }`}
                  >
                    ✓ Yes
                  </button>
                  <button
                    onClick={() => handleAnswer(q.id, "no")}
                    className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                      answers[q.id] === "no"
                        ? "bg-red-600 text-white"
                        : "bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-300 hover:bg-red-100 dark:hover:bg-red-800"
                    }`}
                  >
                    ✗ No
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Analysis Results */}
        {analysis.answeredCount > 0 && (
          <div className="space-y-4">
            {/* Risk Score */}
            <div
              className={`p-5 rounded-lg ${
                analysis.riskLevel === "low"
                  ? "bg-green-100 dark:bg-green-900/30"
                  : analysis.riskLevel === "moderate"
                    ? "bg-yellow-100 dark:bg-yellow-900/30"
                    : analysis.riskLevel === "high"
                      ? "bg-orange-100 dark:bg-orange-900/30"
                      : "bg-red-100 dark:bg-red-900/30"
              }`}
            >
              <div className="flex items-center gap-4">
                <div
                  className={`text-5xl font-bold ${
                    analysis.riskLevel === "low"
                      ? "text-green-600"
                      : analysis.riskLevel === "moderate"
                        ? "text-yellow-600"
                        : analysis.riskLevel === "high"
                          ? "text-orange-600"
                          : "text-red-600"
                  }`}
                >
                  {analysis.riskPercentage}%
                </div>
                <div>
                  <div
                    className={`text-xl font-bold ${
                      analysis.riskLevel === "low"
                        ? "text-green-700 dark:text-green-400"
                        : analysis.riskLevel === "moderate"
                          ? "text-yellow-700 dark:text-yellow-400"
                          : analysis.riskLevel === "high"
                            ? "text-orange-700 dark:text-orange-400"
                            : "text-red-700 dark:text-red-400"
                    }`}
                  >
                    {analysis.riskLevel === "low"
                      ? "✓ LOW Remand Risk"
                      : analysis.riskLevel === "moderate"
                        ? "⚠ MODERATE Remand Risk"
                        : analysis.riskLevel === "high"
                          ? "⚠ HIGH Remand Risk"
                          : "🚨 CRITICAL Risk - Address Gaps First"}
                  </div>
                  <div className="text-sm text-gray-600 dark:text-gray-400">
                    {analysis.yesCount}/{analysis.totalQuestions} evidence
                    requirements met
                  </div>
                </div>
              </div>
            </div>

            {/* Gaps to Address */}
            {analysis.gaps.length > 0 && (
              <div className="bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-700 rounded-lg p-4">
                <h4 className="font-semibold text-amber-800 dark:text-amber-300 mb-3">
                  🎯 Address These Gaps Before Filing:
                </h4>
                <ul className="space-y-3">
                  {analysis.gaps
                    .sort((a, b) => b.weight - a.weight)
                    .map((gap, idx) => (
                      <li key={idx} className="flex items-start gap-2">
                        <span
                          className={`px-2 py-0.5 rounded text-xs font-bold ${
                            gap.weight >= 4
                              ? "bg-red-200 text-red-800"
                              : gap.weight >= 3
                                ? "bg-orange-200 text-orange-800"
                                : "bg-yellow-200 text-yellow-800"
                          }`}
                        >
                          {gap.weight >= 4
                            ? "CRITICAL"
                            : gap.weight >= 3
                              ? "HIGH"
                              : "MEDIUM"}
                        </span>
                        <div>
                          <div className="text-sm font-medium text-amber-900 dark:text-amber-200">
                            {gap.risk}
                          </div>
                          <div className="text-xs text-amber-700 dark:text-amber-400">
                            {gap.tip}
                          </div>
                        </div>
                      </li>
                    ))}
                </ul>
              </div>
            )}

            {/* Ready to Submit */}
            {analysis.isComplete && analysis.riskLevel === "low" && (
              <div className="bg-green-100 dark:bg-green-900/30 border border-green-300 dark:border-green-700 rounded-lg p-4 text-center">
                <div className="text-4xl mb-2">🎉</div>
                <div className="text-xl font-bold text-green-700 dark:text-green-400">
                  Your Evidence Looks Strong!
                </div>
                <p className="text-sm text-green-600 dark:text-green-500 mt-1">
                  Based on BVA decision patterns, your claim appears
                  well-documented. You&apos;ve addressed the most common remand
                  reasons.
                </p>
              </div>
            )}
          </div>
        )}

        {/* Top Remand Reasons Reference */}
        <div>
          <button
            onClick={() => setShowDetails(!showDetails)}
            className="text-amber-600 dark:text-amber-400 hover:underline text-sm font-medium"
          >
            {showDetails ? "▼ Hide" : "▶ Show"} Top BVA Remand & Denial Reasons
          </button>

          {showDetails && (
            <div className="mt-4 grid md:grid-cols-2 gap-4">
              <div className="bg-yellow-50 dark:bg-yellow-900/30 rounded-lg p-4">
                <h5 className="font-semibold text-yellow-700 dark:text-yellow-300 mb-2">
                  Top Remand Reasons
                </h5>
                {TOP_REMAND_REASONS.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm mb-1">
                    <span className="text-yellow-600 dark:text-yellow-400">
                      {item.reason}
                    </span>
                    <span className="text-yellow-800 dark:text-yellow-300 font-mono">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
              <div className="bg-red-50 dark:bg-red-900/30 rounded-lg p-4">
                <h5 className="font-semibold text-red-700 dark:text-red-300 mb-2">
                  Top Denial Reasons
                </h5>
                {TOP_DENIAL_REASONS.slice(0, 5).map((item, idx) => (
                  <div key={idx} className="flex justify-between text-sm mb-1">
                    <span className="text-red-600 dark:text-red-400">
                      {item.reason}
                    </span>
                    <span className="text-red-800 dark:text-red-300 font-mono">
                      {item.count}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </ResponsiveModal>
  );
};

export default RemandRiskChecker;
