/**
 * Vet-Rate.org - Pathfinder (Strategy Engine)
 * Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved.
 * 
 * AI-powered claims strategy engine that analyzes current ratings
 * and suggests high-probability secondary claims.
 */

// The specialized system prompt for strategy analysis
const PATHFINDER_SYSTEM_PROMPT = `You are a Senior VA Claims Strategist. Your goal is to analyze a veteran's current disability profile and suggest "High Probability" secondary claims based on established medical connections.

INPUTS:
1. Current Ratings: A list of disabilities the veteran is ALREADY service-connected for (e.g., "Tinnitus 10%", "Lumbar Strain 40%").
2. Evidence Context (Optional): Keywords from their medical file or symptoms they experience.

YOUR TASK:
Identify medically common "Secondary Conditions" that are frequently linked to the current ratings. Use established medical literature and VA rating statistics.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object. No markdown, no code blocks, just pure JSON.

{
  "strategy_analysis": "A 2-3 sentence analysis of their current claim profile strength and potential for increases.",
  "current_estimated_combined": "Estimated combined rating based on VA math (e.g., '70%')",
  "potential_combined": "Potential combined rating if opportunities are successful (e.g., '90%')",
  "opportunities": [
    {
      "proposed_condition": "Name of the condition (e.g., Migraines)",
      "primary_source": "Which current rating causes this? (e.g., 'Secondary to Tinnitus')",
      "mechanism": "Brief medical link explanation (e.g., 'Tinnitus creates chronic stress and auditory processing strain, commonly triggering migraine headaches')",
      "connection_type": "DIRECT|MEDICATION|AGGRAVATION",
      "typical_rating": "Common rating range (e.g., '30-50%')",
      "win_probability": "HIGH|MEDIUM|LOW",
      "evidence_needed": "What evidence strengthens this claim (e.g., 'Headache diary, PCP documentation')",
      "next_step": "Specific actionable advice (e.g., 'Start a headache log documenting frequency and severity for 3 months')",
      "priority": 1-10
    }
  ],
  "missing_diagnoses": [
    {
      "condition": "Name of potentially undiagnosed condition",
      "linked_to": "Which current rating suggests this",
      "reasoning": "Why this might be present based on their profile",
      "action": "What to do (e.g., 'Discuss symptoms with your PCP')"
    }
  ],
  "increase_opportunities": [
    {
      "current_condition": "Name of rated condition",
      "current_rating": "Current rating percentage",
      "potential_rating": "Higher rating that may be warranted",
      "criteria": "What symptoms would justify the increase",
      "action": "How to document and pursue"
    }
  ],
  "strategic_notes": "Any additional strategic advice specific to their profile (e.g., 'Consider filing for TDIU if employment is affected')"
}

RULES:
1. DO NOT suggest fraud or exaggeration. Only suggest medically established links.
2. PRIORITIZE "High Value" claims (those that often lead to 30%+ ratings).
3. Consider the "bilateral factor" for paired extremity conditions.
4. Note if conditions might qualify for Special Monthly Compensation (SMC).
5. IF INPUT IS EMPTY or just says "none", return an error message asking for current ratings.
6. Sort opportunities by priority (highest first).
7. Be specific about the medical mechanism - vague connections are not helpful.

COMMON HIGH-VALUE SECONDARY CONNECTIONS TO CONSIDER:
- Mental Health → Sleep Apnea, Migraines, GERD, Hypertension, ED
- Back Conditions → Radiculopathy, Sciatica, Hip/Knee (altered gait)
- Knee/Ankle → Opposite limb, Hip, Back (compensation)
- Tinnitus → Migraines, Sleep disturbance, Mental Health aggravation
- Diabetes → Peripheral Neuropathy, Retinopathy, Hypertension, ED, Kidney
- PTSD → Depression, Anxiety, Sleep Apnea, Migraines, IBS, GERD
- Hearing Loss → Tinnitus, Migraines, Balance disorders`;

