/**
 * Historical VA Disability Pay Rates (2020-2026)
 * "The Time Machine" - Retroactive Pay Hunter Data
 *
 * This data enables detection of underpayments and calculation of potential back pay.
 * Rates effective December 1 of preceding year (e.g., 2024 rates effective Dec 1, 2023)
 *
 * Source: VA.gov historical compensation rate tables
 */

export const VA_PAY_RATES_HISTORICAL = {
  // ============ 2020 RATES (Effective Dec 1, 2019 - 1.6% COLA) ============
  2020: {
    colaIncrease: 1.6,
    effectiveDate: "2019-12-01",
    solo: {
      0: 0,
      10: 142.29,
      20: 281.27,
      30: 435.69,
      40: 627.61,
      50: 893.43,
      60: 1131.68,
      70: 1426.17,
      80: 1657.8,
      90: 1862.96,
      100: 3106.04,
    },
    spouse: {
      30: 51.0,
      40: 68.0,
      50: 86.0,
      60: 103.0,
      70: 120.0,
      80: 137.0,
      90: 155.0,
      100: 172.43,
    },
    childUnder18: {
      30: 25.0,
      40: 34.0,
      50: 42.0,
      60: 51.0,
      70: 60.0,
      80: 68.0,
      90: 77.0,
      100: 85.86,
    },
    childSchool: {
      30: 83.0,
      40: 110.0,
      50: 138.0,
      60: 166.0,
      70: 193.0,
      80: 221.0,
      90: 249.0,
      100: 276.84,
    },
    parentOne: {
      30: 41.0,
      40: 55.0,
      50: 69.0,
      60: 83.0,
      70: 97.0,
      80: 110.0,
      90: 124.0,
      100: 138.45,
    },
    parentTwo: {
      30: 82.0,
      40: 110.0,
      50: 138.0,
      60: 165.0,
      70: 193.0,
      80: 220.0,
      90: 248.0,
      100: 276.84,
    },
  },

  // ============ 2021 RATES (Effective Dec 1, 2020 - 1.3% COLA) ============
  2021: {
    colaIncrease: 1.3,
    effectiveDate: "2020-12-01",
    solo: {
      0: 0,
      10: 144.14,
      20: 284.93,
      30: 441.35,
      40: 635.77,
      50: 905.04,
      60: 1146.39,
      70: 1444.71,
      80: 1679.35,
      90: 1887.18,
      100: 3146.42,
    },
    spouse: {
      30: 52.0,
      40: 69.0,
      50: 87.0,
      60: 104.0,
      70: 122.0,
      80: 139.0,
      90: 157.0,
      100: 174.66,
    },
    childUnder18: {
      30: 26.0,
      40: 34.0,
      50: 43.0,
      60: 52.0,
      70: 60.0,
      80: 69.0,
      90: 78.0,
      100: 86.98,
    },
    childSchool: {
      30: 84.0,
      40: 112.0,
      50: 140.0,
      60: 168.0,
      70: 196.0,
      80: 224.0,
      90: 252.0,
      100: 280.44,
    },
    parentOne: {
      30: 42.0,
      40: 56.0,
      50: 70.0,
      60: 84.0,
      70: 98.0,
      80: 112.0,
      90: 126.0,
      100: 140.25,
    },
    parentTwo: {
      30: 83.0,
      40: 111.0,
      50: 140.0,
      60: 167.0,
      70: 196.0,
      80: 223.0,
      90: 251.0,
      100: 280.44,
    },
  },

  // ============ 2022 RATES (Effective Dec 1, 2021 - 5.9% COLA) ============
  2022: {
    colaIncrease: 5.9,
    effectiveDate: "2021-12-01",
    solo: {
      0: 0,
      10: 152.64,
      20: 301.74,
      30: 467.39,
      40: 673.28,
      50: 958.44,
      60: 1214.03,
      70: 1529.95,
      80: 1778.43,
      90: 1998.52,
      100: 3332.06,
    },
    spouse: {
      30: 55.0,
      40: 73.0,
      50: 92.0,
      60: 110.0,
      70: 129.0,
      80: 147.0,
      90: 166.0,
      100: 184.96,
    },
    childUnder18: {
      30: 27.0,
      40: 36.0,
      50: 46.0,
      60: 55.0,
      70: 64.0,
      80: 73.0,
      90: 83.0,
      100: 92.11,
    },
    childSchool: {
      30: 89.0,
      40: 119.0,
      50: 148.0,
      60: 178.0,
      70: 207.0,
      80: 237.0,
      90: 267.0,
      100: 296.99,
    },
    parentOne: {
      30: 44.0,
      40: 59.0,
      50: 74.0,
      60: 89.0,
      70: 104.0,
      80: 118.0,
      90: 133.0,
      100: 148.52,
    },
    parentTwo: {
      30: 88.0,
      40: 118.0,
      50: 148.0,
      60: 177.0,
      70: 207.0,
      80: 236.0,
      90: 266.0,
      100: 296.99,
    },
  },

  // ============ 2023 RATES (Effective Dec 1, 2022 - 8.7% COLA) ============
  2023: {
    colaIncrease: 8.7,
    effectiveDate: "2022-12-01",
    solo: {
      0: 0,
      10: 165.92,
      20: 327.99,
      30: 508.05,
      40: 731.86,
      50: 1041.82,
      60: 1319.65,
      70: 1663.06,
      80: 1933.15,
      90: 2172.39,
      100: 3621.95,
    },
    spouse: {
      30: 60.0,
      40: 80.0,
      50: 100.0,
      60: 120.0,
      70: 140.0,
      80: 160.0,
      90: 181.0,
      100: 201.06,
    },
    childUnder18: {
      30: 30.0,
      40: 40.0,
      50: 50.0,
      60: 60.0,
      70: 69.0,
      80: 80.0,
      90: 90.0,
      100: 100.12,
    },
    childSchool: {
      30: 97.0,
      40: 129.0,
      50: 161.0,
      60: 193.0,
      70: 225.0,
      80: 258.0,
      90: 290.0,
      100: 322.82,
    },
    parentOne: {
      30: 48.0,
      40: 64.0,
      50: 81.0,
      60: 97.0,
      70: 113.0,
      80: 129.0,
      90: 145.0,
      100: 161.44,
    },
    parentTwo: {
      30: 96.0,
      40: 128.0,
      50: 161.0,
      60: 193.0,
      70: 225.0,
      80: 257.0,
      90: 289.0,
      100: 322.82,
    },
  },

  // ============ 2024 RATES (Effective Dec 1, 2023 - 3.2% COLA) ============
  2024: {
    colaIncrease: 3.2,
    effectiveDate: "2023-12-01",
    solo: {
      0: 0,
      10: 171.23,
      20: 338.49,
      30: 524.31,
      40: 755.28,
      50: 1075.16,
      60: 1361.88,
      70: 1716.28,
      80: 1995.01,
      90: 2241.91,
      100: 3737.85,
    },
    spouse: {
      30: 62.0,
      40: 83.0,
      50: 103.0,
      60: 124.0,
      70: 145.0,
      80: 165.0,
      90: 187.0,
      100: 207.5,
    },
    childUnder18: {
      30: 31.0,
      40: 41.0,
      50: 52.0,
      60: 62.0,
      70: 72.0,
      80: 83.0,
      90: 93.0,
      100: 103.32,
    },
    childSchool: {
      30: 100.0,
      40: 133.0,
      50: 166.0,
      60: 199.0,
      70: 233.0,
      80: 266.0,
      90: 299.0,
      100: 333.15,
    },
    parentOne: {
      30: 50.0,
      40: 66.0,
      50: 84.0,
      60: 100.0,
      70: 117.0,
      80: 133.0,
      90: 150.0,
      100: 166.61,
    },
    parentTwo: {
      30: 99.0,
      40: 132.0,
      50: 166.0,
      60: 199.0,
      70: 232.0,
      80: 265.0,
      90: 298.0,
      100: 333.15,
    },
  },

  // ============ 2025 RATES (Effective Dec 1, 2024 - 2.5% COLA) ============
  2025: {
    colaIncrease: 2.5,
    effectiveDate: "2024-12-01",
    solo: {
      0: 0,
      10: 175.51,
      20: 346.96,
      30: 537.42,
      40: 774.16,
      50: 1102.04,
      60: 1395.92,
      70: 1759.19,
      80: 2044.89,
      90: 2297.96,
      100: 3831.3,
    },
    spouse: {
      30: 64.0,
      40: 85.0,
      50: 106.0,
      60: 127.0,
      70: 149.0,
      80: 169.0,
      90: 192.0,
      100: 212.69,
    },
    childUnder18: {
      30: 32.0,
      40: 42.0,
      50: 53.0,
      60: 64.0,
      70: 74.0,
      80: 85.0,
      90: 95.0,
      100: 105.9,
    },
    childSchool: {
      30: 103.0,
      40: 136.0,
      50: 170.0,
      60: 204.0,
      70: 239.0,
      80: 273.0,
      90: 306.0,
      100: 341.48,
    },
    parentOne: {
      30: 51.0,
      40: 68.0,
      50: 86.0,
      60: 103.0,
      70: 120.0,
      80: 136.0,
      90: 154.0,
      100: 170.78,
    },
    parentTwo: {
      30: 101.0,
      40: 135.0,
      50: 170.0,
      60: 204.0,
      70: 238.0,
      80: 272.0,
      90: 305.0,
      100: 341.48,
    },
  },

  // ============ 2026 RATES (Effective Dec 1, 2025 - 2.8% COLA) ============
  2026: {
    colaIncrease: 2.8,
    effectiveDate: "2025-12-01",
    solo: {
      0: 0,
      10: 180.42,
      20: 356.66,
      30: 552.47,
      40: 795.84,
      50: 1132.9,
      60: 1435.02,
      70: 1808.45,
      80: 2102.15,
      90: 2362.3,
      100: 3938.58,
    },
    spouse: {
      30: 65.0,
      40: 87.0,
      50: 109.0,
      60: 131.0,
      70: 153.0,
      80: 175.0,
      90: 197.0,
      100: 219.59,
    },
    childUnder18: {
      30: 32.0,
      40: 43.0,
      50: 54.0,
      60: 65.0,
      70: 76.0,
      80: 87.0,
      90: 98.0,
      100: 109.11,
    },
    childSchool: {
      30: 105.0,
      40: 140.0,
      50: 176.0,
      60: 211.0,
      70: 246.0,
      80: 281.0,
      90: 317.0,
      100: 352.45,
    },
    parentOne: {
      30: 52.0,
      40: 70.0,
      50: 88.0,
      60: 105.0,
      70: 123.0,
      80: 140.0,
      90: 158.0,
      100: 176.24,
    },
    parentTwo: {
      30: 104.0,
      40: 140.0,
      50: 176.0,
      60: 210.0,
      70: 246.0,
      80: 280.0,
      90: 316.0,
      100: 352.48,
    },
  },
};

