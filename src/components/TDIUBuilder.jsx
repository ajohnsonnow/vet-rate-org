/**
 * Vet-Rate.org - TDIU Work Impact Builder
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * "The 100% Backdoor" - Vocational Impact Generator
 * Translates symptoms into workplace limitations for VA Form 21-8940
 *
 * What Sharks Charge $3,000+ For:
 * - "Vocational Expert" letters
 * - Translation of symptoms into "occupational limitations"
 *
 * What We Do For Free:
 * - AI-powered translation of everyday symptoms into VA-specific language
 * - Direct output for Box 18 of VA Form 21-8940
 */

import { useState, useRef, useEffect } from "react";
import ResponsiveModal from "./common/ResponsiveModal";
import HeaderCloseSlot from "./common/HeaderCloseSlot";
import BuyMeCoffee from "./BuyMeCoffee";
import ReportBugLink from "./ReportBugLink";
import { downloadDraft } from "../utils/draftExport";
import { isAnyAIAvailable, getAIStatus } from "../utils/unifiedAIService";
import {
  STANDARD_DRAFT_NOTE,
  buildTdiuAnalysisTemplate,
  tdiuSavePayload,
} from "../utils/writerTemplates";
import TdiuAnalysisEditor from "./TdiuAnalysisEditor";
import StandardDraftNotice from "./common/StandardDraftNotice";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import ShareButton from "./ShareButton";
import VoiceInputButton from "./VoiceInput";
import {
  saveAnalysisResults,
  PACKET_DOC_TYPES,
} from "../utils/veteranContextProvider";
import { getMyRatings } from "../utils/veteranProfile";
import { checkTDIUEligibility } from "../utils/smcDetector";

/**
 * Common disability categories for quick selection
 */
const DISABILITY_CATEGORIES = [
  {
    category: "Mental Health",
    icon: "🧠",
    conditions: [
      {
        name: "PTSD",
        commonSymptoms: [
          "Hypervigilance",
          "Flashbacks",
          "Difficulty concentrating",
          "Anger outbursts",
          "Sleep disturbances",
          "Avoidance of triggers",
        ],
      },
      {
        name: "Major Depression",
        commonSymptoms: [
          "Fatigue",
          "Lack of motivation",
          "Difficulty concentrating",
          "Hopelessness",
          "Sleep problems",
          "Social withdrawal",
        ],
      },
      {
        name: "Anxiety Disorder",
        commonSymptoms: [
          "Panic attacks",
          "Racing thoughts",
          "Difficulty focusing",
          "Irritability",
          "Physical tension",
          "Avoidance behaviors",
        ],
      },
      {
        name: "Bipolar Disorder",
        commonSymptoms: [
          "Mood swings",
          "Manic episodes",
          "Depressive episodes",
          "Impulsivity",
          "Sleep disturbances",
          "Concentration issues",
        ],
      },
    ],
  },
  {
    category: "Musculoskeletal",
    icon: "🦴",
    conditions: [
      {
        name: "Lumbar Spine / Back",
        commonSymptoms: [
          "Cannot sit >15-30 mins",
          "Cannot stand >15-30 mins",
          "Cannot lift >10-20 lbs",
          "Requires frequent position changes",
          "Pain with bending/twisting",
          "Radiating leg pain",
        ],
      },
      {
        name: "Cervical Spine / Neck",
        commonSymptoms: [
          "Limited head rotation",
          "Pain looking up/down",
          "Headaches from strain",
          "Numbness in arms",
          "Cannot work overhead",
          "Pain from prolonged reading",
        ],
      },
      {
        name: "Knee Condition",
        commonSymptoms: [
          "Cannot stand >15-30 mins",
          "Cannot walk >1 block",
          "Difficulty with stairs",
          "Instability/giving way",
          "Cannot squat or kneel",
          "Pain with weather changes",
        ],
      },
      {
        name: "Shoulder Condition",
        commonSymptoms: [
          "Cannot reach overhead",
          "Cannot lift >5-10 lbs",
          "Pain with repetitive motion",
          "Limited range of motion",
          "Weakness in arm",
          "Difficulty dressing",
        ],
      },
    ],
  },
  {
    category: "Neurological",
    icon: "⚡",
    conditions: [
      {
        name: "Migraines",
        commonSymptoms: [
          "2+ prostrating attacks/month",
          "Requires dark room rest",
          "Light/sound sensitivity",
          "Nausea/vomiting",
          "Cannot drive during episode",
          "Last 4-72 hours each",
        ],
      },
      {
        name: "TBI Residuals",
        commonSymptoms: [
          "Memory problems",
          "Difficulty processing information",
          "Headaches",
          "Dizziness/balance issues",
          "Mood changes",
          "Light sensitivity",
        ],
      },
      {
        name: "Peripheral Neuropathy",
        commonSymptoms: [
          "Numbness in hands/feet",
          "Burning/tingling pain",
          "Loss of fine motor control",
          "Difficulty with buttons/typing",
          "Balance problems",
          "Sensitivity to touch",
        ],
      },
    ],
  },
  {
    category: "Other Physical",
    icon: "🫀",
    conditions: [
      {
        name: "Sleep Apnea",
        commonSymptoms: [
          "Daytime fatigue",
          "Cannot stay awake during work",
          "Requires CPAP",
          "Memory/concentration issues",
          "Morning headaches",
          "Cannot work night shifts",
        ],
      },
      {
        name: "Heart Condition",
        commonSymptoms: [
          "Shortness of breath",
          "Cannot exert >3 METs",
          "Fatigue with minimal activity",
          "Chest pain with stress",
          "Requires frequent rest",
          "Cannot lift >20 lbs",
        ],
      },
      {
        name: "Respiratory (Asthma/COPD)",
        commonSymptoms: [
          "Shortness of breath",
          "Cannot work in dust/fumes",
          "Frequent breathing treatments",
          "Limited physical exertion",
          "Coughing spells",
          "Weather/allergy triggers",
        ],
      },
      {
        name: "Diabetes",
        commonSymptoms: [
          "Requires insulin",
          "Blood sugar fluctuations",
          "Cannot skip meals",
          "Fatigue",
          "Vision problems",
          "Neuropathy symptoms",
        ],
      },
    ],
  },
];

