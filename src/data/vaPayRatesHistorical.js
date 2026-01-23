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
    effectiveDate: '2019-12-01',
    solo: {
      0: 0, 10: 142.29, 20: 281.27, 30: 435.69, 40: 627.61,
      50: 893.43, 60: 1131.68, 70: 1426.17, 80: 1657.80, 90: 1862.96, 100: 3106.04
    },
    spouse: {
      30: 51.00, 40: 68.00, 50: 86.00, 60: 103.00, 70: 120.00, 80: 137.00, 90: 155.00, 100: 172.43
    },
    childUnder18: {
      30: 25.00, 40: 34.00, 50: 42.00, 60: 51.00, 70: 60.00, 80: 68.00, 90: 77.00, 100: 85.86
    },
    childSchool: {
      30: 83.00, 40: 110.00, 50: 138.00, 60: 166.00, 70: 193.00, 80: 221.00, 90: 249.00, 100: 276.84
    },
    parentOne: {
      30: 41.00, 40: 55.00, 50: 69.00, 60: 83.00, 70: 97.00, 80: 110.00, 90: 124.00, 100: 138.45
    },
    parentTwo: {
      30: 82.00, 40: 110.00, 50: 138.00, 60: 165.00, 70: 193.00, 80: 220.00, 90: 248.00, 100: 276.84
    }
  },

  // ============ 2021 RATES (Effective Dec 1, 2020 - 1.3% COLA) ============
  2021: {
    colaIncrease: 1.3,
    effectiveDate: '2020-12-01',
    solo: {
      0: 0, 10: 144.14, 20: 284.93, 30: 441.35, 40: 635.77,
      50: 905.04, 60: 1146.39, 70: 1444.71, 80: 1679.35, 90: 1887.18, 100: 3146.42
    },
    spouse: {
      30: 52.00, 40: 69.00, 50: 87.00, 60: 104.00, 70: 122.00, 80: 139.00, 90: 157.00, 100: 174.66
    },
    childUnder18: {
      30: 26.00, 40: 34.00, 50: 43.00, 60: 52.00, 70: 60.00, 80: 69.00, 90: 78.00, 100: 86.98
    },
    childSchool: {
      30: 84.00, 40: 112.00, 50: 140.00, 60: 168.00, 70: 196.00, 80: 224.00, 90: 252.00, 100: 280.44
    },
    parentOne: {
      30: 42.00, 40: 56.00, 50: 70.00, 60: 84.00, 70: 98.00, 80: 112.00, 90: 126.00, 100: 140.25
    },
    parentTwo: {
      30: 83.00, 40: 111.00, 50: 140.00, 60: 167.00, 70: 196.00, 80: 223.00, 90: 251.00, 100: 280.44
    }
  },

  // ============ 2022 RATES (Effective Dec 1, 2021 - 5.9% COLA) ============
  2022: {
    colaIncrease: 5.9,
    effectiveDate: '2021-12-01',
    solo: {
      0: 0, 10: 152.64, 20: 301.74, 30: 467.39, 40: 673.28,
      50: 958.44, 60: 1214.03, 70: 1529.95, 80: 1778.43, 90: 1998.52, 100: 3332.06
    },
    spouse: {
      30: 55.00, 40: 73.00, 50: 92.00, 60: 110.00, 70: 129.00, 80: 147.00, 90: 166.00, 100: 184.96
    },
    childUnder18: {
      30: 27.00, 40: 36.00, 50: 46.00, 60: 55.00, 70: 64.00, 80: 73.00, 90: 83.00, 100: 92.11
    },
    childSchool: {
      30: 89.00, 40: 119.00, 50: 148.00, 60: 178.00, 70: 207.00, 80: 237.00, 90: 267.00, 100: 296.99
    },
    parentOne: {
      30: 44.00, 40: 59.00, 50: 74.00, 60: 89.00, 70: 104.00, 80: 118.00, 90: 133.00, 100: 148.52
    },
    parentTwo: {
      30: 88.00, 40: 118.00, 50: 148.00, 60: 177.00, 70: 207.00, 80: 236.00, 90: 266.00, 100: 296.99
    }
  },

  // ============ 2023 RATES (Effective Dec 1, 2022 - 8.7% COLA) ============
  2023: {
    colaIncrease: 8.7,
    effectiveDate: '2022-12-01',
    solo: {
      0: 0, 10: 165.92, 20: 327.99, 30: 508.05, 40: 731.86,
      50: 1041.82, 60: 1319.65, 70: 1663.06, 80: 1933.15, 90: 2172.39, 100: 3621.95
    },
    spouse: {
      30: 60.00, 40: 80.00, 50: 100.00, 60: 120.00, 70: 140.00, 80: 160.00, 90: 181.00, 100: 201.06
    },
    childUnder18: {
      30: 30.00, 40: 40.00, 50: 50.00, 60: 60.00, 70: 69.00, 80: 80.00, 90: 90.00, 100: 100.12
    },
    childSchool: {
      30: 97.00, 40: 129.00, 50: 161.00, 60: 193.00, 70: 225.00, 80: 258.00, 90: 290.00, 100: 322.82
    },
    parentOne: {
      30: 48.00, 40: 64.00, 50: 81.00, 60: 97.00, 70: 113.00, 80: 129.00, 90: 145.00, 100: 161.44
    },
    parentTwo: {
      30: 96.00, 40: 128.00, 50: 161.00, 60: 193.00, 70: 225.00, 80: 257.00, 90: 289.00, 100: 322.82
    }
  },

  // ============ 2024 RATES (Effective Dec 1, 2023 - 3.2% COLA) ============
  2024: {
    colaIncrease: 3.2,
    effectiveDate: '2023-12-01',
    solo: {
      0: 0, 10: 171.23, 20: 338.49, 30: 524.31, 40: 755.28,
      50: 1075.16, 60: 1361.88, 70: 1716.28, 80: 1995.01, 90: 2241.91, 100: 3737.85
    },
    spouse: {
      30: 62.00, 40: 83.00, 50: 103.00, 60: 124.00, 70: 145.00, 80: 165.00, 90: 187.00, 100: 207.50
    },
    childUnder18: {
      30: 31.00, 40: 41.00, 50: 52.00, 60: 62.00, 70: 72.00, 80: 83.00, 90: 93.00, 100: 103.32
    },
    childSchool: {
      30: 100.00, 40: 133.00, 50: 166.00, 60: 199.00, 70: 233.00, 80: 266.00, 90: 299.00, 100: 333.15
    },
    parentOne: {
      30: 50.00, 40: 66.00, 50: 84.00, 60: 100.00, 70: 117.00, 80: 133.00, 90: 150.00, 100: 166.61
    },
    parentTwo: {
      30: 99.00, 40: 132.00, 50: 166.00, 60: 199.00, 70: 232.00, 80: 265.00, 90: 298.00, 100: 333.15
    }
  },

  // ============ 2025 RATES (Effective Dec 1, 2024 - 2.5% COLA) ============
  2025: {
    colaIncrease: 2.5,
    effectiveDate: '2024-12-01',
    solo: {
      0: 0, 10: 175.51, 20: 346.96, 30: 537.42, 40: 774.16,
      50: 1102.04, 60: 1395.92, 70: 1759.19, 80: 2044.89, 90: 2297.96, 100: 3831.30
    },
    spouse: {
      30: 64.00, 40: 85.00, 50: 106.00, 60: 127.00, 70: 149.00, 80: 169.00, 90: 192.00, 100: 212.69
    },
    childUnder18: {
      30: 32.00, 40: 42.00, 50: 53.00, 60: 64.00, 70: 74.00, 80: 85.00, 90: 95.00, 100: 105.90
    },
    childSchool: {
      30: 103.00, 40: 136.00, 50: 170.00, 60: 204.00, 70: 239.00, 80: 273.00, 90: 306.00, 100: 341.48
    },
    parentOne: {
      30: 51.00, 40: 68.00, 50: 86.00, 60: 103.00, 70: 120.00, 80: 136.00, 90: 154.00, 100: 170.78
    },
    parentTwo: {
      30: 101.00, 40: 135.00, 50: 170.00, 60: 204.00, 70: 238.00, 80: 272.00, 90: 305.00, 100: 341.48
    }
  },

  // ============ 2026 RATES (Effective Dec 1, 2025 - 2.8% COLA) ============
  2026: {
    colaIncrease: 2.8,
    effectiveDate: '2025-12-01',
    solo: {
      0: 0, 10: 180.42, 20: 356.66, 30: 552.47, 40: 795.84,
      50: 1132.90, 60: 1435.02, 70: 1808.45, 80: 2102.15, 90: 2362.30, 100: 3938.58
    },
    spouse: {
      30: 65.00, 40: 87.00, 50: 109.00, 60: 131.00, 70: 153.00, 80: 175.00, 90: 197.00, 100: 219.59
    },
    childUnder18: {
      30: 32.00, 40: 43.00, 50: 54.00, 60: 65.00, 70: 76.00, 80: 87.00, 90: 98.00, 100: 109.11
    },
    childSchool: {
      30: 105.00, 40: 140.00, 50: 176.00, 60: 211.00, 70: 246.00, 80: 281.00, 90: 317.00, 100: 352.45
    },
    parentOne: {
      30: 52.00, 40: 70.00, 50: 88.00, 60: 105.00, 70: 123.00, 80: 140.00, 90: 158.00, 100: 176.24
    },
    parentTwo: {
      30: 104.00, 40: 140.00, 50: 176.00, 60: 210.00, 70: 246.00, 80: 280.00, 90: 316.00, 100: 352.48
    }
  }
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
    effectiveDate: yearData.effectiveDate
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
  const sorted = [...ratingHistory].sort((a, b) => 
    new Date(a.effectiveDate) - new Date(b.effectiveDate)
  );

  const periods = [];
  let totalPotentialUnderpayment = 0;

  sorted.forEach((period, index) => {
    const startDate = new Date(period.effectiveDate);
    const endDate = index < sorted.length - 1 
      ? new Date(sorted[index + 1].effectiveDate)
      : new Date();

    // Calculate months covered
    let currentDate = new Date(startDate);
    while (currentDate < endDate) {
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();
      
      // Get the correct rate table year (rates effective Dec 1 of previous year)
      let rateYear = year;
      if (month < 11) { // Before December
        rateYear = year;
      } else {
        rateYear = year + 1;
      }

      // Ensure we have data for this year
      if (VA_PAY_RATES_HISTORICAL[rateYear]) {
        const shouldHavePaid = getHistoricalRate(rateYear, period.rating, period.dependents);
        
        periods.push({
          month: currentDate.toISOString().slice(0, 7),
          rating: period.rating,
          shouldHavePaid: shouldHavePaid.monthly,
          rateYear: rateYear,
          dependents: period.dependents
        });
      }

      // Move to next month
      currentDate.setMonth(currentDate.getMonth() + 1);
    }
  });

  return {
    periods,
    summary: generatePaySummary(periods),
    totalMonths: periods.length
  };
};

