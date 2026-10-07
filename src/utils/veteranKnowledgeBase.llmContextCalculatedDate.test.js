/**
 * D-C (final10 QA correctness re-review, 2026-09-26): generateLLMContext's
 * "Service:" line and "Period N:" lines both read entryDate/serviceStartDate
 * straight off the VKB with no check of the sibling *Derived flag, so a
 * calculated NGB-22 entry date reached every AI tool's context (and
 * VKBViewer's own "Show LLM Context" panel) as a plain, unqualified fact.
 * Fixture values are generic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  mergeServicePeriodsIntoVKB,
  generateLLMContext,
} from "./veteranKnowledgeBase";

describe("D-C: generateLLMContext marks a calculated entry date", () => {
  it("marks the top-line Service: date as calculated", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army National Guard",
      entryDate: "2002-03-05",
      entryDateDerived: true,
      separationDate: "2010-06-15",
    });

    const context = generateLLMContext(vkb);
    expect(context).toContain(
      "Service: 2002-03-05 (calculated from net service) to 2010-06-15",
    );
  });

  it("does not mark a genuinely printed entry date", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army",
      entryDate: "2011-09-01",
      separationDate: "2015-09-01",
    });

    const context = generateLLMContext(vkb);
    expect(context).toContain("Service: 2011-09-01 to 2015-09-01");
    expect(context).not.toContain("calculated from net service");
  });

  it("marks a calculated primary period in a multi-period Service Periods list", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army National Guard",
      entryDate: "2002-03-05",
      entryDateDerived: true,
      separationDate: "2010-06-15",
      additionalPeriods: [
        { serviceStartDate: "2003-06-01", serviceEndDate: "2003-12-01" },
      ],
    });

    const context = generateLLMContext(vkb);
    expect(context).toContain(
      "Period 1: 2002-03-05 (calculated from net service) to 2010-06-15",
    );
    expect(context).toContain("Period 2: 2003-06-01 to 2003-12-01");
  });

  it("clears a stale per-period derived flag once a VA code sheet supplies the authoritative date for that same period", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army National Guard",
      entryDate: "2002-03-05",
      entryDateDerived: true,
      separationDate: "2010-06-15",
    });

    mergeServicePeriodsIntoVKB(vkb, [
      { entryDate: "2002-03-05", separationDate: "2010-06-15" },
    ]);

    expect(vkb.serviceHistory.servicePeriods[0].serviceStartDateDerived).toBe(
      false,
    );
  });
});
