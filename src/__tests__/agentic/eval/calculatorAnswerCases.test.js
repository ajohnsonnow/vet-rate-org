/**
 * The rater cases that carry structured conditions are answered by the
 * calculator, with no model call. The record, the checks, the dry run and the
 * report treat that as the expected outcome for those cases.
 */
import { describe, it, expect } from "vitest";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { calculateVARating } from "../../../utils/vaCalculator";
import { resolveAgentForTool } from "../../../utils/agentBoundaries";
import { SWARM_AGENTS } from "../../../utils/diamondSwarm";
import { buildCalculatorAnswer } from "../../../utils/raterGrounding";
import {
  answerRatingQuestion,
  buildNeedsRatingsAnswer,
} from "../../../utils/ratingQuestion";
import { noModelAnswerer } from "../../../../scripts/eval/lib/noModelCases.js";
import {
  AUTO_FAIL,
  AUTO_PASS,
  NEEDS_HUMAN,
  NOT_APPLICABLE,
  checkCalcMatch,
  checkRouting,
  gradeRecord,
} from "../../../../scripts/eval/lib/goldenChecks.js";
import { buildDryRunTranscript } from "../../../../scripts/eval/lib/dryRun.js";
import { loadGoldenSet } from "../../../../scripts/eval/lib/goldenSet.js";
import { assembleCaseRecord } from "../../../../scripts/eval/lib/caseRecord.js";
import { renderSummary } from "../../../../scripts/eval/lib/goldenReport.js";

const GOLDEN = loadGoldenSet(
  join(dirname(fileURLToPath(import.meta.url)), "..", "golden-set.jsonl"),
);
const byId = (id) => GOLDEN.find((c) => c.id === id);
const personaPrompts = Object.fromEntries(
  Object.values(SWARM_AGENTS).map((a) => [a.id, a.systemPrompt]),
);
const answerWithoutModel = noModelAnswerer({
  resolveAgentForTool,
  answerRatingQuestion,
});
const ctx = { calculateVARating, answerWithoutModel };
const CALCULATOR_CASES = ["a11", "a12", "a13", "a24", "a25"];
const answerFor = (caseDef) =>
  buildCalculatorAnswer(calculateVARating(caseDef.conditions), caseDef.input);

const calculatorOutcome = (caseDef, extra = {}) => ({
  ok: true,
  text: answerFor(caseDef),
  latencyMs: 3.6,
  captured: [],
  resultFlags: {
    onDevice: true,
    modelCalled: false,
    calculatorLead: {
      expected: calculateVARating(caseDef.conditions).combinedRating,
    },
  },
  ...extra,
});
const recordOf = (caseDef, outcome) =>
  assembleCaseRecord({
    caseDef,
    run: { modelIdRequested: "m", modelIdLoaded: "m", maxTokens: 1024 },
    personaPrompts,
    outcome,
  });
const modelRequest = (caseDef) => ({
  messages: [
    { role: "system", content: personaPrompts.rater },
    { role: "user", content: caseDef.input },
  ],
});

describe("the golden set's calculator cases", () => {
  it("are exactly the rater cases with structured conditions", () => {
    expect(GOLDEN.filter((c) => c.conditions).map((c) => c.id)).toEqual(
      CALCULATOR_CASES,
    );
  });
});

describe("the record of a case the calculator answered", () => {
  it.each(CALCULATOR_CASES)(
    "%s: no engine request, no agent, the marker and the latency",
    (id) => {
      const caseDef = byId(id);
      const record = recordOf(caseDef, calculatorOutcome(caseDef));
      expect(record).toMatchObject({
        modelCalled: false,
        engineRequests: 0,
        requestMatch: "none",
        actualAgent: null,
        latencyMs: 4,
        error: null,
        validatorBlocked: false,
        truncated: false,
      });
      expect(record.calculatorLead.expected).toBe(
        calculateVARating(caseDef.conditions).combinedRating,
      );
      expect(record.response).toBe(answerFor(caseDef));
    },
  );

  it("carries no marker when a model answered", () => {
    const caseDef = byId("a14");
    const record = recordOf(caseDef, {
      ok: true,
      text: "A model answer.",
      latencyMs: 9,
      captured: [modelRequest(caseDef)],
      resultFlags: { mode: "swarm" },
    });
    expect(record).not.toHaveProperty("modelCalled");
    expect(record.engineRequests).toBe(1);
  });
});

