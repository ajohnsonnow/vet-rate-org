/**
 * Vet-Rate.org - Doctor's Packet Generator Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Generates comprehensive research packets to help veterans
 * get nexus letters from their private physicians.
 */

import { useState, useEffect } from "react";
import {
  generateDoctorsPacket,
  formatDoctorLetter,
  getNexusLogicPrivacyDisclosure,
} from "../utils/nexusLogicGenerator";
import ResponsiveModal from "./common/ResponsiveModal";
import { isAnyAIAvailable } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import ToolCardButton from "./ToolCardButton";

// Icons
const BrainIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
    />
  </svg>
);

const DocumentIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
    />
  </svg>
);

const DownloadIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
    />
  </svg>
);

const PrintIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm8-12V5a2 2 0 00-2-2H9a2 2 0 00-2 2v4h10z"
    />
  </svg>
);

const CheckIcon = () => (
  <svg
    className="h-4 w-4"
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
    className="h-4 w-4"
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

const AlertIcon = () => (
  <svg
    className="h-5 w-5"
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

const LinkIcon = () => (
  <svg
    className="h-4 w-4"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
    />
  </svg>
);

const SparklesIcon = () => (
  <svg
    className="h-5 w-5"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
    />
  </svg>
);

/**
 * Strength badge colors
 */
const getStrengthColor = (strength) => {
  switch (strength?.toLowerCase()) {
    case "strong":
      return "bg-green-100 text-green-700 border-green-300 dark:bg-green-500/20 dark:text-green-300 dark:border-green-500/30";
    case "moderate":
      return "bg-yellow-100 text-yellow-700 border-yellow-300 dark:bg-yellow-500/20 dark:text-yellow-300 dark:border-yellow-500/30";
    case "weak":
      return "bg-red-100 text-red-700 border-red-300 dark:bg-red-500/20 dark:text-red-300 dark:border-red-500/30";
    default:
      return "bg-gray-100 text-gray-700 border-gray-300 dark:bg-gray-500/20 dark:text-gray-300 dark:border-gray-500/30";
  }
};

/**
 * Doctor's Packet Generator Modal/Component
 */
export default function DoctorsPacket({
  isOpen,
  onClose,
  primaryCondition: initialPrimary = "",
  secondaryCondition: initialSecondary = "",
  _existingMechanism = null,
  _existingCitations = null,
  onOpenAISettings,
}) {
  // State
  const [step, setStep] = useState("consent"); // consent, input, loading, result, error
  const [primaryCondition, setPrimaryCondition] = useState(initialPrimary);
  const [secondaryCondition, setSecondaryCondition] =
    useState(initialSecondary);
  const [packetData, setPacketData] = useState(null);
  const [error, setError] = useState(null);
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [apiKey, setApiKey] = useState("");

  // Load API key and set initial values
  useEffect(() => {
    const storedKey = localStorage.getItem("vetrate_gemini_key");
    if (storedKey) {
      setApiKey(storedKey);
    }

    // Check for existing consent
    const consent = localStorage.getItem("vetrate_ai_consent");
    if (consent === "true" && initialPrimary && initialSecondary) {
      setStep("input");
    }
  }, [initialPrimary, initialSecondary]);

  // Update conditions when props change
  useEffect(() => {
    if (initialPrimary) setPrimaryCondition(initialPrimary);
    if (initialSecondary) setSecondaryCondition(initialSecondary);
  }, [initialPrimary, initialSecondary]);

  // Handle consent
  const handleConsent = () => {
    localStorage.setItem("vetrate_ai_consent", "true");
    setStep("input");
  };

  // Generate the packet
  const handleGenerate = async () => {
    if (!primaryCondition.trim() || !secondaryCondition.trim()) {
      setError("Please enter both conditions");
      return;
    }

    // Check if ANY AI is available (Cloud or Local)
    if (!isAnyAIAvailable()) {
      setError(
        "No AI available. Please set up an API key or enable Local AI in settings.",
      );
      if (onOpenAISettings) onOpenAISettings();
      return;
    }

    setStep("loading");
    setError(null);

    try {
      const result = await generateDoctorsPacket(
        apiKey,
        primaryCondition,
        secondaryCondition,
      );

      if (result.success) {
        setPacketData(result);
        setStep("result");
      } else if (result.noLink) {
        setError(result.error);
        setStep("error");
      } else {
        setError("Failed to generate packet. Please try again.");
        setStep("error");
      }
    } catch (err) {
      setError(err.message);
      setStep("error");
    }
  };

  // Download as TXT
  const handleDownloadTxt = () => {
    if (!packetData) return;

    const letterText = formatDoctorLetter(
      packetData.data,
      primaryCondition,
      secondaryCondition,
    );

    const fullContent = `DOCTOR'S PACKET - MEDICAL NEXUS RESEARCH BRIEF
Generated by Vet-Rate.org
${"=".repeat(60)}

PRIMARY CONDITION: ${primaryCondition}
SECONDARY CONDITION: ${secondaryCondition}
CONNECTION STRENGTH: ${packetData.data.strength?.toUpperCase() || "UNKNOWN"}

${"=".repeat(60)}
MEDICAL MECHANISM SUMMARY
${"=".repeat(60)}

${packetData.data.mechanism_summary}

${"=".repeat(60)}
KEY PATHOPHYSIOLOGICAL PATHWAYS
${"=".repeat(60)}

${packetData.data.key_pathways?.map((p, i) => `${i + 1}. ${p}`).join("\n\n") || "None provided"}

${"=".repeat(60)}
SUPPORTING LITERATURE TOPICS
${"=".repeat(60)}

${packetData.data.literature_topics?.map((l, i) => `${i + 1}. ${l}`).join("\n\n") || "None provided"}

${"=".repeat(60)}
RISK FACTORS
${"=".repeat(60)}

${packetData.data.risk_factors?.map((r) => `• ${r}`).join("\n") || "None provided"}

${"=".repeat(60)}
PHYSICIAN TEMPLATE LETTER
${"=".repeat(60)}

${letterText}

${"=".repeat(60)}
IMPORTANT NOTES
${"=".repeat(60)}

${packetData.data.notes || "No additional notes."}

${"=".repeat(60)}
DISCLAIMER
${"=".repeat(60)}

This document is provided for informational purposes only and does not constitute
medical advice, diagnosis, or treatment. A qualified physician must review this
information and make their own independent medical determination.

Generated: ${new Date().toLocaleString()}
Vet-Rate.org - Helping Veterans Win Claims`;

    const blob = new Blob([fullContent], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Doctors_Packet_${secondaryCondition.replace(/\s+/g, "_")}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // Print handler
  const handlePrint = () => {
    window.print();
  };

  const header = (
    <div className="flex items-center justify-between border-b border-violet-700 bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 px-6 py-4">
      <div className="flex items-center gap-3">
        <div className="rounded-lg bg-white/20 p-2 text-white">
          <SparklesIcon />
        </div>
        <div>
          <h2
            id="doctors-packet-title"
            className="flex items-center gap-2 text-xl font-bold text-white"
          >
            Doctor&apos;s Packet Generator
            <span className="rounded bg-violet-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              AI
            </span>
            <span className="rounded bg-amber-500 px-1.5 py-0.5 text-[10px] font-bold text-white">
              BETA
            </span>
          </h2>
          <p className="text-sm text-violet-100">
            AI-powered medical nexus research
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <LLMRecommendationBadge toolId="doctors-packet" />
        <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
        <button
          onClick={onClose}
          className="rounded-lg p-2 text-white transition-colors hover:bg-white/20 hover:text-gray-200"
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

  return (
    <ResponsiveModal
      isOpen={isOpen}
      onClose={onClose}
      header={header}
      labelledBy="doctors-packet-title"
      size="xl"
      className="border border-purple-500/20"
    >
      {/* Step: Consent */}
      {step === "consent" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-purple-900/20">
            <div className="flex items-start gap-3">
              <div className="mt-1 rounded-lg bg-purple-100 p-2 text-purple-600 dark:bg-purple-500/20 dark:text-purple-300">
                <BrainIcon />
              </div>
              <div>
                <h3 className="mb-2 font-semibold text-gray-900 dark:text-white">
                  What This Tool Does
                </h3>
                <p className="text-sm leading-relaxed text-gray-700 dark:text-gray-300">
                  The Doctor&apos;s Packet Generator uses AI to research the{" "}
                  <span className="font-medium text-purple-600 dark:text-purple-300">
                    medical mechanism
                  </span>{" "}
                  linking your service-connected condition to a claimed
                  secondary condition. It creates a comprehensive research brief
                  that you can present to your private physician.
                </p>
              </div>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border border-green-200 bg-green-50 p-4 dark:border-green-500/20 dark:bg-green-900/20">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-green-700 dark:text-green-300">
                <CheckIcon /> Includes
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-600 dark:text-green-400">
                    •
                  </span>
                  Medical mechanism explanation
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-600 dark:text-green-400">
                    •
                  </span>
                  Pathophysiological pathways
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-600 dark:text-green-400">
                    •
                  </span>
                  Literature/study references
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-green-600 dark:text-green-400">
                    •
                  </span>
                  Physician template letter
                </li>
              </ul>
            </div>

            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-500/20 dark:bg-amber-900/20">
              <h4 className="mb-3 flex items-center gap-2 font-semibold text-amber-700 dark:text-amber-300">
                <AlertIcon /> Important Notes
              </h4>
              <ul className="space-y-2 text-sm text-gray-700 dark:text-gray-300">
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-amber-600 dark:text-amber-400">
                    •
                  </span>
                  This is <strong>research</strong>, not a diagnosis
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-amber-600 dark:text-amber-400">
                    •
                  </span>
                  Doctor must review and sign
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-amber-600 dark:text-amber-400">
                    •
                  </span>
                  Uses your free Gemini API key
                </li>
                <li className="flex items-start gap-2">
                  <span className="mt-1 text-amber-600 dark:text-amber-400">
                    •
                  </span>
                  No personal data is sent
                </li>
              </ul>
            </div>
          </div>

          <button
            onClick={() => setShowPrivacy(!showPrivacy)}
            className="flex items-center gap-2 text-sm text-purple-600 hover:text-purple-700 dark:text-purple-400 dark:hover:text-purple-300"
          >
            <InfoIcon /> {showPrivacy ? "Hide" : "View"} Privacy Details
          </button>

          {showPrivacy && (
            <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-300">
              {getNexusLogicPrivacyDisclosure()}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-lg bg-gray-200 px-4 py-3 text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <ToolCardButton
              className="flex-1"
              type="button"
              onClick={handleConsent}
            >
              <CheckIcon /> I Understand, Continue
            </ToolCardButton>
          </div>
        </div>
      )}

      {/* Step: Input */}
      {step === "input" && (
        <div className="space-y-6">
          {/* AI Setup Message */}
          {!isAnyAIAvailable() && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 dark:border-amber-600/50 dark:bg-amber-900/30">
              <div className="flex items-start gap-3">
                <span className="text-xl">💡</span>
                <div className="text-sm text-amber-800 dark:text-amber-100">
                  <p className="mb-1 font-semibold">AI Required for Analysis</p>
                  <p className="text-amber-700 dark:text-amber-200">
                    Click the <strong>AI Status button</strong> in the header
                    above to load your secure Local AI (100% private) or enter
                    your Gemini API key.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Conditions */}
          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Primary Condition (Service-Connected)
            </label>
            <input
              type="text"
              value={primaryCondition}
              onChange={(e) => setPrimaryCondition(e.target.value)}
              placeholder="e.g., PTSD, Lumbar Strain, Diabetes Type II"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          <div className="flex items-center justify-center">
            <div className="flex items-center gap-2 text-purple-600 dark:text-purple-400">
              <LinkIcon />
              <span className="text-sm">causes or aggravates</span>
            </div>
          </div>

          <div>
            {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
            <label className="mb-2 block text-sm font-medium text-gray-700 dark:text-gray-300">
              Secondary Condition (Claimed)
            </label>
            <input
              type="text"
              value={secondaryCondition}
              onChange={(e) => setSecondaryCondition(e.target.value)}
              placeholder="e.g., Sleep Apnea, Radiculopathy, Hypertension"
              className="w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-gray-900 placeholder-gray-400 focus:border-transparent focus:ring-2 focus:ring-purple-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-400"
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 dark:border-red-500/20 dark:bg-red-900/20 dark:text-red-300">
              {error}
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-4 py-3 text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Cancel
            </button>
            <ToolCardButton
              className="flex-1"
              type="button"
              onClick={handleGenerate}
              disabled={
                !apiKey ||
                !primaryCondition.trim() ||
                !secondaryCondition.trim()
              }
            >
              <SparklesIcon /> Generate Doctor&apos;s Packet
            </ToolCardButton>
          </div>
        </div>
      )}

      {/* Step: Loading */}
      {step === "loading" && (
        <div className="flex flex-col items-center justify-center space-y-6 py-16">
          <div className="relative">
            <div className="h-16 w-16 animate-spin rounded-full border-4 border-purple-500/20">
              <div className="absolute left-0 top-0 h-full w-full rounded-full border-4 border-transparent border-t-purple-500"></div>
            </div>
            <div className="absolute inset-0 flex items-center justify-center text-purple-500">
              <BrainIcon />
            </div>
          </div>
          <div className="text-center">
            <h3 className="mb-2 text-xl font-semibold text-gray-900 dark:text-white">
              Researching Medical Connection...
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Analyzing pathophysiological pathways between
              <br />
              <span className="text-purple-600 dark:text-purple-300">
                {primaryCondition}
              </span>{" "}
              and{" "}
              <span className="text-purple-600 dark:text-purple-300">
                {secondaryCondition}
              </span>
            </p>
          </div>
        </div>
      )}

      {/* Step: Error */}
      {step === "error" && (
        <div className="space-y-6">
          <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-500/20 dark:bg-red-900/20">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-red-100 text-red-500 dark:bg-red-500/20">
              <AlertIcon />
            </div>
            <h3 className="mb-2 text-xl font-semibold text-red-700 dark:text-red-300">
              No Medical Link Found
            </h3>
            <p className="text-sm text-gray-700 dark:text-gray-300">{error}</p>
          </div>

          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-4 py-3 text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Close
            </button>
            <ToolCardButton
              className="flex-1"
              type="button"
              onClick={() => {
                setError(null);
                setStep("input");
              }}
            >
              Try Different Conditions
            </ToolCardButton>
          </div>
        </div>
      )}

      {/* Step: Result */}
      {step === "result" && packetData && (
        <div className="space-y-6 print:bg-white print:text-black">
          {/* Success Header */}
          <div className="flex flex-wrap items-center justify-between gap-4 print:hidden">
            <div className="flex items-center gap-3">
              <div
                className={`rounded-full border px-3 py-1 text-sm font-medium ${getStrengthColor(packetData.data.strength)}`}
              >
                {packetData.data.strength?.toUpperCase()} LINK
              </div>
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Generated {new Date().toLocaleTimeString()}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handlePrint}
                className="flex items-center gap-2 rounded-lg bg-gray-200 px-4 py-2 text-sm text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
              >
                <PrintIcon /> Print
              </button>
              <button
                onClick={handleDownloadTxt}
                className="flex items-center gap-2 rounded-lg bg-purple-600 px-4 py-2 text-sm text-white transition-colors hover:bg-purple-500"
              >
                <DownloadIcon /> Download TXT
              </button>
            </div>
          </div>

          {/* Conditions Summary */}
          <div className="rounded-xl border border-purple-200 bg-purple-50 p-4 dark:border-purple-500/20 dark:bg-gradient-to-r dark:from-purple-900/30 dark:to-indigo-900/30 print:border print:border-black print:bg-gray-100">
            <div className="flex items-center gap-4 text-center">
              <div className="flex-1 rounded-lg bg-gray-100 p-3 dark:bg-gray-800/50 print:bg-gray-200">
                <div className="mb-1 text-xs text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Primary (Service-Connected)
                </div>
                <div className="font-semibold text-gray-900 dark:text-white print:text-black">
                  {primaryCondition}
                </div>
              </div>
              <div className="text-purple-600 dark:text-purple-400 print:text-black">
                <LinkIcon />
              </div>
              <div className="flex-1 rounded-lg bg-gray-100 p-3 dark:bg-gray-800/50 print:bg-gray-200">
                <div className="mb-1 text-xs text-gray-600 dark:text-gray-400 print:text-gray-600">
                  Secondary (Claimed)
                </div>
                <div className="font-semibold text-gray-900 dark:text-white print:text-black">
                  {secondaryCondition}
                </div>
              </div>
            </div>
          </div>

          {/* Mechanism Summary */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/50 print:border-black print:bg-gray-100">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-gray-900 dark:text-white print:text-black">
              <BrainIcon /> Medical Mechanism
            </h3>
            <p className="leading-relaxed text-gray-700 dark:text-gray-300 print:text-black">
              {packetData.data.mechanism_summary}
            </p>
          </div>

          {/* Key Pathways */}
          {packetData.data.key_pathways?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/50 print:border-black print:bg-gray-100">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white print:text-black">
                Pathophysiological Pathways
              </h3>
              <ul className="space-y-3">
                {packetData.data.key_pathways.map((pathway, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-3 text-gray-700 dark:text-gray-300 print:text-black"
                  >
                    <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-purple-100 text-sm font-medium text-purple-700 dark:bg-purple-500/20 dark:text-purple-300 print:bg-gray-200 print:text-black">
                      {i + 1}
                    </span>
                    {pathway}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Literature Topics */}
          {packetData.data.literature_topics?.length > 0 && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-5 dark:border-gray-600 dark:bg-gray-800/50 print:border-black print:bg-gray-100">
              <h3 className="mb-3 font-semibold text-gray-900 dark:text-white print:text-black">
                Supporting Medical Literature
              </h3>
              <ul className="space-y-2">
                {packetData.data.literature_topics.map((topic, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 print:text-black"
                  >
                    <DocumentIcon />
                    {topic}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Risk Factors */}
          {packetData.data.risk_factors?.length > 0 && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-5 dark:border-amber-500/20 dark:bg-amber-900/20 print:border-black print:bg-gray-100">
              <h3 className="mb-3 font-semibold text-amber-700 dark:text-amber-300 print:text-black">
                Relevant Risk Factors
              </h3>
              <ul className="space-y-2">
                {packetData.data.risk_factors.map((factor, i) => (
                  <li
                    key={i}
                    className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300 print:text-black"
                  >
                    <span className="text-amber-600 dark:text-amber-400 print:text-black">
                      •
                    </span>
                    {factor}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* Doctor's Template */}
          <div className="rounded-xl border border-green-200 bg-green-50 p-5 dark:border-green-500/20 dark:bg-green-900/20 print:border-black print:bg-gray-100">
            <h3 className="mb-3 flex items-center gap-2 font-semibold text-green-700 dark:text-green-300 print:text-black">
              <DocumentIcon /> Physician Template Letter
            </h3>
            <div className="whitespace-pre-wrap rounded-lg border border-gray-200 bg-gray-100 p-4 font-mono text-sm text-gray-800 dark:border-gray-700 dark:bg-gray-900/50 dark:text-gray-200 print:border-black print:bg-white print:text-black">
              {formatDoctorLetter(
                packetData.data,
                primaryCondition,
                secondaryCondition,
              )}
            </div>
          </div>

          {/* Notes */}
          {packetData.data.notes && (
            <div className="rounded-xl border border-gray-200 bg-gray-50 p-4 dark:border-gray-600 dark:bg-gray-800/50 print:border-black print:bg-gray-100">
              <h4 className="mb-2 flex items-center gap-2 font-semibold text-gray-900 dark:text-white print:text-black">
                <InfoIcon /> Important Notes
              </h4>
              <p className="text-sm text-gray-700 dark:text-gray-300 print:text-black">
                {packetData.data.notes}
              </p>
            </div>
          )}

          {/* Disclaimer */}
          <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-xs text-gray-600 dark:border-gray-700 dark:bg-gray-800/30 dark:text-gray-400 print:border-black print:text-gray-600">
            <strong>Disclaimer:</strong> This document is provided for
            informational purposes only and does not constitute medical advice,
            diagnosis, or treatment. A qualified physician must review this
            information and make their own independent medical determination.
            Generated by Vet-Rate.org.
          </div>

          {/* Actions */}
          <div className="flex gap-3 print:hidden">
            <button
              onClick={onClose}
              className="rounded-lg bg-gray-200 px-4 py-3 text-gray-900 transition-colors hover:bg-gray-300 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
            >
              Close
            </button>
            <button
              onClick={() => {
                setPacketData(null);
                setStep("input");
              }}
              className="flex-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-4 py-3 font-medium text-white transition-all hover:from-purple-500 hover:to-indigo-500"
            >
              Generate Another Packet
            </button>
          </div>
        </div>
      )}
    </ResponsiveModal>
  );
}
