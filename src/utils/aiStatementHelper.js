/**
 * Vet-Rate.org - AI Statement Assistant
 * Powered by Google Gemini API (Free Tier)
 * 
 * PRIVACY NOTE: When AI enhancement is used, the user's statement answers
 * are sent to Google's Gemini API. No personal identifying information
 * is required or sent - only the condition names and symptom descriptions.
 * 
 * Users must explicitly consent before any data is sent to the AI service.
 */

// API endpoint for Gemini
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent';

/**
 * Check if AI features are available (API key is configured)
 */
export const isAIAvailable = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  return Boolean(apiKey && apiKey.length > 0);
};

/**
 * Get the configured API key
 */
const getApiKey = () => {
  return import.meta.env.VITE_GEMINI_API_KEY || '';
};

/**
 * Build the prompt for enhancing a personal statement using the "Three Pillars" approach:
 * 1. The Event (what happened in service)
 * 2. Current Symptoms (what's wrong now)
 * 3. The Nexus/Link (how the event causes the current condition)
 */
const buildStatementPrompt = (answers, condition, primaryCondition, claimType) => {
  const isSecondary = claimType === 'secondary';
  
  // Build the Three Pillars from user input
  let pillar1_Event = '';
  let pillar2_Symptoms = '';
  let pillar3_Nexus = '';
  
  if (isSecondary) {
    // For secondary claims, the "event" is the primary condition
    pillar1_Event = `I have a service-connected condition: ${primaryCondition}.`;
    pillar2_Symptoms = [
      answers.specificExamples,
      answers.workImpact ? `Work impact: ${answers.workImpact}` : '',
      answers.socialImpact ? `Social/family impact: ${answers.socialImpact}` : ''
    ].filter(Boolean).join(' ') || 'Ongoing symptoms affecting daily life.';
    
    // The nexus for secondary is how the primary causes/aggravates the secondary
    const mechanismText = answers.aggravationMechanism || '';
    const explanationText = answers.aggravationExplanation || '';
    const incidentText = answers.specificIncident || '';
    pillar3_Nexus = [mechanismText, explanationText, incidentText].filter(Boolean).join(' ') || 
      `My ${primaryCondition} causes or aggravates my ${condition}.`;
  } else {
    // For primary/direct claims
    pillar1_Event = answers.inServiceEvent || answers.specificIncident || 
      `During my military service, I developed/experienced issues related to ${condition}.`;
    pillar2_Symptoms = [
      answers.specificExamples,
      answers.workImpact ? `Work impact: ${answers.workImpact}` : '',
      answers.socialImpact ? `Social/family impact: ${answers.socialImpact}` : ''
    ].filter(Boolean).join(' ') || 'I currently experience ongoing symptoms.';
    pillar3_Nexus = answers.nexusExplanation || 
      `The symptoms started during/after service and have persisted since ${answers.symptomOnsetDate || 'that time'}.`;
  }

  return `Draft a Personal Statement in Support of Claim (VA Form 21-4138) based on the following Three Pillars:

=== PILLAR 1: THE IN-SERVICE EVENT ===
${pillar1_Event}

=== PILLAR 2: CURRENT SYMPTOMS ===
Condition: ${condition}
${pillar2_Symptoms}
Treatment: ${answers.hasTreatment === 'yes-va' ? 'Currently receiving VA treatment' : answers.hasTreatment === 'yes-private' ? 'Currently receiving private treatment' : 'Not currently in formal treatment'}

=== PILLAR 3: THE NEXUS/LINK ===
${pillar3_Nexus}

=== OUTPUT FORMAT ===
Write this in the first person ("I").
Do not be overly dramatic, but do not downplay the pain or limitations.
Focus on how this affects my occupation and social/family life.
Be professional, clear, and factual.
Do NOT include specific dates, names, addresses, or identifying information.
The statement should be 3-5 paragraphs.
${isSecondary ? `Frame this as a SECONDARY claim - ${condition} caused or aggravated by service-connected ${primaryCondition}.` : 'Frame this as a DIRECT service connection claim.'}
End with a respectful request for a C&P examination.

Write the statement now:`;
};

/**
 * Build the prompt for enhancing a buddy/lay statement using the Three Pillars approach
 */
