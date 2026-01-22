/**
 * VA Disability Rating Calculator
 * Implements 38 CFR § 4.25 - Combined Ratings Table
 * 
 * The VA uses "efficiency" math, not simple addition.
 * Each rating reduces the remaining "whole person" efficiency.
 * 
 * CRITICAL RULES:
 * - 38 CFR § 4.14: Pyramiding prohibited (same manifestation cannot be rated twice)
 * - 38 CFR § 4.26: Bilateral factor for paired extremities (10% boost)
 * - 38 CFR § 4.66: Amputation special rules (minimum guaranteed ratings)
 * - 38 CFR § 3.400: Payment effective date is first of month following effective date
 */

/**
 * Calculate Payment Effective Date per 38 CFR § 3.400
 * Payment begins the first day of the month following the effective date
 * 
 * @param {Date|string} effectiveDate - The effective date of the claim
 * @returns {Date} - The payment effective date (first of following month)
 * 
 * Examples:
 * - Effective 12/3/2025 → Payment starts 1/1/2026
 * - Effective 6/30/2024 → Payment starts 7/1/2024
 * - Effective 3/15/2023 → Payment starts 4/1/2023
 */
export const calculatePaymentEffectiveDate = (effectiveDate) => {
  const date = new Date(effectiveDate);
  // Move to first day of next month
  date.setMonth(date.getMonth() + 1);
  date.setDate(1);
  date.setHours(0, 0, 0, 0);
  return date;
};

/**
 * Calculate months of backpay between two dates
 * Uses payment effective dates (first of month) per 38 CFR § 3.400
 * 
 * @param {Date|string} effectiveDate - Original effective date
 * @param {Date|string} currentDate - Current date (defaults to today)
 * @returns {Object} - Backpay calculation details
 */
export const calculateBackpayMonths = (effectiveDate, currentDate = new Date()) => {
  const paymentEffectiveDate = calculatePaymentEffectiveDate(effectiveDate);
  const current = new Date(currentDate);
  
  // Calculate full months between payment effective date and current date
  const yearsDiff = current.getFullYear() - paymentEffectiveDate.getFullYear();
  const monthsDiff = current.getMonth() - paymentEffectiveDate.getMonth();
  const totalMonths = Math.max(0, (yearsDiff * 12) + monthsDiff);
  
  return {
    effectiveDate: new Date(effectiveDate),
    paymentEffectiveDate,
    currentDate: current,
    totalMonths,
    explanation: `Payment starts first of month following effective date (38 CFR § 3.400)`
  };
};