/**
 * Get the correct pay rate for a specific year, rating, and dependent configuration
 * @param {number} year - The year to look up
 * @param {number} rating - The VA disability rating (0-100)
 * @param {Object} dependents - Dependent configuration
 * @returns {Object} - Payment calculation result
 */
export const getHistoricalRate = (year, rating, dependents = {}) => {
  const yearData = VA_PAY_RATES_HISTORICAL[year];
  if (!yearData) {
    return { error: `No data for year ${year}`, monthly: 0 };
  }

  const {
    married = false,
    childrenUnder18 = 0,
    childrenSchool = 0,
    dependentParents = 0,
  } = dependents;

  const baseRate = yearData.solo[rating] || 0;
  let total = baseRate;
  const breakdown = { baseRate };

  // Dependents only apply at 30%+
  if (rating >= 30) {
    if (married) {
      const spouseAdd = yearData.spouse[rating] || 0;
      total += spouseAdd;
      breakdown.spouse = spouseAdd;
    }
    if (childrenUnder18 > 0) {
      const childAdd = (yearData.childUnder18[rating] || 0) * childrenUnder18;
      total += childAdd;
      breakdown.childrenUnder18 = childAdd;
    }
    if (childrenSchool > 0) {
      const schoolAdd = (yearData.childSchool[rating] || 0) * childrenSchool;
      total += schoolAdd;
      breakdown.childrenSchool = schoolAdd;
    }
    if (dependentParents === 1) {
      const parentAdd = yearData.parentOne[rating] || 0;
      total += parentAdd;
      breakdown.parents = parentAdd;
    } else if (dependentParents >= 2) {
      const parentAdd = yearData.parentTwo[rating] || 0;
      total += parentAdd;
      breakdown.parents = parentAdd;
    }
  }

  return {
    year,
    rating,
    monthly: Math.round(total * 100) / 100,
    annual: Math.round(total * 12 * 100) / 100,
    breakdown,
    colaIncrease: yearData.colaIncrease,
    effectiveDate: yearData.effectiveDate,
  };
};

