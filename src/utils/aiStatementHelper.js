/**
 * Vet-Rate.org - AI Statement Assistant
 * Powered by Unified AI Service - Cloud (Gemini) or Local (WebLLM)
 * 
 * PRIVACY NOTE: Users can now choose between:
 * - Cloud AI: Sends condition names/symptoms to Google's Gemini API
 * - Local AI: 100% private, runs entirely in browser via WebGPU
 * 
 * Users must explicitly consent before any data is sent to the AI service.
 * 
 * SAFETY-CRITICAL: All user input is scanned for crisis language BEFORE
 * being sent to the AI. If self-harm indicators are detected, the AI call
 * is BLOCKED and the user is immediately redirected to crisis resources.
 */

import { interceptBeforeAICall } from './crisisInterceptor';
import { 
  generateAI, 
  isAnyAIAvailable, 
  isLocalAIReady, 
  isCloudAIAvailable,
  getAIStatus,
  AI_MODES 
} from './unifiedAIService';

// LocalStorage key for BYOK (Bring Your Own Key)
const STORAGE_KEY = 'vetrate_gemini_key';

/**
 * Check if AI features are available (either cloud or local)
 * Now supports both Cloud AI and Local AI
 */
export const isAIAvailable = () => {
  return isAnyAIAvailable();
};

/**
 * Get the configured API key (localStorage takes priority)
 * @deprecated Use unified AI service instead
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

=== PROTECTION RULES (CRITICAL) ===
You are FORBIDDEN from outputting:
- Social Security Numbers (SSN) - Replace with [SSN REDACTED] if present in input
- Phone numbers - Replace with [PHONE REDACTED]
- Specific street addresses - Use [ADDRESS] placeholder
- Email addresses - Replace with [EMAIL REDACTED]
- Full names of family members or medical providers - Use [NAME REDACTED]
If the user input contains any of these, you MUST sanitize them in your output.

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

=== PROTECTION RULES (CRITICAL) ===
You are FORBIDDEN from outputting:
- Social Security Numbers - Replace with [SSN REDACTED]
- Phone numbers - Replace with [PHONE REDACTED]
- Specific street addresses - Use [ADDRESS] placeholder
- Email addresses or full names - Use [NAME REDACTED] or [Veteran]
If any PII appears in input, you MUST sanitize it in your output.

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
=== PROTECTION RULES (CRITICAL) ===
You are FORBIDDEN from outputting:
- Social Security Numbers - Replace with [SSN REDACTED]
- Phone numbers - Replace with [PHONE REDACTED]
- Specific street addresses - Use [ADDRESS] placeholder
- Email addresses, full names, unit IDs - Replace with [REDACTED]
If any PII appears in input, you MUST sanitize it in your output.

Be factual about the traumatic event without unnecessary graphic details.
Acknowledge that recounting these events is difficult.
Focus on the emotional/psychological impact and current symptoms.
Do NOT include specific dates, names, unit designations, or locations (use placeholders like [Date], [Location]).
Be sensitive to trauma while maintaining professional tone.
The statement should be 3-5 paragraphs.
End with a note about seeking help and a request for evaluation.

Write the statement now:`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// "THE COOLDOWN" - Built-in Rate Limiting for AI Calls
// Prevents accidental double-clicks and excessive API usage
// ═══════════════════════════════════════════════════════════════════════════════
const RATE_LIMIT_KEY = 'vetrate_ai_ratelimit';
const COOLDOWN_MS = 10000; // 10 seconds between requests
const HOURLY_LIMIT = 30;   // Max 30 requests per hour
const HOURLY_LOCKOUT_MS = 30 * 60 * 1000; // 30 min lockout if exceeded

/**
 * Get rate limit state from localStorage
 */
const getRateLimitState = () => {
  try {
    const stored = localStorage.getItem(RATE_LIMIT_KEY);
    if (!stored) return { timestamps: [], lockoutUntil: null };
    return JSON.parse(stored);
  } catch {
    return { timestamps: [], lockoutUntil: null };
  }
};

/**
 * Save rate limit state to localStorage
 */
const setRateLimitState = (state) => {
  try {
    localStorage.setItem(RATE_LIMIT_KEY, JSON.stringify(state));
  } catch (e) {
    console.error('Failed to save rate limit state:', e);
  }
};

/**
 * Check if we can make an AI request
 * @returns {{ canRequest: boolean, error?: string, waitTime?: number }}
 */