// 2026 VA Disability Compensation Rates (Effective Dec 1, 2025)
// Source: https://www.va.gov/disability/compensation-rates/veteran-rates/
// Last updated: December 2, 2025
export const VA_PAY_RATES_2026 = {
  // Base rates for veteran alone (no dependents)
  solo: {
    0: 0,
    10: 180.42,
    20: 356.66,
    30: 552.47,
    40: 795.84,
    50: 1132.90,
    60: 1435.02,
    70: 1808.45,
    80: 2102.15,
    90: 2362.30,
    100: 3938.58,
  },
  // Additional amounts for spouse (added to base for 30%+)
  // These are the ADDITIONAL amounts, not totals
  spouse: {
    30: 65.00,
    40: 87.00,
    50: 109.00,
    60: 131.00,
    70: 153.00,
    80: 175.00,
    90: 197.00,
    100: 219.59,
  },
  // Added amount for spouse receiving Aid and Attendance
  spouseAidAttendance: {
    30: 61.00,
    40: 81.00,
    50: 101.00,
    60: 121.00,
    70: 141.00,
    80: 161.00,
    90: 181.00,
    100: 201.41,
  },
  // Each additional child under 18 (first child included in base with child rates)
  childUnder18: {
    30: 32.00,
    40: 43.00,
    50: 54.00,
    60: 65.00,
    70: 76.00,
    80: 87.00,
    90: 98.00,
    100: 109.11,
  },
  // Each additional child 18+ in qualifying school program
  childSchool: {
    30: 105.00,
    40: 140.00,
    50: 176.00,
    60: 211.00,
    70: 246.00,
    80: 281.00,
    90: 317.00,
    100: 352.45,
  },
  // Additional amount for 1 dependent parent
  parentOne: {
    30: 52.00,
    40: 70.00,
    50: 88.00,
    60: 105.00,
    70: 123.00,
    80: 140.00,
    90: 158.00,
    100: 176.24,
  },
  // Additional amount for 2 dependent parents
  parentTwo: {
    30: 104.00,
    40: 140.00,
    50: 176.00,
    60: 210.00,
    70: 246.00,
    80: 280.00,
    90: 316.00,
    100: 352.48,
  },
  // First child addition (added to solo rate when veteran has 1+ child)
  // Calculated from "Veteran with 1 child only" minus "Veteran alone"
  firstChild: {
    30: 44.00,  // 596.47 - 552.47
    40: 58.00,  // 853.84 - 795.84
    50: 73.00,  // 1205.90 - 1132.90
    60: 88.00,  // 1523.02 - 1435.02
    70: 102.00, // 1910.45 - 1808.45
    80: 117.00, // 2219.15 - 2102.15
    90: 132.00, // 2494.30 - 2362.30
    100: 146.85, // 4085.43 - 3938.58
  },
};

// Body part categories for bilateral detection
export const BODY_PARTS = {
  extremities: [
    { value: 'shoulder', label: 'Shoulder', canBeBilateral: true },
    { value: 'arm', label: 'Arm (Upper)', canBeBilateral: true },
    { value: 'elbow', label: 'Elbow', canBeBilateral: true },
    { value: 'forearm', label: 'Forearm', canBeBilateral: true },
    { value: 'wrist', label: 'Wrist', canBeBilateral: true },
    { value: 'hand', label: 'Hand', canBeBilateral: true },
    { value: 'fingers', label: 'Fingers', canBeBilateral: true },
    { value: 'hip', label: 'Hip', canBeBilateral: true },
    { value: 'thigh', label: 'Thigh', canBeBilateral: true },
    { value: 'knee', label: 'Knee', canBeBilateral: true },
    { value: 'leg', label: 'Leg (Lower)', canBeBilateral: true },
    { value: 'ankle', label: 'Ankle', canBeBilateral: true },
    { value: 'foot', label: 'Foot', canBeBilateral: true },
    { value: 'toes', label: 'Toes', canBeBilateral: true },
  ],
  other: [
    { value: 'head', label: 'Head/Brain', canBeBilateral: false },
    { value: 'eye', label: 'Eye(s)', canBeBilateral: true },
    { value: 'ear', label: 'Ear(s)/Hearing', canBeBilateral: true },
    { value: 'nose', label: 'Nose/Sinuses', canBeBilateral: false },
    { value: 'mouth', label: 'Mouth/Teeth', canBeBilateral: false },
    { value: 'neck', label: 'Neck/Cervical Spine', canBeBilateral: false },
    { value: 'back', label: 'Back/Thoracolumbar Spine', canBeBilateral: false },
    { value: 'chest', label: 'Chest/Ribs', canBeBilateral: false },
    { value: 'heart', label: 'Heart/Cardiovascular', canBeBilateral: false },
    { value: 'lungs', label: 'Lungs/Respiratory', canBeBilateral: false },
    { value: 'digestive', label: 'Digestive System', canBeBilateral: false },
    { value: 'kidney', label: 'Kidney(s)', canBeBilateral: true },
    { value: 'bladder', label: 'Bladder/Urinary', canBeBilateral: false },
    { value: 'reproductive', label: 'Reproductive System', canBeBilateral: false },
    { value: 'skin', label: 'Skin', canBeBilateral: false },
    { value: 'mental', label: 'Mental Health (PTSD, etc.)', canBeBilateral: false },
    { value: 'tbi', label: 'TBI', canBeBilateral: false },
    { value: 'diabetes', label: 'Diabetes', canBeBilateral: false },
    { value: 'migraines', label: 'Migraines', canBeBilateral: false },
    { value: 'other', label: 'Other', canBeBilateral: false },
  ],
};

