/**
 * Vet-Rate.org - C-File AI Analysis Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * AI-powered C-File analysis using 1M token context window
 * 
 * Updated: Now uses Unified AI Service for seamless Cloud/Local AI switching
 */

import { generateAI, isAnyAIAvailable, getAIStatus, AI_MODES } from './unifiedAIService';

// The specialized system prompt for C-File analysis
const CFILE_SYSTEM_PROMPT = `You are a highly specialized VA Claims Auditor and Medical Record Analyst. Your sole purpose is to review the provided text, which has been extracted from a veteran's Military Service Records (C-File) and Medical Records.

YOUR GOAL: Identify "The Big Three" elements required for a successful VA disability claim:
1. In-Service Event (Injury, illness, or exposure).
2. Current Diagnosis (Chronic issues mentioned in recent years).
3. Nexus (Medical opinion or continuity of symptoms linking #1 to #2).

INPUT DATA:
The user will provide a large block of text representing the full file. The text includes page markers in the format "--- PAGE X ---".

OUTPUT FORMAT:
You must respond ONLY with a valid JSON object. Do not include markdown formatting, code blocks, or conversational text. The JSON structure must be:

{
  "summary": "A 2-3 sentence executive summary of the veteran's major service-connected risks.",
  "servicePeriod": {
    "branch": "Military branch if identified",
    "entryDate": "Approximate entry date if found",
    "separationDate": "Approximate separation date if found",
    "mos": "Military Occupational Specialty if identified"
  },
  "timeline": [
    {
      "date": "YYYY-MM-DD or Approx Date (e.g., 'Jan 2005' or 'Circa 2003')",
      "page_number": 123,
      "category": "injury|medical_visit|combat_award|diagnosis|exposure|surgery|mental_health|medication",
      "body_part": "Specific body part (e.g., 'Right Knee', 'Lumbar Spine') or 'Systemic' or 'Mental Health'",
      "description": "Concise summary of the event (max 25 words).",
      "quote": "Direct quote of the key phrase from the text (max 50 words).",
      "significance": "high|medium|low - How significant is this for a claim?"
    }
  ],
  "potential_claims": [
    {
      "condition": "Name of condition (e.g., Tinnitus, Lumbar Strain, PTSD)",
      "diagnosticCode": "VA diagnostic code if you can identify it (e.g., 6260 for Tinnitus)",
      "likelihood": "high|medium|low - Based on evidence found",
      "inServiceEvent": "Brief description of the in-service event supporting this claim",
      "currentDiagnosis": "Whether a current diagnosis exists (yes|no|unclear)",
      "nexusStrength": "strong|moderate|weak|missing - Strength of connection between service and condition",
      "missing_element": "What is missing? (e.g., 'Nexus letter needed', 'No current diagnosis found', 'In-service event unclear')",
      "evidence_pages": [12, 45, 108],
      "recommendation": "Specific action to strengthen this claim"
    }
  ],
  "exposures": [
    {
      "type": "Agent Orange|Burn Pits|Radiation|Asbestos|Gulf War Contaminants|Camp Lejeune Water|Other",
      "location": "Location of exposure if identified",
      "timeframe": "When the exposure occurred",
      "page_number": 123,
      "presumptive_conditions": ["List of conditions that may be presumptively connected"]
    }
  ],
  "combatIndicators": [
    {
      "indicator": "Description of combat indicator (CAR, CIB, Purple Heart, combat zone deployment, etc.)",
      "page_number": 123,
      "significance": "Why this matters for claims"
    }
  ],
  "mentalHealth": {
    "indicators": ["List of mental health indicators found"],
    "diagnoses": ["Any mental health diagnoses mentioned"],
    "stressors": ["Documented stressors"],
    "pages": [12, 45]
  },
  "redFlags": [
    {
      "issue": "Any concerning issues found (gaps in records, contradictions, etc.)",
      "page_number": 123,
      "suggestion": "How to address this issue"
    }
  ],
  "actionItems": [
    "Prioritized list of next steps the veteran should take",
    "Get buddy statement for X incident",
    "Request nexus letter for Y condition",
    "File for presumptive condition Z"
  ]
}

CRITICAL RULES:
1. ACCURACY IS PARAMOUNT. Do not hallucinate. If an event is not in the text, do not list it.
2. PAGE REFERENCES: You must strictly track the "--- PAGE X ---" markers to attribute every finding to a specific page number (as an integer, not string).
3. IGNORE NOISE: Ignore administrative clutter (leave forms, routing slips, illegible entries) unless they contain medical evidence.
4. CHRONOLOGY: Order the timeline from oldest to newest.
5. BE COMPREHENSIVE: For large files, aim to capture all significant medical events, not just the most recent ones.
6. DIAGNOSTIC CODES: When you identify a condition, try to match it to a VA diagnostic code from 38 CFR Part 4.
7. PACT ACT AWARENESS: Flag any toxic exposure evidence for PACT Act presumptive claims.
8. MENTAL HEALTH SENSITIVITY: Pay special attention to mental health indicators, even subtle ones.`;

