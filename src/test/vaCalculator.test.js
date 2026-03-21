import { describe, it, expect } from "vitest";
import {
  calculatePaymentEffectiveDate,
  calculateBackpayMonths,
  VA_PAY_RATES_2026,
} from "../utils/vaCalculator";

describe("calculatePaymentEffectiveDate", () => {
  it("returns first of next month", () => {
    const result = calculatePaymentEffectiveDate("2025-12-03");
    expect(result.getMonth()).toBe(0); // January
    expect(result.getDate()).toBe(1);
    expect(result.getFullYear()).toBe(2026);
  });

  it("handles end of month", () => {
    const result = calculatePaymentEffectiveDate("2024-06-30");
    expect(result.getMonth()).toBe(6); // July
    expect(result.getDate()).toBe(1);
  });

  it("handles mid-month date", () => {
    const result = calculatePaymentEffectiveDate("2023-03-15");
    expect(result.getMonth()).toBe(3); // April
    expect(result.getDate()).toBe(1);
  });

  it("handles December to January year rollover", () => {
    const result = calculatePaymentEffectiveDate("2025-12-25");
    expect(result.getFullYear()).toBe(2026);
    expect(result.getMonth()).toBe(0);
  });
});

describe("calculateBackpayMonths", () => {
  it("returns correct months of backpay", () => {
    const result = calculateBackpayMonths("2025-01-15", "2026-01-15");
    expect(result.totalMonths).toBe(11); // Feb 2025 to Jan 2026
  });

  it("returns 0 for future effective date", () => {
    const result = calculateBackpayMonths("2027-01-01", "2026-01-01");
    expect(result.totalMonths).toBe(0);
  });

  it("includes explanation", () => {
    const result = calculateBackpayMonths("2025-06-01");
    expect(result.explanation).toContain("38 CFR");
  });

  it("returns payment effective date", () => {
    const result = calculateBackpayMonths("2025-03-15");
    expect(result.paymentEffectiveDate).toBeDefined();
    expect(result.paymentEffectiveDate.getDate()).toBe(1);
  });
});

describe("VA_PAY_RATES_2026", () => {
  it("has solo rates", () => {
    expect(VA_PAY_RATES_2026.solo).toBeDefined();
  });

  it("0% rate is $0", () => {
    expect(VA_PAY_RATES_2026.solo[0]).toBe(0);
  });

  it("100% rate is highest", () => {
    const rates = Object.values(VA_PAY_RATES_2026.solo);
    const max = Math.max(...rates);
    expect(VA_PAY_RATES_2026.solo[100]).toBe(max);
  });

  it("rates increase with percentage", () => {
    const percentages = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];
    for (let i = 1; i < percentages.length; i++) {
      expect(VA_PAY_RATES_2026.solo[percentages[i]]).toBeGreaterThan(
        VA_PAY_RATES_2026.solo[percentages[i - 1]],
      );
    }
  });

  it("10% rate matches 2026 published rate", () => {
    expect(VA_PAY_RATES_2026.solo[10]).toBe(180.42);
  });

  it("100% rate matches 2026 published rate", () => {
    expect(VA_PAY_RATES_2026.solo[100]).toBe(3938.58);
  });
});
