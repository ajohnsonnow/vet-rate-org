/**
 * Vet-Rate.org - Reddit Auto-Summarizer
 * "The Squared Away Standard" - Intent-aware summarization
 *
 * Automatically detects verbose AI responses and generates Reddit-style
 * BLUF summaries. Also detects when user explicitly requests summary format.
 *
 * @author Vet-Rate.org Development Team
 * @version 1.0.0
 */

import { generateAI } from "./unifiedAIService";
import { REDDIT_SUMMARY_PROMPT, SUMMARY_TRIGGERS } from "./redditPrompts";

// Word count threshold - if response exceeds this, auto-summarize
const WORD_COUNT_THRESHOLD = 300;

/**
 * Intelligent Summarizer: Checks response length OR user intent.
 * If either condition is met, generates a Reddit-style BLUF summary.
 *
 * @param {string} originalResponse - The raw output from the AI model
 * @param {string} userPrompt - The user's original message (to check intent)
 * @param {Object} options - Additional options
 * @param {boolean} options.forceSummary - Force summary generation regardless of length
 * @param {number} options.threshold - Custom word count threshold
 * @returns {Promise<Object>} Returns { fullText, summary, hasSummary, isExplicit }
 */
export const autoSummarizeIfLong = async (
  originalResponse,
  userPrompt = "",
  options = {},
) => {
  const { forceSummary = false, threshold = WORD_COUNT_THRESHOLD } = options;

  // Fallback if no response
  if (!originalResponse || typeof originalResponse !== "string") {
    return {
      fullText: originalResponse || "",
      summary: null,
      hasSummary: false,
      isExplicit: false,
    };
  }

  // 1. Check for Explicit Intent (User ASKED for Reddit format)
  const isExplicitRequest = SUMMARY_TRIGGERS.some((trigger) =>
    trigger.test(userPrompt),
  );

  // 2. Check for Implicit Need (Response is too long)
  const wordCount = originalResponse.trim().split(/\s+/).length;
  const isTooLong = wordCount > threshold;

  // Decision: Do we summarize?
  const shouldSummarize = forceSummary || isExplicitRequest || isTooLong;

  if (!shouldSummarize) {
    return {
      fullText: originalResponse,
      summary: null,
      hasSummary: false,
      isExplicit: false,
    };
  }

  // 3. Trigger the AI for summary generation
  try {
    const reason = isExplicitRequest
      ? "Explicit Request"
      : isTooLong
        ? "Length Check"
        : "Forced";
    // eslint-disable-next-line no-console
    console.log(`📋 Reddit Summary Triggered: ${reason} (${wordCount} words)`);

    const summary = await generateAI(REDDIT_SUMMARY_PROMPT(originalResponse), {
      systemPrompt: isExplicitRequest
        ? "The user specifically asked for a Reddit-style summary. Format this with proper Reddit markdown, BLUF format, and preserve all citations."
        : "Generate a concise Reddit-style summary with BLUF format. Preserve all CFR citations and diagnostic codes.",
      taskType: "summarization",
      skipCrisisCheck: true, // Already checked on original
      maxTokens: 500, // Keep summaries tight
      temperature: 0.3, // Lower temp for consistent formatting
    });

    // Extract just the text if generateAI returns an object
    const summaryText = typeof summary === "object" ? summary.text : summary;

    return {
      fullText: originalResponse,
      summary: summaryText,
      hasSummary: true,
      isExplicit: isExplicitRequest,
      wordCount,
      reason,
    };
  } catch (error) {
    console.warn("❌ Auto-summary failed:", error);
    // Graceful degradation - return original without summary
    return {
      fullText: originalResponse,
      summary: null,
      hasSummary: false,
      isExplicit: false,
      error: error.message,
    };
  }
};

/**
 * Check if a text should be summarized (without actually summarizing)
 * Useful for UI to show "Summary available" indicator
 *
 * @param {string} text - The text to check
 * @param {string} userPrompt - The user's original prompt
 * @returns {Object} { shouldSummarize, reason, wordCount }
 */
export const checkShouldSummarize = (text, userPrompt = "") => {
  if (!text || typeof text !== "string") {
    return { shouldSummarize: false, reason: null, wordCount: 0 };
  }

  const isExplicitRequest = SUMMARY_TRIGGERS.some((trigger) =>
    trigger.test(userPrompt),
  );
  const wordCount = text.trim().split(/\s+/).length;
  const isTooLong = wordCount > WORD_COUNT_THRESHOLD;

  return {
    shouldSummarize: isExplicitRequest || isTooLong,
    reason: isExplicitRequest ? "explicit" : isTooLong ? "length" : null,
    wordCount,
    threshold: WORD_COUNT_THRESHOLD,
  };
};

/**
 * Simple word count utility
 * @param {string} text - Text to count
 * @returns {number} Word count
 */
export const getWordCount = (text) => {
  if (!text || typeof text !== "string") return 0;
  return text.trim().split(/\s+/).filter(Boolean).length;
};

export default {
  autoSummarizeIfLong,
  checkShouldSummarize,
  getWordCount,
  WORD_COUNT_THRESHOLD,
};