/**
 * Combine two ratings using VA "efficiency" math
 * Formula: A + B(1-A) where A and B are decimals
 * Example: 50% + 30% = 0.5 + 0.3(1-0.5) = 0.5 + 0.15 = 0.65 = 65%
 * 
 * CRITICAL: No intermediate rounding - only round to 1 decimal for precision
 * This matches VA Combined Ratings Table (38 CFR § 4.25)
 */
export const combineTwoRatings = (rating1, rating2) => {
  // Validate inputs
  if (typeof rating1 !== 'number' || typeof rating2 !== 'number') {
    console.error('Invalid rating input:', rating1, rating2);
    return 0;
  }
  if (rating1 < 0 || rating1 > 100 || rating2 < 0 || rating2 > 100) {
    console.error('Rating out of range:', rating1, rating2);
    return Math.max(0, Math.min(100, rating1));
  }
  
  const a = rating1 / 100;
  const b = rating2 / 100;
  // Round to 1 decimal to match VA table precision
  const result = Math.round((a + b * (1 - a)) * 100 * 10) / 10;
  return result;
};

/**
 * Combine multiple ratings using VA math
 * Must sort descending and apply iteratively
 */
export const combineMultipleRatings = (ratings) => {
  if (ratings.length === 0) return 0;
  if (ratings.length === 1) return ratings[0];
  
  // Sort descending
  const sorted = [...ratings].sort((a, b) => b - a);
  
  let combined = sorted[0];
  for (let i = 1; i < sorted.length; i++) {
    combined = combineTwoRatings(combined, sorted[i]);
  }
  
  return combined;
};

/**
 * Round to nearest 10 (VA final rounding rule)
 * Per 38 CFR § 4.25: "combined values ending in 5 will be adjusted upward"
 * Examples: 65 → 70, 74 → 70, 75 → 80, 84 → 80, 85 → 90
 */
export const roundToNearest10 = (value) => {
  // JavaScript Math.round() correctly rounds 0.5 up
  // 6.5 → 7, 7.4 → 7, 7.5 → 8
  const rounded = Math.round(value / 10) * 10;
  return Math.max(0, Math.min(100, rounded)); // Clamp to 0-100
};

/**
 * Calculate the Bilateral Factor
 * Per 38 CFR § 4.26: Add 10% to the combined bilateral rating
 * 
 * @param {Array} bilateralRatings - Array of ratings affecting paired extremities
 * @returns {number} - The bilateral group rating (with 10% factor applied)
 */
export const calculateBilateralFactor = (bilateralRatings) => {
  if (bilateralRatings.length === 0) return 0;
  if (bilateralRatings.length === 1) return bilateralRatings[0];
  
  // Combine all bilateral ratings first
  const combined = combineMultipleRatings(bilateralRatings);
  
  // Add 10% of the combined value (the Bilateral Factor)
  // This is 10% of the COMBINED value, not 10 percentage points
  const withBilateralFactor = combined * 1.1;
  
  // Round to nearest whole number for further calculations
  return Math.round(withBilateralFactor);
};

/**
 * Main VA Rating Calculator
 * Implements full 38 CFR § 4.25 logic including Bilateral Factor
 * 
 * @param {Array} conditions - Array of condition objects:
 *   { name: string, rating: number, side: 'left'|'right'|'bilateral'|'none', bodyPart: string }
 * @returns {Object} - Calculation results
 */
