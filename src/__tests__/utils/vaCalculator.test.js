import { describe, it, expect } from 'vitest';
import { calculatePaymentEffectiveDate, calculateBackpayMonths, VA_PAY_RATES_2026 } from '../../utils/vaCalculator';

describe('calculatePaymentEffectiveDate', () => {
  it('moves to first of next month', () => {
    const result = calculatePaymentEffectiveDate('2025-12-03');
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(1);
    expect(result.getFullYear()).toBe(2026);
  });

  it('handles last day of month', () => {
    const result = calculatePaymentEffectiveDate('2024-06-30');
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(1);
  });

  it('handles mid-month date', () => {
    const result = calculatePaymentEffectiveDate('2023-03-15');
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(1);
  });
});

describe('calculateBackpayMonths', () => {
  it('calculates correct months', () => {
    const result = calculateBackpayMonths('2025-01-15', '2025-07-15');
    expect(result.totalMonths).toBe(5); // Feb-Jun = 5 months
  });

  it('returns 0 for future effective date', () => {
    const result = calculateBackpayMonths('2026-12-01', '2026-01-01');
    expect(result.totalMonths).toBe(0);
  });

  it('includes explanation about 38 CFR', () => {
    const result = calculateBackpayMonths('2025-01-01');
    expect(result.explanation).toContain('38 CFR');
  });
});

describe('VA_PAY_RATES_2026', () => {
  it('has solo rates for 0-100', () => {
    expect(VA_PAY_RATES_2026.solo[0]).toBe(0);
    expect(VA_PAY_RATES_2026.solo[100]).toBeGreaterThan(0);
    expect(VA_PAY_RATES_2026.solo[50]).toBeGreaterThan(0);
  });

  it('100% rate is highest', () => {
    const rates = VA_PAY_RATES_2026.solo;
    expect(rates[100]).toBeGreaterThan(rates[90]);
    expect(rates[90]).toBeGreaterThan(rates[80]);
  });
});
