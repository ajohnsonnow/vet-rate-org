/**
 * Vet-Rate.org - TDIU Work Impact Builder
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
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

import React, { useState, useCallback, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import { useBodyScrollLock } from "../utils/useBodyScrollLock";
import BuyMeCoffee from "./BuyMeCoffee";
import ReportBugLink from "./ReportBugLink";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";
import { isAIAvailable } from "../utils/aiStatementHelper";
import {
  generateAI,
  isAnyAIAvailable,
  AI_MODES,
} from "../utils/unifiedAIService";
import { useAIStatus } from "../hooks/useAIStatus";
import { AIStatusBadge, AIModeSelector } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import ShareButton from "./ShareButton";
import VoiceInputButton from "./VoiceInput";
import {
  getVeteranAIContext,
  saveAnalysisResults,
  PACKET_DOC_TYPES,
} from "../utils/veteranContextProvider";

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
 * Generate vocational impact analysis using Unified AI Service
 */
const generateVocationalImpact = async (disabilities, veteranContext = "") => {
  // Check if ANY AI is available
  if (!isAnyAIAvailable()) {
    throw new Error(
      "No AI available. Please configure an API key or enable Local AI.",
    );
  }

  const disabilityList = disabilities
    .map((d) => `- ${d.condition}: ${d.symptoms.join(", ")}`)
    .join("\n");

  const contextBlock = veteranContext
    ? `\nVETERAN CASE DATA (use for accurate service details and condition history):\n${veteranContext}\n`
    : "";

  const prompt = `You are a Vocational Rehabilitation Expert analyzing a veteran's disabilities for a TDIU (Total Disability Individual Unemployability) claim.
${contextBlock}
VETERAN'S SERVICE-CONNECTED DISABILITIES AND SYMPTOMS:
${disabilityList}

YOUR TASK:
Translate these symptoms into formal "Occupational Limitations" that demonstrate why this veteran cannot maintain Substantially Gainful Employment.

RULES:
1. Use professional vocational rehabilitation terminology
2. Connect each symptom to specific workplace requirements it precludes
3. Focus on how these limitations interact/compound each other
4. Reference "sedentary," "light," "medium," and "heavy" work classifications
5. Mention "competitive employment environment" and "reasonable accommodations"
6. Be factual and clinical, not emotional

RESPOND IN THIS EXACT JSON FORMAT:
{
  "limitations": [
    {
      "condition": "Condition Name",
      "symptom": "Specific symptom",
      "vocational_impact": "Professional statement of how this limits work capacity"
    }
  ],
  "combined_effect": "2-3 sentences explaining how these conditions TOGETHER create unemployability",
  "summary_argument": "4-5 sentence formal argument for Box 18 of VA Form 21-8940 stating why the veteran cannot maintain Substantially Gainful Employment",
  "job_types_precluded": ["Sedentary", "Light", "Medium", "Heavy"]
}`;

  // Use unified AI service
  const response = await generateAI(prompt, {
    temperature: 0.4,
    maxTokens: 2048,
    expectJSON: true,
  });

  // generateAI returns { text, mode } object - extract the text content
  const text = response?.text || response;
  const textStr = typeof text === "string" ? text : JSON.stringify(text);

  // Extract JSON from response
  const jsonMatch = textStr.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error("Invalid response format");
  }

  return JSON.parse(jsonMatch[0]);
};

/**
 * Generate template-based vocational impact (fallback without AI)
 */
const generateTemplateImpact = (disabilities) => {
  const limitations = disabilities.flatMap((d) =>
    d.symptoms.map((symptom) => ({
      condition: d.condition,
      symptom: symptom,
      vocational_impact: getTemplateImpact(d.condition, symptom),
    })),
  );

  const conditionNames = disabilities.map((d) => d.condition).join(", ");

  return {
    limitations,
    combined_effect: `The combination of ${conditionNames} creates a constellation of functional impairments that exceed the sum of individual limitations. These conditions interact to produce unpredictable flare-ups, requiring unscheduled absences that would exceed employer tolerance in a competitive work environment.`,
    summary_argument: `Due to service-connected disabilities (${conditionNames}), I am unable to secure and maintain substantially gainful employment. My functional limitations preclude both sedentary and physical work requirements. The unpredictable nature of my symptoms makes it impossible to maintain the consistent attendance and productivity required in a competitive employment environment. No reasonable accommodations exist that would allow me to perform the essential functions of any occupation for which I am qualified by education and experience.`,
    job_types_precluded: ["Sedentary", "Light", "Medium", "Heavy"],
  };
};