describe("routing for a calculator case", () => {
  it.each(CALCULATOR_CASES)(
    "%s: not applicable when no model was called",
    (id) => {
      const caseDef = byId(id);
      const out = checkRouting(
        caseDef,
        recordOf(caseDef, calculatorOutcome(caseDef)),
      );
      expect(out.status).toBe(NOT_APPLICABLE);
      expect(out.detail).toBe("the calculator answered: no model was called");
    },
  );

  it("fails when a model was called for it", () => {
    const caseDef = byId("a11");
    const record = recordOf(caseDef, {
      ok: true,
      text: "The combined rating is 80%.",
      latencyMs: 900,
      captured: [modelRequest(caseDef)],
      resultFlags: { mode: "swarm" },
    });
    const out = checkRouting(caseDef, record);
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.detail).toBe(
      "expected the app's own answer with no model call; a model was called (rater persona)",
    );
  });

  it("is left to a human when the case ended in an error", () => {
    const caseDef = byId("a11");
    const record = recordOf(caseDef, {
      ok: false,
      error: "boom",
      latencyMs: 1,
      captured: [],
    });
    expect(checkRouting(caseDef, record).status).toBe(NEEDS_HUMAN);
  });

  it("still compares personas for a rater case that is not a calculation", () => {
    expect(
      checkRouting(byId("a21"), { actualAgent: "rater" }, ctx).status,
    ).toBe(AUTO_PASS);
  });

  it("is left to a human when a case expected to reach a model did not", () => {
    const out = checkRouting(
      byId("a21"),
      { actualAgent: null, modelCalled: false },
      ctx,
    );
    expect(out.status).toBe(NEEDS_HUMAN);
  });
});

describe("a rating question with no ratings the app can use (a14)", () => {
  const caseDef = byId("a14");
  const outcome = {
    ok: true,
    text: buildNeedsRatingsAnswer(caseDef.input),
    latencyMs: 1,
    captured: [],
    resultFlags: { onDevice: true, modelCalled: false, needsRatings: true },
  };

  it("is one the app answers without a model", () => {
    expect(answerWithoutModel(caseDef)).toEqual({
      text: buildNeedsRatingsAnswer(caseDef.input),
      needsRatings: true,
    });
    expect(answerWithoutModel(byId("a21"))).toBeNull();
    expect(answerWithoutModel(byId("a20"))).toBeNull();
    expect(answerWithoutModel(byId("t07"))).toBeNull();
  });

  it("records the marker and no request", () => {
    expect(recordOf(caseDef, outcome)).toMatchObject({
      modelCalled: false,
      needsRatings: true,
      engineRequests: 0,
      actualAgent: null,
    });
    expect(recordOf(caseDef, outcome)).not.toHaveProperty("calculatorLead");
  });

  it("has no routing to check, and fails routing if a model was called", () => {
    const answered = checkRouting(caseDef, recordOf(caseDef, outcome), ctx);
    expect(answered.status).toBe(NOT_APPLICABLE);
    expect(answered.detail).toBe(
      "the app asked for the ratings: no model was called",
    );
    const called = recordOf(caseDef, {
      ok: true,
      text: "Your combined rating is 2 percent.",
      latencyMs: 900,
      captured: [modelRequest(caseDef)],
      resultFlags: { mode: "swarm" },
    });
    expect(checkRouting(caseDef, called, ctx).status).toBe(AUTO_FAIL);
  });

  it("has no calc-match: there is no figure to compare", () => {
    expect(
      checkCalcMatch(caseDef, recordOf(caseDef, outcome), ctx).status,
    ).toBe(NOT_APPLICABLE);
  });
});

