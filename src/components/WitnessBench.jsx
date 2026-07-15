/**
 * Vet-Rate.org - The Witness Bench Component
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * "Buddy Letter Wizard" - AI-powered interview for spouses, family members, and battle buddies
 * Generates VA Form 21-10210 (Lay/Witness Statement) focusing on observable behaviors
 *
 * The key insight: Veterans downplay their symptoms. Witnesses see the truth.
 * This tool asks the RIGHT questions to get powerful buddy statements.
 */

import { useState, useCallback, useRef } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";
import { saveClaim } from "../utils/claimsStorage";
import {
  generateAI,
  isAnyAIAvailable,
  getAIStatus,
  AI_MODES,
} from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import SmartAILoadButton from "./SmartAILoadButton";
import ShareButton from "./ShareButton";
import ReportBugLink from "./ReportBugLink";
import VoiceInputButton from "./VoiceInput";
import {
  getVeteranAIContext,
  saveAnalysisResults,
  PACKET_DOC_TYPES,
} from "../utils/veteranContextProvider";

/**
 * Relationship types that affect the interview questions
 * Labels are translation keys that get resolved via getRelationshipLabel()
 */
const RELATIONSHIP_TYPES = [
  { value: "spouse", labelKey: "relationshipSpouse", icon: "💑" },
  { value: "parent", labelKey: "relationshipParent", icon: "👨‍👩‍👧" },
  { value: "child", labelKey: "relationshipChild", icon: "👨‍👧" },
  { value: "sibling", labelKey: "relationshipSibling", icon: "👫" },
  { value: "friend", labelKey: "relationshipFriend", icon: "🤝" },
  { value: "buddy", labelKey: "relationshipBuddy", icon: "🎖️" },
  { value: "coworker", labelKey: "relationshipCoworker", icon: "💼" },
  { value: "neighbor", labelKey: "relationshipNeighbor", icon: "🏠" },
];

/**
 * Common condition categories for tailored questions
 * Labels are translation keys that get resolved via t()
 */
const CONDITION_CATEGORIES = {
  mental: {
    labelKey: "categoryMental",
    conditions: [
      "ptsd",
      "depression",
      "anxiety",
      "bipolar",
      "panic",
      "sleep",
      "insomnia",
      "nightmare",
    ],
  },
  physical: {
    labelKey: "categoryPhysical",
    conditions: [
      "back",
      "spine",
      "knee",
      "shoulder",
      "neck",
      "arthritis",
      "pain",
      "mobility",
      "fibromyalgia",
    ],
  },
  neurological: {
    labelKey: "categoryNeurological",
    conditions: [
      "tbi",
      "headache",
      "migraine",
      "neuropathy",
      "tremor",
      "memory",
      "cognitive",
    ],
  },
  hearing: {
    labelKey: "categoryHearing",
    conditions: ["hearing", "tinnitus", "deaf", "ear"],
  },
  respiratory: {
    labelKey: "categoryRespiratory",
    conditions: ["asthma", "breathing", "sleep apnea", "copd", "lung"],
  },
  other: {
    labelKey: "categoryOther",
    conditions: [],
  },
};

const buildRelationshipContextQuestion = () => ({
  id: "relationship_context",
  question: `How long have you known the veteran, and in what capacity? (living together, see each other daily, etc.)`,
  placeholder:
    'Example: "I have been married to [Veteran] for 15 years and we live together."',
});

const buildMentalHealthQuestions = (relationship) => {
  const questions = [];

  if (["spouse", "parent", "child", "sibling"].includes(relationship)) {
    questions.push({
      id: "sleep_behavior",
      question: `Describe the veteran's sleep behavior. Do they have nightmares? Do they talk or scream in their sleep? Do they sleep separately from others?`,
      placeholder:
        'Example: "He often wakes up drenched in sweat, yelling. I sleep in a separate room now because he once struck out in his sleep."',
    });
    questions.push({
      id: "social_withdrawal",
      question: `Tell me about a time you had to cancel plans or leave a social event because of the veteran's condition. Does the veteran avoid crowds or public places?`,
      placeholder:
        'Example: "We haven\'t been to a restaurant in 3 years. Last time we tried, he became agitated when seated with his back to the door."',
    });
    questions.push({
      id: "emotional_changes",
      question: `How has the veteran's personality changed since their service? Are there hobbies or activities they used to enjoy but stopped doing?`,
      placeholder:
        "Example: \"He used to love coaching our kids' baseball team. Now he won't go near the field because he says the loud noises trigger him.\"",
    });
  }

  if (relationship === "buddy") {
    questions.push({
      id: "service_comparison",
      question: `How was the veteran during your time serving together? How is that different from how they are now?`,
      placeholder:
        'Example: "In country, he was sharp, always on point. Now when we meet up, he seems distant, jumpy at loud noises."',
    });
  }

  questions.push({
    id: "anger_irritability",
    question: `Have you witnessed outbursts of anger, irritability, or emotional reactions that seem out of proportion? Describe a specific incident.`,
    placeholder:
      'Example: "Last month, when a car backfired, he dropped to the ground and it took 10 minutes to calm him down."',
  });

  return questions;
};

const buildPhysicalQuestions = () => [
  {
    id: "daily_tasks",
    question: `What everyday tasks have you observed the veteran struggling with? Does the veteran need help with things like putting on socks, tying shoes, or getting out of bed?`,
    placeholder:
      'Example: "I have to help him put on his socks every morning because he cannot bend over. He uses a grabber tool for anything on the floor."',
  },
  {
    id: "mobility_changes",
    question: `How has the veteran's ability to move around changed? Do they use any assistive devices? How far can they walk before needing to rest?`,
    placeholder:
      'Example: "He used to run marathons. Now he uses a cane and can only walk about 100 yards before his back seizes up."',
  },
  {
    id: "pain_observations",
    question: `Describe how you can tell when the veteran is in pain. What does their body language look like? Do they take medications frequently?`,
    placeholder:
      'Example: "He grimaces when getting up from chairs. I see him reach for his back constantly. He takes ibuprofen like candy."',
  },
  {
    id: "activity_limitations",
    question: `What activities has the veteran had to give up because of their physical condition? What do they avoid doing?`,
    placeholder:
      'Example: "He can no longer play with our grandchildren on the floor. He avoids stairs and hasn\'t been able to mow the lawn in 3 years."',
  },
];