/**
 * The TDIU analysis for the selected conditions and symptoms.
 *
 * The form collects no free text for the analysis (conditions and symptoms
 * are chosen from lists), so there is no passage for the AI to reword and
 * no model call is made: the veteran gets the app-built analysis, with a
 * blank wherever they have to say how a symptom limits their work.
 */
// Exported (test-only, per this codebase's underscore-prefix convention) so
// tests and the golden-set evaluation call the function the builder calls.
export const _generateVocationalImpact = (disabilities) => ({
  analysis: buildTdiuAnalysisTemplate(disabilities),
  draftPath: "template",
  draftNote: STANDARD_DRAFT_NOTE,
  draftRejectReasons: [],
  passages: { sent: 0, accepted: 0, unchanged: 0, rejected: 0 },
});

const WORK_HISTORY_LABELS = [
  ["lastWorked", "Last worked"],
  ["lastOccupation", "Last occupation"],
  ["reasonLeft", "Why I stopped working"],
  ["education", "Education"],
  ["triedToWork", "Attempts to work since"],
];

/** The work-history answers given, as [label, answer] pairs. */
const workHistoryEntries = (workHistory) =>
  WORK_HISTORY_LABELS.map(([key, label]) => [
    label,
    (workHistory?.[key] ?? "").trim(),
  ]).filter(([, answer]) => answer);

const DOWNLOAD_FAILED =
  "The download did not work. Your analysis is still here. Try the other format, or copy the text.";

/**
 * Build the full statement text from analysis + work history
 */
function buildFullStatement(vocationalAnalysis, workHistory) {
  if (!vocationalAnalysis) return "";

  let statement = `STATEMENT OF UNEMPLOYABILITY\n`;
  statement += `For VA Form 21-8940, Box 18\n`;
  statement += `${"=".repeat(50)}\n\n`;

  statement += `FUNCTIONAL LIMITATIONS:\n\n`;

  vocationalAnalysis.limitations.forEach((lim, i) => {
    statement += `${i + 1}. ${lim.condition} - ${lim.symptom}\n`;
    statement += `   Impact: ${lim.vocational_impact}\n\n`;
  });

  statement += `${"=".repeat(50)}\n`;
  statement += `COMBINED EFFECT OF DISABILITIES:\n\n`;
  statement += `${vocationalAnalysis.combined_effect}\n\n`;

  statement += `${"=".repeat(50)}\n`;
  statement += `WORK TYPES PRECLUDED:\n`;
  statement += vocationalAnalysis.job_types_precluded
    .map((j) => `• ${j} Work`)
    .join("\n");
  statement += `\n\n`;

  statement += `${"=".repeat(50)}\n`;
  statement += `STATEMENT FOR BOX 18 (Copy this):\n\n`;
  statement += `"${vocationalAnalysis.summary_argument}"`;

  const history = workHistoryEntries(workHistory);
  if (history.length > 0) {
    statement += `\n\n${"=".repeat(50)}\n`;
    statement += `ADDITIONAL WORK HISTORY CONTEXT:\n\n`;
    statement += history
      .map(([label, answer]) => `${label}: ${answer}`)
      .join("\n");
  }

  return statement;
}

/**
 * Build the vocational analysis and update state. Nothing is saved here:
 * the veteran edits the result and saves it.
 */
function generateVocationalAnalysis(
  disabilities,
  { setError, setVocationalAnalysis, setDraftNote, setStep },
) {
  if (disabilities.length === 0) {
    setError("Please add at least one disability with symptoms.");
    return;
  }
  setError(null);
  const drafted = _generateVocationalImpact(disabilities);
  setVocationalAnalysis(drafted.analysis);
  setDraftNote(drafted.draftNote);
  setStep(3);
}

/**
 * Manages the disability list wizard state (step 1) as a single unit
 */
