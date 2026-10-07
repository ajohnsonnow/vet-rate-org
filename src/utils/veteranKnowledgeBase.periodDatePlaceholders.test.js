/**
 * F8 (final13 QA re-review, 2026-09-28): D13-7 rewrote the "Period N:" line
 * to omit an empty rank/MOS part, but left serviceStartDate/serviceEndDate
 * themselves unguarded - a still-serving veteran's open-ended period (My
 * Packet's "+ Add Service Period" creates serviceEndDate: "") or a DD-214
 * whose end date wasn't extracted (null) printed literal "to null"/
 * "undefined to ..." into every AI tool's context. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  generateLLMContext,
} from "./veteranKnowledgeBase";

function vkbWithSecondPeriod(period) {
  const vkb = initializeVKB();
  mergeDD214IntoVKB(vkb, {
    branch: "Army National Guard",
    entryDate: "2002-03-05",
    separationDate: "2010-06-15",
  });
  vkb.serviceHistory.servicePeriods.push({
    id: "p2",
    branch: "Army National Guard",
    ...period,
  });
  return vkb;
}

describe("F8: Period line never prints a missing date as null/undefined", () => {
  it("shows a placeholder instead of literal 'null' for an unextracted end date", () => {
    const vkb = vkbWithSecondPeriod({
      serviceStartDate: "2012-04-01",
      serviceEndDate: null,
    });
    const context = generateLLMContext(vkb);
    expect(context).not.toContain("to null");
    expect(context).toContain("2012-04-01 to ?");
  });

  it("shows a placeholder instead of an empty string for a still-serving veteran's open period", () => {
    const vkb = vkbWithSecondPeriod({
      serviceStartDate: "2012-04-01",
      serviceEndDate: "",
    });
    const context = generateLLMContext(vkb);
    expect(context).not.toContain("2012-04-01  -");
    expect(context).toContain("2012-04-01 to ? - Army National Guard");
  });

  it("shows a placeholder instead of literal 'undefined' for a missing start date", () => {
    const vkb = vkbWithSecondPeriod({
      serviceStartDate: undefined,
      serviceEndDate: "2013-01-01",
    });
    const context = generateLLMContext(vkb);
    expect(context).not.toContain("undefined to");
    expect(context).toContain("? to 2013-01-01");
  });
});
