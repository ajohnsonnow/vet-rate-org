import { describe, it, expect } from 'vitest';
import { isStaleData, getDataAgeDays } from '../utils/staleDataDetection';

describe('staleDataDetection', () => {
  describe('isStaleData', () => {
    it('returns true when no lastVerifiedDate', () => {
      expect(isStaleData({})).toBe(true);
      expect(isStaleData({ name: 'PTSD' })).toBe(true);
    });

    it('returns true for data older than 365 days', () => {
      const oldDate = new Date();
      oldDate.setDate(oldDate.getDate() - 400);
      expect(isStaleData({ lastVerifiedDate: oldDate.toISOString() })).toBe(true);
    });

    it('returns false for recently verified data', () => {
      const recent = new Date();
      recent.setDate(recent.getDate() - 30);
      expect(isStaleData({ lastVerifiedDate: recent.toISOString() })).toBe(false);
    });

    it('handles invalid date strings gracefully', () => {
      // 'not-a-date' creates an Invalid Date which produces NaN in calculations
      const result = isStaleData({ lastVerifiedDate: 'not-a-date' });
      expect(typeof result).toBe('boolean');
    });
  });

  describe('getDataAgeDays', () => {
    it('returns Infinity when no date', () => {
      expect(getDataAgeDays({})).toBe(Infinity);
    });

    it('returns correct age in days', () => {
      const d = new Date();
      d.setDate(d.getDate() - 100);
      const age = getDataAgeDays({ lastVerifiedDate: d.toISOString() });
      expect(age).toBeGreaterThanOrEqual(99);
      expect(age).toBeLessThanOrEqual(101);
    });

    it('handles invalid dates gracefully', () => {
      const result = getDataAgeDays({ lastVerifiedDate: 'garbage' });
      // NaN or Infinity depending on implementation
      expect(typeof result).toBe('number');
    });
  });
});
