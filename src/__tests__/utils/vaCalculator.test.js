/**
 * vaCalculator — date arithmetic + 2026 pay-rate table sanity.
 *
 * Combined-rating math has its own dedicated suite in
 * `vaCalculator.combined.test.js`. Dependent additions are locked in
 * `vaCalculator.dependents.test.js`. This file covers payment effective
 * date math (§ 3.400) and minimal sanity on the rate table.
 */
import { describe, it, expect } from "vitest";
import {
  calculatePaymentEffectiveDate,
  calculateBackpayMonths,
  VA_PAY_RATES_2026,
} from "../../utils/vaCalculator";

describe("calculatePaymentEffectiveDate (38 CFR § 3.400)", () => {
  it("moves to first of next month", () => {
    const result = calculatePaymentEffectiveDate("2025-12-03");
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(1);
    expect(result.getFullYear()).toBe(2026);
  });

  it("handles last day of month", () => {
    const result = calculatePaymentEffectiveDate("2024-06-30");
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(1);
  });

  it("handles mid-month date", () => {
    const result = calculatePaymentEffectiveDate("2023-03-15");
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(1);
  });

  it("rolls over December → next year January", () => {
    const result = calculatePaymentEffectiveDate("2025-12-25");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
  });
});

describe("calculateBackpayMonths", () => {
  it("returns correct months between dates", () => {
    const result = calculateBackpayMonths("2025-01-15", "2026-01-15");
    expect(result.totalMonths).toBe(11); // Feb 2025 → Jan 2026
  });

  it("returns 5 months for Feb–Jun span", () => {
    const result = calculateBackpayMonths("2025-01-15", "2025-07-15");
    expect(result.totalMonths).toBe(5);
  });

  it("returns 0 for future effective date", () => {
    const result = calculateBackpayMonths("2027-01-01", "2026-01-01");
    expect(result.totalMonths).toBe(0);
  });

  it("includes 38 CFR § 3.400 explanation", () => {
    const result = calculateBackpayMonths("2025-06-01");
    expect(result.explanation).toContain("38 CFR");
  });

  it("returns paymentEffectiveDate at first of month", () => {
    const result = calculateBackpayMonths("2025-03-15");
    expect(result.paymentEffectiveDate).toBeDefined();
    expect(result.paymentEffectiveDate.getDate()).toBe(1);
  });
});

describe("VA_PAY_RATES_2026 — table sanity", () => {
  it("has solo rates", () => {
    expect(VA_PAY_RATES_2026.solo).toBeDefined();
  });

  it("0% rate is $0", () => {
    expect(VA_PAY_RATES_2026.solo[0]).toBe(0);
  });

  it("100% rate is the highest", () => {
    const rates = Object.values(VA_PAY_RATES_2026.solo);
    expect(VA_PAY_RATES_2026.solo[100]).toBe(Math.max(...rates));
  });

  it("rates strictly increase across rating tiers", () => {
    const tiers = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (let i = 1; i < tiers.length; i++) {
      expect(VA_PAY_RATES_2026.solo[tiers[i]]).toBeGreaterThan(
        VA_PAY_RATES_2026.solo[tiers[i - 1]],
      );
    }
  });
});
