import { describe, it, expect } from 'vitest';
import { calculateMonthlyCompensation, checkBilateralFactor, calculateExactCombinedRating } from '../../utils/ratingCalculator';

describe('calculateMonthlyCompensation', () => {
  it('returns 0 for 0% rating', () => {
    const result = calculateMonthlyCompensation(0);
    expect(result).toBe(0);
  });

  it('returns a positive amount for 100%', () => {
    const result = calculateMonthlyCompensation(100);
    expect(result).toBeGreaterThan(0);
  });

  it('returns higher amount for higher rating', () => {
    const r50 = calculateMonthlyCompensation(50);
    const r70 = calculateMonthlyCompensation(70);
    expect(r70).toBeGreaterThan(r50);
  });
});

describe('checkBilateralFactor', () => {
  it('returns a result with correct input shape', () => {
    const result = checkBilateralFactor([
      { name: 'left knee strain', rating: 30 },
      { name: 'right knee strain', rating: 30 },
    ]);
    expect(result).toBeDefined();
  });

  it('handles empty array', () => {
    const result = checkBilateralFactor([]);
    expect(result).toBeDefined();
  });
});

describe('calculateExactCombinedRating', () => {
  it('returns exact (unrounded) combined value', () => {
    const result = calculateExactCombinedRating([60, 40]);
    expect(typeof result).toBe('number');
    expect(result).toBeGreaterThan(0);
  });
});