const buildNeurologicalQuestions = () => [
  {
    id: "memory_issues",
    question: `Have you noticed memory problems? Does the veteran forget conversations, appointments, or important dates? Give a specific example.`,
    placeholder:
      'Example: "He forgot our daughter\'s birthday last year. He often repeats the same story in a single conversation without realizing it."',
  },
  {
    id: "headache_frequency",
    question: `How often do you see the veteran suffering from headaches or migraines? What do they do when they have one?`,
    placeholder:
      'Example: "At least 3-4 times a week, he goes to a dark room for hours. He can\'t tolerate any light or noise during these episodes."',
  },
  {
    id: "cognitive_changes",
    question: `Have you noticed changes in the veteran's ability to concentrate, make decisions, or process information?`,
    placeholder:
      'Example: "He used to be so sharp with finances. Now I handle all the bills because he gets confused and overwhelmed."',
  },
];

const buildHearingQuestions = () => [
  {
    id: "communication_struggles",
    question: `How does the veteran's hearing affect your daily communication? Do they ask you to repeat yourself? Do you have to face them when speaking?`,
    placeholder:
      'Example: "I have to tap his shoulder before speaking and face him directly. He misses phone calls constantly."',
  },
  {
    id: "tinnitus_impact",
    question: `If they have tinnitus (ringing in ears), how does it affect them? Do they need background noise to sleep? Do they seem distracted by it?`,
    placeholder:
      'Example: "He sleeps with a fan on full blast. In quiet rooms, I see him rubbing his ears and looking distressed."',
  },
];

const buildRespiratoryQuestions = () => [
  {
    id: "breathing_observations",
    question: `Describe the veteran's breathing difficulties you have witnessed. When do they occur? What does it look like?`,
    placeholder:
      'Example: "He gets winded just walking up the stairs. I hear him wheezing at night even with his CPAP machine."',
  },
];

const buildClosingQuestions = () => [
  {
    id: "work_impact",
    question: `How has the veteran's condition affected their ability to work? Have they missed work, been written up, or lost jobs?`,
    placeholder:
      "Example: \"He's lost two jobs in the past year. He can't sit for long periods and has to call out frequently for medical appointments.\"",
  },
  {
    id: "overall_impact",
    question: `In your own words, how has this condition changed the veteran's quality of life? What is the one thing you most want the VA to understand?`,
    placeholder:
      'Example: "He is not the same person who left for deployment. The strong, confident man I married now barely leaves the house."',
  },
];

/**
 * Base interview questions by relationship and condition type
 * These are the "good" questions that elicit observable behaviors
 */
const getBaseQuestions = (relationship, conditionCategory) => {
  const questions = [buildRelationshipContextQuestion()];

  // Mental health specific questions
  if (conditionCategory === "mental") {
    questions.push(...buildMentalHealthQuestions(relationship));
  }

  // Physical / musculoskeletal questions
  if (conditionCategory === "physical") {
    questions.push(...buildPhysicalQuestions());
  }

  // Neurological questions
  if (conditionCategory === "neurological") {
    questions.push(...buildNeurologicalQuestions());
  }

  // Hearing / Tinnitus questions
  if (conditionCategory === "hearing") {
    questions.push(...buildHearingQuestions());
  }

  // Respiratory questions
  if (conditionCategory === "respiratory") {
    questions.push(...buildRespiratoryQuestions());
  }

  // Universal closing questions
  questions.push(...buildClosingQuestions());

  return questions;
};

/**
 * Generate interview questions using AI based on relationship and condition
 */
const generateAIQuestions = async (
  relationship,
  condition,
  conditionCategory,
  veteranContext = "",
) => {
  // Check if ANY AI is available
  if (!isAnyAIAvailable()) {
    throw new Error(
      "No AI available. Please configure an API key or enable Local AI.",
    );
  }

  const relationshipLabel =
    RELATIONSHIP_TYPES.find((r) => r.value === relationship)?.label ||
    relationship;

  const contextBlock = veteranContext
    ? `\nVETERAN CASE DATA (use for accurate service details and condition specifics):\n${veteranContext}\n`
    : "";

  const prompt = `You are a Gentle Interviewer helping a veteran's family member write a "Lay Statement" (VA Form 21-10210).

CONTEXT:
- Relationship to veteran: ${relationshipLabel}
- Condition being claimed: ${condition}
- Condition category: ${conditionCategory}
${contextBlock}

YOUR GOAL:
Generate 4 specific, probing interview questions to help this ${relationshipLabel.toLowerCase()} describe how the veteran's ${condition} affects daily life.

RULES:
1. Ask for STORIES and SPECIFIC EXAMPLES, not yes/no questions
2. Focus on OBSERVABLE behaviors and changes (what they can SEE, HEAR, WITNESS)
3. DO NOT ask for medical opinions or diagnoses
4. Ask about things that would be powerful evidence for the VA

BAD QUESTION: "Is the veteran depressed?"
GOOD QUESTION: "Does the veteran have hobbies they used to love but stopped doing? Tell me about that change."

BAD QUESTION: "Is their back pain severe?"
GOOD QUESTION: "Describe a time you saw the veteran struggle with a simple task like putting on shoes or picking something up from the floor."

Return EXACTLY 4 questions in this JSON format:
{
  "questions": [
    {"id": "q1", "question": "Question text here", "placeholder": "Example response here"},
    {"id": "q2", "question": "Question text here", "placeholder": "Example response here"},
    {"id": "q3", "question": "Question text here", "placeholder": "Example response here"},
    {"id": "q4", "question": "Question text here", "placeholder": "Example response here"}
  ]
}`;

  // Use unified AI service
  const response = await generateAI(prompt, {
    temperature: 0.7,
    maxTokens: 1024,
    expectJSON: true,
  });

  // generateAI returns { text, mode } object - extract the text content
  const text = response?.text || response;
  const textStr = typeof text === "string" ? text : JSON.stringify(text);

  // Extract JSON from response (first "{" through the last "}")
  const jsonStart = textStr.indexOf("{");
  const jsonEnd = textStr.lastIndexOf("}");
  if (jsonStart === -1 || jsonEnd === -1 || jsonEnd < jsonStart) {
    throw new Error("Invalid response format");
  }

  const parsed = JSON.parse(textStr.slice(jsonStart, jsonEnd + 1));
  return parsed.questions;
};

/**
 * Compile answers into a formal buddy statement using AI
 */
