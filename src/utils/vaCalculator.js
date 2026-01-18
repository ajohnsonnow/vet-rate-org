/**
 * VA Disability Rating Calculator
 * Implements 38 CFR § 4.25 - Combined Ratings Table
 * 
 * The VA uses "efficiency" math, not simple addition.
 * Each rating reduces the remaining "whole person" efficiency.
 */

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
 */
export const combineTwoRatings = (rating1, rating2) => {
  const a = rating1 / 100;
  const b = rating2 / 100;
  return Math.round((a + b * (1 - a)) * 100 * 10) / 10; // Keep one decimal for intermediate calcs
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
 * 0.5 rounds UP per VA policy
 */
export const roundToNearest10 = (value) => {
  return Math.round(value / 10) * 10;
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

  steps.push({
    step: steps.length + 1,
    description: 'Final calculation',
    rawScore: rawScore,
    roundedTo: combinedRating,
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
export const calculateWhatIf = (currentConditions, newRating, isBilateral = false) => {
  const current = calculateVARating(currentConditions);
  
  const newCondition = {
    name: 'Potential New Rating',
    rating: newRating,
    side: isBilateral ? 'bilateral' : 'none',
    bodyPart: 'other',
  };
  
  const withNew = calculateVARating([...currentConditions, newCondition]);
  
  return {
    currentRating: current.combinedRating,
    currentRaw: current.rawScore,
    newRating: withNew.combinedRating,
    newRaw: withNew.rawScore,
    ratingIncrease: withNew.combinedRating - current.combinedRating,
    rawIncrease: Math.round((withNew.rawScore - current.rawScore) * 10) / 10,
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
  VA_PAY_RATES_2026,
  BODY_PARTS,
};
