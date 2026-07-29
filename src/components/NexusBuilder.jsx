import { useState } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  HeadingLevel,
  AlignmentType,
} from "docx";
import jsPDF from "jspdf";
import ReportBugLink from "./ReportBugLink";
import BuyMeCoffee from "./BuyMeCoffee";
import AIConsentModal from "./AIConsentModal";
import DoctorsPacket from "./DoctorsPacket";
import VoiceInputButton, { isSpeechRecognitionSupported } from "./VoiceInput";
import DraftWatermark from "./DraftWatermark";
import AIWarningBanner from "./AIWarningBanner";
import NexusDisclaimerFooter from "./NexusDisclaimerFooter";
import CertificationCheckbox from "./CertificationCheckbox";
import StatementAnalyzer from "./StatementAnalyzer";
import ResponsiveModal from "./common/ResponsiveModal";
import {
  isAIAvailable,
  enhancePersonalStatement,
  generateFieldSuggestion,
} from "../utils/aiStatementHelper";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import { isAnyAIAvailable } from "../utils/unifiedAIService";
import SmartAILoadButton from "./SmartAILoadButton";

const AGGRAVATION_OPTIONS = [
  {
    value: "stress",
    label: "Stress and anxiety from primary condition causes flare-ups",
  },
  {
    value: "medication",
    label: "Medication side effects from treating primary condition",
  },
  {
    value: "physical",
    label: "Physical limitations or compensatory behaviors",
  },
  { value: "sleep", label: "Sleep disruption from primary condition" },
  { value: "weight", label: "Weight gain or metabolic changes" },
  {
    value: "inflammation",
    label: "Chronic inflammation or immune dysfunction",
  },
  { value: "other", label: "Other (please explain below)" },
];

// Pure statement generator, split out of NexusBuilder purely to keep its
// function body under the line-count/complexity limits. Same logic, same
// order of operations, same text.
function generateStatement({
  answers,
  condition,
  primaryCondition,
  isSecondary,
}) {
  const currentDate = new Date().toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  let statement = `To the Department of Veterans Affairs:\n\n`;

  if (isSecondary) {
    statement += `I am submitting a claim for **${condition}** as secondary to my service-connected **${primaryCondition}**.\n\n`;
  } else {
    statement += `I am submitting a claim for service connection of **${condition}**.\n\n`;
  }

  statement += `**Onset and Progression:**\n`;
  statement += `I first noted symptoms of ${condition} around ${answers.symptomOnsetDate || new Date().toLocaleDateString()}. These symptoms have persisted and worsened over time. `;

  if (answers.hasTreatment === "yes-va") {
    statement += `I have sought treatment through the VA medical system for this condition.\n\n`;
  } else if (answers.hasTreatment === "yes-private") {
    statement += `I have sought treatment through private medical care for this condition.\n\n`;
  } else if (answers.hasTreatment === "no") {
    statement += `Due to the nature of my service-connected disabilities, I have not yet been able to seek formal treatment for this condition.\n\n`;
  }

  if (isSecondary) {
    statement += `**Nexus (Connection to Service):**\n`;
    const mechanismText =
      AGGRAVATION_OPTIONS.find(
        (opt) => opt.value === answers.aggravationMechanism,
      )?.label || answers.aggravationMechanism;
    statement += `My service-connected ${primaryCondition} directly causes or aggravates this condition through the following mechanism: ${mechanismText}. `;

    if (answers.aggravationExplanation) {
      statement += `${answers.aggravationExplanation} `;
    }

    if (answers.specificIncident) {
      statement += `\n\nSpecifically, ${answers.specificIncident}`;
    }
    statement += `\n\n`;
  }

  statement += `**Severity and Impact:**\n`;
  statement += `This condition significantly affects my daily life. `;

  if (answers.workImpact) {
    statement += `In terms of employment, ${answers.workImpact} `;
  }

  if (answers.socialImpact) {
    statement += `Regarding my social and family life, ${answers.socialImpact} `;
  }

  if (answers.specificExamples) {
    statement += `\n\nSpecific examples include: ${answers.specificExamples}`;
  }

  statement += `\n\n**Request:**\n`;
  statement += `I respectfully request a Compensation & Pension (C&P) examination to evaluate this condition and its connection to my service${isSecondary ? "-connected disability" : ""}.\n\n`;
  statement += `Respectfully submitted,\n\n`;
  statement += `Date: ${currentDate}`;

  return statement;
}

// Pure doctor-note generator, split out of NexusBuilder purely to keep its
// function body under the line-count/complexity limits. Same logic, same
// order of operations, same text.
function generateDoctorNote({
  answers,
  condition,
  primaryCondition,
  isSecondary,
}) {
  return `Dear Healthcare Provider,

I am filing a VA disability claim for ${condition}${isSecondary ? ` as secondary to my service-connected ${primaryCondition}` : ""}.

Could you please review my medical records and, if clinically accurate, document in my medical file the following statement:

"It is at least as likely as not (50% or greater probability) that the veteran's ${condition} is ${isSecondary ? "aggravated by or caused by" : "related to"} ${isSecondary ? `their service-connected ${primaryCondition}` : "their military service"}."

${isSecondary ? `\nSpecifically, the ${primaryCondition} appears to contribute to ${condition} through: ${answers.aggravationExplanation || "[mechanism to be discussed]"}.` : ""}

This clinical opinion is important for my VA claim evaluation. Thank you for your consideration.

Sincerely,
[Your Name]`;
}

