/**
 * Vet-Rate.org - Crisis Interceptor
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * SAFETY-CRITICAL SYSTEM: This interceptor detects self-harm language
 * and prevents AI engagement, redirecting to immediate human crisis support.
 *
 * This is not a "nice to have" - this is a lifesaving feature.
 */

import { detectMultilingualCrisis } from "./toneMapper";

// AIS-04: leet/obfuscation normalization so the English regexes below don't miss
// "w4nt to die", "iwanttodie", "k.m.s", etc. Collapse common leetspeak to letters;
// the caller then strips non-alphanumerics before matching compact phrases.
const leetNormalize = (s) =>
  s
    .toLowerCase()
    .replaceAll(/[@4]/g, "a")
    .replaceAll("0", "o")
    .replaceAll(/[1!|]/g, "i")
    .replaceAll("3", "e")
    .replaceAll(/[5$]/g, "s")
    .replaceAll("7", "t");

// Unambiguous self-harm phrases, matched after leet-normalize + stripping ALL
// non-alphanumerics — catches no-space / punctuated obfuscation the spaced regexes
// miss. (The spaced forms are already caught above, so these add no new false-positive
// class — only their obfuscated variants.)
const COMPACT_CRISIS_PHRASES = [
  "killmyself",
  "iwanttodie",
  "wanttodie",
  "endmylife",
  "endingmylife",
  "betteroffdead",
  "wishiwasdead",
  "wishiweredead",
  "noreasontolive",
  "neckmyself",
  "deletemyself",
  "unalivemyself",
];

/**
 * Crisis keyword patterns - matches both direct and indirect language
 * Organized by severity for potential future triage logic
 */
const CRISIS_PATTERNS = {
  // CRITICAL: Direct self-harm intent
  critical: [
    /\b(kill|end|take)\s+(my|own)\s+(life|self)\b/i,
    /\bcommit\s+suicide\b/i,
    /\bsuicide\s+plan\b/i,
    /\bhurt\s+myself\b/i,
    /\bkill\s+myself\b/i,
    /\bend\s+it\s+all\b/i,
    /\bbetter\s+off\s+dead\b/i,
    /\bwant\s+to\s+die\b/i,
    /\bwish\s+I\s+(was|were)\s+dead\b/i,
    /\bno\s+reason\s+to\s+(live|keep going)\b/i,
    /\bcan'?t\s+(take\s+it|go\s+on)\s+anymore\b/i,
    /\bworld\s+(is\s+)?better\s+without\s+me\b/i,
    /\bsayonara\b.*\bworld\b/i,
    /\bfinal\s+goodbye\b/i,
    /\bending\s+my\s+life\b/i,
  ],

  // HIGH: Suicidal ideation or planning
  high: [
    // AIS-04: modern self-harm slang, word-bounded to avoid false positives
    // (e.g. "20 kms" of distance does not match /\bkms\b/ inside "20kms").
    /\bunalive\b/i,
    /\bkms\b/i,
    /\bsuicidal\s+(thought|idea)/i,
    /\bthink(ing)?\s+about\s+(death|dying|suicide)\b/i,
    /\b(gun|pills?|rope|bridge|jump|overdose)\b.*\b(plan|method|way out)\b/i,
    /\bwriting\s+(a\s+)?suicide\s+note\b/i,
    /\bsay\s+goodbye\s+to\s+everyone\b/i,
    /\bfamily\s+without\s+me\b/i,
    /\bburden\s+to\s+(everyone|my family)\b/i,
    /\bnothing\s+(left|to live for)\b/i,
    /\bpermanent\s+solution\b/i,
    /\bonly\s+way\s+out\b/i,
  ],

  // MEDIUM: Severe distress indicators
  medium: [
    /\bcan'?t\s+take\s+(this|the pain)\s+anymore\b/i,
    /\bwant\s+the\s+pain\s+to\s+stop\b/i,
    /\bno\s+hope\b/i,
    /\beveryone\s+would\s+be\s+better\s+off\b/i,
    /\bgiving\s+up\b/i,
    /\bworthless\b/i,
    /\bfailed\s+at\s+everything\b/i,
    /\bpoint\s+of\s+no\s+return\b/i,
  ],
};

/**
 * Veterans Crisis Line Contact Information
 * Primary: 988 then Press 1
 * Text: 838255
 * Chat: VeteransCrisisLine.net/Chat
 */
