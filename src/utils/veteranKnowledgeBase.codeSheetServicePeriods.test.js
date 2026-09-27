/**
 * mergeServicePeriodsIntoVKB investigation (fix/dossier-and-vkb-periods): a
 * grep for direct callers in musterCallProcessor.js finds none, but the VA
 * code sheet's periods already reach the VKB in production through an
 * existing indirect path - persistFormationDocument's
 * mergeRatingDecisionIntoVKBForFile calls mergeRatingDecisionIntoVKB
 * whenever hasRatingDecisions(result) is true, which is true whenever
 * extractedData.ratingSource === "code_sheet" (the exact same field
 * saveCodeSheetServicePeriodsToProfile gates on to write the profile side),
 * and mergeRatingDecisionIntoVKB forwards decisionData.servicePeriods
 * straight into mergeServicePeriodsIntoVKB. Verified end-to-end below with
 * the same extractedData shape buildSegmentedCFileResult's
 * _ratingFieldsFromCodeSheet produces. Fixture values are synthetic.
 *
 * That path was NOT clearing the top-level vkb.serviceHistory.entryDateDerived
 * flag (distinct from each service period's own serviceStartDateDerived) when
 * an authoritative code-sheet date corrected the calculated primary period -
 * generateLLMContext's "Service:" line kept appending "(calculated from net
 * service)" after a now-printed date. Fixed in _upsertVkbServicePeriod.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  mergeRatingDecisionIntoVKB,
  mergeServicePeriodsIntoVKB,
  generateLLMContext,
} from "./veteranKnowledgeBase";

describe("code-sheet service periods reach the VKB via the existing production path", () => {
  it("lands in vkb.serviceHistory.servicePeriods from a code-sheet-shaped decisionData", () => {
    const vkb = initializeVKB();
    mergeRatingDecisionIntoVKB(
      vkb,
      {
        ratingSource: "code_sheet",
        conditions: [],
        servicePeriods: [
          {
            entryDate: "2002-05-06",
            separationDate: "2007-06-29",
            branch: "Army",
            characterOfDischarge: "Honorable",
          },
        ],
      },
      { fileName: "cfile_codesheet.pdf" },
    );

    const period = vkb.serviceHistory.servicePeriods.find(
      (p) => p.serviceStartDate === "2002-05-06",
    );
    expect(period).toBeDefined();
    expect(period.serviceEndDate).toBe("2007-06-29");
    expect(period.characterOfService).toBe("Honorable");
  });
});

describe("mergeServicePeriodsIntoVKB: near-match date correction", () => {
  it("corrects an NGB-22-sourced period's dates to the code sheet's authoritative values within tolerance", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army National Guard",
      entryDate: "2002-03-08",
      separationDate: "2010-06-15",
    });

    mergeServicePeriodsIntoVKB(vkb, [
      {
        entryDate: "2002-03-05",
        separationDate: "2010-06-15",
        branch: "Army National Guard",
        characterOfDischarge: "Honorable",
      },
    ]);

    expect(vkb.serviceHistory.servicePeriods).toHaveLength(1);
    const period = vkb.serviceHistory.servicePeriods[0];
    expect(period.serviceStartDate).toBe("2002-03-05");
    expect(period.characterOfService).toBe("Honorable");
  });
});

describe("mergeServicePeriodsIntoVKB: derived flag cleared on authoritative replacement", () => {
  it("clears both the period-level and top-level entryDateDerived flags when the code sheet supplies the printed date for the calculated primary period", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army National Guard",
      entryDate: "2002-03-05",
      entryDateDerived: true,
      separationDate: "2010-06-15",
    });
    expect(vkb.serviceHistory.entryDateDerived).toBe(true);

    mergeServicePeriodsIntoVKB(vkb, [
      { entryDate: "2002-03-05", separationDate: "2010-06-15" },
    ]);

    expect(vkb.serviceHistory.servicePeriods[0].serviceStartDateDerived).toBe(
      false,
    );
    expect(vkb.serviceHistory.entryDateDerived).toBe(false);
    expect(generateLLMContext(vkb)).not.toContain(
      "calculated from net service",
    );
  });
});

describe("mergeServicePeriodsIntoVKB: no cross-period attachment", () => {
  it("does not clear a different period's flag, or the top-level flag, when correcting an unrelated period", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(vkb, {
      branch: "Army National Guard",
      entryDate: "2002-03-05",
      entryDateDerived: true,
      separationDate: "2010-06-15",
    });
    // A second, distinct enlistment the code sheet below does not describe.
    vkb.serviceHistory.servicePeriods.push({
      serviceStartDate: "2016-02-01",
      serviceEndDate: "2016-08-01",
      serviceStartDateDerived: true,
      branch: "Army National Guard",
    });

    mergeServicePeriodsIntoVKB(vkb, [
      {
        entryDate: "2016-02-03",
        separationDate: "2016-08-01",
        branch: "Army National Guard",
        characterOfDischarge: "Honorable",
      },
    ]);

    const untouchedPrimary = vkb.serviceHistory.servicePeriods.find(
      (p) => p.serviceStartDate === "2002-03-05",
    );
    expect(untouchedPrimary.serviceStartDateDerived).toBe(true);
    expect(vkb.serviceHistory.entryDate).toBe("2002-03-05");
    expect(vkb.serviceHistory.entryDateDerived).toBe(true);

    const corrected = vkb.serviceHistory.servicePeriods.find(
      (p) => p.serviceStartDate === "2016-02-03",
    );
    expect(corrected).toBeDefined();
    expect(corrected.serviceStartDateDerived).toBe(false);
    expect(corrected.characterOfService).toBe("Honorable");
  });
});
