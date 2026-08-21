/**
 * Vet-Rate.org AI Assistant - "The Navigator"
 *
 * An intelligent AI guide that helps veterans and their families navigate
 * the complex VA claims process using natural language conversation.
 *
 * Features:
 * - Context-aware help (knows what page/tool user is on)
 * - Conversational interface (ask anything)
 * - Uses LEGAL preset for accurate regulatory guidance
 * - Can launch specific tools and explain how to use them
 * - Explains VA terminology in plain English
 * - Provides step-by-step guidance for claims process
 */

import { useState, useEffect, useRef } from "react";
import { generateAI } from "../utils/unifiedAIService";
import ResponsiveModal from "./common/ResponsiveModal";
import { useHelperMode } from "../contexts/HelperModeContext";
import { useLanguage } from "../contexts/LanguageContext";
import { getTotalToolCount } from "../data/toolkitData";
import { getConditionCount as getDisabilityCount } from "../services/knowledgeQuery";
import { AIStatusBadge } from "./AIModeSelector";
import VoiceInputButton from "./VoiceInput";
import { useRedditClipboard } from "../hooks/useRedditClipboard";
import { autoSummarizeIfLong } from "../utils/redditSummarizer";
import { getVeteranAIContext } from "../utils/veteranContextProvider";

// Build context-aware system prompt
function buildSystemPrompt(currentTool, isHelperMode, veteranContext) {
  const basePrompt = `You are "The Navigator", an expert AI assistant for Vet-Rate.org - a comprehensive VA disability claims toolkit.

YOUR ROLE:
- Help veterans and their families navigate the VA claims process
- Explain VA regulations, terminology, and procedures in ${isHelperMode ? "simple, caregiver-friendly language" : "clear language"}
- Guide users through the ${getTotalToolCount()}+ tools available on Vet-Rate.org
- Provide accurate information based on 38 CFR (VA regulations)
- Be empathetic, patient, and supportive

IMPORTANT - eCFR INTEGRATION:
Vet-Rate.org is FULLY INTEGRATED with the official eCFR (Electronic Code of Federal Regulations):
- All ${getDisabilityCount()} VA disabilities are validated against official eCFR diagnostic codes
- Direct links to eCFR sections are provided throughout the application
- Rating criteria comes directly from 38 CFR Part 4 (validated January 2026)
- Eligibility rules come from 38 CFR Part 3
- The Legislative Watchdog monitors Federal Register for 38 CFR changes in real-time
- Source URLs:
  * eCFR Part 3: https://www.ecfr.gov/current/title-38/chapter-I/part-3
  * eCFR Part 4: https://www.ecfr.gov/current/title-38/chapter-I/part-4

CURRENT CONTEXT:
- User is currently on: ${currentTool}
- Helper Mode (for caregivers): ${isHelperMode ? "ENABLED - Use simplified language" : "Disabled"}

AVAILABLE TOOLS ON VET-RATE.ORG:
1. **Disability Search** - Search ${getDisabilityCount()} VA conditions with ratings (eCFR validated)
2. **Rating Calculator** - Calculate combined disability rating using 38 CFR § 4.25
3. **Secondary Scout** - Find conditions caused by existing disabilities (38 CFR § 3.310)
4. **C-File Analyzer** - AI analysis of VA claims files
5. **Nexus Builder** - Generate medical nexus letters
6. **PACT Act Navigator** - Toxic exposure presumptives (38 CFR § 3.320)
7. **TDIU Builder** - Individual Unemployability (38 CFR § 4.16)
8. **DBQ Filler** - Complete Disability Benefit Questionnaires
9. **C&P Simulator** - Practice for Compensation & Pension exams
10. **Witness Bench** - Write buddy/lay statements
11. **Forms Helper** - VA form assistance
12. **Evidence Timeline** - Organize medical evidence chronologically
13. **State Benefits** - Tax exemptions and state-level benefits
14. **The War Game** - Red Team adversarial claim testing
15. **My Packet** - Personal claims toolkit
16. **Legislative Watchdog** - Monitor Federal Register for 38 CFR changes
... and 25+ more tools

GUIDELINES:
- Always cite 38 CFR sections when discussing ratings (e.g., "Per 38 CFR § 4.71a")
- If uncertain, say so and recommend consulting a VSO (free!)
- Keep responses concise (2-4 paragraphs max)
- Use bullet points for lists
- If asked how to use a specific tool, explain step-by-step
- Don't make up diagnostic codes - only use real ones from eCFR
- Emphasize that this is educational, not legal advice

TONE: ${isHelperMode ? "Extra supportive and patient - user may be a caregiver unfamiliar with VA processes" : "Professional but warm and empathetic"}`;

  // Inject VKB + My Packet context if available
  // This gives the AI complete knowledge of the veteran's case
  if (veteranContext) {
    return (
      basePrompt +
      "\n\nVETERAN CASE DATA (from uploaded documents):\n" +
      veteranContext
    );
  }

  return basePrompt;
}