export const CRISIS_RESOURCES = {
  phone: {
    primary: "988",
    extension: "1",
    display: "Dial 988, then Press 1",
    tel: "tel:988",
  },
  text: {
    number: "838255",
    display: "Text 838255",
  },
  chat: {
    url: "https://www.veteranscrisisline.net/get-help-now/chat/",
    display: "Chat at VeteransCrisisLine.net",
  },
  international: {
    phone: "+1-800-273-8255",
    display: "+1-800-273-8255 (International)",
  },
};

/**
 * Scan text for crisis indicators
 * @param {string} text - User input to analyze
 * @returns {Object} - { isCrisis: boolean, severity: string|null, matchedPattern: string|null }
 */
export function detectCrisisLanguage(text) {
  if (!text || typeof text !== "string") {
    return { isCrisis: false, severity: null, matchedPattern: null };
  }

  // Normalize text for detection
  const normalizedText = text.toLowerCase().trim();

  // Check critical patterns first
  for (const pattern of CRISIS_PATTERNS.critical) {
    if (pattern.test(normalizedText)) {
      return {
        isCrisis: true,
        severity: "critical",
        matchedPattern: pattern.toString(),
      };
    }
  }

  // Check high-severity patterns
  for (const pattern of CRISIS_PATTERNS.high) {
    if (pattern.test(normalizedText)) {
      return {
        isCrisis: true,
        severity: "high",
        matchedPattern: pattern.toString(),
      };
    }
  }

  // Check medium-severity patterns
  for (const pattern of CRISIS_PATTERNS.medium) {
    if (pattern.test(normalizedText)) {
      return {
        isCrisis: true,
        severity: "medium",
        matchedPattern: pattern.toString(),
      };
    }
  }

  // AIS-04: obfuscation pass — leet-normalize + strip non-alphanumerics, then match
  // compact self-harm phrases the spaced English regexes miss ("iwanttodie",
  // "w4nt to die", "k.m.s." etc.).
  const compact = leetNormalize(normalizedText).replaceAll(/[^a-z0-9]/g, "");
  for (const phrase of COMPACT_CRISIS_PHRASES) {
    if (compact.includes(phrase)) {
      return {
        isCrisis: true,
        severity: "high",
        matchedPattern: `compact:${phrase}`,
      };
    }
  }

  // AIS-04: multilingual pass — crisis keywords in non-English languages, so a
  // non-English veteran is not silently dropped by the English-only regexes. We
  // ignore the keyword set's broad English "universal" list (e.g. "no point",
  // "end it") to avoid over-triggering the modal on English text — the precise
  // CRISIS_PATTERNS above already handle English.
  const multilingual = detectMultilingualCrisis(text);
  if (multilingual.detected && multilingual.language !== "universal") {
    return {
      isCrisis: true,
      severity: "high",
      matchedPattern: `multilingual:${multilingual.language}`,
    };
  }

  return { isCrisis: false, severity: null, matchedPattern: null };
}

/**
 * Pre-flight check before ANY AI API call
 * This MUST be called before sending text to external AI services
 *
 * @param {string|Object} userInput - Text or form data to check
 * @returns {Object} - { shouldBlock: boolean, crisisDetected: boolean, severity: string|null }
 */
export function interceptBeforeAICall(userInput) {
  let textToCheck = "";

  // Handle different input types
  if (typeof userInput === "string") {
    textToCheck = userInput;
  } else if (typeof userInput === "object" && userInput !== null) {
    // Concatenate all string values from object (form answers)
    textToCheck = Object.values(userInput)
      .filter((val) => typeof val === "string")
      .join(" ");
  }

  const result = detectCrisisLanguage(textToCheck);

  return {
    shouldBlock: result.isCrisis,
    crisisDetected: result.isCrisis,
    severity: result.severity,
    matchedPattern: result.matchedPattern,
  };
}

/**
 * Get user-friendly message based on severity
 */
export function getCrisisMessage(severity) {
  const messages = {
    critical:
      "We detected language that suggests you may be in immediate crisis. Your safety is our priority.",
    high: "We noticed you may be experiencing thoughts of self-harm. You are not alone.",
    medium:
      "We see you are going through a difficult time. Help is available right now.",
  };

  return messages[severity] || messages.medium;
}
