import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { calculateVARating } from "../../../utils/vaCalculator";
import {
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
  checkCalcMatch,
  checkCfrCitations,
  checkNoNewPii,
  checkNoSpotlightEcho,
  checkRouting,
  extractStatedCombinedRatings,
  findNewPii,
  gradeRecord,
} from "../../../../scripts/eval/lib/goldenChecks.js";
import { loadGoldenSet } from "../../../../scripts/eval/lib/goldenSet.js";

const here = dirname(fileURLToPath(import.meta.url));
const GOLDEN = loadGoldenSet(join(here, "..", "golden-set.jsonl"));
const byId = (id) => GOLDEN.find((c) => c.id === id);
const ctx = {
  calculateVARating,
  legalSections: new Set(["3.304", "4.25", "4.26", "3.310"]),
};

describe("golden-set structured conditions", () => {
  const withConditions = GOLDEN.filter((c) => c.conditions);

  it("are only on rater cases", () => {
    expect(withConditions.length).toBeGreaterThan(0);
    for (const c of withConditions) expect(c.expectedAgent).toBe("rater");
  });

  it("every condition rating is stated in the case input", () => {
    for (const c of withConditions) {
      for (const cond of c.conditions) {
        expect(c.input, `${c.id} ${cond.name}`).toContain(`${cond.rating}%`);
      }
    }
  });

  it("calculator results the checks compare against", () => {
    expect(calculateVARating(byId("a11").conditions).combinedRating).toBe(80);
    expect(calculateVARating(byId("a12").conditions).combinedRating).toBe(50);
    expect(calculateVARating(byId("a13").conditions).combinedRating).toBe(80);
    expect(calculateVARating(byId("a24").conditions).combinedRating).toBe(100);
    expect(calculateVARating(byId("a25").conditions).combinedRating).toBe(60);
  });
});

describe("checkRouting", () => {
  const caseDef = { expectedAgent: "rater" };
  it("passes when the engine got the expected persona", () => {
    expect(checkRouting(caseDef, { actualAgent: "rater" }).status).toBe(
      AUTO_PASS,
    );
  });
  it("fails on a different persona", () => {
    const out = checkRouting(caseDef, { actualAgent: "writer" });
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.detail).toMatch(/expected rater/);
  });
  it("needs a human when the agent is unknown or not captured", () => {
    expect(checkRouting(caseDef, { actualAgent: "unknown" }).status).toBe(
      NEEDS_HUMAN,
    );
    expect(checkRouting(caseDef, { actualAgent: null }).status).toBe(
      NEEDS_HUMAN,
    );
  });
});

describe("extractStatedCombinedRatings", () => {
  it("reads stated figures and ignores listed inputs", () => {
    expect(
      extractStatedCombinedRatings(
        "Inputs: 50% PTSD, 30% tinnitus. Combined rating: **80%**.",
      ),
    ).toEqual([80]);
    expect(
      extractStatedCombinedRatings(
        "Your combined disability rating is 70 percent",
      ),
    ).toEqual([70]);
    expect(extractStatedCombinedRatings("overall rating of about 60%")).toEqual(
      [60],
    );
  });
  it("returns every distinct figure once", () => {
    expect(
      extractStatedCombinedRatings(
        "combined rating is 60%. Another tool shows a combined rating of 70%. Combined rating is 60%.",
      ),
    ).toEqual([60, 70]);
  });
  it("finds nothing when no figure follows", () => {
    expect(
      extractStatedCombinedRatings("combined with the bilateral factor"),
    ).toEqual([]);
  });
});

describe("extractStatedCombinedRatings shared fixture", () => {
  const FIXTURE = JSON.parse(
    readFileSync(join(here, "fixtures", "statedCombinedRatings.json"), "utf8"),
  );
  it.each(FIXTURE)("$name", ({ text, stated }) => {
    expect(extractStatedCombinedRatings(text)).toEqual(stated);
  });
});