/**
 * Analyze a C-File using Unified AI Service
 * Seamlessly works with both Cloud (Gemini) and Local (WebLLM) AI
 * @param {string} apiKey - User's Gemini API key (optional if using Local AI)
 * @param {string} fullText - Extracted text from the C-File with page markers
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Structured analysis results
 */
export async function analyzeCFile(apiKey, fullText, onProgress = () => {}) {
  // Check if ANY AI is available (Cloud or Local)
  if (!isAnyAIAvailable()) {
    throw new Error('No AI available. Please set up an API key or enable Local AI.');
  }
  
  if (!fullText || fullText.trim().length < 100) {
    throw new Error('Insufficient text content to analyze');
  }
  
  onProgress('Preparing analysis request...');
  
  const userPrompt = `${CFILE_SYSTEM_PROMPT}\n\n--- BEGIN C-FILE TEXT ---\n\n${fullText}\n\n--- END C-FILE TEXT ---\n\nAnalyze this C-File and return ONLY the JSON object as specified. No additional text or formatting.`;
  
  onProgress('Sending to AI for analysis (this may take 1-3 minutes)...');
  
  try {
    // Use unified AI service - automatically chooses Cloud or Local
    // IMPORTANT: Skip crisis check because C-Files contain medical records
    // that may legitimately include mental health documentation with clinical
    // terminology (e.g., "suicidal ideation documented", "PTSD diagnosis").
    // This is clinical documentation, NOT user-expressed crisis language.
    const response = await generateAI(userPrompt, {
      temperature: 0.2,
      maxTokens: 32768,
      expectJSON: true,
      skipCrisisCheck: true, // C-Files contain clinical records, not user crisis expressions
      toolContext: 'C-File Analyzer'
    });
    
    onProgress('Processing AI response...');
    
    // generateAI returns { text, mode } object - extract the text content
    const content = response?.text || response;
    
    if (!content) {
      throw new Error('No analysis content received from AI');
    }
    
    // Ensure content is a string before processing
    const contentStr = typeof content === 'string' ? content : JSON.stringify(content);
    
    // Parse the JSON response
    let analysisResult;
    try {
      // Clean up the response in case there's any markdown formatting
      let cleanContent = contentStr.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.slice(7);
      }
      if (cleanContent.startsWith('```')) {
        cleanContent = cleanContent.slice(3);
      }
      if (cleanContent.endsWith('```')) {
        cleanContent = cleanContent.slice(0, -3);
      }
      cleanContent = cleanContent.trim();
      
      analysisResult = JSON.parse(cleanContent);
    } catch (parseError) {
      console.error('JSON parse error:', parseError);
      console.error('Raw content:', contentStr.substring(0, 500));
      throw new Error('Failed to parse AI response. The AI may have returned an invalid format.');
    }
    
    // Validate required fields
    if (!analysisResult.summary || !analysisResult.timeline || !analysisResult.potential_claims) {
      throw new Error('AI response missing required fields. Please try again.');
    }
    
    // Ensure all array fields are initialized to prevent undefined .map() errors
    // This handles partial AI responses gracefully
    const sanitizedResult = {
      ...analysisResult,
      timeline: analysisResult.timeline || [],
      potential_claims: analysisResult.potential_claims || [],
      exposures: analysisResult.exposures || [],
      combatIndicators: analysisResult.combatIndicators || [],
      redFlags: analysisResult.redFlags || [],
      actionItems: analysisResult.actionItems || [],
      mentalHealth: {
        diagnoses: analysisResult.mentalHealth?.diagnoses || [],
        indicators: analysisResult.mentalHealth?.indicators || [],
        stressors: analysisResult.mentalHealth?.stressors || [],
        pages: analysisResult.mentalHealth?.pages || [],
        ...analysisResult.mentalHealth
      },
      servicePeriod: analysisResult.servicePeriod || {}
    };
    
    onProgress('Analysis complete!');
    
    return {
      success: true,
      analysis: sanitizedResult,
      metadata: {
        analyzedAt: new Date().toISOString(),
        textLength: fullText.length,
        aiMode: getAIStatus().effectiveMode
      }
    };
    
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Request timed out. The file may be too large. Please try a smaller file or try again.');
    }
    throw error;
  }
}