/**
 * Generate strategic analysis using Gemini AI
 * @param {string} apiKey - User's Gemini API key
 * @param {Array} currentRatings - Array of {condition, rating} objects
 * @param {string} additionalContext - Optional symptoms or evidence keywords
 * @returns {Promise<Object>} - Strategy analysis results
 */
export async function analyzeStrategy(apiKey, currentRatings, additionalContext = '') {
  if (!apiKey) {
    throw new Error('API key is required');
  }
  
  if (!currentRatings || currentRatings.length === 0) {
    throw new Error('Please add at least one current service-connected condition');
  }
  
  const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`;
  
  // Format current ratings for the prompt
  const ratingsText = currentRatings
    .map(r => `- ${r.condition}${r.rating ? ` (${r.rating}%)` : ''}`)
    .join('\n');
  
  const userPrompt = `Analyze this veteran's disability profile and suggest strategic opportunities:

CURRENT SERVICE-CONNECTED RATINGS:
${ratingsText}

${additionalContext ? `ADDITIONAL CONTEXT (symptoms, medications, or evidence):
${additionalContext}` : ''}

Provide a comprehensive strategy analysis with secondary claim opportunities.`;

  const requestBody = {
    contents: [
      {
        parts: [
          {
            text: `${PATHFINDER_SYSTEM_PROMPT}\n\n${userPrompt}`
          }
        ]
      }
    ],
    generationConfig: {
      temperature: 0.4, // Balanced for strategy
      topK: 40,
      topP: 0.95,
      maxOutputTokens: 8192,
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
    if (!result.opportunities) {
      throw new Error('AI response missing opportunities. Please try again.');
    }
    
    // Sort opportunities by priority
    if (result.opportunities) {
      result.opportunities.sort((a, b) => (a.priority || 5) - (b.priority || 5));
    }
    
    return {
      success: true,
      data: result,
      inputRatings: currentRatings,
      analyzedAt: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Pathfinder analysis error:', error);
    throw error;
  }
}

/**
 * Get probability badge colors
 */
export function getProbabilityColors(probability) {
  switch (probability?.toUpperCase()) {
    case 'HIGH':
      return {
        bg: 'bg-green-100 dark:bg-green-900/30',
        text: 'text-green-700 dark:text-green-300',
        border: 'border-green-500'
      };
    case 'MEDIUM':
      return {
        bg: 'bg-yellow-100 dark:bg-yellow-900/30',
        text: 'text-yellow-700 dark:text-yellow-300',
        border: 'border-yellow-500'
      };
    case 'LOW':
      return {
        bg: 'bg-red-100 dark:bg-red-900/30',
        text: 'text-red-700 dark:text-red-300',
        border: 'border-red-500'
      };
    default:
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-700 dark:text-gray-300',
        border: 'border-gray-500'
      };
  }
}

/**
 * Get connection type badge colors
 */
export function getConnectionTypeColors(type) {
  switch (type?.toUpperCase()) {
    case 'DIRECT':
      return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
    case 'MEDICATION':
      return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
    case 'AGGRAVATION':
      return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
    default:
      return 'bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-300';
  }
}

/**
 * Get the privacy disclosure for Pathfinder
 */
export function getPathfinderPrivacyDisclosure() {
  return `When you analyze your strategy:

1. WHAT IS SENT: Only the condition names and ratings you enter are sent to Google's Gemini AI.

2. NO PERSONAL INFO: Your name, SSN, medical records, and personal details are NOT sent.

3. YOUR API KEY: You use your own free Gemini API key. We never see or store it.

4. LOCAL RESULTS: Analysis results are displayed locally and not stored on any server.

5. EDUCATIONAL ONLY: This tool provides strategic guidance, not medical or legal advice.

By proceeding, you acknowledge that all suggestions should be verified with medical professionals and VA-accredited representatives.`;
}