const compileStatementWithAI = async (relationship, condition, answers) => {
  // Check if ANY AI is available
  if (!isAnyAIAvailable()) {
    throw new Error(
      "No AI available. Please configure an API key or enable Local AI.",
    );
  }

  const relationshipLabel =
    RELATIONSHIP_TYPES.find((r) => r.value === relationship)?.label ||
    relationship;

  // Format answers for the prompt
  const answersText = Object.entries(answers)
    .filter(([_, value]) => value && value.trim())
    .map(([key, value]) => `${key}: ${value}`)
    .join("\n\n");

  const prompt = `You are drafting a Buddy/Lay Statement (VA Form 21-10210) for a veteran's ${relationshipLabel.toLowerCase()}.

CONDITION BEING CLAIMED: ${condition}

WITNESS RESPONSES TO INTERVIEW QUESTIONS:
${answersText}

INSTRUCTIONS:
1. Write a first-person narrative from the WITNESS's perspective (use "I have observed..." not "The veteran...")
2. Use the specific details and stories provided - DO NOT invent new facts
3. Focus on OBSERVABLE behaviors, not medical opinions
4. Be sincere and factual, not dramatic or exaggerated
5. Include specific examples when provided
6. Do NOT include names, addresses, or dates (use [Veteran], [Date], etc.)
7. Format as 3-4 coherent paragraphs
8. Do NOT write any "I certify..." or "true and correct" attestation. End the narrative without a signature or certification line — the witness must add and sign their own attestation only after personally verifying every statement is true.

Write the complete buddy statement now:`;

  // Use unified AI service
  const response = await generateAI(prompt, {
    temperature: 0.6,
    maxTokens: 2048,
  });

  // generateAI returns { text, mode } object - extract the text content
  const text = response?.text || response;
  return typeof text === "string" ? text : JSON.stringify(text);
};

/**
 * Generate statement without AI (template-based)
 */
const compileStatementWithoutAI = (relationship, condition, answers) => {
  const relationshipLabel =
    RELATIONSHIP_TYPES.find((r) => r.value === relationship)?.label ||
    relationship;
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let statement = `STATEMENT IN SUPPORT OF CLAIM (VA FORM 21-10210)\n`;
  statement += `Witness Type: ${relationshipLabel}\n`;
  statement += `Regarding: ${condition}\n`;
  statement += `Date: ${currentDate}\n\n`;
  statement += `---\n\n`;

  if (answers.relationship_context) {
    statement += `${answers.relationship_context}\n\n`;
  }

  statement += `I am writing to provide my personal observations regarding [Veteran]'s ${condition}.\n\n`;

  // Add all answered questions
  const observationParts = [];

  Object.entries(answers).forEach(([key, value]) => {
    if (value && value.trim() && key !== "relationship_context") {
      observationParts.push(value.trim());
    }
  });

  if (observationParts.length > 0) {
    statement += `Based on my direct observations:\n\n`;
    observationParts.forEach((part) => {
      statement += `${part}\n\n`;
    });
  }

  // AIS-03 / LEGAL-03: do not pre-assert "I certify ... true and correct" above a
  // blank signature line — that presents AI-drafted testimony as already attested.
  // Make the attestation contingent on the witness reading, verifying, and signing,
  // and warn about the federal false-statement statute the witness signs under.
  statement += `--- WITNESS ATTESTATION (read before you sign) ---\n`;
  statement += `This statement was drafted with AI assistance. Before signing, read every sentence and confirm it describes something YOU personally witnessed and know to be true. A buddy/lay statement is submitted to the VA under penalty of law (18 U.S.C. § 1001) — a knowingly false statement is a federal crime. Edit anything that is not accurate.\n\n`;
  statement += `By signing below, I attest that I have read the statement above, that it reflects my own personal knowledge, and that it is true and correct to the best of my knowledge and belief:\n\n`;
  statement += `Respectfully submitted,\n\n`;
  statement += `_______________________________\n`;
  statement += `[Witness Signature]\n\n`;
  statement += `_______________________________\n`;
  statement += `[Witness Printed Name]\n\n`;
  statement += `_______________________________\n`;
  statement += `[Date]\n\n`;
  statement += `Contact Information:\n`;
  statement += `Phone: ___________________\n`;
  statement += `Email: ___________________\n`;

  return statement;
};

/**
 * Determine condition category from condition name
 */
const detectConditionCategory = (conditionName) => {
  const lowerCondition = conditionName.toLowerCase();

  for (const [category, data] of Object.entries(CONDITION_CATEGORIES)) {
    if (data.conditions.some((c) => lowerCondition.includes(c))) {
      return category;
    }
  }
  return "other";
};

// Helper to get translated relationship label
const getRelationshipLabel = (relationshipValue, t) => {
  const rel = RELATIONSHIP_TYPES.find((r) => r.value === relationshipValue);
  return rel ? t("witnessBench", rel.labelKey) : relationshipValue;
};

/**
 * Save buddy statement to My Packet
 */
const saveWitnessStatementToPacket = (
  { condition, relationship, generatedStatement, witnessName },
  setSavedToPacket,
  t,
) => {
  try {
    const claim = {
      conditionName: condition,
      status: "Evidence Gathered",
      evidence: [
        {
          type: "Buddy Statement",
          description: `Lay/Witness Statement (Form 21-10210) from ${getRelationshipLabel(relationship, t)}`,
          statement: generatedStatement,
          relationship: relationship,
          witness: witnessName,
          dateSaved: new Date().toISOString(),
        },
      ],
      notes: `Buddy statement from ${getRelationshipLabel(relationship, t)} regarding observable behaviors and functional impacts.`,
    };

    const success = saveClaim(claim);
    if (success) {
      setSavedToPacket(true);
      setTimeout(() => setSavedToPacket(false), 3000); // Reset after 3 seconds
    }
  } catch (error) {
    console.error("Error saving to My Packet:", error);
  }
};

/**
 * Download as PDF
 */