export const calculateVARating = (conditions) => {
  if (!conditions || conditions.length === 0) {
    return {
      combinedRating: 0,
      rawScore: 0,
      bilateralConditions: [],
      bilateralFactor: 0,
      bilateralGroupRating: 0,
      nonBilateralConditions: [],
      calculationSteps: [],
      gapToNext10: 0,
      ratingNeededFor100: 0,
    };
  }

  const steps = [];
  
  // Separate bilateral and non-bilateral conditions
  const bilateralConditions = conditions.filter(c => 
    c.side === 'left' || c.side === 'right' || c.side === 'bilateral'
  );
  const nonBilateralConditions = conditions.filter(c => 
    c.side === 'none' || !c.side
  );

  steps.push({
    step: 1,
    description: 'Identify bilateral conditions',
    bilateral: bilateralConditions.map(c => `${c.name} (${c.rating}%)`),
    nonBilateral: nonBilateralConditions.map(c => `${c.name} (${c.rating}%)`),
  });

  let allRatings = [];
  let bilateralGroupRating = 0;
  let bilateralFactor = 0;

  // Handle bilateral conditions if any exist
  if (bilateralConditions.length > 0) {
    const bilateralRatings = bilateralConditions.map(c => c.rating);
    const combinedBilateral = combineMultipleRatings(bilateralRatings);
    
    // Calculate bilateral factor (10% of combined)
    bilateralFactor = Math.round(combinedBilateral * 0.1 * 10) / 10;
    bilateralGroupRating = Math.round(combinedBilateral + bilateralFactor);
    
    steps.push({
      step: 2,
      description: 'Calculate Bilateral Group',
      bilateralRatings: bilateralRatings.sort((a, b) => b - a),
      combinedBilateral: combinedBilateral,
      bilateralFactor: bilateralFactor,
      bilateralGroupRating: bilateralGroupRating,
    });
    
    // Add bilateral group as single rating
    allRatings.push(bilateralGroupRating);
  }

  // Add non-bilateral ratings
  allRatings = allRatings.concat(nonBilateralConditions.map(c => c.rating));

  // Sort all ratings descending for final calculation
  allRatings.sort((a, b) => b - a);

  steps.push({
    step: bilateralConditions.length > 0 ? 3 : 2,
    description: 'Combine all ratings (sorted descending)',
    ratings: allRatings,
  });

  // Calculate combined rating
  const rawScore = combineMultipleRatings(allRatings);
  const combinedRating = roundToNearest10(rawScore);

  // Add detailed final step with validation
  steps.push({
    step: steps.length + 1,
    description: 'Final calculation',
    rawScore: rawScore,
    roundedTo: combinedRating,
    method: '38 CFR § 4.25 Combined Ratings Table',
    validation: {
      inputValid: allRatings.every(r => r >= 0 && r <= 100),
      outputValid: combinedRating >= 0 && combinedRating <= 100 && combinedRating % 10 === 0,
      roundingRule: rawScore % 10 >= 5 ? 'Rounded UP' : 'Rounded DOWN'
    }
  });

  // Calculate gap analysis
  const nextTier = Math.min(100, Math.ceil(rawScore / 10) * 10);
  const gapToNext10 = nextTier - rawScore;
  
  // Calculate what rating would be needed to reach 100%
  // Using reverse VA math: If current = C, need X where C + X(1-C) >= 95 (rounds to 100)
  const currentEfficiency = 1 - (rawScore / 100);
  const neededForRoundTo100 = currentEfficiency > 0 ? Math.ceil(((95 - rawScore) / currentEfficiency)) : 0;
  const ratingNeededFor100 = Math.max(0, Math.min(100, neededForRoundTo100));

  return {
    combinedRating,
    rawScore: Math.round(rawScore * 10) / 10,
    bilateralConditions: bilateralConditions.map(c => ({ ...c })),
    bilateralFactor,
    bilateralGroupRating,
    nonBilateralConditions: nonBilateralConditions.map(c => ({ ...c })),
    calculationSteps: steps,
    gapToNext10: Math.round(gapToNext10 * 10) / 10,
    nextTier,
    ratingNeededFor100,
    currentEfficiency: Math.round(currentEfficiency * 1000) / 10, // As percentage
  };
};

