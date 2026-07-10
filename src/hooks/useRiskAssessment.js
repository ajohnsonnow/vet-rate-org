/**
 * Vet-Rate.org - Copyright (c) 2024-2026 Anthony Johnson
 * SPDX-License-Identifier: AGPL-3.0-or-later
 *
 * Risk Assessment calculation hook for the "Poke the Bear" Risk Assessment tool.
 * Extracted from RiskAssessment.jsx so the component itself stays focused on
 * rendering; this hook owns the pure "what are the risks of filing" logic.
 *
 * Key Protection Rules:
 * - 5-Year Rule: Rating not stabilized - high risk of reduction
 * - 20-Year Rule: Rating protected by law (38 CFR 3.951)
 * - 100% P&T: Filing can trigger review of ALL conditions
 * - 55+ Age: VA generally exempts from future exams
 */

import { useMemo } from "react";

/**
 * VA Protection Rules per 38 CFR
 */
const PROTECTION_RULES = {
  // 38 CFR 3.344 - Stabilization of disability evaluations
  FIVE_YEAR: {
    id: "five_year",
    name: "5-Year Rule",
    cfr: "38 CFR § 3.344(c)",
    description:
      "Ratings in effect for 5+ years cannot be reduced unless sustained improvement is shown under ordinary conditions of life.",
    yearsRequired: 5,
  },
  // 38 CFR 3.951 - Preservation of disability ratings
  TEN_YEAR: {
    id: "ten_year",
    name: "10-Year Rule",
    cfr: "38 CFR § 3.957",
    description:
      "Service connection cannot be severed after 10 years unless fraud is proven.",
    yearsRequired: 10,
  },
  // 38 CFR 3.951(b)
  TWENTY_YEAR: {
    id: "twenty_year",
    name: "20-Year Rule",
    cfr: "38 CFR § 3.951(b)",
    description:
      "Ratings in effect for 20+ years are protected from reduction to any lower level.",
    yearsRequired: 20,
  },
  // Age 55+ exam exemption
  AGE_55: {
    id: "age_55",
    name: "55+ Age Protection",
    cfr: "VA Policy",
    description:
      "Veterans 55 and older are generally exempt from routine future examinations.",
    ageRequired: 55,
  },
  // 100% P&T
  PERMANENT_TOTAL: {
    id: "pt",
    name: "Permanent & Total (P&T)",
    cfr: "38 CFR § 3.340",
    description:
      "P&T status indicates no future exams scheduled. Filing new claims can potentially trigger review.",
  },
};

/**
 * Risk Levels
 */
const RISK_LEVELS = {
  CRITICAL: {
    level: "CRITICAL",
    color: "red",
    bgClass: "from-red-600 to-red-700",
    textClass: "text-red-700 dark:text-red-300",
    borderClass: "border-red-500",
    bgLightClass: "bg-red-50 dark:bg-red-900/30",
    icon: "🚨",
    recommendation: "DO NOT FILE unless absolutely necessary",
  },
  HIGH: {
    level: "HIGH",
    color: "orange",
    bgClass: "from-orange-500 to-red-500",
    textClass: "text-orange-700 dark:text-orange-300",
    borderClass: "border-orange-500",
    bgLightClass: "bg-orange-50 dark:bg-orange-900/30",
    icon: "⚠️",
    recommendation: "Proceed with caution - consult a VSO first",
  },
  MODERATE: {
    level: "MODERATE",
    color: "yellow",
    bgClass: "from-yellow-500 to-orange-500",
    textClass: "text-yellow-700 dark:text-yellow-300",
    borderClass: "border-yellow-500",
    bgLightClass: "bg-yellow-50 dark:bg-yellow-900/30",
    icon: "⚡",
    recommendation: "Some risk exists - document everything thoroughly",
  },
  LOW: {
    level: "LOW",
    color: "green",
    bgClass: "from-green-500 to-emerald-500",
    textClass: "text-green-700 dark:text-green-300",
    borderClass: "border-green-500",
    bgLightClass: "bg-green-50 dark:bg-green-900/30",
    icon: "✅",
    recommendation: "Lower risk - proceed with standard preparation",
  },
  SAFE: {
    level: "PROTECTED",
    color: "blue",
    bgClass: "from-blue-500 to-indigo-500",
    textClass: "text-blue-700 dark:text-blue-300",
    borderClass: "border-blue-500",
    bgLightClass: "bg-blue-50 dark:bg-blue-900/30",
    icon: "🛡️",
    recommendation: "You have legal protections - filing is relatively safe",
  },
};

/**
 * Calculate years from a date
 */
const calculateYearsFromDate = (dateString) => {
  if (!dateString) return 0;
  const date = new Date(dateString);
  const now = new Date();
  const diffTime = now - date;
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return Math.floor(diffYears * 10) / 10; // Round to 1 decimal
};

/**
 * Calculate age from birth year
 */
const calculateAge = (birthYear) => {
  if (!birthYear) return 0;
  const currentYear = new Date().getFullYear();
  return currentYear - birthYear;
};

/**
 * Calculate risk assessment based on inputs
 */
