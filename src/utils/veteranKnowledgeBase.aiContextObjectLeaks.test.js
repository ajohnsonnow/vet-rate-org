/**
 * D12-5 (final12 QA, 2026-09-27): buildAwardsContext (generateLLMContext)
 * joined structured {type, position} device objects with
 * Array.prototype.join, which calls String() on each entry - every AI tool
 * that ever saw an award with a device was told "[object Object]" instead
 * of its real name. Renders a rich, generic VKB through generateLLMContext
 * and asserts the full output never leaks a raw object or a missing/NaN
 * value anywhere, not just in the awards section. Fixture values are
 * synthetic, not any real veteran's data.
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  generateLLMContext,
} from "./veteranKnowledgeBase";

const FORBIDDEN = ["[object Object]", "undefined", "NaN"];

function expectNoLeaks(context) {
  FORBIDDEN.forEach((token) => expect(context).not.toContain(token));
}

function buildRichVKB() {
  const vkb = initializeVKB();
  vkb.personal.fullName = "Generic Veteran";
  vkb.personal.address = { city: "Springfield", state: "IL" };

  mergeDD214IntoVKB(
    vkb,
    {
      branch: "Army",
      component: "Active Duty",
      entryDate: "2004-06-22",
      separationDate: "2010-06-29",
      characterOfService: "Honorable",
      rank: "Staff Sergeant",
      payGrade: "E-6",
      mos: "11B",
      mosTitle: "Infantryman",
      educationYears: 2,
      combatService: { hasVerifiedCombat: true, indicators: ["CIB"] },
      deployments: [
        { location: "Iraq", startDate: "2005-01-01", endDate: "2005-12-01" },
      ],
      // Mixed award shapes in circulation, one with structured devices -
      // the exact combination that used to print "[object Object]".
      awards: [
        {
          name: "Army Commendation Medal",
          isCombat: true,
          devices: [
            { type: "v_device", position: "center" },
            { type: "bronze_olc", position: 0 },
          ],
        },
        { award: { name: "National Defense Service Medal" }, matchedText: "" },
        "Combat Action Badge",
      ],
    },
    { fileName: "dd214_generic.pdf" },
  );

  vkb.medicalConditions.current.push({
    name: "Tinnitus",
    ratedPercentage: 10,
    serviceConnected: true,
  });
  vkb.vaClaimsHistory.claims.push({
    claimNumber: "C-1",
    status: "Pending",
    filedDate: "2024-01-01",
  });
  vkb.vaClaimsHistory.ratings.push({ condition: "Tinnitus", percentage: 10 });
  vkb.evidenceTimeline.push({
    date: "2004-06-22",
    description: "Entered active duty",
    source: "DD-214",
  });
  vkb.keyFacts.push({ fact: "Served in Iraq", source: "DD-214" });
  vkb.exposures.combat.push({
    incident: "IED blast",
    location: "Baghdad",
    date: "2005-06-01",
  });
  return vkb;
}

describe("D12-5: generateLLMContext never leaks a raw object or NaN/undefined", () => {
  it("renders a rich, multi-section veteran with real award/device names and no leaks", () => {
    const context = generateLLMContext(buildRichVKB());

    expect(context).toContain("Army Commendation Medal");
    expect(context).toContain("V Device (Valor)");
    expect(context).toContain("Bronze Oak Leaf Cluster");
    expect(context).toContain("National Defense Service Medal");
    expect(context).toContain("Combat Action Badge");
    expectNoLeaks(context);
  });

  it("still renders a device of an unrecognized type by its raw type, not as an object", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      {
        awards: [
          {
            name: "Test Medal",
            devices: [{ type: "future_device", position: 0 }],
          },
        ],
      },
      { fileName: "dd214.pdf" },
    );

    const context = generateLLMContext(vkb);
    expect(context).toContain("future_device");
    expectNoLeaks(context);
  });
});