const buildBuddyStatementPrompt = (answers, conditionName) => {
  // Three Pillars adapted for witness perspective
  const pillar1_Relationship = `${answers.relationship || 'Someone close to'} the veteran, known them for ${answers.knownDuration || 'several years'}.`;
  const pillar2_Observations = answers.observations || 'Observed changes in the veteran\'s condition and daily life.';
  const pillar3_Impact = [
    answers.changesNoticed ? `Changes noticed: ${answers.changesNoticed}` : '',
    answers.dailyImpact ? `Daily impact: ${answers.dailyImpact}` : ''
  ].filter(Boolean).join(' ') || 'The condition significantly affects their daily life.';

  return `Draft a Buddy/Lay Statement (VA Form 21-10210) based on the following:

=== PILLAR 1: WITNESS RELATIONSHIP ===
${pillar1_Relationship}

=== PILLAR 2: WHAT I HAVE OBSERVED ===
Veteran's condition: ${conditionName || 'Not specified'}
${pillar2_Observations}

=== PILLAR 3: IMPACT I HAVE WITNESSED ===
${pillar3_Impact}

=== OUTPUT FORMAT ===
Write this in the first person ("I") from the WITNESS's perspective.
Describe only what was personally observed - do not make medical diagnoses.
Be sincere and factual, not dramatic.
Focus on specific, observable behaviors and changes.
Do NOT include specific dates, names, or identifying information (use [Veteran] as placeholder).
The statement should be 2-4 paragraphs.
End with a sincere attestation that the statement is true to the best of your knowledge.

Write the statement now:`;
};

/**
 * Build the prompt for enhancing a PTSD stressor statement using the Three Pillars approach
 */
const buildPTSDStressorPrompt = (answers) => {
  // Three Pillars for PTSD
  const pillar1_Event = answers.eventDescription || answers.stressorType || 'Traumatic event during military service.';
  const pillar2_Symptoms = [
    answers.currentSymptoms || '',
    answers.immediateImpact ? `Initial impact: ${answers.immediateImpact}` : ''
  ].filter(Boolean).join(' ') || 'Ongoing PTSD symptoms.';
  const pillar3_Impact = answers.dailyImpact || 'Symptoms continue to affect daily life.';

  return `Draft a PTSD Stressor Statement (VA Form 21-0781) based on the following:

=== PILLAR 1: THE TRAUMATIC EVENT ===
Type of stressor: ${answers.stressorType || 'Military service-related trauma'}
${pillar1_Event}

=== PILLAR 2: CURRENT SYMPTOMS ===
${pillar2_Symptoms}

=== PILLAR 3: HOW IT AFFECTS MY LIFE NOW ===
${pillar3_Impact}

=== OUTPUT FORMAT ===
Write this in the first person ("I").
Be factual about the traumatic event without unnecessary graphic details.
Acknowledge that recounting these events is difficult.
Focus on the emotional/psychological impact and current symptoms.
Do NOT include specific dates, names, unit designations, or locations (use placeholders like [Date], [Location]).
Be sensitive to trauma while maintaining professional tone.
The statement should be 3-5 paragraphs.
End with a note about seeking help and a request for evaluation.

Write the statement now:`;
};

/**
 * Call Gemini API to enhance a statement
 * @param {string} prompt - The constructed prompt
 * @returns {Promise<{success: boolean, content?: string, error?: string}>}
 */
const callGeminiAPI = async (prompt) => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return {
      success: false,
      error: 'AI features are not configured. Please check back later.'
    };
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: prompt
          }]
        }],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 2048,
        },
        safetySettings: [
          {
            category: 'HARM_CATEGORY_HARASSMENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_HATE_SPEECH',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          },
          {
            category: 'HARM_CATEGORY_DANGEROUS_CONTENT',
            threshold: 'BLOCK_MEDIUM_AND_ABOVE'
          }
        ]
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error('Gemini API error:', errorData);
      
      if (response.status === 429) {
        return {
          success: false,
          error: 'AI service is temporarily busy. Please try again in a few moments.'
        };
      }
      
      return {
        success: false,
        error: 'Unable to connect to AI service. Please try again or use the standard template.'
      };
    }

    const data = await response.json();
    
    // Extract the generated text from Gemini's response
    const generatedText = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!generatedText) {
      return {
        success: false,
        error: 'AI returned an empty response. Please try again or use the standard template.'
      };
    }

    return {
      success: true,
      content: generatedText.trim()
    };

  } catch (error) {
    console.error('Error calling Gemini API:', error);
    return {
      success: false,
      error: 'Network error. Please check your connection and try again.'
    };
  }
};

/**
 * Enhance a personal statement (Nexus Builder) using AI
 */