/**
 * Template vocational impact statements
 */
const getTemplateImpact = (condition, symptom) => {
  const lowerSymptom = symptom.toLowerCase();

  // Sitting/standing limitations
  if (lowerSymptom.includes("sit") || lowerSymptom.includes("stand")) {
    return `This limitation precludes sustained ${lowerSymptom.includes("sit") ? "sedentary" : "standing"} work; veteran cannot maintain posture required for typical 8-hour workday even with scheduled breaks.`;
  }

  // Lifting limitations
  if (lowerSymptom.includes("lift") || lowerSymptom.includes("carry")) {
    return `This precludes physical labor occupations requiring lifting/carrying; limitation also impacts sedentary work requiring occasional handling of materials.`;
  }

  // Concentration/focus
  if (
    lowerSymptom.includes("concentrat") ||
    lowerSymptom.includes("focus") ||
    lowerSymptom.includes("memory")
  ) {
    return `Impaired cognitive function prevents sustained concentration required for competitive employment; veteran cannot reliably process instructions or maintain task focus.`;
  }

  // Pain-related
  if (lowerSymptom.includes("pain")) {
    return `Chronic pain syndrome causes distraction and reduces productivity below competitive employment standards; pain management may require unscheduled breaks.`;
  }

  // Fatigue
  if (
    lowerSymptom.includes("fatigue") ||
    lowerSymptom.includes("tired") ||
    lowerSymptom.includes("sleep")
  ) {
    return `Fatigue prevents sustained work effort; veteran cannot maintain energy levels required for full-time employment in any occupation.`;
  }

  // Social/interpersonal
  if (
    lowerSymptom.includes("anger") ||
    lowerSymptom.includes("irritab") ||
    lowerSymptom.includes("social")
  ) {
    return `Impaired interpersonal functioning precludes work requiring interaction with supervisors, coworkers, or public; limits veteran to isolated work that is not available in competitive market.`;
  }

  // Attacks/episodes
  if (
    lowerSymptom.includes("attack") ||
    lowerSymptom.includes("episode") ||
    lowerSymptom.includes("flare")
  ) {
    return `Unpredictable symptomatic episodes require unscheduled workplace absences that would exceed employer tolerance for absenteeism in competitive employment.`;
  }

  // Default
  return `This functional limitation significantly impacts the veteran's ability to perform essential job functions in a competitive employment environment.`;
};