/**
 * Validate a Gemini API key by making a simple test request
 * @param {string} apiKey - The API key to validate
 * @returns {Promise<{valid: boolean, error?: string}>}
 */
export async function validateApiKey(apiKey) {
  if (!apiKey || apiKey.trim().length < 10) {
    return { valid: false, error: 'API key is too short' };
  }
  
  try {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`;
    const response = await fetch(endpoint);
    
    if (response.ok) {
      return { valid: true };
    }
    
    if (response.status === 400 || response.status === 403) {
      return { valid: false, error: 'Invalid API key' };
    }
    
    return { valid: false, error: `Validation failed (${response.status})` };
  } catch (error) {
    return { valid: false, error: 'Network error during validation' };
  }
}

/**
 * Get the privacy disclosure for C-File analysis
 * Now AI-mode aware - shows different info for Cloud vs Local
 * @returns {string}
 */
export function getCFilePrivacyDisclosure() {
  const status = getAIStatus();
  
  if (status.effectiveMode === AI_MODES.LOCAL) {
    return `🔒 LOCAL AI MODE - MAXIMUM PRIVACY

When you use the C-File Analyzer:

1. YOUR FILE STAYS LOCAL: Your PDF is read directly in your browser. It is NEVER uploaded anywhere.

2. 100% LOCAL PROCESSING: The extracted text is analyzed ENTIRELY ON YOUR DEVICE by the Local AI model.

3. ZERO DATA TRANSMISSION: Nothing is sent over the internet. All processing happens in your browser using WebGPU.

4. NO STORAGE: We do not save any part of your C-File or analysis results. Everything exists only in your browser session.

5. SENSITIVE DATA: C-Files contain highly sensitive information. Even with local processing, use this tool on a private, secure device.

✅ This is the most private way to analyze your C-File.`;
  }
  
  return `☁️ CLOUD AI MODE (Google Gemini)

When you use the C-File Analyzer:

1. YOUR FILE STAYS LOCAL: Your PDF is read directly in your browser. It is NEVER uploaded to Vet-Rate.org servers.

2. TEXT ONLY TO AI: Only the extracted TEXT is sent to Google's Gemini AI for analysis. Images and formatting are stripped out.

3. YOUR API KEY: You provide your own Google Gemini API key. We never see or store your key.

4. NO STORAGE: We do not save any part of your C-File or analysis results. Everything exists only in your browser session.

5. GOOGLE'S POLICY: The text sent to Gemini is subject to Google's privacy policy and data handling practices.

6. SENSITIVE DATA: C-Files contain highly sensitive medical and personal information. Only use this tool on a private, secure device.

💡 TIP: For 100% privacy, switch to Local AI in settings (requires WebGPU-compatible browser).

By proceeding, you acknowledge that:
- You are voluntarily sending extracted text to Google's AI service
- You understand your data is processed according to Google's policies
- You accept responsibility for using this tool securely`;
}