// Map a failed AI request into the localized error message to display
function mapAssistantErrorMessage(error, t) {
  const errMsg = error?.message ?? "";
  console.error("Navigator AI error:", errMsg || error);
  let errorMessage = t("aiAssistant", "errorGeneric");

  if (errMsg === "CRISIS_DETECTED") {
    errorMessage = t("aiAssistant", "errorCrisis");
  } else if (errMsg.includes("No AI available")) {
    errorMessage = t("aiAssistant", "errorNoAI");
  } else if (errMsg.includes("temporarily disabled")) {
    errorMessage = t("aiAssistant", "errorDisabled");
  } else if (errMsg.includes("empty response")) {
    errorMessage = t("aiAssistant", "errorEmptyResponse");
  } else if (
    errMsg.includes("not initialized") ||
    errMsg.includes("not loaded")
  ) {
    errorMessage = t("aiAssistant", "errorNotReady");
  } else if (errMsg) {
    errorMessage = `⚠️ ${errMsg}`;
  }

  return errorMessage;
}

// Handle sending a message
async function sendMessage({
  input,
  messages,
  isLoading,
  currentTool,
  isHelperMode,
  veteranContext,
  t,
  setMessages,
  setInput,
  setIsLoading,
}) {
  if (!input.trim() || isLoading) return;

  const userMessage = {
    role: "user",
    content: input.trim(),
    timestamp: new Date(),
  };

  setMessages((prev) => [...prev, userMessage]);
  setInput("");
  setIsLoading(true);

  try {
    const result = await generateAI(input.trim(), {
      preset: "LEGAL", // Use LEGAL preset for accurate regulatory guidance
      maxTokens: 2048,
      temperature: 0.3, // Slightly more flexible than pure LEGAL but still precise
      systemPrompt: buildSystemPrompt(
        currentTool,
        isHelperMode,
        veteranContext,
      ),
      taskType: "assistant",
      context: {
        currentTool,
        isHelperMode,
        conversationHistory: messages.slice(-4), // Last 2 exchanges for context
      },
    });

    // Validate we got a meaningful response
    const responseText = result?.text?.trim();
    if (!responseText) {
      throw new Error(
        "AI returned an empty response. Please try again or rephrase your question.",
      );
    }

    const assistantMessage = {
      role: "assistant",
      content: responseText,
      timestamp: new Date(),
      mode: result.mode,
    };

    setMessages((prev) => [...prev, assistantMessage]);
  } catch (error) {
    const errorMessage = mapAssistantErrorMessage(error, t);

    setMessages((prev) => [
      ...prev,
      {
        role: "assistant",
        content: errorMessage,
        timestamp: new Date(),
        isError: true,
      },
    ]);
  } finally {
    setIsLoading(false);
  }
}

// Quick question suggestions based on current tool
function getQuickQuestions(t, currentTool) {
  const questions = {
    Home: [
      t("aiAssistant", "quickQ_home1"),
      t("aiAssistant", "quickQ_home2"),
      t("aiAssistant", "quickQ_home3"),
    ],
    "Disability Search": [
      t("aiAssistant", "quickQ_search1"),
      t("aiAssistant", "quickQ_search2"),
      t("aiAssistant", "quickQ_search3"),
    ],
    "Rating Calculator": [
      t("aiAssistant", "quickQ_calc1"),
      t("aiAssistant", "quickQ_calc2"),
      t("aiAssistant", "quickQ_calc3"),
    ],
    "Secondary Scout": [
      t("aiAssistant", "quickQ_secondary1"),
      t("aiAssistant", "quickQ_secondary2"),
      t("aiAssistant", "quickQ_secondary3"),
    ],
    "C-File Analyzer": [
      t("aiAssistant", "quickQ_cfile1"),
      t("aiAssistant", "quickQ_cfile2"),
      t("aiAssistant", "quickQ_cfile3"),
    ],
    "Nexus Builder": [
      t("aiAssistant", "quickQ_nexus1"),
      t("aiAssistant", "quickQ_nexus2"),
      t("aiAssistant", "quickQ_nexus3"),
    ],
    "PACT Act Navigator": [
      t("aiAssistant", "quickQ_pact1"),
      t("aiAssistant", "quickQ_pact2"),
      t("aiAssistant", "quickQ_pact3"),
    ],
    "TDIU Builder": [
      t("aiAssistant", "quickQ_tdiu1"),
      t("aiAssistant", "quickQ_tdiu2"),
      t("aiAssistant", "quickQ_tdiu3"),
    ],
  };

  return questions[currentTool] || questions["Home"];
}

function getMessageBubbleColorClasses(msg, assistantBg) {
  if (msg.role === "user") return "bg-blue-600 text-white";
  if (msg.isError)
    return "bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 text-red-900 dark:text-red-100";
  return assistantBg;
}

// Check if a message is long enough to warrant a summary button
function isLongMessage(content) {
  if (!content) return false;
  return content.trim().split(/\s+/).length > 300;
}

