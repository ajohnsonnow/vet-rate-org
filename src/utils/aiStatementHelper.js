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

// LocalStorage key for BYOK (Bring Your Own Key)
const STORAGE_KEY = 'vetrate_gemini_key';

/**
 * Check if AI features are available (API key is configured)
 * Now supports both env variable (legacy) and BYOK (localStorage)
 */
export const isAIAvailable = () => {
  // Check localStorage first (BYOK)
  const storedKey = localStorage.getItem(STORAGE_KEY);
  if (storedKey && storedKey.length > 0) return true;
  
  // Fallback to env variable (legacy)
  const envKey = import.meta.env.VITE_GEMINI_API_KEY;
  return Boolean(envKey && envKey.length > 0);
};

/**
 * Get the configured API key (localStorage takes priority)
 */
const getApiKey = () => {
  // Check localStorage first (BYOK)
  const storedKey = localStorage.getItem(STORAGE_KEY);
  if (storedKey && storedKey.length > 0) return storedKey;
  
  // Fallback to env variable (legacy)
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
 * Build prompt for an appeal statement (Notice of Disagreement, HLR, Supplemental Claim)
 */
const buildAppealStatementPrompt = (answers) => {
  const appealTypeLabels = {
    'nod': 'Notice of Disagreement (NOD) / Board Appeal',
    'hlr': 'Higher-Level Review (HLR)',
    'supplemental': 'Supplemental Claim with New Evidence'
  };

  return `Draft an Appeal Statement based on the following:

=== APPEAL INFORMATION ===
Appeal Type: ${appealTypeLabels[answers.appealType] || answers.appealType || 'Disability claim appeal'}
Condition: ${answers.conditionName || 'Not specified'}
Original Decision Date: ${answers.decisionDate || 'Recent'}
Original Rating: ${answers.originalRating || 'Not specified'}
Desired Rating: ${answers.desiredRating || 'Higher rating warranted by evidence'}

=== PILLAR 1: WHY THE DECISION IS INCORRECT ===
${answers.whyIncorrect || 'The evidence in the record supports a higher rating than assigned.'}

=== PILLAR 2: WHAT EVIDENCE SUPPORTS YOUR APPEAL ===
${answers.supportingEvidence || 'Medical records and personal statements demonstrate greater severity.'}

=== PILLAR 3: WHAT OUTCOME YOU ARE SEEKING ===
${answers.desiredOutcome || 'Request reconsideration with appropriate rating that reflects actual severity of condition.'}

${answers.newEvidence ? `=== NEW/ADDITIONAL EVIDENCE ===
${answers.newEvidence}` : ''}

=== OUTPUT FORMAT ===
Write this in the first person ("I").
Be professional, factual, and respectful.
Reference 38 CFR rating criteria where appropriate.
Focus on the discrepancy between evidence and the decision.
Do NOT include specific dates, names, or identifying information.
The statement should be 3-5 paragraphs.
End with a clear request for the desired outcome.

Write the statement now:`;
};

/**
 * Build prompt for a nexus letter request (help veteran communicate with doctor)
 */
const buildNexusLetterRequestPrompt = (answers) => {
  const isSecondary = Boolean(answers.primaryCondition);

  return `Draft a Nexus Letter Request to help a veteran communicate with their doctor about what to include in a medical opinion letter.

=== CLAIM INFORMATION ===
Condition Being Claimed: ${answers.conditionName || 'Not specified'}
${isSecondary ? `Primary Service-Connected Condition: ${answers.primaryCondition}
Connection Theory: ${answers.connectionTheory || 'The primary condition caused or aggravates the claimed condition'}` : `In-Service Event/Cause: ${answers.inServiceEvent || 'Event during military service'}`}

=== VETERAN'S SYMPTOMS ===
${answers.symptoms || 'Current symptoms affecting daily life'}

=== RELEVANT MEDICAL HISTORY ===
${answers.medicalHistory || 'Treatment history and relevant medical records'}

=== OUTPUT FORMAT ===
Create a PROFESSIONAL letter the veteran can give to their doctor explaining:
1. What a nexus letter is and why it's important for VA claims
2. The specific connection that needs to be established (service connection ${isSecondary ? 'OR secondary connection' : ''})
3. The standard of proof: "at least as likely as not" (50% or greater probability)
4. What the doctor should include in the letter
5. Key medical terminology that would strengthen the opinion

Write this as a helpful guide for the doctor, not as the medical opinion itself.
Keep it professional and educational.
Do NOT include patient names or identifying information (use [Veteran Name]).
Remind that the doctor should base their opinion on their professional medical judgment and the patient's records.

Write the letter request now:`;
};

/**
 * Enhance an appeal statement using AI
 */
export const enhanceAppealStatement = async (answers) => {
  const prompt = buildAppealStatementPrompt(answers);
  return callGeminiAPI(prompt);
};

/**
 * Generate a nexus letter request using AI
 */
export const generateNexusLetterRequest = async (answers) => {
  const prompt = buildNexusLetterRequestPrompt(answers);
  return callGeminiAPI(prompt);
};

/**
 * Generic enhance function that takes FormData from FormsHelper
 * This allows the FormsHelper to call AI enhancement on any generated statement
 */
export const enhanceFormStatement = async (formType, formData) => {
  switch (formType) {
    case 'buddy-statement':
      return enhanceBuddyStatement({
        relationship: formData.witnessRelation,
        knownDuration: formData.knownSince,
        observations: formData.whatObserved,
        changesNoticed: formData.specificExamples,
        dailyImpact: formData.dailyImpact
      }, formData.conditionName);
      
    case 'personal-statement':
      return enhancePersonalStatement({
        inServiceEvent: formData.inServiceEvent,
        specificExamples: formData.worstDays,
        workImpact: formData.workImpact,
        socialImpact: formData.socialImpact,
        symptomOnsetDate: formData.onsetDate,
        hasTreatment: formData.currentTreatment ? 'yes-va' : 'no'
      }, formData.conditionName, formData.primaryCondition);
      
    case 'ptsd-stressor':
      return enhancePTSDStatement({
        stressorType: formData.stressorType,
        eventDescription: formData.eventDescription,
        currentSymptoms: Array.isArray(formData.symptoms) ? formData.symptoms.join(', ') : formData.symptomDetails,
        dailyImpact: formData.symptomDetails
      });
      
    default:
      return { success: false, error: 'Unsupported form type for AI enhancement' };
  }
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
    },
    appeal: {
      ...baseInfo,
      pillars: [
        {
          name: 'Pillar 1: Why Decision is Incorrect',
          description: 'What was wrong with the original decision',
          example: 'e.g., "Evidence shows severity is greater than 10% rating"'
        },
        {
          name: 'Pillar 2: Supporting Evidence',
          description: 'What evidence supports your appeal',
          example: 'e.g., "Medical records show daily symptoms"'
        },
        {
          name: 'Pillar 3: Desired Outcome',
          description: 'What you are asking for',
          example: 'e.g., "Request 30% rating based on rating criteria"'
        }
      ],
      dataShared: [
        'Condition name',
        'Original and desired rating',
        'Your description of why decision is incorrect',
        'Summary of supporting evidence'
      ],
      notShared: [
        'Your name or identifying information',
        'Decision letter details',
        'Specific dates or claim numbers',
        'Any information you have not entered'
      ]
    },
    nexusRequest: {
      ...baseInfo,
      purpose: 'To help you communicate with your doctor about VA nexus letter requirements',
      pillars: [
        {
          name: 'Pillar 1: The Condition',
          description: 'What condition needs medical support',
          example: 'e.g., "Lumbar strain secondary to knee injury"'
        },
        {
          name: 'Pillar 2: The Connection',
          description: 'How it relates to service or primary condition',
          example: 'e.g., "Altered gait from knee causes back strain"'
        },
        {
          name: 'Pillar 3: Medical Support Needed',
          description: 'What the doctor needs to address',
          example: 'e.g., "Medical opinion on causation"'
        }
      ],
      dataShared: [
        'Condition name being claimed',
        'Primary condition (if secondary)',
        'Connection theory',
        'Symptom descriptions'
      ],
      notShared: [
        'Your name or doctor\'s name',
        'Medical record numbers',
        'Facility names or locations',
        'Any information you have not entered'
      ]
    }
  };

  return dataByType[statementType] || dataByType.personal;
};