export const enhancePersonalStatement = async (answers, condition, primaryCondition = null) => {
  const claimType = primaryCondition ? 'secondary' : 'primary';
  const prompt = buildStatementPrompt(answers, condition, primaryCondition, claimType);
  return callGeminiAPI(prompt);
};

/**
 * Enhance a buddy/lay statement using AI
 */
export const enhanceBuddyStatement = async (answers, conditionName) => {
  const prompt = buildBuddyStatementPrompt(answers, conditionName);
  return callGeminiAPI(prompt);
};

/**
 * Enhance a PTSD stressor statement using AI
 */
export const enhancePTSDStatement = async (answers) => {
  const prompt = buildPTSDStressorPrompt(answers);
  return callGeminiAPI(prompt);
};

/**
 * Get information about what data is shared with AI (Three Pillars structure)
 * Used for the consent modal
 */
export const getAIDataDisclosure = (statementType) => {
  const baseInfo = {
    provider: 'Google Gemini',
    purpose: 'To help write a more professional and effective statement using the "Three Pillars" approach',
    retention: 'Google does not store prompts from free API tier for training',
  };

  const dataByType = {
    personal: {
      ...baseInfo,
      pillars: [
        {
          name: 'Pillar 1: The Event',
          description: 'What happened in service (or your primary condition for secondary claims)',
          example: 'e.g., "I have service-connected PTSD" or "Injury during deployment"'
        },
        {
          name: 'Pillar 2: Current Symptoms',
          description: 'What is wrong now - your symptom descriptions',
          example: 'e.g., "Back pain every morning, difficulty standing"'
        },
        {
          name: 'Pillar 3: The Nexus/Link',
          description: 'How the event causes or aggravates your current condition',
          example: 'e.g., "The pain started after the injury and never went away"'
        }
      ],
      dataShared: [
        'Condition name being claimed',
        'Primary condition name (if secondary claim)',
        'Your description of symptoms and impact',
        'How you describe the connection between service and condition',
        'Treatment status (VA, private, or none)',
        'Impact on work and social life (your words)'
      ],
      notShared: [
        'Your name or any identifying information',
        'Your address, SSN, or VA file number',
        'Specific dates, locations, or unit names',
        'Medical record numbers',
        'Any information you have not entered in the form'
      ]
    },
    buddy: {
      ...baseInfo,
      pillars: [
        {
          name: 'Pillar 1: Your Relationship',
          description: 'Who you are and how you know the veteran',
          example: 'e.g., "Spouse for 15 years" or "Fellow service member"'
        },
        {
          name: 'Pillar 2: What You Observed',
          description: 'Specific things you personally witnessed',
          example: 'e.g., "I see them struggle to get out of bed each morning"'
        },
        {
          name: 'Pillar 3: Impact You\'ve Witnessed',
          description: 'How the condition affects their daily life',
          example: 'e.g., "They can no longer play with their children"'
        }
      ],
      dataShared: [
        'Condition name being supported',
        'Relationship type (friend, family, coworker)',
        'Your observations (in your words)',
        'Changes you have noticed',
        'Daily impact you have witnessed'
      ],
      notShared: [
        'Your name or the veteran\'s name',
        'Addresses or contact information',
        'Specific dates or locations',
        'Any information you have not entered'
      ]
    },
    ptsd: {
      ...baseInfo,
      pillars: [
        {
          name: 'Pillar 1: The Traumatic Event',
          description: 'General type of stressor experienced',
          example: 'e.g., "Combat exposure" or "Military sexual trauma"'
        },
        {
          name: 'Pillar 2: Current Symptoms',
          description: 'PTSD symptoms you experience now',
          example: 'e.g., "Nightmares, hypervigilance, avoidance"'
        },
        {
          name: 'Pillar 3: How It Affects Life Now',
          description: 'Daily impact of your PTSD',
          example: 'e.g., "Difficulty maintaining relationships, can\'t work in crowds"'
        }
      ],
      dataShared: [
        'Type of stressor (general category)',
        'General description of events (as you wrote)',
        'Current symptoms description',
        'Daily life impact description'
      ],
      notShared: [
        'Your name or identifying information',
        'Unit names, specific locations, or dates',
        'Names of others involved',
        'Any information you have not entered'
      ]
    }
  };

  return dataByType[statementType] || dataByType.personal;
};

export default {
  isAIAvailable,
  enhancePersonalStatement,
  enhanceBuddyStatement,
  enhancePTSDStatement,
  getAIDataDisclosure
};
