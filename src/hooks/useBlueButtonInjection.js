/**
 * Blue Button Medical Data Injection Hook
 * "The Missing Link"
 * 
 * Purpose: Auto-populate intake questionnaire answers from VA health data (Blue Button).
 * 
 * The Miss: Right now, SmartIntake asks about symptoms. But if the user has their 
 * Blue Button (VA Health Data) file, we can auto-answer those questions by matching 
 * ICD-10 diagnosis codes to question IDs.
 * 
 * The Fix: Bridge BlueButtonXRay component to intake answers via ICD-10 code mapping.
 * 
 * Architecture:
 * 1. BlueButtonXRay parses Blue Button XML/JSON and extracts problem list (diagnoses)
 * 2. This hook maps ICD-10 codes to intake question IDs
 * 3. Auto-answers are injected into userAnswers state
 * 4. SmartIntake skips those questions (already answered by medical record)
 * 
 * Usage:
 *   import { injectMedicalData } from './hooks/useBlueButtonInjection';
 *   
 *   // After parsing Blue Button file:
 *   const problemList = ['ICD-10: G47.33', 'ICD-10: J30.1', 'ICD-10: M79.7'];
 *   const autoAnswers = injectMedicalData(problemList);
 *   
 *   // Merge with existing answers:
 *   setIntakeAnswers(prev => ({ ...prev, ...autoAnswers }));
 */

// ========================================
// ICD-10 TO QUESTION ID MAPPING
// ========================================

/**
 * Map of ICD-10 codes to intake question IDs and answer values
 * 
 * Structure:
 * {
 *   'ICD_CODE': {
 *     questionId: 'question_id_from_intake_questions_db',
 *     answer: true | false | string | array,
 *     confidence: 'high' | 'medium' | 'low',
 *     note: 'Human-readable explanation of the mapping'
 *   }
 * }
 */
export const ICD10_MAPPING = {
  // ========================================
  // SLEEP CONDITIONS
  // ========================================
  'G47.33': {
    questionId: 'q_sleep_issues',
    answer: true,
    relatedQuestions: [
      { questionId: 'q_sleep_apnea_dx', answer: true }
    ],
    confidence: 'high',
    note: 'Obstructive Sleep Apnea (OSA) - Common VA claim',
    tags: ['SLEEP_APNEA_DIAGNOSED']
  },
  
  'G47.30': {
    questionId: 'q_sleep_issues',
    answer: true,
    confidence: 'medium',
    note: 'Sleep Apnea, Unspecified',
    tags: ['SLEEP_ISSUES']
  },

  // ========================================
  // RESPIRATORY CONDITIONS (PACT ACT)
  // ========================================
  'J30.1': {
    questionId: 'q_respiratory_symptoms',
    answer: ['rhinitis'],
    relatedQuestions: [
      { questionId: 'q_pact_respiratory', answer: true }
    ],
    confidence: 'high',
    note: 'Allergic Rhinitis - PACT Act presumptive if Gulf War/Post-9/11 service',
    tags: ['RHINITIS_DIAGNOSED', 'PACT_CANDIDATE']
  },

  'J45.9': {
    questionId: 'q_respiratory_symptoms',
    answer: ['asthma'],
    confidence: 'high',
    note: 'Asthma, Unspecified - PACT Act connection possible',
    tags: ['ASTHMA_DIAGNOSED', 'PACT_CANDIDATE']
  },

  // ========================================
  // MUSCULOSKELETAL CONDITIONS
  // ========================================
  'M79.7': {
    questionId: 'q_pain_locations',
    answer: ['generalized'],
    relatedQuestions: [
      { questionId: 'q_fibromyalgia', answer: true }
    ],
    confidence: 'medium',
    note: 'Fibromyalgia - Often secondary to PTSD or sleep apnea',
    tags: ['CHRONIC_PAIN', 'FIBROMYALGIA_DIAGNOSED']
  },

  'M25.561': {
    questionId: 'q_pain_locations',
    answer: ['knee'],
    confidence: 'high',
    note: 'Pain in right knee',
    tags: ['KNEE_PAIN_RIGHT']
  },

  'M25.562': {
    questionId: 'q_pain_locations',
    answer: ['knee'],
    confidence: 'high',
    note: 'Pain in left knee',
    tags: ['KNEE_PAIN_LEFT']
  },

  'M54.5': {
    questionId: 'q_pain_locations',
    answer: ['lower_back'],
    confidence: 'high',
    note: 'Low back pain (Lumbar strain)',
    tags: ['BACK_PAIN_LUMBAR']
  },

  // ========================================
  // MENTAL HEALTH CONDITIONS
  // ========================================
  'F43.10': {
    questionId: 'q_mental_health_dx',
    answer: ['ptsd'],
    relatedQuestions: [
      { questionId: 'q_ptsd_symptoms', answer: true }
    ],
    confidence: 'high',
    note: 'Post-Traumatic Stress Disorder (PTSD)',
    tags: ['PTSD_DIAGNOSED']
  },

  'F33.1': {
    questionId: 'q_mental_health_dx',
    answer: ['depression'],
    confidence: 'high',
    note: 'Major Depressive Disorder, Recurrent, Moderate',
    tags: ['DEPRESSION_DIAGNOSED']
  },

  'F41.1': {
    questionId: 'q_mental_health_dx',
    answer: ['anxiety'],
    confidence: 'high',
    note: 'Generalized Anxiety Disorder',
    tags: ['ANXIETY_DIAGNOSED']
  },

  // ========================================
  // NEUROLOGICAL CONDITIONS
  // ========================================
  'G43.909': {
    questionId: 'q_headache_type',
    answer: 'migraines',
    confidence: 'high',
    note: 'Migraine, Unspecified',
    tags: ['MIGRAINES_DIAGNOSED']
  },

  'H93.1': {
    questionId: 'q_hearing_symptoms',
    answer: ['tinnitus'],
    confidence: 'high',
    note: 'Tinnitus - Most common VA claim',
    tags: ['TINNITUS_DIAGNOSED']
  },

  'S06.0X0A': {
    questionId: 'q_head_injury_history',
    answer: true,
    relatedQuestions: [
      { questionId: 'q_tbi_symptoms', answer: true }
    ],
    confidence: 'medium',
    note: 'Concussion (Traumatic Brain Injury)',
    tags: ['TBI_SUSPECTED', 'HEAD_INJURY_DOCUMENTED']
  },

  // ========================================
  // GASTROINTESTINAL CONDITIONS
  // ========================================
  'K21.9': {
    questionId: 'q_gi_symptoms',
    answer: ['gerd'],
    confidence: 'high',
    note: 'Gastroesophageal Reflux Disease (GERD)',
    tags: ['GERD_DIAGNOSED']
  },

  'K58.9': {
    questionId: 'q_gi_symptoms',
    answer: ['ibs'],
    confidence: 'high',
    note: 'Irritable Bowel Syndrome (IBS) - Often secondary to PTSD',
    tags: ['IBS_DIAGNOSED']
  },

  // ========================================
  // SKIN CONDITIONS (PACT ACT)
  // ========================================
  'L40.9': {
    questionId: 'q_skin_conditions',
    answer: ['psoriasis'],
    confidence: 'medium',
    note: 'Psoriasis - Check for presumptive eligibility',
    tags: ['PSORIASIS_DIAGNOSED']
  },

  // ========================================
  // CARDIOVASCULAR CONDITIONS
  // ========================================
  'I10': {
    questionId: 'q_cardiovascular_dx',
    answer: ['hypertension'],
    confidence: 'high',
    note: 'Hypertension - Often secondary to sleep apnea or PTSD',
    tags: ['HYPERTENSION_DIAGNOSED']
  }
};

