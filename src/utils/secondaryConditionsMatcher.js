/**
 * Secondary Conditions Matcher Utility
 * Maps user disability input to normalized condition slugs
 * Used for matching against secondary_conditions_db.json
 */

/**
 * Normalizes a condition name to a standard slug
 * @param {string} condition - The raw condition name from user input
 * @returns {string|null} - Normalized slug or null if no match
 */
export function normalizeCondition(condition) {
  const normalized = condition.toLowerCase().trim();
  
  // Mental Health Conditions
  if (normalized.includes('ptsd') || normalized.includes('post-traumatic stress') || normalized.includes('post traumatic stress')) {
    return 'ptsd';
  }
  if (normalized.includes('anxiety') || normalized.includes('generalized anxiety')) {
    return 'anxiety';
  }
  if (normalized.includes('depression') || normalized.includes('depressive disorder') || normalized.includes('major depression')) {
    return 'depression';
  }
  
  // Auditory Conditions
  if (normalized.includes('tinnitus') || normalized.includes('ringing in ears') || normalized.includes('ear ringing')) {
    return 'tinnitus';
  }
  if (normalized.includes('hearing loss') || normalized.includes('hearing impairment') || normalized.includes('deafness')) {
    return 'hearing_loss';
  }
  
  // Sleep Conditions
  if (normalized.includes('sleep apnea') || normalized.includes('osa') || normalized.includes('obstructive sleep') || 
      normalized.includes('apnea') || normalized.includes('sleep disorder') && normalized.includes('breathing')) {
    return 'sleep_apnea';
  }
  
  // Knee Conditions (laterality matters)
  if ((normalized.includes('knee') || normalized.includes('patella')) && 
      (normalized.includes('right') || normalized.includes('rt') || normalized.includes('r.'))) {
    return 'knee_right';
  }
  if ((normalized.includes('knee') || normalized.includes('patella')) && 
      (normalized.includes('left') || normalized.includes('lt') || normalized.includes('l.'))) {
    return 'knee_left';
  }
  if (normalized.includes('knee') && !normalized.includes('bilateral')) {
    // If knee is mentioned but no side specified, could match both
    return 'knee_unspecified';
  }
  
  // Shoulder Conditions
  if ((normalized.includes('shoulder') || normalized.includes('rotator cuff')) && 
      (normalized.includes('right') || normalized.includes('rt') || normalized.includes('r.'))) {
    return 'shoulder_right';
  }
  if ((normalized.includes('shoulder') || normalized.includes('rotator cuff')) && 
      (normalized.includes('left') || normalized.includes('lt') || normalized.includes('l.'))) {
    return 'shoulder_left';
  }
  
  // Hip Conditions
  if (normalized.includes('hip') && 
      (normalized.includes('right') || normalized.includes('rt') || normalized.includes('r.'))) {
    return 'hip_right';
  }
  if (normalized.includes('hip') && 
      (normalized.includes('left') || normalized.includes('lt') || normalized.includes('l.'))) {
    return 'hip_left';
  }
  
  // Ankle Conditions
  if (normalized.includes('ankle') && 
      (normalized.includes('right') || normalized.includes('rt') || normalized.includes('r.'))) {
    return 'ankle_right';
  }
  if (normalized.includes('ankle') && 
      (normalized.includes('left') || normalized.includes('lt') || normalized.includes('l.'))) {
    return 'ankle_left';
  }
  
  // Spine Conditions
  if (normalized.includes('lumbar') || normalized.includes('lower back') || 
      normalized.includes('lumbosacral') || (normalized.includes('back') && normalized.includes('lower'))) {
    return 'lumbar_spine';
  }
  if (normalized.includes('cervical') || normalized.includes('neck') || 
      (normalized.includes('spine') && normalized.includes('upper'))) {
    return 'cervical_spine';
  }
  
  // Pain Conditions (important for NSAID medication bridge)
  if ((normalized.includes('pain') || normalized.includes('arthritis') || 
       normalized.includes('degenerative') || normalized.includes('osteoarthritis')) &&
      (normalized.includes('chronic') || normalized.includes('knee') || 
       normalized.includes('back') || normalized.includes('shoulder') || 
       normalized.includes('hip') || normalized.includes('ankle'))) {
    return 'chronic_pain_nsaid';
  }
  
  // Peripheral Neuropathy
  if (normalized.includes('neuropathy') || normalized.includes('peripheral neuropathy') || 
      normalized.includes('diabetic neuropathy')) {
    return 'peripheral_neuropathy';
  }
  
  return null;
}

/**
 * Determines if a condition likely requires NSAID use
 * @param {string} condition - The raw condition name
 * @returns {boolean}
 */
export function requiresNSAIDuse(condition) {
  const normalized = condition.toLowerCase();
  const nsaidKeywords = [
    'pain', 'arthritis', 'degenerative', 'osteoarthritis', 
    'knee', 'back', 'shoulder', 'hip', 'ankle', 'spine',
    'joint', 'tendinitis', 'bursitis', 'inflammation'
  ];
  
  return nsaidKeywords.some(keyword => normalized.includes(keyword));
}

/**
 * Checks if condition is a lower body joint (for orthopedic cascade logic)
 * @param {string} slug - Normalized condition slug
 * @returns {boolean}
 */
export function isLowerBodyJoint(slug) {
  const lowerBodySlugs = [
    'knee_right', 'knee_left', 'hip_right', 'hip_left', 
    'ankle_right', 'ankle_left', 'lumbar_spine'
  ];
  return lowerBodySlugs.includes(slug);
}

/**
 * Gets contralateral (opposite side) joint
 * @param {string} slug - Normalized condition slug (e.g., 'knee_right')
 * @returns {string|null} - Contralateral slug (e.g., 'knee_left')
 */
export function getContralateralJoint(slug) {
  const mapping = {
    'knee_right': 'knee_left',
    'knee_left': 'knee_right',
    'hip_right': 'hip_left',
    'hip_left': 'hip_right',
    'shoulder_right': 'shoulder_left',
    'shoulder_left': 'shoulder_right',
    'ankle_right': 'ankle_left',
    'ankle_left': 'ankle_right'
  };
  return mapping[slug] || null;
}

/**
 * Maps condition to readable display name
 * @param {string} slug - Normalized condition slug
 * @returns {string} - Human-readable name
 */
export function getDisplayName(slug) {
  const displayNames = {
    'ptsd': 'Post-Traumatic Stress Disorder (PTSD)',
    'anxiety': 'Generalized Anxiety Disorder',
    'depression': 'Major Depressive Disorder',
    'tinnitus': 'Tinnitus (Ringing in Ears)',
    'hearing_loss': 'Hearing Loss (Sensorineural)',
    'sleep_apnea': 'Obstructive Sleep Apnea (OSA)',
    'knee_right': 'Right Knee Condition',
    'knee_left': 'Left Knee Condition',
    'shoulder_right': 'Right Shoulder Condition',
    'shoulder_left': 'Left Shoulder Condition',
    'hip_right': 'Right Hip Condition',
    'hip_left': 'Left Hip Condition',
    'ankle_right': 'Right Ankle Condition',
    'ankle_left': 'Left Ankle Condition',
    'lumbar_spine': 'Lumbar Spine / Lower Back',
    'cervical_spine': 'Cervical Spine / Neck',
    'chronic_pain_nsaid': 'Chronic Pain Requiring NSAID Use',
    'peripheral_neuropathy': 'Peripheral Neuropathy'
  };
  return displayNames[slug] || slug;
}
