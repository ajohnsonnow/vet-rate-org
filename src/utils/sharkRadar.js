/**
 * Vet-Rate.org - Shark Radar (Contract Scanner)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 *
 * AI-powered contract scanner that detects predatory practices
 * targeting veterans based on 38 U.S.C. § 5901 and 38 CFR § 14.636.
 *
 * Updated: Now uses Unified AI Service for seamless Cloud/Local AI switching
 */

import {
  generateAI,
  isAnyAIAvailable,
  getAIStatus,
  AI_MODES,
} from "./unifiedAIService";

// The specialized system prompt for contract analysis
const SHARK_RADAR_SYSTEM_PROMPT = `You are a VA Compliance Auditor and Legal Contract Analyst. Your job is to scan text (contracts, emails, or marketing copy) for predatory practices targeting veterans.

INPUT: User-provided text from a "VA Claim Consulting" firm.

YOUR GOAL: Detect specific "Red Flags" based on 38 U.S.C. § 5901 and 38 CFR § 14.636.

CRITERIA FOR RED FLAGS:
1. UNACCREDITED FEES: Charging fees for initial claims (illegal). Only VA-accredited attorneys or claims agents may charge fees, and only AFTER an initial claim decision.
2. FUTURE BENEFITS: Demanding a percentage of future monthly checks (illegal assignment of benefits). Veterans cannot legally assign future VA benefits.
3. EXORBITANT FEES: Fees exceeding 20-33% of backpay, or lump sums like "5x the increase" or flat fees of $5,000+.
4. LOGIN ACCESS: Asking for the veteran's VA.gov, eBenefits, or ID.me passwords (major security violation and identity theft risk).
5. GUARANTEES: Promising specific ratings or results like "guaranteed 100%" or "we never lose" (unethical and deceptive).
6. PRESSURE TACTICS: Limited time offers, fear of missing out, or "act now" language.
7. MEDICAL CLAIMS: Claiming to diagnose or provide medical opinions without being licensed physicians.
8. UPFRONT PAYMENTS: Requiring large upfront payments before any work is done.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object. No markdown, no code blocks, just pure JSON.

{
  "risk_level": "SAFE|CAUTION|PREDATORY",
  "score": 0-100,
  "flags": [
    {
      "trigger_text": "The specific phrase found in the text",
      "violation": "Short explanation (e.g., 'Illegal Fee Structure', 'Security Risk')",
      "severity": "HIGH|MEDIUM|LOW",
      "legal_reference": "Relevant law or regulation if applicable",
      "advice": "One sentence on why this is dangerous."
    }
  ],
  "positive_signs": [
    "List any legitimate practices found (e.g., 'Mentions VA accreditation', 'No upfront fees')"
  ],
  "verdict_summary": "A 2-3 sentence summary of whether the user should sign this or run away.",
  "recommendation": "PROCEED_WITH_CAUTION|SEEK_SECOND_OPINION|DO_NOT_SIGN|RUN"
}

SCORING GUIDE:
- 0-25: SAFE - Standard legitimate practices
- 26-50: CAUTION - Some concerning language, needs review
- 51-75: CAUTION - Multiple red flags, high risk
- 76-100: PREDATORY - Clear violations, do not sign

TONE: Urgent, protective, and factual. You are protecting veterans from financial predators.

CRITICAL: If the text appears to be from a VA-accredited attorney or claims agent with proper disclosures, note this as a positive sign but still flag any concerning terms.`;

// --- Offline pattern-match fallback (A1-035) ---
// Covers the 8 red-flag categories from the system prompt; used when no AI is loaded.