const BUBBLE_VARIANTS = {
  expanded: {
    bubbleClass: "max-w-[85%] sm:max-w-[70%] rounded-xl p-4",
    assistantBg:
      "bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 shadow-sm",
    textSpacing: "mb-2",
    footerClass:
      "flex items-center justify-between mt-3 pt-2 border-t border-white/20 dark:border-gray-600",
    loadingWrapClass:
      "bg-white dark:bg-gray-700 rounded-xl p-4 flex items-center gap-3 shadow-sm",
    dotClass: "w-2 h-2 bg-blue-400 rounded-full animate-bounce",
    loadingLabelKey: "analyzing",
  },
  docked: {
    bubbleClass: "max-w-[85%] rounded-lg p-3",
    assistantBg:
      "bg-gray-100 dark:bg-gray-700 text-gray-900 dark:text-gray-100",
    textSpacing: "mb-1",
    footerClass:
      "flex items-center justify-between mt-2 pt-2 border-t border-white/20 dark:border-gray-600",
    loadingWrapClass:
      "bg-gray-100 dark:bg-gray-700 rounded-lg p-3 flex items-center gap-2",
    dotClass: "w-2 h-2 bg-gray-400 rounded-full animate-bounce",
    loadingLabelKey: "analyzingShort",
  },
};

const COMPOSER_VARIANTS = {
  expanded: {
    wrapperClass: "",
    rowGapClass: "flex gap-2 sm:gap-3",
    textareaClass:
      "w-full px-4 py-3 pr-14 border border-gray-300 dark:border-gray-600 rounded-xl bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none text-base",
    rows: 3,
    voiceWrapClass: "absolute right-3 top-3",
    voiceSize: "md",
    placeholderKey: "placeholder",
    placeholderHelperKey: "placeholderHelper",
    buttonClass:
      "px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-xl transition-colors self-end flex items-center gap-2",
    showSendLabel: true,
    hintClass: "text-sm text-gray-500 dark:text-gray-400 mt-2",
    hintKey: "keyboardHints",
  },
  docked: {
    wrapperClass: "p-4 border-t border-gray-200 dark:border-gray-700",
    rowGapClass: "flex gap-2",
    textareaClass:
      "w-full px-3 py-2 pr-12 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none",
    rows: 2,
    voiceWrapClass: "absolute right-2 top-2",
    voiceSize: "sm",
    placeholderKey: "placeholderShort",
    placeholderHelperKey: "placeholderHelperShort",
    buttonClass:
      "px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed text-white rounded-lg transition-colors self-end",
    showSendLabel: false,
    hintClass: "text-xs text-gray-500 dark:text-gray-400 mt-1",
    hintKey: "keyboardHintsShort",
  },
};

function useVeteranContext() {
  const [veteranContext, setVeteranContext] = useState("");

  // Load veteran context from VKB + My Packet on mount
  useEffect(() => {
    getVeteranAIContext({ maxPacketTokens: 1000 })
      .then((ctx) => setVeteranContext(ctx))
      .catch((err) =>
        console.warn("Failed to load veteran context for AI Assistant:", err),
      );
  }, []);

  return veteranContext;
}