export default function TDIUBuilder({
  onClose,
  onReportBug,
  onOpenAISettings,
}) {
  const { t } = useLanguage();
  // Lock body scroll when modal is open
  useBodyScrollLock(true);

  // Ref for screenshot/share functionality
  const tdiuContentRef = useRef(null);

  // Wizard state
  const [step, setStep] = useState(1);
  const [showBuyMeCoffee, setShowBuyMeCoffee] = useState(false);
  const [disabilities, setDisabilities] = useState([]);
  const [currentDisability, setCurrentDisability] = useState({
    condition: "",
    symptoms: [],
  });
  const [customSymptom, setCustomSymptom] = useState("");

  // Work history state
  const [workHistory, setWorkHistory] = useState({
    lastWorked: "",
    lastOccupation: "",
    reasonLeft: "",
    education: "",
    triedToWork: "",
  });

  // AI state
  const [isGenerating, setIsGenerating] = useState(false);
  const [error, setError] = useState(null);
  const [showAISettings, setShowAISettings] = useState(false);
  const aiStatus = useAIStatus();

  // Output state
  const [vocationalAnalysis, setVocationalAnalysis] = useState(null);
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);

  /**
   * Add current disability to list
   */
  const addDisability = () => {
    if (currentDisability.condition && currentDisability.symptoms.length > 0) {
      setDisabilities((prev) => [...prev, { ...currentDisability }]);
      setCurrentDisability({ condition: "", symptoms: [] });
    }
  };

  /**
   * Remove a disability
   */
  const removeDisability = (index) => {
    setDisabilities((prev) => prev.filter((_, i) => i !== index));
  };

  /**
   * Toggle a symptom
   */
  const toggleSymptom = (symptom) => {
    setCurrentDisability((prev) => ({
      ...prev,
      symptoms: prev.symptoms.includes(symptom)
        ? prev.symptoms.filter((s) => s !== symptom)
        : [...prev.symptoms, symptom],
    }));
  };

  /**
   * Add custom symptom
   */
  const addCustomSymptom = () => {
    if (customSymptom.trim()) {
      setCurrentDisability((prev) => ({
        ...prev,
        symptoms: [...prev.symptoms, customSymptom.trim()],
      }));
      setCustomSymptom("");
    }
  };

  /**
   * Get common symptoms for selected condition
   */
  const getCommonSymptoms = () => {
    for (const category of DISABILITY_CATEGORIES) {
      const condition = category.conditions.find(
        (c) => c.name === currentDisability.condition,
      );
      if (condition) return condition.commonSymptoms;
    }
    return [];
  };

  /**
   * Generate the vocational analysis
   */
  const handleGenerate = async () => {
    if (disabilities.length === 0) {
      setError("Please add at least one disability with symptoms.");
      return;
    }

    setError(null);
    setIsGenerating(true);

    try {
      let analysis;

      // Load veteran context for smarter generation
      const veteranContext = await getVeteranAIContext({
        maxPacketTokens: 600,
      });

      if (isAIAvailable()) {
        analysis = await generateVocationalImpact(disabilities, veteranContext);
      } else {
        analysis = generateTemplateImpact(disabilities);
      }

      setVocationalAnalysis(analysis);
      setStep(3);

      // Save the generated TDIU statement to My Packet
      const fullText = analysis.summary_argument || "";
      saveAnalysisResults({
        toolName: "TDIU Builder",
        classification: PACKET_DOC_TYPES.PERSONAL_STATEMENT,
        rawText: fullText,
        extractedData: analysis,
        vkbMergeData: {
          aiInsights: {
            tdiuSummary: analysis.summary_argument,
            tdiuJobsPrecluded: analysis.job_types_precluded,
          },
        },
      }).catch((err) => console.warn("Failed to save TDIU results:", err));
    } catch (err) {
      console.error("Generation error:", err);
      // Fall back to template
      const analysis = generateTemplateImpact(disabilities);
      setVocationalAnalysis(analysis);
      setStep(3);
    } finally {
      setIsGenerating(false);
    }
  };

  /**
   * Generate full statement text
   */
  const getFullStatement = () => {
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

    if (workHistory.lastWorked || workHistory.reasonLeft) {
      statement += `\n\n${"=".repeat(50)}\n`;
      statement += `ADDITIONAL WORK HISTORY CONTEXT:\n\n`;
      if (workHistory.lastWorked)
        statement += `Last Worked: ${workHistory.lastWorked}\n`;
      if (workHistory.lastOccupation)
        statement += `Last Occupation: ${workHistory.lastOccupation}\n`;
      if (workHistory.reasonLeft)
        statement += `Reason Left: ${workHistory.reasonLeft}\n`;
      if (workHistory.education)
        statement += `Education Level: ${workHistory.education}\n`;
      if (workHistory.triedToWork)
        statement += `Attempts to Work: ${workHistory.triedToWork}\n`;
    }

    return statement;
  };

  /**
   * Download as PDF
   */
  const downloadPDF = () => {
    const doc = new jsPDF();
    const pageWidth = doc.internal.pageSize.getWidth();
    const margin = 20;
    const maxWidth = pageWidth - margin * 2;

    doc.setFontSize(14);
    doc.setFont("helvetica", "bold");
    doc.text("Statement of Unemployability - VA Form 21-8940", margin, 20);

    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    const statement = getFullStatement();
    const lines = doc.splitTextToSize(statement, maxWidth);
    let yPosition = 35;

    lines.forEach((line) => {
      if (yPosition > 280) {
        doc.addPage();
        yPosition = 20;
      }
      doc.text(line, margin, yPosition);
      yPosition += 5;
    });

    doc.save("TDIU_Vocational_Statement.pdf");
  };

  /**
   * Download as DOCX
   */
  const downloadDOCX = async () => {
    const statement = getFullStatement();

    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              children: [
                new TextRun({
                  text: "Statement of Unemployability - VA Form 21-8940",
                  bold: true,
                  size: 28,
                }),
              ],
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
            }),
            new Paragraph({ text: "" }),
            ...statement.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun({ text: line, size: 24 })],
                  spacing: { after: 120 },
                }),
            ),
          ],
        },
      ],
    });

    const blob = await Packer.toBlob(doc);
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "TDIU_Vocational_Statement.docx";
    a.click();
    URL.revokeObjectURL(url);
  };

  /**
   * Copy to clipboard
   */
  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(vocationalAnalysis.summary_argument);
      alert("Box 18 statement copied to clipboard!");
    } catch (err) {
      console.error("Copy failed:", err);
    }
  };

  /**
   * Render Step 1: Disability Entry
   */
  const renderDisabilityStep = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* TDIU Explanation */}
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

      {/* Added Disabilities */}
      {disabilities.length > 0 && (
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
            📋 Your Disabilities ({disabilities.length})
          </h3>
          <div className="space-y-3">
            {disabilities.map((d, i) => (
              <div
                key={i}
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
      )}

      {/* Add Disability Form */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          ➕ Add a Disability
        </h3>

        {/* Condition Selection */}
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
            What condition affects your work?
          </label>
          <select
            value={currentDisability.condition}
            onChange={(e) =>
              setCurrentDisability({ condition: e.target.value, symptoms: [] })
            }
            className="w-full p-3 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100"
          >
            <option value="">Select a condition...</option>
            {DISABILITY_CATEGORIES.map((cat) => (
              <optgroup
                key={cat.category}
                label={`${cat.icon} ${cat.category}`}
              >
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

        {/* Symptom Selection */}
        {currentDisability.condition && (
          <div className="mb-4">
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
        )}

        {/* Add Button */}
        {currentDisability.condition &&
          currentDisability.symptoms.length > 0 && (
            <button
              onClick={addDisability}
              className="w-full px-4 py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition-colors"
            >
              ✓ Add This Disability
            </button>
          )}
      </div>

      {/* Continue Button */}
      {disabilities.length > 0 && (
        <button
          onClick={() => setStep(2)}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white py-3 px-4 rounded-xl font-bold transition-colors"
        >
          Continue to Work History →
        </button>
      )}
    </div>
  );

  /**
   * Render Step 2: Work History
   */
  const renderWorkHistoryStep = () => (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          💼 Your Work History (Optional but Helpful)
        </h3>

        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              When did you last work?
            </label>
            <input
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              What was your last occupation?
            </label>
            <input
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Why did you stop working?
            </label>
            <div className="relative">
              <textarea
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

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Highest level of education?
            </label>
            <select
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
              <option value="Less than High School">
                Less than High School
              </option>
              <option value="High School / GED">High School / GED</option>
              <option value="Some College">Some College</option>
              <option value="Associate Degree">Associate Degree</option>
              <option value="Bachelor's Degree">Bachelor's Degree</option>
              <option value="Master's Degree or Higher">
                Master's Degree or Higher
              </option>
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
              Have you tried to work since leaving your last job? What happened?
            </label>
            <div className="relative">
              <textarea
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
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-4">
        <button
          onClick={() => setStep(1)}
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
    </div>
  );

  /**
   * Render Step 3: Results
   */
  const renderResultsStep = () => (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Success Banner */}
      <div className="bg-gradient-to-r from-amber-500 to-orange-600 rounded-xl p-6 text-white shadow-lg">
        <div className="flex items-center gap-4">
          <div className="bg-white/20 rounded-full p-3">
            <span className="text-4xl">💼</span>
          </div>
          <div>
            <h3 className="text-2xl font-bold">
              Vocational Analysis Complete!
            </h3>
            <p className="text-green-100">
              Copy the Box 18 statement below for your VA Form 21-8940
            </p>
          </div>
        </div>
      </div>

      {/* Box 18 Statement - THE MONEY SHOT */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden border-2 border-green-500">
        <div className="p-4 bg-green-50 dark:bg-green-900/30 border-b border-green-200 dark:border-green-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-green-800 dark:text-green-200">
                📝 Statement for Box 18 (VA Form 21-8940)
              </h3>
              <p className="text-sm text-green-600 dark:text-green-400">
                Copy this text directly into your TDIU application
              </p>
            </div>
            <button
              onClick={copyToClipboard}
              className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors flex items-center gap-2"
            >
              📋 Copy
            </button>
          </div>
        </div>
        <div className="p-6">
          <p className="text-gray-700 dark:text-gray-200 leading-relaxed">
            "{vocationalAnalysis?.summary_argument}"
          </p>
        </div>
      </div>

      {/* Work Types Precluded */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
          🚫 Work Categories Precluded
        </h3>
        <div className="flex flex-wrap gap-3">
          {vocationalAnalysis?.job_types_precluded?.map((job) => (
            <span
              key={job}
              className="px-4 py-2 bg-red-100 dark:bg-red-900/50 text-red-700 dark:text-red-300 rounded-lg font-medium"
            >
              ✕ {job} Work
            </span>
          ))}
        </div>
      </div>

      {/* Detailed Limitations */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
        <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600">
          <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
            📊 Detailed Functional Limitations
          </h3>
        </div>
        <div className="divide-y divide-gray-200 dark:divide-gray-700">
          {vocationalAnalysis?.limitations?.map((lim, i) => (
            <div key={i} className="p-4">
              <div className="flex items-start gap-3">
                <span className="px-2 py-1 bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 text-xs font-bold rounded">
                  {lim.condition}
                </span>
                <div>
                  <p className="font-medium text-gray-800 dark:text-gray-100">
                    {lim.symptom}
                  </p>
                  <p className="text-sm text-gray-600 dark:text-gray-300 mt-1">
                    {lim.vocational_impact}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Combined Effect */}
      <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 rounded-r-lg">
        <h3 className="font-bold text-amber-800 dark:text-amber-200 mb-2">
          🔗 Combined Effect
        </h3>
        <p className="text-amber-700 dark:text-amber-300">
          {vocationalAnalysis?.combined_effect}
        </p>
      </div>

      {/* Download Options */}
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

      {/* Next Steps */}
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
          <li>
            Submit both forms together with any supporting medical records
          </li>
        </ol>
      </div>

      {/* Start Over */}
      <button
        onClick={() => {
          setStep(1);
          setDisabilities([]);
          setVocationalAnalysis(null);
          setWorkHistory({
            lastWorked: "",
            lastOccupation: "",
            reasonLeft: "",
            education: "",
            triedToWork: "",
          });
        }}
        className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
      >
        🔄 Start Over
      </button>
    </div>
  );

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4 modal-backdrop overscroll-contain"
      onClick={onClose}
    >
      <div
        ref={tdiuContentRef}
        className="bg-white dark:bg-gray-800 rounded-xl shadow-2xl max-w-6xl w-full max-h-[90vh] overflow-hidden flex flex-col relative modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex-shrink-0 bg-gradient-to-r from-amber-600 to-orange-600 p-4 shadow-lg rounded-t-xl">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-3xl">💼</span>
              <div>
                <h2 className="text-xl font-bold text-white flex items-center gap-2">
                  TDIU Work Impact Builder
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                    AI
                  </span>
                  <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                    BETA
                  </span>
                </h2>
                <p className="text-sm text-amber-100">
                  The 100% Backdoor - Vocational Statement Generator
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
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
              <button
                onClick={onClose}
                className="p-2 text-white hover:bg-white/20 rounded-lg transition-colors"
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
            </div>
          </div>
        </div>

        {/* Scrollable Content */}
        <div className="overflow-y-auto flex-1 p-4">
          {/* Progress Steps */}
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
                    console.log(
                      "Smart AI loaded for TDIU Builder:",
                      model?.name,
                    );
                  }}
                />
              </div>
            )}
          </div>

          {/* Main Content */}
          <div className="max-w-4xl mx-auto p-6 pt-0">
            {error && (
              <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 mb-6 rounded-r-lg">
                <p className="text-red-700 dark:text-red-300">{error}</p>
              </div>
            )}

            {step === 1 && renderDisabilityStep()}
            {step === 2 && renderWorkHistoryStep()}
            {step === 3 && renderResultsStep()}

            {/* Support CTA on results page */}
            {step === 3 && vocationalAnalysis && (
              <div className="bg-gradient-to-r from-amber-900/40 to-yellow-900/40 rounded-2xl p-6 border border-amber-700/50 mt-6">
                \n{" "}
                <div className="flex items-center gap-4">
                  <img
                    src="/images/Anth.jpg"
                    alt="Anthony - Vet-Rate Developer"
                    className="w-14 h-14 rounded-full object-cover border-2 border-green-500 shadow-lg flex-shrink-0"
                  />
                  <div className="flex-1">
                    <p className="text-green-200 font-semibold mb-1">
                      💰 That statement would cost $500+ from a vocational
                      expert
                    </p>
                    <p className="text-green-300/70 text-sm">
                      TDIU claims are complex. Most veterans hire expensive
                      consultants just to translate their symptoms into
                      "occupational limitations." You just did it for free. Help
                      keep this tool available for every veteran fighting for
                      100%.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* BuyMeCoffee - shows after generating statement */}
        <BuyMeCoffee
          show={step === 3 && vocationalAnalysis !== null}
          trigger="tdiu"
          context={{ impact: disabilities.length > 0 }}
          componentKey="tdiu-builder"
        />
      </div>
    </div>
  );
}