const SHARK_PATTERNS = [
  {
    patterns: [
      /we charge.*initial claim/i,
      /upfront fee/i,
      /pay.*before.*decision/i,
      /\$\d{3,}.*before/i,
      /non-refundable.*fee/i,
      /consultation fee/i,
    ],
    violation: "Illegal Upfront Fee",
    severity: "HIGH",
    legal_reference: "38 U.S.C. § 5901; 38 CFR § 14.636",
    advice:
      "Accredited representatives cannot charge fees before an initial claim decision is issued.",
  },
  {
    patterns: [
      /\d{1,2}%.*monthly.*benefit/i,
      /percentage.*future.*check/i,
      /portion.*monthly payment/i,
      /cut.*your.*benefits/i,
      /assign.*future.*benefit/i,
    ],
    violation: "Illegal Assignment of Future Benefits",
    severity: "HIGH",
    legal_reference: "38 U.S.C. § 5301",
    advice:
      "Veterans cannot legally assign future VA benefit payments to any third party.",
  },
  {
    patterns: [
      /guaranteed 100%/i,
      /guarantee.*rating/i,
      /we never lose/i,
      /100% success rate/i,
      /guarantee.*approval/i,
      /guaranteed results/i,
    ],
    violation: "Fraudulent Guarantee",
    severity: "HIGH",
    legal_reference: "38 CFR § 14.636(g)",
    advice:
      "No representative can guarantee a specific rating or outcome — such claims are deceptive.",
  },
  {
    patterns: [
      /send.*password/i,
      /login.*credentials/i,
      /va\.gov.*password/i,
      /ebenefits.*login/i,
      /id\.me.*password/i,
      /access.*your.*account/i,
      /share.*your.*credentials/i,
    ],
    violation: "Credential/Password Request (Identity Theft Risk)",
    severity: "HIGH",
    legal_reference: "VA Security Policy",
    advice:
      "Never share VA.gov, eBenefits, or ID.me passwords. This is a major identity theft risk.",
  },
  {
    patterns: [
      /5x.*increase/i,
      /five times.*increase/i,
      /\$5,000.*flat/i,
      /\$10,000.*fee/i,
      /33%.*backpay/i,
      /40%.*backpay/i,
      /50%.*backpay/i,
    ],
    violation: "Exorbitant Fee Structure",
    severity: "HIGH",
    legal_reference: "38 CFR § 14.636(h)",
    advice:
      "Fees exceeding 20–33% of back-pay or large flat fees are typically unreasonable.",
  },
  {
    patterns: [
      /act now/i,
      /limited time offer/i,
      /offer expires/i,
      /don.t miss out/i,
      /only \d+ spots/i,
      /deadline.*today/i,
    ],
    violation: "High-Pressure Sales Tactics",
    severity: "MEDIUM",
    legal_reference: "38 CFR § 14.636(g)",
    advice:
      "Artificial urgency is a pressure tactic to prevent veterans from seeking independent advice.",
  },
  {
    patterns: [
      /diagnose.*your/i,
      /medical opinion.*we/i,
      /our doctor.*will/i,
      /nexus letter.*included/i,
      /we.*write.*nexus/i,
    ],
    violation: "Unlicensed Medical Claims",
    severity: "MEDIUM",
    legal_reference: "State Medical Practice Acts",
    advice:
      "Only licensed physicians can provide medical opinions or nexus letters.",
  },
  {
    patterns: [
      /not accredited/i,
      /no va accreditation/i,
      /we are not.*accredited/i,
    ],
    violation: "Unaccredited Representative",
    severity: "HIGH",
    legal_reference: "38 U.S.C. § 5901",
    advice:
      "Only VA-accredited attorneys or claims agents may charge fees for claims assistance.",
  },
];

const POSITIVE_PATTERNS = [
  { pattern: /va-accredited/i, sign: "Mentions VA accreditation" },
  {
    pattern: /accredited.*attorney/i,
    sign: "Identifies as VA-accredited attorney",
  },
  { pattern: /no upfront fee/i, sign: "Explicitly states no upfront fees" },
  { pattern: /free.*consultation/i, sign: "Offers free consultation" },
  {
    pattern: /only charge.*after.*decision/i,
    sign: "Correctly notes fees apply only after initial decision",
  },
];

function patternMatchContract(text) {
  const flags = [];
  const positives = [];
  const lower = text.toLowerCase();

  for (const category of SHARK_PATTERNS) {
    for (const pattern of category.patterns) {
      const match = text.match(pattern);
      if (match) {
        flags.push({
          trigger_text: match[0],
          violation: category.violation,
          severity: category.severity,
          legal_reference: category.legal_reference,
          advice: category.advice,
        });
        break; // one flag per category
      }
    }
  }

  for (const { pattern, sign } of POSITIVE_PATTERNS) {
    if (pattern.test(lower)) positives.push(sign);
  }

  const highCount = flags.filter((f) => f.severity === "HIGH").length;
  const score = Math.min(
    100,
    highCount * 25 + flags.filter((f) => f.severity === "MEDIUM").length * 10,
  );
  const risk_level =
    score >= 50 ? "PREDATORY" : score >= 25 ? "CAUTION" : "SAFE";
  const recommendation =
    score >= 75
      ? "RUN"
      : score >= 50
        ? "DO_NOT_SIGN"
        : score >= 25
          ? "SEEK_SECOND_OPINION"
          : "PROCEED_WITH_CAUTION";

  const verdict_summary =
    flags.length === 0
      ? "No obvious red-flag phrases detected. This does not guarantee the agreement is legitimate — load the Warrant Council AI for a thorough analysis."
      : `Detected ${flags.length} red flag${flags.length > 1 ? "s" : ""} using keyword analysis. ${highCount > 0 ? `${highCount} HIGH-severity issue${highCount > 1 ? "s" : ""} found.` : ""} Load the Warrant Council AI for a complete, clause-level review.`;

  return {
    risk_level,
    score,
    flags,
    positive_signs: positives,
    verdict_summary,
    recommendation,
    _usedFallback: true,
    _fallbackNote:
      "AI is not loaded. This analysis uses keyword pattern matching — results may miss subtle violations. Load the Warrant Council AI for a full review.",
  };
}

// --- End offline fallback ---

/**
 * Analyze text for predatory practices using Unified AI Service
 * Seamlessly works with both Cloud (Gemini) and Local (WebLLM) AI
 * @param {string} apiKey - User's Gemini API key (optional if using Local AI)
 * @param {string} textToAnalyze - Contract, email, or marketing text
 * @returns {Promise<Object>} - Analysis results
 */