const checkRateLimit = () => {
  const now = Date.now();
  const state = getRateLimitState();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Check for active lockout
  if (state.lockoutUntil && state.lockoutUntil > now) {
    const waitTime = Math.ceil((state.lockoutUntil - now) / 1000 / 60);
    return { 
      canRequest: false, 
      error: `AI requests paused. Please wait ${waitTime} minutes before trying again.`,
      waitTime: state.lockoutUntil - now
    };
  }
  
  // Clean old timestamps
  const recentTimestamps = (state.timestamps || []).filter(ts => ts > oneHourAgo);
  
  // Check hourly limit
  if (recentTimestamps.length >= HOURLY_LIMIT) {
    const lockoutUntil = now + HOURLY_LOCKOUT_MS;
    setRateLimitState({ timestamps: recentTimestamps, lockoutUntil });
    return { 
      canRequest: false, 
      error: `Hourly AI limit reached (${HOURLY_LIMIT} requests). Please wait 30 minutes and review your drafts.`,
      waitTime: HOURLY_LOCKOUT_MS
    };
  }
  
  // Check cooldown from last request
  if (recentTimestamps.length > 0) {
    const lastRequest = Math.max(...recentTimestamps);
    const timeSinceLast = now - lastRequest;
    if (timeSinceLast < COOLDOWN_MS) {
      const waitSeconds = Math.ceil((COOLDOWN_MS - timeSinceLast) / 1000);
      return { 
        canRequest: false, 
        error: `AI cooling down... please wait ${waitSeconds} seconds.`,
        waitTime: COOLDOWN_MS - timeSinceLast
      };
    }
  }
  
  return { canRequest: true };
};

/**
 * Record that we made an AI request
 */
const recordAIRequest = () => {
  const now = Date.now();
  const state = getRateLimitState();
  const oneHourAgo = now - (60 * 60 * 1000);
  
  // Clean old timestamps and add current
  const timestamps = (state.timestamps || []).filter(ts => ts > oneHourAgo);
  timestamps.push(now);
  
  setRateLimitState({ ...state, timestamps });
};

/**
 * Call AI service (Unified - supports both Cloud and Local AI)
 * Now with built-in rate limiting ("The Cooldown") and crisis detection
 * Seamlessly switches between Cloud (Gemini) and Local (WebLLM) AI
 * @param {string} prompt - The constructed prompt
 * @param {Object} userInput - Original user input (for crisis detection)
 * @returns {Promise<{success: boolean, content?: string, error?: string, mode?: string}>}
 */
const callGeminiAPI = async (prompt, userInput = null) => {
  // ═══ CRISIS DETECTION CHECK (HIGHEST PRIORITY) ═══
  if (userInput) {
    const crisisCheck = interceptBeforeAICall(userInput);
    if (crisisCheck.shouldBlock) {
      console.warn('🚨 CRISIS LANGUAGE DETECTED - Blocking AI call and triggering crisis modal');
      
      // Dispatch custom event to trigger crisis modal
      window.dispatchEvent(new CustomEvent('vetrate:crisis', {
        detail: {
          severity: crisisCheck.severity,
          source: 'ai-statement-helper'
        }
      }));
      
      // Return error that prevents AI engagement
      return {
        success: false,
        error: 'This application has been paused. Please connect with crisis support.',
        crisisDetected: true
      };
    }
  }
  
  // ═══ RATE LIMIT CHECK ═══
  const rateLimitCheck = checkRateLimit();
  if (!rateLimitCheck.canRequest) {
    return {
      success: false,
      error: rateLimitCheck.error
    };
  }
  
  // ═══ CHECK IF ANY AI IS AVAILABLE ═══
  if (!isAnyAIAvailable()) {
    return {
      success: false,
      error: 'No AI available. Please configure a Gemini API key or initialize Local AI in settings.'
    };
  }

  // Record the request BEFORE making it (prevents double-clicks)
  recordAIRequest();

  try {
    // ═══ USE UNIFIED AI SERVICE ═══
    const result = await generateAI(prompt, {
      systemPrompt: 'You are a helpful assistant specializing in VA disability claims and veteran benefits. You help veterans write accurate, compelling statements for their claims.',
      maxTokens: 2048,
      temperature: 0.7,
      skipCrisisCheck: true, // Already checked above
    });

    const status = getAIStatus();
    
    return {
      success: true,
      content: result.text.trim(),
      mode: result.mode,
      isPrivate: result.mode === AI_MODES.LOCAL,
      statusText: status.statusText,
    };

  } catch (error) {
    console.error('Error calling AI service:', error);
    const errorMsg = error.message || '';
    
    if (errorMsg === 'CRISIS_DETECTED') {
      return {
        success: false,
        error: 'This application has been paused. Please connect with crisis support.',
        crisisDetected: true
      };
    }
    
    // ===== Cloud AI Errors =====
    if (errorMsg.includes('API key')) {
      return {
        success: false,
        error: 'Invalid or missing API key. Please check your Gemini API key in Settings.',
        errorType: 'api_key'
      };
    }
    
    if (errorMsg.includes('Rate limit') || errorMsg.includes('429')) {
      return {
        success: false,
        error: '⏳ Rate limit reached. Please wait a minute before trying again, or switch to Local AI.',
        errorType: 'rate_limit'
      };
    }
    
    if (errorMsg.includes('timed out') || errorMsg.includes('timeout')) {
      return {
        success: false,
        error: '⏱️ Request timed out. Try a shorter prompt or switch to Local AI.',
        errorType: 'timeout'
      };
    }
    
    if (errorMsg.includes('Network error') || errorMsg.includes('offline')) {
      return {
        success: false,
        error: '📡 Network error. Check your internet connection, or use Local AI which works offline.',
        errorType: 'network'
      };
    }
    
    if (errorMsg.includes('region') || errorMsg.includes('not available in')) {
      return {
        success: false,
        error: '🌍 Gemini may not be available in your region. Try using Local AI for 100% private, offline processing.',
        errorType: 'region'
      };
    }
    
    if (errorMsg.includes('servers') && (errorMsg.includes('500') || errorMsg.includes('unavailable'))) {
      return {
        success: false,
        error: '🔧 Google\'s servers are temporarily down. Please try again later or switch to Local AI.',
        errorType: 'server_error'
      };
    }
    
    // ===== Local AI Errors =====
    if (errorMsg.includes('warming up')) {
      return {
        success: false,
        error: '🔄 Local AI is still warming up... Please wait for the loading bar to complete.',
        isWarmingUp: true,
        errorType: 'warming_up'
      };
    }
    
    if (errorMsg.includes('Local AI not initialized') || errorMsg.includes('not ready') || errorMsg.includes('Neural Engine')) {
      return {
        success: false,
        error: '🧠 Local AI not ready. Please open Settings and initialize the Neural Engine first.',
        errorType: 'not_initialized'
      };
    }
    
    if (errorMsg.includes('GPU') || errorMsg.includes('WebGPU')) {
      return {
        success: false,
        error: '💻 GPU error. Your device may not support Local AI. Try Cloud AI instead, or use Chrome/Edge browser.',
        errorType: 'gpu_error'
      };
    }
    
    if (errorMsg.includes('out of memory') || errorMsg.includes('OOM')) {
      return {
        success: false,
        error: '💾 GPU out of memory. Try a smaller model or close other browser tabs.',
        errorType: 'memory'
      };
    }
    
    if (errorMsg.includes('ModelNotLoaded')) {
      return {
        success: false,
        error: '⏳ Model not loaded yet. Please wait for the AI to finish loading.',
        errorType: 'not_loaded'
      };
    }
    
    // Generic fallback
    return {
      success: false,
      error: 'AI error: ' + (errorMsg || 'Please try again or use the standard template.'),
      errorType: 'unknown'
    };
  }
};