/**
 * Analyze a veteran's rating history for potential underpayments
 * @param {Array} ratingHistory - Array of { effectiveDate, rating, dependents }
 * @returns {Object} - Analysis result with potential underpayments
 */
export const analyzeRetroactivePay = (ratingHistory) => {
  if (!ratingHistory || ratingHistory.length === 0) {
    return { periods: [], totalPotentialUnderpayment: 0 };
  }

  // Sort by date
  const sorted = [...ratingHistory].sort(
    (a, b) => new Date(a.effectiveDate) - new Date(b.effectiveDate),
  );

  const periods = [];
  let _totalPotentialUnderpayment = 0;

  sorted.forEach((period, index) => {
    const startDate = new Date(period.effectiveDate);
    const endDate =
      index < sorted.length - 1
        ? new Date(sorted[index + 1].effectiveDate)
        : new Date();

    // Calculate months covered
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // Get the correct rate table year (rates effective Dec 1 of previous year)
      let rateYear = year;
      if (month < 11) {
        // Before December
        rateYear = year;
      } else {
        rateYear = year + 1;
      }

      // Ensure we have data for this year
      if (VA_PAY_RATES_HISTORICAL[rateYear]) {
        const shouldHavePaid = getHistoricalRate(
          rateYear,
          period.rating,
          period.dependents,
        );

        periods.push({
          month: currentDate.toISOString().slice(0, 7),
          rating: period.rating,
          shouldHavePaid: shouldHavePaid.monthly,
          rateYear: rateYear,
          dependents: period.dependents,
        });
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  });

  return {
    periods,
    summary: generatePaySummary(periods),
    totalMonths: periods.length,
  };
};

/**
 * Generate a summary of pay analysis
 */
const generatePaySummary = (periods) => {
  const byYear = {};

  periods.forEach((p) => {
    const year = p.month.slice(0, 4);
    if (!byYear[year]) {
      byYear[year] = { months: 0, totalShouldPaid: 0 };
    }
    byYear[year].months++;
    byYear[year].totalShouldPaid += p.shouldHavePaid;
  });

  return Object.entries(byYear).map(([year, data]) => ({
    year,
    months: data.months,
    totalShouldPaid: Math.round(data.totalShouldPaid * 100) / 100,
  }));
};

/**
 * Calculate bilateral factor compliance
 * Checks if bilateral factor was likely applied correctly
 */
export const checkBilateralFactorCompliance = (conditions) => {
  const bilateralConditions = conditions.filter(
    (c) => c.side === "left" || c.side === "right" || c.side === "bilateral",
  );

  if (bilateralConditions.length < 2) {
    return {
      applicable: false,
      message:
        "Bilateral factor requires conditions affecting paired extremities",
    };
  }

  // Check for paired conditions
  const bodyParts = {};
  bilateralConditions.forEach((c) => {
    const part = c.bodyPart || "unknown";
    if (!bodyParts[part]) bodyParts[part] = [];
    bodyParts[part].push(c);
  });

  const pairedParts = Object.entries(bodyParts).filter(
    ([_, conditions]) =>
      (conditions.some((c) => c.side === "left") &&
        conditions.some((c) => c.side === "right")) ||
      conditions.some((c) => c.side === "bilateral"),
  );

  if (pairedParts.length === 0) {
    return {
      applicable: false,
      message: "No paired bilateral conditions found",
    };
  }

  return {
    applicable: true,
    pairedParts: pairedParts.map(([part, _]) => part),
    message: `Bilateral factor should be applied to: ${pairedParts.map(([p]) => p).join(", ")}`,
    potentialBonus:
      "Bilateral factor adds ~10% to combined bilateral rating before final calculation",
  };
};

/**
 * Get the current year's compensation rates
 * Automatically selects the appropriate rate year based on current date
 * @returns {Object} - The current year's rate data
 */
export const getCurrentYearRates = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth(); // 0-indexed, so December = 11

  // VA rates effective Dec 1, so before Dec use current year, Dec onwards use next year
  const effectiveYear = month >= 11 ? year + 1 : year;

  // Fall back to latest available year if current year not yet added
  const availableYears = Object.keys(VA_PAY_RATES_HISTORICAL)
    .map(Number)
    .sort((a, b) => b - a);
  const rateYear =
    availableYears.find((y) => y <= effectiveYear) || availableYears[0];

  return {
    year: rateYear,
    rates: VA_PAY_RATES_HISTORICAL[rateYear],
    isLatest: rateYear === availableYears[0],
  };
};

