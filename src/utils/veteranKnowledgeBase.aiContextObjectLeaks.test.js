/**
 * D12-5 (final12 QA, 2026-09-27): buildAwardsContext (generateLLMContext)
 * joined structured {type, position} device objects with
 * Array.prototype.join, which calls String() on each entry - every AI tool
 * that ever saw an award with a device was told "[object Object]" instead
 * of its real name. Renders a rich, generic VKB through generateLLMContext
 * and asserts the full output never leaks a raw object or a missing/NaN
 * value anywhere, not just in the awards section. Fixture values are
 * synthetic, not any real veteran's data.
 *
 * D13-7 (final13 QA): extended to also reject an empty "()" and a double
 * space within a line's own content (leading indentation, e.g. "  Period
 * 1:", is not content and is excluded) - buildServicePeriodsAndSeparationContext
 * used to print a Box-18 sub-period with a known branch but no
 * individually-tracked rank/MOS as "Army  ()".
 */
import { describe, it, expect } from "vitest";
import {
  initializeVKB,
  mergeDD214IntoVKB,
  generateLLMContext,
} from "./veteranKnowledgeBase";

const FORBIDDEN = ["[object Object]", "undefined", "NaN", "???"];

// D19-6: a raw uploaded file name is never a valid AI-context VALUE - ADR-008
// requires a neutral document label instead (see veteranKnowledgeBase.js's
// EVENT_TYPE_DOCUMENT_LABELS/_neutralSourceLabel/_neutralizeDescription).
const FILE_EXTENSION_PATTERN =
  /\.(pdf|jpe?g|png|gif|bmp|tiff?|heic|webp|docx?|txt|rtf)\b/i;