function useDisabilityListState() {
  const [disabilities, setDisabilities] = useState([]);
  const [currentDisability, setCurrentDisability] = useState({
    condition: "",
    symptoms: [],
  });
  const [customSymptom, setCustomSymptom] = useState("");

  const addDisability = () => {
    if (currentDisability.condition && currentDisability.symptoms.length > 0) {
      setDisabilities((prev) => [...prev, { ...currentDisability }]);
      setCurrentDisability({ condition: "", symptoms: [] });
    }
  };

  const removeDisability = (index) => {
    setDisabilities((prev) => prev.filter((_, i) => i !== index));
  };

  const toggleSymptom = (symptom) => {
    setCurrentDisability((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  };

  const addCustomSymptom = () => {
    if (customSymptom.trim()) {
      setCurrentDisability((prev) => ({
        ...prev,
        symptoms: [...prev.symptoms, customSymptom.trim()],
      }));
      setCustomSymptom("");
    }
  };

  const getCommonSymptoms = () => {
    for (const category of DISABILITY_CATEGORIES) {
      const condition = category.conditions.find(
        (c) => c.name === currentDisability.condition,
      );
      if (condition) return condition.commonSymptoms;
    }
    return [];
  };

  return {
    disabilities,
    setDisabilities,
    currentDisability,
    setCurrentDisability,
    customSymptom,
    setCustomSymptom,
    addDisability,
    removeDisability,
    toggleSymptom,
    addCustomSymptom,
    getCommonSymptoms,
  };
}

/**
 * Polls the unified AI service status so AI-availability UI stays fresh
 */
function useAIStatusPolling() {
  const [, setAIStatus] = useState(getAIStatus());

  useEffect(() => {
    const interval = setInterval(() => {
      setAIStatus(getAIStatus());
    }, 1000);
    return () => clearInterval(interval);
  }, []);
}

/**
 * Copy the Box 18 statement to the clipboard
 */
async function copyBox18Statement(vocationalAnalysis) {
  try {
    await navigator.clipboard.writeText(vocationalAnalysis.summary_argument);
    alert("Box 18 statement copied to clipboard!");
  } catch (err) {
    console.error("Copy failed:", err);
  }
}

/**
 * The result step's state: the analysis as edited, its draft note, saving
 * and downloads. The veteran saves what is on screen; any change to the
 * analysis clears the last save message.
 */
function useTdiuResults(workHistory) {
  const [vocationalAnalysis, setAnalysis] = useState(null);
  const [draftNote, setDraftNote] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [saveState, setSaveState] = useState(null);
  const [downloadError, setDownloadError] = useState(null);

  const setVocationalAnalysis = (next) => {
    setAnalysis(next);
    setSaveState(null);
  };
  const saveToPacket = () =>
    saveAnalysisResults({
      toolName: "TDIU Builder",
      classification: PACKET_DOC_TYPES.PERSONAL_STATEMENT,
      ...tdiuSavePayload(vocationalAnalysis),
    }).then(
      () => setSaveState("saved"),
      (err) => {
        console.warn("Failed to save TDIU results:", err);
        setSaveState("failed");
      },
    );
  const download = async (format) => {
    setDownloadError(null);
    try {
      await downloadDraft(
        buildFullStatement(vocationalAnalysis, workHistory),
        "TDIU_Vocational_Statement",
        format,
      );
    } catch (error) {
      console.error("TDIU Builder download failed:", error);
      setDownloadError(DOWNLOAD_FAILED);
    }
  };

  return {
    vocationalAnalysis,
    setVocationalAnalysis,
    editAnalysis: setVocationalAnalysis,
    draftNote,
    setDraftNote,
    saveToPacket,
    saveState,
    showDownloadMenu,
    setShowDownloadMenu,
    workHistory,
    downloadError,
    downloadPDF: () => download("pdf"),
    downloadDOCX: () => download("docx"),
    copyToClipboard: () => copyBox18Statement(vocationalAnalysis),
  };
}

/**
 * Bundles all TDIUBuilder wizard state, derived data, and action handlers
 */
function useTDIUBuilderState() {
  const [step, setStep] = useState(1);
  const {
    disabilities,
    setDisabilities,
    currentDisability,
    setCurrentDisability,
    customSymptom,
    setCustomSymptom,
    addDisability,
    removeDisability,
    toggleSymptom,
    addCustomSymptom,
    getCommonSymptoms,
  } = useDisabilityListState();

  const [workHistory, setWorkHistory] = useState({
    lastWorked: "",
    lastOccupation: "",
    reasonLeft: "",
    education: "",
    triedToWork: "",
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  useAIStatusPolling();

  const results = useTdiuResults(workHistory);

  const [savedRatingsTdiu] = useState(() => {
    const ratings = getMyRatings();
    return { hasRatings: ratings.length > 0, ...checkTDIUEligibility(ratings) };
  });

  const handleGenerate = () =>
    generateVocationalAnalysis(disabilities, {
      setError,
      setIsGenerating,
      setVocationalAnalysis: results.setVocationalAnalysis,
      setDraftNote: results.setDraftNote,
      setStep,
    });

  return {
    step,
    setStep,
    disabilities,
    setDisabilities,
    currentDisability,
    setCurrentDisability,
    customSymptom,
    setCustomSymptom,
    addDisability,
    removeDisability,
    toggleSymptom,
    addCustomSymptom,
    getCommonSymptoms,
    workHistory,
    setWorkHistory,
    isGenerating,
    error,
    vocationalAnalysis: results.vocationalAnalysis,
    savedRatingsTdiu,
    handleGenerate,
    results,
  };
}

export default function TDIUBuilder({
  onClose,
  onReportBug,
  onOpenAISettings,
}) {
  // Ref for screenshot/share functionality
  const tdiuContentRef = useRef(null);

  const builderState = useTDIUBuilderState();
  const { step, disabilities, vocationalAnalysis } = builderState;

  return (
    <>
      <ResponsiveModal
        isOpen
        onClose={onClose}
        size="2xl"
        labelledBy="tdiu-builder-title"
        header={
          <TDIUBuilderHeader
            tdiuContentRef={tdiuContentRef}
            onOpenAISettings={onOpenAISettings}
            onReportBug={onReportBug}
            onClose={onClose}
          />
        }
      >
        <div ref={tdiuContentRef}>
          <TDIUProgressAndAILoad step={step} />
          <TDIUMainContent {...builderState} />
        </div>
      </ResponsiveModal>

      {/* BuyMeCoffee - shows after generating statement */}
      <div className="relative z-[70]">
        <BuyMeCoffee
          show={step === 3 && vocationalAnalysis !== null}
          trigger="tdiu"
          context={{ impact: disabilities.length > 0 }}
          componentKey="tdiu-builder"
        />
      </div>
    </>
  );
}

function TDIUBuilderHeader({
  tdiuContentRef,
  onOpenAISettings,
  onReportBug,
  onClose,
}) {
  return (
    <div className="flex-shrink-0 bg-gradient-to-r from-amber-600 to-orange-600 p-4 shadow-lg rounded-t-xl">
      <HeaderCloseSlot
        close={
          <button
            onClick={onClose}
            className="grid h-11 w-11 shrink-0 place-items-center text-white hover:bg-white/20 rounded-lg transition-colors"
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
        }
      >
        <div className="flex min-w-0 items-center gap-3">
          <span className="text-3xl shrink-0">💼</span>
          <div className="min-w-0">
            <h2
              id="tdiu-builder-title"
              className="text-xl font-bold text-white flex flex-wrap items-center gap-2"
            >
              TDIU Work Impact Builder{" "}
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                AI
              </span>
              <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
                BETA
              </span>
            </h2>
            <p className="text-sm text-amber-100">
              The 100% Backdoor - Vocational Statement Generator
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <LLMRecommendationBadge toolId="tdiu-builder" />
          <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
          <ShareButton
            targetRef={tdiuContentRef}
            filename="tdiu-vocational-analysis"
            variant="icon"
          />
          {onReportBug && (
            <ReportBugLink
              onClick={onReportBug}
              variant="light"
              moduleName="TDIU Work Impact Builder"
            />
          )}
        </div>
      </HeaderCloseSlot>
    </div>
  );
}

function TDIUProgressAndAILoad({ step }) {
  return (
    <div className="max-w-4xl mx-auto pt-2">
      <div className="flex items-center justify-center gap-4 mb-6">
        {[1, 2, 3].map((s) => (
          <div key={s} className="flex items-center">
            <div
              className={`w-8 h-8 rounded-full flex items-center justify-center font-bold ${
                step >= s
                  ? "bg-green-600 text-white"
                  : "bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400"
              }`}
            >
              {step > s ? "✓" : s}
            </div>
            {s < 3 && (
              <div
                className={`w-16 h-1 ${step > s ? "bg-green-600" : "bg-gray-200 dark:bg-gray-700"}`}
              ></div>
            )}
          </div>
        ))}
      </div>
      <div className="flex justify-center gap-8 text-sm text-gray-500 dark:text-gray-400 mb-6">
        <span className={step === 1 ? "font-bold text-green-600" : ""}>
          Disabilities
        </span>
        <span className={step === 2 ? "font-bold text-green-600" : ""}>
          Work History
        </span>
        <span className={step === 3 ? "font-bold text-green-600" : ""}>
          Results
        </span>
      </div>

      {/* Smart AI Load Button */}
      {!isAnyAIAvailable() && (
        <div className="mb-6">
          <SmartAILoadButton
            toolId="tdiu-builder"
            onLoadComplete={(model) => {
              // eslint-disable-next-line no-console
              console.log("Smart AI loaded for TDIU Builder:", model?.name);
            }}
          />
        </div>
      )}
    </div>
  );
}

function TDIUSupportCTA() {
  return (
    <div className="bg-gradient-to-r from-amber-900/40 to-yellow-900/40 rounded-2xl p-6 border border-amber-700/50 mt-6">
      <div className="flex items-center gap-4">
        <img
          src="/images/Anth.jpg"
          alt="Anthony - Vet-Rate Developer"
          className="w-14 h-14 rounded-full object-cover border-2 border-green-500 shadow-lg flex-shrink-0"
        />
        <div className="flex-1">
          <p className="text-green-200 font-semibold mb-1">
            💰 That statement would cost $500+ from a vocational expert
          </p>
          <p className="text-green-300/70 text-sm">
            TDIU claims are complex. Most veterans hire expensive consultants
            just to translate their symptoms into &quot;occupational
            limitations.&quot; You just did it for free. Help keep this tool
            available for every veteran fighting for 100%.
          </p>
        </div>
      </div>
    </div>
  );
}

function TDIUResultsSection({
  step,
  setStep,
  setDisabilities,
  setWorkHistory,
  results,
}) {
  if (step !== 3) return null;
  return (
    <>
      <StandardDraftNotice note={results.draftNote} className="mb-6" />
      <ResultsStep
        {...results}
        onStartOver={() => {
          setStep(1);
          setDisabilities([]);
          results.setVocationalAnalysis(null);
          setWorkHistory({
            lastWorked: "",
            lastOccupation: "",
            reasonLeft: "",
            education: "",
            triedToWork: "",
          });
        }}
      />
      {/* Support CTA on results page */}
      {results.vocationalAnalysis && <TDIUSupportCTA />}
    </>
  );
}

function TDIUMainContent({
  error,
  step,
  setStep,
  savedRatingsTdiu,
  disabilities,
  setDisabilities,
  removeDisability,
  currentDisability,
  setCurrentDisability,
  getCommonSymptoms,
  toggleSymptom,
  customSymptom,
  setCustomSymptom,
  addCustomSymptom,
  addDisability,
  workHistory,
  setWorkHistory,
  handleGenerate,
  isGenerating,
  results,
}) {
  return (
    <div className="max-w-4xl mx-auto p-6 pt-0">
      {error && (
        <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
          <p className="text-red-700 dark:text-red-300">{error}</p>
        </div>
      )}

      {step === 1 && (
        <DisabilityStep
          savedRatingsTdiu={savedRatingsTdiu}
          disabilities={disabilities}
          removeDisability={removeDisability}
          currentDisability={currentDisability}
          setCurrentDisability={setCurrentDisability}
          getCommonSymptoms={getCommonSymptoms}
          toggleSymptom={toggleSymptom}
          customSymptom={customSymptom}
          setCustomSymptom={setCustomSymptom}
          addCustomSymptom={addCustomSymptom}
          addDisability={addDisability}
          onContinue={() => setStep(2)}
        />
      )}
      {step === 2 && (
        <WorkHistoryStep
          workHistory={workHistory}
          setWorkHistory={setWorkHistory}
          disabilities={disabilities}
          step={step}
          handleGenerate={handleGenerate}
          isGenerating={isGenerating}
          onBack={() => setStep(1)}
        />
      )}
      <TDIUResultsSection
        step={step}
        setStep={setStep}
        setDisabilities={setDisabilities}
        setWorkHistory={setWorkHistory}
        results={results}
      />
    </div>
  );
}

/**
 * Step 1: Disability Entry
 */
function TDIUExplanation() {
  return (
    <div className="bg-green-50 dark:bg-green-900/30 border-l-4 border-green-500 p-4 rounded-r-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💰</span>
        <div>
          <h3 className="font-bold text-green-800 dark:text-green-200">
            What is TDIU?
          </h3>
          <p className="text-green-700 dark:text-green-300 text-sm mt-1">
            <strong>Total Disability Individual Unemployability</strong> pays
            you at the 100% rate even if your combined rating is only 60-70%.
            You qualify if you{" "}
            <strong>cannot maintain substantially gainful employment</strong>{" "}
            due to your service-connected disabilities.
          </p>
        </div>
      </div>
    </div>
  );
}

function SchedularEligibilityBanner({ savedRatingsTdiu }) {
  if (!savedRatingsTdiu.hasRatings) return null;
  if (savedRatingsTdiu.eligible) {
    return (
      <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-blue-800 dark:text-blue-200">
          ✅ Your saved ratings meet the schedular TDIU threshold
        </h3>
        <p className="text-blue-700 dark:text-blue-300 text-sm mt-1">
          Your saved VA ratings ({savedRatingsTdiu.combined}% combined, highest
          single {savedRatingsTdiu.highest}%) meet the schedular requirement of
          38 CFR § 4.16(a). If your service-connected conditions prevent you
          from maintaining substantially gainful employment, you may qualify for
          TDIU - speak with a VSO before filing.
        </p>
      </div>
    );
  }
  return (
    <div className="bg-gray-50 dark:bg-gray-800/50 border-l-4 border-gray-400 p-4 rounded-r-lg">
      <h3 className="font-bold text-gray-800 dark:text-gray-200">
        Your saved ratings are below the schedular TDIU threshold
      </h3>
      <p className="text-gray-600 dark:text-gray-300 text-sm mt-1">
        Your saved VA ratings ({savedRatingsTdiu.combined}% combined, highest
        single {savedRatingsTdiu.highest}%) do not meet the schedular
        requirement of 38 CFR § 4.16(a) (one rating of 60%+, or 70%+ combined
        with one rating of 40%+). You may still qualify for extraschedular TDIU
        under § 4.16(b) if you cannot work - speak with a VSO.
      </p>
    </div>
  );
}

function AddedDisabilitiesList({ disabilities, removeDisability }) {
  if (disabilities.length === 0) return null;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
        📋 Your Disabilities ({disabilities.length})
      </h3>
      <div className="space-y-3">
        {disabilities.map((d, i) => (
          <div
            key={d.condition}
            className="bg-gray-50 dark:bg-gray-700/50 rounded-lg p-4 relative"
          >
            <button
              onClick={() => removeDisability(i)}
              className="absolute top-2 right-2 text-red-500 hover:text-red-700"
            >
              ✕
            </button>
            <p className="font-semibold text-gray-800 dark:text-gray-100">
              {d.condition}
            </p>
            <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
              {d.symptoms.join(" • ")}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConditionSelector({ currentDisability, setCurrentDisability }) {
  return (
    <div className="mb-4">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        What condition affects your work?
      </label>
      <select
        aria-label="What condition affects your work?"
        value={currentDisability.condition}
        onChange={(e) =>
          setCurrentDisability({ condition: e.target.value, symptoms: [] })
        }
        className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
      >
        <option value="">Select a condition...</option>
        {DISABILITY_CATEGORIES.map((cat) => (
          <optgroup key={cat.category} label={`${cat.icon} ${cat.category}`}>
            {cat.conditions.map((c) => (
              <option key={c.name} value={c.name}>
                {c.name}
              </option>
            ))}
          </optgroup>
        ))}
        <option value="Other">Other (specify symptoms below)</option>
      </select>
    </div>
  );
}

function SymptomSelector({
  currentDisability,
  getCommonSymptoms,
  toggleSymptom,
  customSymptom,
  setCustomSymptom,
  addCustomSymptom,
}) {
  if (!currentDisability.condition) return null;
  return (
    <div className="mb-4">
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        How does it affect your ability to work? (Select all that apply)
      </label>

      {/* Common symptoms */}
      {getCommonSymptoms().length > 0 && (
        <div className="flex flex-wrap gap-2 mb-3">
          {getCommonSymptoms().map((symptom) => (
            <button
              key={symptom}
              onClick={() => toggleSymptom(symptom)}
              className={`px-3 py-2 rounded-lg text-sm font-medium transition-all ${
                currentDisability.symptoms.includes(symptom)
                  ? "bg-green-600 text-white"
                  : "bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-gray-600"
              }`}
            >
              {currentDisability.symptoms.includes(symptom) ? "✓ " : ""}
              {symptom}
            </button>
          ))}
        </div>
      )}

      {/* Custom symptom */}
      <div className="flex gap-2">
        <input
          type="text"
          value={customSymptom}
          onChange={(e) => setCustomSymptom(e.target.value)}
          onKeyPress={(e) => e.key === "Enter" && addCustomSymptom()}
          placeholder="Add custom symptom (e.g., 'Cannot type for more than 5 minutes')"
          className="flex-1 p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
        />
        <button
          onClick={addCustomSymptom}
          className="px-4 py-2 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-xl hover:bg-gray-300 dark:hover:bg-gray-500"
        >
          Add
        </button>
      </div>

      {/* Selected symptoms display */}
      {currentDisability.symptoms.length > 0 && (
        <div className="mt-3 p-3 bg-green-50 dark:bg-green-900/30 rounded-lg">
          <p className="text-sm font-medium text-green-800 dark:text-green-200">
            Selected: {currentDisability.symptoms.join(" • ")}
          </p>
        </div>
      )}
    </div>
  );
}

function AddDisabilityForm({
  currentDisability,
  setCurrentDisability,
  getCommonSymptoms,
  toggleSymptom,
  customSymptom,
  setCustomSymptom,
  addCustomSymptom,
  addDisability,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
        ➕ Add a Disability
      </h3>

      <ConditionSelector
        currentDisability={currentDisability}
        setCurrentDisability={setCurrentDisability}
      />

      <SymptomSelector
        currentDisability={currentDisability}
        getCommonSymptoms={getCommonSymptoms}
        toggleSymptom={toggleSymptom}
        customSymptom={customSymptom}
        setCustomSymptom={setCustomSymptom}
        addCustomSymptom={addCustomSymptom}
      />

      {/* Add Button */}
      {currentDisability.condition && currentDisability.symptoms.length > 0 && (
        <button
          onClick={addDisability}
          className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
        >
          ✓ Add This Disability
        </button>
      )}
    </div>
  );
}

function DisabilityStep({
  savedRatingsTdiu,
  disabilities,
  removeDisability,
  currentDisability,
  setCurrentDisability,
  getCommonSymptoms,
  toggleSymptom,
  customSymptom,
  setCustomSymptom,
  addCustomSymptom,
  addDisability,
  onContinue,
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <TDIUExplanation />
      <SchedularEligibilityBanner savedRatingsTdiu={savedRatingsTdiu} />
      <AddedDisabilitiesList
        disabilities={disabilities}
        removeDisability={removeDisability}
      />
      <AddDisabilityForm
        currentDisability={currentDisability}
        setCurrentDisability={setCurrentDisability}
        getCommonSymptoms={getCommonSymptoms}
        toggleSymptom={toggleSymptom}
        customSymptom={customSymptom}
        setCustomSymptom={setCustomSymptom}
        addCustomSymptom={addCustomSymptom}
        addDisability={addDisability}
      />

      {/* Continue Button */}
      {disabilities.length > 0 && (
        <button
          onClick={onContinue}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-xl font-bold transition-colors"
        >
          Continue to Work History →
        </button>
      )}
    </div>
  );
}

/**
 * Step 2: Work History
 */
function LastWorkedField({ workHistory, setWorkHistory }) {
  return (
    <div>
      <label
        htmlFor="tdiu-last-worked"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        When did you last work?
      </label>
      <input
        id="tdiu-last-worked"
        type="text"
        value={workHistory.lastWorked}
        onChange={(e) =>
          setWorkHistory((prev) => ({
            ...prev,
            lastWorked: e.target.value,
          }))
        }
        placeholder="e.g., March 2022"
        className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
      />
    </div>
  );
}

function LastOccupationField({ workHistory, setWorkHistory }) {
  return (
    <div>
      <label
        htmlFor="tdiu-last-occupation"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        What was your last occupation?
      </label>
      <input
        id="tdiu-last-occupation"
        type="text"
        value={workHistory.lastOccupation}
        onChange={(e) =>
          setWorkHistory((prev) => ({
            ...prev,
            lastOccupation: e.target.value,
          }))
        }
        placeholder="e.g., Warehouse Supervisor"
        className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
      />
    </div>
  );
}

function ReasonLeftField({ workHistory, setWorkHistory }) {
  return (
    <div>
      <label
        htmlFor="tdiu-reason-left"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Why did you stop working?
      </label>
      <div className="relative">
        <textarea
          id="tdiu-reason-left"
          value={workHistory.reasonLeft}
          onChange={(e) =>
            setWorkHistory((prev) => ({
              ...prev,
              reasonLeft: e.target.value,
            }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              const nextField = document.querySelector(
                'textarea[placeholder*="tried a desk job"]',
              );
              if (nextField) nextField.focus();
            }
          }}
          placeholder="e.g., Back pain made it impossible to stand for my shifts. I had to take too many sick days. (Use mic to speak your answer)"
          rows={3}
          className="w-full p-3 pr-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none"
        />
        <div className="absolute right-2 top-2">
          <VoiceInputButton
            onTranscript={(text) =>
              setWorkHistory((prev) => ({
                ...prev,
                reasonLeft: prev.reasonLeft
                  ? `${prev.reasonLeft} ${text}`
                  : text,
              }))
            }
            size="sm"
          />
        </div>
      </div>
    </div>
  );
}

function EducationField({ workHistory, setWorkHistory }) {
  return (
    <div>
      {/* eslint-disable-next-line jsx-a11y/label-has-associated-control */}
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        Highest level of education?
      </label>
      <select
        aria-label="Highest level of education?"
        value={workHistory.education}
        onChange={(e) =>
          setWorkHistory((prev) => ({
            ...prev,
            education: e.target.value,
          }))
        }
        className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
      >
        <option value="">Select...</option>
        <option value="Less than High School">Less than High School</option>
        <option value="High School / GED">High School / GED</option>
        <option value="Some College">Some College</option>
        <option value="Associate Degree">Associate Degree</option>
        <option value="Bachelor's Degree">Bachelor&apos;s Degree</option>
        <option value="Master's Degree or Higher">
          Master&apos;s Degree or Higher
        </option>
      </select>
    </div>
  );
}

function TriedToWorkField({
  workHistory,
  setWorkHistory,
  disabilities,
  step,
  handleGenerate,
}) {
  return (
    <div>
      <label
        htmlFor="tdiu-tried-to-work"
        className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
      >
        Have you tried to work since leaving your last job? What happened?
      </label>
      <div className="relative">
        <textarea
          id="tdiu-tried-to-work"
          value={workHistory.triedToWork}
          onChange={(e) =>
            setWorkHistory((prev) => ({
              ...prev,
              triedToWork: e.target.value,
            }))
          }
          onKeyDown={(e) => {
            if (e.key === "Enter" && e.ctrlKey) {
              e.preventDefault();
              if (disabilities.length > 0 && step === 2) {
                handleGenerate();
              }
            }
          }}
          placeholder="e.g., I tried a desk job but couldn't sit for more than 15 minutes without severe pain. (Use mic to speak your answer)"
          rows={3}
          className="w-full p-3 pr-12 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 resize-none"
        />
        <div className="absolute right-2 top-2">
          <VoiceInputButton
            onTranscript={(text) =>
              setWorkHistory((prev) => ({
                ...prev,
                triedToWork: prev.triedToWork
                  ? `${prev.triedToWork} ${text}`
                  : text,
              }))
            }
            size="sm"
          />
        </div>
      </div>
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        🔒 Voice input is 100% on-device. Nothing leaves your browser.
      </p>
    </div>
  );
}

function WorkHistoryNavigation({ onBack, handleGenerate, isGenerating }) {
  return (
    <div className="flex gap-4">
      <button
        onClick={onBack}
        className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        ← Back
      </button>
      <button
        onClick={handleGenerate}
        disabled={isGenerating}
        className="flex-1 px-4 py-3 bg-blue-500 hover:bg-blue-600 disabled:bg-gray-400 disabled:cursor-not-allowed text-white rounded-xl font-medium flex items-center justify-center gap-2 transition-colors"
      >
        {isGenerating ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            <span>Analyzing...</span>
          </>
        ) : (
          <>
            <span>🎯</span>
            <span>Generate Vocational Statement</span>
          </>
        )}
      </button>
    </div>
  );
}

function WorkHistoryStep({
  workHistory,
  setWorkHistory,
  disabilities,
  step,
  handleGenerate,
  isGenerating,
  onBack,
}) {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          💼 Your Work History (Optional but Helpful)
        </h3>

        <div className="space-y-4">
          <LastWorkedField
            workHistory={workHistory}
            setWorkHistory={setWorkHistory}
          />
          <LastOccupationField
            workHistory={workHistory}
            setWorkHistory={setWorkHistory}
          />
          <ReasonLeftField
            workHistory={workHistory}
            setWorkHistory={setWorkHistory}
          />
          <EducationField
            workHistory={workHistory}
            setWorkHistory={setWorkHistory}
          />
          <TriedToWorkField
            workHistory={workHistory}
            setWorkHistory={setWorkHistory}
            disabilities={disabilities}
            step={step}
            handleGenerate={handleGenerate}
          />
        </div>
      </div>

      <WorkHistoryNavigation
        onBack={onBack}
        handleGenerate={handleGenerate}
        isGenerating={isGenerating}
      />
    </div>
  );
}

/**
 * Step 3: Results
 */
function ResultsBanner() {
  return (
    <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
      <div className="flex items-center gap-4">
        <div className="bg-white/20 rounded-full p-3">
          <span className="text-4xl">💼</span>
        </div>
        <div>
          <h3 className="text-2xl font-bold">Your TDIU statement draft</h3>
          <p className="text-white">
            Fill in each [bracketed] blank below in your own words, then copy
            the Box 18 statement into your VA Form 21-8940.
          </p>
        </div>
      </div>
    </div>
  );
}

// The work-history answers as given, shown beside the analysis so nothing
// the veteran typed is seen only in the download.
function WorkHistorySummary({ workHistory }) {
  const entries = workHistoryEntries(workHistory);
  if (entries.length === 0) return null;
  return (
    <section
      aria-labelledby="tdiu-work-history-heading"
      className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6"
    >
      <h3
        id="tdiu-work-history-heading"
        className="font-bold text-gray-800 dark:text-gray-100 mb-1"
      >
        Your work history
      </h3>
      <p className="text-sm text-gray-700 dark:text-gray-300 mb-3">
        These answers go in the downloaded report as you typed them. Use Start
        Over to change them.
      </p>
      <dl className="space-y-2 text-sm text-gray-800 dark:text-gray-200">
        {entries.map(([label, answer]) => (
          <div key={label}>
            <dt className="font-semibold">{label}</dt>
            <dd className="whitespace-pre-wrap break-words">{answer}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

function DownloadOptions({
  showDownloadMenu,
  setShowDownloadMenu,
  downloadPDF,
  downloadDOCX,
}) {
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h3 className="font-bold text-gray-800 dark:text-gray-100">
            Download Full Report
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Save for your records or to share with your VSO
          </p>
        </div>
        <div className="relative">
          <button
            onClick={() => setShowDownloadMenu(!showDownloadMenu)}
            className="px-4 py-2 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors flex items-center gap-2"
          >
            📥 Download
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
                d="M19 9l-7 7-7-7"
              />
            </svg>
          </button>

          {showDownloadMenu && (
            <div className="absolute right-0 mt-2 w-48 bg-white dark:bg-gray-700 rounded-lg shadow-xl border border-gray-200 dark:border-gray-600 z-10">
              <button
                onClick={() => {
                  downloadPDF();
                  setShowDownloadMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-t-lg"
              >
                📑 Download as PDF
              </button>
              <button
                onClick={() => {
                  downloadDOCX();
                  setShowDownloadMenu(false);
                }}
                className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg"
              >
                📝 Download as DOCX
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function NextSteps() {
  return (
    <div className="bg-blue-50 dark:bg-blue-900/30 border-l-4 border-blue-500 p-4 rounded-r-lg">
      <h3 className="font-bold text-blue-800 dark:text-blue-200 mb-2">
        📋 Next Steps
      </h3>
      <ol className="text-blue-700 dark:text-blue-300 text-sm space-y-1 list-decimal list-inside">
        <li>
          Complete <strong>VA Form 21-8940</strong> (Application for
          Unemployability)
        </li>
        <li>
          Paste the Box 18 statement into the employment limitation section
        </li>
        <li>
          Complete <strong>VA Form 21-4192</strong> (Request for Employment
          Information) - have your last employer fill this out
        </li>
        <li>Submit both forms together with any supporting medical records</li>
      </ol>
    </div>
  );
}

function ResultsStep({
  vocationalAnalysis,
  editAnalysis,
  copyToClipboard,
  saveToPacket,
  saveState,
  showDownloadMenu,
  setShowDownloadMenu,
  downloadPDF,
  downloadDOCX,
  downloadError,
  workHistory,
  onStartOver,
}) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <ResultsBanner />
      <TdiuAnalysisEditor
        analysis={vocationalAnalysis}
        onChange={editAnalysis}
        onCopy={copyToClipboard}
        onSave={saveToPacket}
        saveState={saveState}
      />
      <WorkHistorySummary workHistory={workHistory} />
      {downloadError && (
        <p
          role="alert"
          className="p-3 rounded-lg border border-red-700 bg-red-50 dark:bg-red-900/30 text-sm text-red-900 dark:text-red-100"
        >
          {downloadError}
        </p>
      )}
      <DownloadOptions
        showDownloadMenu={showDownloadMenu}
        setShowDownloadMenu={setShowDownloadMenu}
        downloadPDF={downloadPDF}
        downloadDOCX={downloadDOCX}
      />
      <NextSteps />

      {/* Start Over */}
      <button
        onClick={onStartOver}
        className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        🔄 Start Over
      </button>
    </div>
  );
}