/**
 * Generate a summary of pay analysis
 */
const generatePaySummary = (periods) => {
  const byYear = {};
  
  periods.forEach(p => {
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
    totalShouldPaid: Math.round(data.totalShouldPaid * 100) / 100
  }));
};

/**
 * Calculate bilateral factor compliance
 * Checks if bilateral factor was likely applied correctly
 */
export const checkBilateralFactorCompliance = (conditions) => {
  const bilateralConditions = conditions.filter(c => 
    c.side === 'left' || c.side === 'right' || c.side === 'bilateral'
  );

  if (bilateralConditions.length < 2) {
    return { applicable: false, message: 'Bilateral factor requires conditions affecting paired extremities' };
  }

  // Check for paired conditions
  const bodyParts = {};
  bilateralConditions.forEach(c => {
    const part = c.bodyPart || 'unknown';
    if (!bodyParts[part]) bodyParts[part] = [];
    bodyParts[part].push(c);
  });

  const pairedParts = Object.entries(bodyParts).filter(([_, conditions]) => 
    conditions.some(c => c.side === 'left') && conditions.some(c => c.side === 'right') ||
    conditions.some(c => c.side === 'bilateral')
  );

  if (pairedParts.length === 0) {
    return { applicable: false, message: 'No paired bilateral conditions found' };
  }

  return {
    applicable: true,
    pairedParts: pairedParts.map(([part, _]) => part),
    message: `Bilateral factor should be applied to: ${pairedParts.map(([p]) => p).join(', ')}`,
    potentialBonus: 'Bilateral factor adds ~10% to combined bilateral rating before final calculation'
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
  const availableYears = Object.keys(VA_PAY_RATES_HISTORICAL).map(Number).sort((a, b) => b - a);
  const rateYear = availableYears.find(y => y <= effectiveYear) || availableYears[0];
  
  return {
    year: rateYear,
    rates: VA_PAY_RATES_HISTORICAL[rateYear],
    isLatest: rateYear === availableYears[0]
  };
};

/**
 * Common Clear and Unmistakable Error (CUE) patterns
 */
export const CUE_PATTERNS = [
  {
    id: 'bilateral_not_applied',
    name: 'Bilateral Factor Not Applied',
    description: 'VA failed to apply 10% bilateral factor when rating conditions affecting paired extremities',
    detection: 'Check if you have left/right conditions of same body part rated together',
    severity: 'high'
  },
  {
    id: 'wrong_diagnostic_code',
    name: 'Wrong Diagnostic Code Used',
    description: 'VA used a diagnostic code that results in a lower maximum rating than a more appropriate code',
    detection: 'Compare your assigned DC against similar conditions with higher maximums',
    severity: 'high'
  },
  {
    id: 'effective_date_wrong',
    name: 'Incorrect Effective Date',
    description: 'VA used wrong effective date, missing earlier date when evidence supported condition',
    detection: 'Review C-File for earliest medical evidence of condition',
    severity: 'high'
  },
  {
    id: 'secondary_missed',
    name: 'Secondary Condition Not Considered',
    description: 'VA failed to consider a condition as secondary to an already service-connected disability',
    detection: 'Review medical records for conditions caused by or worsened by SC conditions',
    severity: 'medium'
  },
  {
    id: 'tdiu_not_considered',
    name: 'TDIU Not Properly Considered',
    description: 'VA failed to consider TDIU when veteran could not maintain substantial gainful employment',
    detection: 'Review employment history and compare to combined rating',
    severity: 'high'
  },
  {
    id: 'pyramiding_applied_wrong',
    name: 'Invalid Pyramiding Reduction',
    description: 'VA incorrectly reduced ratings claiming "pyramiding" when conditions have distinct symptoms',
    detection: 'Check if conditions were reduced despite affecting different functions',
    severity: 'medium'
  }
];

export default VA_PAY_RATES_HISTORICAL;
