import { useState } from "react";
import { Scale, AlertTriangle, ShieldAlert } from "lucide-react";
import ResponsiveModal from "./common/ResponsiveModal";
import { LegalCitationList } from "./LegalCitation";
import { generateAI, isAnyAIAvailable } from "../utils/unifiedAIService";
import { AIStatusBadge } from "./AIModeSelector";
import { answer as answerLegalQuestion } from "../services/legalAnswerer";

const MAX_QUESTION_LENGTH = 500;

/**
 * unifiedAIService.generateAI resolves { text, mode }, not a plain string —
 * legalAnswerer.js's dual-LLM split expects deps.generateAI to resolve a
 * string (dualLLM.js does String(raw) on it, so an unwrapped object would
 * silently coerce to "[object Object]" and every question would refuse).
 */
async function generateAIText(prompt, options) {
  const result = await generateAI(prompt, options);
  if (typeof result === "string") return result;
  return result?.text ?? "";
}

function AskTheRegsIntro() {
  return (
    <div className="flex items-start gap-2 rounded-lg bg-blue-50 p-3 text-sm text-blue-900 dark:bg-blue-900/20 dark:text-blue-200">
      <Scale className="mt-0.5 h-4 w-4 shrink-0" />
      <p>
        Ask a question about VA disability regulations (38 CFR Part 4). Answers
        cite the specific regulation and when it was last fetched.{" "}
        <strong>Not legal advice</strong> — verify with an accredited VSO or
        attorney before relying on it.
      </p>
    </div>
  );
}

function AskTheRegsQuestionForm({
  question,
  setQuestion,
  isAsking,
  handleSubmit,
}) {
  return (
    <>
      <div className="flex items-center justify-between gap-2">
        <label
          htmlFor="ask-the-regs-input"
          className="text-sm font-medium text-gray-700 dark:text-gray-300"
        >
          Your question
        </label>
        <AIStatusBadge />
      </div>

      <form
        id="ask-the-regs-form"
        onSubmit={handleSubmit}
        className="space-y-2"
      >
        <textarea
          id="ask-the-regs-input"
          value={question}
          onChange={(e) =>
            setQuestion(e.target.value.slice(0, MAX_QUESTION_LENGTH))
          }
          placeholder='e.g. "How does VA combine multiple disability ratings?"'
          rows={3}
          maxLength={MAX_QUESTION_LENGTH}
          disabled={isAsking}
          className="w-full min-h-[44px] rounded-lg border border-gray-300 p-3 text-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
        />
        <div className="text-right text-xs text-gray-400">
          {question.length}/{MAX_QUESTION_LENGTH}
        </div>
      </form>
    </>
  );
}

function AskTheRegsResult({ aiAvailable, error, result }) {
  return (
    <>
      {!aiAvailable && (
        <p className="text-sm text-amber-700 dark:text-amber-400">
          No AI mode is configured yet — tap the status badge above to set one
          up before asking.
        </p>
      )}

      {error && (
        <div className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{error}</p>
        </div>
      )}

      {result?.injectionAttempt && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-800 dark:bg-red-900/20 dark:text-red-300"
        >
          <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0" />
          <p>{result.answer}</p>
        </div>
      )}

      {result && !result.injectionAttempt && (
        <div className="space-y-2 rounded-lg border border-gray-200 p-3 dark:border-gray-700">
          <p className="whitespace-pre-wrap text-sm text-gray-800 dark:text-gray-200">
            {result.answer}
          </p>
          <LegalCitationList citations={result.citations} />
        </div>
      )}
    </>
  );
}

/**
 * AskTheRegs — S23. Wires the security-critical dual-LLM answerer
 * (src/services/legalAnswerer.js, built + eval-gated in S18-S22) into a
 * user-facing modal for the first time. Wiring only: no changes to the
 * PII-scrub / dual-LLM / spotlighting security architecture.
 */
export default function AskTheRegs({ onClose }) {
  const [question, setQuestion] = useState("");
  const [isAsking, setIsAsking] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  const aiAvailable = isAnyAIAvailable();

  const handleAsk = async () => {
    const trimmed = question.trim();
    if (!trimmed) return;
    if (!aiAvailable) {
      setError("Set up an AI mode (local or cloud) to ask a question.");
      return;
    }

    setIsAsking(true);
    setError(null);
    setResult(null);
    try {
      const res = await answerLegalQuestion(trimmed, {
        generateAI: generateAIText,
      });
      setResult(res);
    } catch (err) {
      console.error("Ask the Regs error:", err);
      setError("Something went wrong answering that question. Try again.");
    } finally {
      setIsAsking(false);
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    handleAsk();
  };

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose}
      size="lg"
      title="Ask the Regs"
      labelledBy="ask-the-regs-title"
      footer={
        <button
          type="submit"
          form="ask-the-regs-form"
          disabled={isAsking || !question.trim()}
          className="min-h-[44px] w-full rounded-lg bg-blue-700 px-4 py-2 font-semibold text-white transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-700"
        >
          {isAsking ? "Asking…" : "Ask"}
        </button>
      }
    >
      <div className="space-y-4">
        <AskTheRegsIntro />
        <AskTheRegsQuestionForm
          question={question}
          setQuestion={setQuestion}
          isAsking={isAsking}
          handleSubmit={handleSubmit}
        />
        <AskTheRegsResult
          aiAvailable={aiAvailable}
          error={error}
          result={result}
        />
      </div>
    </ResponsiveModal>
  );
}
