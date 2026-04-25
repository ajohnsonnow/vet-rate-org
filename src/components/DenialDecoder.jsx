/**
 * Vet-Rate.org - The Denials Decoder (OCR + AI Simplifier)
 *
 * Helps veterans understand their VA denial letters.
 * Uses local OCR (Tesseract.js) to scan denial letters, then AI to:
 * 1. Identify the specific reason for denial
 * 2. Translate legalese into plain English
 * 3. Provide actionable next steps
 *
 * Updated: Now uses Unified AI Service for seamless Cloud/Local AI switching
 */

import React, { useState, useRef, useEffect } from "react";
import { useLanguage } from "../contexts/LanguageContext";
import {
  Camera,
  Upload,
  FileText,
  AlertCircle,
  CheckCircle,
  Loader,
  Eye,
  Lightbulb,
} from "lucide-react";
import { createWorker } from "tesseract.js";
import {
  generateAI,
  isAnyAIAvailable,
  AI_MODES,
} from "../utils/unifiedAIService";
import { useAIStatus } from "../hooks/useAIStatus";
import { AIStatusBadge } from "./AIModeSelector";
import { LLMRecommendationBadge } from "./LLMRecommendation";
import {
  getVeteranAIContext,
  saveAnalysisResults,
  PACKET_DOC_TYPES,
} from "../utils/veteranContextProvider";

// AI System Prompt for analyzing denial letters
const DENIAL_ANALYSIS_PROMPT = `You are a VA claims expert helping veterans understand their denial letters.

Your job is to:
1. Identify the SPECIFIC legal reason for denial (not just "denied")
2. Translate VA legalese into 5th-grade English
3. Explain what evidence was missing or insufficient
4. Provide 2-3 actionable next steps

**COMMON DENIAL REASONS:**
- Lack of Current Diagnosis (no medical proof of the condition)
- Lack of In-Service Event or Stressor (no proof it happened in service)
- Lack of Nexus (no medical link between service and current condition)
- Insufficient Medical Evidence (diagnosis exists but not detailed enough)
- Insufficient Lay Evidence (need buddy statements or personal statements)
- Not Service-Connected (condition exists but not related to service)
- Claim Not Well-Grounded (missing one of the three elements)

**OUTPUT FORMAT:**
Return ONLY valid JSON (no markdown, no code fences):

{
  "denialReason": "Primary legal reason (short)",
  "simplifiedExplanation": "Plain English explanation (2-3 sentences, 5th grade level)",
  "whatWasMissing": "Specific evidence that was missing or weak",
  "nextSteps": [
    "Step 1: Specific action to take",
    "Step 2: Another specific action",
    "Step 3: Final action"
  ],
  "urgency": "high|medium|low",
  "appealDeadline": "Extract any deadline mentioned, or 'Not specified'"
}

Now analyze this denial letter text:`;