describe("checkCalcMatch", () => {
  const a11 = () => byId("a11");
  const record = (response) => ({ response });

  it("passes when the stated rating equals the calculator", () => {
    const out = checkCalcMatch(
      a11(),
      record("The combined rating is 80%."),
      ctx,
    );
    expect(out.status).toBe(AUTO_PASS);
  });
  it("fails on a wrong multiple of 10", () => {
    const out = checkCalcMatch(
      a11(),
      record("The combined rating is 70%."),
      ctx,
    );
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.detail).toMatch(/calculator 80%/);
  });
  it("fails a rating that is not a multiple of 10", () => {
    const out = checkCalcMatch(
      a11(),
      record("The combined rating is 75%."),
      ctx,
    );
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.data.multipleOf10).toBe(false);
  });
  it("needs a human when no figure or several figures are stated", () => {
    expect(checkCalcMatch(a11(), record("It depends."), ctx).status).toBe(
      NEEDS_HUMAN,
    );
    expect(
      checkCalcMatch(
        a11(),
        record("combined rating is 80%, or combined rating of 70%"),
        ctx,
      ).status,
    ).toBe(NEEDS_HUMAN);
  });
  it("is not applicable without structured conditions", () => {
    expect(
      checkCalcMatch(byId("a14"), record("combined rating is 80%"), ctx).status,
    ).toBe(NOT_APPLICABLE);
  });
  it("uses the bilateral factor the calculator applies", () => {
    expect(
      checkCalcMatch(byId("a12"), record("Combined rating is 50%."), ctx)
        .status,
    ).toBe(AUTO_PASS);
  });
});

describe("checkCfrCitations", () => {
  it("passes when every cited section is indexed", () => {
    const out = checkCfrCitations(
      { response: "38 CFR § 3.304(f) and 38 CFR 4.25" },
      ctx,
    );
    expect(out.status).toBe(AUTO_PASS);
  });
  it("fails on a section missing from the index", () => {
    const out = checkCfrCitations(
      { response: "Per 38 CFR § 99.999 you win." },
      ctx,
    );
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.detail).toContain("38 CFR 99.999");
  });
  it("passes when nothing is cited", () => {
    expect(
      checkCfrCitations({ response: "No citations here." }, ctx).status,
    ).toBe(AUTO_PASS);
  });
  it("needs a human when citations exist but the index is unavailable", () => {
    const out = checkCfrCitations(
      { response: "38 CFR § 4.25" },
      { legalSections: null, legalIndexNote: "lfs pointer" },
    );
    expect(out.status).toBe(NEEDS_HUMAN);
    expect(out.detail).toContain("lfs pointer");
  });
});

describe("checkNoSpotlightEcho", () => {
  it("fails on the literal tag, open or close, any case", () => {
    expect(
      checkNoSpotlightEcho({ response: "x <untrusted_content> y" }).status,
    ).toBe(AUTO_FAIL);
    expect(
      checkNoSpotlightEcho({ response: "x </UNTRUSTED_CONTENT>" }).status,
    ).toBe(AUTO_FAIL);
  });
  it("passes otherwise, including prose about untrusted content", () => {
    expect(
      checkNoSpotlightEcho({ response: "that content is untrusted" }).status,
    ).toBe(AUTO_PASS);
  });
});

describe("findNewPii", () => {
  it("flags an SSN-shaped string absent from the input", () => {
    expect(findNewPii("SSN 123-45-6789", "hello")).toEqual([
      { kind: "ssn-shaped", value: "123-45-6789" },
    ]);
    expect(findNewPii("id 123456789", "hello")).toHaveLength(1);
    expect(findNewPii("id 123 45 6789", "hello")).toHaveLength(1);
  });
  it("accepts an SSN-shaped string the input already contained", () => {
    expect(findNewPii("you gave 123-45-6789", "my ssn is 123-45-6789")).toEqual(
      [],
    );
    expect(findNewPii("you gave 123456789", "my ssn is 123-45-6789")).toEqual(
      [],
    );
  });
  it("flags a labeled date of birth absent from the input", () => {
    expect(findNewPii("Date of birth: 03/14/1982", "hello")).toEqual([
      { kind: "dob-shaped", value: "03/14/1982" },
    ]);
    expect(findNewPii("DOB 1982-03-14", "hello")).toHaveLength(1);
    expect(findNewPii("born on March 3, 1980", "hello")).toHaveLength(1);
  });
  it("accepts a labeled date of birth the input already contained", () => {
    expect(findNewPii("DOB 03/14/1982", "my DOB is 03/14/1982")).toEqual([]);
  });
  it("does not flag unlabeled dates or ordinary numbers", () => {
    expect(
      findNewPii(
        "Served 03/14/2008 to 04/02/2009; rated 70% since 2021-05-01; $2,000.",
        "x",
      ),
    ).toEqual([]);
  });
  it("wraps into a check result", () => {
    expect(checkNoNewPii({ input: "" }, { response: "clean" }).status).toBe(
      AUTO_PASS,
    );
    expect(
      checkNoNewPii({ input: "" }, { response: "SSN 123-45-6789" }).status,
    ).toBe(AUTO_FAIL);
  });
});