// ========================================
// INJECTION LOGIC
// ========================================

/**
 * Extract ICD-10 code from various problem list formats
 * 
 * Supports:
 * - "ICD-10: G47.33"
 * - "G47.33 - Sleep Apnea"
 * - "Obstructive Sleep Apnea (G47.33)"
 * 
 * @param {string} problemText - Raw text from problem list
 * @returns {string|null} Extracted ICD-10 code or null
 */
export const extractICD10Code = (problemText) => {
  // Match ICD-10 pattern: Letter followed by digits and optional decimal
  const match = problemText.match(/([A-Z]\d{2}\.?\d{0,2})/);
  return match ? match[1] : null;
};

/**
 * Inject medical data from Blue Button problem list into intake answers
 * 
 * @param {Array<string>} problemList - Array of diagnosis strings with ICD-10 codes
 * @returns {Object} Object with questionId keys and answer values
 * 
 * Example:
 *   const answers = injectMedicalData(['ICD-10: G47.33', 'ICD-10: J30.1']);
 *   // Returns: { q_sleep_issues: true, q_sleep_apnea_dx: true, q_respiratory_symptoms: ['rhinitis'], ... }
 */
export const injectMedicalData = (problemList) => {
  const autoAnswers = {};
  const autoTags = [];

  problemList.forEach(problemText => {
    const icd10Code = extractICD10Code(problemText);
    
    if (!icd10Code) {
      console.warn(`[Blue Button Injection] Could not extract ICD-10 code from: "${problemText}"`);
      return;
    }

    const mapping = ICD10_MAPPING[icd10Code];
    
    if (!mapping) {
      console.log(`[Blue Button Injection] No mapping found for ICD-10 code: ${icd10Code}`);
      return;
    }

    // Inject primary answer
    autoAnswers[mapping.questionId] = mapping.answer;

    // Inject related questions (e.g., q_sleep_apnea_dx when sleep_issues is true)
    if (mapping.relatedQuestions) {
      mapping.relatedQuestions.forEach(related => {
        autoAnswers[related.questionId] = related.answer;
      });
    }

    // Collect tags
    if (mapping.tags) {
      autoTags.push(...mapping.tags);
    }

    console.log(
      `[Blue Button Injection] Mapped ${icd10Code} (${mapping.note}) → ${mapping.questionId} = ${JSON.stringify(mapping.answer)}`
    );
  });

  return {
    answers: autoAnswers,
    tags: [...new Set(autoTags)] // Deduplicate tags
  };
};

/**
 * Get human-readable summary of injected data (for UI display)
 * 
 * @param {Array<string>} problemList - Diagnosis strings
 * @returns {Array<Object>} Array of { icd10, condition, questionId, confidence }
 */
export const getInjectionSummary = (problemList) => {
  const summary = [];

  problemList.forEach(problemText => {
    const icd10Code = extractICD10Code(problemText);
    
    if (!icd10Code) return;

    const mapping = ICD10_MAPPING[icd10Code];
    
    if (!mapping) return;

    summary.push({
      icd10: icd10Code,
      condition: mapping.note,
      questionId: mapping.questionId,
      confidence: mapping.confidence,
      autoAnswered: true
    });
  });

  return summary;
};

/**
 * Check if a given ICD-10 code is mapped
 * 
 * @param {string} icd10Code - ICD-10 code
 * @returns {boolean}
 */
export const hasMapping = (icd10Code) => {
  return Boolean(ICD10_MAPPING[icd10Code]);
};

/**
 * Get all mapped ICD-10 codes (for debugging/development)
 * 
 * @returns {Array<string>}
 */
export const getMappedICD10Codes = () => {
  return Object.keys(ICD10_MAPPING);
};
