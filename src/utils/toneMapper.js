/**
 * Vet-Rate.org - Tone Mapper
 * Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * 🎭 Compassionate Tone Transformation System
 *
 * Transforms cold, clinical VA jargon into warm, veteran-friendly "Vet-Speak"
 * for the voice engine. This is the heart of the compassionate peer experience.
 */

import toneMap from "../config/toneMap.json";
import multilingualTone from "../config/multilingualTone.json";

/**
 * Apply compassionate tone transformation to text
 * @param {string} text - Raw text from LLM
 * @param {string} sourceModel - Source model (AUDITOR, SCRIBE, RATER)
 * @param {string} langCode - Language code (en, es, tl, vi, ko)
 * @param {string} branch - Military branch for honorific
 * @returns {string} - Transformed text ready for speech
 */
export const applyCompassionateTone = (
  text,
  sourceModel = "GENERAL",
  langCode = "en",
  branch = null,
) => {
  if (!text) return "";

  let processedText = text;

  // 1. Replace technical terms with spoken replacements
  toneMap.mappings.forEach((mapping) => {
    const regex = new RegExp(
      `\\b${escapeRegex(mapping.technical_term)}\\b`,
      "gi",
    );
    processedText = processedText.replace(regex, mapping.spoken_replacement);
  });

  // 2. Clean up legal citations for speech
  processedText = cleanCitationsForSpeech(processedText);

  // 3. Clean up abbreviations
  processedText = expandAbbreviationsForSpeech(processedText);

  // 4. Remove symbols that sound awkward when spoken
  processedText = cleanSymbolsForSpeech(processedText);

  // 5. Add conversational anchors based on model
  const starter = getModelStarter(sourceModel);

  // 6. Add branch honorific if applicable
  const honorific = branch ? getBranchHonorific(branch, langCode) : "";

  // Combine: honorific + starter + processed text
  return `${honorific} ${starter} ${processedText}`.trim();
};

/**
 * Escape special regex characters
 * @param {string} str - String to escape
 * @returns {string}
 */
const escapeRegex = (str) => {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
};

/**
 * Clean legal citations for natural speech
 * @param {string} text
 * @returns {string}
 */
const cleanCitationsForSpeech = (text) => {
  let cleaned = text;

  // § → "Section"
  cleaned = cleaned.replace(/§\s*/g, "Section ");

  // 38 CFR § 3.309 → "Section 3 point 3 0 9 of the VA regulations"
  cleaned = cleaned.replace(
    /38\s*CFR\s*§?\s*(\d+)\.(\d+)/gi,
    (match, part, section) =>
      `Section ${part} point ${section.split("").join(" ")} of the VA regulations`,
  );

  // Handle remaining section numbers like "(a)(1)(i)"
  cleaned = cleaned.replace(/\([a-z]\)\(\d+\)\([ivxlcdm]+\)/gi, "");
  cleaned = cleaned.replace(/\([a-z]\)\(\d+\)/gi, "");
  cleaned = cleaned.replace(/\([ivxlcdm]+\)/gi, "");

  return cleaned;
};

/**
 * Expand abbreviations for natural speech
 * @param {string} text
 * @returns {string}
 */
const expandAbbreviationsForSpeech = (text) => {
  const abbreviations = {
    VA: "V-A",
    MOS: "M-O-S",
    DD214: "D-D 2-1-4",
    TDIU: "T-D-I-U",
    SMC: "S-M-C",
    BVA: "Board of Veterans Appeals",
    DRO: "decision review officer",
    FDC: "fully developed claim",
    HLR: "higher level review",
    CUE: "clear and unmistakable error",
    ROM: "range of motion",
    TBI: "T-B-I",
    PTSD: "P-T-S-D",
    MST: "military sexual trauma",
    IMO: "independent medical opinion",
    ACE: "acceptable clinical evidence",
    DBQ: "D-B-Q",
    eCFR: "electronic code of federal regulations",
    PACT: "PACT",
  };

  let processed = text;

  Object.entries(abbreviations).forEach(([abbr, expansion]) => {
    const regex = new RegExp(`\\b${abbr}\\b`, "g");
    processed = processed.replace(regex, expansion);
  });

  return processed;
};

/**
 * Clean symbols that sound awkward when spoken
 * @param {string} text
 * @returns {string}
 */