function useDraggablePosition(isMinimized) {
  const [position, setPosition] = useState(() => {
    const saved = localStorage.getItem("vet_rate_navigator_position");
    return saved
      ? JSON.parse(saved)
      : {
          x: (window.innerWidth - 384) / 2, // Centered horizontally (w-96 = 384px)
          y: (window.innerHeight - 600) / 2, // Centered vertically
        };
  });
  const [isDragging, setIsDragging] = useState(false);
  const [dragOffset, setDragOffset] = useState({ x: 0, y: 0 });
  const containerRef = useRef(null);

  // Drag handlers
  const handleMouseDown = (e) => {
    // Allow dragging from header (full view) or the entire minimized button
    if (isMinimized || e.target.closest(".drag-handle")) {
      e.preventDefault();
      setIsDragging(true);
      setDragOffset({
        x: e.clientX - position.x,
        y: e.clientY - position.y,
      });
    }
  };

  const handleMouseMove = (e) => {
    if (isDragging) {
      const newX = e.clientX - dragOffset.x;
      const newY = e.clientY - dragOffset.y;

      // Keep within viewport bounds - use smaller bounds for minimized button
      const width = isMinimized ? 72 : 384; // p-4 rounded-full ~= 72px, w-96 = 384px
      const height = isMinimized ? 72 : 600;
      const maxX = window.innerWidth - width;
      const maxY = window.innerHeight - height;

      setPosition({
        x: Math.max(0, Math.min(newX, maxX)),
        y: Math.max(0, Math.min(newY, maxY)),
      });
    }
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Save position to localStorage when it changes
  useEffect(() => {
    localStorage.setItem(
      "vet_rate_navigator_position",
      JSON.stringify(position),
    );
  }, [position]);

  // Add/remove mouse event listeners
  useEffect(() => {
    if (isDragging) {
      window.addEventListener("mousemove", handleMouseMove);
      window.addEventListener("mouseup", handleMouseUp);
      return () => {
        window.removeEventListener("mousemove", handleMouseMove);
        window.removeEventListener("mouseup", handleMouseUp);
      };
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isDragging, dragOffset, position]);

  // When minimized, position it at bottom-left corner by default
  useEffect(() => {
    if (isMinimized) {
      // Position at bottom-left corner (matching the launcher button position)
      setPosition({
        x: 16, // left-4 = 16px
        y: window.innerHeight - 72 - 16, // bottom-4 = 16px, button height ~72px
      });
    } else {
      // When expanding, reposition so the Navigator appears above the button
      // Navigator height is 600px, so position it anchored at the bottom
      setPosition((_prev) => ({
        x: 16, // Keep at left edge
        y: Math.max(16, window.innerHeight - 600 - 16), // Anchor at bottom with 16px margin, but not above viewport
      }));
    }
  }, [isMinimized]);

  return { position, isDragging, handleMouseDown, containerRef };
}

function useMessageActions() {
  // Reddit-style copy functionality ("Squared Away Standard")
  const { copyToClipboard } = useRedditClipboard();
  const [copiedMessageIdx, setCopiedMessageIdx] = useState(null);
  const [summaryStates, setSummaryStates] = useState({}); // { [idx]: { isSummarizing, summary, error } }

  // Handler to copy message and show confirmation
  const handleCopyMessage = async (content, idx) => {
    const success = await copyToClipboard(content);
    if (success) {
      setCopiedMessageIdx(idx);
      setTimeout(() => setCopiedMessageIdx(null), 2000);
    }
  };

  // Handler to summarize a long response
  const handleSummarize = async (content, idx) => {
    setSummaryStates((prev) => ({ ...prev, [idx]: { isSummarizing: true } }));
    try {
      const result = await autoSummarizeIfLong(content, "", {
        forceSummary: true,
      });
      setSummaryStates((prev) => ({
        ...prev,
        [idx]: {
          isSummarizing: false,
          summary: result.summary || "Unable to generate summary.",
          hasSummary: true,
        },
      }));
    } catch (error) {
      console.error("Summarization error:", error);
      setSummaryStates((prev) => ({
        ...prev,
        [idx]: { isSummarizing: false, error: "Summary failed. Try again." },
      }));
    }
  };

  return {
    copiedMessageIdx,
    summaryStates,
    handleCopyMessage,
    handleSummarize,
  };
}

function useNavigatorConversation({
  currentTool,
  isHelperMode,
  veteranContext,
  t,
  onClose,
  messagesEndRef,
}) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // Listen for tour start event to close Navigator (prevents blocking tour elements)
  useEffect(() => {
    const handleCloseNavigator = () => {
      if (onClose) {
        onClose();
      }
    };

    window.addEventListener("closeNavigator", handleCloseNavigator);
    return () =>
      window.removeEventListener("closeNavigator", handleCloseNavigator);
  }, [onClose]);

  // Scroll to bottom when new messages arrive
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, messagesEndRef]);

  // Initialize with welcome message
  useEffect(() => {
    const hasSeenWelcome = localStorage.getItem(
      "vet_rate_ai_assistant_welcomed",
    );

    if (!hasSeenWelcome) {
      setMessages([
        {
          role: "assistant",
          content: t("aiAssistant", "welcomeMessage"),
          timestamp: new Date(),
        },
      ]);
      localStorage.setItem("vet_rate_ai_assistant_welcomed", "true");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSend = () =>
    sendMessage({
      input,
      messages,
      isLoading,
      currentTool,
      isHelperMode,
      veteranContext,
      t,
      setMessages,
      setInput,
      setIsLoading,
    });

  // Handle keyboard shortcuts
  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return { messages, input, setInput, isLoading, handleSend, handleKeyDown };
}

function MarkdownLines({ content, spacingClass }) {
  return content.split("\n").map((line, i) => {
    // Bold
    if (line.startsWith("**") && line.endsWith("**")) {
      return (
        <p key={i} className={`font-bold ${spacingClass}`}>
          {line.slice(2, -2)}
        </p>
      );
    }
    // Bullet point
    if (line.startsWith("• ") || line.startsWith("- ")) {
      return (
        <li key={i} className="ml-4">
          {line.slice(2)}
        </li>
      );
    }
    // Regular text
    if (line.trim()) {
      return (
        <p key={i} className={spacingClass}>
          {line}
        </p>
      );
    }
    return <br key={i} />;
  });
}

function RedditCopyButton({ content, idx, copiedMessageIdx, onCopy }) {
  return (
    <button
      onClick={() => onCopy(content, idx)}
      className="text-xs opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1 hover:text-blue-500 dark:hover:text-blue-400"
      aria-label="Copy for Reddit (with eCFR links & privacy redaction)"
    >
      {copiedMessageIdx === idx ? (
        <>
          <svg
            className="w-3 h-3 text-green-500"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
          <span className="text-green-500">Copied!</span>
        </>
      ) : (
        <>
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M8 5H6a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2v-1M8 5a2 2 0 002 2h2a2 2 0 002-2M8 5a2 2 0 012-2h2a2 2 0 012 2m0 0h2a2 2 0 012 2v3m2 4H10m0 0l3-3m-3 3l3 3"
            />
          </svg>
          <span>Reddit</span>
        </>
      )}
    </button>
  );
}

function SummarizeButton({ content, idx, summaryStates, onSummarize }) {
  return (
    <button
      onClick={() => onSummarize(content, idx)}
      disabled={summaryStates[idx]?.isSummarizing}
      className="text-xs opacity-70 hover:opacity-100 transition-opacity flex items-center gap-1 hover:text-purple-500 dark:hover:text-purple-400 disabled:opacity-50"
      aria-label="Generate BLUF summary for Reddit"
    >
      {summaryStates[idx]?.isSummarizing ? (
        <>
          <svg className="w-3 h-3 animate-spin" fill="none" viewBox="0 0 24 24">
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
          <span>Summarizing...</span>
        </>
      ) : (
        <>
          <svg
            className="w-3 h-3"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M4 6h16M4 12h8m-8 6h16"
            />
          </svg>
          <span>BLUF</span>
        </>
      )}
    </button>
  );
}

function ModeBadge({ mode, t }) {
  return (
    <span className="text-xs opacity-70">
      {mode === "local"
        ? t("aiAssistant", "modeLocal")
        : t("aiAssistant", "modeCloud")}
    </span>
  );
}

function SummarySection({ idx, summaryStates, copiedMessageIdx, onCopy }) {
  return (
    <div className="mt-2 pt-2 border-t border-purple-300 dark:border-purple-700">
      <div className="flex items-center gap-1 mb-1">
        <svg
          className="w-3 h-3 text-purple-500"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 12h8m-8 6h16"
          />
        </svg>
        <span className="text-xs font-semibold text-purple-600 dark:text-purple-400">
          BLUF Summary
        </span>
        <button
          onClick={() => onCopy(summaryStates[idx].summary, `summary-${idx}`)}
          className="ml-auto text-xs opacity-70 hover:opacity-100 hover:text-blue-500"
          aria-label="Copy summary for Reddit"
        >
          {copiedMessageIdx === `summary-${idx}` ? "✓" : "📋"}
        </button>
      </div>
      <div className="text-xs text-purple-800 dark:text-purple-200 bg-purple-50 dark:bg-purple-900/30 rounded p-2">
        {summaryStates[idx].summary}
      </div>
    </div>
  );
}

function MessageBubble({
  msg,
  idx,
  variant,
  copiedMessageIdx,
  summaryStates,
  onCopy,
  onSummarize,
  t,
}) {
  const v = BUBBLE_VARIANTS[variant];
  return (
    <div
      className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
    >
      <div
        className={`${v.bubbleClass} ${getMessageBubbleColorClasses(msg, v.assistantBg)}`}
      >
        {/* Markdown-style formatting */}
        <div className="prose prose-sm dark:prose-invert max-w-none">
          <MarkdownLines content={msg.content} spacingClass={v.textSpacing} />
        </div>

        <div className={v.footerClass}>
          <span className="text-xs opacity-70">
            {msg.timestamp.toLocaleTimeString([], {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
          <div className="flex items-center gap-2">
            {/* Reddit Copy Button - Only for assistant messages */}
            {msg.role === "assistant" && !msg.isError && (
              <RedditCopyButton
                content={msg.content}
                idx={idx}
                copiedMessageIdx={copiedMessageIdx}
                onCopy={onCopy}
              />
            )}
            {/* Summarize Button - Only for long assistant messages without existing summary */}
            {msg.role === "assistant" &&
              !msg.isError &&
              isLongMessage(msg.content) &&
              !summaryStates[idx]?.hasSummary && (
                <SummarizeButton
                  content={msg.content}
                  idx={idx}
                  summaryStates={summaryStates}
                  onSummarize={onSummarize}
                />
              )}
            {msg.mode && <ModeBadge mode={msg.mode} t={t} />}
          </div>
        </div>

        {/* Summary Section - Shows when BLUF has been generated */}
        {summaryStates[idx]?.hasSummary && (
          <SummarySection
            idx={idx}
            summaryStates={summaryStates}
            copiedMessageIdx={copiedMessageIdx}
            onCopy={onCopy}
          />
        )}
      </div>
    </div>
  );
}

function LoadingIndicator({ variant, t }) {
  const v = BUBBLE_VARIANTS[variant];
  return (
    <div className="flex justify-start">
      <div className={v.loadingWrapClass}>
        <div className="flex space-x-1">
          <div className={v.dotClass} style={{ animationDelay: "0ms" }}></div>
          <div className={v.dotClass} style={{ animationDelay: "150ms" }}></div>
          <div className={v.dotClass} style={{ animationDelay: "300ms" }}></div>
        </div>
        <span className="text-sm text-gray-600 dark:text-gray-400">
          {t("aiAssistant", v.loadingLabelKey)}
        </span>
      </div>
    </div>
  );
}

function MessageList({
  messages,
  variant,
  isLoading,
  copiedMessageIdx,
  summaryStates,
  onCopy,
  onSummarize,
  t,
  messagesEndRef,
}) {
  return (
    <>
      {messages.map((msg, idx) => (
        <MessageBubble
          key={idx}
          msg={msg}
          idx={idx}
          variant={variant}
          copiedMessageIdx={copiedMessageIdx}
          summaryStates={summaryStates}
          onCopy={onCopy}
          onSummarize={onSummarize}
          t={t}
        />
      ))}

      {isLoading && <LoadingIndicator variant={variant} t={t} />}

      <div ref={messagesEndRef} />
    </>
  );
}

function QuickQuestions({ variant, questions, onSelect, t }) {
  if (variant === "expanded") {
    return (
      <div>
        <p className="mb-2 text-xs font-medium text-gray-600 dark:text-gray-400">
          {t("aiAssistant", "quickQuestions")}
        </p>
        <div className="flex flex-wrap gap-2">
          {questions.map((q, idx) => (
            <button
              key={idx}
              onClick={() => onSelect(q)}
              className="text-xs px-3 py-2 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded-full border border-gray-200 dark:border-gray-700 transition-colors"
            >
              {q}
            </button>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
      <p className="text-xs font-medium text-gray-600 dark:text-gray-400 mb-2">
        {t("aiAssistant", "quickQuestions")}
      </p>
      <div className="space-y-1">
        {questions.map((q, idx) => (
          <button
            key={idx}
            onClick={() => onSelect(q)}
            className="w-full text-left text-xs px-2 py-1.5 bg-white dark:bg-gray-800 hover:bg-blue-50 dark:hover:bg-blue-900/30 rounded border border-gray-200 dark:border-gray-700 transition-colors"
          >
            {q}
          </button>
        ))}
      </div>
    </div>
  );
}

function MessageComposer({
  variant,
  input,
  setInput,
  onKeyDown,
  onSend,
  isLoading,
  isHelperMode,
  t,
}) {
  const c = COMPOSER_VARIANTS[variant];
  const placeholder = isHelperMode
    ? t("aiAssistant", c.placeholderHelperKey)
    : t("aiAssistant", c.placeholderKey);

  return (
    <div className={c.wrapperClass || undefined}>
      <div className={c.rowGapClass}>
        <div className="flex-1 relative">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder={placeholder}
            className={c.textareaClass}
            rows={c.rows}
            disabled={isLoading}
          />
          <div className={c.voiceWrapClass}>
            <VoiceInputButton
              onTranscript={(text) =>
                setInput((prev) => (prev ? `${prev} ${text}` : text))
              }
              size={c.voiceSize}
              disabled={isLoading}
            />
          </div>
        </div>
        <button
          onClick={onSend}
          disabled={!input.trim() || isLoading}
          aria-label={
            variant === "docked" ? t("aiAssistant", "sendMessage") : undefined
          }
          className={c.buttonClass}
        >
          <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden={variant === "docked" ? "true" : undefined}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
          {c.showSendLabel && (
            <span className="font-medium">{t("aiAssistant", "send")}</span>
          )}
        </button>
      </div>
      <p className={c.hintClass}>
        {t("aiAssistant", c.hintKey)}{" "}
        {isHelperMode && t("aiAssistant", "helperModeActive")}
      </p>
    </div>
  );
}

function MinimizedButton({ position, isDragging, onRestore, onMouseDown, t }) {
  return (
    <button
      onClick={(_e) => {
        // Only restore if not dragging
        if (!isDragging) {
          onRestore();
        }
      }}
      onMouseDown={onMouseDown}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-700 hover:to-purple-700 text-white rounded-full p-4 shadow-2xl transition-all hover:scale-110 group cursor-move"
      aria-label={t("aiAssistant", "minimizedTooltip")}
    >
      <div className="relative pointer-events-none">
        <span className="text-2xl">🧭</span>
        <span className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-white animate-pulse"></span>
      </div>
      <div className="absolute left-full ml-3 top-1/2 -translate-y-1/2 bg-gray-900 text-white px-3 py-2 rounded-lg text-sm font-medium whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none">
        {t("aiAssistant", "clickToExpand")}
      </div>
    </button>
  );
}

function ExpandedHeader({ onOpenAISettings, onShrink, onClose, t }) {
  return (
    <div className="flex items-center justify-between gap-2 bg-gradient-to-r from-blue-600 to-purple-600 p-4 text-white">
      <div className="flex min-w-0 items-center gap-3">
        <div className="hidden h-12 w-12 items-center justify-center rounded-xl bg-white/20 sm:flex">
          <span className="text-3xl">🧭</span>
        </div>
        <div className="min-w-0">
          <h3
            id="ai-assistant-expanded-title"
            className="truncate text-lg font-bold sm:text-xl"
          >
            {t("aiAssistant", "title")}
          </h3>
          <p className="truncate text-xs text-blue-100 sm:text-sm">
            {t("aiAssistant", "subtitleExpanded")}
          </p>
        </div>
      </div>

      <div className="flex shrink-0 items-center gap-1 sm:gap-2">
        {/* AI Status Button */}
        {onOpenAISettings && (
          <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
            onClick={(e) => e.stopPropagation()}
          >
            <AIStatusBadge
              onClick={onOpenAISettings}
              className="text-sm"
              showLabel={true}
            />
          </div>
        )}
        <button
          onClick={onShrink}
          className="hidden rounded-lg p-2 transition-colors hover:bg-white/20 sm:block"
          aria-label={t("aiAssistant", "shrinkTooltip")}
        >
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
              d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25"
            />
          </svg>
        </button>
        {onClose && (
          <button
            onClick={onClose}
            className="rounded-lg p-2 transition-colors hover:bg-white/20"
            aria-label={t("common", "close")}
          >
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
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

function DockedHeaderIconButton({ onClick, label, d }) {
  return (
    <button
      onClick={onClick}
      className="p-1.5 hover:bg-white/20 rounded transition-colors"
      aria-label={label}
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
          d={d}
        />
      </svg>
    </button>
  );
}

function DockedHeader({ onOpenAISettings, onExpand, onMinimize, onClose, t }) {
  return (
    <div className="drag-handle bg-gradient-to-r from-blue-600 to-purple-600 text-white p-4 rounded-t-xl flex items-center justify-between cursor-move select-none">
      <div className="flex items-center gap-3 pointer-events-none">
        <div className="w-10 h-10 bg-white/20 rounded-lg flex items-center justify-center">
          <span className="text-2xl">🧭</span>
        </div>
        <div>
          <h3 className="font-bold text-lg">{t("aiAssistant", "title")}</h3>
          <p className="text-xs text-blue-100 flex items-center gap-1">
            <svg className="w-3 h-3" fill="currentColor" viewBox="0 0 20 20">
              <path d="M10 6a2 2 0 110-4 2 2 0 010 4zM10 12a2 2 0 110-4 2 2 0 010 4zM10 18a2 2 0 110-4 2 2 0 010 4z" />
            </svg>
            {t("aiAssistant", "dragToMove")}
          </p>
        </div>
      </div>

      <div className="flex items-center gap-2 pointer-events-auto">
        {/* AI Status Button */}
        {onOpenAISettings && (
          <div /* eslint-disable-line jsx-a11y/click-events-have-key-events, jsx-a11y/no-static-element-interactions */
            className="pointer-events-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <AIStatusBadge
              onClick={onOpenAISettings}
              className="text-xs"
              showLabel={false}
            />
          </div>
        )}
        <DockedHeaderIconButton
          onClick={onExpand}
          label={t("aiAssistant", "expandTooltip")}
          d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4"
        />
        <DockedHeaderIconButton
          onClick={onMinimize}
          label={t("aiAssistant", "minimizeTooltip")}
          d="M19 9l-7 7-7-7"
        />
        {onClose && (
          <DockedHeaderIconButton
            onClick={onClose}
            label={t("common", "close")}
            d="M6 18L18 6M6 6l12 12"
          />
        )}
      </div>
    </div>
  );
}

function ExpandedFooter({
  t,
  currentTool,
  isHelperMode,
  messages,
  input,
  setInput,
  isLoading,
  handleSend,
  handleKeyDown,
}) {
  return (
    <div className="space-y-3">
      {/* Quick Questions - Horizontal */}
      {messages.length <= 1 && !isLoading && (
        <QuickQuestions
          variant="expanded"
          questions={getQuickQuestions(t, currentTool)}
          onSelect={setInput}
          t={t}
        />
      )}

      {/* Input - Larger in expanded mode */}
      <MessageComposer
        variant="expanded"
        input={input}
        setInput={setInput}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        isLoading={isLoading}
        isHelperMode={isHelperMode}
        t={t}
      />
    </div>
  );
}

function ExpandedView({
  t,
  currentTool,
  isHelperMode,
  onClose,
  onOpenAISettings,
  onShrink,
  messages,
  input,
  setInput,
  isLoading,
  handleSend,
  handleKeyDown,
  copiedMessageIdx,
  summaryStates,
  handleCopyMessage,
  handleSummarize,
  messagesEndRef,
}) {
  const header = (
    <ExpandedHeader
      onOpenAISettings={onOpenAISettings}
      onShrink={onShrink}
      onClose={onClose}
      t={t}
    />
  );

  const footer = (
    <ExpandedFooter
      t={t}
      currentTool={currentTool}
      isHelperMode={isHelperMode}
      messages={messages}
      input={input}
      setInput={setInput}
      isLoading={isLoading}
      handleSend={handleSend}
      handleKeyDown={handleKeyDown}
    />
  );

  return (
    <ResponsiveModal
      isOpen
      onClose={onClose || onShrink}
      header={header}
      footer={footer}
      labelledBy="ai-assistant-expanded-title"
      size="xl"
    >
      <div
        className="space-y-4"
        role="log"
        aria-live="polite"
        aria-relevant="additions"
        aria-label={t("aiAssistant", "conversationLabel")}
      >
        <MessageList
          messages={messages}
          variant="expanded"
          isLoading={isLoading}
          copiedMessageIdx={copiedMessageIdx}
          summaryStates={summaryStates}
          onCopy={handleCopyMessage}
          onSummarize={handleSummarize}
          t={t}
          messagesEndRef={messagesEndRef}
        />
      </div>
    </ResponsiveModal>
  );
}

function DockedMessagesPanel({
  t,
  messages,
  isLoading,
  copiedMessageIdx,
  summaryStates,
  handleCopyMessage,
  handleSummarize,
  messagesEndRef,
}) {
  return (
    <div
      className="flex-1 overflow-y-auto p-4 space-y-4"
      role="log"
      aria-live="polite"
      aria-relevant="additions"
      aria-label={t("aiAssistant", "conversationLabel")}
    >
      <MessageList
        messages={messages}
        variant="docked"
        isLoading={isLoading}
        copiedMessageIdx={copiedMessageIdx}
        summaryStates={summaryStates}
        onCopy={handleCopyMessage}
        onSummarize={handleSummarize}
        t={t}
        messagesEndRef={messagesEndRef}
      />
    </div>
  );
}

function DockedView({
  t,
  currentTool,
  isHelperMode,
  onClose,
  onOpenAISettings,
  onExpand,
  onMinimize,
  position,
  containerRef,
  handleMouseDown,
  messages,
  input,
  setInput,
  isLoading,
  handleSend,
  handleKeyDown,
  copiedMessageIdx,
  summaryStates,
  handleCopyMessage,
  handleSummarize,
  messagesEndRef,
}) {
  return (
    <div /* eslint-disable-line jsx-a11y/no-static-element-interactions */
      id="tour-ai-navigator-expanded"
      ref={containerRef}
      style={{ left: `${position.x}px`, top: `${position.y}px` }}
      className="fixed z-50 w-96 h-[600px] bg-white dark:bg-gray-800 rounded-xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col"
      onMouseDown={handleMouseDown}
    >
      {/* Header */}
      <DockedHeader
        onOpenAISettings={onOpenAISettings}
        onExpand={onExpand}
        onMinimize={onMinimize}
        onClose={onClose}
        t={t}
      />

      {/* Messages */}
      <DockedMessagesPanel
        t={t}
        messages={messages}
        isLoading={isLoading}
        copiedMessageIdx={copiedMessageIdx}
        summaryStates={summaryStates}
        handleCopyMessage={handleCopyMessage}
        handleSummarize={handleSummarize}
        messagesEndRef={messagesEndRef}
      />

      {/* Quick Questions */}
      {messages.length <= 1 && !isLoading && (
        <QuickQuestions
          variant="docked"
          questions={getQuickQuestions(t, currentTool)}
          onSelect={setInput}
          t={t}
        />
      )}

      {/* Input */}
      <MessageComposer
        variant="docked"
        input={input}
        setInput={setInput}
        onKeyDown={handleKeyDown}
        onSend={handleSend}
        isLoading={isLoading}
        isHelperMode={isHelperMode}
        t={t}
      />
    </div>
  );
}

const AIAssistant = ({ currentTool = "Home", onClose, onOpenAISettings }) => {
  const { t } = useLanguage();
  const { isHelperMode } = useHelperMode();
  const veteranContext = useVeteranContext();

  const [isMinimized, setIsMinimized] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false); // New: expanded modal view

  const { position, isDragging, handleMouseDown, containerRef } =
    useDraggablePosition(isMinimized);
  const messagesEndRef = useRef(null);

  const { messages, input, setInput, isLoading, handleSend, handleKeyDown } =
    useNavigatorConversation({
      currentTool,
      isHelperMode,
      veteranContext,
      t,
      onClose,
      messagesEndRef,
    });

  const {
    copiedMessageIdx,
    summaryStates,
    handleCopyMessage,
    handleSummarize,
  } = useMessageActions();

  if (isMinimized) {
    return (
      <MinimizedButton
        position={position}
        isDragging={isDragging}
        onRestore={() => setIsMinimized(false)}
        onMouseDown={handleMouseDown}
        t={t}
      />
    );
  }

  const sharedViewProps = {
    t,
    currentTool,
    isHelperMode,
    onClose,
    onOpenAISettings,
    messages,
    input,
    setInput,
    isLoading,
    handleSend,
    handleKeyDown,
    copiedMessageIdx,
    summaryStates,
    handleCopyMessage,
    handleSummarize,
    messagesEndRef,
  };

  // Expanded full-screen modal view
  if (isExpanded) {
    return (
      <ExpandedView
        {...sharedViewProps}
        onShrink={() => setIsExpanded(false)}
      />
    );
  }

  return (
    <DockedView
      {...sharedViewProps}
      onExpand={() => setIsExpanded(true)}
      onMinimize={() => setIsMinimized(true)}
      position={position}
      containerRef={containerRef}
      handleMouseDown={handleMouseDown}
    />
  );
};

export default AIAssistant;
