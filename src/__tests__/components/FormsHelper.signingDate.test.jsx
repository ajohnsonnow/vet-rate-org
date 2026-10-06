/**
 * No Forms Helper text document prints a date beside the signature, or as
 * the document's date: the signer writes the date on the day they sign. The
 * clock is set to a date that appears nowhere else, so any use of today's
 * date would show. All values are invented.
 */
import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { _generateFormsHelperContent } from "../../components/FormsHelper.jsx";

const DOCUMENTS = [
  "medical-release",
  "priority-processing",
  "vso-appointment",
  "vso-appointment-individual",
  "third-party-authorization",
  "personal-records-request",
  "alternate-signer",
  "nursing-home-info",
  "substitution-request",
  "income-asset-statement",
  "medical-expense-report",
  "employment-info",
];

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2031-07-04T12:00:00"));
});
afterEach(() => {
  vi.useRealTimers();
});

describe.each(DOCUMENTS)("%s text document", (id) => {
  const text = () =>
    _generateFormsHelperContent({ id }, { veteranName: "Marlow Testwright" });

  it("leaves a blank line for the date", () => {
    expect(text()).toMatch(/^Date(?: Signed)?: _{8,}$/m);
  });

  it("prints today's date nowhere", () => {
    expect(text()).not.toMatch(/2031|2032|July 4|7\/4\//);
  });
});

describe("medical release expiration", () => {
  it("is stated from the date of signature, not worked out from today", () => {
    const text = _generateFormsHelperContent({ id: "medical-release" }, {});

    expect(text).toMatch(/expires 180 days from the date of signature/);
  });
});
