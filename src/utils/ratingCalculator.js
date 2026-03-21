/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * All Rights Reserved. Proprietary and Confidential.
 * Unauthorized copying, use, or distribution is strictly prohibited.
 * See src/COPYRIGHT.js for full license terms.
 *
 * VA Combined Rating Calculator
 * Implements 38 CFR Part 4 - Schedule for Rating Disabilities
 *
 * Reference: 38 CFR § 4.25 - Combined ratings table
 * Reference: 38 CFR § 4.26 - Bilateral factor
 */

import {
  VA_PAY_RATES_HISTORICAL,
  getCurrentYearRates,
} from "../data/vaPayRatesHistorical";

/**
 * Calculate combined VA disability rating using official VA formula
 * Per 38 CFR § 4.25
 *
 * @param {Array<number>} ratings - Individual disability ratings (0-100)
 * @param {boolean} hasBilateral - Whether bilateral factor applies
 * @returns {number} Combined rating rounded to nearest 10
 *
 * @example
 * // Single condition
 * calculateCombinedRating([50]) // 50
 *
 * @example
 * // Multiple conditions (VA official example from 38 CFR § 4.25)
 * calculateCombinedRating([60, 40, 20]) // 80
 *
 * @example
 * // With bilateral factor (38 CFR § 4.26)
 * calculateCombinedRating([30, 30], true) // 60
 */
export function calculateCombinedRating(ratings, hasBilateral = false) {
  if (!ratings || ratings.length === 0) return 0;

  // Filter out invalid ratings
  const validRatings = ratings.filter(
    (r) => typeof r === "number" && r >= 0 && r <= 100,
  );
  if (validRatings.length === 0) return 0;

  // Single rating - no combination needed
  if (validRatings.length === 1) {
    return Math.round(validRatings[0] / 10) * 10;
  }

  // Sort highest to lowest (VA requirement)
  const sorted = [...validRatings].sort((a, b) => b - a);

  // Apply bilateral factor if applicable (38 CFR § 4.26)
  if (hasBilateral && sorted.length >= 2) {
    // Combine first two ratings
    let bilateralCombined = sorted[0];
    const efficiency = 100 - bilateralCombined;
    const addition = Math.round((sorted[1] * efficiency) / 100);
    bilateralCombined += addition;

    // Add 10% bilateral factor
    bilateralCombined = Math.round(bilateralCombined * 1.1);

    // Replace first two ratings with bilateral combined
    sorted[0] = bilateralCombined;
    sorted.splice(1, 1);
  }

  // Combine all ratings using VA formula (38 CFR § 4.25)
  // Per regulation: "efficiency of the individual as affected first by the most disabling condition"
  let combined = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const efficiency = 100 - combined;
    // Round addition to whole number (standard practice)
    const addition = Math.round((sorted[i] * efficiency) / 100);
    combined += addition;
  }

  // Round to nearest 10 (VA requirement)
  // Per 38 CFR § 4.25: "combined values ending in 5 will be adjusted upward"
  const final = Math.round(combined / 10) * 10;
  return Math.max(0, Math.min(100, final)); // Clamp to valid range
}

/**
 * Calculate monthly compensation for a given rating
 * Based on 2025 VA compensation rates
 *
 * @param {number} rating - Combined disability rating (0-100, must be multiple of 10)
 * @param {Object} options - Additional options
 * @param {boolean} options.hasSpouse - Has dependent spouse
 * @param {number} options.children - Number of dependent children
 * @param {boolean} options.hasParents - Has dependent parents
 * @returns {number} Monthly compensation amount
 */
export function calculateMonthlyCompensation(rating, options = {}) {
  // Get current year's rates dynamically from data file
  const { rates } = getCurrentYearRates();
  const baseRates = rates.solo;

  const roundedRating = Math.round(rating / 10) * 10;
  const baseRate = baseRates[roundedRating] || 0;

  // Add dependent compensation if applicable
  let totalCompensation = baseRate;

  // Spouse adds additional compensation (30% or higher)
  if (options.hasSpouse && roundedRating >= 30) {
    const spouseRates = rates.spouse;
    totalCompensation += spouseRates[roundedRating] || 0;
  }

  // Children add additional compensation
  if (options.children && options.children > 0 && roundedRating >= 30) {
    const childRate = rates.childUnder18[roundedRating] || 0;
    totalCompensation += childRate * options.children;
  }

  return Math.round(totalCompensation * 100) / 100;
}

/**
 * Check if bilateral factor applies to given conditions
 * Per 38 CFR § 4.26
 *
 * @param {Array<Object>} conditions - Array of conditions with name and rating
 * @returns {boolean} Whether bilateral factor applies
 *
 * @example
 * checkBilateralFactor([
 *   { name: 'Knee (Left)', rating: 30 },
 *   { name: 'Knee (Right)', rating: 30 }
 * ]) // true
 */
export function checkBilateralFactor(conditions) {
  const bilateralPairs = [
    "knee",
    "shoulder",
    "ankle",
    "wrist",
    "elbow",
    "hip",
    "foot",
    "hand",
    "ear",
    "eye",
    "arm",
    "leg",
  ];

  for (const bodyPart of bilateralPairs) {
    const left = conditions.find(
      (c) =>
        c.name.toLowerCase().includes(bodyPart) &&
        c.name.toLowerCase().includes("left") &&
        c.rating > 0,
    );

    const right = conditions.find(
      (c) =>
        c.name.toLowerCase().includes(bodyPart) &&
        c.name.toLowerCase().includes("right") &&
        c.rating > 0,
    );

    if (left && right) return true;
  }

  return false;
}

/**
 * Calculate exact combined rating before rounding (for debugging)
 *
 * @param {Array<number>} ratings - Individual disability ratings
 * @returns {number} Exact combined rating (may have decimals)
 */
export function calculateExactCombinedRating(ratings) {
  if (!ratings || ratings.length === 0) return 0;
  if (ratings.length === 1) return ratings[0];

  const sorted = [...ratings].sort((a, b) => b - a);
  let combined = sorted[0];

  for (let i = 1; i < sorted.length; i++) {
    const efficiency = 100 - combined;
    combined += (sorted[i] * efficiency) / 100;
  }

  return combined;
}