const downloadWitnessPDF = (generatedStatement, condition) => {
  const doc = new jsPDF();
  // RT2-5: honest provenance metadata — never a misleading "official"/physician author.
  doc.setProperties({
    title: "Lay/Witness Statement (VA Form 21-10210)",
    subject: "AI-assisted draft lay/witness statement",
    author: "Vet-Rate.org (AI-assisted draft)",
    creator: "Vet-Rate.org",
  });
  const pageWidth = doc.internal.pageSize.getWidth();
  const margin = 20;
  const maxWidth = pageWidth - margin * 2;

  doc.setFontSize(14);
  doc.setFont("helvetica", "bold");
  doc.text("Lay/Witness Statement (VA Form 21-10210)", margin, 20);

  // RT2-5: prominent page-1 banner so the AI-draft + false-statement warning
  // travels with the exported file, not just the on-screen UI. ASCII-only —
  // jsPDF's standard helvetica does not render the section sign or em dash.
  doc.setFontSize(8);
  doc.setFont("helvetica", "italic");
  let yPosition = 28;
  doc
    .splitTextToSize(
      "AI-ASSISTED DRAFT - not a sworn statement. The witness must read every sentence, confirm it is their own personal knowledge, edit anything inaccurate, and sign. Filed with the VA under penalty of law (18 U.S.C. 1001 - knowingly false statements are a federal crime).",
      maxWidth,
    )
    .forEach((line) => {
      doc.text(line, margin, yPosition);
      yPosition += 4;
    });
  yPosition += 4;

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");

  const lines = doc.splitTextToSize(generatedStatement, maxWidth);
  lines.forEach((line) => {
    if (yPosition > 280) {
      doc.addPage();
      yPosition = 20;
    }
    doc.text(line, margin, yPosition);
    yPosition += 5;
  });

  doc.save(`Buddy_Statement_${condition.replace(/\s+/g, "_")}.pdf`);
};

/**
 * Download as DOCX
 */
const downloadWitnessDOCX = async (generatedStatement, condition) => {
  const doc = new Document({
    // RT2-5: honest provenance metadata — never a misleading "official"/physician author.
    creator: "Vet-Rate.org (AI-assisted draft)",
    title: "Lay/Witness Statement (VA Form 21-10210)",
    description: "AI-assisted draft lay/witness statement",
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            children: [
              new TextRun({
                text: "Lay/Witness Statement (VA Form 21-10210)",
                bold: true,
                size: 28,
              }),
            ],
            heading: HeadingLevel.HEADING_1,
            alignment: AlignmentType.CENTER,
          }),
          // RT2-5: prominent page-1 AI-draft + false-statement banner so the
          // warning travels with the exported file, not just the on-screen UI.
          new Paragraph({
            children: [
              new TextRun({
                text: "AI-ASSISTED DRAFT — not a sworn statement. The witness must read every sentence, confirm it is their own personal knowledge, edit anything inaccurate, and sign. Filed with the VA under penalty of 18 U.S.C. § 1001 (knowingly false statements are a federal crime).",
                italics: true,
                size: 16,
              }),
            ],
            spacing: { after: 200 },
          }),
          new Paragraph({ text: "" }),
          ...generatedStatement.split("\n").map(
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
  a.download = `Buddy_Statement_${condition.replace(/\s+/g, "_")}.docx`;
  a.click();
  URL.revokeObjectURL(url);
};

/**
 * Copy to clipboard
 */
const copyWitnessStatement = async (generatedStatement, t) => {
  try {
    await navigator.clipboard.writeText(generatedStatement);
    alert(t("witnessBench", "statementCopied"));
  } catch (err) {
    console.error("Copy failed:", err);
  }
};

const getQuestionNavButtonClass = (isCurrent, isAnswered) => {
  if (isCurrent) return "bg-purple-600 text-white";
  if (isAnswered) {
    return "bg-green-100 dark:bg-green-900/50 text-green-700 dark:text-green-300";
  }
  return "bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600";
};

function useWizardStepState() {
  const [step, setStep] = useState(1);
  const [relationship, setRelationship] = useState("");
  const [condition, setCondition] = useState("");
  const [_conditionCategory, setConditionCategory] = useState("");
  const [witnessName, setWitnessName] = useState("");

  return {
    step,
    setStep,
    relationship,
    setRelationship,
    condition,
    setCondition,
    setConditionCategory,
    witnessName,
    setWitnessName,
  };
}

function useInterviewQAState() {
  const [questions, setQuestions] = useState([]);
  const [answers, setAnswers] = useState({});
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);

  const updateAnswer = (questionId, value) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  return {
    questions,
    setQuestions,
    answers,
    setAnswers,
    updateAnswer,
    currentQuestionIndex,
    setCurrentQuestionIndex,
  };
}

function useAIFlowState() {
  // AI state - now checks actual availability
  const aiAvailable = isAnyAIAvailable();
  const aiStatus = getAIStatus();
  const [useAI, setUseAI] = useState(aiAvailable);
  const [isLoadingQuestions, setIsLoadingQuestions] = useState(false);
  const [isGeneratingStatement, setIsGeneratingStatement] = useState(false);
  const [error, setError] = useState(null);

  return {
    aiAvailable,
    aiStatus,
    useAI,
    setUseAI,
    isLoadingQuestions,
    setIsLoadingQuestions,
    isGeneratingStatement,
    setIsGeneratingStatement,
    error,
    setError,
  };
}

function useOutputState() {
  const [generatedStatement, setGeneratedStatement] = useState("");
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [savedToPacket, setSavedToPacket] = useState(false);

  return {
    generatedStatement,
    setGeneratedStatement,
    showDownloadMenu,
    setShowDownloadMenu,
    savedToPacket,
    setSavedToPacket,
  };
}

/**
 * Move to interview step - load questions
 */