/**
 * Generate AI-assisted text for a specific textarea field
 * Helps veterans articulate their symptoms and impacts
 */
export const generateFieldSuggestion = async (fieldType, condition, primaryCondition = null, currentText = '') => {
  const apiKey = getApiKey();
  
  if (!apiKey) {
    return { success: false, error: 'No API key configured. Add your Gemini API key in Settings.' };
  }

  const prompts = {
    workImpact: `As a VA claims specialist, help a veteran describe how their ${condition} affects their ability to work. 
${currentText ? `They've started writing: "${currentText}"\n\nExpand and improve this, keeping their voice.` : 'Generate a compelling first-person example.'}

Focus on:
- Concentration and productivity issues
- Days missed or reduced hours
- Performance impacts documented by supervisors
- Safety concerns
- Career limitations

Write 2-3 sentences in first person, specific and vivid. Do NOT use brackets or placeholders.`,

    socialImpact: `As a VA claims specialist, help a veteran describe how their ${condition} affects their social and family life.
${currentText ? `They've started writing: "${currentText}"\n\nExpand and improve this, keeping their voice.` : 'Generate a compelling first-person example.'}

Focus on:
- Relationship strain with spouse/partner
- Difficulty with children or family activities
- Social isolation and avoiding gatherings
- Mood changes noticed by others
- Loss of hobbies or activities

Write 2-3 sentences in first person, specific and vivid. Do NOT use brackets or placeholders.`,

    specificExamples: `As a VA claims specialist, help a veteran describe specific examples of how ${condition} limits their daily activities.
${currentText ? `They've started writing: "${currentText}"\n\nExpand and improve this, keeping their voice.` : 'Generate a compelling first-person example.'}

Focus on:
- Driving limitations
- Self-care difficulties
- Household task limitations
- Need for rest/breaks
- Memory or cognitive issues

Write 2-3 sentences in first person, specific and vivid. Do NOT use brackets or placeholders.`,

    aggravationExplanation: `As a VA claims specialist, help a veteran explain how their service-connected ${primaryCondition} causes or worsens their ${condition}.
${currentText ? `They've started writing: "${currentText}"\n\nExpand and improve this, keeping their voice.` : 'Generate a compelling first-person example.'}

Focus on:
- The medical/logical connection
- Timing correlation
- How symptoms interact
- Observable patterns

Write 2-3 sentences in first person, specific and vivid. Do NOT use brackets or placeholders.`,

    specificIncident: `As a VA claims specialist, help a veteran describe a specific recent incident where their ${primaryCondition || 'primary condition'} and ${condition} interacted.
${currentText ? `They've started writing: "${currentText}"\n\nExpand and improve this, keeping their voice.` : 'Generate a compelling first-person example.'}

Focus on:
- Specific date or timeframe ("last month", "two weeks ago")
- What triggered the episode
- How symptoms manifested
- Who witnessed it
- The aftermath

Write 2-3 sentences in first person, specific and vivid. Do NOT use brackets or placeholders.`
  };

  const prompt = prompts[fieldType];
  if (!prompt) {
    return { success: false, error: 'Unknown field type' };
  }

  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 300
        }
      })
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      if (response.status === 400 && errorData.error?.message?.includes('API key')) {
        return { success: false, error: 'Invalid API key. Please check your Gemini API key in Settings.' };
      }
      return { success: false, error: `API error: ${response.status}` };
    }

    const data = await response.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    
    if (!text) {
      return { success: false, error: 'No response generated' };
    }

    return { success: true, content: text.trim() };
  } catch (error) {
    console.error('Field suggestion error:', error);
    return { success: false, error: 'Network error. Please try again.' };
  }
};

export default {
  isAIAvailable,
  enhancePersonalStatement,
  enhanceBuddyStatement,
  enhancePTSDStatement,
  enhanceAppealStatement,
  generateNexusLetterRequest,
  enhanceFormStatement,
  getAIDataDisclosure,
  generateFieldSuggestion
};