const DenialDecoder = ({ onClose, className = "", onOpenAISettings }) => {
  const { t } = useLanguage();
  const [step, setStep] = useState("upload"); // upload, processing, analyzing, results
  const [extractedText, setExtractedText] = useState("");
  const [analysis, setAnalysis] = useState(null);
  const [error, setError] = useState(null);
  const [progress, setProgress] = useState(0);
  const [showRawText, setShowRawText] = useState(false);
  const aiStatus = useAIStatus();

  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  // Handle file upload or camera capture
  const handleImageSelect = async (file) => {
    if (!file) return;

    setStep("processing");
    setError(null);
    setProgress(0);

    try {
      // Create Tesseract worker for OCR
      const worker = await createWorker("eng", 1, {
        logger: (m) => {
          if (m.status === "recognizing text") {
            setProgress(Math.round(m.progress * 100));
          }
        },
      });

      // Perform OCR
      const {
        data: { text },
      } = await worker.recognize(file);
      await worker.terminate();

      if (!text || text.trim().length < 50) {
        throw new Error(
          "Could not extract enough text from image. Make sure the image is clear and well-lit.",
        );
      }

      setExtractedText(text);
      setStep("analyzing");

      // Now analyze with AI
      await analyzeWithAI(text);
    } catch (err) {
      console.error("OCR Error:", err);
      setError(
        err.message ||
          "Failed to process image. Please try again with a clearer photo.",
      );
      setStep("upload");
    }
  };

  const analyzeWithAI = async (text) => {
    // Check if AI is available
    if (!isAnyAIAvailable()) {
      setError(
        "No AI available. Please configure an API key or enable Local AI in settings.",
      );
      setShowAISettings(true);
      setStep("upload");
      return;
    }

    try {
      // Load veteran context from VKB + My Packet for smarter analysis
      const veteranContext = await getVeteranAIContext({
        maxPacketTokens: 600,
      });
      const contextBlock = veteranContext
        ? `\n\nVETERAN CASE DATA (use to correlate denial with known evidence):\n${veteranContext}\n\n`
        : "";
      const fullPrompt = DENIAL_ANALYSIS_PROMPT + contextBlock + "\n\n" + text;

      // Use unified AI service
      const response = await generateAI(fullPrompt, {
        temperature: 0.3,
        maxTokens: 1500,
        expectJSON: true,
      });

      // generateAI returns { text, mode } object - extract the text content
      const aiResponse = response?.text || response;
      const responseStr =
        typeof aiResponse === "string"
          ? aiResponse
          : JSON.stringify(aiResponse);

      // Parse JSON response
      let parsedAnalysis = null;
      try {
        const cleanedResponse = responseStr
          .replace(/```json\n?/g, "")
          .replace(/```\n?/g, "")
          .trim();

        parsedAnalysis = JSON.parse(cleanedResponse);
      } catch (parseError) {
        console.error("Failed to parse AI response:", parseError);
        throw new Error(
          "Could not understand the denial letter. Please try manual review.",
        );
      }

      setAnalysis(parsedAnalysis);
      setStep("results");

      // Save analysis results to VKB + My Packet
      await saveAnalysisResults({
        toolName: "Denial Decoder",
        classification: PACKET_DOC_TYPES.VA_CORRESPONDENCE,
        rawText: text,
        extractedData: parsedAnalysis,
        vkbDocument: {
          classification: "va_decision",
          rawText: text,
          extractedData: parsedAnalysis,
          source: "DenialDecoder",
        },
        vkbMergeData: {
          aiInsights: {
            lastDenialReason: parsedAnalysis.denialReason,
            lastDenialMissing: parsedAnalysis.whatWasMissing,
            denialUrgency: parsedAnalysis.urgency,
            appealDeadline: parsedAnalysis.appealDeadline,
          },
          keyFacts: [
            {
              source: "DenialDecoder",
              fact: `Denial reason: ${parsedAnalysis.denialReason}`,
              date: new Date().toISOString(),
            },
          ],
        },
      });
    } catch (err) {
      console.error("AI Analysis Error:", err);
      setError(
        err.message ||
          "Failed to analyze denial letter. Check your internet connection.",
      );
      setStep("upload");
    }
  };

  // handleFileUpload moved below analyzeWithAI

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageSelect(file);
    }
  };

  const getUrgencyColor = (urgency) => {
    switch (urgency) {
      case "high":
        return "bg-red-50 border-red-300 text-red-900";
      case "medium":
        return "bg-yellow-50 border-yellow-300 text-yellow-900";
      case "low":
        return "bg-blue-50 border-blue-300 text-blue-900";
      default:
        return "bg-gray-50 border-gray-300 text-gray-900";
    }
  };

  const handleReset = () => {
    setStep("upload");
    setExtractedText("");
    setAnalysis(null);
    setError(null);
    setProgress(0);
    setShowRawText(false);
  };

  return (
    <div className={`denial-decoder ${className}`}>
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 to-blue-700 text-white p-6 rounded-t-lg">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <FileText className="w-8 h-8" />
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {t("denialDecoder.title")}
                <span className="px-1.5 py-0.5 bg-blue-500 text-white text-[10px] font-bold rounded">
                  {t("denialDecoder.ai")}
                </span>
                <span className="px-1.5 py-0.5 bg-amber-500 text-white text-[10px] font-bold rounded">
                  BETA
                </span>
              </h2>
              <p className="text-blue-100 text-sm mt-1">
                {t("denialDecoder.subtitle")}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <LLMRecommendationBadge toolId="denial-decoder" />
            <AIStatusBadge onClick={onOpenAISettings} showLabel={false} />
            {onClose && (
              <button
                onClick={onClose}
                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                aria-label={t("common.close")}
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
        </div>
      </div>

      <div className="p-6">
        {/* Upload Step */}
        {step === "upload" && (
          <div className="space-y-6">
            {/* Privacy Notice */}
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <div className="flex items-start gap-3">
                <CheckCircle className="w-5 h-5 text-green-600 flex-shrink-0 mt-0.5" />
                <div className="text-sm text-green-900">
                  <p className="font-semibold mb-1">
                    {t("denialDecoder.privacyProtected")}
                  </p>
                  <p className="text-green-800">
                    {t("denialDecoder.ocrProcessingLocal")}{" "}
                    {aiStatus.effectiveMode === AI_MODES.LOCAL
                      ? t("denialDecoder.aiAnalysisLocal")
                      : t("denialDecoder.onlyTextSentToAi")}
                  </p>
                </div>
              </div>
            </div>

            {/* AI Setup Message */}
            {!isAnyAIAvailable() && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <Lightbulb className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                  <div className="text-sm text-amber-900">
                    <p className="font-semibold mb-1">
                      {t("denialDecoder.aiRequired")}
                    </p>
                    <p className="text-amber-800">
                      {t("denialDecoder.aiSetupMessage")}
                    </p>
                  </div>
                </div>
              </div>
            )}
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-red-900">{error}</p>
                </div>
              </div>
            )}

            {/* Drop In Buttons */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Camera Button */}
              <button
                onClick={() => cameraInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Camera className="w-12 h-12 text-blue-600" />
                <div className="text-center">
                  <p className="font-semibold text-gray-900">
                    {t("denialDecoder.takePhoto")}
                  </p>
                  <p className="text-xs text-gray-600 mt-1">
                    {t("denialDecoder.useYourCamera")}
                  </p>
                </div>
              </button>

              {/* File Drop In Button */}
              <button
                onClick={() => fileInputRef.current?.click()}
                className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-gray-300 rounded-lg hover:border-blue-500 hover:bg-blue-50 transition-all"
              >
                <Upload className="w-12 h-12 text-blue-600" />
                <div className="text-center">
                  <p className="font-semibold text-gray-900">Select Image</p>
                  <p className="text-xs text-gray-600 mt-1">
                    Choose from files (stays in your browser)
                  </p>
                </div>
              </button>

              <input
                ref={cameraInputRef}
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileUpload}
                className="hidden"
              />
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileUpload}
                className="hidden"
              />
            </div>

            {/* Tips */}
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <p className="text-sm font-semibold text-blue-900 mb-2">
                {t("denialDecoder.tipsTitle")}
              </p>
              <ul className="text-xs text-blue-800 space-y-1 ml-4 list-disc">
                <li>{t("denialDecoder.tipWellLit")}</li>
                <li>{t("denialDecoder.tipNoShadows")}</li>
                <li>{t("denialDecoder.tipEntirePage")}</li>
                <li>{t("denialDecoder.tipSteady")}</li>
              </ul>
            </div>
          </div>
        )}

        {/* Processing Step */}
        {step === "processing" && (
          <div className="text-center py-12">
            <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">
              {t("denialDecoder.readingLetter")}
            </p>
            <p className="text-sm text-gray-600 mb-4">
              {t("denialDecoder.processingLocally")}
            </p>
            <div className="max-w-md mx-auto bg-gray-200 rounded-full h-3 overflow-hidden">
              <div
                className="bg-blue-600 h-full transition-all duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="text-sm text-gray-500 mt-2">{progress}%</p>
          </div>
        )}

        {/* Analyzing Step */}
        {step === "analyzing" && (
          <div className="text-center py-12">
            <Loader className="w-16 h-16 text-blue-600 animate-spin mx-auto mb-4" />
            <p className="text-lg font-semibold text-gray-900 mb-2">
              {t("denialDecoder.analyzingDenialReason")}
            </p>
            <p className="text-sm text-gray-600">
              {t("denialDecoder.translatingLegalese")}
            </p>
          </div>
        )}

        {/* Results Step */}
        {step === "results" && analysis && (
          <div className="space-y-6">
            {/* Main Analysis */}
            <div
              className={`border-2 rounded-lg p-6 ${getUrgencyColor(analysis.urgency)}`}
            >
              <h3 className="text-xl font-bold mb-2">
                {t("denialDecoder.whyDenied")}
              </h3>
              <p className="text-lg font-semibold mb-4">
                {analysis.denialReason}
              </p>

              <h4 className="font-semibold text-sm uppercase tracking-wide mb-2">
                {t("denialDecoder.inPlainEnglish")}
              </h4>
              <p className="text-base leading-relaxed mb-4">
                {analysis.simplifiedExplanation}
              </p>

              <h4 className="font-semibold text-sm uppercase tracking-wide mb-2">
                {t("denialDecoder.whatWasMissing")}
              </h4>
              <p className="text-base leading-relaxed">
                {analysis.whatWasMissing}
              </p>
            </div>

            {/* Deadline Warning */}
            {analysis.appealDeadline &&
              analysis.appealDeadline !== "Not specified" && (
                <div className="bg-red-50 border-2 border-red-300 rounded-lg p-4">
                  <div className="flex items-center gap-3">
                    <AlertCircle className="w-6 h-6 text-red-600 flex-shrink-0" />
                    <div>
                      <p className="font-bold text-red-900">
                        {t("denialDecoder.appealDeadline")}
                      </p>
                      <p className="text-red-800">{analysis.appealDeadline}</p>
                    </div>
                  </div>
                </div>
              )}

            {/* Next Steps */}
            <div className="bg-white border-2 border-gray-300 rounded-lg p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="w-6 h-6 text-yellow-600" />
                <h3 className="text-lg font-bold text-gray-900">
                  {t("denialDecoder.yourNextSteps")}
                </h3>
              </div>
              <ol className="space-y-3">
                {analysis.nextSteps.map((step, index) => (
                  <li key={index} className="flex gap-3">
                    <span className="font-bold text-blue-600 flex-shrink-0">
                      {index + 1}.
                    </span>
                    <span className="text-gray-800">{step}</span>
                  </li>
                ))}
              </ol>
            </div>

            {/* Show Raw Text Toggle */}
            <div className="text-center">
              <button
                onClick={() => setShowRawText(!showRawText)}
                className="text-sm text-blue-600 hover:text-blue-800 flex items-center gap-2 mx-auto"
              >
                <Eye className="w-4 h-4" />
                {showRawText
                  ? t("denialDecoder.hideExtractedText")
                  : t("denialDecoder.showExtractedText")}
              </button>

              {showRawText && (
                <div className="mt-4 bg-gray-50 border border-gray-300 rounded-lg p-4 text-left">
                  <pre className="text-xs font-mono whitespace-pre-wrap text-gray-700">
                    {extractedText}
                  </pre>
                </div>
              )}
            </div>

            {/* Actions */}
            <div className="flex gap-3">
              <button
                onClick={handleReset}
                className="flex-1 bg-gray-200 text-gray-800 py-3 px-6 rounded-lg font-semibold hover:bg-gray-300 transition-colors"
              >
                {t("denialDecoder.scanAnotherLetter")}
              </button>
              {onClose && (
                <button
                  onClick={onClose}
                  className="flex-1 bg-blue-600 text-white py-3 px-6 rounded-lg font-semibold hover:bg-blue-700 transition-colors"
                >
                  {t("common.close")}
                </button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default DenialDecoder;