/**
 * Calculate monthly compensation based on rating and dependents
 * 
 * @param {number} rating - Combined VA rating (0-100, multiples of 10)
 * @param {Object} dependents - Dependent information
 * @returns {Object} - Compensation breakdown
 */
export const calculateCompensation = (rating, dependents = {}) => {
  const {
    married = false,
    spouseAidAttendance = false,
    childrenUnder18 = 0,
    childrenSchool = 0,
    dependentParents = 0,
  } = dependents;

  // Must be at least 30% for dependent benefits
  const qualifiesForDependents = rating >= 30;
  
  // Get base rate
  const baseRate = VA_PAY_RATES_2026.solo[rating] || 0;
  
  let total = baseRate;
  const breakdown = {
    baseRate,
    spouseAddition: 0,
    spouseAidAttendanceAddition: 0,
    childrenUnder18Addition: 0,
    childrenSchoolAddition: 0,
    parentsAddition: 0,
  };

  if (qualifiesForDependents) {
    // Spouse
    if (married) {
      breakdown.spouseAddition = VA_PAY_RATES_2026.spouse[rating] || 0;
      total += breakdown.spouseAddition;
      
      // Spouse Aid & Attendance
      if (spouseAidAttendance) {
        breakdown.spouseAidAttendanceAddition = VA_PAY_RATES_2026.spouseAidAttendance[rating] || 0;
        total += breakdown.spouseAidAttendanceAddition;
      }
    }
    
    // Children under 18
    if (childrenUnder18 > 0) {
      const perChild = VA_PAY_RATES_2026.childUnder18[rating] || 0;
      breakdown.childrenUnder18Addition = perChild * childrenUnder18;
      total += breakdown.childrenUnder18Addition;
    }
    
    // Children 18-23 in school
    if (childrenSchool > 0) {
      const perChild = VA_PAY_RATES_2026.childSchool[rating] || 0;
      breakdown.childrenSchoolAddition = perChild * childrenSchool;
      total += breakdown.childrenSchoolAddition;
    }
    
    // Dependent parents
    if (dependentParents === 1) {
      breakdown.parentsAddition = VA_PAY_RATES_2026.parentOne[rating] || 0;
      total += breakdown.parentsAddition;
    } else if (dependentParents >= 2) {
      breakdown.parentsAddition = VA_PAY_RATES_2026.parentTwo[rating] || 0;
      total += breakdown.parentsAddition;
    }
  }

  return {
    monthlyTotal: Math.round(total * 100) / 100,
    annualTotal: Math.round(total * 12 * 100) / 100,
    breakdown,
    qualifiesForDependents,
  };
};

/**
 * Calculate "What If" scenarios
 * Shows how adding a new rating would change the combined
 */
export const calculateWhatIf = (existingConditions, newRating, isBilateral = false) => {
  // Current combined rating
  const current = calculateVARating(existingConditions);
  
  // New condition
  const newCondition = {
    name: 'Proposed Condition',
    rating: newRating,
    side: isBilateral ? 'bilateral' : 'none',
    bodyPart: isBilateral ? 'knee' : 'other'
  };
  
  // Calculate with new condition added
  const withNew = calculateVARating([...existingConditions, newCondition]);
  
  return {
    currentRating: current.combinedRating,
    newRating: withNew.combinedRating,
    increase: withNew.combinedRating - current.combinedRating,
    percentageIncrease: ((withNew.combinedRating - current.combinedRating) / current.combinedRating * 100).toFixed(1)
  };
};