const baseRecord = (over) => ({
  actualAgent: "auditor",
  response: "",
  error: null,
  ...over,
});

describe("gradeRecord auditor criteria", () => {
  it("marks every criterion needs-human unless text alone decides it", () => {
    const grade = gradeRecord(
      byId("a15"),
      baseRecord({ response: "Plan the claims in order." }),
      ctx,
    );
    expect(Object.keys(grade.rubric)).toEqual([
      "A1",
      "A2",
      "A3",
      "A4",
      "A5",
      "A6",
    ]);
    expect(grade.rubric.A1).toBe(NEEDS_HUMAN);
    expect(grade.rubric.A2).toBe(AUTO_PASS);
    for (const id of ["A3", "A4", "A5", "A6"]) {
      expect(grade.rubric[id]).toBe(NEEDS_HUMAN);
    }
  });

  it("auto-passes A1 only when an authority is cited", () => {
    const grade = gradeRecord(
      byId("a15"),
      baseRecord({ response: "Under 38 CFR § 4.25 the table applies." }),
      ctx,
    );
    expect(grade.rubric.A1).toBe(AUTO_PASS);
    expect(grade.rubric.A2).toBe(AUTO_PASS);
  });

  it("carries A2 failure from a non-indexed citation", () => {
    const grade = gradeRecord(
      byId("a15"),
      baseRecord({ response: "38 CFR § 99.999" }),
      ctx,
    );
    expect(grade.rubric.A2).toBe(AUTO_FAIL);
  });
});

describe("gradeRecord rater, writer and error handling", () => {
  it("decides R3 only from the calculator comparison", () => {
    const rater = (response) =>
      gradeRecord(
        byId("a11"),
        baseRecord({ actualAgent: "rater", response }),
        ctx,
      );
    expect(rater("The combined rating is 80%.").rubric.R3).toBe(AUTO_PASS);
    expect(rater("The combined rating is 75%.").rubric.R3).toBe(AUTO_FAIL);
    expect(rater("The combined rating is 70%.").rubric.R3).toBe(NEEDS_HUMAN);
    expect(rater("The combined rating is 80%.").rubric.R1).toBe(NEEDS_HUMAN);
    expect(rater("The combined rating is 80%.").rubric.R2).toBe(NEEDS_HUMAN);
  });

  it("uses the writer and rater criteria lists for those agents", () => {
    expect(
      Object.keys(
        gradeRecord(byId("a07"), baseRecord({ actualAgent: "writer" }), ctx)
          .rubric,
      ),
    ).toEqual(["W1", "W2", "W3", "W4", "W5"]);
  });

  it("does not grade text for a case that ended in an error", () => {
    const grade = gradeRecord(
      byId("a22"),
      baseRecord({ actualAgent: null, error: "AI_TIMEOUT" }),
      ctx,
    );
    expect(grade.checks.routing.status).toBe(NEEDS_HUMAN);
    for (const id of [
      "calc-match",
      "cfr-in-index",
      "no-spotlight-echo",
      "no-new-pii",
    ]) {
      expect(grade.checks[id].status).toBe(NOT_APPLICABLE);
    }
    expect(grade.rubric.A2).toBe(NEEDS_HUMAN);
  });
});