export function useRiskAssessment(
  currentRating,
  ratingDate,
  isPermanentTotal,
  birthYear,
) {
  return useMemo(() => {
    const yearsRated = calculateYearsFromDate(ratingDate);
    const age = calculateAge(parseInt(birthYear));
    const rating = parseInt(currentRating) || 0;

    const protections = [];
    const warnings = [];
    const factors = [];
    let riskLevel = RISK_LEVELS.LOW;
    let financialGain = 0;

    // Calculate potential financial gain (rough estimate)
    // If at 100%, there's essentially no gain from additional ratings
    if (rating >= 100) {
      factors.push({
        type: "info",
        text: "You are already at 100%. Additional claims provide $0 in additional monthly compensation.",
      });
    } else {
      // Very rough estimate - actual depends on dependents
      const baseRates = {
        90: 2241,
        80: 1995,
        70: 1716,
        60: 1361,
        50: 1075,
        40: 773,
        30: 524,
        20: 338,
        10: 175,
      };
      const currentPay = baseRates[rating] || 0;
      const nextPay = baseRates[Math.min(100, rating + 10)] || 0;
      financialGain = nextPay - currentPay;
    }

    // Rule 1: P&T Check (HIGHEST PRIORITY)
    if (isPermanentTotal) {
      warnings.push({
        severity: "critical",
        rule: PROTECTION_RULES.PERMANENT_TOTAL,
        message: `You are Permanent & Total (P&T). Filing new claims can trigger a REVIEW OF ALL YOUR CONDITIONS. Unless you have a severe new condition, the risk far outweighs any potential benefit.`,
        action:
          "Only file if you have a new serious condition that significantly impacts your quality of life.",
      });
      riskLevel = RISK_LEVELS.CRITICAL;

      if (rating >= 100) {
        factors.push({
          type: "critical",
          text: `Financial gain: $0/month. Risk: Total loss of P&T status and potential reduction in ratings.`,
        });
      }
    }

    // Rule 2: 20-Year Rule (Full Protection)
    if (yearsRated >= 20) {
      protections.push({
        rule: PROTECTION_RULES.TWENTY_YEAR,
        message: `Your rating has been in effect for ${yearsRated.toFixed(1)} years. Under 38 CFR § 3.951(b), your rating CANNOT be reduced to any lower level.`,
        status: "PROTECTED",
      });

      // If not P&T, 20-year protection makes filing safer
      if (!isPermanentTotal) {
        riskLevel = RISK_LEVELS.SAFE;
      }
    }
    // Rule 3: 10-Year Rule (Service Connection Protected)
    else if (yearsRated >= 10) {
      protections.push({
        rule: PROTECTION_RULES.TEN_YEAR,
        message: `Your service connection has been in effect for ${yearsRated.toFixed(1)} years. Under 38 CFR § 3.957, service connection cannot be severed unless fraud is proven.`,
        status: "PROTECTED",
      });

      if (!isPermanentTotal) {
        riskLevel = yearsRated >= 5 ? RISK_LEVELS.MODERATE : RISK_LEVELS.HIGH;
      }

      factors.push({
        type: "info",
        text: "Your service connection is protected, but the rating percentage can still be reduced.",
      });
    }
    // Rule 4: 5-Year Rule
    else if (yearsRated >= 5) {
      protections.push({
        rule: PROTECTION_RULES.FIVE_YEAR,
        message: `Your rating has been in effect for ${yearsRated.toFixed(1)} years. Under 38 CFR § 3.344(c), reduction requires sustained improvement shown under ordinary conditions of life.`,
        status: "PARTIAL",
      });

      if (!isPermanentTotal) {
        riskLevel = RISK_LEVELS.MODERATE;
      }
    }
    // Under 5 years - highest reduction risk
    else {
      warnings.push({
        severity: "high",
        rule: PROTECTION_RULES.FIVE_YEAR,
        message: `Your rating has only been in effect for ${yearsRated.toFixed(1)} years. Ratings under 5 years are NOT stabilized and can be reduced with a single C&P exam showing improvement.`,
        action: `Wait ${(5 - yearsRated).toFixed(1)} more years for 5-year protection if possible.`,
      });

      if (!isPermanentTotal) {
        riskLevel = RISK_LEVELS.HIGH;
      }
    }

    // Rule 5: Age 55+ Protection
    if (age >= 55) {
      protections.push({
        rule: PROTECTION_RULES.AGE_55,
        message: `At ${age} years old, you are generally exempt from routine future examinations under VA policy.`,
        status: "PROTECTED",
      });

      // Age 55+ reduces risk somewhat
      if (riskLevel === RISK_LEVELS.HIGH && !isPermanentTotal) {
        riskLevel = RISK_LEVELS.MODERATE;
      }
    } else if (age > 0 && age < 55) {
      factors.push({
        type: "info",
        text: `At ${age} years old, you are ${55 - age} years from age-based exam exemption.`,
      });
    }

    // High rating specific warnings
    if (rating >= 70 && !isPermanentTotal && yearsRated < 5) {
      warnings.push({
        severity: "high",
        rule: null,
        message: `Your ${rating}% rating is significant but not stabilized. Filing a new claim triggers a review that could result in reduction.`,
        action:
          "Ensure any new claim is well-documented with strong medical evidence.",
      });
    }

    // TDIU warning
    if (rating >= 70 && rating < 100) {
      factors.push({
        type: "tip",
        text: "If you cannot work due to your disabilities, consider TDIU (Total Disability Individual Unemployability) instead of filing for more conditions.",
      });
    }

    return {
      riskLevel,
      protections,
      warnings,
      factors,
      financialGain,
      yearsRated,
      age,
      rating,
    };
  }, [currentRating, ratingDate, isPermanentTotal, birthYear]);
}

export default useRiskAssessment;