function expectNoLeaks(context) {
  FORBIDDEN.forEach((token) => expect(context).not.toContain(token));
  expect(context).not.toMatch(FILE_EXTENSION_PATTERN);
  context.split("\n").forEach((line) => {
    const content = line.replace(/^\s+/, "");
    expect(content).not.toMatch(/\(\s*\)/);
    expect(content).not.toMatch(/ {2,}/);
  });
  // D14-2 (final14 QA) / owner decision D: a claim number is never a valid
  // AI-context VALUE, whether or not it resolved - a missing claimNumber
  // must never render the literal word "null", and no claim number
  // (present or absent) may appear as "#<anything>" at all.
  expect(context).not.toMatch(/\bnull\b/i);
  expect(context).not.toMatch(/#null/i);
  expect(context).not.toMatch(/Claim #/i);
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
      entryDate: "2004-04-12",
      separationDate: "2010-03-28",
      characterOfService: "Honorable",
      rank: "Staff Sergeant",
      payGrade: "E-6",
      mos: "11B",
      mosTitle: "Infantryman",
      educationYears: 2,
      combatService: { hasVerifiedCombat: true, indicators: ["CIB"] },
      deployments: [
        { location: "Iraq", startDate: "2007-01-01", endDate: "2007-12-01" },
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
    date: "2004-04-12",
    description: "Entered active duty",
    source: "DD-214",
  });
  vkb.keyFacts.push({ fact: "Served in Iraq", source: "DD-214" });
  vkb.exposures.combat.push({
    incident: "IED blast",
    location: "Baghdad",
    date: "2007-06-01",
  });
  // A Box-18 sub-period (NGB-22 IADT/AD breakdown): branch known, rank/MOS
  // never individually tracked per sub-period.
  vkb.serviceHistory.servicePeriods.push({
    id: "period_window_1",
    serviceStartDate: "2004-01-01",
    serviceEndDate: "2004-03-01",
    branch: "Army",
    periodScope: "window",
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

  it("omits empty rank/MOS parts for a Box-18 sub-period instead of printing 'Army  ()'", () => {
    const context = generateLLMContext(buildRichVKB());

    expect(context).toContain("2004-01-01 to 2004-03-01 - Army\n");
    expect(context).not.toContain("Army  (");
    expectNoLeaks(context);
  });

  it("omits the trailing '()' when a MOS code has no title", () => {
    const vkb = initializeVKB();
    mergeDD214IntoVKB(
      vkb,
      { mos: "11B", mosTitle: "" },
      { fileName: "dd214.pdf" },
    );

    const context = generateLLMContext(vkb);
    expect(context).toContain("MOS: 11B\n");
    expect(context).not.toContain("11B (");
    expectNoLeaks(context);
  });

  it("omits the dangling 'at' when an environmental exposure has no location", () => {
    const vkb = initializeVKB();
    vkb.exposures.environmental.push({
      type: "Burn pits",
      location: "",
      dates: "",
      documentation: "",
    });

    const context = generateLLMContext(vkb);
    expect(context).toContain("Burn pits (dates unknown)");
    expect(context).not.toContain(" at  (");
    expectNoLeaks(context);
  });

  it("omits the dangling 'Need' when a missing-evidence entry has no evidenceType", () => {
    const vkb = initializeVKB();
    vkb.aiInsights.missingEvidence.push({
      condition: "Tinnitus",
      evidenceType: "",
      howToObtain: "Get a nexus letter",
      priority: "medium",
    });

    const context = generateLLMContext(vkb);
    expect(context).toContain("• Tinnitus\n");
    expect(context).not.toContain("Need \n");
    expect(context).not.toMatch(/[^\S\n]\n/);
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

describe("D14-2: claim numbers never enter AI context", () => {
  it('never prints "Claim #null" for a denial with no claimNumber, labels by condition + decision date instead', () => {
    const vkb = initializeVKB();
    for (let i = 0; i < 7; i += 1) {
      vkb.vaClaimsHistory.claims.push({
        claimNumber: null,
        status: "denied",
        decision: "denied",
        decisionDate: "2024-0" + ((i % 9) + 1) + "-01",
        conditions: [`Condition ${i}`],
        source: "decision_letter.pdf",
      });
    }

    const context = generateLLMContext(vkb);
    expectNoLeaks(context);
    expect(context).toContain("Condition 0: denied (decided 2024-01-01)");
  });

  it("never prints a real claim number either, even though it has one", () => {
    const vkb = initializeVKB();
    vkb.vaClaimsHistory.claims.push({
      claimNumber: "600123456789",
      status: "denied",
      decisionDate: "2024-05-01",
      conditions: ["Tinnitus"],
    });

    const context = generateLLMContext(vkb);
    expect(context).not.toContain("600123456789");
    expect(context).toContain("Tinnitus: denied (decided 2024-05-01)");
    expectNoLeaks(context);
  });
});

describe("D19-6: evidence timeline lines never leak a raw file name or print '???'", () => {
  it("neutralizes a raw file name embedded IN the description, not just the bracketed source label", () => {
    // Mirrors musterCallProcessor's own evidenceTimeline shape: description
    // is built as "<label>: <raw file.name>", not just carried on `source`.
    const vkb = initializeVKB();
    vkb.evidenceTimeline.push({
      date: "2024-03-01",
      dateIsProcessingDate: false,
      eventType: "document_import",
      description: "DD-214: veteran_jordan_faketon_dd214.pdf",
      source: "Muster Call",
      significance: "",
    });

    const context = generateLLMContext(vkb);
    expect(context).not.toContain("veteran_jordan_faketon_dd214.pdf");
    expectNoLeaks(context);
  });

  it("neutralizes a file name that contains spaces, not just underscore-joined tokens", () => {
    // The body class used to exclude whitespace, so it only replaced the
    // LAST space-free word of the name - "Jane Doe DD214.pdf" left
    // "Jane Doe " (the veteran's own name) sitting in front of the
    // replacement.
    const vkb = initializeVKB();
    vkb.evidenceTimeline.push({
      date: "2024-03-01",
      dateIsProcessingDate: false,
      eventType: "document_import",
      description: "DD-214: Jane Doe DD214.pdf",
      source: "Muster Call",
      significance: "",
    });

    const context = generateLLMContext(vkb);
    expect(context).not.toContain("Jane Doe");
    expectNoLeaks(context);
  });

  it("neutralizes a file name with interior dots, including a doubled extension", () => {
    const vkb = initializeVKB();
    vkb.evidenceTimeline.push({
      date: "2024-03-01",
      dateIsProcessingDate: false,
      eventType: "document_import",
      description: "Medical: J.Q.Faketon_STR.pdf",
      source: "Muster Call",
      significance: "",
    });
    vkb.evidenceTimeline.push({
      date: "2024-03-02",
      dateIsProcessingDate: false,
      eventType: "document_import",
      description: "Medical: faketon.pdf.pdf",
      source: "Muster Call",
      significance: "",
    });

    const context = generateLLMContext(vkb);
    expect(context).not.toContain("Faketon");
    expect(context).not.toContain("faketon");
    expectNoLeaks(context);
  });

  it("phrases a missing event date plainly instead of printing '???'", () => {
    const vkb = initializeVKB();
    vkb.evidenceTimeline.push({
      date: null,
      eventType: "document_import",
      description: "Decision Letter: decision_letter.pdf",
      source: "Muster Call",
      significance: "",
    });

    const context = generateLLMContext(vkb);
    expect(context).toContain("date not recorded");
    expect(context).not.toContain("???");
    expectNoLeaks(context);
  });
});
