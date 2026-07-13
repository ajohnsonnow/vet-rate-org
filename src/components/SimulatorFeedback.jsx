import { useRef } from "react";
import {
  AlertCircle,
  TrendingUp,
  CheckCircle,
  Info,
  FileText,
  AlertTriangle,
  Download,
  ClipboardList,
  X,
  Calculator,
} from "lucide-react";
import jsPDF from "jspdf";
import ShareButton from "./ShareButton";
import { useLanguage } from "../contexts/LanguageContext";

function buildPdfLayout(doc) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const margin = 20;
  const contentWidth = pageWidth - margin * 2;
  return { pageWidth, pageHeight, margin, contentWidth };
}

// Check page break and add new page if needed
function pdfCheckPageBreak(doc, layout, pos, requiredSpace = 30) {
  if (pos.y > layout.pageHeight - requiredSpace) {
    doc.addPage();
    pos.y = 25;
    return true;
  }
  return false;
}

// Add section header with consistent styling
function pdfAddSectionHeader(doc, layout, pos, title, bgColor = [45, 80, 22]) {
  pdfCheckPageBreak(doc, layout, pos, 40);
  doc.setFillColor(...bgColor);
  doc.rect(layout.margin - 5, pos.y - 5, layout.contentWidth + 10, 12, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.text(title, layout.margin, pos.y + 3);
  doc.setTextColor(0, 0, 0);
  pos.y += 18;
}

// Add wrapped text with proper line handling
function _pdfAddWrappedText(
  doc,
  layout,
  pos,
  text,
  fontSize = 10,
  fontStyle = "normal",
  indent = 0,
) {
  doc.setFontSize(fontSize);
  doc.setFont("helvetica", fontStyle);
  const lines = doc.splitTextToSize(text, layout.contentWidth - indent);
  const lineHeight = fontSize * 0.5;

  lines.forEach((line) => {
    pdfCheckPageBreak(doc, layout, pos, lineHeight + 5);
    doc.text(line, layout.margin + indent, pos.y);
    pos.y += lineHeight;
  });
  return lines.length;
}

function pdfAddTitleHeader(doc, layout, pos, conditionName, diagnosticCode) {
  doc.setFillColor(45, 80, 22); // VA Green
  doc.rect(0, 0, layout.pageWidth, 45, "F");
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(22);
  doc.setFont("helvetica", "bold");
  doc.text("C&P Exam Simulation Report", layout.margin, 18);

  doc.setFontSize(14);
  doc.setFont("helvetica", "normal");
  doc.text(conditionName || "Disability Condition", layout.margin, 30);

  doc.setFontSize(10);
  const dcText = diagnosticCode ? `Diagnostic Code: ${diagnosticCode}` : "";
  const dateText = `Report Generated: ${new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" })}`;
  doc.text(`${dcText}${dcText ? "  |  " : ""}${dateText}`, layout.margin, 40);

  doc.setTextColor(0, 0, 0);
  pos.y = 55;
}

function pdfAddPredictedRatingBox(doc, layout, pos, predictedRating, ratingRationale) {
  doc.setFillColor(240, 253, 244); // Light green background
  doc.setDrawColor(45, 80, 22);
  doc.setLineWidth(1);
  doc.roundedRect(
    layout.margin - 5,
    pos.y - 5,
    layout.contentWidth + 10,
    35,
    3,
    3,
    "FD",
  );

  doc.setFontSize(12);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(45, 80, 22);
  doc.text("PREDICTED RATING", layout.margin, pos.y + 5);

  doc.setFontSize(36);
  doc.setFont("helvetica", "bold");
  doc.text(
    `${predictedRating}%`,
    layout.margin + layout.contentWidth - 35,
    pos.y + 20,
  );

  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(60, 60, 60);
  const rationaleLines = doc.splitTextToSize(
    ratingRationale || "",
    layout.contentWidth - 60,
  );
  rationaleLines.slice(0, 2).forEach((line, i) => {
    doc.text(line, layout.margin, pos.y + 15 + i * 5);
  });

  doc.setTextColor(0, 0, 0);
  pos.y += 45;
}

function pdfAddQuestionAnswer(doc, layout, pos, q, idx, answers) {
  pdfCheckPageBreak(doc, layout, pos, 35);

  // Question number and text
  doc.setFontSize(10);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(55, 65, 81);
  doc.text(`Question ${idx + 1}:`, layout.margin, pos.y);
  pos.y += 5;

  doc.setFont("helvetica", "normal");
  doc.setTextColor(0, 0, 0);
  const qLines = doc.splitTextToSize(q.question || "", layout.contentWidth - 5);
  qLines.forEach((line) => {
    pdfCheckPageBreak(doc, layout, pos, 8);
    doc.text(line, layout.margin + 5, pos.y);
    pos.y += 5;
  });

  // Answer
  const answer = answers[q.id];
  const option = q.options?.find((opt) => opt.value === answer);
  const answerText = option?.label || answer || "No response";

  doc.setFillColor(226, 232, 240);
  const answerLines = doc.splitTextToSize(
    `Your Answer: ${answerText}`,
    layout.contentWidth - 15,
  );
  const answerBoxHeight = Math.max(10, answerLines.length * 5 + 4);
  pdfCheckPageBreak(doc, layout, pos, answerBoxHeight + 5);
  doc.roundedRect(
    layout.margin + 5,
    pos.y - 2,
    layout.contentWidth - 10,
    answerBoxHeight,
    2,
    2,
    "F",
  );

  doc.setFont("helvetica", "bolditalic");
  doc.setTextColor(30, 64, 175);
  answerLines.forEach((line, i) => {
    doc.text(line, layout.margin + 10, pos.y + 4 + i * 5);
  });

  doc.setTextColor(0, 0, 0);
  pos.y += answerBoxHeight + 8;
}

function pdfAddResponsesSection(doc, layout, pos, questions, answers) {
  if (!questions || questions.length === 0 || !answers) return;

  pdfAddSectionHeader(
    doc,
    layout,
    pos,
    "YOUR RESPONSES - Questions & Answers",
    [55, 65, 81],
  );

  questions.forEach((q, idx) => {
    pdfAddQuestionAnswer(doc, layout, pos, q, idx, answers);
  });
}

function pdfAddWarningsSection(doc, layout, pos, warnings) {
  if (!warnings || warnings.length === 0) return;

  pdfAddSectionHeader(doc, layout, pos, "CRITICAL INFORMATION", [185, 28, 28]);

  warnings.forEach((warning) => {
    pdfCheckPageBreak(doc, layout, pos, 20);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(127, 29, 29);

    // Use simple bullet instead of emoji which doesn't render in PDF
    const wLines = doc.splitTextToSize(`>> ${warning}`, layout.contentWidth - 15);
    wLines.forEach((line) => {
      pdfCheckPageBreak(doc, layout, pos, 7);
      doc.text(line, layout.margin + 5, pos.y);
      pos.y += 6;
    });
    pos.y += 4;
  });
  doc.setTextColor(0, 0, 0);
}

function pdfAddGapLine(doc, layout, pos, gap) {
  // Skip empty lines/spacers
  if (!gap || gap.trim() === "") {
    pos.y += 4; // Add spacing for empty lines
    return;
  }

  pdfCheckPageBreak(doc, layout, pos, 20);
  doc.setFontSize(10);

  if (gap.startsWith("**")) {
    // Sub-header within gaps - also needs word wrapping
    doc.setFont("helvetica", "bold");
    const cleanGap = gap.replace(/\*\*/g, "");
    const headerLines = doc.splitTextToSize(cleanGap, layout.contentWidth - 5);
    headerLines.forEach((line) => {
      pdfCheckPageBreak(doc, layout, pos, 7);
      doc.text(line, layout.margin, pos.y);
      pos.y += 6;
    });
    pos.y += 2;
  } else if (gap.startsWith("•")) {
    // Already has bullet point - use as-is but indent
    doc.setFont("helvetica", "normal");
    const gLines = doc.splitTextToSize(gap, layout.contentWidth - 15);
    gLines.forEach((line) => {
      pdfCheckPageBreak(doc, layout, pos, 7);
      doc.text(line, layout.margin + 5, pos.y);
      pos.y += 6;
    });
    pos.y += 2;
  } else {
    // Regular text - add bullet prefix
    doc.setFont("helvetica", "normal");
    const gLines = doc.splitTextToSize(`• ${gap}`, layout.contentWidth - 15);
    gLines.forEach((line) => {
      pdfCheckPageBreak(doc, layout, pos, 7);
      doc.text(line, layout.margin + 5, pos.y);
      pos.y += 6;
    });
    pos.y += 2;
  }
}

function pdfAddGapAnalysisSection(doc, layout, pos, gaps) {
  if (!gaps || gaps.length === 0) return;

  pdfAddSectionHeader(
    doc,
    layout,
    pos,
    "GAP ANALYSIS - Path to Higher Ratings",
    [124, 58, 237],
  );

  doc.setTextColor(0, 0, 0);
  gaps.forEach((gap) => {
    pdfAddGapLine(doc, layout, pos, gap);
  });
}

function pdfAddChecklistSection(doc, layout, pos, actionItems) {
  if (!actionItems || actionItems.length === 0) return;

  pdfAddSectionHeader(doc, layout, pos, "PREPARATION CHECKLIST", [22, 163, 74]);

  doc.setTextColor(0, 0, 0);
  actionItems.forEach((item, _idx) => {
    pdfCheckPageBreak(doc, layout, pos, 15);
    doc.setFontSize(10);
    doc.setFont("helvetica", "normal");

    // Checkbox
    doc.setDrawColor(100, 100, 100);
    doc.setLineWidth(0.5);
    doc.rect(layout.margin + 2, pos.y - 3, 4, 4);

    const iLines = doc.splitTextToSize(item, layout.contentWidth - 15);
    iLines.forEach((line, _i) => {
      pdfCheckPageBreak(doc, layout, pos, 6);
      doc.text(line, layout.margin + 10, pos.y);
      pos.y += 5;
    });
    pos.y += 3;
  });
}

function pdfAddDisclaimerFooter(doc, layout, pos) {
  pdfCheckPageBreak(doc, layout, pos, 45);
  pos.y += 5;
  doc.setFillColor(243, 244, 246);
  doc.setDrawColor(156, 163, 175);
  doc.setLineWidth(0.5);
  doc.roundedRect(
    layout.margin - 5,
    pos.y - 3,
    layout.contentWidth + 10,
    38,
    2,
    2,
    "FD",
  );

  doc.setFontSize(8);
  doc.setFont("helvetica", "bold");
  doc.setTextColor(75, 85, 99);
  doc.text("IMPORTANT DISCLAIMER", layout.margin, pos.y + 4);

  doc.setFont("helvetica", "normal");
  doc.setFontSize(7);
  const disclaimer =
    "This C&P Exam Simulation Report is an educational and preparation tool only. It does NOT constitute legal advice, medical advice, or a guarantee of any specific VA disability rating. The information provided is based on 38 CFR Part 4 criteria as of January 2026. Individual results will vary based on medical evidence, examiner findings, and VA adjudication. Always consult with an accredited Veterans Service Organization (VSO), VA-accredited claims agent, or VA-accredited attorney for personalized guidance on your specific claim.";
  const dLines = doc.splitTextToSize(disclaimer, layout.contentWidth);
  dLines.forEach((line, i) => {
    doc.text(line, layout.margin, pos.y + 10 + i * 4);
  });
}

function pdfAddPageNumbers(doc, layout) {
  const totalPages = doc.internal.getNumberOfPages();
  for (let i = 1; i <= totalPages; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(128, 128, 128);
    doc.text(
      `VetRate.org - C&P Exam Preparation Tool`,
      layout.margin,
      layout.pageHeight - 10,
    );
    doc.text(
      `Page ${i} of ${totalPages}`,
      layout.pageWidth - layout.margin - 20,
      layout.pageHeight - 10,
    );
  }
}

function pdfSaveFile(doc, conditionName) {
  const safeName = (conditionName || "Condition").replace(
    /[^a-zA-Z0-9]/g,
    "_",
  );
  const fileName = `CP_Exam_Report_${safeName}_${new Date().toISOString().slice(0, 10)}.pdf`;
  doc.save(fileName);
}

// Color scheme based on rating level
function getRatingColor(rating) {
  if (rating === 0) return "text-gray-600 bg-gray-100";
  if (rating <= 10) return "text-blue-600 bg-blue-100";
  if (rating <= 30) return "text-green-600 bg-green-100";
  if (rating <= 50) return "text-yellow-600 bg-yellow-100";
  return "text-red-600 bg-red-100";
}

const GapItem = ({ gap }) => {
  if (gap.startsWith("**")) {
    return (
      <p className="font-bold text-lg text-purple-800 dark:text-purple-100 mt-4 mb-2">
        {gap.replace(/\*\*/g, "")}
      </p>
    );
  }
  if (gap.startsWith("•")) {
    return (
      <p className="ml-4 whitespace-pre-wrap text-gray-600 dark:text-gray-400">
        {gap}
      </p>
    );
  }
  if (gap.trim() === "") {
    return <div className="h-2" /* Spacer for empty lines */ />;
  }
  return <p className="ml-4 whitespace-pre-wrap">{gap}</p>;
};

const ResultHeader = ({ conditionName }) => (
  <div className="bg-gradient-to-r from-amber-700 to-amber-800 text-white p-6 rounded-lg shadow-lg">
    <h2 className="text-2xl font-bold mb-2">C&P Exam Simulation Results</h2>
    <p className="text-amber-100">{conditionName}</p>
  </div>
);

const PredictedRatingCard = ({
  predictedRating,
  ratingRationale,
  ratingColor,
}) => (
  <div className="bg-white rounded-lg shadow-md border-2 border-amber-200 p-6">
    <div className="flex items-center justify-between mb-4">
      <h3 className="text-xl font-bold text-gray-900 flex items-center gap-2">
        <TrendingUp className="h-6 w-6 text-amber-600" />
        Predicted Rating
      </h3>
      <div
        className={`text-4xl font-bold px-6 py-2 rounded-lg ${ratingColor}`}
      >
        {predictedRating}%
      </div>
    </div>

    <div className="prose max-w-none">
      <p className="text-gray-700 text-lg">{ratingRationale}</p>
    </div>
  </div>
);

const WarningsSection = ({ warnings }) => {
  if (!warnings || warnings.length === 0) return null;

  return (
    <div className="bg-yellow-50 border-2 border-yellow-400 rounded-lg p-5">
      <div className="flex items-start gap-3">
        <AlertTriangle className="h-6 w-6 text-yellow-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-yellow-900 mb-3">
            Critical Information
          </h3>
          <div className="space-y-2">
            {warnings.map((warning, index) => (
              <div key={index} className="text-yellow-800">
                <p className="whitespace-pre-wrap">{warning}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const GapAnalysisSection = ({ gaps }) => {
  if (!gaps || gaps.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-purple-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <Info className="h-6 w-6 text-purple-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Gap Analysis: What You Need to Know
          </h3>
          <p className="text-gray-600 mb-4">
            This analysis shows what would be required to qualify for a
            higher rating, based on 38 CFR Part 4 criteria.
          </p>
        </div>
      </div>

      <div className="space-y-2 pl-9">
        {gaps.map((gap, index) => (
          <div key={index} className="text-gray-700 dark:text-gray-300">
            <GapItem gap={gap} />
          </div>
        ))}
      </div>
    </div>
  );
};

const ActionItemsSection = ({ actionItems }) => {
  if (!actionItems || actionItems.length === 0) return null;

  return (
    <div className="bg-white rounded-lg shadow-md border-2 border-green-200 p-6">
      <div className="flex items-start gap-3 mb-4">
        <FileText className="h-6 w-6 text-green-600 flex-shrink-0 mt-1" />
        <div className="flex-1">
          <h3 className="text-xl font-bold text-gray-900 mb-2">
            Action Items for Your C&P Exam
          </h3>
          <p className="text-gray-600 mb-4">
            These are specific steps you should take to prepare for your exam
            and maximize your rating.
          </p>
        </div>
      </div>

      <div className="space-y-3 pl-9">
        {actionItems.map((item, index) => (
          <div key={index} className="flex items-start gap-3">
            <CheckCircle className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
            <p className="text-gray-700 whitespace-pre-wrap">{item}</p>
          </div>
        ))}
      </div>
    </div>
  );
};

const EducationalNote = () => (
  <div className="bg-blue-50 border-2 border-blue-300 rounded-lg p-5">
    <div className="flex items-start gap-3">
      <AlertCircle className="h-6 w-6 text-blue-600 flex-shrink-0 mt-1" />
      <div className="flex-1">
        <h4 className="font-bold text-blue-900 mb-2">
          Understanding Your Results
        </h4>
        <div className="text-blue-800 space-y-2 text-sm">
          <p>
            • This simulation is based on your self-reported answers and the
            criteria in 38 CFR Part 4.
          </p>
          <p>
            • The actual rating decision will be made by the VA rater based
            on the C&P examiner&apos;s report and all evidence in your file.
          </p>
          <p>
            • The C&P exam is NOT an adversarial process - the
            examiner&apos;s job is to document your condition accurately,
            not to deny your claim.
          </p>
          <p>
            • <strong>Always tell the truth</strong> during your exam.
            Describe your worst days, not your best days.
          </p>
        </div>
      </div>
    </div>
  </div>
);

const ActionButtons = ({
  feedbackContentRef,
  onSendToCalculator,
  onRestart,
  downloadPDF,
  onClose,
}) => (
  <div className="flex gap-4 justify-center flex-wrap">
    <ShareButton
      targetRef={feedbackContentRef}
      filename="cap-simulator-results"
      variant="button"
    />
    {onSendToCalculator && (
      <button
        onClick={onSendToCalculator}
        className="px-6 py-3 bg-gradient-to-r from-purple-600 to-indigo-600 text-white font-semibold rounded-lg hover:from-purple-700 hover:to-indigo-700 transition shadow-md flex items-center gap-2"
      >
        <Calculator className="h-5 w-5" />
        Send to Tactical Calculator
      </button>
    )}
    <button
      onClick={onRestart}
      className="px-6 py-3 bg-blue-600 text-white font-semibold rounded-lg hover:bg-blue-700 transition shadow-md flex items-center gap-2"
    >
      <ClipboardList className="h-5 w-5" />
      Simulate Another Condition
    </button>
    <button
      onClick={downloadPDF}
      className="px-6 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition shadow-md flex items-center gap-2"
    >
      <Download className="h-5 w-5" />
      Download Results (PDF)
    </button>
    <button
      onClick={onClose}
      className="px-6 py-3 bg-gray-600 text-white font-semibold rounded-lg hover:bg-gray-700 transition shadow-md flex items-center gap-2"
    >
      <X className="h-5 w-5" />
      Close Simulator
    </button>
  </div>
);

const DisclaimerFooter = () => (
  <div className="bg-gray-100 border-l-4 border-gray-400 p-4 rounded">
    <p className="text-sm text-gray-600 italic">
      <strong>Disclaimer:</strong> This is a training and preparation tool,
      not legal advice. It does not guarantee any specific rating outcome.
      Always consult with an accredited VSO or VA-accredited attorney for
      personalized advice. The information provided is based on 38 CFR Part 4
      as of January 2026.
    </p>
  </div>
);

/**
 * SimulatorFeedback Component
 *
 * Displays C&P Simulator results with educational gap analysis.
 * Shows predicted rating, rationale, gaps to higher ratings, and actionable advice.
 *
 * CRITICAL: This is an educational tool, not a guarantee. All feedback based on 38 CFR Part 4.
 */
const SimulatorFeedback = ({
  result,
  conditionName,
  diagnosticCode,
  answers,
  questions,
  onRestart,
  onClose,
  onSendToCalculator,
}) => {
  const { _t } = useLanguage();
  const feedbackContentRef = useRef(null);

  if (!result) return null;

  const { predictedRating, ratingRationale, gaps, actionItems, warnings } =
    result;

  // Generate PDF download
  const downloadPDF = () => {
    const doc = new jsPDF();
    const layout = buildPdfLayout(doc);
    const pos = { y: 20 };

    pdfAddTitleHeader(doc, layout, pos, conditionName, diagnosticCode);
    pdfAddPredictedRatingBox(doc, layout, pos, predictedRating, ratingRationale);
    pdfAddResponsesSection(doc, layout, pos, questions, answers);
    pdfAddWarningsSection(doc, layout, pos, warnings);
    pdfAddGapAnalysisSection(doc, layout, pos, gaps);
    pdfAddChecklistSection(doc, layout, pos, actionItems);
    pdfAddDisclaimerFooter(doc, layout, pos);
    pdfAddPageNumbers(doc, layout);
    pdfSaveFile(doc, conditionName);
  };

  const ratingColor = getRatingColor(predictedRating);

  return (
    <div ref={feedbackContentRef} className="space-y-6">
      <ResultHeader conditionName={conditionName} />
      <PredictedRatingCard
        predictedRating={predictedRating}
        ratingRationale={ratingRationale}
        ratingColor={ratingColor}
      />
      <WarningsSection warnings={warnings} />
      <GapAnalysisSection gaps={gaps} />
      <ActionItemsSection actionItems={actionItems} />
      <EducationalNote />
      <ActionButtons
        feedbackContentRef={feedbackContentRef}
        onSendToCalculator={onSendToCalculator}
        onRestart={onRestart}
        downloadPDF={downloadPDF}
        onClose={onClose}
      />
      <DisclaimerFooter />
    </div>
  );
};

export default SimulatorFeedback;