function useStartInterview({
  t,
  relationship,
  condition,
  useAI,
  aiAvailable,
  setError,
  setConditionCategory,
  setIsLoadingQuestions,
  setQuestions,
  setStep,
}) {
  return useCallback(async () => {
    if (!relationship || !condition) {
      setError(t("witnessBench", "selectRelationshipAndCondition"));
      return;
    }

    setError(null);
    const category = detectConditionCategory(condition);
    setConditionCategory(category);

    // Try AI questions first if available and enabled
    if (useAI && aiAvailable) {
      setIsLoadingQuestions(true);
      try {
        // Load veteran context for smarter questions
        const veteranContext = await getVeteranAIContext({
          maxPacketTokens: 500,
        });
        const aiQuestions = await generateAIQuestions(
          relationship,
          condition,
          category,
          veteranContext,
        );

        // Combine AI questions with base questions
        const baseQuestions = getBaseQuestions(relationship, category);
        const combinedQuestions = [
          baseQuestions[0], // Always start with relationship context
          ...aiQuestions,
          ...baseQuestions.slice(-2), // Always end with work impact and overall impact
        ];

        setQuestions(combinedQuestions);
        setStep(2);
      } catch (err) {
        console.error("AI question generation failed:", err);
        // Fall back to base questions
        setQuestions(getBaseQuestions(relationship, category));
        setStep(2);
      } finally {
        setIsLoadingQuestions(false);
      }
    } else {
      // Use base questions without AI
      setQuestions(getBaseQuestions(relationship, category));
      setStep(2);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationship, condition, useAI, aiAvailable]);
}

/**
 * Generate the final statement
 */
function useGenerateStatement({
  relationship,
  condition,
  answers,
  useAI,
  aiAvailable,
  setError,
  setIsGeneratingStatement,
  setGeneratedStatement,
  setStep,
}) {
  return useCallback(async () => {
    setError(null);
    setIsGeneratingStatement(true);

    try {
      let statement;

      if (useAI && aiAvailable) {
        statement = await compileStatementWithAI(
          relationship,
          condition,
          answers,
        );
      } else {
        statement = compileStatementWithoutAI(relationship, condition, answers);
      }

      setGeneratedStatement(statement);
      setStep(3);

      // Save buddy statement to My Packet
      saveAnalysisResults({
        toolName: "Witness Bench",
        classification: PACKET_DOC_TYPES.BUDDY_STATEMENT,
        rawText: statement,
        extractedData: {
          relationship,
          condition,
          answers,
          statementLength: statement.length,
        },
      }).catch((err) => console.warn("Failed to save buddy statement:", err));
    } catch (err) {
      console.error("Statement generation failed:", err);
      // Fall back to template
      const statement = compileStatementWithoutAI(
        relationship,
        condition,
        answers,
      );
      setGeneratedStatement(statement);
      setStep(3);

      // Still save even template-based output
      saveAnalysisResults({
        toolName: "Witness Bench",
        classification: PACKET_DOC_TYPES.BUDDY_STATEMENT,
        rawText: statement,
        extractedData: { relationship, condition, answers },
      }).catch((err) => console.warn("Failed to save buddy statement:", err));
    } finally {
      setIsGeneratingStatement(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [relationship, condition, answers, useAI]);
}

function useWitnessBench(t) {
  const wizard = useWizardStepState();
  const interview = useInterviewQAState();
  const ai = useAIFlowState();
  const output = useOutputState();

  const startInterview = useStartInterview({
    t,
    relationship: wizard.relationship,
    condition: wizard.condition,
    useAI: ai.useAI,
    aiAvailable: ai.aiAvailable,
    setError: ai.setError,
    setConditionCategory: wizard.setConditionCategory,
    setIsLoadingQuestions: ai.setIsLoadingQuestions,
    setQuestions: interview.setQuestions,
    setStep: wizard.setStep,
  });

  const generateStatement = useGenerateStatement({
    relationship: wizard.relationship,
    condition: wizard.condition,
    answers: interview.answers,
    useAI: ai.useAI,
    aiAvailable: ai.aiAvailable,
    setError: ai.setError,
    setIsGeneratingStatement: ai.setIsGeneratingStatement,
    setGeneratedStatement: output.setGeneratedStatement,
    setStep: wizard.setStep,
  });

  const startOver = () => {
    wizard.setStep(1);
    wizard.setRelationship("");
    wizard.setCondition("");
    interview.setQuestions([]);
    interview.setAnswers({});
    interview.setCurrentQuestionIndex(0);
    output.setGeneratedStatement("");
  };

  return {
    wizard,
    interview,
    ai,
    output,
    startInterview,
    generateStatement,
    startOver,
  };
}

const WitnessBenchHeader = ({
  t,
  onClose,
  onOpenAISettings,
  onReportBug,
  contentRef,
}) => (
  <div className="flex-shrink-0 bg-gradient-to-r from-violet-600 to-purple-600 p-4 shadow-lg rounded-t-xl">
    <div className="flex items-center justify-between">
      <div className="flex items-center gap-3">
        <span className="text-3xl">👥</span>
        <div>
          <h2
            id="witness-bench-title"
            className="text-xl font-bold text-white flex items-center gap-2"
          >
            {t("witnessBench", "title")}
            <span className="px-1.5 py-0.5 bg-violet-500 text-white text-[10px] font-bold rounded">
              {t("witnessBench", "aiBadge")}
            </span>
            <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded">
              {t("witnessBench", "betaBadge")}
            </span>
          </h2>
          <p className="text-sm text-violet-100">
            {t("witnessBench", "subtitle")}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        {/* AI Status & LLM Recommendation Badges */}
        <LLMRecommendationBadge toolId="witness-bench" />
        <AIStatusBadge onClick={onOpenAISettings} />
        <ShareButton
          targetRef={contentRef}
          filename="witness-statement"
          variant="icon"
        />
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="The Witness Bench"
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
);

const WitnessBenchIntro = ({ t }) => (
  <>
    {/* Info Banner */}
    <div className="bg-purple-50 dark:bg-purple-900/30 border-l-4 border-purple-500 p-4 mb-6 rounded-r-lg">
      <div className="flex items-start gap-3">
        <span className="text-2xl">💡</span>
        <div>
          <h3 className="font-bold text-purple-800 dark:text-purple-200">
            {t("witnessBench", "whyBuddyStatementsMatter")}
          </h3>
          <p className="text-purple-700 dark:text-purple-300 text-sm mt-1">
            {t("witnessBench", "buddyStatementExplanation")}
          </p>
        </div>
      </div>
    </div>

    {/* Smart AI Load Button */}
    {!isAnyAIAvailable() && (
      <div className="mb-6">
        <SmartAILoadButton
          toolId="witness-bench"
          onLoadComplete={(model) => {
            // eslint-disable-next-line no-console
            console.log("Smart AI loaded for Witness Bench:", model?.name);
          }}
        />
      </div>
    )}
  </>
);

const RelationshipPicker = ({ t, relationship, onSelect }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
      {t("witnessBench", "step1Title")}
    </h3>
    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
      {RELATIONSHIP_TYPES.map((type) => (
        <button
          key={type.value}
          onClick={() => onSelect(type.value)}
          className={`p-4 rounded-xl border-2 transition-all text-center ${
            relationship === type.value
              ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30"
              : "border-gray-200 dark:border-gray-600 hover:border-purple-300 dark:hover:border-purple-700"
          }`}
        >
          <span className="text-2xl block mb-1">{type.icon}</span>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {t("witnessBench", type.labelKey)}
          </span>
        </button>
      ))}
    </div>
  </div>
);

const ConditionInput = ({ t, condition, onChange }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
      {t("witnessBench", "step2Title")}
    </h3>
    <input
      type="text"
      value={condition}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("witnessBench", "conditionPlaceholder")}
      className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all"
    />
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
      {t("witnessBench", "conditionHelpText")}
    </p>
  </div>
);

const WitnessNameInput = ({ t, witnessName, onChange }) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
    <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100 mb-4">
      {t("witnessBench", "step3Title")}
    </h3>
    <input
      type="text"
      value={witnessName}
      onChange={(e) => onChange(e.target.value)}
      placeholder={t("witnessBench", "witnessNamePlaceholder")}
      className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all"
    />
    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
      {t("witnessBench", "witnessNameHelpText")}
    </p>
  </div>
);

const AIToggleCard = ({
  t,
  aiAvailable,
  aiStatus,
  useAI,
  onToggleAI,
  onOpenAISettings,
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
    <div className="flex items-center justify-between">
      <div>
        <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
          🤖 {t("witnessBench", "aiPoweredInterview")}
        </h3>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          {aiAvailable
            ? t("witnessBench", "aiAvailableDesc")
            : t("witnessBench", "aiNotConfigured")}
        </p>
        {aiAvailable && (
          <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">
            {aiStatus.mode === AI_MODES.LOCAL
              ? t("witnessBench", "usingLocalAI")
              : t("witnessBench", "usingCloudAI")}
          </p>
        )}
      </div>
      {aiAvailable ? (
        <button
          onClick={onToggleAI}
          className={`relative inline-flex h-8 w-14 items-center rounded-full transition-colors ${
            useAI ? "bg-purple-600" : "bg-gray-300 dark:bg-gray-600"
          }`}
        >
          <span
            className={`inline-block h-6 w-6 transform rounded-full bg-white shadow transition-transform ${
              useAI ? "translate-x-7" : "translate-x-1"
            }`}
          />
        </button>
      ) : (
        <button
          onClick={onOpenAISettings}
          className="px-3 py-2 text-sm bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 rounded-lg hover:bg-amber-200 dark:hover:bg-amber-800/40 transition-colors"
        >
          ⚙️ {t("witnessBench", "configureAI")}
        </button>
      )}
    </div>
    {!aiAvailable && (
      <div className="mt-3 p-3 bg-amber-50 dark:bg-amber-900/20 rounded-lg">
        <p className="text-sm text-amber-700 dark:text-amber-300">
          💡 <strong>{t("witnessBench", "standardQuestionsWork")}</strong>{" "}
          {t("witnessBench", "aiOptionalNote")}
        </p>
      </div>
    )}
  </div>
);

const SetupStep = ({
  t,
  relationship,
  onSelectRelationship,
  condition,
  onConditionChange,
  witnessName,
  onWitnessNameChange,
  aiAvailable,
  aiStatus,
  useAI,
  onToggleAI,
  onOpenAISettings,
  error,
  isLoadingQuestions,
  onStartInterview,
}) => (
  <div className="max-w-2xl mx-auto space-y-6">
    <RelationshipPicker
      t={t}
      relationship={relationship}
      onSelect={onSelectRelationship}
    />

    <ConditionInput t={t} condition={condition} onChange={onConditionChange} />

    <WitnessNameInput
      t={t}
      witnessName={witnessName}
      onChange={onWitnessNameChange}
    />

    <AIToggleCard
      t={t}
      aiAvailable={aiAvailable}
      aiStatus={aiStatus}
      useAI={useAI}
      onToggleAI={onToggleAI}
      onOpenAISettings={onOpenAISettings}
    />

    {/* Error Display */}
    {error && (
      <div className="bg-red-50 dark:bg-red-900/30 border-l-4 border-red-500 p-4 rounded-r-lg">
        <p className="text-red-700 dark:text-red-300">{error}</p>
      </div>
    )}

    {/* Start Button */}
    <button
      onClick={onStartInterview}
      disabled={
        !relationship || !condition || !witnessName || isLoadingQuestions
      }
      className="w-full px-6 py-4 bg-gradient-to-r from-violet-600 to-purple-600 text-white rounded-xl font-bold text-lg hover:from-violet-700 hover:to-purple-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
    >
      {isLoadingQuestions ? (
        <>
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
          <span>{t("witnessBench", "preparingInterview")}</span>
        </>
      ) : (
        <>
          <span>📝</span>
          <span>{t("witnessBench", "startInterview")}</span>
        </>
      )}
    </button>
  </div>
);

const InterviewProgressBar = ({
  t,
  currentQuestionIndex,
  totalQuestions,
  answeredCount,
}) => {
  const progress = (currentQuestionIndex / totalQuestions) * 100;
  return (
    <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-gray-600 dark:text-gray-300">
          {t("witnessBench", "questionOf")
            .replace("{current}", currentQuestionIndex + 1)
            .replace("{total}", totalQuestions)}
        </span>
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {answeredCount} {t("witnessBench", "answered")}
        </span>
      </div>
      <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
        <div
          className="bg-gradient-to-r from-violet-600 to-purple-600 h-2 rounded-full transition-all duration-300"
          style={{ width: `${progress}%` }}
        ></div>
      </div>
    </div>
  );
};

const InterviewQuestionCard = ({
  t,
  currentQuestion,
  answer,
  onAnswerChange,
  onAdvanceOrGenerate,
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-6">
    <div className="flex items-start gap-3 mb-4">
      <span className="text-2xl">💬</span>
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        {currentQuestion.question}
      </h3>
    </div>

    <div className="relative">
      <textarea
        value={answer}
        onChange={(e) => onAnswerChange(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && e.ctrlKey) {
            e.preventDefault();
            onAdvanceOrGenerate();
          }
        }}
        placeholder={`${currentQuestion.placeholder}\n\n💡 Tip: Press Ctrl+Enter to advance, or use the microphone to speak your answer`}
        rows={6}
        className="w-full p-4 pr-14 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all resize-none"
      />
      {/* Voice Input Button */}
      <div className="absolute right-3 top-3">
        <VoiceInputButton
          onTranscript={(text) =>
            onAnswerChange(answer ? `${answer} ${text}` : text)
          }
          size="md"
        />
      </div>
    </div>

    <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
      🎤 <strong>{t("voice", "enableVoice").split(" ")[0]}:</strong>{" "}
      {t("witnessBench", "voiceInputTip")}
    </p>
  </div>
);

const InterviewNavButtons = ({
  t,
  currentQuestionIndex,
  totalQuestions,
  onPrevious,
  onNext,
  onGenerateStatement,
  answeredCount,
  isGeneratingStatement,
}) => (
  <div className="flex gap-3">
    <button
      onClick={onPrevious}
      disabled={currentQuestionIndex === 0}
      className="flex-1 px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {t("witnessBench", "previous")}
    </button>

    {currentQuestionIndex < totalQuestions - 1 ? (
      <button
        onClick={onNext}
        className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 transition-colors"
      >
        {t("witnessBench", "next")}
      </button>
    ) : (
      <button
        onClick={onGenerateStatement}
        disabled={answeredCount < 3 || isGeneratingStatement}
        className="flex-1 px-4 py-3 bg-gradient-to-r from-green-600 to-emerald-600 text-white rounded-xl font-bold hover:from-green-700 hover:to-emerald-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
      >
        {isGeneratingStatement ? (
          <>
            <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent"></div>
            <span>{t("witnessBench", "generating")}</span>
          </>
        ) : (
          <>
            <span>📄</span>
            <span>{t("witnessBench", "generateStatement")}</span>
          </>
        )}
      </button>
    )}
  </div>
);

const QuestionJumpNav = ({
  t,
  questions,
  answers,
  currentQuestionIndex,
  onJump,
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg p-4">
    <p className="text-sm font-medium text-gray-600 dark:text-gray-300 mb-3">
      {t("witnessBench", "jumpToQuestion")}
    </p>
    <div className="flex flex-wrap gap-2">
      {questions.map((q, index) => (
        <button
          key={q.id}
          onClick={() => onJump(index)}
          className={`w-8 h-8 rounded-full text-sm font-medium transition-all ${getQuestionNavButtonClass(index === currentQuestionIndex, answers[q.id])}`}
        >
          {index + 1}
        </button>
      ))}
    </div>
  </div>
);

const InterviewStep = ({
  t,
  questions,
  currentQuestionIndex,
  onSetCurrentQuestionIndex,
  answers,
  onUpdateAnswer,
  isGeneratingStatement,
  onGenerateStatement,
}) => {
  const currentQuestion = questions[currentQuestionIndex];
  const answeredCount = Object.values(answers).filter(
    (a) => a && a.trim(),
  ).length;

  const handleAnswerChange = (value) =>
    onUpdateAnswer(currentQuestion.id, value);

  const handleAdvanceOrGenerate = () => {
    if (currentQuestionIndex < questions.length - 1) {
      onSetCurrentQuestionIndex((prev) => prev + 1);
    } else if (answeredCount >= 3 && !isGeneratingStatement) {
      onGenerateStatement();
    }
  };

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <InterviewProgressBar
        t={t}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={questions.length}
        answeredCount={answeredCount}
      />

      <InterviewQuestionCard
        t={t}
        currentQuestion={currentQuestion}
        answer={answers[currentQuestion.id] || ""}
        onAnswerChange={handleAnswerChange}
        onAdvanceOrGenerate={handleAdvanceOrGenerate}
      />

      <InterviewNavButtons
        t={t}
        currentQuestionIndex={currentQuestionIndex}
        totalQuestions={questions.length}
        onPrevious={() =>
          onSetCurrentQuestionIndex((prev) => Math.max(0, prev - 1))
        }
        onNext={() => onSetCurrentQuestionIndex((prev) => prev + 1)}
        onGenerateStatement={onGenerateStatement}
        answeredCount={answeredCount}
        isGeneratingStatement={isGeneratingStatement}
      />

      <QuestionJumpNav
        t={t}
        questions={questions}
        answers={answers}
        currentQuestionIndex={currentQuestionIndex}
        onJump={onSetCurrentQuestionIndex}
      />
    </div>
  );
};

const OutputSuccessBanner = ({ t }) => (
  <div className="bg-gradient-to-r from-green-500 to-emerald-600 rounded-xl p-6 text-white shadow-lg">
    <div className="flex items-center gap-4">
      <div className="bg-white/20 rounded-full p-3">
        <span className="text-4xl">✅</span>
      </div>
      <div>
        <h3 className="text-2xl font-bold">
          {t("witnessBench", "statementGenerated")}
        </h3>
        <p className="text-green-100">
          {t("witnessBench", "reviewEditDownload")}
        </p>
      </div>
    </div>
  </div>
);

const DownloadMenu = ({
  t,
  showDownloadMenu,
  onToggle,
  onSaveToMyPacket,
  savedToPacket,
  onDownloadPDF,
  onDownloadDOCX,
  onCloseMenu,
}) => (
  <div className="relative">
    <button
      onClick={onToggle}
      className="px-3 py-1.5 text-sm bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
    >
      📥 {t("witnessBench", "download")}
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
            onSaveToMyPacket();
            onCloseMenu();
          }}
          className={`w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors rounded-t-lg ${
            savedToPacket
              ? "text-green-700 dark:text-green-400 bg-green-50 dark:bg-green-900/30"
              : "text-gray-700 dark:text-gray-200"
          }`}
        >
          {savedToPacket
            ? `✅ ${t("witnessBench", "savedToMyPacket")}`
            : `📁 ${t("witnessBench", "saveToMyPacket")}`}
        </button>
        <button
          onClick={() => {
            onDownloadPDF();
            onCloseMenu();
          }}
          className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 transition-colors"
        >
          📑 {t("witnessBench", "downloadAsPDF")}
        </button>
        <button
          onClick={() => {
            onDownloadDOCX();
            onCloseMenu();
          }}
          className="w-full px-4 py-2 text-left text-gray-700 dark:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-600 rounded-b-lg transition-colors"
        >
          📝 {t("witnessBench", "downloadAsDOCX")}
        </button>
      </div>
    )}
  </div>
);

