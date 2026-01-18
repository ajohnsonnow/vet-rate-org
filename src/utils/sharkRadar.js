/**
 * Vet-Rate.org - Shark Radar (Contract Scanner)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * AI-powered contract scanner that detects predatory practices
 * targeting veterans based on 38 U.S.C. § 5901 and 38 CFR § 14.636.
 */

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

/**
 * Analyze text for predatory practices using Gemini AI
 * @param {string} apiKey - User's Gemini API key
 * @param {string} textToAnalyze - Contract, email, or marketing text
 * @returns {Promise<Object>} - Analysis results
 */
export async function analyzeContract(apiKey, textToAnalyze) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!textToAnalyze || textToAnalyze.trim().length < 50) {
    throw new Error('Please provide more text to analyze (at least 50 characters)');
  }
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const userPrompt = `Analyze the following text from a VA claim consulting company for predatory practices:

---BEGIN TEXT---
${textToAnalyze}
---END TEXT---

Identify all red flags and provide your analysis.`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${SHARK_RADAR_SYSTEM_PROMPT}\n\n${userPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2, // Very low for accuracy
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 4096,
      responseMimeType: "application/json"
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_NONE" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_NONE" }
    ]
  };
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      if (response.status === 400) {
        if (errorData.error?.message?.includes('API key')) {
          throw new Error('Invalid API key. Please check your Gemini API key.');
        }
        throw new Error(`Request error: ${errorData.error?.message || 'Bad request'}`);
      }
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again.');
      }
      
      throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
    }
    
    const data = await response.json();
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No content received from AI');
    }
    
    // Parse JSON response
    let result;
    try {
      let cleanContent = content.trim();
      // Remove markdown formatting if present
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('Parse error:', parseError, content.substring(0, 500));
      throw new Error('Failed to parse AI response. Please try again.');
    }
    
    // Validate required fields
    if (!result.risk_level || result.score === undefined) {
      throw new Error('AI response missing required fields. Please try again.');
    }
    
    return {
      success: true,
      data: result,
      analyzedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Shark Radar analysis error:', error);
    throw error;
  }
}

/**
 * Get risk level color classes
 */
export function getRiskLevelColors(riskLevel) {
  switch (riskLevel?.toUpperCase()) {
    case 'SAFE':
      return {
        bg: 'bg-green-500',
        bgLight: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-500',
        gradient: 'from-green-500 to-emerald-500'
      };
    case 'CAUTION':
      return {
        bg: 'bg-yellow-500',
        bgLight: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-500',
        gradient: 'from-yellow-500 to-orange-500'
      };
    case 'PREDATORY':
      return {
        bg: 'bg-red-500',
        bgLight: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-500',
        gradient: 'from-red-500 to-rose-600'
      };
    default:
      return {
        bg: 'bg-gray-500',
        bgLight: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-700 dark:text-gray-300',
        border: 'border-gray-500',
        gradient: 'from-gray-500 to-gray-600'
      };
  }
}

/**
 * Get severity color for individual flags
 */
export function getSeverityColor(severity) {
  switch (severity?.toUpperCase()) {
    case 'HIGH':
      return 'bg-red-100 text-red-800 border-red-300 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700';
    case 'MEDIUM':
      return 'bg-yellow-100 text-yellow-800 border-yellow-300 dark:bg-yellow-900/30 dark:text-yellow-300 dark:border-yellow-700';
    case 'LOW':
      return 'bg-blue-100 text-blue-800 border-blue-300 dark:bg-blue-900/30 dark:text-blue-300 dark:border-blue-700';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-300 dark:bg-gray-800 dark:text-gray-300 dark:border-gray-600';
  }
}

/**
 * Get the privacy disclosure for Shark Radar
 */
export function getSharkRadarPrivacyDisclosure() {
  return `When you scan a contract or email:

1. WHAT IS SENT: Only the text you paste is sent to Google's Gemini AI for analysis.

2. NO PERSONAL INFO: We recommend removing your name, SSN, or other identifying information before pasting.

3. YOUR API KEY: You use your own free Gemini API key. We never see or store it.

4. LOCAL PROCESSING: Results are displayed locally and not stored on any server.

5. NOT LEGAL ADVICE: This tool provides educational analysis, not legal advice. Consult a VA-accredited attorney for legal guidance.

By proceeding, you acknowledge this is an educational tool to help identify potentially predatory practices.`;
}