/**
 * Pyramiding Detection per 38 CFR § 4.14
 * Detects when the same disability manifestation may be rated multiple times
 * 
 * Pyramiding occurs when:
 * - Same body part is rated under multiple diagnostic codes
 * - Same manifestation (pain, ROM limitation, weakness) counted twice
 * - Nerve injury AND the part it supplies both rated for same symptom
 * 
 * @param {Array} conditions - Array of condition objects with bodyPart, manifestations
 * @returns {Object} - Pyramiding analysis and warnings
 */
export const detectPyramiding = (conditions) => {
  const warnings = [];
  const bodyPartGroups = {};
  
  // Group conditions by body part
  conditions.forEach((condition, index) => {
    const bodyPart = condition.bodyPart || 'other';
    if (!bodyPartGroups[bodyPart]) {
      bodyPartGroups[bodyPart] = [];
    }
    bodyPartGroups[bodyPart].push({ ...condition, index });
  });
  
  // Check each body part for potential pyramiding
  Object.entries(bodyPartGroups).forEach(([bodyPart, condList]) => {
    if (condList.length > 1) {
      // Multiple conditions affecting same body part - potential pyramiding
      warnings.push({
        type: 'potential_pyramiding',
        severity: 'high',
        bodyPart,
        conditions: condList.map(c => c.name),
        message: `Multiple conditions for ${bodyPart}. Verify these rate different manifestations (not the same pain/limitation twice).`,
        regulation: '38 CFR § 4.14',
        guidance: 'You cannot rate the same manifestation under different diagnostic codes. For example: cervical pain can only be rated once, not under both strain AND arthritis codes.',
        indices: condList.map(c => c.index)
      });
    }
  });
  
  // Check for nerve + supplied part pyramiding
  const nerveConditions = conditions.filter(c => 
    c.name?.toLowerCase().includes('nerve') || 
    c.name?.toLowerCase().includes('radiculopathy') ||
    c.name?.toLowerCase().includes('neuropathy')
  );
  
  nerveConditions.forEach((nerveCondition, idx) => {
    const bodyPart = nerveCondition.bodyPart;
    const otherInSamePart = conditions.filter((c, i) => 
      i !== idx && c.bodyPart === bodyPart && !c.name?.toLowerCase().includes('nerve')
    );
    
    if (otherInSamePart.length > 0) {
      warnings.push({
        type: 'nerve_pyramiding',
        severity: 'high',
        nerveCondition: nerveCondition.name,
        affectedPart: bodyPart,
        otherConditions: otherInSamePart.map(c => c.name),
        message: `Nerve condition (${nerveCondition.name}) and ${bodyPart} condition may be rating same symptoms.`,
        regulation: '38 CFR § 4.14',
        guidance: 'You cannot rate both a nerve injury AND the part it supplies for the SAME manifestation (e.g., both radiculopathy and arm weakness from the same nerve damage).',
        indices: [idx, ...otherInSamePart.map(c => conditions.indexOf(c))]
      });
    }
  });
  
  // Check for spine + extremity pyramiding (common issue)
  const spineConditions = conditions.filter(c =>
    c.bodyPart === 'cervical-spine' ||
    c.bodyPart === 'thoracic-spine' ||
    c.bodyPart === 'lumbar-spine' ||
    c.name?.toLowerCase().includes('spine') ||
    c.name?.toLowerCase().includes('cervical') ||
    c.name?.toLowerCase().includes('lumbar')
  );
  
  if (spineConditions.length > 0) {
    const extremityConditions = conditions.filter(c =>
      ['shoulder', 'arm', 'hand', 'hip', 'leg', 'knee', 'foot'].includes(c.bodyPart)
    );
    
    if (extremityConditions.length > 0) {
      warnings.push({
        type: 'spine_extremity_warning',
        severity: 'medium',
        message: 'You have both spine and extremity conditions. Ensure extremity issues are independent, not just manifestations of spine pathology.',
        regulation: '38 CFR § 4.14, § 4.71a',
        guidance: 'Radicular pain (nerve pain radiating down limbs) is rated under spine codes. Separate extremity conditions need independent pathology.',
        affectedConditions: [...spineConditions.map(c => c.name), ...extremityConditions.map(c => c.name)]
      });
    }
  }
  
  return {
    hasPotentialPyramiding: warnings.length > 0,
    warnings,
    summary: warnings.length > 0 
      ? `Found ${warnings.length} potential pyramiding issue(s). Review to ensure you're not rating the same manifestation twice.`
      : 'No obvious pyramiding issues detected. Note: This is an automated check - verify with 38 CFR schedules.'
  };
};