const StatementPreviewPanel = ({
  t,
  generatedStatement,
  onGeneratedStatementChange,
  onCopyToClipboard,
  showDownloadMenu,
  onToggleDownloadMenu,
  onCloseDownloadMenu,
  onSaveToMyPacket,
  savedToPacket,
  onDownloadPDF,
  onDownloadDOCX,
}) => (
  <div className="bg-white dark:bg-gray-800 rounded-xl shadow-lg overflow-hidden">
    <div className="p-4 bg-gray-50 dark:bg-gray-700/50 border-b border-gray-200 dark:border-gray-600 flex items-center justify-between">
      <h3 className="text-lg font-bold text-gray-800 dark:text-gray-100">
        📄 {t("witnessBench", "yourBuddyStatement")}
      </h3>
      <div className="flex gap-2">
        <button
          onClick={onCopyToClipboard}
          className="px-3 py-1.5 text-sm bg-gray-200 dark:bg-gray-600 text-gray-700 dark:text-gray-200 rounded-lg hover:bg-gray-300 dark:hover:bg-gray-500 transition-colors"
        >
          📋 {t("witnessBench", "copy")}
        </button>
        <DownloadMenu
          t={t}
          showDownloadMenu={showDownloadMenu}
          onToggle={onToggleDownloadMenu}
          onSaveToMyPacket={onSaveToMyPacket}
          savedToPacket={savedToPacket}
          onDownloadPDF={onDownloadPDF}
          onDownloadDOCX={onDownloadDOCX}
          onCloseMenu={onCloseDownloadMenu}
        />
      </div>
    </div>

    <div className="p-6">
      <textarea
        value={generatedStatement}
        onChange={(e) => onGeneratedStatementChange(e.target.value)}
        rows={20}
        className="w-full p-4 border-2 border-gray-200 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-100 font-mono text-sm focus:border-purple-500 focus:ring-2 focus:ring-purple-200 dark:focus:ring-purple-900 outline-none transition-all resize-none"
      />
    </div>
  </div>
);