const cleanSymbolsForSpeech = (text) => {
  let cleaned = text;

  // Percentages: 70% → "70 percent"
  cleaned = cleaned.replace(/(\d+)%/g, "$1 percent");

  // Bullets and special characters
  cleaned = cleaned.replace(/[•·◦▪►→←↑↓]/g, "");

  // Multiple spaces
  cleaned = cleaned.replace(/\s+/g, " ");

  // Remove markdown-style formatting
  cleaned = cleaned.replace(/\*\*/g, "");
  cleaned = cleaned.replace(/\*/g, "");
  cleaned = cleaned.replace(/#+ /g, "");

  return cleaned.trim();
};

/**
 * Get a conversational starter based on model type
 * @param {string} model - AUDITOR, SCRIBE, RATER, DKB, GENERAL
 * @returns {string}
 */
const getModelStarter = (model) => {
  const modelKey = model?.toLowerCase() || "general";
  const starters =
    toneMap.phrase_starters[modelKey] || toneMap.phrase_starters.general;

  // Return random starter for variety
  return starters[Math.floor(Math.random() * starters.length)];
};

/**
 * Get branch-specific honorific
 * @param {string} branch - Marine, Army, Navy, Air Force, Coast Guard, Space Force
 * @param {string} langCode - Language code
 * @returns {string}
 */
export const getBranchHonorific = (branch, langCode = "en") => {
  const branchKey = capitalizeFirst(branch);
  const honorifics =
    toneMap.branch_honorifics[branchKey] || toneMap.branch_honorifics.default;
  return honorifics[langCode] || honorifics.en || "";
};

/**
 * Capitalize first letter
 * @param {string} str
 * @returns {string}
 */
const capitalizeFirst = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

/**
 * Get a random validation phrase for empathy
 * @returns {string}
 */
export const getValidationPhrase = () => {
  const phrases = toneMap.validation_phrases;
  return phrases[Math.floor(Math.random() * phrases.length)];
};

/**
 * Get check-in phrase for specific context
 * @param {string} context - heavy_topic, after_denial, idle, long_session, sensitive_content
 * @returns {string}
 */
export const getCheckInPhrase = (context) => {
  return toneMap.check_in_phrases[context] || toneMap.check_in_phrases.idle;
};

/**
 * Get closing phrase for model
 * @param {string} model - AUDITOR, SCRIBE, RATER, GENERAL
 * @returns {string}
 */
export const getClosingPhrase = (model) => {
  const key = model?.toLowerCase() || "general";
  return toneMap.closing_phrases[key] || toneMap.closing_phrases.general;
};

/**
 * Translate technical term to spoken form in target language
 * @param {string} term - Technical term
 * @param {string} langCode - Language code
 * @returns {string}
 */
export const translateTerm = (term, langCode = "en") => {
  const langData = multilingualTone.languages[langCode];
  if (!langData || !langData.terms) return term;

  const termKey = term.toLowerCase().replace(/[^a-z_]/g, "_");
  return langData.terms[termKey] || term;
};

/**
 * Get support phrase in target language
 * @param {string} phraseKey - greeting, working, found, validation, encouragement, closing
 * @param {string} langCode - Language code
 * @returns {string}
 */
export const getSupportPhrase = (phraseKey, langCode = "en") => {
  const langData = multilingualTone.languages[langCode];
  if (!langData || !langData.support_phrases) {
    return multilingualTone.languages.en.support_phrases[phraseKey] || "";
  }
  return langData.support_phrases[phraseKey] || "";
};

/**
 * Get branch greeting in target language
 * @param {string} branch - Military branch
 * @param {string} langCode - Language code
 * @returns {string}
 */
export const getBranchGreeting = (branch, langCode = "en") => {
  const branchKey = capitalizeFirst(branch);
  const greetings = multilingualTone.branch_greetings[branchKey];
  if (!greetings) return "";
  return greetings[langCode] || greetings.en || "";
};

/**
 * Get auditor explanation in target language
 * @param {string} explanationType - lack_of_nexus, missing_evidence, presumptive_eligible
 * @param {string} langCode - Language code
 * @returns {string}
 */
export const getAuditorExplanation = (explanationType, langCode = "en") => {
  const explanations = multilingualTone.auditor_explanations[langCode];
  if (!explanations) return "";
  return explanations[explanationType] || "";
};

/**
 * Get privacy promise in target language
 * @param {string} langCode - Language code
 * @returns {string}
 */
export const getPrivacyPromise = (langCode = "en") => {
  return (
    multilingualTone.privacy_promise[langCode] ||
    multilingualTone.privacy_promise.en
  );
};

/**
 * Get speech recognition language code
 * @param {string} langCode - Our internal language code
 * @returns {string} - Browser-compatible language code
 */
export const getSpeechRecognitionLang = (langCode = "en") => {
  return multilingualTone.speech_recognition_lang_codes[langCode] || "en-US";
};

/**
 * Check if text contains crisis keywords in any supported language
 * @param {string} text - Text to check
 * @returns {Object} - { detected: boolean, language: string|null }
 */
export const detectMultilingualCrisis = (text) => {
  if (!text) return { detected: false, language: null };

  const normalizedText = text.toLowerCase();

  for (const [langCode, keywords] of Object.entries(
    multilingualTone.crisis_keywords,
  )) {
    for (const keyword of keywords) {
      if (normalizedText.includes(keyword.toLowerCase())) {
        return { detected: true, language: langCode };
      }
    }
  }

  return { detected: false, language: null };
};

/**
 * Format text for bilingual display (native + English)
 * @param {string} nativeText - Text in native language
 * @param {string} englishText - Text in English
 * @returns {Object} - { native, english, combined }
 */
export const formatBilingualText = (nativeText, englishText) => {
  return {
    native: nativeText,
    english: englishText,
    combined: `${nativeText}\n\n---\n\n${englishText}`,
  };
};

export default {
  applyCompassionateTone,
  getBranchHonorific,
  getValidationPhrase,
  getCheckInPhrase,
  getClosingPhrase,
  translateTerm,
  getSupportPhrase,
  getBranchGreeting,
  getAuditorExplanation,
  getPrivacyPromise,
  getSpeechRecognitionLang,
  detectMultilingualCrisis,
  formatBilingualText,
};
