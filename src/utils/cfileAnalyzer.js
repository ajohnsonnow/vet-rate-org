/**
 * Vet-Rate.org - C-File AI Analysis Service
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * Integration with Google Gemini 1.5 Flash for C-File analysis
 * Uses 1M token context window to analyze entire claims files
 */

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
 * Analyze a C-File using Gemini 1.5 Flash
 * @param {string} apiKey - User's Gemini API key
 * @param {string} fullText - Extracted text from the C-File with page markers
 * @param {Function} onProgress - Progress callback
 * @returns {Promise<Object>} - Structured analysis results
 */
export async function analyzeCFile(apiKey, fullText, onProgress = () => {}) {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!fullText || fullText.trim().length < 100) {
    throw new Error('Insufficient text content to analyze');
  }
  
  onProgress('Preparing analysis request...');
  
  // Use Gemini 1.5 Flash with large context window
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${CFILE_SYSTEM_PROMPT}\n\n--- BEGIN C-FILE TEXT ---\n\n${fullText}\n\n--- END C-FILE TEXT ---\n\nAnalyze this C-File and return ONLY the JSON object as specified. No additional text or formatting.`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.2, // Low temperature for accuracy
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 32768, // Allow large response for comprehensive analysis
      responseMimeType: "application/json"
    },
    safetySettings: [
      {
        category: "HARM_CATEGORY_HARASSMENT",
        threshold: "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_HATE_SPEECH",
        threshold: "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_SEXUALLY_EXPLICIT",
        threshold: "BLOCK_NONE"
      },
      {
        category: "HARM_CATEGORY_DANGEROUS_CONTENT",
        threshold: "BLOCK_NONE"
      }
    ]
  };
  
  onProgress('Sending to AI for analysis (this may take 1-3 minutes)...');
  
  try {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      
      // Handle specific error cases
      if (response.status === 400) {
        if (errorData.error?.message?.includes('API key')) {
          throw new Error('Invalid API key. Please check your Gemini API key and try again.');
        }
        throw new Error(`Request error: ${errorData.error?.message || 'Bad request'}`);
      }
      
      if (response.status === 429) {
        throw new Error('Rate limit exceeded. Please wait a moment and try again, or check your API quota.');
      }
      
      if (response.status === 403) {
        throw new Error('API access denied. Ensure your API key has access to Gemini 1.5 Flash.');
      }
      
      throw new Error(`API error (${response.status}): ${errorData.error?.message || 'Unknown error'}`);
    }
    
    onProgress('Processing AI response...');
    
    const data = await response.json();
    
    // Extract the text content from the response
    const content = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!content) {
      throw new Error('No analysis content received from AI');
    }
    
    // Parse the JSON response
    let analysisResult;
    try {
      // Clean up the response in case there's any markdown formatting
      let cleanContent = content.trim();
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
      console.error('Raw content:', content.substring(0, 500));
      throw new Error('Failed to parse AI response. The AI may have returned an invalid format.');
    }
    
    // Validate required fields
    if (!analysisResult.summary || !analysisResult.timeline || !analysisResult.potential_claims) {
      throw new Error('AI response missing required fields. Please try again.');
    }
    
    onProgress('Analysis complete!');
    
    return {
      success: true,
      analysis: analysisResult,
      metadata: {
        analyzedAt: new Date().toISOString(),
        textLength: fullText.length,
        model: 'gemini-1.5-flash'
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
 * @returns {string}
 */
export function getCFilePrivacyDisclosure() {
  return `⚠️ IMPORTANT PRIVACY INFORMATION

When you use the C-File Analyzer:

1. YOUR FILE STAYS LOCAL: Your PDF is read directly in your browser. It is NEVER uploaded to Vet-Rate.org servers.

2. TEXT ONLY TO AI: Only the extracted TEXT is sent to Google's Gemini AI for analysis. Images and formatting are stripped out.

3. YOUR API KEY: You provide your own Google Gemini API key. We never see or store your key.

4. NO STORAGE: We do not save any part of your C-File or analysis results. Everything exists only in your browser session.

5. GOOGLE'S POLICY: The text sent to Gemini is subject to Google's privacy policy and data handling practices.

6. SENSITIVE DATA: C-Files contain highly sensitive medical and personal information. Only use this tool on a private, secure device.

By proceeding, you acknowledge that:
- You are voluntarily sending extracted text to Google's AI service
- You understand your data is processed according to Google's policies
- You accept responsibility for using this tool securely`;
}
