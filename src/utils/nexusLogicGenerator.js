/**
 * Vet-Rate.org - Nexus Logic Generator
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * AI-powered medical research assistant that generates "Doctor's Packets"
 * to help veterans get nexus letters from their private physicians.
 * 
 * Updated: Now uses Unified AI Service for seamless Cloud/Local AI switching
 */

import { generateAI, isAnyAIAvailable, getAIStatus, AI_MODES } from './unifiedAIService';

// The specialized system prompt for generating nexus research
const NEXUS_LOGIC_SYSTEM_PROMPT = `You are a Medical Research Assistant specializing in pathophysiology and VA Disability Law. Your task is to generate a "Medical Nexus Research Brief" for a veteran to present to their private physician.

USER INPUTS:
1. Primary Condition (Service-Connected): [Provided by user]
2. Secondary Condition (Claimed): [Provided by user]

YOUR GOAL:
Explain the physiological or psychological mechanism by which the Primary Condition could cause or aggravate the Secondary Condition, based on general medical literature.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object. No markdown, no code blocks, just pure JSON.

{
  "mechanism_summary": "A 150-200 word professional explanation of the biological link (e.g., how medication for A causes B, or how stress from A impacts B). Use medical terminology suitable for a physician. Explain the pathophysiological pathway clearly.",
  "key_pathways": [
    "List 3-5 distinct physiological or psychological pathways that connect these conditions"
  ],
  "literature_topics": [
    "List 3-5 types of medical studies or literature that support this link (e.g., 'Studies linking corticosteroid use to cataracts', 'Research on PTSD and cardiovascular risk'). Do not fabricate specific URLs or DOIs, just cite the medical consensus or study types."
  ],
  "risk_factors": [
    "List 2-3 specific risk factors that make this connection more likely"
  ],
  "doctor_template": {
    "opening": "A professional opening paragraph acknowledging the request for medical opinion",
    "clinical_rationale": "2-3 sentences explaining the medical reasoning using the phrase 'at least as likely as not (50% or greater probability)'",
    "conclusion": "A concluding statement suitable for a medical record"
  },
  "icd10_codes": {
    "primary": "ICD-10 code for primary condition if known (or 'Varies')",
    "secondary": "ICD-10 code for secondary condition if known (or 'Varies')"
  },
  "strength": "strong|moderate|weak - How well-established is this medical link?",
  "notes": "Any important caveats or considerations the veteran should know"
}

CRITICAL RULES:
1. DO NOT DIAGNOSE. You are providing medical research, not a diagnosis.
2. ACCURACY: If there is NO known medical link between the conditions (e.g., Tinnitus causing Flat Feet), return: {"error": "No established medical link found between [Primary] and [Secondary]. These conditions do not have a recognized pathophysiological connection in medical literature.", "suggestion": "Consider consulting with a medical professional about alternative service connection theories."}
3. TONE: Professional, clinical, and objective. Write as if preparing a research brief for a physician.
4. MAGIC WORDS: The doctor_template MUST include "at least as likely as not" and "50% or greater probability" - these are required VA terminology.
5. BE THOROUGH: Provide enough detail that a physician can understand the mechanism without additional research.
6. MEDICATION EFFECTS: If medications are a pathway, mention common medications used for the primary condition.`;

/**
 * Generate a Doctor's Packet using Unified AI Service
 * Seamlessly works with both Cloud (Gemini) and Local (WebLLM) AI
 * @param {string} apiKey - User's Gemini API key (optional if using Local AI)
 * @param {string} primaryCondition - The service-connected condition
 * @param {string} secondaryCondition - The claimed secondary condition
 * @returns {Promise<Object>} - The generated packet data
 */
