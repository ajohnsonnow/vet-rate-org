/**
 * calculateCompleteness was a 21-branch accumulator with no test of its own,
 * rewritten as a [points, predicate] rubric to clear the complexity ceiling the
 * pre-commit hook enforces. The oracle below is the original implementation
 * verbatim, so any drift in the rubric — a criterion dropped, a weight changed,
 * a category total that no longer sums to its documented value — fails here.
 */
import { describe, it, expect } from "vitest";
import {
  calculateCompleteness,
  initializeVKB,
} from "../../utils/veteranKnowledgeBase";

// Carries the complexity of 21 that prompted the rewrite — necessarily, since
// an oracle simplified to satisfy the linter would no longer be the thing it
// is checking against.
// eslint-disable-next-line complexity
const originalCalculateCompleteness = (vkb) => {
  let score = 0;
  let maxScore = 0;

  maxScore += 20;
  if (vkb.personal.fullName) score += 5;
  if (vkb.personal.dateOfBirth) score += 5;
  if (vkb.personal.address.state) score += 5;
  if (vkb.personal.email || vkb.personal.phone) score += 5;

  maxScore += 25;
  const hasServicePeriods = vkb.serviceHistory.servicePeriods?.length > 0;
  if (vkb.serviceHistory.branch) score += 5;
  if (vkb.serviceHistory.entryDate || hasServicePeriods) score += 5;
  if (vkb.serviceHistory.separationDate || hasServicePeriods) score += 5;
  if (vkb.serviceHistory.mos.length > 0) score += 5;
  if (vkb.serviceHistory.characterOfService) score += 5;

  maxScore += 30;
  if (vkb.medicalConditions.current.length > 0) score += 15;
  if (vkb.medicalConditions.secondary.length > 0) score += 10;
  if (vkb.medications.current.length > 0) score += 5;

  maxScore += 15;
  if (vkb.documentation.dd214s.length > 0) score += 5;
  if (vkb.documentation.blueButtonReports.length > 0) score += 5;
  if (vkb.evidenceTimeline.length > 0) score += 5;

  maxScore += 10;
  if (vkb.vaClaimsHistory.claims.length > 0) score += 5;
  if (vkb.vaClaimsHistory.ratings.length > 0) score += 5;

  return Math.round((score / maxScore) * 100);
};

const withPersonal = (vkb) => {
  vkb.personal.fullName = "Jane Doe";
  vkb.personal.dateOfBirth = "1988-04-02";
  vkb.personal.address.state = "TX";
  vkb.personal.email = "jane@example.test";
};

const withService = (vkb) => {
  vkb.serviceHistory.branch = "Army";
  vkb.serviceHistory.entryDate = "2010-06-01";
  vkb.serviceHistory.separationDate = "2015-05-30";
  vkb.serviceHistory.mos = [{ code: "11B" }];
  vkb.serviceHistory.characterOfService = "Honorable";
};

const withMedical = (vkb) => {
  vkb.medicalConditions.current = [{ name: "Tinnitus" }];
  vkb.medicalConditions.secondary = [{ condition: "Insomnia" }];
  vkb.medications.current = [{ name: "Sertraline" }];
};

const withEvidence = (vkb) => {
  vkb.documentation.dd214s = [{ id: "d1" }];
  vkb.documentation.blueButtonReports = [{ id: "b1" }];
  vkb.evidenceTimeline = [{ date: "2016-02-02" }];
};

const withClaims = (vkb) => {
  vkb.vaClaimsHistory.claims = [{ claimNumber: "C-1" }];
  vkb.vaClaimsHistory.ratings = [{ condition: "Tinnitus", percentage: 10 }];
};

const build = (...mutators) => {
  const vkb = initializeVKB();
  mutators.forEach((mutate) => mutate(vkb));
  return vkb;
};

const CASES = [
  ["empty", build()],
  ["personal only", build(withPersonal)],
  ["service only", build(withService)],
  ["medical only", build(withMedical)],
  ["evidence only", build(withEvidence)],
  ["claims only", build(withClaims)],
  ["personal + service", build(withPersonal, withService)],
  ["medical + evidence", build(withMedical, withEvidence)],
  [
    "everything",
    build(withPersonal, withService, withMedical, withEvidence, withClaims),
  ],
  [
    "phone instead of email",
    build(withPersonal, (v) => {
      v.personal.email = null;
      v.personal.phone = "555-0100";
    }),
  ],
  [
    "service periods carry the date credit (C1)",
    build(withService, (v) => {
      v.serviceHistory.entryDate = null;
      v.serviceHistory.separationDate = null;
      v.serviceHistory.servicePeriods = [{ branch: "Army" }];
    }),
  ],
  [
    "no service periods and no aggregate dates",
    build(withService, (v) => {
      v.serviceHistory.entryDate = null;
      v.serviceHistory.separationDate = null;
    }),
  ],
];

describe("calculateCompleteness matches the original scoring rubric", () => {
  it.each(CASES)("%s", (_label, vkb) => {
    expect(calculateCompleteness(vkb)).toBe(originalCalculateCompleteness(vkb));
  });
});

describe("calculateCompleteness bounds", () => {
  it("scores an empty VKB at 0", () => {
    expect(calculateCompleteness(initializeVKB())).toBe(0);
  });

  it("scores a fully populated VKB at 100", () => {
    const vkb = build(
      withPersonal,
      withService,
      withMedical,
      withEvidence,
      withClaims,
    );
    expect(calculateCompleteness(vkb)).toBe(100);
  });

  it("credits per-period service dates when the aggregates are unset", () => {
    const withPeriods = build(withService, (v) => {
      v.serviceHistory.entryDate = null;
      v.serviceHistory.separationDate = null;
      v.serviceHistory.servicePeriods = [{ branch: "Army" }];
    });
    const withoutPeriods = build(withService, (v) => {
      v.serviceHistory.entryDate = null;
      v.serviceHistory.separationDate = null;
    });
    expect(calculateCompleteness(withPeriods)).toBeGreaterThan(
      calculateCompleteness(withoutPeriods),
    );
  });
});