/**
 * Common Clear and Unmistakable Error (CUE) patterns
 */
export const CUE_PATTERNS = [
  {
    id: "bilateral_not_applied",
    name: "Bilateral Factor Not Applied",
    description:
      "VA failed to apply 10% bilateral factor when rating conditions affecting paired extremities",
    detection:
      "Check if you have left/right conditions of same body part rated together",
    severity: "high",
  },
  {
    id: "wrong_diagnostic_code",
    name: "Wrong Diagnostic Code Used",
    description:
      "VA used a diagnostic code that results in a lower maximum rating than a more appropriate code",
    detection:
      "Compare your assigned DC against similar conditions with higher maximums",
    severity: "high",
  },
  {
    id: "effective_date_wrong",
    name: "Incorrect Effective Date",
    description:
      "VA used wrong effective date, missing earlier date when evidence supported condition",
    detection: "Review C-File for earliest medical evidence of condition",
    severity: "high",
  },
  {
    id: "secondary_missed",
    name: "Secondary Condition Not Considered",
    description:
      "VA failed to consider a condition as secondary to an already service-connected disability",
    detection:
      "Review medical records for conditions caused by or worsened by SC conditions",
    severity: "medium",
  },
  {
    id: "tdiu_not_considered",
    name: "TDIU Not Properly Considered",
    description:
      "VA failed to consider TDIU when veteran could not maintain substantial gainful employment",
    detection: "Review employment history and compare to combined rating",
    severity: "high",
  },
  {
    id: "pyramiding_applied_wrong",
    name: "Invalid Pyramiding Reduction",
    description:
      'VA incorrectly reduced ratings claiming "pyramiding" when conditions have distinct symptoms',
    detection:
      "Check if conditions were reduced despite affecting different functions",
    severity: "medium",
  },
];

export default VA_PAY_RATES_HISTORICAL;