export async function generateDoctorsPacket(apiKey, primaryCondition, secondaryCondition) {
  // Check if ANY AI is available (Cloud or Local)
  if (!isAnyAIAvailable()) {
    throw new Error('No AI available. Please set up an API key or enable Local AI.');
  }
  
  if (!primaryCondition || !secondaryCondition) {
    throw new Error('Both primary and secondary conditions are required');
  }
  
  const userPrompt = `${NEXUS_LOGIC_SYSTEM_PROMPT}

Generate a Medical Nexus Research Brief for:
- PRIMARY CONDITION (Service-Connected): ${primaryCondition}
- SECONDARY CONDITION (Claimed): ${secondaryCondition}

Explain how the primary condition causes or aggravates the secondary condition.`;

  try {
    // Use unified AI service - automatically chooses Cloud or Local
    const response = await generateAI(userPrompt, {
      temperature: 0.3,
      maxTokens: 4096,
      expectJSON: true,
      skipHallucinationCheck: true, // Nexus research returns medical mechanisms, not diagnostic codes
    });
    
    // generateAI returns { text, mode } object - extract the text content
    const content = response?.text || response;
    
    if (!content) {
      throw new Error('No content received from AI');
    }
    
    // Ensure content is a string before processing
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Parse JSON response
    let result;
    try {
      let cleanContent = contentStr.trim();
      // Remove markdown formatting if present
      if (cleanContent.startsWith('```json')) cleanContent = cleanContent.slice(7);
      if (cleanContent.startsWith('```')) cleanContent = cleanContent.slice(3);
      if (cleanContent.endsWith('```')) cleanContent = cleanContent.slice(0, -3);
      
      result = JSON.parse(cleanContent.trim());
    } catch (parseError) {
      console.error('Parse error:', parseError, contentStr.substring(0, 500));
      throw new Error('Failed to parse AI response. Please try again.');
    }
    
    // Check if AI found no link
    if (result.error) {
      return {
        success: false,
        noLink: true,
        error: result.error,
        suggestion: result.suggestion
      };
    }
    
    // Validate required fields
    if (!result.mechanism_summary || !result.doctor_template) {
      throw new Error('AI response missing required fields. Please try again.');
    }
    
    return {
      success: true,
      data: result,
      primaryCondition,
      secondaryCondition,
      generatedAt: new Date().toISOString(),
      aiMode: getAIStatus().effectiveMode
    };
    
  } catch (error) {
    console.error('Nexus logic generation error:', error);
    throw error;
  }
}

/**
 * Format the doctor's template as a complete letter
 * @param {Object} packetData - The generated packet data
 * @param {string} primaryCondition - Primary condition name
 * @param {string} secondaryCondition - Secondary condition name
 * @returns {string} - Formatted letter text
 */
export function formatDoctorLetter(packetData, primaryCondition, secondaryCondition) {
  const { doctor_template, mechanism_summary, icd10_codes } = packetData;
  
  const currentDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  
  return `MEDICAL NEXUS OPINION
Date: ${currentDate}

RE: Medical Opinion Regarding ${secondaryCondition} Secondary to ${primaryCondition}

${doctor_template.opening}

CLINICAL RATIONALE:
${doctor_template.clinical_rationale}

MEDICAL MECHANISM:
${mechanism_summary}

${icd10_codes ? `ICD-10 CODES:
- Primary Condition: ${icd10_codes.primary}
- Secondary Condition: ${icd10_codes.secondary}
` : ''}
CONCLUSION:
${doctor_template.conclusion}

_________________________________
Physician Signature / Date

_________________________________
Printed Name / Credentials

_________________________________
Medical License Number`;
}

/**
 * Get the privacy disclosure for the Nexus Logic Generator
 * Now AI-mode aware - shows different info for Cloud vs Local
 */
export function getNexusLogicPrivacyDisclosure() {
  const status = getAIStatus();
  
  if (status.effectiveMode === AI_MODES.LOCAL) {
    return `🔒 LOCAL AI MODE - 100% PRIVATE

When you generate a Doctor's Packet:

1. WHAT HAPPENS: The condition names are processed ENTIRELY ON YOUR DEVICE by the Local AI model.

2. ZERO DATA TRANSMISSION: Nothing is sent over the internet. All processing happens in your browser using WebGPU.

3. COMPLETE PRIVACY: Your condition information never leaves your device.

4. RESEARCH ONLY: The AI generates medical research, NOT a diagnosis or official medical opinion.

5. DOCTOR REQUIRED: This packet must be reviewed and signed by a licensed physician to be valid.

✅ This is the most private way to generate a Doctor's Packet.`;
  }
  
  return `☁️ CLOUD AI MODE (Google Gemini)

When you generate a Doctor's Packet:

1. WHAT IS SENT: Only the condition names you enter (e.g., "PTSD", "Sleep Apnea") are sent to Google's Gemini AI.

2. NO PERSONAL INFO: Your name, medical records, and personal details are NOT sent.

3. YOUR API KEY: You use your own free Gemini API key. We never see or store it.

4. RESEARCH ONLY: The AI generates medical research, NOT a diagnosis or official medical opinion.

5. DOCTOR REQUIRED: This packet must be reviewed and signed by a licensed physician to be valid.

💡 TIP: For 100% privacy, switch to Local AI in settings.

By proceeding, you acknowledge that this tool provides research assistance only and that a qualified physician must review and agree with any medical opinion.`;
}