const NextStepsPanel = ({ t }) => (
  <div className="bg-amber-50 dark:bg-amber-900/30 border-l-4 border-amber-500 p-4 rounded-r-lg">
    <div className="flex items-start gap-3">
      <span className="text-2xl">📋</span>
      <div>
        <h3 className="font-bold text-amber-800 dark:text-amber-200">
          {t("witnessBench", "nextStepsTitle")}
        </h3>
        <ol className="text-amber-700 dark:text-amber-300 text-sm mt-2 list-decimal list-inside space-y-1">
          <li>{t("witnessBench", "nextStep1")}</li>
          <li>{t("witnessBench", "nextStep2")}</li>
          <li>{t("witnessBench", "nextStep3")}</li>
          <li>{t("witnessBench", "nextStep4")}</li>
        </ol>
      </div>
    </div>
  </div>
);

const OutputStep = ({
  t,
  generatedStatement,
  onGeneratedStatementChange,
  onCopyToClipboard,
  showDownloadMenu,
  onToggleDownloadMenu,
  onCloseDownloadMenu,
  onSaveToMyPacket,
  savedToPacket,
  onDownloadPDF,
  onDownloadDOCX,
  onStartOver,
}) => (
  <div className="max-w-3xl mx-auto space-y-6">
    <OutputSuccessBanner t={t} />

    <StatementPreviewPanel
      t={t}
      generatedStatement={generatedStatement}
      onGeneratedStatementChange={onGeneratedStatementChange}
      onCopyToClipboard={onCopyToClipboard}
      showDownloadMenu={showDownloadMenu}
      onToggleDownloadMenu={onToggleDownloadMenu}
      onCloseDownloadMenu={onCloseDownloadMenu}
      onSaveToMyPacket={onSaveToMyPacket}
      savedToPacket={savedToPacket}
      onDownloadPDF={onDownloadPDF}
      onDownloadDOCX={onDownloadDOCX}
    />

    <NextStepsPanel t={t} />

    {/* Start Over Button */}
    <button
      onClick={onStartOver}
      className="w-full px-4 py-3 bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-200 rounded-xl font-medium hover:bg-gray-300 dark:hover:bg-gray-600 transition-colors"
    >
      🔄 {t("witnessBench", "startNewStatement")}
    </button>
  </div>
);

