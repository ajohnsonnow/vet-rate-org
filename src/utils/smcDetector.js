/**
 * TDIU / SMC-S detection — advisory only, not the full SMC schedule.
 *
 * 38 CFR § 4.16(a): schedular TDIU when one disability is rated 60%+,
 * OR combined is 70%+ with at least one disability rated 40%+.
 * 38 U.S.C. § 1114(s): statutory housebound when a single disability is
 * rated 100% AND additional separate disabilities independently combine
 * to 60%+ (simplified check; real SMC-S has more pathways).
 */

import { calculateCombinedRating } from "./ratingCalculator";

const toRatings = (conditions) => {
  if (!Array.isArray(conditions)) return [];
  return conditions
    .map((c) => (typeof c === "number" ? c : c?.rating))
    .filter((r) => typeof r === "number" && r >= 0 && r <= 100);
};

export function checkTDIUEligibility(conditions) {
  const ratings = toRatings(conditions);
  if (ratings.length === 0) {
    return { eligible: false, basis: null, combined: 0, highest: 0 };
  }

  const highest = Math.max(...ratings);
  const combined = calculateCombinedRating(ratings);

  if (highest >= 60) {
    return { eligible: true, basis: "single60", combined, highest };
  }
  if (combined >= 70 && highest >= 40) {
    return { eligible: true, basis: "combined70", combined, highest };
  }
  return { eligible: false, basis: null, combined, highest };
}

export function checkSMCSHousebound(conditions) {
  const ratings = toRatings(conditions);
  const hundredIndex = ratings.indexOf(100);
  if (hundredIndex === -1) {
    return {
      potentiallyEligible: false,
      reason: "Requires a single disability rated 100%.",
    };
  }

  const remaining = ratings.filter((_, i) => i !== hundredIndex);
  if (remaining.length === 0) {
    return {
      potentiallyEligible: false,
      reason: "No additional disabilities separate from the 100% rating.",
    };
  }

  const separateCombined = calculateCombinedRating(remaining);
  if (separateCombined >= 60) {
    return {
      potentiallyEligible: true,
      reason: `Single 100% disability plus additional disabilities independently combinable to ${separateCombined}%.`,
    };
  }
  return {
    potentiallyEligible: false,
    reason: `Additional disabilities combine to ${separateCombined}%, below the 60% threshold.`,
  };
}