// Pure txt-download helper, split out of NexusBuilder purely to keep its
// function body under the line-count/complexity limits.
function downloadAsTxt(statement, doctorNote, fileName) {
  const content =
    statement + "\n\n---\n\nDOCTOR'S CHEAT SHEET\n\n" + doctorNote;
  const blob = new Blob([content], { type: "text/plain" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${fileName}.txt`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// Pure docx-download helper, split out of NexusBuilder purely to keep its
// function body under the line-count/complexity limits.
async function downloadAsDocx(statement, doctorNote, fileName) {
  try {
    const doc = new Document({
      sections: [
        {
          properties: {},
          children: [
            new Paragraph({
              text: "STATEMENT IN SUPPORT OF CLAIM",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: `Condition: ${condition}`,
              spacing: { after: 200 },
            }),
            ...statement.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                  spacing: { after: 100 },
                }),
            ),
            new Paragraph({
              text: "",
              spacing: { after: 400 },
            }),
            new Paragraph({
              text: "DOCTOR'S CHEAT SHEET",
              heading: HeadingLevel.HEADING_1,
              alignment: AlignmentType.CENTER,
              spacing: { after: 400 },
            }),
            ...doctorNote.split("\n").map(
              (line) =>
                new Paragraph({
                  children: [new TextRun(line)],
                  spacing: { after: 100 },
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
    a.download = `${fileName}.docx`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (error) {
    console.error("Error generating DOCX:", error);
    alert("Error generating Word document. Please try another format.");
  }
}

// Pure pdf-download helper, split out of NexusBuilder purely to keep its
// function body under the line-count/complexity limits.
function downloadAsPdf(statement, doctorNote, fileName) {
  try {
    const pdf = new jsPDF();
    const pageWidth = pdf.internal.pageSize.getWidth();
    const margin = 15;
    const maxWidth = pageWidth - margin * 2;
    let yPosition = 20;

    // Title
    pdf.setFontSize(16);
    pdf.setFont(undefined, "bold");
    pdf.text("STATEMENT IN SUPPORT OF CLAIM", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 15;

    // Condition
    pdf.setFontSize(11);
    pdf.text(`Condition: ${condition}`, margin, yPosition);
    yPosition += 10;

    // Statement content
    pdf.setFont(undefined, "normal");
    pdf.setFontSize(10);
    const statementLines = pdf.splitTextToSize(statement, maxWidth);
    statementLines.forEach((line) => {
      if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    // Doctor's note section
    yPosition += 10;
    if (yPosition > pdf.internal.pageSize.getHeight() - 40) {
      pdf.addPage();
      yPosition = 20;
    }

    pdf.setFontSize(14);
    pdf.setFont(undefined, "bold");
    pdf.text("DOCTOR'S CHEAT SHEET", pageWidth / 2, yPosition, {
      align: "center",
    });
    yPosition += 10;

    pdf.setFont(undefined, "normal");
    pdf.setFontSize(10);
    const doctorLines = pdf.splitTextToSize(doctorNote, maxWidth);
    doctorLines.forEach((line) => {
      if (yPosition > pdf.internal.pageSize.getHeight() - 20) {
        pdf.addPage();
        yPosition = 20;
      }
      pdf.text(line, margin, yPosition);
      yPosition += 5;
    });

    pdf.save(`${fileName}.pdf`);
  } catch (error) {
    console.error("Error generating PDF:", error);
    alert("Error generating PDF. Please try another format.");
  }
}

// Reusable "AI Help" trigger button (with loading spinner), split out of the
// per-field JSX blocks purely to keep the enclosing function bodies under
// the line-count/complexity limits. Same markup, same behavior.
const AIHelpButton = ({ fieldName, fieldHelping, onClick, t }) => (
  <button
    type="button"
    onClick={onClick}
    disabled={fieldHelping === fieldName}
    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-gradient-to-r from-purple-500 to-indigo-500 text-white rounded-full hover:from-purple-600 hover:to-indigo-600 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-sm"
  >
    {fieldHelping === fieldName ? (
      <>
        <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
          <circle
            className="opacity-25"
            cx="12"
            cy="12"
            r="10"
            stroke="currentColor"
            strokeWidth="4"
          />
          <path
            className="opacity-75"
            fill="currentColor"
            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
          />
        </svg>{" "}
        {t("nexusBuilder.writing")}
      </>
    ) : (
      <>
        <span>✨</span> {t("nexusBuilder.aiHelp")}
      </>
    )}
  </button>
);

// Reusable "textarea with AI help + voice input + tone analysis" field,
// split out of the wizard steps purely to keep their function bodies under
// the line-count/complexity limits. Same markup, same behavior, same order
// of operations as the original per-field blocks.
const NexusTextareaField = ({
  label,
  fieldName,
  value,
  placeholder,
  updateAnswer,
  fieldHelping,
  handleFieldHelp,
  onKeyDown,
  t,
}) => (
  <div>
    <div className="flex items-center justify-between mb-2">
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
        {label}
      </label>
      {isAIAvailable() && (
        <AIHelpButton
          fieldName={fieldName}
          fieldHelping={fieldHelping}
          onClick={() => handleFieldHelp(fieldName)}
          t={t}
        />
      )}
    </div>
    <div className="relative">
      <textarea
        className="w-full h-32 px-4 py-3 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none dark:bg-gray-700 dark:text-gray-100"
        placeholder={placeholder}
        value={value}
        onChange={(e) => updateAnswer(fieldName, e.target.value)}
        {...(onKeyDown ? { onKeyDown } : {})}
      />
      {isSpeechRecognitionSupported() && (
        <div
          className="absolute right-2 top-2"
          aria-label="Click to dictate using voice"
        >
          <VoiceInputButton
            onTranscript={(text) =>
              updateAnswer(fieldName, value ? `${value} ${text}` : text)
            }
            size="sm"
          />
        </div>
      )}
    </div>
    {/* The Diplomat - Tone Analysis */}
    {value && (
      <div className="mt-3">
        <StatementAnalyzer
          text={value}
          onApplySuggestion={(original, rewrite) =>
            updateAnswer(fieldName, value.replace(original, rewrite))
          }
        />
      </div>
    )}
  </div>
);

// Step 1: Timeline. Split out of NexusBuilder purely to keep its function
// body under the line-count/complexity limits. Same markup, same behavior.
const NexusStepTimeline = ({ answers, updateAnswer, condition, t }) => (
  <div className="space-y-6">
    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      {t("nexusBuilder.timelineInfo")}
    </h3>

    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t("nexusBuilder.whenFirstNotice", { condition })}
      </label>
      <input
        type="text"
        placeholder={t("nexusBuilder.onsetPlaceholder")}
        className="w-full px-4 py-3 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent dark:bg-gray-700 dark:text-gray-100"
        value={answers.symptomOnsetDate}
        onChange={(e) => updateAnswer("symptomOnsetDate", e.target.value)}
      />
      <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
        {t("nexusBuilder.approximateDates")}
      </p>
    </div>

    <div>
      <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
        {t("nexusBuilder.soughtTreatment")}
      </label>
      <div className="space-y-2">
        {[
          { value: "yes-va", label: t("nexusBuilder.yesVA") },
          {
            value: "yes-private",
            label: t("nexusBuilder.yesPrivate"),
          },
          { value: "both", label: t("nexusBuilder.yesBoth") },
          { value: "no", label: t("nexusBuilder.noTreatment") },
        ].map((option) => (
          <label
            key={option.value}
            className="flex items-center p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
          >
            <input
              type="radio"
              name="treatment"
              value={option.value}
              checked={answers.hasTreatment === option.value}
              onChange={(e) => updateAnswer("hasTreatment", e.target.value)}
              className="mr-3 h-4 w-4 text-green-600"
            />
            <span className="text-sm text-gray-800 dark:text-gray-200">
              {option.label}
            </span>
          </label>
        ))}
      </div>
    </div>
  </div>
);

// Aggravation-mechanism radio list, split out of NexusStepBridge purely to
// keep its function body under the line-count limit. Same markup, same
// behavior.
const NexusMechanismList = ({
  answers,
  updateAnswer,
  condition,
  primaryCondition,
  t,
}) => (
  <div>
    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
      {t("nexusBuilder.howCausesAggravates", {
        primary: primaryCondition,
        condition,
      })}
    </label>
    <div className="space-y-2 max-h-80 overflow-y-auto">
      {AGGRAVATION_OPTIONS.map((option) => (
        <label
          key={option.value}
          className="flex items-start p-3 border dark:border-gray-600 rounded-lg cursor-pointer hover:bg-gray-50 dark:hover:bg-gray-700"
        >
          <input
            type="radio"
            name="mechanism"
            value={option.value}
            checked={answers.aggravationMechanism === option.value}
            onChange={(e) =>
              updateAnswer("aggravationMechanism", e.target.value)
            }
            className="mt-1 mr-3 h-4 w-4 text-green-600"
          />
          <span className="text-sm text-gray-800 dark:text-gray-200">
            {option.label}
          </span>
        </label>
      ))}
    </div>
  </div>
);

// Step 2: Bridge (secondary claims only). Split out of NexusBuilder purely
// to keep its function body under the line-count/complexity limits. Same
// markup, same behavior.
const NexusStepBridge = ({
  answers,
  updateAnswer,
  condition,
  primaryCondition,
  fieldHelping,
  handleFieldHelp,
  t,
}) => (
  <div className="space-y-6">
    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      {t("nexusBuilder.connectionTitle")}
    </h3>

    <NexusMechanismList
      answers={answers}
      updateAnswer={updateAnswer}
      condition={condition}
      primaryCondition={primaryCondition}
      t={t}
    />

    <NexusTextareaField
      label={t("nexusBuilder.explainInOwnWords", {
        primary: primaryCondition,
        condition,
      })}
      fieldName="aggravationExplanation"
      value={answers.aggravationExplanation}
      placeholder="Example: My PTSD causes severe anxiety and hypervigilance, which prevents me from falling asleep and staying asleep. The constant state of alertness disrupts my breathing patterns during sleep... (Ctrl+Enter to next field, Shift+Enter for new line)"
      updateAnswer={updateAnswer}
      fieldHelping={fieldHelping}
      handleFieldHelp={handleFieldHelp}
      t={t}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          const nextField = document.querySelector(
            'textarea[placeholder*="Last month, I had a PTSD episode"]',
          );
          if (nextField) nextField.focus();
        }
      }}
    />

    <NexusTextareaField
      label={t("nexusBuilder.describeIncident")}
      fieldName="specificIncident"
      value={answers.specificIncident}
      placeholder="Example: Last month, I had a PTSD episode triggered by fireworks. That night, my sleep apnea symptoms worsened significantly - I woke up gasping for air multiple times, which my partner witnessed... (Ctrl+Enter to continue, Shift+Enter for new line)"
      updateAnswer={updateAnswer}
      fieldHelping={fieldHelping}
      handleFieldHelp={handleFieldHelp}
      t={t}
      onKeyDown={(e) => {
        if (e.key === "Enter" && e.ctrlKey) {
          e.preventDefault();
          const generateBtn = document.querySelector(
            'button[class*="bg-gradient-to-r from-green-600"]',
          );
          if (generateBtn && !generateBtn.disabled) generateBtn.click();
        }
      }}
    />
  </div>
);

// Step 3 (or 2 for primary claims): Severity and daily impact. Split out of
// NexusBuilder purely to keep its function body under the
// line-count/complexity limits. Same markup, same behavior.
const NexusStepSeverity = ({
  answers,
  updateAnswer,
  condition,
  fieldHelping,
  handleFieldHelp,
  t,
}) => (
  <div className="space-y-6">
    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100 mb-4">
      {t("nexusBuilder.severityTitle")}
    </h3>

    <NexusTextareaField
      label={t("nexusBuilder.howAffectsWork", { condition })}
      fieldName="workImpact"
      value={answers.workImpact}
      placeholder="Example: I have difficulty concentrating due to fatigue from poor sleep. I've missed 15+ days of work in the past year. My supervisor has documented performance issues related to exhaustion..."
      updateAnswer={updateAnswer}
      fieldHelping={fieldHelping}
      handleFieldHelp={handleFieldHelp}
      t={t}
    />

    <NexusTextareaField
      label={t("nexusBuilder.howAffectsSocial", { condition })}
      fieldName="socialImpact"
      value={answers.socialImpact}
      placeholder="Example: I avoid social gatherings because I'm exhausted. My spouse says I'm irritable and moody due to poor sleep. I've had to stop participating in activities I used to enjoy..."
      updateAnswer={updateAnswer}
      fieldHelping={fieldHelping}
      handleFieldHelp={handleFieldHelp}
      t={t}
    />

    <NexusTextareaField
      label={t("nexusBuilder.specificExamples")}
      fieldName="specificExamples"
      value={answers.specificExamples}
      placeholder="Example: I can no longer drive long distances safely due to fatigue. I need to take frequent breaks during simple tasks. My memory and focus have noticeably declined..."
      updateAnswer={updateAnswer}
      fieldHelping={fieldHelping}
      handleFieldHelp={handleFieldHelp}
      t={t}
    />
  </div>
);

// Header title/close bar, split out of NexusHeader purely to keep its
// function body under the line-count limit. Same markup, same behavior.
const NexusHeaderBar = ({
  existingStatement,
  condition,
  isSecondary,
  primaryCondition,
  onReportBug,
  onOpenAISettings,
  onClose,
  t,
}) => (
  <div className="bg-gradient-to-r from-violet-600 via-purple-600 to-violet-600 text-white px-4 sm:px-6 py-4 sm:py-6 flex-shrink-0">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex-1 min-w-0 pr-10 sm:pr-0">
        <h2
          id="nexus-builder-title"
          className="text-xl sm:text-3xl font-bold mb-1 sm:mb-2 truncate"
        >
          {existingStatement
            ? t("nexusBuilder.editStatement")
            : `📝 ${t("nexusBuilder.title")}`}{" "}
          <span className="px-1.5 py-0.5 bg-amber-700 text-white text-[10px] font-bold rounded align-middle">
            {t("nexusBuilder.beta")}
          </span>
        </h2>
        <p className="text-violet-100 text-sm sm:text-base">
          {existingStatement
            ? t("nexusBuilder.updatingFor")
            : t("nexusBuilder.statementFor")}{" "}
          <strong className="block sm:inline truncate">{condition}</strong>
          {isSecondary && (
            <span className="block sm:inline text-xs sm:text-sm">
              {" "}
              ({t("nexusBuilder.secondaryTo")} {primaryCondition})
            </span>
          )}
        </p>
      </div>
      <div className="absolute top-3 right-3 sm:relative sm:top-auto sm:right-auto flex items-center gap-2 sm:gap-3">
        <LLMRecommendationBadge toolId="nexus-builder" />
        <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
        {onReportBug && (
          <ReportBugLink
            onClick={onReportBug}
            variant="light"
            moduleName="Nexus Builder"
          />
        )}
        <button
          onClick={onClose}
          className="p-1 text-white hover:bg-white/20 rounded-lg transition-colors"
          aria-label={t("nexusBuilder.close")}
        >
          <svg
            className="w-6 h-6 sm:w-8 sm:h-8"
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

// Progress bar / AI-tip section under the header bar, split out of
// NexusHeader purely to keep its function body under the line-count limit.
// Same markup, same behavior.
const NexusHeaderProgress = ({ existingStatement, step, totalSteps, t }) => (
  <div className="px-6 py-4 bg-gray-50 dark:bg-gray-900 border-b dark:border-gray-700 flex-shrink-0">
    {existingStatement && (
      <div className="mb-4 px-4 py-3 bg-blue-50 dark:bg-blue-900/30 border border-blue-200 dark:border-blue-700 rounded-lg flex items-center gap-2">
        <svg
          className="w-5 h-5 text-blue-600 dark:text-blue-400"
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
        <span className="text-sm text-blue-800 dark:text-blue-100">
          <strong>{t("nexusBuilder.editingMode")}</strong>{" "}
          {t("nexusBuilder.editingModeDesc")}
        </span>
      </div>
    )}
    {/* Smart AI Loader - One Click, Perfect Model */}
    {!isAnyAIAvailable() && (
      <div className="mb-4">
        <SmartAILoadButton
          toolId="nexus-builder"
          onLoadComplete={(model) => {
            // eslint-disable-next-line no-console
            console.log("Smart AI loaded for Nexus Builder:", model?.name);
          }}
        />
      </div>
    )}

    {!existingStatement && isAnyAIAvailable() && (
      <div className="mb-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-300 dark:border-blue-700 rounded-lg p-3">
        <div className="flex items-center gap-2 text-sm text-blue-800 dark:text-blue-200">
          <span>💡</span>
          <span>
            <strong>{t("nexusBuilder.aiTip")}</strong>{" "}
            {t("nexusBuilder.aiTipText")}
          </span>
        </div>
      </div>
    )}
    <div className="flex items-center justify-between mb-2">
      <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
        {t("nexusBuilder.stepOf", { current: step, total: totalSteps })}
      </span>
      <span className="text-sm text-gray-600 dark:text-gray-400">
        {Math.round((step / totalSteps) * 100)}% {t("nexusBuilder.complete")}
      </span>
    </div>
    <div className="w-full bg-gray-200 dark:bg-gray-700 rounded-full h-2">
      <div
        className="bg-green-600 h-2 rounded-full transition-all duration-300"
        style={{ width: `${(step / totalSteps) * 100}%` }}
      ></div>
    </div>
  </div>
);

// Modal header (title bar + progress), split out of NexusBuilder purely to
// keep its function body under the line-count/complexity limits. Same
// markup, same behavior.
const NexusHeader = ({
  existingStatement,
  condition,
  isSecondary,
  primaryCondition,
  onReportBug,
  onOpenAISettings,
  onClose,
  step,
  totalSteps,
  t,
}) => (
  <>
    <NexusHeaderBar
      existingStatement={existingStatement}
      condition={condition}
      isSecondary={isSecondary}
      primaryCondition={primaryCondition}
      onReportBug={onReportBug}
      onOpenAISettings={onOpenAISettings}
      onClose={onClose}
      t={t}
    />
    <NexusHeaderProgress
      existingStatement={existingStatement}
      step={step}
      totalSteps={totalSteps}
      t={t}
    />
  </>
);

// Review-step "AI mode badge + enhance button" cluster. Split out of
// NexusReviewControls purely to keep its function body under the
// line-count limit. Same markup, same behavior.
const NexusReviewEnhanceButton = ({
  aiEnhancedStatement,
  isEnhancing,
  handleRequestAIEnhance,
  t,
}) => (
  <div className="flex items-center gap-2 flex-wrap">
    {isAIAvailable() && <AIStatusBadge showLabel={true} className="text-xs" />}

    {isAIAvailable() && !aiEnhancedStatement && !isEnhancing && (
      <button
        onClick={handleRequestAIEnhance}
        className="inline-flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-700 hover:to-indigo-700 transition-all shadow-md hover:shadow-lg text-sm"
      >
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
            d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
          />
        </svg>
        ✨ {t("nexusBuilder.enhanceWithAI")}
      </button>
    )}
  </div>
);

// Review-step "enhancing spinner + standard/AI-version toggle" cluster.
// Split out of NexusReviewControls purely to keep its function body under
// the line-count limit. Same markup, same behavior.
const NexusReviewVersionToggle = ({
  aiEnhancedStatement,
  isEnhancing,
  useAIVersion,
  toggleStatementVersion,
  t,
}) => (
  <>
    {/* Loading state */}
    {isEnhancing && (
      <div className="inline-flex items-center gap-2 px-4 py-2 bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 rounded-lg font-semibold text-sm">
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
        {t("nexusBuilder.aiIsWriting")}
      </div>
    )}

    {/* Toggle between versions */}
    {aiEnhancedStatement && !isEnhancing && (
      <div className="flex items-center gap-2">
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t("nexusBuilder.versionLabel")}
        </span>
        <button
          onClick={toggleStatementVersion}
          className={`px-3 py-1 rounded-l-lg text-sm font-medium transition-colors ${
            !useAIVersion
              ? "bg-gray-700 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          {t("nexusBuilder.standardVersion")}
        </button>
        <button
          onClick={toggleStatementVersion}
          className={`px-3 py-1 rounded-r-lg text-sm font-medium transition-colors flex items-center gap-1 ${
            useAIVersion
              ? "bg-gradient-to-r from-purple-600 to-indigo-600 text-white"
              : "bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-400 hover:bg-gray-300 dark:hover:bg-gray-600"
          }`}
        >
          ✨ {t("nexusBuilder.aiEnhanced")}
        </button>
      </div>
    )}
  </>
);

// Review-step title bar: AI mode badge, enhance button, loading state, and
// standard/AI-version toggle. Split out of NexusStepReview purely to keep
// its function body under the line-count/complexity limits. Same markup,
// same behavior.
const NexusReviewControls = ({
  aiEnhancedStatement,
  isEnhancing,
  useAIVersion,
  handleRequestAIEnhance,
  toggleStatementVersion,
  t,
}) => (
  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
    <h3 className="text-xl font-bold text-gray-900 dark:text-gray-100">
      {t("nexusBuilder.reviewTitle")}
    </h3>

    {/* AI Mode Display and Enhancement Button */}
    <NexusReviewEnhanceButton
      aiEnhancedStatement={aiEnhancedStatement}
      isEnhancing={isEnhancing}
      handleRequestAIEnhance={handleRequestAIEnhance}
      t={t}
    />

    <NexusReviewVersionToggle
      aiEnhancedStatement={aiEnhancedStatement}
      isEnhancing={isEnhancing}
      useAIVersion={useAIVersion}
      toggleStatementVersion={toggleStatementVersion}
      t={t}
    />
  </div>
);

// Review-step AI error/success banners. Split out of NexusStepReview purely
// to keep its function body under the line-count/complexity limits. Same
// markup, same behavior.
const NexusReviewBanners = ({
  aiError,
  useAIVersion,
  aiEnhancedStatement,
  handleRequestAIEnhance,
  t,
}) => (
  <>
    {/* AI Error message */}
    {aiError && (
      <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
        <svg
          className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
          />
        </svg>
        <div>
          <p className="text-sm text-red-700 dark:text-red-300">{aiError}</p>
          <button
            onClick={handleRequestAIEnhance}
            className="text-sm text-red-600 dark:text-red-400 underline mt-1 hover:text-red-800 dark:hover:text-red-200"
          >
            {t("nexusBuilder.tryAgain")}
          </button>
        </div>
      </div>
    )}

    {/* AI Success indicator */}
    {useAIVersion && aiEnhancedStatement && (
      <div className="bg-purple-50 dark:bg-purple-900/20 border border-purple-200 dark:border-purple-800 rounded-lg p-3 flex items-center gap-2">
        <svg
          className="w-5 h-5 text-purple-500"
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
        <span className="text-sm text-purple-700 dark:text-purple-300">
          ✨ {t("nexusBuilder.aiPoweredBy")}
        </span>
      </div>
    )}

    {/* AI Warning Banner */}
    {useAIVersion && aiEnhancedStatement && <AIWarningBanner />}
  </>
);

// Review-step statement display + doctor's cheat sheet. Split out of
// NexusStepReview purely to keep its function body under the
// line-count/complexity limits. Same markup, same behavior.
const NexusStatementPanels = ({
  useAIVersion,
  aiEnhancedStatement,
  currentStatement,
  currentDoctorNote,
  t,
}) => (
  <>
    {/* Draft Watermark and Statement Display */}
    <div className="bg-gray-50 dark:bg-gray-900 border-2 border-gray-200 dark:border-gray-700 rounded-lg p-6">
      <DraftWatermark variant="banner" />
      <div className="flex items-center justify-between mb-3">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100">
          {t("nexusBuilder.statementFormTitle")}
        </h4>
        {useAIVersion && aiEnhancedStatement && (
          <span className="text-xs bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 px-2 py-1 rounded-full">
            ✨ {t("nexusBuilder.aiEnhanced")}
          </span>
        )}
      </div>
      <div className="prose prose-sm max-w-none">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
          {currentStatement}
        </pre>
      </div>
    </div>

    {/* Doctor's Cheat Sheet with Medical Disclaimer */}
    <div className="bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-200 dark:border-blue-700 rounded-lg p-6">
      <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-3">
        {t("nexusBuilder.doctorsCheatSheet")}
      </h4>
      <p className="text-xs text-gray-600 dark:text-gray-400 mb-3">
        {t("nexusBuilder.doctorsCheatSheetDesc")}
      </p>
      <div className="prose prose-sm max-w-none">
        <pre className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200 font-sans">
          {currentDoctorNote}
        </pre>
      </div>

      {/* Medical Disclaimer Footer */}
      <NexusDisclaimerFooter className="mt-4" />
    </div>
  </>
);

// Doctor's Packet prompt for secondary claims. Split out of NexusStepReview
// purely to keep its function body under the line-count/complexity limits.
// Same markup, same behavior.
const NexusDoctorsPacketPrompt = ({
  primaryCondition,
  condition,
  setShowDoctorsPacket,
  t,
}) => (
  <div className="bg-gradient-to-br from-purple-50 to-indigo-50 dark:from-purple-900/30 dark:to-indigo-900/30 border-2 border-purple-200 dark:border-purple-700 rounded-lg p-6">
    <div className="flex items-start gap-4">
      <div className="p-3 bg-purple-100 dark:bg-purple-900/50 rounded-lg">
        <svg
          className="w-6 h-6 text-purple-600 dark:text-purple-400"
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
      </div>
      <div className="flex-1">
        <h4 className="font-semibold text-gray-900 dark:text-gray-100 mb-2">
          {t("nexusBuilder.doctorsPacketTitle")}
        </h4>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          {t("nexusBuilder.doctorsPacketDesc", {
            primary: primaryCondition,
            secondary: condition,
          })}
        </p>
        <button
          onClick={() => setShowDoctorsPacket(true)}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-gradient-to-r from-purple-600 to-indigo-600 text-white rounded-lg font-semibold hover:from-purple-500 hover:to-indigo-500 transition-all shadow-md hover:shadow-lg"
        >
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
              d="M5 3v4M3 5h4M6 17v4m-2-2h4m5-16l2.286 6.857L21 12l-5.714 2.143L13 21l-2.286-6.857L5 12l5.714-2.143L13 3z"
            />
          </svg>
          {t("nexusBuilder.generateDoctorsPacket")}
        </button>
      </div>
    </div>
  </div>
);

// Final step: Review and download. Split out of NexusBuilder purely to keep
// its function body under the line-count/complexity limits. Same markup,
// same behavior.
const NexusStepReview = ({
  aiEnhancedStatement,
  isEnhancing,
  useAIVersion,
  handleRequestAIEnhance,
  toggleStatementVersion,
  aiError,
  currentStatement,
  currentDoctorNote,
  isSecondary,
  primaryCondition,
  condition,
  setShowDoctorsPacket,
  t,
}) => (
  <div className="space-y-6">
    <NexusReviewControls
      aiEnhancedStatement={aiEnhancedStatement}
      isEnhancing={isEnhancing}
      useAIVersion={useAIVersion}
      handleRequestAIEnhance={handleRequestAIEnhance}
      toggleStatementVersion={toggleStatementVersion}
      t={t}
    />

    <NexusReviewBanners
      aiError={aiError}
      useAIVersion={useAIVersion}
      aiEnhancedStatement={aiEnhancedStatement}
      handleRequestAIEnhance={handleRequestAIEnhance}
      t={t}
    />

    <NexusStatementPanels
      useAIVersion={useAIVersion}
      aiEnhancedStatement={aiEnhancedStatement}
      currentStatement={currentStatement}
      currentDoctorNote={currentDoctorNote}
      t={t}
    />

    {/* Doctor's Packet - AI Research Brief for Secondary Claims */}
    {isSecondary && (
      <NexusDoctorsPacketPrompt
        primaryCondition={primaryCondition}
        condition={condition}
        setShowDoctorsPacket={setShowDoctorsPacket}
        t={t}
      />
    )}
  </div>
);

// Owns the wizard step/answers state and the handlers that touch it. Split
// out of NexusBuilder purely to keep its function body under the
// line-count/complexity limits. Same logic, same order of operations.
function useNexusAnswers(existingStatement, totalSteps) {
  const [step, setStep] = useState(1);
  const [answers, setAnswers] = useState(
    existingStatement?.answers || {
      // Timeline
      symptomOnsetDate: "",
      hasTreatment: "",
      treatmentType: "",

      // Bridge (for secondary claims)
      aggravationMechanism: "",
      aggravationExplanation: "",
      specificIncident: "",

      // Severity
      workImpact: "",
      socialImpact: "",
      specificExamples: "",
    },
  );

  const updateAnswer = (field, value) => {
    setAnswers((prev) => ({ ...prev, [field]: value }));
  };

  const handleNext = () => {
    setStep((prev) => Math.min(prev + 1, totalSteps));
  };

  const handleBack = () => {
    setStep((prev) => Math.max(prev - 1, 1));
  };

  return { step, answers, updateAnswer, handleNext, handleBack };
}

// Builds the AI-consent handler for useNexusAIEnhancement. Split out purely
// to keep that hook's function body under the line-count limit. Same logic,
// same order of operations.
function createAIConsentHandler({
  answers,
  condition,
  primaryCondition,
  setShowAIConsent,
  setIsEnhancing,
  setAiError,
  setAiEnhancedStatement,
  setUseAIVersion,
}) {
  return async () => {
    setShowAIConsent(false);
    setIsEnhancing(true);
    setAiError(null);

    try {
      const result = await enhancePersonalStatement(
        answers,
        condition,
        primaryCondition,
      );

      if (result.success) {
        setAiEnhancedStatement(
          result.content.replace(/\[Date\]/g, new Date().toLocaleDateString()),
        );
        setUseAIVersion(true);
      } else {
        setAiError(result.error);
      }
    } catch (error) {
      console.error("AI enhancement error:", error);
      setAiError(
        "An unexpected error occurred. Please try again or use the standard template.",
      );
    } finally {
      setIsEnhancing(false);
    }
  };
}

// Builds the inline field-help handler for useNexusAIEnhancement. Split out
// purely to keep that hook's function body under the line-count limit. Same
// logic, same order of operations.
function createFieldHelpHandler({
  condition,
  primaryCondition,
  answers,
  updateAnswer,
  setFieldHelping,
  setAiError,
}) {
  return async (fieldName) => {
    if (!isAIAvailable()) {
      setAiError(
        "No API key configured. Load the Warrant Council AI or add your API key in Settings to use AI assistance.",
      );
      return;
    }

    setFieldHelping(fieldName);
    setAiError(null);

    try {
      const result = await generateFieldSuggestion(
        fieldName,
        condition,
        primaryCondition,
        answers[fieldName] || "",
      );

      if (result.success) {
        updateAnswer(fieldName, result.content);
      } else {
        setAiError(result.error);
      }
    } catch (error) {
      console.error("Field help error:", error);
      setAiError("Failed to generate suggestion. Please try again.");
    } finally {
      setFieldHelping(null);
    }
  };
}

// Owns the AI-enhancement/field-help state and the handlers that touch it.
// Split out of NexusBuilder purely to keep its function body under the
// line-count/complexity limits. Same logic, same order of operations.
function useNexusAIEnhancement({
  answers,
  condition,
  primaryCondition,
  updateAnswer,
}) {
  const [showAIConsent, setShowAIConsent] = useState(false);
  const [aiEnhancedStatement, setAiEnhancedStatement] = useState(null);
  const [isEnhancing, setIsEnhancing] = useState(false);
  const [aiError, setAiError] = useState(null);
  const [useAIVersion, setUseAIVersion] = useState(false);
  const [fieldHelping, setFieldHelping] = useState(null);

  const handleRequestAIEnhance = () => {
    setShowAIConsent(true);
  };

  const handleAIConsent = createAIConsentHandler({
    answers,
    condition,
    primaryCondition,
    setShowAIConsent,
    setIsEnhancing,
    setAiError,
    setAiEnhancedStatement,
    setUseAIVersion,
  });

  const handleAICancel = () => {
    setShowAIConsent(false);
  };

  const toggleStatementVersion = () => {
    setUseAIVersion(!useAIVersion);
  };

  const handleFieldHelp = createFieldHelpHandler({
    condition,
    primaryCondition,
    answers,
    updateAnswer,
    setFieldHelping,
    setAiError,
  });

  return {
    showAIConsent,
    aiEnhancedStatement,
    isEnhancing,
    aiError,
    useAIVersion,
    fieldHelping,
    handleRequestAIEnhance,
    handleAIConsent,
    handleAICancel,
    toggleStatementVersion,
    handleFieldHelp,
  };
}

// Download-format dropdown (txt/docx/pdf), split out of NexusFinishControls
// purely to keep its function body under the line-count limit. Same markup,
// same behavior.
const NexusDownloadFormatMenu = ({ handleDownload, t }) => (
  <div className="absolute bottom-full mb-1 left-0 bg-white dark:bg-gray-800 border-2 border-gray-200 dark:border-gray-700 rounded-lg shadow-lg z-10 min-w-[180px]">
    <button
      onClick={() => handleDownload("txt")}
      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2 rounded-t-lg"
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
          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
        />
      </svg>
      {t("nexusBuilder.textFormat")}
    </button>
    <button
      onClick={() => handleDownload("docx")}
      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 flex items-center gap-2"
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
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      {t("nexusBuilder.wordFormat")}
    </button>
    <button
      onClick={() => handleDownload("pdf")}
      className="w-full px-4 py-2 text-left hover:bg-gray-100 dark:hover:bg-gray-700 text-sm font-medium text-gray-700 dark:text-gray-200 rounded-b-lg flex items-center gap-2"
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
          d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
        />
      </svg>
      {t("nexusBuilder.pdfFormat")}
    </button>
  </div>
);

// Final-step controls: certification checkbox, download-menu trigger, and
// save-to-packet button. Split out of NexusNavigationButtons purely to keep
// its function body under the line-count limit. Same markup, same behavior.
const NexusFinishControls = ({
  isCertified,
  setIsCertified,
  showDownloadMenu,
  setShowDownloadMenu,
  handleDownload,
  handleFinish,
  t,
}) => (
  <>
    {/* Certification Checkbox */}
    <div className="w-full sm:w-auto mb-3 sm:mb-0">
      <CertificationCheckbox checked={isCertified} onChange={setIsCertified} />
    </div>

    <div className="relative">
      <button
        onClick={() => setShowDownloadMenu(!showDownloadMenu)}
        disabled={!isCertified}
        aria-label={!isCertified ? t("nexusBuilder.certifyBeforeDownload") : ""}
        className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 border-2 border-green-600 text-green-600 dark:text-green-400 dark:border-green-500 rounded-lg font-semibold hover:bg-green-50 dark:hover:bg-green-900/30 transition-colors flex items-center justify-center gap-2 text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:bg-transparent"
      >
        {t("nexusBuilder.downloadStatement")}
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

      {showDownloadMenu && isCertified && (
        <NexusDownloadFormatMenu handleDownload={handleDownload} t={t} />
      )}
    </div>
    <button
      onClick={handleFinish}
      disabled={!isCertified}
      aria-label={!isCertified ? t("nexusBuilder.certifyBeforeDownload") : ""}
      className="w-full sm:w-auto px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {t("nexusBuilder.saveToPacket")}
    </button>
  </>
);

// Back/next/finish navigation bar, split out of NexusBuilder purely to keep
// its function body under the line-count/complexity limits. Same markup,
// same behavior.
const NexusNavigationButtons = ({ wizard, modalState, output, t }) => (
  <div className="flex justify-between mt-8 pt-6 border-t dark:border-gray-700">
    <button
      onClick={wizard.handleBack}
      disabled={wizard.step === 1}
      className="px-6 py-3 border border-gray-300 dark:border-gray-600 rounded-lg font-semibold text-gray-700 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-gray-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {t("nexusBuilder.back")}
    </button>

    <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
      {wizard.step < wizard.totalSteps && (
        <button
          onClick={wizard.handleNext}
          className="px-4 sm:px-6 py-2 sm:py-3 bg-green-600 text-white rounded-lg font-semibold hover:bg-green-700 transition-colors text-sm sm:text-base"
        >
          {t("nexusBuilder.nextStep")}
        </button>
      )}

      {wizard.step === wizard.totalSteps && (
        <NexusFinishControls
          isCertified={modalState.isCertified}
          setIsCertified={modalState.setIsCertified}
          showDownloadMenu={modalState.showDownloadMenu}
          setShowDownloadMenu={modalState.setShowDownloadMenu}
          handleDownload={output.handleDownload}
          handleFinish={output.handleFinish}
          t={t}
        />
      )}
    </div>
  </div>
);

// Bottom-of-tree modals (BuyMeCoffee nudge, AI-consent modal, Doctor's
// Packet modal), split out of NexusBuilder purely to keep its function body
// under the line-count limit. Same markup, same behavior.
const NexusBottomModals = ({
  modalState,
  condition,
  ai,
  primaryCondition,
  onOpenAISettings,
}) => (
  <div className="relative z-[70]">
    {/* BuyMeCoffee - shows after download */}
    <BuyMeCoffee
      show={modalState.nexusDownloaded}
      trigger="nexus"
      context={{ conditionName: condition }}
      onDismiss={() => modalState.setNexusDownloaded(false)}
      componentKey="nexus-builder"
    />

    {/* AI Consent Modal */}
    <AIConsentModal
      isOpen={ai.showAIConsent}
      onConsent={ai.handleAIConsent}
      onCancel={ai.handleAICancel}
      statementType="personal"
    />

    {/* Doctor's Packet Modal */}
    <DoctorsPacket
      isOpen={modalState.showDoctorsPacket}
      onClose={() => modalState.setShowDoctorsPacket(false)}
      primaryCondition={primaryCondition || ""}
      secondaryCondition={condition}
      onOpenAISettings={onOpenAISettings}
    />
  </div>
);

// Owns the misc modal/menu toggle state (download menu, coffee nudge,
// certification, doctor's packet). Split out of NexusBuilder purely to keep
// its function body under the line-count limit. Same logic.
function useNexusModalState() {
  const [showDownloadMenu, setShowDownloadMenu] = useState(false);
  const [nexusDownloaded, setNexusDownloaded] = useState(false);
  const [isCertified, setIsCertified] = useState(false); // Certification checkbox state
  const [showDoctorsPacket, setShowDoctorsPacket] = useState(false);

  return {
    showDownloadMenu,
    setShowDownloadMenu,
    nexusDownloaded,
    setNexusDownloaded,
    isCertified,
    setIsCertified,
    showDoctorsPacket,
    setShowDoctorsPacket,
  };
}

// Owns the statement/doctor-note derivation and the finish/download
// handlers. Split out of NexusBuilder purely to keep its function body
// under the line-count/complexity limits. Same logic, same order of
// operations.
function useNexusDocumentOutput({
  answers,
  condition,
  primaryCondition,
  isSecondary,
  useAIVersion,
  aiEnhancedStatement,
  onSave,
  setShowDownloadMenu,
  setNexusDownloaded,
}) {
  const getCurrentStatement = () => {
    if (useAIVersion && aiEnhancedStatement) {
      return aiEnhancedStatement;
    }
    return generateStatement({
      answers,
      condition,
      primaryCondition,
      isSecondary,
    });
  };

  const handleFinish = () => {
    const statement = getCurrentStatement();
    const doctorNote = generateDoctorNote({
      answers,
      condition,
      primaryCondition,
      isSecondary,
    });

    onSave({
      condition,
      primaryCondition,
      answers,
      statement,
      doctorNote,
      generatedDate: new Date().toISOString(),
    });
  };

  const handleDownload = (format = "txt") => {
    const statement = getCurrentStatement();
    const doctorNote = generateDoctorNote({
      answers,
      condition,
      primaryCondition,
      isSecondary,
    });
    const fileName = `VA-Statement-${condition.replace(/\s+/g, "-")}`;

    switch (format) {
      case "txt":
        downloadAsTxt(statement, doctorNote, fileName);
        break;
      case "docx":
        downloadAsDocx(statement, doctorNote, fileName);
        break;
      case "pdf":
        downloadAsPdf(statement, doctorNote, fileName);
        break;
      default:
        downloadAsTxt(statement, doctorNote, fileName);
    }

    setShowDownloadMenu(false);
    setNexusDownloaded(true);
  };

  const currentStatement = getCurrentStatement();
  const currentDoctorNote = generateDoctorNote({
    answers,
    condition,
    primaryCondition,
    isSecondary,
  });

  return { handleFinish, handleDownload, currentStatement, currentDoctorNote };
}

// Renders the active wizard step. Split out of NexusBuilder purely to keep
// its function body under the line-count/complexity limits. Same markup,
// same behavior.
const NexusStepContent = ({
  wizard,
  ai,
  output,
  condition,
  primaryCondition,
  setShowDoctorsPacket,
  t,
}) => (
  <>
    {/* Step 1: Timeline */}
    {wizard.step === 1 && (
      <NexusStepTimeline
        answers={wizard.answers}
        updateAnswer={wizard.updateAnswer}
        condition={condition}
        t={t}
      />
    )}

    {/* Step 2: Bridge (Secondary Claims Only) */}
    {wizard.step === 2 && wizard.isSecondary && (
      <NexusStepBridge
        answers={wizard.answers}
        updateAnswer={wizard.updateAnswer}
        condition={condition}
        primaryCondition={primaryCondition}
        fieldHelping={ai.fieldHelping}
        handleFieldHelp={ai.handleFieldHelp}
        t={t}
      />
    )}

    {/* Step 3 (or 2 for primary): Severity and Daily Impact */}
    {((wizard.step === 3 && wizard.isSecondary) ||
      (wizard.step === 2 && !wizard.isSecondary)) && (
      <NexusStepSeverity
        answers={wizard.answers}
        updateAnswer={wizard.updateAnswer}
        condition={condition}
        fieldHelping={ai.fieldHelping}
        handleFieldHelp={ai.handleFieldHelp}
        t={t}
      />
    )}

    {/* Final Step: Review and Download */}
    {wizard.step === wizard.totalSteps && (
      <NexusStepReview
        aiEnhancedStatement={ai.aiEnhancedStatement}
        isEnhancing={ai.isEnhancing}
        useAIVersion={ai.useAIVersion}
        handleRequestAIEnhance={ai.handleRequestAIEnhance}
        toggleStatementVersion={ai.toggleStatementVersion}
        aiError={ai.aiError}
        currentStatement={output.currentStatement}
        currentDoctorNote={output.currentDoctorNote}
        isSecondary={wizard.isSecondary}
        primaryCondition={primaryCondition}
        condition={condition}
        setShowDoctorsPacket={setShowDoctorsPacket}
        t={t}
      />
    )}
  </>
);

// Renders the modal + bottom modals for the wizard, given all state and
// handlers computed by NexusBuilder. Split out of NexusBuilder purely to
// keep its function body under the line-count/complexity limits. Same
// markup, same behavior.
const NexusBuilderView = ({
  condition,
  primaryCondition,
  onClose,
  existingStatement,
  onReportBug,
  onOpenAISettings,
  wizard,
  modalState,
  ai,
  output,
  t,
}) => (
  <>
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="xl"
      labelledBy="nexus-builder-title"
      header={
        <NexusHeader
          existingStatement={existingStatement}
          condition={condition}
          isSecondary={wizard.isSecondary}
          primaryCondition={primaryCondition}
          onReportBug={onReportBug}
          onOpenAISettings={onOpenAISettings}
          onClose={onClose}
          step={wizard.step}
          totalSteps={wizard.totalSteps}
          t={t}
        />
      }
    >
      <div>
        <NexusStepContent
          wizard={wizard}
          ai={ai}
          output={output}
          condition={condition}
          primaryCondition={primaryCondition}
          setShowDoctorsPacket={modalState.setShowDoctorsPacket}
          t={t}
        />

        {/* Navigation Buttons */}
        <NexusNavigationButtons
          wizard={wizard}
          modalState={modalState}
          output={output}
          t={t}
        />
      </div>
    </ResponsiveModal>

    <NexusBottomModals
      modalState={modalState}
      condition={condition}
      ai={ai}
      primaryCondition={primaryCondition}
      onOpenAISettings={onOpenAISettings}
    />
  </>
);

/**
 * NexusBuilder Component
 * Dynamic wizard that generates a Statement in Support of Claim (VA Form 21-4138)
 * Customizes questions based on whether the claim is primary or secondary
 * Now with optional AI enhancement powered by Google Gemini
 */
const NexusBuilder = ({
  condition,
  primaryCondition,
  onClose,
  onSave,
  existingStatement = null,
  onReportBug,
  onOpenAISettings,
}) => {
  const { t } = useLanguage();

  const isSecondary = Boolean(primaryCondition);
  const totalSteps = isSecondary ? 4 : 3;

  const wizardState = useNexusAnswers(existingStatement, totalSteps);
  const modalState = useNexusModalState();
  const ai = useNexusAIEnhancement({
    answers: wizardState.answers,
    condition,
    primaryCondition,
    updateAnswer: wizardState.updateAnswer,
  });
  const output = useNexusDocumentOutput({
    answers: wizardState.answers,
    condition,
    primaryCondition,
    isSecondary,
    useAIVersion: ai.useAIVersion,
    aiEnhancedStatement: ai.aiEnhancedStatement,
    onSave,
    setShowDownloadMenu: modalState.setShowDownloadMenu,
    setNexusDownloaded: modalState.setNexusDownloaded,
  });

  const wizard = { ...wizardState, totalSteps, isSecondary };

  return (
    <NexusBuilderView
      condition={condition}
      primaryCondition={primaryCondition}
      onClose={onClose}
      existingStatement={existingStatement}
      onReportBug={onReportBug}
      onOpenAISettings={onOpenAISettings}
      wizard={wizard}
      modalState={modalState}
      ai={ai}
      output={output}
      t={t}
    />
  );
};

export default NexusBuilder;