const WitnessBenchStepContent = ({ t, wb, onOpenAISettings }) => {
  if (wb.wizard.step === 1) {
    return (
      <SetupStep
        t={t}
        relationship={wb.wizard.relationship}
        onSelectRelationship={wb.wizard.setRelationship}
        condition={wb.wizard.condition}
        onConditionChange={wb.wizard.setCondition}
        witnessName={wb.wizard.witnessName}
        onWitnessNameChange={wb.wizard.setWitnessName}
        aiAvailable={wb.ai.aiAvailable}
        aiStatus={wb.ai.aiStatus}
        useAI={wb.ai.useAI}
        onToggleAI={() => wb.ai.setUseAI(!wb.ai.useAI)}
        onOpenAISettings={onOpenAISettings}
        error={wb.ai.error}
        isLoadingQuestions={wb.ai.isLoadingQuestions}
        onStartInterview={wb.startInterview}
      />
    );
  }

  if (wb.wizard.step === 2) {
    return (
      <InterviewStep
        t={t}
        questions={wb.interview.questions}
        currentQuestionIndex={wb.interview.currentQuestionIndex}
        onSetCurrentQuestionIndex={wb.interview.setCurrentQuestionIndex}
        answers={wb.interview.answers}
        onUpdateAnswer={wb.interview.updateAnswer}
        isGeneratingStatement={wb.ai.isGeneratingStatement}
        onGenerateStatement={wb.generateStatement}
      />
    );
  }

  if (wb.wizard.step === 3) {
    return (
      <OutputStep
        t={t}
        generatedStatement={wb.output.generatedStatement}
        onGeneratedStatementChange={wb.output.setGeneratedStatement}
        onCopyToClipboard={() =>
          copyWitnessStatement(wb.output.generatedStatement, t)
        }
        showDownloadMenu={wb.output.showDownloadMenu}
        onToggleDownloadMenu={() =>
          wb.output.setShowDownloadMenu(!wb.output.showDownloadMenu)
        }
        onCloseDownloadMenu={() => wb.output.setShowDownloadMenu(false)}
        onSaveToMyPacket={() =>
          saveWitnessStatementToPacket(
            {
              condition: wb.wizard.condition,
              relationship: wb.wizard.relationship,
              generatedStatement: wb.output.generatedStatement,
              witnessName: wb.wizard.witnessName,
            },
            wb.output.setSavedToPacket,
            t,
          )
        }
        savedToPacket={wb.output.savedToPacket}
        onDownloadPDF={() =>
          downloadWitnessPDF(wb.output.generatedStatement, wb.wizard.condition)
        }
        onDownloadDOCX={() =>
          downloadWitnessDOCX(wb.output.generatedStatement, wb.wizard.condition)
        }
        onStartOver={wb.startOver}
      />
    );
  }

  return null;
};

export default function WitnessBench({
  onClose,
  onReportBug,
  onOpenAISettings,
}) {
  const { t } = useLanguage();
  const witnessContentRef = useRef(null);
  const wb = useWitnessBench(t);

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="2xl"
      labelledBy="witness-bench-title"
      header={
        <WitnessBenchHeader
          t={t}
          onClose={onClose}
          onOpenAISettings={onOpenAISettings}
          onReportBug={onReportBug}
          contentRef={witnessContentRef}
        />
      }
    >
      <div ref={witnessContentRef}>
        {/* Main Content */}
        <div className="max-w-4xl mx-auto">
          <WitnessBenchIntro t={t} />

          {/* Step Content */}
          <WitnessBenchStepContent
            t={t}
            wb={wb}
            onOpenAISettings={onOpenAISettings}
          />
        </div>
      </div>
    </ResponsiveModal>
  );
}