export async function analyzeContract(apiKey, textToAnalyze) {
  if (!textToAnalyze || textToAnalyze.trim().length < 50) {
    throw new Error(
      "Please provide more text to analyze (at least 50 characters)",
    );
  }

  // Check if ANY AI is available (Cloud or Local); fall back to pattern matching
  if (!isAnyAIAvailable()) {
    return {
      success: true,
      data: patternMatchContract(textToAnalyze),
      analyzedAt: new Date().toISOString(),
      aiMode: "offline_pattern_match",
    };
  }

  const userPrompt = `${SHARK_RADAR_SYSTEM_PROMPT}

Analyze the following text from a VA claim consulting company for predatory practices:

---BEGIN TEXT---
${textToAnalyze}
---END TEXT---

Identify all red flags and provide your analysis.`;

  try {
    // Use unified AI service - automatically chooses Cloud or Local
    const content = await generateAI(userPrompt, {
      temperature: 0.2,
      maxTokens: 4096,
      expectJSON: true,
      skipHallucinationCheck: true, // Contract analysis returns risk flags, not diagnostic codes
    });

    if (!content) {
      throw new Error("No content received from AI");
    }

    // Parse JSON response
    let result;
    try {
      let cleanContent = content.trim();
      // Remove markdown formatting if present
      if (cleanContent.startsWith("```json"))
        cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith("```")) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith("```"))
        cleanContent = cleanContent.slice(0, -3);

      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error("Parse error:", parseError, content.substring(0, 500));
      throw new Error("Failed to parse AI response. Please try again.");
    }

    // Validate required fields
    if (!result.risk_level || result.score === undefined) {
      throw new Error("AI response missing required fields. Please try again.");
    }

    return {
      success: true,
      data: result,
      analyzedAt: new Date().toISOString(),
      aiMode: getAIStatus().effectiveMode,
    };
  } catch (error) {
    console.error("Shark Radar analysis error:", error);
    throw error;
  }
}

/**
 * Get risk level color classes
 */
export function getRiskLevelColors(riskLevel) {
  switch (riskLevel?.toUpperCase()) {
    case "SAFE":
      return {
        bg: "bg-green-500",
        bgLight: "bg-green-100 dark:bg-green-900/30",
        text: "text-green-700 dark:text-green-300",
        border: "border-green-500",
        gradient: "from-green-500 to-emerald-500",
      };
    case "CAUTION":
      return {
        bg: "bg-yellow-500",
        bgLight: "bg-yellow-100 dark:bg-yellow-900/30",
        text: "text-yellow-700 dark:text-yellow-300",
        border: "border-yellow-500",
        gradient: "from-yellow-500 to-orange-500",
      };
    case "PREDATORY":
      return {
        bg: "bg-red-500",
        bgLight: "bg-red-100 dark:bg-red-900/30",
        text: "text-red-700 dark:text-red-300",
        border: "border-red-500",
        gradient: "from-red-500 to-rose-600",
      };
    default:
      return {
        bg: "bg-gray-500",
        bgLight: "bg-gray-100 dark:bg-gray-800",
        text: "text-gray-700 dark:text-gray-300",
        border: "border-gray-500",
        gradient: "from-gray-500 to-gray-600",
      };
  }
}

/**
 * Get severity color for individual flags
 */
export function getSeverityColor(severity) {
  switch (severity?.toUpperCase()) {
    case "HIGH":
      return "bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700";
    case "MEDIUM":
      return "bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700";
    case "LOW":
      return "bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700";
    default:
      return "bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600";
  }
}

/**
 * Get the privacy disclosure for Shark Radar
 * Now AI-mode aware - shows different info for Cloud vs Local
 */
export function getSharkRadarPrivacyDisclosure() {
  const status = getAIStatus();

  if (status.effectiveMode === AI_MODES.LOCAL) {
    return `🔒 LOCAL AI MODE - 100% PRIVATE

When you scan a contract or email:

1. WHAT HAPPENS: The text is processed ENTIRELY ON YOUR DEVICE by the Local AI model.

2. ZERO DATA TRANSMISSION: Nothing is sent over the internet. All processing happens in your browser using WebGPU.

3. COMPLETE PRIVACY: Your contract text never leaves your device - not even to us.

4. LOCAL RESULTS: Analysis results exist only on your device.

5. NOT LEGAL ADVICE: This tool provides educational analysis, not legal advice.

✅ This is the most private way to scan contracts for red flags.`;
  }

  return `☁️ CLOUD AI MODE (Google Gemini)

When you scan a contract or email:

1. WHAT IS SENT: Only the text you paste is sent to Google's Gemini AI for analysis.

2. NO PERSONAL INFO: We recommend removing your name, SSN, or other identifying information before pasting.

3. YOUR API KEY: You use your own free Gemini API key. We never see or store it.

4. LOCAL PROCESSING: Results are displayed locally and not stored on any server.

5. NOT LEGAL ADVICE: This tool provides educational analysis, not legal advice.

💡 TIP: For 100% privacy, switch to Local AI in settings (requires WebGPU-compatible browser).

By proceeding, you acknowledge this is an educational tool to help identify potentially predatory practices.`;
}