/**
 * Enhance a personal statement (Nexus Builder) using AI
 * SAFETY-CRITICAL: User input is scanned for crisis language before AI call
 */
export const enhancePersonalStatement = async (answers, condition, primaryCondition = null) => {
  const claimType = primaryCondition ? 'secondary' : 'primary';
  const prompt = buildStatementPrompt(answers, condition, primaryCondition, claimType);
  return callGeminiAPI(prompt, answers); // Pass answers for crisis detection
};

/**
 * Enhance a buddy/lay statement using AI
 * SAFETY-CRITICAL: User input is scanned for crisis language before AI call
 */
export const enhanceBuddyStatement = async (answers, conditionName) => {
  const prompt = buildBuddyStatementPrompt(answers, conditionName);
  return callGeminiAPI(prompt, answers); // Pass answers for crisis detection
};

/**
 * Enhance a PTSD stressor statement using AI
 * SAFETY-CRITICAL: User input is scanned for crisis language before AI call
 */
export const enhancePTSDStatement = async (answers) => {
  const prompt = buildPTSDStressorPrompt(answers);
  return callGeminiAPI(prompt, answers); // Pass answers for crisis detection
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
 * Now AI-mode aware - shows different info for Cloud vs Local AI
 */
export const getAIDataDisclosure = (statementType) => {
  const status = getAIStatus();
  
  // If using Local AI, show privacy-first message
  if (status.effectiveMode === AI_MODES.LOCAL) {
    return {
      provider: '🔒 Local AI (WebLLM)',
      purpose: 'To help write a more professional and effective statement using the "Three Pillars" approach',
      retention: 'ALL PROCESSING HAPPENS ON YOUR DEVICE. No data is sent anywhere.',
      isPrivate: true,
      privacyNote: '✅ 100% Private: Your data never leaves your device. The AI model runs entirely in your browser using WebGPU.',
      dataShared: [],
      notShared: ['ALL DATA STAYS LOCAL - Nothing is transmitted over the network'],
    };
  }
  
  const baseInfo = {
    provider: '☁️ Google Gemini (Cloud AI)',
    purpose: 'To help write a more professional and effective statement using the "Three Pillars" approach',
    retention: 'Google does not store prompts from free API tier for training',
    isPrivate: false,
    privacyNote: '⚠️ Data is sent to Google servers. For 100% privacy, switch to Local AI in settings.',
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
  // Check if any AI is available via unified service
  if (!isAnyAIAvailable()) {
    return { success: false, error: 'No AI available. Configure an API key or enable Local AI in Settings.' };
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
    // Use unified AI service
    const response = await generateAI(prompt, {
      temperature: 0.7,
      maxTokens: 300
    });
    
    // generateAI returns { text, mode } object - extract the text content
    const text = response?.text || response;
    
    if (!text) {
      return { success: false, error: 'No response generated' };
    }

    const textStr = typeof text === 'string' ? text : JSON.stringify(text);
    return { success: true, content: textStr.trim() };
  } catch (error) {
    console.error('Field suggestion error:', error);
    if (error.message?.includes('API key')) {
      return { success: false, error: 'Invalid API key. Please check your Gemini API key in Settings.' };
    }
    return { success: false, error: error.message || 'Network error. Please try again.' };
  }
};

/**
 * ===========================================
 * STATE BENEFIT HUNTER - Feature A
 * Finds state-specific veteran benefits
 * ===========================================
 * 
 * ⚠️ CURRENT IMPLEMENTATION: AI-GENERATED DATA
 * 
 * This feature currently uses AI to generate state benefit information in real-time.
 * While useful for discovery, this approach has limitations:
 * - May not reflect current state laws
 * - Could miss obscure benefits
 * - Lacks precise dollar amounts
 * - No update mechanism for law changes
 * 
 * 🚧 RECOMMENDED MIGRATION:
 * Replace with scraped, validated state databases (see src/data/stateBenefits.js)
 * 
 * FUTURE IMPLEMENTATION PATH:
 * 1. Scrape official state veteran affairs websites (all 50 states + DC)
 * 2. Create structured database in src/data/stateBenefits.js
 * 3. Update searchStateBenefits() to query local data instead of AI
 * 4. Implement quarterly update process for state law changes
 * 5. Add legal citations for each benefit (e.g., "CA Rev & Tax Code §205.5")
 * 
 * See src/data/stateBenefits.js for complete implementation plan.
 */

/**
 * Build prompt for State Benefits search
 * Uses the "State Expert" system prompt
 * 
 * ⚠️ This generates AI content - not verified state data
 */
const buildStateBenefitsPrompt = (state, rating) => {
  return `You are a State Veterans Benefits Expert.
User Input: "${state}, ${rating}"

YOUR GOAL: List the specific financial and legal benefits available in ${state} for veterans with a ${rating} disability rating.

Focus on finding benefits that many veterans miss, including:
- Property tax exemptions or reductions
- Vehicle registration fee waivers or discounts
- Free or discounted hunting/fishing licenses
- Education benefits (tuition waivers, grants)
- Employment preferences
- Healthcare benefits beyond federal VA
- Housing assistance programs
- State veteran bonus programs

OUTPUT FORMAT:
Respond ONLY with a valid JSON object (no markdown, no code blocks, just pure JSON):
{
  "state": "${state}",
  "summary": "Brief summary of what ${state} offers for ${rating} disabled veterans.",
  "benefits": [
    {
      "category": "Property Tax",
      "benefit_name": "Name of the specific benefit",
      "value": "Specific dollar amount or percentage saved",
      "requirement": "Specific rating or other requirements"
    }
  ],
  "link": "The official .gov or state website URL for veteran benefits, or null if unknown"
}

Important:
- Include ALL applicable benefits for this rating level
- Be specific about dollar amounts or percentages when known
- Include requirements for each benefit
- Categories should be: Property Tax, Vehicle, Education, Recreation, Employment, Healthcare, Housing, or Other
- Provide the most accurate official website link available`;
};

/**
 * Search for state-specific veteran benefits using AI
 * 
 * ⚠️ AI-GENERATED DATA - NOT VERIFIED WITH STATE SOURCES
 * 
 * This function uses AI to generate benefit information based on general knowledge.
 * Results may be outdated or incomplete. Always verify with official state sources.
 * 
 * For production use, replace this with a local database of scraped state benefits.
 * See: src/data/stateBenefits.js for implementation plan.
 * 
 * @param {string} state - Full state name (e.g., "Oregon")
 * @param {string} rating - VA rating (e.g., "100% P&T" or "70%")
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
/**
 * ✅ NOW USING REAL SCRAPED DATA (178 benefits across 51 states)
 * 
 * Searches the local database of state veteran benefits.
 * Data scraped from official state sources on 2026-01-24.
 * 
 * See: src/data/stateBenefits.js for the complete database
 * See: scripts/state-benefits-scraper/FINAL_REPORT.md for details
 * 
 * @param {string} state - State code (e.g., "TX", "CA") or full name
 * @param {number|string} rating - VA rating percentage (e.g., 100, "70%")
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const searchStateBenefits = async (state, rating) => {
  try {
    // Import the real state benefits database
    const { searchBenefitsByRating, getStateBenefits, getAllStateData } = await import('../data/stateBenefits.js');
    
    // Convert state name to code if needed
    const stateCode = state.length === 2 ? state.toUpperCase() : 
      // Simple state name -> code mapping (extend as needed)
      state === 'Texas' ? 'TX' : 
      state === 'California' ? 'CA' : 
      state === 'Florida' ? 'FL' : 
      state === 'Virginia' ? 'VA' : 
      state.toUpperCase().substring(0, 2);
    
    // Convert rating string to number if needed
    const ratingNum = typeof rating === 'string' 
      ? parseInt(rating.replace(/[^\d]/g, '')) || 0
      : rating;
    
    // Search the database
    let benefits;
    if (ratingNum > 0) {
      benefits = searchBenefitsByRating(stateCode, ratingNum);
    } else {
      benefits = getStateBenefits(stateCode);
    }
    
    // Format the response to match the expected structure
    const formattedData = {
      state: benefits[0]?.state || state,
      stateCode: stateCode,
      disabilityRating: `${ratingNum}%`,
      lastUpdated: benefits[0]?.lastUpdated || '2026-01-24',
      dataSource: 'scraped',
      verified: benefits[0]?.verified || false,
      benefits: benefits.map(b => ({
        category: b.category,
        name: b.name || b.benefitName,
        description: b.description,
        estimatedValue: b.estimatedValue || b.value,
        requirements: {
          minRating: b.requirements?.minRating || b.requirements?.min_rating || 0,
          residency: b.requirements?.residencyRequired !== false,
          additionalNotes: b.requirements?.additionalNotes || b.requirements?.other_reqs || []
        },
        howToApply: b.howToApply || b.applicationProcess?.agency || 'Contact your local county office',
        sourceUrl: b.sourceUrl || b.source_url || b.officialSource,
        verified: b.verified || false,
        quality: b.quality || 'template'
      }))
    };
    
    return { 
      success: true, 
      data: formattedData,
      message: benefits.length === 0 ? 'No benefits found for this rating level' : null
    };
    
  } catch (error) {
    console.error('State benefits search error:', error);
    return { 
      success: false, 
      error: 'Failed to load state benefits database. Please try again.' 
    };
  }
};

/**
 * ===========================================
 * VSO FINDER - Feature C
 * Helps veterans find accredited VSOs
 * ===========================================
 */

/**
 * Build prompt for VSO search
 */
const buildVSOFinderPrompt = (zipCode) => {
  return `You are a VA Accreditation Expert helping a veteran find FREE, ACCREDITED representation.

The veteran is located near ZIP code: ${zipCode}

YOUR GOAL: List accredited Veterans Service Officers (VSOs) and Veterans Service Organizations near this location.

IMPORTANT:
- ONLY list official, accredited representatives
- Include County Veterans Service Officers (CVSOs)
- Include state VA offices
- Include accredited national organizations (DAV, VFW, American Legion, etc.)
- DO NOT list private consulting firms or "claims sharks"
- DO NOT list any organization that charges fees for filing initial claims

OUTPUT FORMAT:
Respond ONLY with a valid JSON object (no markdown, no code blocks, just pure JSON):
{
  "zipCode": "${zipCode}",
  "warning": "Always verify accreditation at va.gov/ogc/apps/accreditation before signing any forms. NEVER pay fees for filing an initial VA claim.",
  "organizations": [
    {
      "name": "Organization or office name",
      "type": "County VSO | State VA Office | National Organization",
      "address": "Full address if known, or 'Contact for location'",
      "phone": "Phone number if known, or null",
      "website": "Website URL if known, or null",
      "notes": "Any helpful notes about this organization"
    }
  ],
  "nationalResources": [
    {
      "name": "DAV (Disabled American Veterans)",
      "website": "https://www.dav.org/veterans/find-your-local-office/",
      "phone": "1-877-426-2838"
    }
  ],
  "verificationLink": "https://www.va.gov/ogc/apps/accreditation/index.asp"
}

Focus on providing accurate, helpful information that will connect the veteran with FREE, legitimate help.`;
};

/**
 * Search for accredited VSOs near a ZIP code using Gemini AI
 * @param {string} zipCode - 5-digit ZIP code
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const searchVSOs = async (zipCode) => {
  // Check if any AI is available via unified service
  if (!isAnyAIAvailable()) {
    return { success: false, error: 'No AI available. Configure an API key or enable Local AI in Settings.' };
  }

  // Validate ZIP code format
  if (!/^\d{5}$/.test(zipCode)) {
    return { success: false, error: 'Please enter a valid 5-digit ZIP code.' };
  }

  const prompt = buildVSOFinderPrompt(zipCode);

  try {
    // Use unified AI service
    const response = await generateAI(prompt, {
      temperature: 0.3,
      maxTokens: 2048,
      expectJSON: true,
      skipHallucinationCheck: true, // VSO finder JSON doesn't contain diagnostic codes
    });
    
    // generateAI returns { text, mode } object - extract the text content
    const text = response?.text || response;
    
    if (!text) {
      return { success: false, error: 'No response generated. Please try again.' };
    }

    const textStr = typeof text === 'string' ? text : JSON.stringify(text);

    // Parse the JSON response
    try {
      let cleanedText = textStr.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      const vsoData = JSON.parse(cleanedText);
      return { success: true, data: vsoData };
    } catch (parseError) {
      console.error('Failed to parse VSO JSON:', parseError, textStr);
      return { success: false, error: 'Failed to parse VSO data. Please try again.' };
    }
  } catch (error) {
    console.error('VSO search error:', error);
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
};

/**
 * ===========================================
 * RED TEAM - Statement Stress Test
 * "The Drill Sergeant" - Reviews draft statements
 * for weak language that hurts claims
 * ===========================================
 */

/**
 * Build prompt for statement stress test
 */
const buildStressTestPrompt = (statement) => {
  return `You are "The Drill Sergeant" - a VA claims expert who reviews veterans' draft statements to find WEAK LANGUAGE that will hurt their claims.

CONTEXT:
- Veterans are trained to be "tough" and downplay their pain
- They write things like "My back hurts a bit, but I push through"
- The VA reads that as "Not severe enough" = DENIAL
- Your job is to find these self-sabotaging phrases WITHOUT rewriting the statement

THE DRAFT STATEMENT:
"""
${statement}
"""

ANALYZE THIS STATEMENT FOR:
1. Minimizing language ("a little", "sometimes", "not too bad")
2. Downplaying severity ("I manage", "I push through", "I can still...")
3. Vague frequency ("sometimes", "occasionally", "when it acts up")
4. Missing functional impact (how does this STOP them from doing things?)
5. Tough-guy phrases that hurt claims ("I don't like to complain", "others have it worse")

OUTPUT FORMAT:
Respond ONLY with a valid JSON object (no markdown, no code blocks, just pure JSON):
{
  "score": 7,
  "critique": "Overall assessment in 1-2 sentences. Be direct but constructive.",
  "weak_spots": [
    {
      "quote": "exact phrase from their statement",
      "issue": "Why this hurts the claim",
      "suggestion": "What language would be stronger (clinical/specific)"
    }
  ]
}

SCORING GUIDE:
- 9-10: Strong clinical language, specific frequencies, clear functional impact
- 7-8: Good but has 1-2 weak spots
- 5-6: Several minimizing phrases or missing functional impact
- 3-4: Significant tough-guy language that will hurt the claim
- 1-2: Statement reads like "I'm fine" - major rewrite needed

Be helpful but BLUNT. This veteran needs to hear the truth before the VA denies them.`;
};

/**
 * Stress test a draft statement using Gemini AI
 * @param {string} statement - The draft statement to analyze
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const stressTestStatement = async (statement) => {
  // Check if any AI is available via unified service
  if (!isAnyAIAvailable()) {
    return { success: false, error: 'No AI available. Configure an API key or enable Local AI in Settings.' };
  }

  const prompt = buildStressTestPrompt(statement);

  try {
    // Use unified AI service
    const response = await generateAI(prompt, {
      temperature: 0.4,
      maxTokens: 2048,
      expectJSON: true,
      skipHallucinationCheck: true, // Stress test returns critique/score, not diagnostic codes
    });
    
    // generateAI returns { text, mode } object - extract the text content
    const text = response?.text || response;
    
    if (!text) {
      return { success: false, error: 'No response generated. Please try again.' };
    }

    const textStr = typeof text === 'string' ? text : JSON.stringify(text);

    try {
      let cleanedText = textStr.trim();
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      const analysisData = JSON.parse(cleanedText);
      return { success: true, data: analysisData };
    } catch (parseError) {
      console.error('Failed to parse stress test JSON:', parseError, textStr);
      return { success: false, error: 'Failed to parse analysis. Please try again.' };
    }
  } catch (error) {
    console.error('Stress test error:', error);
    return { success: false, error: 'Network error. Please check your connection and try again.' };
  }
};

/**
 * ===========================================
 * DECISION DECODER - Denial Translator
 * Translates VA legalese into plain English
 * with actionable next steps
 * ===========================================
 */

/**
 * Estimate token count from text
 * Rough estimate: ~4 characters = 1 token for English text
 * This is conservative to avoid context overflow
 */
const estimateTokenCount = (text) => {
  if (!text) return 0;
  return Math.ceil(text.length / 3.5); // Slightly conservative estimate
};

/**
 * Smart truncation for large documents
 * Preserves the beginning and end of documents (most important parts)
 * while removing middle content if needed
 *
 * IMPORTANT: Local AI models have 4096 token context window
 * Our prompt template uses ~600 tokens, so we limit input to ~1200 tokens
 * This leaves room for the AI's response (~2000 tokens)
 *
 * @param {string} text - The full document text
 * @param {number} maxTokens - Maximum tokens to allow (default 1200 for Local AI safety)
 * @returns {{ text: string, wasTruncated: boolean, originalTokens: number }}
 */
const smartTruncateForAI = (text, maxTokens = 1200) => {
  if (!text) return { text: '', wasTruncated: false, originalTokens: 0 };
  
  const originalTokens = estimateTokenCount(text);
  
  // If within limit, return as-is
  if (originalTokens <= maxTokens) {
    return { text, wasTruncated: false, originalTokens };
  }
  
  // Calculate max characters (using same ratio)
  const maxChars = Math.floor(maxTokens * 3.5);
  
  // VA decision letters: important content is usually at the beginning (decision)
  // and end (appeal rights, reasons for decision)
  // Strategy: Keep first 60% and last 40% of allowed space
  const firstPartChars = Math.floor(maxChars * 0.6);
  const lastPartChars = maxChars - firstPartChars - 100; // 100 chars for truncation notice
  
  const firstPart = text.slice(0, firstPartChars);
  const lastPart = text.slice(-lastPartChars);
  
  // Find clean break points (sentence endings)
  const firstPartClean = firstPart.slice(0, firstPart.lastIndexOf('. ') + 1) || firstPart;
  const lastPartStart = lastPart.indexOf('. ');
  const lastPartClean = lastPartStart > 0 ? lastPart.slice(lastPartStart + 2) : lastPart;
  
  const truncatedText = `${firstPartClean.trim()}\n\n[... Document truncated for AI processing - middle section omitted ...]\n\n${lastPartClean.trim()}`;
  
  console.log(`📏 Smart truncation: ${originalTokens} tokens → ~${estimateTokenCount(truncatedText)} tokens`);
  
  return {
    text: truncatedText,
    wasTruncated: true,
    originalTokens,
    truncatedTokens: estimateTokenCount(truncatedText)
  };
};

/**
 * Build prompt for decision decoding
 * Now with smart truncation to prevent context overflow
 */
const buildDecisionDecoderPrompt = (decisionText, truncationInfo = null) => {
  return `You are a VA Claims Appeals Expert who translates confusing VA decision letters into plain English.

A veteran received this VA decision and doesn't understand what it means:
"""
${decisionText}
"""

YOUR GOAL:
1. Translate this into plain English a non-lawyer can understand
2. Identify FAVORABLE FINDINGS first (what the VA already conceded/accepted)
3. Identify what evidence the VA says is STILL MISSING (only things NOT already conceded)
4. Provide a clear ACTION PLAN that does NOT contradict favorable findings

⚠️ CRITICAL: If the VA conceded something (e.g., "stressor is conceded", "service connection is established"), 
DO NOT list that as missing or tell the veteran to prove it again. Focus ONLY on what's actually missing.

OUTPUT FORMAT:
Respond ONLY with a valid JSON object (no markdown, no code blocks, just pure JSON):
{
  "decision_type": "Full Denial | Partial Denial | Reduction | Deferred | Granted",
  "favorable_findings": [
    "List things the VA already accepted/conceded (e.g., 'Stressor conceded', 'Service connection established')",
    "These are wins - do NOT contradict these in missing_elements or action_plan"
  ],
  "plain_english": "In simple terms, the VA is saying... (1-2 sentences)",
  "va_reasoning": "The VA made this decision because... (explain their logic)",
  "missing_elements": [
    "First thing ACTUALLY missing (not already conceded)",
    "Second thing missing (if any)",
    "Third thing missing (if any)"
  ],
  "action_plan": [
    "Step 1: Specific action to take (focused on what's actually missing)",
    "Step 2: Next specific action",
    "Step 3: Additional steps if needed"
  ],
  "appeal_options": "Brief explanation of appeal options (Supplemental Claim, HLR, or BVA)",
  "deadline_warning": "You typically have 1 year from the decision date to file an appeal while preserving your effective date. Check your decision letter for specific deadlines."
}

KEY DENIAL REASONS TO WATCH FOR:
- "No nexus" = Need a doctor's letter connecting condition to service
- "No current diagnosis" = Need a current diagnosis from a qualified provider (psychiatrist/psychologist for mental health)
- "Not incurred in service" = Need service records or buddy statements
- "Less likely than not" = C&P examiner gave negative opinion, may need IMO
- "No aggravation shown" = For secondary claims, need evidence showing the primary condition made it worse

PTSD-SPECIFIC NOTES:
- If "stressor is conceded" appears in favorable findings, do NOT tell veteran to prove stressor
- LICSW (Licensed Clinical Social Worker) diagnoses may not be accepted - must be psychiatrist/psychologist
- Vet Center counselors are often LICSWs - diagnosis may need to come from VA or private psychiatrist

Be empathetic but professional. This veteran is confused and possibly upset. Help them understand and take action.`;
};

/**
 * Decode a VA decision letter using Gemini AI
 * Now with smart truncation to prevent context overflow for Local AI (4096 token limit)
 * @param {string} decisionText - The decision letter text to analyze
 * @returns {Promise<{success: boolean, data?: object, error?: string}>}
 */
export const decodeDecision = async (decisionText) => {
  // Check if any AI is available via unified service
  if (!isAnyAIAvailable()) {
    return { success: false, error: 'No AI available. Configure an API key or enable Local AI in Settings.' };
  }

  // Smart truncation to fit within Local AI context window
  // Local AI has 4096 token limit. Our prompt template is ~600 tokens.
  // We need to leave ~1500 tokens for AI response.
  // So max input text is: 4096 - 600 (prompt) - 1500 (response) = ~2000 tokens
  // BUT generateAI adds its own system prompt (~500 tokens), so we limit input to 1200 tokens
  // to be safe: 1200 (input) + 600 (our prompt) + 500 (system prompt) + 1500 (response) = 3800 < 4096
  const truncation = smartTruncateForAI(decisionText, 1200);
  
  if (truncation.wasTruncated) {
    console.log(`📏 Decision text truncated: ${truncation.originalTokens} → ${truncation.truncatedTokens} tokens`);
  }

  const prompt = buildDecisionDecoderPrompt(truncation.text, truncation);

  try {
    // Use unified AI service with minimal system prompt
    // The decision decoder prompt already includes all necessary context
    // Set a 90-second timeout to match UI expectations
    const response = await generateAI(prompt, {
      temperature: 0.3,
      maxTokens: 1500, // Reduced from 2048 to leave room for context
      expectJSON: true,
      timeout: 90000, // 90 seconds - match UI timeout
      // Tell generateAI to use a minimal/empty system prompt since our prompt is self-contained
      systemPrompt: 'You are a VA claims expert. Respond only with valid JSON.',
      taskType: 'legal', // Use legal preset for accuracy
      skipValidation: true, // We'll validate the JSON ourselves
      skipHallucinationCheck: true, // Decision decoder returns plain_english analysis, NOT diagnostic codes
    });
    
    // generateAI returns { text, mode, fallback?, fallbackReason?, note? } object
    const text = response?.text || response;
    const usedFallback = response?.fallback || false;
    const fallbackReason = response?.fallbackReason || null;
    const fallbackNote = response?.note || null;
    
    if (!text) {
      return { success: false, error: 'No response generated. Please try again.' };
    }

    const textStr = typeof text === 'string' ? text : JSON.stringify(text);

    // Better JSON parsing with multiple fallback strategies
    try {
      let cleanedText = textStr.trim();
      
      // Remove markdown code blocks
      if (cleanedText.startsWith('```json')) {
        cleanedText = cleanedText.replace(/^```json\n?/, '').replace(/\n?```$/, '');
      } else if (cleanedText.startsWith('```')) {
        cleanedText = cleanedText.replace(/^```\n?/, '').replace(/\n?```$/, '');
      }
      
      // Try to extract JSON if the response has extra text
      const jsonMatch = cleanedText.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        cleanedText = jsonMatch[0];
      }
      
      // Check if response is an error message (not JSON)
      // Note: '[]' is valid JSON (empty array), so we check specifically for error-like patterns
      if (cleanedText.startsWith('[') && !cleanedText.startsWith('[{') && cleanedText !== '[]') {
        // Likely an error message like "[Warrant Council..."
        console.error('AI returned error message instead of JSON:', cleanedText.substring(0, 200));
        return {
          success: false,
          error: 'AI model is still loading or encountered an error. Please wait a moment and try again.',
          isModelLoading: cleanedText.includes('loading') || cleanedText.includes('wait')
        };
      }
      
      const decodedData = JSON.parse(cleanedText);
      
      // Include fallback info and truncation info in response for UI to show helpful messages
      return {
        success: true,
        data: decodedData,
        // Pass through fallback info so UI can show helpful message
        ...(usedFallback && {
          usedFallback: true,
          fallbackReason,
          fallbackNote
        }),
        // Pass through truncation info so UI can show notice about truncated content
        ...(truncation.wasTruncated && {
          wasTruncated: true,
          originalTokens: truncation.originalTokens,
          truncatedTokens: truncation.truncatedTokens,
          truncationNote: `Your document was too large (${truncation.originalTokens} tokens). We analyzed the first and last sections to fit within AI limits.`
        })
      };
    } catch (parseError) {
      console.error(' Failed to parse decision decoder JSON:', parseError, textStr);
      
      // Check if the AI response indicates it's still loading
      const lowerText = textStr.toLowerCase();
      if (lowerText.includes('loading') || lowerText.includes('wait') || lowerText.includes('initializing')) {
        return {
          success: false,
          error: 'AI model is still loading. Please wait for the model to fully load and try again.',
          isModelLoading: true
        };
      }
      
      // Check if it looks like a partial/cut-off response
      if (!textStr.includes('}') || textStr.length < 50) {
        return {
          success: false,
          error: 'AI response was incomplete. This may be due to token limits. Please try with a shorter excerpt of your decision letter.',
          isIncomplete: true
        };
      }
      
      return { success: false, error: 'Failed to parse AI response. Please try again.' };
    }
  } catch (error) {
    console.error('Decision decoder error:', error);
    
    // Check for context overflow error and provide helpful message
    const errorMsg = error.message || '';
    if (errorMsg.includes('too large') || errorMsg.includes('context') || errorMsg.includes('4096') ||
        errorMsg.includes('ContextWindowSizeExceeded') || errorMsg.includes('prompt tokens exceed')) {
      return {
        success: false,
        error: 'Document is too large for AI processing. Please try pasting only the "Reasons for Decision" section of your letter.',
        isContextOverflow: true
      };
    }
    
    // Check for model loading errors
    if (errorMsg.includes('warming up') || errorMsg.includes('not loaded') || errorMsg.includes('not ready')) {
      return {
        success: false,
        error: 'AI model is still loading. Please wait for the model to fully load and try again.',
        isModelLoading: true
      };
    }
    
    return { success: false, error: errorMsg || 'Network error. Please check your connection and try again.' };
  }
};

// Re-export unified AI service functions for convenience
export { 
  isLocalAIReady, 
  isCloudAIAvailable, 
  getAIStatus,
  AI_MODES 
} from './unifiedAIService';

export default {
  isAIAvailable,
  enhancePersonalStatement,
  enhanceBuddyStatement,
  enhancePTSDStatement,
  enhanceAppealStatement,
  generateNexusLetterRequest,
  enhanceFormStatement,
  getAIDataDisclosure,
  generateFieldSuggestion,
  searchStateBenefits,
  searchVSOs,
  stressTestStatement,
  decodeDecision,
  // New unified AI exports
  isLocalAIReady,
  isCloudAIAvailable,
  getAIStatus,
  AI_MODES
};