describe("calc-match for a calculator case", () => {
  it.each(CALCULATOR_CASES)(
    "%s: reads the rating the answer states, not its working",
    (id) => {
      const caseDef = byId(id);
      const expected = calculateVARating(caseDef.conditions).combinedRating;
      const out = checkCalcMatch(
        caseDef,
        recordOf(caseDef, calculatorOutcome(caseDef)),
        ctx,
      );
      expect(out.status).toBe(AUTO_PASS);
      expect(out.data).toEqual({
        stated: expected,
        expected,
        multipleOf10: true,
      });
    },
  );

  it("fails an answer that states a different rating", () => {
    const caseDef = byId("a11");
    const out = checkCalcMatch(
      caseDef,
      recordOf(
        caseDef,
        calculatorOutcome(caseDef, { text: "Your combined rating is 70%." }),
      ),
      ctx,
    );
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.detail).toBe(
      "the calculator's answer states 70%, calculator 80%",
    );
  });

  it("fails an answer that does not state the rating", () => {
    const caseDef = byId("a11");
    const out = checkCalcMatch(
      caseDef,
      recordOf(caseDef, calculatorOutcome(caseDef, { text: "Here it is." })),
      ctx,
    );
    expect(out.status).toBe(AUTO_FAIL);
    expect(out.detail).toBe(
      "the calculator's answer does not state the combined rating (calculator: 80%)",
    );
  });

  it("decides R3 from it", () => {
    const caseDef = byId("a12");
    const grade = gradeRecord(
      caseDef,
      recordOf(caseDef, calculatorOutcome(caseDef)),
      ctx,
    );
    expect(grade.rubric.R3).toBe(AUTO_PASS);
    expect(grade.checks.routing.status).toBe(NOT_APPLICABLE);
  });
});

const [meta, ...cases] = buildDryRunTranscript({
  cases: GOLDEN,
  personaPrompts,
  resolveAgentForTool,
  answerWithoutModel,
  settings: { temperature: 0, maxTokens: 1024 },
});
const records = new Map(cases.map((r) => [r.id, r]));

describe("the dry run's calculator cases", () => {
  it.each(["a12", "a13", "a24", "a25"])(
    "%s is the calculator's own text with no engine request",
    (id) => {
      const record = records.get(id);
      expect(record).toMatchObject({
        modelCalled: false,
        engineRequests: 0,
        requestMatch: "none",
        actualAgent: null,
        computedResultInjected: null,
        error: null,
      });
      expect(record.latencyMs).toEqual(expect.any(Number));
      expect(record.response).toBe(answerFor(byId(id)));
      expect(record).not.toHaveProperty("calculatorReplacement");
    },
  );

  it("a14 is the fixed request for ratings, with no engine request", () => {
    const a14 = records.get("a14");
    expect(a14).toMatchObject({
      modelCalled: false,
      needsRatings: true,
      engineRequests: 0,
      error: null,
    });
    expect(a14.response).toBe(buildNeedsRatingsAnswer(byId("a14").input));
    expect(gradeRecord(byId("a14"), a14, ctx).checks.routing.status).toBe(
      NOT_APPLICABLE,
    );
  });

  it("a21, which asks for no calculation, still reaches the rater persona", () => {
    const a21 = records.get("a21");
    expect(a21).not.toHaveProperty("modelCalled");
    expect(a21.actualAgent).toBe("rater");
  });

  it("a11 stands in for a regression: a model was called and gave a wrong figure", () => {
    const a11 = records.get("a11");
    expect(a11).not.toHaveProperty("modelCalled");
    expect(a11.engineRequests).toBe(1);
    expect(a11.actualAgent).toBe("rater");
    expect(a11.computedResultInjected).toBe(false);
    const grade = gradeRecord(byId("a11"), a11, ctx);
    expect(grade.checks.routing.status).toBe(AUTO_FAIL);
    expect(grade.checks["calc-match"].status).toBe(AUTO_FAIL);
  });
});

describe("the dry run's summary", () => {
  it("says no model was called, and explains it", () => {
    const grades = cases.map((record) =>
      gradeRecord(byId(record.id), record, ctx),
    );
    const md = renderSummary({
      meta,
      runInfo: {
        modelId: "dry-run-stub",
        date: "2026-10-05T00:00:00.000Z",
        transcriptFile: "x.jsonl",
      },
      goldenCases: GOLDEN,
      cases,
      grades,
    });
    for (const id of ["a12", "a13", "a24", "a25"]) {
      expect(md).toContain(`| ${id} | rater / no model called | n/a | pass |`);
    }
    expect(md).toContain("| a11 | rater / rater | FAIL | FAIL |");
    expect(md).toContain(
      "- `routing` is `n/a` for a rating question on a rater tool: the app answers it from the calculator, or asks for the ratings it needs, and no model is called. A model call on such a case is a `routing` FAIL.",
    );
    expect(md).toContain(
      "- `calc-match` on the calculator's answers reads the sentence in which the calculator's answer states the combined rating. The text is the calculator's, so grade it on whether the working is correct and clear, not on model behaviour.",
    );
  });
});