/**
 * Amputation Special Rules per 38 CFR § 4.66
 * Amputations have minimum guaranteed ratings regardless of prosthetic function
 * 
 * @param {string} amputationLevel - Level of amputation
 * @param {string} bodyPart - Which extremity
 * @returns {Object} - Minimum rating and special rules
 */
export const getAmputationMinimumRating = (amputationLevel, bodyPart) => {
  const amputationRules = {
    // Upper extremity amputations (DC 5120-5127)
    'above-elbow': { minimum: 70, dc: '5124', note: 'Amputation above elbow' },
    'below-elbow': { minimum: 60, dc: '5120', note: 'Amputation below elbow' },
    'wrist-disarticulation': { minimum: 60, dc: '5121', note: 'Disarticulation at wrist' },
    'hand': { minimum: 60, dc: '5122', note: 'Amputation through hand' },
    'all-fingers': { minimum: 50, dc: '5123', note: 'Loss of all fingers' },
    
    // Lower extremity amputations (DC 5160-5174)
    'above-knee': { minimum: 60, dc: '5160', note: 'Amputation above knee (AK)' },
    'below-knee': { minimum: 40, dc: '5160', note: 'Amputation below knee (BK)' },
    'ankle-disarticulation': { minimum: 40, dc: '5170', note: 'Disarticulation at ankle' },
    'foot': { minimum: 40, dc: '5171', note: 'Amputation through foot' },
    'all-toes': { minimum: 20, dc: '5172', note: 'Loss of all toes' },
  };
  
  const rule = amputationRules[amputationLevel];
  
  if (!rule) {
    return {
      isAmputation: false,
      minimumRating: null,
      note: 'Not an amputation or level not recognized'
    };
  }
  
  return {
    isAmputation: true,
    minimumRating: rule.minimum,
    diagnosticCode: rule.dc,
    note: rule.note,
    regulation: '38 CFR § 4.66',
    specialRules: [
      'Minimum rating guaranteed regardless of prosthetic function',
      'Loss of use is equivalent to amputation for rating purposes',
      'Bilateral amputations receive bilateral factor (10% boost)',
      'Cannot rate below minimum even with excellent prosthetic adaptation'
    ]
  };
};

/**
 * Reverse calculate: What rating do I need to reach a target?
 */
export const calculateNeededRating = (currentRaw, targetRating) => {
  if (currentRaw >= targetRating) return 0;
  
  // We need to find X where: currentRaw + X(1 - currentRaw/100) >= targetRating - 5 (to round up)
  const targetRaw = targetRating - 4.5; // Need at least this to round to target
  const remainingEfficiency = 1 - (currentRaw / 100);
  
  if (remainingEfficiency <= 0) return 100;
  
  const neededRaw = (targetRaw - currentRaw) / remainingEfficiency;
  
  // Round up to nearest 10 (VA only gives ratings in 10s)
  return Math.min(100, Math.ceil(neededRaw / 10) * 10);
};

export default {
  calculateVARating,
  calculateCompensation,
  calculateWhatIf,
  calculateNeededRating,
  combineTwoRatings,
  combineMultipleRatings,
  roundToNearest10,
  calculateBilateralFactor,
  calculatePaymentEffectiveDate,
  calculateBackpayMonths,
  detectPyramiding,
  getAmputationMinimumRating,
  VA_PAY_RATES_2026,
  BODY_PARTS,
};
